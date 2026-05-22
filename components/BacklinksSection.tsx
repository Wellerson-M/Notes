'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Link2 } from 'lucide-react'
import Link from 'next/link'
import { getBacklinks, getUnlinkedMentions } from '@/mocks/notes'

interface Props {
  noteId: string
}

export default function BacklinksSection({ noteId }: Props) {
  const [open, setOpen] = useState(false)
  const backlinks = getBacklinks(noteId)
  const unlinked = getUnlinkedMentions(noteId)
  const total = backlinks.length

  if (total === 0 && unlinked.length === 0) return null

  return (
    <div
      className="mt-8 pt-6"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      {/* Header colapsável */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="touch-feedback flex items-center gap-2 w-full text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span
          className="font-sans font-semibold uppercase tracking-widest"
          style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}
        >
          Mencionada em ({total})
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex flex-col gap-2 mt-3">
              {backlinks.map((note, i) => {
                const preview = note.content
                  .replace(/^#{1,6}\s+/gm, '')
                  .replace(/\*\*/g, '')
                  .replace(/^[-*]\s+/gm, '')
                  .split('\n')
                  .filter(l => l.trim())
                  .join(' ')
                  .trim()
                  .slice(0, 90)

                return (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link href={`/note/${note.id}`}>
                      <div
                        className="touch-feedback rounded-xl px-4 py-3 noise-card"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Link2 size={12} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                          <span className="font-sans font-medium" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                            {note.title ?? 'Sem título'}
                          </span>
                        </div>
                        <p className="font-serif line-clamp-2" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '18px' }}>
                          {preview}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>

            {/* Menções não-linkadas */}
            {unlinked.length > 0 && (
              <div
                className="mt-4 px-4 py-3 rounded-xl flex items-center justify-between"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                  {unlinked.length} nota{unlinked.length > 1 ? 's' : ''} mencionam este título sem link
                </span>
                <button
                  className="touch-feedback font-sans font-medium"
                  style={{
                    fontSize: 11,
                    color: 'var(--accent-amber)',
                    background: 'var(--accent-amber-soft)',
                    border: '1px solid rgba(232,165,71,0.2)',
                    borderRadius: 8,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                >
                  conectar todas
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
