'use client'
import { db } from './db'
import { ai } from './ai'
import { getPreview } from './notes'
import type { Note } from './types'

/**
 * Busca por sentido: cada nota vira um vetor (embedding do Gemini, 256 dimensões) guardado no
 * IndexedDB; a busca compara o vetor da pergunta com o de cada nota, tudo no aparelho.
 * Os vetores só são (re)calculados para notas novas ou editadas. O Vault fica de fora.
 */

const BATCH = 50
// Os escores do gemini-embedding-001 ficam espremidos (~0,65 a 0,80): um corte fixo não basta.
// Fica o que passa do mínimo E está perto da melhor nota (calibrado com notas reais em pt-BR).
const MIN_SCORE = 0.72
const MARGIN = 0.025

const noteText = (n: Note) => `${n.title ?? ''}\n${n.tags.map((t) => `#${t}`).join(' ')}\n${getPreview(n.content, 1800)}`

/** Calcula os vetores que faltam. `onProgress(feitos, total)` para mostrar o andamento. */
export async function ensureEmbeddings(notes: Note[], onProgress?: (done: number, total: number) => void) {
  const eligible = notes.filter((n) => !n.inVault && !n.cipher && (n.title || n.content.trim()))
  const existing = new Map((await db.embeddings.bulkGet(eligible.map((n) => n.id))).map((e, i) => [eligible[i].id, e]))
  const stale = eligible.filter((n) => existing.get(n.id)?.updatedAt !== n.updatedAt)

  for (let i = 0; i < stale.length; i += BATCH) {
    onProgress?.(i, stale.length)
    const batch = stale.slice(i, i + BATCH)
    const vectors = await ai.embed(batch.map(noteText), 'document')
    await db.embeddings.bulkPut(batch.map((n, j) => ({ id: n.id, updatedAt: n.updatedAt, vec: vectors[j] })).filter((e) => e.vec))
  }
  onProgress?.(stale.length, stale.length)
}

/** Notas mais parecidas com a pergunta, da mais para a menos relevante */
export async function semanticSearch(query: string, notes: Note[], limit = 15): Promise<{ note: Note; score: number }[]> {
  const [q] = await ai.embed([query], 'query')
  if (!q) return []
  const byId = new Map(notes.filter((n) => !n.inVault).map((n) => [n.id, n]))
  const rows = await db.embeddings.bulkGet([...byId.keys()])
  const scored = rows
    .flatMap((e) => {
      const note = e && byId.get(e.id)
      return note ? [{ note, score: dot(q, e.vec) }] : []
    })
    .sort((a, b) => b.score - a.score)
  const cut = Math.max(MIN_SCORE, (scored[0]?.score ?? 0) - MARGIN)
  return scored.filter((r) => r.score >= cut).slice(0, limit)
}

function dot(a: number[], b: number[]) {
  let s = 0
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i]
  return s
}

/** Vetores já calculados (só leitura local, sem chamar a IA) — reforçam as conexões sugeridas */
export async function localVectors(ids: string[]): Promise<Map<string, number[]>> {
  const rows = await db.embeddings.bulkGet(ids)
  return new Map(rows.flatMap((e) => (e ? [[e.id, e.vec] as [string, number[]]] : [])))
}
