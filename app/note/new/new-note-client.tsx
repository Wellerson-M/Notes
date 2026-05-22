'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic } from 'lucide-react'
import MarkdownEditor from '@/components/MarkdownEditor'
import BottomToolbar from '@/components/BottomToolbar'
import SyncIndicator from '@/components/SyncIndicator'
import AudioRecorder from '@/components/AudioRecorder'
import SwipeBackWrapper from '@/components/SwipeBackWrapper'
import { useUIStore } from '@/store/ui'

const INITIAL_CONTENT: Record<string, string> = {
  audio: '',
  photo: '',
  task: '- [ ] ',
  link: '',
}

type NewNoteClientProps = {
  mode: string
}

export default function NewNoteClient({ mode }: NewNoteClientProps) {
  const router = useRouter()
  const { setSavingState } = useUIStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState(INITIAL_CONTENT[mode] ?? '')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [audioOpen, setAudioOpen] = useState(mode === 'audio')
  const [inkWave, setInkWave] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (saveTimer) clearTimeout(saveTimer) }
  }, [saveTimer])

  const triggerSave = (t: string, c: string) => {
    if (saveTimer) clearTimeout(saveTimer)
    setSavingState('saving')
    const timer = setTimeout(() => {
      setSavingState('saved')
      setInkWave(true)
      setTimeout(() => { setInkWave(false); setSavingState('idle') }, 1200)
    }, 600)
    setSaveTimer(timer)
  }

  const handleBack = () => {
    if (title || content) {
      // TODO: integrar com persistência real (SQLite WASM / Google Drive)
      sessionStorage.setItem('new-note-id', `new-${Date.now()}`)
    }
    router.back()
  }

  const addTag = (tag: string) => {
    const t = tag.replace(/[^a-záéíóúàâêôãõç\w-]/gi, '').toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setNewTag('')
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  return (
    <SwipeBackWrapper onBack={handleBack}>
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      style={{
        background: 'var(--bg-base)',
        minHeight: '100dvh',
        paddingBottom: 100,
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
          Notas
        </button>

        <AnimatePresence mode="wait">
          <motion.div key={saved ? 'saved' : 'idle'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-1.5">
              {!saved && (
                <>
                  <SyncIndicator status="ok" />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>nova nota</span>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div style={{ width: 32 }} />
      </div>

      {/* Editor */}
      <div className={`px-5 py-6 ${inkWave ? 'ink-wave' : ''}`} style={{ position: 'relative' }}>
        {/* Title */}
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); triggerSave(e.target.value, content) }}
          placeholder="sem título"
          autoFocus={mode === 'text' || mode === 'task'}
          className="w-full font-serif amber-caret"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 28,
            fontWeight: 600,
            lineHeight: '36px',
            color: 'var(--text-primary)',
            caretColor: 'var(--accent-amber)',
            marginBottom: 12,
          }}
        />

        {/* Tags */}
        <div className="flex items-center flex-wrap gap-2 mb-6">
          <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>agora</span>
          {tags.map((tag) => (
            <span
              key={tag}
              onClick={() => removeTag(tag)}
              style={{
                fontSize: 11,
                color: 'var(--accent-amber)',
                background: 'var(--accent-amber-soft)',
                border: '1px solid rgba(232,165,71,0.2)',
                borderRadius: 20,
                padding: '2px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              #{tag} <span style={{ fontSize: 9 }}>×</span>
            </span>
          ))}
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTag(newTag) }
            }}
            placeholder="+ tag"
            className="font-sans amber-caret"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 11,
              color: 'var(--text-muted)',
              width: 50,
              caretColor: 'var(--accent-amber)',
            }}
          />
        </div>

        {/* Body */}
        <MarkdownEditor
          value={content}
          onChange={(val) => { setContent(val); triggerSave(title, val) }}
          placeholder={
            mode === 'task' ? 'Adicione tarefas...' :
            mode === 'audio' ? 'Transcrição do áudio...' :
            'Escreva aqui...'
          }
        />
      </div>

      {/* Bottom toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <BottomToolbar
          onInsertTemplate={(t) => { setContent(c => c + '\n' + t); triggerSave(title, content + t) }}
          onStartAudio={() => setAudioOpen(true)}
        />
      </div>

      {/* Audio recorder */}
      <AnimatePresence>
        {audioOpen && (
          <AudioRecorder
            onClose={() => setAudioOpen(false)}
            onSave={(transcript) => {
              setContent((c) => c + (c ? '\n\n' : '') + transcript)
              setAudioOpen(false)
            }}
          />
        )}
      </AnimatePresence>
    </motion.main>
    </SwipeBackWrapper>
  )
}