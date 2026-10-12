'use client'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { extractLinkedIds, extractTasks } from './notes'
import type { LocalNote, Note } from './types'
import { scheduleSync } from './sync'
import { sealHistory, snapshot, snapshotIfDue } from './history'
import { decrypt, encrypt, isUnlocked, VaultLockedError } from './vault'
import { useUIStore } from '@/store/ui'

export { VaultLockedError }

function newId(): string {
  // randomUUID só existe em contexto seguro (https/localhost); no IP da rede local cai no fallback
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

function strip({ dirty: _dirty, ...note }: LocalNote): Note {
  return note
}

/** Nota do Vault aberta para leitura. Com o Vault trancado, volta como está (com `cipher`). */
const plainCache = new Map<string, LocalNote>()
async function open(stored: LocalNote): Promise<LocalNote> {
  if (!stored.cipher || !isUnlocked()) return stored
  const cacheKey = `${stored.id}:${stored.updatedAt}`
  const hit = plainCache.get(cacheKey)
  if (hit) return { ...hit, pinned: stored.pinned, dirty: stored.dirty }
  try {
    const p = await decrypt(stored.cipher)
    const plain: LocalNote = { ...stored, ...p, tasks: extractTasks(p.content), cipher: undefined }
    plainCache.set(cacheKey, plain)
    return plain
  } catch {
    return stored
  }
}

/** Forma gravada: notas do Vault vão cifradas e sem nenhum campo derivado do texto */
async function seal(plain: LocalNote): Promise<LocalNote> {
  if (!plain.inVault) return { ...plain, cipher: undefined }
  const cipher = await encrypt({ title: plain.title, content: plain.content, tags: plain.tags })
  return { ...plain, title: null, content: '', tags: [], tasks: undefined, linkedNoteIds: undefined, cipher }
}

async function allNotes(): Promise<Note[]> {
  const rows = await db.notes.toArray()
  const visible = (await Promise.all(rows.filter((n) => !n.deleted).map(open))).map(strip)
  // Ligações [[Título]] calculadas na leitura: uma nota criada (ou renomeada) depois de quem a
  // cita já aparece ligada, sem precisar regravar a outra
  return visible.map((n) => (n.content.includes('[[') ? { ...n, linkedNoteIds: extractLinkedIds(n.content, visible) } : n))
}

/** Campos derivados do conteúdo — recalculados a cada gravação */
async function derive(content: string) {
  return { tasks: extractTasks(content), linkedNoteIds: extractLinkedIds(content, await allNotes()) }
}

export type NoteInput = Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'cipher'>>

/** Campos que dá para mudar mesmo com o Vault trancado, sem tocar no texto */
const META_ONLY = new Set(['pinned', 'deleted'])

export const notesRepo = {
  list: allNotes,

  async get(id: string): Promise<Note | null> {
    const n = await db.notes.get(id)
    return n && !n.deleted ? strip(await open(n)) : null
  },

  /** Lança VaultLockedError se a nota for do Vault e ele estiver trancado */
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
    await db.notes.put(await seal(note))
    scheduleSync()
    return strip(note)
  },

  /** Lança VaultLockedError se precisar ler ou cifrar texto do Vault trancado */
  async update(id: string, patch: NoteInput): Promise<Note | null> {
    const current = await db.notes.get(id)
    if (!current) return null
    const updatedAt = new Date().toISOString()

    // Fixar/soltar uma nota do Vault trancado não precisa da chave
    if (current.cipher && !isUnlocked() && Object.keys(patch).every((k) => META_ONLY.has(k))) {
      const next = { ...current, ...patch, updatedAt, dirty: 1 as const }
      await db.notes.put(next)
      scheduleSync()
      return strip(next)
    }

    const plain = await open(current)
    if (plain.cipher) throw new VaultLockedError()
    const derived = patch.content !== undefined ? await derive(patch.content) : {}
    const next: LocalNote = { ...plain, ...patch, ...derived, updatedAt, dirty: 1 }
    const sealed = await seal(next)
    await db.transaction('rw', db.notes, db.history, db.embeddings, async () => {
      // Ao entrar no Vault, a versão em claro não vira histórico; as antigas são cifradas
      if (!(sealed.inVault && !current.cipher)) await snapshotIfDue(current, sealed)
      await db.notes.put(sealed)
      if (sealed.inVault) await db.embeddings.delete(id)
    })
    // Fora da transação: o Dexie a encerraria ao esperar a Web Crypto
    if (sealed.inVault) await sealHistory(id)
    scheduleSync()
    return strip(next)
  },

  /** Exclusão lógica, para a deleção chegar nos outros aparelhos (funciona com o Vault trancado) */
  async remove(id: string) {
    const current = await db.notes.get(id)
    if (!current) return
    await db.transaction('rw', db.notes, db.history, async () => {
      await snapshot(current, 'edit')
      await db.notes.put({
        ...current, deleted: true, content: '', title: null, tags: [], cipher: undefined,
        tasks: undefined, linkedNoteIds: undefined, updatedAt: new Date().toISOString(), dirty: 1,
      })
    })
    scheduleSync()
  },

  /** Desfaz uma exclusão regravando a nota como estava */
  async restore(note: Note) {
    const base: LocalNote = { ...note, deleted: false, updatedAt: new Date().toISOString(), dirty: 1 }
    // Nota do Vault que já veio cifrada (lida com ele trancado) volta exatamente como estava
    await db.notes.put(note.cipher ? base : await seal(base))
    scheduleSync()
  },

  /** Guarda a versão atual no histórico agora, antes de uma troca grande (ex.: restaurar versão) */
  async checkpoint(id: string) {
    const current = await db.notes.get(id)
    if (current) await db.transaction('rw', db.history, () => snapshot(current, 'restore'))
  },
}

/** Apaga com toast de "desfazer" */
export async function removeWithUndo(note: Note, showToast: (msg: string, a?: { actionLabel: string; onAction: () => void }) => void) {
  await notesRepo.remove(note.id)
  showToast('Nota apagada', { actionLabel: 'desfazer', onAction: () => void notesRepo.restore(note) })
}

/** Nota do Vault que não pôde ser decifrada (Vault trancado) */
export const isLocked = (n: Note) => !!n.cipher

/** Lista reativa: re-renderiza sozinha quando qualquer nota muda (inclusive via sync) ou o Vault abre/fecha */
export function useNotes(): Note[] | undefined {
  const vaultLocked = useUIStore((s) => s.vaultLocked)
  return useLiveQuery(allNotes, [vaultLocked])
}

/** `undefined` = carregando, `null` = não existe */
export function useNote(id: string): Note | null | undefined {
  const vaultLocked = useUIStore((s) => s.vaultLocked)
  return useLiveQuery(async () => (await notesRepo.get(id)) ?? null, [id, vaultLocked])
}
