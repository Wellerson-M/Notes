'use client'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { Note } from '@/lib/types'
import { useNotes } from '@/lib/repo'
import Link from 'next/link'
import { noteHref } from '@/lib/routes'

interface Props {
  noteId: string
  open: boolean
  onClose: () => void
}

const MAX_NODES = 8

type Neighbor = { note: Note; out: boolean; in: boolean }

/** Notas ligadas: as que esta nota cita (out) e as que citam esta (in) — uma nota pode ser as duas */
function getNeighbors(allNotes: Note[], noteId: string): Neighbor[] {
  const note = allNotes.find((n) => n.id === noteId)
  const byId = new Map<string, Neighbor>()
  for (const id of note?.linkedNoteIds ?? []) {
    const n = allNotes.find((x) => x.id === id && !x.inVault)
    if (n && n.id !== noteId) byId.set(n.id, { note: n, out: true, in: false })
  }
  for (const n of allNotes) {
    if (n.id === noteId || n.inVault || !n.linkedNoteIds?.includes(noteId)) continue
    const cur = byId.get(n.id)
    byId.set(n.id, cur ? { ...cur, in: true } : { note: n, out: false, in: true })
  }
  return [...byId.values()]
}

const label = (n: Note) => n.title?.trim() || n.content.trim().split('\n')[0].slice(0, 40) || 'sem título'

/** Largura máxima de uma etiqueta, em % do quadro */
const NODE_MAX_W = 30
const CENTER_MAX_W = 36

/**
 * Tamanho estimado de uma etiqueta em % do quadro (~360px): ~1,7% por letra a 12px, mais o
 * respiro; quebra em até 2 linhas.
 */
function boxSize(text: string, maxW: number) {
  const textW = text.length * 1.7
  const w = Math.min(maxW, textW + 6)
  return { w, h: textW + 6 > maxW ? 12 : 8 }
}

/**
 * Posições em % do quadro: começa numa elipse (mais larga que alta, porque as etiquetas são
 * horizontais) e afasta as que se sobrepõem — entre si e com a do centro — sem sair do quadro.
 */
function layout(labels: string[], centerLabel: string) {
  const center = { x: 50, y: 50, ...boxSize(centerLabel, CENTER_MAX_W) }
  const boxes = labels.map((t, i) => {
    const angle = (i / labels.length) * 2 * Math.PI - Math.PI / 2
    return { x: 50 + Math.cos(angle) * 33, y: 50 + Math.sin(angle) * 38, ...boxSize(t, NODE_MAX_W) }
  })
  const GAP = 2.5
  for (let iter = 0; iter < 80; iter++) {
    let moved = false
    const all = [center, ...boxes]
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]
        const b = all[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const ox = (a.w + b.w) / 2 + GAP - Math.abs(dx)
        const oy = (a.h + b.h) / 2 + GAP - Math.abs(dy)
        if (ox <= 0 || oy <= 0) continue
        moved = true
        // Empurra pelo eixo de menor sobreposição; o centro não se mexe
        const [ka, kb] = a === center ? [0, 1] : [0.5, 0.5]
        if (ox < oy) {
          const s = Math.sign(dx) || 1
          a.x -= s * ox * ka
          b.x += s * ox * kb
        } else {
          const s = Math.sign(dy) || 1
          a.y -= s * oy * ka
          b.y += s * oy * kb
        }
      }
    }
    for (const b of boxes) {
      b.x = Math.min(100 - b.w / 2 - 1.5, Math.max(b.w / 2 + 1.5, b.x))
      b.y = Math.min(100 - b.h / 2 - 1.5, Math.max(b.h / 2 + 1.5, b.y))
    }
    if (!moved) break
  }
  return boxes.map(({ x, y }) => ({ x, y }))
}

