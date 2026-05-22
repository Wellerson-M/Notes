'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { mockNotes } from '@/mocks/notes'
import { Link2 } from 'lucide-react'

interface Props {
  open: boolean
  query: string
  onSelect: (title: string, noteId: string) => void
  onClose: () => void
}

export default function WikilinkAutocomplete({ open, query, onSelect, onClose }: Props) {
  const filtered = mockNotes
    .filter((n) => n.title && n.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)

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
              zIndex: 70,
            }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(_, info) => { if (info.offset.y > 80) onClose() }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--bg-surface)',
              borderRadius: '20px 20px 0 0',
              borderTop: '1px solid var(--border-default)',
              zIndex: 75,
              maxHeight: '60vh',
              overflowY: 'auto',
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 2, margin: '12px auto 8px' }} />

            <div
              className="flex items-center gap-2 px-5 pb-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>[[</span>
              <span style={{ fontSize: 13, color: 'var(--accent-amber)', fontWeight: 500 }}>
                {query || 'buscar nota...'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>]]</span>
            </div>

            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="font-serif italic" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  nenhuma nota encontrada
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => onSelect(note.title!, note.id)}
                    className="touch-feedback flex items-center gap-3 px-5 py-3.5 text-left"
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    <Link2 size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="font-sans font-medium line-clamp-1"
                        style={{ fontSize: 14, color: 'var(--text-primary)' }}
                      >
                        {note.title}
                      </div>
                      <div
                        className="font-sans line-clamp-1"
                        style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}
                      >
                        {note.tags.map(t => `#${t}`).join(' ')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
