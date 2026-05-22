'use client'
import { useState } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'
import { mockNotes } from '@/mocks/notes'
import Link from 'next/link'

interface Props {
  noteId: string
  open: boolean
  onClose: () => void
}

function getNeighbors(noteId: string) {
  const note = mockNotes.find(n => n.id === noteId)
  const outgoing = (note?.linkedNoteIds ?? [])
    .map(id => mockNotes.find(n => n.id === id))
    .filter(Boolean) as typeof mockNotes
  const incoming = mockNotes.filter(n =>
    n.id !== noteId && n.linkedNoteIds?.includes(noteId)
  )
  // Deduplicate
  const seen = new Set<string>()
  return [...outgoing, ...incoming].filter(n => {
    if (seen.has(n.id)) return false
    seen.add(n.id)
    return true
  }).slice(0, 6)
}

function radialPosition(index: number, total: number, radius: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

export default function NeighborhoodMap({ noteId, open, onClose }: Props) {
  const currentNote = mockNotes.find(n => n.id === noteId)
  const neighbors = getNeighbors(noteId)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragControls = useDragControls()

  const CENTER = { x: 160, y: 160 }
  const RADIUS = 110

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(17,18,16,0.75)',
              zIndex: 70,
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(360px, calc(100vw - 32px))',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 24,
              zIndex: 75,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span className="font-sans font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                Mapa de conexões
              </span>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Graph */}
            <motion.div
              drag
              dragConstraints={{ left: -60, right: 60, top: -60, bottom: 60 }}
              dragElastic={0.2}
              style={{ position: 'relative', height: 320, cursor: 'grab', touchAction: 'none' }}
            >
              {/* SVG lines */}
              <svg
                width="100%"
                height="320"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                viewBox="0 0 320 320"
              >
                {neighbors.map((neighbor, i) => {
                  const pos = radialPosition(i, neighbors.length, RADIUS)
                  return (
                    <motion.line
                      key={neighbor.id}
                      x1={CENTER.x}
                      y1={CENTER.y}
                      x2={CENTER.x + pos.x}
                      y2={CENTER.y + pos.y}
                      stroke="var(--border-strong)"
                      strokeWidth={1.5}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }}
                    />
                  )
                })}
              </svg>

              {/* Center node */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.05 }}
                style={{
                  position: 'absolute',
                  left: CENTER.x,
                  top: CENTER.y,
                  transform: 'translate(-50%, -50%)',
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'var(--accent-amber-soft)',
                  border: '2px solid var(--accent-amber)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 8,
                  boxShadow: '0 0 20px rgba(232,165,71,0.2)',
                  zIndex: 2,
                }}
              >
                <span
                  className="font-sans font-semibold text-center line-clamp-2"
                  style={{ fontSize: 9, color: 'var(--accent-amber)', lineHeight: '13px' }}
                >
                  {currentNote?.title?.slice(0, 30) ?? 'Esta nota'}
                </span>
              </motion.div>

              {/* Neighbor nodes */}
              {neighbors.map((neighbor, i) => {
                const pos = radialPosition(i, neighbors.length, RADIUS)
                const px = CENTER.x + pos.x
                const py = CENTER.y + pos.y

                return (
                  <motion.div
                    key={neighbor.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 350,
                      damping: 25,
                      delay: 0.2 + i * 0.07,
                    }}
                    style={{
                      position: 'absolute',
                      left: px,
                      top: py,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 2,
                    }}
                  >
                    <Link href={`/note/${neighbor.id}`} onClick={onClose}>
                      <div
                        className="touch-feedback"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: 'var(--bg-surface)',
                          border: '1.5px solid var(--border-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          className="font-sans text-center line-clamp-2"
                          style={{ fontSize: 8, color: 'var(--text-secondary)', lineHeight: '12px' }}
                        >
                          {neighbor.title?.slice(0, 20) ?? 'Sem título'}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}

              {neighbors.length === 0 && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ paddingTop: 80 }}
                >
                  <p className="font-serif italic" style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Nenhuma conexão ainda.{'\n'}Use [[ para linkar notas.
                  </p>
                </div>
              )}
            </motion.div>

            {/* Footer hint */}
            <div
              className="px-5 py-3"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Arraste para explorar · Toque num nó para abrir
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
