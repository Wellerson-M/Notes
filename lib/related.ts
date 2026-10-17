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
  // O motivo mostra a palavra como foi escrita ("chocolate"), não o radical ("chocolat")
  const spelled = new Map<string, string>()
  for (const t of surfaceTerms(noteText(draft))) if (!spelled.has(t.term)) spelled.set(t.term, t.surface)

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
      return { note: n, score, reason: reasonFor(me, v, shared, sem > 0.1, spelled), linked }
    })
    .filter((r) => r.score >= 0.12 || r.linked)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function reasonFor(me: Vec, other: Vec, shared: string[], semantic: boolean, spelled: Map<string, string>): string {
  if (shared.length) return `${shared.slice(0, 2).map((t) => `#${t}`).join(' ')} em comum`
  const words = [...me]
    .filter(([w]) => other.has(w))
    .map(([w, x]) => [w, x * other.get(w)!] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => spelled.get(w) ?? w)
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

const RELATED_LINE = /^\s*relacionadas?:/i

/**
 * Separa as linhas "Relacionadas: [[A]] · [[B]]" do resto do texto.
 * Devolve o texto sem elas e os títulos que estavam ali.
 */
export function splitRelatedLines(content: string): { body: string; titles: string[] } {
  const titles: string[] = []
  const kept = content.split('\n').filter((line) => {
    if (!RELATED_LINE.test(line) || !line.includes('[[')) return true
    for (const m of line.matchAll(/\[\[([^\]]+)\]\]/g)) titles.push(m[1].trim())
    return false
  })
  return { body: kept.join('\n').replace(/\s+$/, ''), titles }
}

/**
 * Texto para colar em outro lugar (outra IA, e-mail...): título como `#`, sem a linha
 * "Relacionadas:" e com os [[links]] virando texto normal.
 */
export function textForCopy(title: string | null, content: string): string {
  const body = splitRelatedLines(content).body.replace(/\[\[([^\]]+)\]\]/g, '$1').trim()
  const t = title?.trim()
  return t ? `# ${t}\n\n${body}` : body
}

/** Apaga o conteúdo, mas mantém a linha "Relacionadas:" (ligação não é conteúdo) */
export function clearedContent(content: string): string {
  return content.split('\n').filter((line) => RELATED_LINE.test(line) && line.includes('[[')).join('\n')
}

const LINKS_IN_TEXT_KEY = 'grafite-links-in-text'

/** Onde o "ligar" guarda a ligação: fora do texto (padrão) ou na linha "Relacionadas:" */
export function getLinksInText(): boolean {
  try { return localStorage.getItem(LINKS_IN_TEXT_KEY) === '1' } catch { return false }
}

export function setLinksInText(on: boolean) {
  try { localStorage.setItem(LINKS_IN_TEXT_KEY, on ? '1' : '0') } catch { /* modo privado */ }
}

// ── Conexões indiretas (grafo) ───────────────────────────────────────────

