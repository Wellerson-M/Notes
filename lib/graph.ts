import type { Note } from './types'

/**
 * Grafo das notas (o "graph view" do Obsidian): nós = notas, arestas = ligações em qualquer
 * direção ([[ ]] no texto ou ligações de fora do texto). O Vault nunca entra.
 * A física é uma versão enxuta do d3-force: repulsão entre todos, molas nas arestas,
 * colisão e uma gravidade leve para o centro. `alpha` esfria a cada passo — quando chega
 * perto de zero a simulação para e não gasta mais nada.
 */

export type GNode = {
  id: string
  label: string
  deg: number
  pinned: boolean
  x: number
  y: number
  vx: number
  vy: number
  /** Posição presa (arrastando) */
  fx: number | null
  fy: number | null
  r: number
}
export type GLink = { a: number; b: number }
export type Graph = { nodes: GNode[]; links: GLink[]; index: Map<string, number>; neighbors: Set<number>[] }

const label = (n: Note) => n.title?.trim() || n.content.trim().split('\n')[0].replace(/^[#>\-*\s[\]x]+/i, '').slice(0, 40) || 'sem título'

/**
 * Monta o grafo. Com `focusId`, só a vizinhança até `depth` passos; sem ele, todas as notas
 * (`orphans` = incluir as que não têm nenhuma ligação).
 */
export function buildGraph(all: Note[], opts: { focusId?: string; depth?: number; orphans?: boolean } = {}): Graph {
  const notes = all.filter((n) => !n.inVault && !n.cipher)
  const byId = new Map(notes.map((n) => [n.id, n]))
  const adj = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (a === b || !byId.has(a) || !byId.has(b)) return
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  for (const n of notes) for (const id of n.linkedNoteIds ?? []) link(n.id, id)

  let keep: string[]
  if (opts.focusId && byId.has(opts.focusId)) {
    const depth = opts.depth ?? 1
    const seen = new Set([opts.focusId])
    let frontier = [opts.focusId]
    for (let d = 0; d < depth; d++) {
      const next: string[] = []
      for (const id of frontier) for (const nb of adj.get(id) ?? []) if (!seen.has(nb)) { seen.add(nb); next.push(nb) }
      frontier = next
    }
    keep = [...seen]
  } else {
    keep = notes.filter((n) => opts.orphans !== false || adj.has(n.id)).map((n) => n.id)
  }

  const index = new Map(keep.map((id, i) => [id, i]))
  const nodes: GNode[] = keep.map((id, i) => {
    const n = byId.get(id)!
    const deg = adj.get(id)?.size ?? 0
    // Começa numa espiral (filotaxia, como o d3): a física "abre" o grafo a partir do centro
    const radius = 10 * Math.sqrt(0.5 + i)
    const angle = i * Math.PI * (3 - Math.sqrt(5))
    return { id, label: label(n), deg, pinned: n.pinned, x: radius * Math.cos(angle), y: radius * Math.sin(angle), vx: 0, vy: 0, fx: null, fy: null, r: 4 + Math.sqrt(deg) * 2.4 }
  })
  const links: GLink[] = []
  const neighbors = nodes.map(() => new Set<number>())
  for (const [a, set] of adj) {
    const ia = index.get(a)
    if (ia === undefined) continue
    for (const b of set) {
      const ib = index.get(b)
      if (ib === undefined || ib <= ia) continue
      links.push({ a: ia, b: ib })
      neighbors[ia].add(ib)
      neighbors[ib].add(ia)
    }
  }
  return { nodes, links, index, neighbors }
}

export type Sim = { alpha: number; alphaTarget: number }

const ALPHA_MIN = 0.002
const ALPHA_DECAY = 1 - Math.pow(ALPHA_MIN, 1 / 300)
const VELOCITY_KEEP = 0.6
const LINK_DISTANCE = 46
const CHARGE = -220
const CHARGE_MAX_D2 = 600 * 600
const GRAVITY = 0.045

export const simRunning = (s: Sim) => s.alpha > ALPHA_MIN || s.alphaTarget > 0

/** Um passo da física. Devolve false quando já esfriou (nada mudou). */
export function tick(g: Graph, s: Sim): boolean {
  if (!simRunning(s)) return false
  s.alpha += (s.alphaTarget - s.alpha) * ALPHA_DECAY
  const { nodes, links } = g
  const n = nodes.length
  const a = s.alpha

  // Molas: puxam as pontas de cada ligação para a distância ideal (mais frouxas em nós muito ligados)
  for (const l of links) {
    const p = nodes[l.a]
    const q = nodes[l.b]
    let dx = q.x + q.vx - p.x - p.vx
    let dy = q.y + q.vy - p.y - p.vy
    const d = Math.hypot(dx, dy) || 1e-6
    const strength = 1 / Math.min(p.deg || 1, q.deg || 1)
    const k = ((d - LINK_DISTANCE) / d) * a * strength
    dx *= k
    dy *= k
    const bias = (p.deg || 1) / ((p.deg || 1) + (q.deg || 1))
    q.vx -= dx * bias
    q.vy -= dy * bias
    p.vx += dx * (1 - bias)
    p.vy += dy * (1 - bias)
  }

  // Repulsão entre todos (n² — leve até algumas centenas de notas) e colisão
  for (let i = 0; i < n; i++) {
    const p = nodes[i]
    for (let j = i + 1; j < n; j++) {
      const q = nodes[j]
      let dx = q.x - p.x
      let dy = q.y - p.y
      let d2 = dx * dx + dy * dy
      if (d2 > CHARGE_MAX_D2) continue
      if (d2 < 1e-6) { dx = (Math.random() - 0.5) * 1e-3; dy = (Math.random() - 0.5) * 1e-3; d2 = dx * dx + dy * dy }
      const f = (CHARGE * a) / Math.max(d2, 25)
      p.vx += dx * f
      p.vy += dy * f
      q.vx -= dx * f
      q.vy -= dy * f
      const min = p.r + q.r + 3
      if (d2 < min * min) {
        const d = Math.sqrt(d2)
        const push = ((min - d) / d) * 0.5
        p.vx -= dx * push
        p.vy -= dy * push
        q.vx += dx * push
        q.vy += dy * push
      }
    }
  }

  for (const p of nodes) {
    // Gravidade leve: mantém as notas soltas por perto
    p.vx -= p.x * GRAVITY * a
    p.vy -= p.y * GRAVITY * a
    if (p.fx !== null && p.fy !== null) {
      p.x = p.fx
      p.y = p.fy
      p.vx = 0
      p.vy = 0
    } else {
      p.vx *= VELOCITY_KEEP
      p.vy *= VELOCITY_KEEP
      p.x += p.vx
      p.y += p.vy
    }
  }
  return true
}

/** Caixa que contém todos os nós (para enquadrar) */
export function bounds(g: Graph) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of g.nodes) {
    x0 = Math.min(x0, p.x - p.r); y0 = Math.min(y0, p.y - p.r)
    x1 = Math.max(x1, p.x + p.r); y1 = Math.max(y1, p.y + p.r)
  }
  if (!Number.isFinite(x0)) return { x0: -50, y0: -50, x1: 50, y1: 50 }
  return { x0, y0, x1, y1 }
}
