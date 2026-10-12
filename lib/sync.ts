'use client'
import { db, getMeta, setMeta } from './db'
import type { LocalNote, Note } from './types'
import { useUIStore } from '@/store/ui'
import { snapshot, snapshotIfDue } from './history'

/**
 * Sync local-first com o Atlas, regra "última escrita vence" por nota.
 * Envia as notas sujas e recebe tudo que mudou no servidor desde o último cursor.
 */

let timer: ReturnType<typeof setTimeout> | null = null
let running: Promise<void> | null = null

export type SyncResult = 'ok' | 'offline' | 'unauthorized' | 'error'

export function scheduleSync(delay = 2000) {
  if (typeof window === 'undefined') return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void syncNow() }, delay)
}

export function syncNow(): Promise<SyncResult> {
  if (running) return running.then(() => syncNow())
  let result: SyncResult = 'ok'
  running = doSync().then((r) => { result = r }).finally(() => { running = null })
  return running.then(() => result)
}

async function doSync(): Promise<SyncResult> {
  const ui = useUIStore.getState()
  if (!navigator.onLine) { ui.setSyncStatus('offline'); return 'offline' }

  ui.setSyncStatus('syncing')
  try {
    const dirty = await db.notes.where('dirty').equals(1).toArray()
    const since = (await getMeta<number>('syncCursor')) ?? 0
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since, notes: dirty.map(({ dirty: _d, ...n }) => n) }),
    })
    if (res.status === 401) { ui.setSyncStatus('unauthorized'); return 'unauthorized' }
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: string } | null
      ui.setSyncError(detail?.error ?? `O servidor respondeu ${res.status}.`)
      ui.setSyncStatus('error')
      return 'error'
    }
    const { notes: remote, cursor } = (await res.json()) as { notes: Note[]; cursor: number }

    await db.transaction('rw', db.notes, db.meta, db.history, async () => {
      // Primeiro aplica o que veio do servidor, enquanto as notas locais ainda estão marcadas
      // como sujas — é isso que identifica uma edição local que perdeu o conflito
      for (const r of remote) {
        const local = await db.notes.get(r.id)
        if (!local || (!local.dirty && r.updatedAt !== local.updatedAt) || r.updatedAt > local.updatedAt) {
          // Edição local não enviada perdendo para outro aparelho: guarda para dar para recuperar
          if (local?.dirty) await snapshot(local, 'conflict')
          else if (local) await snapshotIfDue(local, r as LocalNote)
          await db.notes.put({ ...r, dirty: 0 } as LocalNote)
        }
      }
      // Limpa a marca de sujo só se a nota não mudou enquanto a requisição estava no ar
      for (const sent of dirty) {
        const now = await db.notes.get(sent.id)
        if (now && now.updatedAt === sent.updatedAt) await db.notes.update(sent.id, { dirty: 0 })
      }
      await setMeta('syncCursor', cursor)
    })
    await setMeta('lastSyncAt', Date.now())
    ui.setSyncError(null)
    ui.setSyncStatus('ok')
    return 'ok'
  } catch {
    ui.setSyncError('Sem resposta do servidor.')
    ui.setSyncStatus('error')
    return 'error'
  }
}

/** Liga o sync automático: ao abrir, ao voltar a internet, ao voltar para o app e a cada 5 min */
export function startAutoSync() {
  scheduleSync(300)
  const onFocus = () => { if (document.visibilityState === 'visible') scheduleSync(300) }
  const onOffline = () => useUIStore.getState().setSyncStatus('offline')
  window.addEventListener('online', onFocus)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onFocus)
  const interval = setInterval(() => scheduleSync(0), 5 * 60 * 1000)
  return () => {
    window.removeEventListener('online', onFocus)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onFocus)
    clearInterval(interval)
  }
}
