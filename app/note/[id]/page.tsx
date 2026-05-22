'use client'
import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreVertical, Pin, Lock, FileText, Trash2, BookOpen, GitFork } from 'lucide-react'
import { mockNotes } from '@/mocks/notes'
import { useUIStore } from '@/store/ui'
import MarkdownEditor from '@/components/MarkdownEditor'
import BottomToolbar from '@/components/BottomToolbar'
import SyncIndicator from '@/components/SyncIndicator'
import AudioRecorder from '@/components/AudioRecorder'
import BacklinksSection from '@/components/BacklinksSection'
import NeighborhoodMap from '@/components/NeighborhoodMap'
import SwipeBackWrapper from '@/components/SwipeBackWrapper'

function SavingIndicator({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  return (
    <AnimatePresence mode="wait">
      {state !== 'idle' && (
        <motion.div
          key={state}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1.5"
        >
          {state === 'saving' && <SyncIndicator status="syncing" />}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {state === 'saving' ? 'salvando...' : 'salvo há instantes'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const note = mockNotes.find((n) => n.id === id)
  const { savingState, setSavingState } = useUIStore()

  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [tags, setTags] = useState<string[]>(note?.tags ?? [])
  const [newTag, setNewTag] = useState('')
  const [readingMode, setReadingMode] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [audioOpen, setAudioOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [inkWave, setInkWave] = useState(false)
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (saveTimer) clearTimeout(saveTimer) }
  }, [saveTimer])

  const triggerSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    setSavingState('saving')
    const t = setTimeout(() => {
      // TODO: integrar com persistência real (SQLite WASM / IndexedDB)
      setSavingState('saved')
      setInkWave(true)
      setTimeout(() => { setInkWave(false); setSavingState('idle') }, 2000)
    }, 800)
    setSaveTimer(t)
  }

  const handleContentChange = (val: string) => { setContent(val); triggerSave() }
  const handleTitleChange = (val: string) => { setTitle(val); triggerSave() }

  const addTag = (tag: string) => {
    const t = tag.replace(/[^a-záéíóúàâêôãõç\w-]/gi, '').toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setNewTag('')
  }
  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  if (!note) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Nota não encontrada</p>
      </div>
    )
  }

  const createdDate = new Date(note.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  const handleBack = () => router.back()

  return (
    <SwipeBackWrapper onBack={handleBack}>
      <motion.main
        layoutId={`note-card-${note.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: 'var(--bg-base)',
          minHeight: '100dvh',
          paddingBottom: readingMode ? 60 : 100,
        }}
      >
        {/* Top bar */}
        <div
          className="sticky top-0 z-40 flex items-center justify-between px-4 pt-safe"
          style={{
            height: 48,
            background: 'var(--bg-base)',
            borderBottom: '1px solid var(--border-subtle)',
            paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
          }}
        >
          <button
            onClick={handleBack}
            className="touch-feedback flex items-center gap-1.5 py-2"
            style={{ color: 'var(--accent-amber)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
              <path d="M7 1L1 7L7 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Voltar
          </button>

          <SavingIndicator state={savingState} />

          <button
            onClick={() => setSheetOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
          >
            <MoreVertical size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Editor area */}
        <div className={`px-5 py-6 ${inkWave ? 'ink-wave' : ''}`} style={{ position: 'relative' }}>
          {/* Title */}
          {readingMode ? (
            <h1
              className="font-serif font-semibold mb-3"
              style={{
                fontSize: 28, lineHeight: '36px', color: 'var(--text-primary)',
                padding: '0 8px',
              }}
            >
              {title || 'sem título'}
            </h1>
          ) : (
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="sem título"
              className="w-full font-serif amber-caret"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                fontSize: 28, fontWeight: 600, lineHeight: '36px',
                color: 'var(--text-primary)', caretColor: 'var(--accent-amber)', marginBottom: 12,
              }}
            />
          )}

          {/* Metadata */}
          <div className="flex items-center flex-wrap gap-2 mb-6">
            <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {createdDate}
            </span>
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 font-sans"
                style={{
                  fontSize: 11, color: 'var(--accent-amber)',
                  background: 'var(--accent-amber-soft)',
                  border: '1px solid rgba(232,165,71,0.2)', borderRadius: 20,
                  padding: '2px 8px', cursor: readingMode ? 'default' : 'pointer',
                }}
                onClick={() => !readingMode && removeTag(tag)}
              >
                #{tag}
                {!readingMode && <span style={{ fontSize: 9, marginLeft: 2 }}>×</span>}
              </span>
            ))}
            {!readingMode && (
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTag(newTag) }
                }}
                placeholder="+ tag"
                className="font-sans amber-caret"
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 11, color: 'var(--text-muted)', width: 50, caretColor: 'var(--accent-amber)',
                }}
              />
            )}
          </div>

          {/* Body */}
          <div style={readingMode ? { padding: '0 8px' } : {}}>
            <MarkdownEditor
              value={content}
              onChange={handleContentChange}
              placeholder="Escreva aqui..."
            />
          </div>

          {/* Backlinks section */}
          <BacklinksSection noteId={id} />
        </div>

        {/* Bottom toolbar (hidden in reading mode) */}
        {!readingMode && (
          <div className="fixed bottom-0 left-0 right-0 z-40">
            <BottomToolbar
              onInsertTemplate={(t) => handleContentChange(content + '\n' + t)}
              onStartAudio={() => setAudioOpen(true)}
            />
          </div>
        )}

        {/* Reading mode float button */}
        {readingMode && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setReadingMode(false)}
            style={{
              position: 'fixed', bottom: 32, right: 20,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 12, padding: '10px 16px', fontSize: 12,
              color: 'var(--text-secondary)', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            ✏️ Editar
          </motion.button>
        )}

        {/* Actions bottom sheet */}
        <AnimatePresence>
          {sheetOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSheetOpen(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(17,18,16,0.6)', zIndex: 60 }}
              />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.3 }}
                onDragEnd={(_, info) => { if (info.offset.y > 80) setSheetOpen(false) }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{
                  position: 'fixed', bottom: 0, left: 0, right: 0,
                  background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
                  borderTop: '1px solid var(--border-default)', zIndex: 65,
                  paddingBottom: 'env(safe-area-inset-bottom, 16px)',
                }}
              >
                <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 2, margin: '12px auto' }} />
                {[
                  { Icon: Pin, label: 'Fixar nota', color: 'var(--accent-amber)' },
                  { Icon: Lock, label: 'Mover para Vault', color: 'var(--accent-gold)' },
                  { Icon: BookOpen, label: 'Modo leitura', color: 'var(--text-secondary)', onClick: () => { setReadingMode(true); setSheetOpen(false) } },
                  { Icon: GitFork, label: 'Ver conexões', color: 'var(--accent-amber)', onClick: () => { setMapOpen(true); setSheetOpen(false) } },
                  { Icon: FileText, label: 'Exportar', color: 'var(--text-secondary)' },
                  { Icon: Trash2, label: 'Deletar', color: 'var(--danger)' },
                ].map(({ Icon, label, color, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick ?? (() => setSheetOpen(false))}
                    className="touch-feedback flex items-center gap-4 w-full px-6 py-4"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <Icon size={18} style={{ color }} />
                    <span className="font-sans" style={{ fontSize: 15, color }}>{label}</span>
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Neighborhood map modal */}
        <NeighborhoodMap noteId={id} open={mapOpen} onClose={() => setMapOpen(false)} />

        {/* Audio recorder overlay */}
        <AnimatePresence>
          {audioOpen && (
            <AudioRecorder
              onClose={() => setAudioOpen(false)}
              onSave={(t) => { handleContentChange(content + '\n\n> 🎙️ ' + t); setAudioOpen(false) }}
            />
          )}
        </AnimatePresence>
      </motion.main>
    </SwipeBackWrapper>
  )
}
