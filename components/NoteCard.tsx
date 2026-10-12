'use client'
import { useState, useRef } from 'react'
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type PanInfo } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Pin, Lock, Mic, Image as ImageIcon, CheckSquare, Link2, Trash2 } from 'lucide-react'
import type { Note } from '@/lib/types'
import { getRelativeDate, formatDuration } from '@/lib/notes'
import { notesRepo, removeWithUndo } from '@/lib/repo'
import { useUIStore } from '@/store/ui'
import { noteHref } from '@/lib/routes'

interface Props {
  note: Note
  showInkWave?: boolean
  /** Mostra o texto de uma nota do Vault (só dentro do Vault aberto) */
  revealed?: boolean
}

/** Fração da largura do card que confirma a ação ao soltar */
const TRIGGER = 0.35
/**
 * Um "peteleco" também confirma, mesmo curto: pelo menos FLICK_MIN px em até FLICK_MS, ainda
 * indo na mesma direção ao soltar. Medido com o relógio do gesto — a velocidade do framer
 * depende do relógio de quadros e deixava arraste lento passar como peteleco.
 */
const FLICK_MIN = 56
const FLICK_MS = 300
const SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const

const vibrate = () => { try { navigator.vibrate?.(12) } catch { /* sem vibração */ } }

export default function NoteCard({ note, showInkWave = false, revealed = false }: Props) {
  const router = useRouter()
  const [inkWave] = useState(showInkWave)
  const cardRef = useRef<HTMLDivElement>(null)
  const armed = useRef<'left' | 'right' | null>(null)
  const busy = useRef(false)
  const dragStartedAt = useRef(0)
  /** O onTap do framer dispara mesmo depois de um arraste: esta marca impede abrir a nota sem querer */
  const dragged = useRef(false)

  // O card segue o dedo 1:1 por motion value: nada re-renderiza durante o arraste
  const x = useMotionValue(0)
  const width = () => cardRef.current?.offsetWidth ?? 340

  // Fundo e ícone acompanham o dedo e ganham força quando a ação está "armada"
  const deleteOpacity = useTransform(x, [-120, -16, 0], [1, 0, 0])
  const pinOpacity = useTransform(x, [0, 16, 120], [0, 0, 1])
  const deleteScale = useTransform(x, [-140, -40], [1.15, 0.7])
  const pinScale = useTransform(x, [40, 140], [0.7, 1.15])

  // Vibra uma vez ao cruzar o ponto de confirmação (para os dois lados)
  useMotionValueEvent(x, 'change', (v) => {
    const limit = width() * TRIGGER
    const next = v <= -limit ? 'left' : v >= limit ? 'right' : null
    if (next && next !== armed.current) vibrate()
    armed.current = next
  })

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setTimeout(() => { dragged.current = false }, 80)
    const w = width()
    const { offset, velocity } = info
    const quick = performance.now() - dragStartedAt.current <= FLICK_MS
    const flickLeft = quick && offset.x <= -FLICK_MIN && velocity.x < 0
    const flickRight = quick && offset.x >= FLICK_MIN && velocity.x > 0

    if (offset.x <= -w * TRIGGER || flickLeft) {
      // Apagar: o card sai da tela pela esquerda e só então some da lista
      busy.current = true
      if (!armed.current) vibrate()
      void animate(x, -w - 40, { type: 'tween', duration: 0.18, ease: [0.32, 0.72, 0, 1] }).then(() =>
        removeWithUndo(note, useUIStore.getState().showToast),
      )
      return
    }
    if (offset.x >= w * TRIGGER || flickRight) {
      if (!armed.current) vibrate()
      void notesRepo.update(note.id, { pinned: !note.pinned })
    }
    void animate(x, 0, SPRING)
  }

  const handleTap = () => {
    if (busy.current || dragged.current) return
    router.push(noteHref(note.id))
  }

  const previewText = note.content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^[-*]\s+\[.\]\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/`/g, '')
    .split('\n')
    .filter((l) => l.trim())
    .join(' ')
    .trim()

  const completedTasks = note.tasks?.filter((t) => t.done).length ?? 0
  const totalTasks = note.tasks?.length ?? 0

  return (
    <div ref={cardRef} style={{ position: 'relative', overflow: 'hidden', borderRadius: 16 }}>
      {/* Fundo do deslize para a esquerda (apagar) */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, borderRadius: 16, background: 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 24,
          opacity: deleteOpacity,
        }}
      >
        <motion.div style={{ scale: deleteScale, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trash2 size={18} color="#fff" />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Apagar</span>
        </motion.div>
      </motion.div>

      {/* Fundo do deslize para a direita (fixar) */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, borderRadius: 16, background: 'var(--accent-gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, paddingLeft: 24,
          opacity: pinOpacity,
        }}
      >
        <motion.div style={{ scale: pinScale, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pin size={18} color="#111210" />
          <span style={{ color: '#111210', fontSize: 13, fontWeight: 600 }}>{note.pinned ? 'Soltar' : 'Fixar'}</span>
        </motion.div>
      </motion.div>

      {/* Card — sem a classe touch-feedback: a transição CSS de transform dela brigava com o arraste */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragElastic={0}
        onDragStart={() => { armed.current = null; dragged.current = true; dragStartedAt.current = performance.now() }}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        whileTap={{ scale: 0.985 }}
        className={`noise-card ${inkWave ? 'ink-wave' : ''}`}
        style={{
          x,
          position: 'relative',
          background: note.inVault ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          border: note.inVault
            ? '1px solid var(--accent-gold)'
            : `1px solid var(--border-subtle)`,
          borderRadius: 16,
          padding: 20,
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'pan-y',
        }}
      >
        {/* Top row: date + attribute icons */}
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {getRelativeDate(note.createdAt)}
          </span>
          <div className="flex items-center gap-2">
            {note.pinned && <Pin size={12} style={{ color: 'var(--accent-amber)' }} fill="var(--accent-amber)" />}
            {note.inVault && <Lock size={12} style={{ color: 'var(--accent-gold)' }} />}
            {note.attachments.audio && <Mic size={12} style={{ color: 'var(--text-muted)' }} />}
            {note.attachments.photos && <ImageIcon size={12} style={{ color: 'var(--text-muted)' }} />}
            {note.tasks && <CheckSquare size={12} style={{ color: 'var(--text-muted)' }} />}
            {note.attachments.links && <Link2 size={12} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>

        {/* Title */}
        {note.title && (
          <h3
            className="font-sans font-semibold mb-1"
            style={{
              fontSize: 15,
              color: 'var(--text-primary)',
              lineHeight: '22px',
            }}
          >
            {note.title}
          </h3>
        )}

        {/* Preview text */}
        {note.inVault && !revealed ? (
          <div
            style={{
              height: 16,
              background: 'var(--border-default)',
              borderRadius: 4,
              filter: 'blur(4px)',
              userSelect: 'none',
            }}
          />
        ) : (
          <p
            className="line-clamp-3 font-serif"
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: '20px',
            }}
          >
            {previewText}
          </p>
        )}

        {/* Photo thumbnail */}
        {note.attachments.photos && note.attachments.photos.length > 0 && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              overflow: 'hidden',
              height: 160,
            }}
          >
            <img
              src={note.attachments.photos[0].url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
            {note.attachments.photos[0].ocrText && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}
              >
                OCR: {note.attachments.photos[0].ocrText.slice(0, 60)}…
              </div>
            )}
          </div>
        )}

        {/* Audio player mini */}
        {note.attachments.audio && (
          <div
            className="flex items-center gap-3 mt-3 rounded-xl px-3 py-2"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Mic size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            {/* Waveform fake */}
            <div className="flex items-end gap-0.5 flex-1" style={{ height: 20 }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 2,
                    borderRadius: 1,
                    background: 'var(--border-strong)',
                    height: `${20 + Math.sin(i * 0.8) * 14 + Math.cos(i * 1.3) * 8}%`,
                    minHeight: 2,
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
              {formatDuration(note.attachments.audio.duration)}
            </span>
          </div>
        )}

        {/* Link card */}
        {note.attachments.links && note.attachments.links.length > 0 && (
          <div
            className="flex gap-3 mt-3 rounded-xl overflow-hidden"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {note.attachments.links[0].image && (
              <img
                src={note.attachments.links[0].image}
                alt=""
                style={{ width: 72, height: 72, objectFit: 'cover', flexShrink: 0 }}
                loading="lazy"
              />
            )}
            <div className="py-2 pr-3" style={{ minWidth: 0 }}>
              <div
                className="line-clamp-2 font-sans"
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '16px' }}
              >
                {note.attachments.links[0].title}
              </div>
              <div
                className="line-clamp-1 font-sans mt-0.5"
                style={{ fontSize: 11, color: 'var(--text-muted)' }}
              >
                {note.attachments.links[0].description}
              </div>
            </div>
          </div>
        )}

        {/* Tasks preview */}
        {note.tasks && note.tasks.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {note.tasks.slice(0, 3).map((task, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: task.done ? 'none' : '1.5px solid var(--border-strong)',
                    background: task.done ? 'var(--success)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {task.done && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="#111210" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span
                  className="font-sans line-clamp-1"
                  style={{
                    fontSize: 12,
                    color: task.done ? 'var(--text-muted)' : 'var(--text-secondary)',
                    textDecoration: task.done ? 'line-through' : 'none',
                  }}
                >
                  {task.text.replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\*\*/g, '')}
                </span>
              </div>
            ))}
            {totalTasks > 3 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                +{totalTasks - 3} restantes · {completedTasks}/{totalTasks} feitas
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="font-sans"
                style={{
                  fontSize: 11,
                  color: 'var(--accent-amber)',
                  background: 'var(--accent-amber-soft)',
                  border: '1px solid rgba(232,165,71,0.2)',
                  borderRadius: 20,
                  padding: '2px 8px',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
