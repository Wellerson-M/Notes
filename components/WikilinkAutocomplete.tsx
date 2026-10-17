'use client'
import { useMemo } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { useNotes } from '@/lib/repo'
import { fold } from '@/lib/related'
import { useKeyboardInset } from '@/hooks/useKeyboardInset'
import { Link2 } from 'lucide-react'

interface Props {
  open: boolean
  query: string
  onSelect: (title: string, noteId: string) => void
  onClose: () => void
}

export default function WikilinkAutocomplete({ open, query, onSelect, onClose }: Props) {
  const notes = useNotes()
  const inset = useKeyboardInset(open)
  const drag = useDragControls()

  // Todas as notas com título (não só as 8 primeiras): as que começam com o que foi digitado
  // vêm antes, depois as mais recentes
  const filtered = useMemo(() => {
    const q = fold(query.trim())
    return (notes ?? [])
      .filter((n) => n.title && !n.cipher && fold(n.title).includes(q))
      .sort((a, b) => Number(fold(b.title!).startsWith(q)) - Number(fold(a.title!).startsWith(q)) || b.updatedAt.localeCompare(a.updatedAt))
  }, [notes, query])

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
          {/* Arrastar só pela alça: com o drag no contêiner inteiro, o framer travava a rolagem
              da lista pelo toque e as últimas notas ficavam inalcançáveis */}
          <motion.div
            className="app-bar"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(_, info) => { if (info.offset.y > 80) onClose() }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              bottom: inset,
              left: 0,
              right: 0,
              background: 'var(--bg-surface)',
              borderRadius: '20px 20px 0 0',
              borderTop: '1px solid var(--border-default)',
              zIndex: 75,
              // Com o teclado aberto no iPhone, a altura útil é a da parte visível
              maxHeight: inset ? `calc((100vh - ${inset}px) * 0.6)` : '60vh',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: inset ? 0 : 'env(safe-area-inset-bottom, 16px)',
            }}
          >
            <div
              onPointerDown={(e) => drag.start(e)}
              style={{ touchAction: 'none', cursor: 'grab', flexShrink: 0 }}
            >
              {/* Handle */}
              <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 2, margin: '12px auto 8px' }} />

              <div
                className="flex items-center gap-2 px-5 pb-3"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>[[</span>
                <span className="line-clamp-1" style={{ fontSize: 13, color: 'var(--accent-amber)', fontWeight: 500 }}>
                  {query || 'buscar nota...'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>]]</span>
                <span className="font-sans" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {filtered.length} nota{filtered.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="font-serif italic" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  nenhuma nota encontrada
                </p>
              </div>
            ) : (
              <div className="flex flex-col" style={{ overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
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
                      flexShrink: 0,
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
                      {note.tags.length > 0 && (
                        <div
                          className="font-sans line-clamp-1"
                          style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}
                        >
                          {note.tags.map(t => `#${t}`).join(' ')}
                        </div>
                      )}
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
