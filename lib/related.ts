import type { Note } from './types'

/**
 * Conexões por conteúdo, calculadas no aparelho (sem IA e sem internet):
 *  - notas parecidas: TF-IDF das palavras + tags em comum (+ vetores da busca por sentido, se já existirem);
 *  - tags sugeridas: as que você já usa e combinam com o texto, e as das notas parecidas.
 * Notas do Vault nunca entram.
 */

const STOP = new Set(`
a o as os um uma uns umas de do da dos das no na nos nas em por para pra pro com sem sob sobre entre ate desde
e ou mas nem que se como quando onde porque pois porem entao tambem ja ainda so mais menos muito muita muitos muitas
pouco pouca bem mal sim nao eu tu ele ela nos vos eles elas me te lhe nos vos lhes meu minha meus minhas teu tua seu sua
seus suas nosso nossa dele dela deles delas este esta estes estas esse essa esses essas aquele aquela isso isto aquilo
ser sou era foi sao estar estou esta estava ter tem tinha tenho fazer faz fiz vai vou ir ver vez coisa coisas aqui ali la
hoje amanha ontem agora depois antes sempre nunca cada todo toda todos todas outro outra outros outras mesmo mesma qual
quais quem cujo pela pelo pelas pelos num numa algo alguem nada tudo ai ne tipo assim tal tao lista nota notas item
the and for with from this that are was you your not but have has will can
`.split(/\s+/).filter(Boolean))

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Palavras relevantes de um texto (sem marcação, acentos nem palavras vazias) */
export function terms(text: string): string[] {
  return fold(text)
    .replace(/\[\[([^\]]+)\]\]/g, ' $1 ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9ç\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))
    .map(stem)
}

/** Radical simples para juntar plural e gênero ("reuniões" ~ "reunião", "compras" ~ "compra") */
function stem(w: string): string {
  if (w.length <= 4) return w
  return w.replace(/(oes|aes|ais|eis|ois)$/, 'ao').replace(/(as|os|es)$/, '').replace(/[aeo]$/, '').replace(/s$/, '')
}

const noteText = (n: Pick<Note, 'title' | 'content' | 'tags'>) => `${n.title ?? ''} ${n.title ?? ''} ${n.tags.join(' ')} ${n.content}`

type Vec = Map<string, number>

function tfidf(docs: Map<string, string[]>): Map<string, Vec> {
  const df = new Map<string, number>()
  for (const words of docs.values()) for (const w of new Set(words)) df.set(w, (df.get(w) ?? 0) + 1)
  const N = docs.size || 1
  const out = new Map<string, Vec>()
  for (const [id, words] of docs) {
    const tf = new Map<string, number>()
    for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1)
    const v: Vec = new Map()
    let norm = 0
    for (const [w, c] of tf) {
      const x = (1 + Math.log(c)) * Math.log(1 + N / (df.get(w) ?? 1))
      v.set(w, x)
      norm += x * x
    }
    norm = Math.sqrt(norm) || 1
    for (const [w, x] of v) v.set(w, x / norm)
    out.set(id, v)
  }
  return out
}

function cosine(a: Vec, b: Vec): number {
  const [small, big] = a.size < b.size ? [a, b] : [b, a]
  let s = 0
  for (const [w, x] of small) s += x * (big.get(w) ?? 0)
  return s
}

export type Related = {
  note: Note
  score: number
  /** Motivo curto: "#viagem em comum", "fala de orçamento, praia" */
  reason: string
  /** Já existe [[ligação]] entre as duas, em qualquer direção */
  linked: boolean
}

export type Draft = Pick<Note, 'id' | 'title' | 'content' | 'tags'>

/**
 * Notas mais parecidas com `draft`. `vectors` (opcional) = vetores da busca por sentido por id,
 * que reforçam o resultado quando já foram calculados.
 */
