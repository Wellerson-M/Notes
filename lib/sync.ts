'use client'
import { db, getMeta, setMeta } from './db'
import type { LocalNote, Note } from './types'
import { useUIStore } from '@/store/ui'

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
    if (!res.ok) throw new Error(`sync ${res.status}`)
    const { notes: remote, cursor } = (await res.json()) as { notes: Note[]; cursor: number }

    await db.transaction('rw', db.notes, db.meta, async () => {
      // Limpa a marca de sujo só se a nota não mudou enquanto a requisição estava no ar
      for (const sent of dirty) {
        const now = await db.notes.get(sent.id)
        if (now && now.updatedAt === sent.updatedAt) await db.notes.update(sent.id, { dirty: 0 })
      }
      for (const r of remote) {
        const local = await db.notes.get(r.id)
        if (!local || (!local.dirty && r.updatedAt !== local.updatedAt) || r.updatedAt > local.updatedAt) {
          await db.notes.put({ ...r, dirty: 0 } as LocalNote)
        }
      }
      await setMeta('syncCursor', cursor)
    })
    await setMeta('lastSyncAt', Date.now())
    ui.setSyncStatus('ok')
    return 'ok'
  } catch {
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
