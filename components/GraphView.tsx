'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Crosshair, Search, X, ArrowRight } from 'lucide-react'
import { useNotes } from '@/lib/repo'
import { noteHref } from '@/lib/routes'
import { useUIStore } from '@/store/ui'
import { bounds, buildGraph, simRunning, tick, type GLink, type GNode, type Graph, type Sim } from '@/lib/graph'
import { indirectLinks } from '@/lib/related'

interface Props {
  open: boolean
  onClose: () => void
  /** Abre centrado nesta nota (grafo local); sem ela, mostra todas */
  focusId?: string
}

type Mode = 'local1' | 'local2' | 'all'
type Cam = { x: number; y: number; k: number }
type Colors = { accent: string; gold: string; node: string; text: string; textDim: string; bg: string; font: string; light: boolean }

/** "#rrggbb" → "r, g, b" (para usar com transparência no canvas) */
function rgb(hex: string, fallback: string) {
  const m = hex.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : fallback
}

function readColors(): Colors {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n).trim()
  return {
    accent: v('--accent-rgb') || '232, 165, 71',
    gold: v('--gold-rgb') || '212, 175, 55',
    node: rgb(v('--text-secondary'), '165, 163, 154'),
    text: rgb(v('--text-primary'), '232, 230, 223'),
    textDim: rgb(v('--text-secondary'), '165, 163, 154'),
    bg: v('--bg-rgb') || '17, 18, 16',
    // O canvas não entende var(): usa a fonte já resolvida da página
    font: getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif',
    light: v('color-scheme') === 'light',
  }
}

/** Aleatório com semente: o céu é o mesmo a cada abertura */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/**
 * Sprites pré-desenhados (um por cor): halo e esfera com luz e sombra. Desenhar uma imagem
 * pronta por nó é bem mais barato que criar gradientes a cada quadro.
 */
function spriteCache(light: boolean) {
  const cache = new Map<string, HTMLCanvasElement>()
  const make = (key: string, paint: (c: CanvasRenderingContext2D) => void) => {
    let s = cache.get(key)
    if (!s) {
      s = document.createElement('canvas')
      s.width = s.height = 64
      paint(s.getContext('2d')!)
      cache.set(key, s)
    }
    return s
  }
  return {
    glow: (color: string) => make(`g${color}`, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, `rgba(${color}, 0.9)`)
      g.addColorStop(0.22, `rgba(${color}, 0.35)`)
      g.addColorStop(0.55, `rgba(${color}, 0.08)`)
      g.addColorStop(1, `rgba(${color}, 0)`)
      c.fillStyle = g
      c.fillRect(0, 0, 64, 64)
    }),
    sphere: (color: string) => make(`s${color}`, (c) => {
      c.beginPath()
      c.arc(32, 32, 31, 0, Math.PI * 2)
      c.fillStyle = `rgb(${color})`
      c.fill()
      c.save()
      c.clip()
      // Luz vinda de cima à esquerda e sombra na borda: parece uma esfera, não um disco
      const hi = c.createRadialGradient(22, 19, 0, 22, 19, 30)
      hi.addColorStop(0, 'rgba(255, 255, 255, 0.75)')
      hi.addColorStop(0.35, 'rgba(255, 255, 255, 0.18)')
      hi.addColorStop(1, 'rgba(255, 255, 255, 0)')
      c.fillStyle = hi
      c.fillRect(0, 0, 64, 64)
      const sh = c.createRadialGradient(28, 26, 14, 32, 32, 34)
      sh.addColorStop(0, 'rgba(0, 0, 0, 0)')
      sh.addColorStop(1, `rgba(0, 0, 0, ${light ? 0.22 : 0.5})`)
      c.fillStyle = sh
      c.fillRect(0, 0, 64, 64)
      c.restore()
    }),
  }
}

