'use client'
import type { AIRequest, AssistantReply, NoteDigest, Suggestions, TransformAction, ChatTurn } from './ai-types'
import type { Note } from './types'
import { getPreview } from './notes'
import { getModelPref } from './ai-models'
import { dateKey, parseKey } from './schedule'

export class AIError extends Error {}

/** Mensagem do 401: as telas trocam por um campo de senha ali mesmo (ConnectInline) */
export const AI_LOGIN_MESSAGE = 'Entre com sua senha para usar a IA.'

async function call<T>(body: AIRequest): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AIError('A IA precisa de internet.')
  }
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // A preferência de modelo (Ajustes → IA) vai junto; o servidor decide no Automático
    body: JSON.stringify({ ...body, model: getModelPref() }),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new AIError(AI_LOGIN_MESSAGE)
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
      // Compromissos dos próximos 14 dias entram mesmo sem palavra em comum (perguntas de agenda)
      const daysAhead = n.schedule ? (parseKey(n.schedule.date).getTime() - now) / 86400000 : NaN
      const upcoming = daysAhead > -1 && daysAhead < 14 ? 6 : 0
      return { n, score: hits * 10 + Math.max(0, 5 - ageDays / 7) + (n.pinned ? 2 : 0) + upcoming }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ n }) => ({
      id: n.id,
      title: n.title,
      tags: n.tags,
      date: new Date(n.createdAt).toLocaleDateString('pt-BR'),
      text: getPreview(n.content, 400),
      when: n.schedule ? `${n.schedule.date}${n.schedule.time ? ` ${n.schedule.time}` : ''}` : undefined,
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
      todayIso: dateKey(new Date()),
    }),

  /** Foto (já comprimida no aparelho) → texto em markdown */
  ocr: (image: { base64: string; mimeType: string }) =>
    call<{ text: string }>({ kind: 'ocr', image: image.base64, mimeType: image.mimeType }).then((r) => r.text),

  embed: (texts: string[], task: 'document' | 'query') =>
    call<{ vectors: number[][] }>({ kind: 'embed', texts, task }).then((r) => r.vectors),

  /** Retrospectiva das notas criadas ou editadas no período (o Vault fica de fora) */
  review: (all: Note[], from: Date, to: Date, period: string) => {
    const inPeriod = all.filter((n) => {
      const t = Math.max(new Date(n.createdAt).getTime(), new Date(n.updatedAt).getTime())
      return t >= from.getTime() && t <= to.getTime()
    })
    return call<{ text: string }>({
      kind: 'review',
      period,
      notes: buildDigests(inPeriod, '', 60).map((d) => ({ ...d, text: getPreview(inPeriod.find((n) => n.id === d.id)?.content ?? '', 700) })),
    }).then((r) => ({ text: r.text, count: inPeriod.filter((n) => !n.inVault).length }))
  },
}
