'use client'
import Dexie from 'dexie'
import { db, type NoteVersion } from './db'
import type { LocalNote } from './types'
import { decrypt, encrypt } from './vault'

/**
 * Versões anteriores das notas, só neste aparelho. Uma versão é guardada:
 *  - ao editar, se a última versão guardada tiver mais de 10 minutos;
 *  - quando o sync substitui a nota local por outra (conflito entre aparelhos);
 *  - antes de restaurar uma versão antiga.
 */

const EDIT_INTERVAL_MS = 10 * 60 * 1000
const MAX_PER_NOTE = 50

const range = (noteId: string) => db.history.where('[noteId+savedAt]').between([noteId, Dexie.minKey], [noteId, Dexie.maxKey])

function sameText(a: LocalNote, b: Pick<LocalNote, 'title' | 'content' | 'cipher'>) {
  return a.title === b.title && a.content === b.content && a.cipher === b.cipher
}

/** Guarda `stored` (a nota como está no banco) como versão. Precisa rodar dentro de uma transação que inclua `history` */
export async function snapshot(stored: LocalNote, reason: NoteVersion['reason']) {
  if (stored.deleted || (!stored.content.trim() && !stored.title && !stored.cipher)) return
  const last = await range(stored.id).last()
  if (last && sameText(stored, last)) return
  await db.history.add({
    noteId: stored.id,
    savedAt: Date.now(),
    reason,
    title: stored.title,
    content: stored.content,
    tags: stored.tags,
    cipher: stored.cipher,
  })
  const count = await range(stored.id).count()
  if (count > MAX_PER_NOTE) {
    const old = await range(stored.id).limit(count - MAX_PER_NOTE).primaryKeys()
    await db.history.bulkDelete(old)
  }
}

/** Chamado a cada edição: só guarda se a última versão for antiga */
export async function snapshotIfDue(current: LocalNote, next: Pick<LocalNote, 'title' | 'content' | 'cipher'>) {
  if (sameText(current, next)) return
  const last = await range(current.id).last()
  if (last && Date.now() - last.savedAt < EDIT_INTERVAL_MS) return
  await snapshot(current, 'edit')
}

/** Nota entrou no Vault: cifra as versões antigas que estavam em texto aberto */
export async function sealHistory(noteId: string) {
  const open = await range(noteId).filter((v) => !v.cipher).toArray()
  for (const v of open) {
    const cipher = await encrypt({ title: v.title, content: v.content, tags: v.tags })
    await db.history.update(v.seq!, { cipher, title: null, content: '', tags: [] })
  }
}

export type VersionView = NoteVersion & { locked: boolean }

/** Versões de uma nota, da mais nova para a mais antiga (decifradas se o Vault estiver aberto) */
export async function listVersions(noteId: string): Promise<VersionView[]> {
  const rows = await range(noteId).reverse().toArray()
  return Promise.all(rows.map(async (v) => {
    if (!v.cipher) return { ...v, locked: false }
    try {
      return { ...v, ...(await decrypt(v.cipher)), locked: false }
    } catch {
      return { ...v, locked: true }
    }
  }))
}