/** Fundo parado: espaço profundo com nebulosas nas cores do tema, poeira de estrelas e vinheta */
function drawSky(ctx: CanvasRenderingContext2D, W: number, H: number, c: Colors) {
  const rnd = seeded(31415)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = `rgb(${c.bg})`
  ctx.fillRect(0, 0, W, H)
  const R = Math.max(W, H)

  ctx.globalCompositeOperation = c.light ? 'multiply' : 'lighter'
  // Brilho difuso no centro, onde as notas ficam
  const core = ctx.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, R * 0.55)
  core.addColorStop(0, `rgba(${c.accent}, ${c.light ? 0.05 : 0.04})`)
  core.addColorStop(1, `rgba(${c.accent}, 0)`)
  ctx.fillStyle = core
  ctx.fillRect(0, 0, W, H)

  // Nebulosas: nuvens grandes e suaves, cada uma feita de vários sopros
  // Uma nuvem fria e funda no meio das quentes dá a sensação de distância (como a galáxia do PC)
  const cool = '120, 140, 220'
  const clouds = [
    { x: 0.16, y: 0.22, r: 0.4, col: c.accent, a: 0.085 },
    { x: 0.86, y: 0.72, r: 0.44, col: c.gold, a: 0.065 },
    { x: 0.62, y: 0.3, r: 0.36, col: c.light ? c.accent : cool, a: c.light ? 0.03 : 0.05 },
    { x: 0.32, y: 0.86, r: 0.3, col: c.light ? c.gold : cool, a: c.light ? 0.03 : 0.04 },
    { x: 0.72, y: 0.1, r: 0.24, col: c.accent, a: 0.05 },
  ]
  for (const cl of clouds) {
    for (let k = 0; k < 8; k++) {
      const x = W * cl.x + (rnd() - 0.5) * R * cl.r * 0.8
      const y = H * cl.y + (rnd() - 0.5) * R * cl.r * 0.8
      const r = R * cl.r * (0.25 + rnd() * 0.45)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(${cl.col}, ${cl.a * (c.light ? 0.6 : 1)})`)
      g.addColorStop(0.5, `rgba(${cl.col}, ${cl.a * 0.3})`)
      g.addColorStop(1, `rgba(${cl.col}, 0)`)
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }
  ctx.globalCompositeOperation = 'source-over'

  // Poeira: estrelas bem distantes, miúdas (não se mexem com a câmera)
  const dust = Math.round((W * H) / (c.light ? 7000 : 2200))
  for (let i = 0; i < dust; i++) {
    const a = c.light ? 0.04 + rnd() * 0.08 : 0.05 + rnd() * 0.22
    ctx.fillStyle = c.light ? `rgba(0, 0, 0, ${a})` : rnd() < 0.12 ? `rgba(${c.accent}, ${a})` : `rgba(255, 255, 255, ${a})`
    ctx.fillRect(rnd() * W, rnd() * H, 1, 1)
  }

  // Vinheta: as bordas afundam
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, R * 0.78)
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vig.addColorStop(1, `rgba(0, 0, 0, ${c.light ? 0.08 : 0.65})`)
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)
}

type Star = { x: number; y: number; s: number; a: number; tint: number }
/** Camadas de estrelas em paralaxe: as mais "perto" andam e crescem mais com a câmera */
const LAYERS = [
  { depth: 0.06, count: 110, size: [0.6, 1.1], alpha: [0.18, 0.5] },
  { depth: 0.16, count: 60, size: [0.9, 1.6], alpha: [0.3, 0.65] },
  { depth: 0.34, count: 22, size: [1.4, 2.3], alpha: [0.45, 0.85] },
] as const
const TILE = 900

function makeStars(): Star[][] {
  const rnd = seeded(2718)
  return LAYERS.map((l) => Array.from({ length: l.count }, () => ({
    x: rnd() * TILE,
    y: rnd() * TILE,
    s: l.size[0] + rnd() * (l.size[1] - l.size[0]),
    a: l.alpha[0] + rnd() * (l.alpha[1] - l.alpha[0]),
    tint: rnd(),
  })))
}

/** Ponto e tangente da curva de uma ligação (quadrática, levemente arqueada) */
const CURVE = 0.08
function ctrl(p: GNode, q: GNode) {
  return { x: (p.x + q.x) / 2 - (q.y - p.y) * CURVE, y: (p.y + q.y) / 2 + (q.x - p.x) * CURVE }
}
function onCurve(p: GNode, q: GNode, t: number) {
  const c = ctrl(p, q)
  const u = 1 - t
  return { x: u * u * p.x + 2 * u * t * c.x + t * t * q.x, y: u * u * p.y + 2 * u * t * c.y + t * t * q.y }
}

const TAP_MOVE = 7
const LABEL_ZOOM = 1.05
const INDIRECT_KEY = 'grafite-graph-indirect'

/**
 * Grafo de conexões no estilo do Obsidian, num céu de galáxia: física, arrastar nós, zoom,
 * destaque dos vizinhos e as conexões indiretas (notas que falam da mesma coisa).
 * Desenhado em canvas; a simulação para sozinha quando o grafo assenta.
 */
export default function GraphView({ open, onClose, focusId }: Props) {
  // Portal no <body>: aberto de dentro de um cabeçalho fixo, ficaria preso no empilhamento dele
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && <GraphOverlay key="graph" onClose={onClose} focusId={focusId} />}
    </AnimatePresence>,
    document.body,
  )
}

function GraphOverlay({ onClose, focusId }: { onClose: () => void; focusId?: string }) {
  const router = useRouter()
  const notes = useNotes()
  const reducedMotion = useUIStore((s) => s.reducedMotion)
  const [mode, setMode] = useState<Mode>(focusId ? 'local1' : 'all')
  const [orphans, setOrphans] = useState(true)
  const [showIndirect, setShowIndirect] = useState(() => {
    try { return localStorage.getItem(INDIRECT_KEY) !== '0' } catch { return true }
  })
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const skyRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  /** Ponte para o laço de desenho (que não re-renderiza com o React) */
  const api = useRef<{ fit: (animate: boolean) => void; wake: () => void; setQuery: (q: string) => void; select: (i: number | null) => void } | null>(null)

  const toggleIndirect = () => setShowIndirect((v) => {
    try { localStorage.setItem(INDIRECT_KEY, v ? '0' : '1') } catch { /* modo privado */ }
    return !v
  })

  // Estrutura do grafo: muda quando alguma nota muda (as indiretas dependem do texto), não a cada render
  const signature = useMemo(
    () => (notes ?? []).filter((n) => !n.inVault && !n.cipher).map((n) => `${n.id}:${n.updatedAt}:${n.pinned ? 1 : 0}:${(n.linkedNoteIds ?? []).join(',')}`).join('|'),
    [notes],
  )
  const indirect = useMemo(
    () => (showIndirect && notes ? indirectLinks(notes) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, showIndirect],
  )
  const graph = useMemo<Graph | null>(() => {
    if (!notes) return null
    return buildGraph(notes, { focusId: mode === 'all' ? undefined : focusId, depth: mode === 'local2' ? 2 : 1, orphans, indirect })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, mode, orphans, focusId, indirect])

  const openNote = useCallback((id: string) => {
    onClose()
    if (id !== focusId) router.push(noteHref(id))
  }, [onClose, focusId, router])
  // O laço de desenho lê pela ref: um onClose novo a cada render do pai não reinicia a física
  const openRef = useRef(openNote)
  useEffect(() => { openRef.current = openNote }, [openNote])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => { api.current?.setQuery(query) }, [query])

  // ── Laço de física + desenho ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const sky = skyRef.current
    const wrap = wrapRef.current
    const ctx = canvas?.getContext('2d')
    const sctx = sky?.getContext('2d')
    if (!graph || !canvas || !sky || !wrap || !ctx || !sctx) return
    // A física mexe nas posições: trabalha numa cópia (o grafo memoizado fica intacto)
    const g: Graph = { ...graph, nodes: graph.nodes.map((n) => ({ ...n })) }
    const still = reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const colors = readColors()
    const sprites = spriteCache(colors.light)
    const stars = makeStars()
    const sim: Sim = { alpha: 1, alphaTarget: 0 }
    const focus = focusId !== undefined ? g.index.get(focusId) ?? null : null
    const fixedFocus = focus !== null ? g.nodes[focus] : null
    if (fixedFocus) { fixedFocus.x = 0; fixedFocus.y = 0 }
    const direct = g.links.filter((l) => l.kind === 'direct')
    const soft = g.links.filter((l) => l.kind === 'indirect')
    const lighter: GlobalCompositeOperation = colors.light ? 'source-over' : 'lighter'

    let W = 0
    let H = 0
    let dpr = 1
    const cam: Cam = { x: 0, y: 0, k: 1 }
    let camGoal: Cam | null = null
    let hover: number | null = null
    let picked: number | null = null
    /** 0..1: força do destaque (anima o esmaecer dos outros) */
    let glow = 0
    let matches: Set<number> | null = null
    let raf = 0
    let fitted = false

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = wrap.clientWidth
      H = wrap.clientHeight
      for (const c of [canvas, sky]) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
        c.style.width = `${W}px`
        c.style.height = `${H}px`
      }
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawSky(sctx, W, H, colors)
      wake()
    }

    const fitCam = (): Cam => {
      const b = bounds(g)
      const pad = 56
      const top = 110 // o cabeçalho fica por cima do céu
      const k = Math.min(2.2, Math.max(0.15, Math.min((W - pad * 2) / Math.max(1, b.x1 - b.x0), (H - top - pad * 2) / Math.max(1, b.y1 - b.y0))))
      return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 - top / 2 / k, k }
    }

    const toWorld = (sx: number, sy: number) => ({ x: (sx - W / 2) / cam.k + cam.x, y: (sy - H / 2) / cam.k + cam.y })
    const toScreen = (x: number, y: number) => ({ x: (x - cam.x) * cam.k + W / 2, y: (y - cam.y) * cam.k + H / 2 })

    const nodeAt = (sx: number, sy: number): number | null => {
      const p = toWorld(sx, sy)
      let best: number | null = null
      let bestD = Infinity
      for (let i = 0; i < g.nodes.length; i++) {
        const n = g.nodes[i]
        const d = Math.hypot(n.x - p.x, n.y - p.y)
        // Área de toque generosa no celular: no mínimo ~18px na tela
        if (d < Math.max(n.r + 4 / cam.k, 18 / cam.k) && d < bestD) { best = i; bestD = d }
      }
      return best
    }

    const active = () => picked ?? hover

    /** Estrelas em paralaxe, em coordenadas de tela */
    const drawStars = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      LAYERS.forEach((layer, li) => {
        const s = Math.pow(cam.k, layer.depth * 1.6)
        const span = TILE * s
        const ox = mod(W / 2 - cam.x * layer.depth * cam.k, span)
        const oy = mod(H / 2 - cam.y * layer.depth * cam.k, span)
        for (const st of stars[li]) {
          const bx = mod(ox + st.x * s, span)
          const by = mod(oy + st.y * s, span)
          const size = st.s * Math.min(1.6, Math.max(0.7, s))
          const col = colors.light ? '0, 0, 0' : st.tint < 0.14 ? colors.accent : st.tint < 0.24 ? '200, 215, 255' : '255, 255, 255'
          ctx.fillStyle = `rgba(${col}, ${colors.light ? st.a * 0.25 : st.a})`
          for (let x = bx; x < W; x += span) {
            for (let y = by; y < H; y += span) {
              ctx.fillRect(x, y, size, size)
              if (li === 2 && !colors.light) {
                // As mais próximas têm um brilho em cruz
                ctx.fillRect(x - size * 1.5, y + size / 2 - 0.25, size * 4, 0.5)
                ctx.fillRect(x + size / 2 - 0.25, y - size * 1.5, 0.5, size * 4)
              }
            }
          }
        }
      })
    }

    const curvePath = (links: GLink[]) => {
      ctx.beginPath()
      for (const l of links) {
        const p = g.nodes[l.a]
        const q = g.nodes[l.b]
        const c = ctrl(p, q)
        ctx.moveTo(p.x, p.y)
        ctx.quadraticCurveTo(c.x, c.y, q.x, q.y)
      }
    }

    const draw = (time: number) => {
      drawStars()
      ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * (W / 2 - cam.x * cam.k), dpr * (H / 2 - cam.y * cam.k))

      const act = active()
      const lit = act !== null ? g.neighbors[act] : null
      const isLit = (i: number) => (act === null && !matches) || i === act || !!lit?.has(i) || !!matches?.has(i)
      const dimA = 1 - glow * 0.82
      const dim = act !== null || matches ? dimA : 1
      const touches = (l: GLink) => act !== null && (l.a === act || l.b === act)
      const px = 1 / cam.k
      ctx.lineCap = 'round'

      // Indiretas: pontilhadas e prateadas, mais fortes quanto mais parecidas
      if (soft.length) {
        ctx.setLineDash([1.6 * px, 5 * px])
        for (const band of [0.25, 0.5, 0.75, 1]) {
          const group = soft.filter((l) => !touches(l) && l.w <= band && l.w > band - 0.25)
          if (!group.length) continue
          ctx.strokeStyle = `rgba(${colors.textDim}, ${(0.14 + band * 0.3) * dim})`
          ctx.lineWidth = Math.max(0.7, 0.8 + band) * px
          curvePath(group)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      // Diretas: filamento de luz (um traço largo e fraco por baixo, um fino por cima)
      const calm = direct.filter((l) => !touches(l))
      ctx.globalCompositeOperation = lighter
      ctx.strokeStyle = `rgba(${colors.accent}, ${(colors.light ? 0.1 : 0.14) * dim})`
      ctx.lineWidth = 5 * px
      curvePath(calm)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = `rgba(${colors.light ? colors.textDim : colors.text}, ${0.42 * dim})`
      ctx.lineWidth = 1.1 * px
      curvePath(calm)
      ctx.stroke()

      // Ligações do nó em destaque: na cor do tema, com brilho, e pulsos de luz saindo dele
      if (act !== null) {
        const mine = g.links.filter(touches)
        const hot = mine.filter((l) => l.kind === 'direct')
        const warm = mine.filter((l) => l.kind === 'indirect')
        ctx.globalCompositeOperation = lighter
        ctx.strokeStyle = `rgba(${colors.accent}, ${0.25 * glow})`
        ctx.lineWidth = 7 * px
        curvePath(hot)
        ctx.stroke()
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = `rgba(${colors.accent}, ${0.4 + 0.55 * glow})`
        ctx.lineWidth = 1.7 * px
        curvePath(hot)
        ctx.stroke()
        if (warm.length) {
          ctx.setLineDash([2 * px, 5 * px])
          ctx.strokeStyle = `rgba(${colors.gold}, ${0.35 + 0.5 * glow})`
          ctx.lineWidth = 1.5 * px
          curvePath(warm)
          ctx.stroke()
          ctx.setLineDash([])
        }
        if (!still) {
          ctx.globalCompositeOperation = lighter
          for (const l of mine) {
            const from = l.a === act ? g.nodes[l.a] : g.nodes[l.b]
            const to = l.a === act ? g.nodes[l.b] : g.nodes[l.a]
            const t = mod(time / 1600 + ((l.a * 7 + l.b * 13) % 10) / 10, 1)
            const p = onCurve(from, to, t)
            const size = (l.kind === 'direct' ? 9 : 6) * px * glow
            ctx.globalAlpha = Math.sin(t * Math.PI) * (l.kind === 'direct' ? 1 : 0.7)
            ctx.drawImage(sprites.glow(l.kind === 'direct' ? colors.accent : colors.gold), p.x - size, p.y - size, size * 2, size * 2)
          }
          ctx.globalAlpha = 1
          ctx.globalCompositeOperation = 'source-over'
        }
      }

      // Nós: halo + esfera
      for (let i = 0; i < g.nodes.length; i++) {
        const n = g.nodes[i]
        const on = isLit(i)
        const isAct = i === act
        const isFocus = i === focus
        const color = isAct || isFocus || matches?.has(i) ? colors.accent : n.pinned ? colors.gold : on && act !== null ? colors.text : colors.light ? colors.node : colors.text
        const alpha = on ? 1 : dimA
        // Halo: mais forte nos nós mais ligados e no destaque
        const halo = isAct ? 1 : isFocus ? 0.8 : Math.min(0.65, 0.3 + n.deg * 0.08)
        const R = n.r * (isAct || isFocus ? 4.2 : 3.2)
        ctx.globalCompositeOperation = lighter
        ctx.globalAlpha = halo * alpha * (colors.light ? 0.5 : 1)
        ctx.drawImage(sprites.glow(isAct || isFocus || matches?.has(i) ? colors.accent : n.pinned ? colors.gold : colors.accent), n.x - R, n.y - R, R * 2, R * 2)
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = alpha * (on ? 1 : 0.9)
        ctx.drawImage(sprites.sphere(color), n.x - n.r, n.y - n.r, n.r * 2, n.r * 2)
      }
      ctx.globalAlpha = 1

      // Rótulos: com zoom, ou do nó em destaque e vizinhos (tamanho fixo na tela)
      const zoomA = Math.min(1, Math.max(0, (cam.k - LABEL_ZOOM * 0.75) / (LABEL_ZOOM * 0.5)))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.shadowColor = `rgba(${colors.bg}, 0.95)`
      ctx.shadowBlur = 6
      for (let i = 0; i < g.nodes.length; i++) {
        const n = g.nodes[i]
        const special = i === act || i === focus || !!lit?.has(i) || !!matches?.has(i)
        const a = special ? 1 : zoomA * dim
        if (a < 0.04) continue
        const s = toScreen(n.x, n.y)
        const sy = s.y + n.r * cam.k + 5
        if (s.x < -120 || s.x > W + 120 || sy < -20 || sy > H + 20) continue
        ctx.font = `${i === act || i === focus ? 600 : 400} 12px ${colors.font}`
        const text = n.label.length > 32 ? `${n.label.slice(0, 31)}…` : n.label
        ctx.fillStyle = `rgba(${i === act || i === focus ? colors.text : colors.textDim}, ${a})`
        ctx.fillText(text, s.x, sy)
      }

      // Por que as indiretas do destaque estão ligadas ("fala de orçamento, praia")
      if (act !== null && glow > 0.3) {
        ctx.font = `italic 400 11px ${colors.font}`
        ctx.textBaseline = 'middle'
        let shown = 0
        for (const l of g.links) {
          if (l.kind !== 'indirect' || !touches(l) || !l.reason || shown >= 6) continue
          const p = onCurve(g.nodes[l.a], g.nodes[l.b], 0.5)
          const s = toScreen(p.x, p.y)
          if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue
          shown++
          ctx.fillStyle = `rgba(${colors.gold}, ${0.95 * glow})`
          ctx.fillText(l.reason, s.x, s.y)
        }
      }
      ctx.shadowBlur = 0
    }

    const frame = (time: number) => {
      raf = 0
      let busy = false
      if (!still) {
        // Dois passos por quadro: abre rápido sem pesar
        busy = tick(g, sim) || busy
        if (busy) tick(g, sim)
      }
      if (!fitted && (still || sim.alpha < 0.35)) { fitted = true; camGoal = fitCam() }
      const targetGlow = active() !== null || matches ? 1 : 0
      if (Math.abs(glow - targetGlow) > 0.01) { glow += (targetGlow - glow) * (still ? 1 : 0.22); busy = true } else glow = targetGlow
      if (camGoal) {
        const t = still ? 1 : 0.14
        cam.x += (camGoal.x - cam.x) * t
        cam.y += (camGoal.y - cam.y) * t
        cam.k += (camGoal.k - cam.k) * t
        if (Math.abs(camGoal.k - cam.k) < 0.002 && Math.hypot(camGoal.x - cam.x, camGoal.y - cam.y) < 0.5) { Object.assign(cam, camGoal); camGoal = null }
        else busy = true
      }
      // Pulsos de luz nas ligações do destaque: só enquanto há destaque
      if (!still && active() !== null && g.neighbors[active()!].size) busy = true
      draw(time)
      if (busy || simRunning(sim)) wake()
    }
    function wake() { if (!raf) raf = requestAnimationFrame(frame) }

    // Primeira abertura: quem pediu menos movimento vê o grafo já assentado
    if (still) { for (let i = 0; i < 300 && tick(g, sim); i++) { /* assenta */ } }
    resize()
    cam.k = Math.min(1.4, Math.max(0.35, Math.min(W, H) / (22 * Math.sqrt(g.nodes.length + 1) + 160)))

    api.current = {
      fit: (animate) => { camGoal = fitCam(); if (!animate) Object.assign(cam, camGoal); wake() },
      wake,
      setQuery: (q) => {
        const t = q.trim().toLowerCase()
        matches = t ? new Set(g.nodes.flatMap((n, i) => (n.label.toLowerCase().includes(t) ? [i] : []))) : null
        wake()
      },
      select: (i) => { picked = i; wake() },
    }
    api.current.setQuery(query)

    // ── Ponteiro: arrastar nó, mover o fundo, pinça, roda ────────────
    const pointers = new Map<number, { x: number; y: number }>()
    let drag: { node: number | null; startX: number; startY: number; camX: number; camY: number; moved: boolean; t: number; type: string } | null = null
    let pinch: { d: number; k: number; wx: number; wy: number } | null = null

    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const mid = toWorld((a.x + b.x) / 2, (a.y + b.y) / 2)
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: cam.k, wx: mid.x, wy: mid.y }
        if (drag?.node != null) { const n = g.nodes[drag.node]; n.fx = n.fy = null; sim.alphaTarget = 0 }
        drag = null
        return
      }
      const node = nodeAt(p.x, p.y)
      drag = { node, startX: p.x, startY: p.y, camX: cam.x, camY: cam.y, moved: false, t: performance.now(), type: e.pointerType }
      camGoal = null
    }

    const onMove = (e: PointerEvent) => {
      const p = local(e)
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p)
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const k = Math.min(4, Math.max(0.1, pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)))
        cam.k = k
        // Mantém o ponto do meio dos dedos parado
        cam.x = pinch.wx - ((a.x + b.x) / 2 - W / 2) / k
        cam.y = pinch.wy - ((a.y + b.y) / 2 - H / 2) / k
        wake()
        return
      }
      if (!drag) {
        if (e.pointerType === 'mouse') {
          const h = nodeAt(p.x, p.y)
          if (h !== hover) { hover = h; canvas.style.cursor = h !== null ? 'pointer' : 'grab'; wake() }
        }
        return
      }
      const dx = p.x - drag.startX
      const dy = p.y - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < TAP_MOVE) return
      drag.moved = true
      if (drag.node !== null) {
        const n = g.nodes[drag.node]
        const w = toWorld(p.x, p.y)
        n.fx = w.x
        n.fy = w.y
        sim.alphaTarget = 0.3
        if (sim.alpha < 0.3) sim.alpha = 0.3
        hover = drag.node
      } else {
        cam.x = drag.camX - dx / cam.k
        cam.y = drag.camY - dy / cam.k
        canvas.style.cursor = 'grabbing'
      }
      wake()
    }

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = null
      const d = drag
      drag = null
      if (!d) return
      if (d.node !== null) {
        const n = g.nodes[d.node]
        n.fx = n.fy = null
        sim.alphaTarget = 0
      }
      canvas.style.cursor = hover !== null ? 'pointer' : 'grab'
      if (d.moved) { if (e.pointerType !== 'mouse') hover = null; wake(); return }
      // Toque/clique sem arrastar
      if (d.node === null) { picked = null; setSelected(null); wake(); return }
      const n = g.nodes[d.node]
      if (d.type === 'mouse' || picked === d.node) { openRef.current(n.id); return }
      // No celular: o 1º toque destaca e mostra o nome; o 2º (ou "abrir") abre
      picked = d.node
      setSelected({ id: n.id, label: n.label })
      wake()
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      const before = toWorld(p.x, p.y)
      cam.k = Math.min(4, Math.max(0.1, cam.k * Math.exp(-e.deltaY * 0.0015)))
      cam.x = before.x - (p.x - W / 2) / cam.k
      cam.y = before.y - (p.y - H / 2) / cam.k
      camGoal = null
      wake()
    }

    const onLeave = () => { if (hover !== null && !drag) { hover = null; wake() } }
    // Aba escondida: não gasta quadros com pulsos que ninguém vê
    const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0 } else wake() }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('visibilitychange', onVisibility)
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    wake()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
      document.removeEventListener('visibilitychange', onVisibility)
      api.current = null
    }
    // query entra pelo api.setQuery; o laço não reinicia a cada letra
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, focusId, reducedMotion])

  const count = graph?.nodes.length ?? 0
  const linkCount = graph?.links.filter((l) => l.kind === 'direct').length ?? 0
  const softCount = (graph?.links.length ?? 0) - linkCount
  const modes: { id: Mode; label: string }[] = focusId
    ? [{ id: 'local1', label: 'Esta nota' }, { id: 'local2', label: '2 níveis' }, { id: 'all', label: 'Todas' }]
    : []

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-label="Grafo de conexões"
      style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'var(--bg-base)', overflow: 'hidden' }}
    >
      {/* Grafo: ocupa a tela toda, o cabeçalho flutua por cima do céu */}
      <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none' }}>
        <canvas ref={skyRef} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, cursor: 'grab' }} />
      </div>

      {/* Topo */}
      <div
        className="flex flex-col gap-2 px-4"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1,
          paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)', paddingBottom: 18,
          background: 'linear-gradient(to bottom, rgba(var(--bg-rgb), 0.92) 0%, rgba(var(--bg-rgb), 0.7) 65%, rgba(var(--bg-rgb), 0) 100%)',
          pointerEvents: 'none',
        }}
      >
        <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
          <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
            <span className="font-sans font-semibold" style={{ fontSize: 15, color: 'var(--text-primary)' }}>Grafo de conexões</span>
            <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {count} nota{count === 1 ? '' : 's'} · {linkCount} ligaç{linkCount === 1 ? 'ão' : 'ões'}
              {showIndirect && ` · ${softCount} indireta${softCount === 1 ? '' : 's'}`}
            </span>
          </div>
          <IconButton label="Enquadrar" onClick={() => api.current?.fit(true)}><Crosshair size={17} /></IconButton>
          <IconButton label="Fechar" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="flex items-center gap-2 flex-wrap" style={{ pointerEvents: 'auto' }}>
          {modes.map((m) => (
            <Chip key={m.id} active={mode === m.id} onClick={() => { setMode(m.id); setSelected(null) }}>{m.label}</Chip>
          ))}
          <Chip active={showIndirect} onClick={() => { toggleIndirect(); setSelected(null) }}>indiretas</Chip>
          {(mode === 'all') && (
            <Chip active={orphans} onClick={() => setOrphans((v) => !v)}>notas soltas</Chip>
          )}
          <label
            className="flex items-center gap-1.5 flex-1"
            style={{ minWidth: 140, background: 'rgba(var(--bg-rgb), 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '0 10px', height: 32, backdropFilter: 'blur(6px)' }}
          >
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="destacar notas..."
              className="font-sans"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }}
            />
          </label>
        </div>
      </div>

      {count <= 1 && (
        <p className="font-serif italic text-center" style={{ position: 'absolute', left: 0, right: 0, bottom: '18%', fontSize: 14, color: 'var(--text-muted)', lineHeight: '20px', padding: '0 32px', pointerEvents: 'none' }}>
          {mode === 'all' ? 'nenhuma ligação ainda — ligue notas pelas conexões sugeridas ou com [[ no texto' : 'nenhuma conexão ainda — veja “Todas” ou ligue esta nota a outra'}
        </p>
      )}

      {/* Rodapé: dica e legenda */}
      <div
        className="flex items-end justify-between gap-3 font-sans"
        style={{ position: 'absolute', left: 12, right: 12, bottom: 'max(env(safe-area-inset-bottom, 0px), 10px)', fontSize: 11, color: 'var(--text-disabled)', pointerEvents: 'none' }}
      >
        <span>arraste as notas · pinça ou roda para zoom</span>
        <span className="flex flex-col items-end gap-1" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden><line x1="1" y1="3" x2="21" y2="3" style={{ stroke: 'var(--text-secondary)' }} strokeWidth="1.4" strokeLinecap="round" /></svg>
            ligada
          </span>
          {showIndirect && (
            <span className="flex items-center gap-1.5">
              <svg width="22" height="6" aria-hidden><line x1="1" y1="3" x2="21" y2="3" style={{ stroke: 'var(--text-secondary)' }} strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.5 4" /></svg>
              mesmo assunto
            </span>
          )}
        </span>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.button
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            onClick={() => openNote(selected.id)}
            className="touch-feedback flex items-center gap-2 font-sans"
            style={{
              position: 'absolute', left: '50%', x: '-50%', bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 10px) + 44px)',
              background: 'var(--accent-amber)', color: 'var(--on-accent)', border: 'none', borderRadius: 14,
              padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', maxWidth: '86%',
              boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.3)', zIndex: 2,
            }}
          >
            <span className="line-clamp-1">{selected.label}</span>
            <ArrowRight size={15} style={{ flexShrink: 0 }} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="touch-feedback flex items-center justify-center"
      style={{ width: 36, height: 36, borderRadius: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
    >
      {children}
    </button>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="touch-feedback font-sans"
      style={{
        fontSize: 12, fontWeight: 500, borderRadius: 10, padding: '6px 11px', cursor: 'pointer', height: 32,
        background: active ? 'var(--accent-amber-soft)' : 'rgba(var(--bg-rgb), 0.55)',
        border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-default)'}`,
        color: active ? 'var(--accent-amber)' : 'var(--text-secondary)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {children}
    </button>
  )
}
