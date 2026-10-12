'use client'
import type { AIRequest, AssistantReply, NoteDigest, Suggestions, TransformAction, ChatTurn } from './ai-types'
import type { Note } from './types'
import { getPreview } from './notes'

export class AIError extends Error {}

async function call<T>(body: AIRequest): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AIError('A IA precisa de internet.')
  }
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new AIError('Entre com sua senha em Ajustes para usar a IA.')
  if (!res.ok) throw new AIError(data.error ?? 'A IA não conseguiu responder agora.')
  return data as T
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Escolhe as notas mais relevantes para mandar como contexto: palavras em comum com a
 * pergunta pesam mais, recência desempata. Notas do Vault nunca saem do aparelho.
 */
export function buildDigests(notes: Note[], query = '', limit = 40, excludeId?: string): NoteDigest[] {
  const words = normalize(query).split(/\W+/).filter((w) => w.length > 2)
  const now = Date.now()
  return notes
    .filter((n) => !n.inVault && n.id !== excludeId)
    .map((n) => {
      const hay = normalize(`${n.title ?? ''} ${n.tags.join(' ')} ${n.content}`)
      const hits = words.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0)
      const ageDays = (now - new Date(n.updatedAt).getTime()) / 86400000
      return { n, score: hits * 10 + Math.max(0, 5 - ageDays / 7) + (n.pinned ? 2 : 0) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ n }) => ({
      id: n.id,
      title: n.title,
      tags: n.tags,
      date: new Date(n.createdAt).toLocaleDateString('pt-BR'),
      text: getPreview(n.content, 400),
    }))
}

export const ai = {
  transform: (action: TransformAction, title: string | null, content: string) =>
    call<{ text: string }>({ kind: 'transform', action, title, content }).then((r) => r.text),

  suggest: (note: Pick<Note, 'id' | 'title' | 'content' | 'tags'>, all: Note[]) =>
    call<Suggestions>({
      kind: 'suggest',
      title: note.title,
      content: note.content,
      tags: note.tags,
      notes: buildDigests(all, `${note.title ?? ''} ${note.content}`, 30, note.id),
    }),

  assistant: (message: string, history: ChatTurn[], all: Note[]) =>
    call<AssistantReply>({
      kind: 'assistant',
      message,
      history,
      notes: buildDigests(all, message),
      today: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    }),
}
