'use client'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { extractLinkedIds, extractTasks } from './notes'
import type { LocalNote, Note } from './types'
import { scheduleSync } from './sync'

function newId(): string {
  // randomUUID só existe em contexto seguro (https/localhost); no IP da rede local cai no fallback
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

function strip({ dirty: _dirty, ...note }: LocalNote): Note {
  return note
}

async function allNotes(): Promise<Note[]> {
  const rows = await db.notes.toArray()
  return rows.filter((n) => !n.deleted).map(strip)
}

/** Campos derivados do conteúdo — recalculados a cada gravação */
async function derive(content: string) {
  return { tasks: extractTasks(content), linkedNoteIds: extractLinkedIds(content, await allNotes()) }
}

export type NoteInput = Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>

export const notesRepo = {
  list: allNotes,

  async get(id: string): Promise<Note | null> {
    const n = await db.notes.get(id)
    return n && !n.deleted ? strip(n) : null
  },

  async create(data: NoteInput = {}, id = newId()): Promise<Note> {
    const now = new Date().toISOString()
    const content = data.content ?? ''
    const note: LocalNote = {
      title: null,
      tags: [],
      pinned: false,
      inVault: false,
      attachments: {},
      ...data,
      ...(await derive(content)),
      content,
      id,
      createdAt: now,
      updatedAt: now,
      dirty: 1,
    }
    await db.notes.put(note)
    scheduleSync()
    return strip(note)
  },

  async update(id: string, patch: NoteInput): Promise<Note | null> {
    const current = await db.notes.get(id)
    if (!current) return null
    const derived = patch.content !== undefined ? await derive(patch.content) : {}
    const next: LocalNote = { ...current, ...patch, ...derived, updatedAt: new Date().toISOString(), dirty: 1 }
    await db.notes.put(next)
    scheduleSync()
    return strip(next)
  },

  /** Exclusão lógica, para a deleção chegar nos outros aparelhos */
  async remove(id: string) {
    await this.update(id, { deleted: true, content: '', title: null })
  },

  /** Desfaz uma exclusão regravando a nota como estava */
  async restore(note: Note) {
    await db.notes.put({ ...note, deleted: false, updatedAt: new Date().toISOString(), dirty: 1 })
    scheduleSync()
  },
}

/** Apaga com toast de "desfazer" */
export async function removeWithUndo(note: Note, showToast: (msg: string, a?: { actionLabel: string; onAction: () => void }) => void) {
  await notesRepo.remove(note.id)
  showToast('Nota apagada', { actionLabel: 'desfazer', onAction: () => void notesRepo.restore(note) })
}

/** Lista reativa: re-renderiza sozinha quando qualquer nota muda (inclusive via sync) */
export function useNotes(): Note[] | undefined {
  return useLiveQuery(allNotes, [])
}

/** `undefined` = carregando, `null` = não existe */
export function useNote(id: string): Note | null | undefined {
  return useLiveQuery(async () => (await notesRepo.get(id)) ?? null, [id])
}