export function relatedNotes(draft: Draft, all: Note[], opts: { limit?: number; vectors?: Map<string, number[]> } = {}): Related[] {
  const { limit = 6, vectors } = opts
  const pool = all.filter((n) => n.id !== draft.id && !n.inVault && !n.cipher && (n.title || n.content.trim()))
  const docs = new Map<string, string[]>(pool.map((n) => [n.id, terms(noteText(n))]))
  docs.set('__draft', terms(noteText(draft)))
  if (docs.get('__draft')!.length < 2 && !draft.tags.length) return []
  const vecs = tfidf(docs)
  const me = vecs.get('__draft')!
  const myTags = new Set(draft.tags)
  const myVec = vectors?.get(draft.id)
  const myLinks = new Set(all.find((n) => n.id === draft.id)?.linkedNoteIds ?? [])

  return pool
    .map((n) => {
      const v = vecs.get(n.id)!
      const text = cosine(me, v)
      const shared = n.tags.filter((t) => myTags.has(t))
      const other = vectors?.get(n.id)
      // Vetores do Gemini ficam entre ~0,65 e 0,85: só a parte acima de 0,7 conta
      const sem = myVec && other ? Math.max(0, dot(myVec, other) - 0.7) * 2.5 : 0
      const score = text + shared.length * 0.18 + sem
      const linked = myLinks.has(n.id) || (n.linkedNoteIds ?? []).includes(draft.id)
      return { note: n, score, reason: reasonFor(me, v, shared, sem > 0.1), linked }
    })
    .filter((r) => r.score >= 0.12 || r.linked)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function reasonFor(me: Vec, other: Vec, shared: string[], semantic: boolean): string {
  if (shared.length) return `${shared.slice(0, 2).map((t) => `#${t}`).join(' ')} em comum`
  const words = [...me]
    .filter(([w]) => other.has(w))
    .map(([w, x]) => [w, x * other.get(w)!] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w)
  if (words.length) return `fala de ${words.join(', ')}`
  return semantic ? 'assunto parecido' : 'conteúdo parecido'
}

function dot(a: number[], b: number[]) {
  let s = 0
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i]
  return s
}

export type TagSuggestion = { tag: string; existing: boolean }

/**
 * Tags para a nota: primeiro as que você já usa e combinam com o texto ou com as notas parecidas;
 * depois, se faltar, até 2 palavras fortes do próprio texto (tags novas).
 */
export function suggestTags(draft: Draft, all: Note[], limit = 5): TagSuggestion[] {
  const have = new Set(draft.tags)
  const myTerms = terms(noteText({ ...draft, tags: [] }))
  if (myTerms.length < 2) return []
  const termSet = new Set(myTerms)
  const counts = new Map<string, number>()
  for (const n of all) if (!n.inVault) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1)

  const score = new Map<string, number>()
  const add = (t: string, x: number) => { if (!have.has(t)) score.set(t, (score.get(t) ?? 0) + x) }

  // Tag existente cujo nome (ou radical) aparece no texto
  for (const t of counts.keys()) {
    const parts = terms(t.replace(/[-_]/g, ' '))
    if (parts.length && parts.every((p) => termSet.has(p))) add(t, 2 + Math.min(1, (counts.get(t) ?? 0) / 10))
  }
  // Tags das notas mais parecidas
  for (const r of relatedNotes({ ...draft, tags: [] }, all, { limit: 8 })) {
    for (const t of r.note.tags) add(t, r.score * 2.5)
  }

  const existing = [...score].filter(([, x]) => x >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => ({ tag, existing: true }))
  if (existing.length >= limit) return existing

  // Palavras fortes do texto que ainda não são tag de nenhuma nota
  const freq = new Map<string, number>()
  const plain = fold(noteText({ ...draft, tags: [] })).replace(/[^a-z0-9ç\s]/g, ' ').split(/\s+/)
  for (const w of plain) {
    if (w.length < 4 || STOP.has(w) || /^\d+$/.test(w)) continue
    freq.set(w, (freq.get(w) ?? 0) + 1 + (fold(draft.title ?? '').includes(w) ? 2 : 0))
  }
  const fresh = [...freq]
    .filter(([w, c]) => c >= 2 && !counts.has(w) && !have.has(w) && !existing.some((e) => stem(e.tag) === stem(w)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.min(2, limit - existing.length))
    .map(([tag]) => ({ tag, existing: false }))
  return [...existing, ...fresh]
}

/** Tags já usadas que começam com o que está sendo digitado (para completar) */
export function completeTag(prefix: string, all: Note[], exclude: string[], limit = 6): string[] {
  const p = fold(prefix.replace(/^#/, ''))
  if (!p) return []
  const counts = new Map<string, number>()
  for (const n of all) if (!n.inVault) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts]
    .filter(([t]) => fold(t).includes(p) && !exclude.includes(t))
    .sort((a, b) => Number(fold(b[0]).startsWith(p)) - Number(fold(a[0]).startsWith(p)) || b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t)
}

/**
 * Liga uma nota sem mexer no meio do texto: o [[Título]] vai para a linha "Relacionadas:" no fim
 * (criada se não existir). Aceita também "Relacionada:" (que o assistente escreve).
 */
export function addRelatedLink(content: string, title: string): string {
  const link = `[[${title}]]`
  if (fold(content).includes(fold(link))) return content
  const lines = content.replace(/\s+$/, '').split('\n')
  const last = lines.length - 1
  if (last >= 0 && /^relacionadas?:/i.test(lines[last].trim())) {
    lines[last] = `${lines[last].trimEnd()} · ${link}`
    return lines.join('\n')
  }
  const body = lines.join('\n')
  return `${body}${body.trim() ? '\n\n' : ''}Relacionadas: ${link}`
}
