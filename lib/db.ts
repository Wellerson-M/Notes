'use client'
import Dexie, { type EntityTable } from 'dexie'
import type { LocalNote } from './types'

type Meta = { key: string; value: string | number }

/** Banco local (IndexedDB). É a fonte da verdade no aparelho; o Atlas é a cópia de sync. */
export const db = new Dexie('grafite-notas') as Dexie & {
  notes: EntityTable<LocalNote, 'id'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  notes: 'id, updatedAt, createdAt, dirty',
  meta: 'key',
})

export async function getMeta<T extends string | number>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: string | number) {
  await db.meta.put({ key, value })
}