export default function NeighborhoodMap({ noteId, open, onClose }: Props) {
  const notes = useNotes() ?? []
  const currentNote = notes.find((n) => n.id === noteId)
  const all = getNeighbors(notes, noteId)
  const neighbors = all.slice(0, MAX_NODES)
  const hidden = all.length - neighbors.length
  const positions = layout(neighbors.map((nb) => label(nb.note)), currentNote ? label(currentNote) : 'Esta nota')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        // O wrapper em flex centraliza; assim a animação (escala) não briga com um translate(-50%)
        <motion.div
          key="map"
          className="flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'rgba(var(--bg-rgb), 0.75)', padding: 16 }}
        >
          <motion.div
            role="dialog"
            aria-label="Mapa de conexões"
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(380px, 100%)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            }}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-col">
                <span className="font-sans font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)' }}>Mapa de conexões</span>
                <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {all.length === 0 ? 'nenhuma ligação' : `${all.length} nota${all.length > 1 ? 's' : ''} ligada${all.length > 1 ? 's' : ''}`}
                </span>
              </div>
              <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
                <X size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Grafo: linhas (SVG) e etiquetas usam as mesmas coordenadas em % */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                {neighbors.map((nb, i) => {
                  const p = positions[i]
                  return (
                    <motion.line
                      key={nb.note.id}
                      x1={50} y1={50} x2={p.x} y2={p.y}
                      style={{ stroke: nb.out ? 'var(--accent-amber)' : 'var(--border-strong)', strokeOpacity: nb.out ? 0.7 : 1 }}
                      strokeWidth={nb.out ? 1.6 : 1.2}
                      strokeDasharray={nb.out ? undefined : '3 3'}
                      vectorEffect="non-scaling-stroke"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.35, delay: 0.1 + i * 0.04 }}
                    />
                  )
                })}
              </svg>

              {/* Nota atual no centro */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                style={{ position: 'absolute', left: '50%', top: '50%', x: '-50%', y: '-50%', zIndex: 2, width: 'max-content', maxWidth: `${CENTER_MAX_W}%` }}
              >
                <div
                  className="font-sans font-semibold text-center"
                  style={{
                    fontSize: 13, lineHeight: '17px', color: 'var(--on-accent)', background: 'var(--accent-amber)',
                    borderRadius: 14, padding: '8px 12px', boxShadow: '0 0 24px rgba(var(--accent-rgb), 0.35)',
                  }}
                >
                  <span className="line-clamp-2">{currentNote ? label(currentNote) : 'Esta nota'}</span>
                </div>
              </motion.div>

              {/* Notas ligadas */}
              {neighbors.map((nb, i) => {
                const p = positions[i]
                return (
                  <motion.div
                    key={nb.note.id}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.12 + i * 0.04 }}
                    style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, x: '-50%', y: '-50%', zIndex: 3, width: 'max-content', maxWidth: `${NODE_MAX_W}%` }}
                  >
                    <Link href={noteHref(nb.note.id)} onClick={onClose}>
                      <div
                        className="touch-feedback font-sans text-center"
                        style={{
                          fontSize: 12, lineHeight: '15px', color: 'var(--text-primary)',
                          background: 'var(--bg-surface)', borderRadius: 12, padding: '6px 10px',
                          border: `1px solid ${nb.out ? 'var(--accent-border)' : 'var(--border-default)'}`,
                          boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                        }}
                      >
                        <span className="line-clamp-2">{label(nb.note)}</span>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}

              {neighbors.length === 0 && (
                <p
                  className="font-serif italic text-center"
                  style={{ position: 'absolute', left: 0, right: 0, bottom: '16%', fontSize: 14, color: 'var(--text-muted)', lineHeight: '20px', padding: '0 24px' }}
                >
                  nenhuma conexão ainda — escreva [[ no texto para ligar a outra nota
                </p>
              )}
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-4 flex-wrap px-5 py-3 font-sans" style={{ borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" strokeWidth="1.6" style={{ stroke: 'var(--accent-amber)' }} /></svg>
                esta nota cita
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" strokeWidth="1.4" strokeDasharray="3 3" style={{ stroke: 'var(--border-strong)' }} /></svg>
                cita esta nota
              </span>
              {hidden > 0 && <span style={{ marginLeft: 'auto' }}>+{hidden} não mostradas</span>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
