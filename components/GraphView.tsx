'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Crosshair, Search, X, ArrowRight } from 'lucide-react'
import { useNotes } from '@/lib/repo'
import { noteHref } from '@/lib/routes'
import { useUIStore } from '@/store/ui'
import { bounds, buildGraph, simRunning, tick, type Graph, type Sim } from '@/lib/graph'

interface Props {
  open: boolean
  onClose: () => void
  /** Abre centrado nesta nota (grafo local); sem ela, mostra todas */
  focusId?: string
}

type Mode = 'local1' | 'local2' | 'all'
type Cam = { x: number; y: number; k: number }
type Colors = { accent: string; gold: string; node: string; nodeDim: string; text: string; textDim: string; edge: string; bg: string; font: string }

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
    nodeDim: rgb(v('--text-muted'), '107, 105, 95'),
    text: rgb(v('--text-primary'), '232, 230, 223'),
    textDim: rgb(v('--text-secondary'), '165, 163, 154'),
    edge: rgb(v('--border-strong'), '74, 75, 67'),
    bg: v('--bg-rgb') || '17, 18, 16',
    // O canvas não entende var(): usa a fonte já resolvida da página
    font: getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif',
  }
}

const TAP_MOVE = 7
const LABEL_ZOOM = 1.05

/**
 * Grafo de conexões no estilo do Obsidian: física, arrastar nós, zoom e destaque dos vizinhos.
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
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  /** Ponte para o laço de desenho (que não re-renderiza com o React) */
  const api = useRef<{ fit: (animate: boolean) => void; wake: () => void; setQuery: (q: string) => void; select: (i: number | null) => void } | null>(null)

  // Estrutura do grafo: muda só quando as ligações ou os títulos mudam (não a cada tecla em outra nota)
  const signature = useMemo(
    () => (notes ?? []).filter((n) => !n.inVault && !n.cipher).map((n) => `${n.id}:${n.title ?? ''}:${n.pinned ? 1 : 0}:${(n.linkedNoteIds ?? []).join(',')}`).join('|'),
    [notes],
  )
  const graph = useMemo<Graph | null>(() => {
    if (!notes) return null
    return buildGraph(notes, { focusId: mode === 'all' ? undefined : focusId, depth: mode === 'local2' ? 2 : 1, orphans })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, mode, orphans, focusId])

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
    const wrap = wrapRef.current
    const ctx = canvas?.getContext('2d')
    if (!graph || !canvas || !wrap || !ctx) return
    // A física mexe nas posições: trabalha numa cópia (o grafo memoizado fica intacto)
    const g: Graph = { ...graph, nodes: graph.nodes.map((n) => ({ ...n })) }
    const still = reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const colors = readColors()
    const sim: Sim = { alpha: 1, alphaTarget: 0 }
    const focus = focusId !== undefined ? g.index.get(focusId) ?? null : null
    const fixedFocus = focus !== null ? g.nodes[focus] : null
    if (fixedFocus) { fixedFocus.x = 0; fixedFocus.y = 0 }

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
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      wake()
    }

    const fitCam = (): Cam => {
      const b = bounds(g)
      const pad = 48
      const k = Math.min(2.2, Math.max(0.15, Math.min((W - pad * 2) / Math.max(1, b.x1 - b.x0), (H - pad * 2) / Math.max(1, b.y1 - b.y0))))
      return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, k }
    }

    const toWorld = (sx: number, sy: number) => ({ x: (sx - W / 2) / cam.k + cam.x, y: (sy - H / 2) / cam.k + cam.y })

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

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * (W / 2 - cam.x * cam.k), dpr * (H / 2 - cam.y * cam.k))

      const act = active()
      const lit = act !== null ? g.neighbors[act] : null
      const isLit = (i: number) => (act === null && !matches) || i === act || !!lit?.has(i) || !!matches?.has(i)
      const dimA = 1 - glow * 0.82

      // Arestas: normais num traço só; as do nó em destaque por cima, na cor do tema
      ctx.lineWidth = Math.max(0.6, 1 / cam.k)
      ctx.strokeStyle = `rgba(${colors.edge}, ${0.75 * (act !== null || matches ? dimA : 1)})`
      ctx.beginPath()
      for (const l of g.links) {
        if (act !== null && (l.a === act || l.b === act)) continue
        const p = g.nodes[l.a]
        const q = g.nodes[l.b]
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(q.x, q.y)
      }
      ctx.stroke()
      if (act !== null) {
        ctx.strokeStyle = `rgba(${colors.accent}, ${0.35 + 0.55 * glow})`
        ctx.lineWidth = Math.max(1.2, 1.6 / cam.k)
        ctx.beginPath()
        for (const l of g.links) {
          if (l.a !== act && l.b !== act) continue
          ctx.moveTo(g.nodes[l.a].x, g.nodes[l.a].y)
          ctx.lineTo(g.nodes[l.b].x, g.nodes[l.b].y)
        }
        ctx.stroke()
      }

      // Nós
      for (let i = 0; i < g.nodes.length; i++) {
        const n = g.nodes[i]
        const on = isLit(i)
        const isAct = i === act
        const isFocus = i === focus
        const alpha = on ? 1 : dimA
        if (isAct || isFocus) {
          // Halo
          const halo = ctx.createRadialGradient(n.x, n.y, n.r * 0.6, n.x, n.y, n.r * 3.2)
          halo.addColorStop(0, `rgba(${colors.accent}, ${isAct ? 0.45 : 0.28})`)
          halo.addColorStop(1, `rgba(${colors.accent}, 0)`)
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r * 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
        const base = isAct || isFocus || matches?.has(i) ? colors.accent : n.pinned ? colors.gold : on && act !== null ? colors.text : colors.node
        ctx.fillStyle = `rgba(${base}, ${alpha})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Rótulos: com zoom, ou do nó em destaque e vizinhos (tamanho fixo na tela)
      const zoomA = Math.min(1, Math.max(0, (cam.k - LABEL_ZOOM * 0.75) / (LABEL_ZOOM * 0.5)))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (let i = 0; i < g.nodes.length; i++) {
        const n = g.nodes[i]
        const special = i === act || i === focus || !!lit?.has(i) || !!matches?.has(i)
        const a = special ? 1 : zoomA * (act !== null || matches ? dimA : 1)
        if (a < 0.04) continue
        const sx = (n.x - cam.x) * cam.k + W / 2
        const sy = (n.y - cam.y) * cam.k + H / 2 + n.r * cam.k + 4
        if (sx < -120 || sx > W + 120 || sy < -20 || sy > H + 20) continue
        ctx.font = `${i === act || i === focus ? 600 : 400} 12px ${colors.font}`
        const text = n.label.length > 32 ? `${n.label.slice(0, 31)}…` : n.label
        ctx.fillStyle = `rgba(${colors.bg}, ${0.7 * a})`
        const w = ctx.measureText(text).width
        ctx.fillRect(sx - w / 2 - 3, sy - 1, w + 6, 16)
        ctx.fillStyle = `rgba(${i === act || i === focus ? colors.text : colors.textDim}, ${a})`
        ctx.fillText(text, sx, sy)
      }
    }

    const frame = () => {
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
      draw()
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

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
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
      api.current = null
    }
    // query entra pelo api.setQuery; o laço não reinicia a cada letra
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, focusId, reducedMotion])

  const count = graph?.nodes.length ?? 0
  const linkCount = graph?.links.length ?? 0
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
      style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}
    >
      {/* Topo */}
      <div className="flex flex-col gap-2 px-4 pt-safe" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
        <div className="flex items-center gap-2">
          <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
            <span className="font-sans font-semibold" style={{ fontSize: 15, color: 'var(--text-primary)' }}>Grafo de conexões</span>
            <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {count} nota{count === 1 ? '' : 's'} · {linkCount} ligaç{linkCount === 1 ? 'ão' : 'ões'}
            </span>
          </div>
          <IconButton label="Enquadrar" onClick={() => api.current?.fit(true)}><Crosshair size={17} /></IconButton>
          <IconButton label="Fechar" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {modes.map((m) => (
            <Chip key={m.id} active={mode === m.id} onClick={() => { setMode(m.id); setSelected(null) }}>{m.label}</Chip>
          ))}
          {(mode === 'all') && (
            <Chip active={orphans} onClick={() => setOrphans((v) => !v)}>notas soltas</Chip>
          )}
          <label
            className="flex items-center gap-1.5 flex-1"
            style={{ minWidth: 140, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '0 10px', height: 32 }}
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

      {/* Grafo */}
      <div ref={wrapRef} style={{ position: 'relative', flex: 1, overflow: 'hidden', touchAction: 'none' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, cursor: 'grab' }} />
        {count <= 1 && (
          <p className="font-serif italic text-center" style={{ position: 'absolute', left: 0, right: 0, bottom: '18%', fontSize: 14, color: 'var(--text-muted)', lineHeight: '20px', padding: '0 32px', pointerEvents: 'none' }}>
            {mode === 'all' ? 'nenhuma ligação ainda — ligue notas pelas conexões sugeridas ou com [[ no texto' : 'nenhuma conexão ainda — veja “Todas” ou ligue esta nota a outra'}
          </p>
        )}
        <p className="font-sans" style={{ position: 'absolute', left: 12, bottom: 'max(env(safe-area-inset-bottom, 0px), 10px)', fontSize: 11, color: 'var(--text-disabled)', pointerEvents: 'none' }}>
          arraste as notas · pinça ou roda para zoom
        </p>
        <AnimatePresence>
          {selected && (
            <motion.button
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              onClick={() => openNote(selected.id)}
              className="touch-feedback flex items-center gap-2 font-sans"
              style={{
                position: 'absolute', left: '50%', x: '-50%', bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 10px) + 28px)',
                background: 'var(--accent-amber)', color: 'var(--on-accent)', border: 'none', borderRadius: 14,
                padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', maxWidth: '86%',
                boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.3)',
              }}
            >
              <span className="line-clamp-1">{selected.label}</span>
              <ArrowRight size={15} style={{ flexShrink: 0 }} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
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
        background: active ? 'var(--accent-amber-soft)' : 'transparent',
        border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-default)'}`,
        color: active ? 'var(--accent-amber)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}
