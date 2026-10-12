'use client'
import Dexie, { type EntityTable } from 'dexie'
import type { LocalNote } from './types'

type Meta = { key: string; value: string | number }

/** Versão anterior de uma nota, guardada só no aparelho (ver lib/history.ts) */
export type NoteVersion = {
  seq?: number
  noteId: string
  savedAt: number
  reason: 'edit' | 'conflict' | 'restore'
  title: string | null
  content: string
  tags: string[]
  /** Versões de notas do Vault ficam cifradas, como a nota */
  cipher?: string
}

/** Vetor de busca por sentido de uma nota (ver lib/semantic.ts) */
export type Embedding = { id: string; updatedAt: string; vec: number[] }

/** Chaves do Vault (CryptoKey não extraível) liberadas pela biometria deste aparelho */
type Secret = { key: string; value: unknown }

/** Banco local (IndexedDB). É a fonte da verdade no aparelho; o Atlas é a cópia de sync. */
export const db = new Dexie('grafite-notas') as Dexie & {
  notes: EntityTable<LocalNote, 'id'>
  meta: EntityTable<Meta, 'key'>
  history: EntityTable<NoteVersion, 'seq'>
  embeddings: EntityTable<Embedding, 'id'>
  secrets: EntityTable<Secret, 'key'>
}

db.version(1).stores({
  notes: 'id, updatedAt, createdAt, dirty',
  meta: 'key',
})

db.version(2).stores({
  history: '++seq, noteId, [noteId+savedAt]',
  embeddings: 'id',
  secrets: 'key',
})

export async function getMeta<T extends string | number>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: string | number) {
  await db.meta.put({ key, value })
}
