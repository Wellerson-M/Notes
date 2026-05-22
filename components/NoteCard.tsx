'use client'
import { useState, useRef } from 'react'
import { motion, PanInfo } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Pin, Lock, Mic, Image as ImageIcon, CheckSquare, Link2 } from 'lucide-react'
import { Note, getRelativeDate, formatDuration } from '@/mocks/notes'

interface Props {
  note: Note
  showInkWave?: boolean
}

export default function NoteCard({ note, showInkWave = false }: Props) {
  const router = useRouter()
  const [swipeX, setSwipeX] = useState(0)
  const [inkWave, setInkWave] = useState(showInkWave)
  const isSwiping = useRef(false)

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) {
      // Swipe left: archive/delete reveal
    } else if (info.offset.x > 60) {
      // Swipe right: pin/vault reveal
    }
    setSwipeX(0)
  }

  const handleTap = () => {
    if (Math.abs(swipeX) > 5) return
    router.push(`/note/${note.id}`)
  }

  const previewText = note.content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
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
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16 }}>
      {/* Swipe action backgrounds */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 16,
        }}
      >
        {/* Right side (swipe left → destructive) */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 80,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 16,
            borderRadius: '0 16px 16px 0',
            background: swipeX < -20 ? 'var(--danger)' : 'transparent',
            transition: 'background 0.2s',
          }}
        >
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Deletar</span>
        </div>

        {/* Left side (swipe right → constructive) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 80,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingLeft: 16,
            borderRadius: '16px 0 0 16px',
            background: swipeX > 20 ? 'var(--accent-gold)' : 'transparent',
            transition: 'background 0.2s',
          }}
        >
          <Pin size={16} color="#111210" />
          <span style={{ color: '#111210', fontSize: 12, fontWeight: 600 }}>Fixar</span>
        </div>
      </div>

      {/* Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -80, right: 80 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onDrag={(_, info) => setSwipeX(info.offset.x)}
        onClick={handleTap}
        layoutId={`note-card-${note.id}`}
        className={`noise-card touch-feedback ${inkWave ? 'ink-wave' : ''}`}
        style={{
          background: note.inVault ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          border: note.inVault
            ? '1px solid var(--accent-gold)'
            : `1px solid var(--border-subtle)`,
          borderRadius: 16,
          padding: 20,
          cursor: 'pointer',
          userSelect: 'none',
          x: swipeX,
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
        {note.inVault ? (
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
                  {task.text}
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