export type IndirectLink = {
  a: string
  b: string
  /** 0..1, força da semelhança (espessura e brilho da linha) */
  score: number
  /** "fala de orçamento, praia", "#viagem em comum", "cita “Mercado”" */
  reason: string
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Palavras com a grafia original (com acento) ao lado do radical, e quais parecem nomes próprios */
function surfaceTerms(text: string) {
  const out: { term: string; surface: string; name: boolean }[] = []
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const raw = m[0]
    const w = fold(raw)
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue
    // Nome: maiúscula no meio da frase ("falei com a Ana", "conta no Nubank") ou sigla ("PIX", "ONU")
    const prev = text.slice(Math.max(0, (m.index ?? 0) - 3), m.index).trimEnd()
    const midSentence = prev !== '' && !/[.!?:\n#>*\-]$/.test(prev)
    const name = (/^\p{Lu}\p{Ll}/u.test(raw) && midSentence) || (/^\p{Lu}{2,}$/u.test(raw) && raw.length <= 6)
    out.push({ term: stem(w), surface: raw.toLowerCase(), name })
  }
  return out
}

/**
 * Pares de notas que falam da mesma coisa sem estarem ligadas: mesmas palavras raras, mesmos
 * nomes, tags em comum ou uma citando o título da outra. Tudo no aparelho, sem IA.
 * Usa um índice invertido (só compara notas que dividem alguma palavra) e guarda no máximo
 * `perNote` conexões por nota — senão o grafo vira um novelo.
 */
export function indirectLinks(all: Note[], opts: { perNote?: number; min?: number } = {}): IndirectLink[] {
  const { perNote = 3, min = 0.12 } = opts
  const pool = all.filter((n) => !n.inVault && !n.cipher && (n.title || n.content.trim()))
  const N = pool.length
  if (N < 2) return []

  // Vetores TF-IDF; nomes próprios pesam mais
  const surface = new Map<string, Map<string, number>>()
  const docs = pool.map((n) => {
    const tf = new Map<string, number>()
    const names = new Set<string>()
    for (const t of surfaceTerms(noteText(n))) {
      tf.set(t.term, (tf.get(t.term) ?? 0) + 1)
      if (t.name) names.add(t.term)
      const s = surface.get(t.term) ?? new Map<string, number>()
      s.set(t.surface, (s.get(t.surface) ?? 0) + 1)
      surface.set(t.term, s)
    }
    return { tf, names }
  })
  const df = new Map<string, number>()
  for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) ?? 0) + 1)
  // Palavra em quase todas as notas não diz nada sobre o assunto
  const maxDf = Math.max(3, Math.ceil(N * 0.3))
  const index = new Map<string, { i: number; x: number; name: boolean }[]>()
  docs.forEach((d, i) => {
    let norm = 0
    const v: [string, number][] = []
    for (const [w, c] of d.tf) {
      const x = (1 + Math.log(c)) * Math.log(1 + N / (df.get(w) ?? 1)) * (d.names.has(w) ? 1.6 : 1)
      v.push([w, x])
      norm += x * x
    }
    norm = Math.sqrt(norm) || 1
    for (const [w, x] of v) {
      const f = df.get(w) ?? 0
      if (f < 2 || f > maxDf) continue
      const list = index.get(w) ?? []
      list.push({ i, x: x / norm, name: d.names.has(w) })
      index.set(w, list)
    }
  })

  type Pair = { s: number; words: [string, number][]; tags: string[]; cites?: string; name?: boolean }
  const pairs = new Map<number, Pair>()
  const pair = (i: number, j: number) => {
    const key = i < j ? i * N + j : j * N + i
    let p = pairs.get(key)
    if (!p) { p = { s: 0, words: [], tags: [] }; pairs.set(key, p) }
    return p
  }
  for (const [w, list] of index) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const prod = list[x].x * list[y].x
        const p = pair(list[x].i, list[y].i)
        p.s += prod
        p.words.push([w, prod])
        if (list[x].name && list[y].name) p.name = true
      }
    }
  }
  // Tags em comum
  const byTag = new Map<string, number[]>()
  pool.forEach((n, i) => { for (const t of n.tags) byTag.set(t, [...(byTag.get(t) ?? []), i]) })
  for (const [t, list] of byTag) {
    if (list.length > maxDf) continue
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const p = pair(list[x], list[y])
      p.s += 0.18
      p.tags.push(t)
    }
  }
  // Uma nota cita o título da outra (sem [[ ]])
  const texts = pool.map((n) => fold(n.content))
  pool.forEach((n, j) => {
    const t = fold(n.title?.trim() ?? '')
    if (t.length < 4 || STOP.has(t)) return
    const re = new RegExp('(^|[^a-z0-9])' + escapeRegExp(t) + '($|[^a-z0-9])')
    texts.forEach((txt, i) => {
      if (i === j || !re.test(txt)) return
      const p = pair(i, j)
      p.s += 0.35
      p.cites ??= n.title!.trim()
    })
  })

  const nice = (term: string) => {
    const s = surface.get(term)
    return s ? [...s].sort((a, b) => b[1] - a[1])[0][0] : term
  }
  const cand: { i: number; j: number; score: number; reason: string }[] = []
  for (const [key, p] of pairs) {
    // Uma palavra só em comum é coincidência; um nome, uma tag ou uma citação já contam
    if (p.s < min || (p.words.length < 2 && !p.name && !p.tags.length && !p.cites)) continue
    const i = Math.floor(key / N)
    const j = key % N
    const reason = p.cites
      ? `cita “${p.cites.length > 28 ? `${p.cites.slice(0, 27)}…` : p.cites}”`
      : p.tags.length && p.words.length < 2
        ? `${p.tags.slice(0, 2).map((t) => `#${t}`).join(' ')} em comum`
        : `fala de ${p.words.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => nice(w)).join(', ')}`
    // Os escores reais ficam entre ~0,12 e 0,5: estica para 0..1 (brilho e força da mola)
    cand.push({ i, j, score: Math.min(1, p.s * 2), reason })
  }
  cand.sort((a, b) => b.score - a.score)

  // As mais fortes de cada nota (vale se estiver entre as melhores de qualquer uma das duas)
  const taken = new Array<number>(N).fill(0)
  const out: IndirectLink[] = []
  for (const c of cand) {
    if (taken[c.i] >= perNote && taken[c.j] >= perNote) continue
    taken[c.i]++
    taken[c.j]++
    out.push({ a: pool[c.i].id, b: pool[c.j].id, score: c.score, reason: c.reason })
  }
  return out
}
