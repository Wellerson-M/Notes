'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreVertical, Pin, Lock, Unlock, FileText, Trash2, BookOpen, GitFork } from 'lucide-react'
import type { Note } from '@/lib/types'
import type { Suggestions, TransformAction } from '@/lib/ai-types'
import { notesRepo, removeWithUndo, useNotes } from '@/lib/repo'
import { ai, AIError } from '@/lib/ai'
import { useUIStore } from '@/store/ui'
import { FLUSH_EVENT } from '@/lib/updates'
import MarkdownEditor from './MarkdownEditor'
import BottomToolbar from './BottomToolbar'
import SyncIndicator from './SyncIndicator'
import AudioRecorder from './AudioRecorder'
import BacklinksSection from './BacklinksSection'
import NeighborhoodMap from './NeighborhoodMap'
import SwipeBackWrapper from './SwipeBackWrapper'
import { AIResultSheet, SuggestionsSheet } from './AISheets'

const SAVE_DEBOUNCE_MS = 600

const INITIAL_CONTENT: Record<string, string> = { task: '- [ ] ' }

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
            {state === 'saving' ? 'salvando...' : 'salvo'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type Draft = { title: string; content: string; tags: string[] }

interface Props {
  /** Nota existente, ou null para uma nota nova (criada só quando algo for escrito) */
  note: Note | null
  mode?: string
}

export default function NoteEditor({ note, mode = 'text' }: Props) {
  const router = useRouter()
  const { savingState, setSavingState, showToast } = useUIStore()
  const allNotes = useNotes() ?? []
  const isNew = !note

  const initialContent = note?.content ?? INITIAL_CONTENT[mode] ?? ''
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(initialContent)
  const [tags, setTags] = useState<string[]>(note?.tags ?? [])
  const [newTag, setNewTag] = useState('')
  const [readingMode, setReadingMode] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [audioOpen, setAudioOpen] = useState(isNew && mode === 'audio')
  const [mapOpen, setMapOpen] = useState(false)
  const [inkWave, setInkWave] = useState(false)
  const [aiResult, setAIResult] = useState<{ action: string; loading: boolean; text?: string; error?: string } | null>(null)
  const [openedAt] = useState(() => new Date().toISOString())
  const [suggestions, setSuggestions] = useState<{ loading: boolean; data?: Suggestions; error?: string } | null>(null)

  // Refs guardam o estado mais recente para o salvamento debounced e o flush ao sair
  const noteIdRef = useRef<string | null>(note?.id ?? null)
  const [noteId, setNoteId] = useState<string | null>(note?.id ?? null)
  const draftRef = useRef<Draft>({ title, content, tags })
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef<Promise<void>>(Promise.resolve())
  const current = allNotes.find((n) => n.id === noteId) ?? note ?? undefined

  const flush = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (!dirtyRef.current) return savingRef.current
    dirtyRef.current = false
    const { title: t, content: c, tags: tg } = draftRef.current
    const data = { title: t.trim() || null, content: c, tags: tg }

    savingRef.current = savingRef.current.then(async () => {
      if (noteIdRef.current) {
        await notesRepo.update(noteIdRef.current, data)
      } else {
        // Nota nova só nasce quando tiver algo além do conteúdo inicial do modo
        if (!data.title && c.trim() === (INITIAL_CONTENT[mode] ?? '').trim() && !tg.length) return
        noteIdRef.current = (await notesRepo.create(data)).id
        setNoteId(noteIdRef.current)
      }
    })
    return savingRef.current
  }, [mode])

  const scheduleSave = useCallback((patch: Partial<Draft>) => {
    draftRef.current = { ...draftRef.current, ...patch }
    dirtyRef.current = true
    setSavingState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await flush()
      setSavingState('saved')
      setInkWave(true)
      setTimeout(() => { setInkWave(false); setSavingState('idle') }, 1500)
    }, SAVE_DEBOUNCE_MS)
  }, [flush, setSavingState])

  // Ao sair da tela (inclusive fechar a aba), grava o que estiver pendente
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
    const onFlush = () => void flush() // pedido antes de recarregar para atualizar o app
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener(FLUSH_EVENT, onFlush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener(FLUSH_EVENT, onFlush)
      void flush()
      setSavingState('idle')
    }
  }, [flush, setSavingState])

  const handleContentChange = (val: string) => { setContent(val); scheduleSave({ content: val }) }
  const handleTitleChange = (val: string) => { setTitle(val); scheduleSave({ title: val }) }
  const updateTags = (next: string[]) => { setTags(next); scheduleSave({ tags: next }) }
  const appendContent = (extra: string) => {
    const base = draftRef.current.content
    handleContentChange(base + (base.trim() ? '\n\n' : '') + extra)
  }

  const addTag = (tag: string) => {
    const t = tag.replace(/[^a-záéíóúàâêôãõç\w-]/gi, '').toLowerCase()
    if (t && !tags.includes(t)) updateTags([...tags, t])
    setNewTag('')
  }
  const removeTag = (tag: string) => updateTags(tags.filter((t) => t !== tag))

  const handleBack = async () => {
    await flush()
    if (isNew && noteIdRef.current) sessionStorage.setItem('new-note-id', noteIdRef.current)
    router.back()
  }

  // ── IA ──────────────────────────────────────────────────────────────
  const runTransform = async (action: TransformAction) => {
    if (!content.trim()) { showToast('Escreva algo antes de usar a IA'); return }
    setAIResult({ action, loading: true })
    try {
      const text = await ai.transform(action, title || null, content)
      setAIResult({ action, loading: false, text })
    } catch (e) {
      setAIResult({ action, loading: false, error: e instanceof AIError ? e.message : 'A IA não conseguiu responder agora.' })
    }
  }

  const runSuggest = async () => {
    if (!content.trim() && !title.trim()) { showToast('Escreva algo antes de pedir sugestões'); return }
    setSuggestions({ loading: true })
    try {
      const data = await ai.suggest({ id: noteIdRef.current ?? '', title: title || null, content, tags }, allNotes)
      setSuggestions({ loading: false, data })
    } catch (e) {
      setSuggestions({ loading: false, error: e instanceof AIError ? e.message : 'A IA não conseguiu responder agora.' })
    }
  }

  // ── Ações do menu ───────────────────────────────────────────────────
  const withNote = async (fn: (id: string) => Promise<unknown>) => {
    await flush()
    if (!noteIdRef.current) { showToast('Escreva algo primeiro'); return }
    await fn(noteIdRef.current)
  }

  const exportMarkdown = () => {
    const header = title ? `# ${title}\n\n` : ''
    const blob = new Blob([header + content], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(title || 'nota').replace(/[\\/:*?"<>|]/g, '-').slice(0, 60)}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const createdDate = new Date(current?.createdAt ?? openedAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  type SheetAction = 'pin' | 'vault' | 'read' | 'map' | 'export' | 'delete'
  const sheetActions: { id: SheetAction; Icon: typeof Pin; label: string; color: string }[] = [
    { id: 'pin', Icon: Pin, label: current?.pinned ? 'Soltar nota' : 'Fixar nota', color: 'var(--accent-amber)' },
    {
      id: 'vault',
      Icon: current?.inVault ? Unlock : Lock,
      label: current?.inVault ? 'Tirar do Vault' : 'Mover para Vault',
      color: 'var(--accent-gold)',
    },
    { id: 'read', Icon: BookOpen, label: 'Modo leitura', color: 'var(--text-secondary)' },
    { id: 'map', Icon: GitFork, label: 'Ver conexões', color: 'var(--accent-amber)' },
    { id: 'export', Icon: FileText, label: 'Exportar (.md)', color: 'var(--text-secondary)' },
    { id: 'delete', Icon: Trash2, label: 'Deletar', color: 'var(--danger)' },
  ]

  const runSheetAction = async (action: SheetAction) => {
    setSheetOpen(false)
    switch (action) {
      case 'pin':
        return withNote((id) => notesRepo.update(id, { pinned: !current?.pinned }))
      case 'vault':
        return withNote(async (id) => {
          await notesRepo.update(id, { inVault: !current?.inVault, pinned: false })
          showToast(current?.inVault ? 'Nota fora do Vault' : 'Nota movida para o Vault')
        })
      case 'read': return setReadingMode(true)
      case 'map': return setMapOpen(true)
      case 'export': return exportMarkdown()
      case 'delete':
        return withNote(async (id) => {
          const latest = await notesRepo.get(id)
          if (latest) await removeWithUndo(latest, showToast)
          router.back()
        })
    }
  }

  return (
    <SwipeBackWrapper onBack={handleBack}>
      <motion.main
        initial={isNew ? { opacity: 0, y: 20 } : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        style={{ background: 'var(--bg-base)', minHeight: '100dvh', paddingBottom: readingMode ? 60 : 100 }}
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
            {isNew ? 'Notas' : 'Voltar'}
          </button>

          <div className="flex-1 flex justify-center">
            {isNew && savingState === 'idle' && !noteId ? (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>nova nota</span>
            ) : (
              <SavingIndicator state={savingState} />
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setMapOpen(true)}
              className="touch-feedback"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' }}
              aria-label="Ver conexões"
            >
              <GitFork size={18} style={{ color: 'var(--text-muted)' }} />
            </button>
            <button
              onClick={() => setSheetOpen(true)}
              className="touch-feedback"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
              aria-label="Mais ações"
            >
              <MoreVertical size={18} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        {/* Editor area */}
        <div className={`px-5 py-6 ${inkWave ? 'ink-wave' : ''}`} style={{ position: 'relative' }}>
          {readingMode ? (
            <h1
              className="font-serif font-semibold mb-3"
              style={{ fontSize: 28, lineHeight: '36px', color: 'var(--text-primary)', padding: '0 8px' }}
            >
              {title || 'sem título'}
            </h1>
          ) : (
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="sem título"
              autoFocus={isNew && (mode === 'text' || mode === 'task')}
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
              {isNew && !noteId ? 'agora' : createdDate}
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
                onBlur={() => newTag && addTag(newTag)}
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
              placeholder={mode === 'task' ? 'Adicione tarefas...' : mode === 'audio' ? 'Transcrição do áudio...' : 'Escreva aqui...'}
            />
          </div>

          {noteId && <BacklinksSection noteId={noteId} />}
        </div>

        {!readingMode && (
          <div className="app-bar fixed bottom-0 left-0 right-0 z-40">
            <BottomToolbar
              onInsertTemplate={(t) => handleContentChange(content + (content && !content.endsWith('\n') ? '\n' : '') + t)}
              onStartAudio={() => setAudioOpen(true)}
              onAIAction={runTransform}
              onSuggest={runSuggest}
            />
          </div>
        )}

        {readingMode && (
          <motion.button
            className="app-fab"
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
                className="app-bar"
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
                {sheetActions.map(({ id, Icon, label, color }) => (
                  <button
                    key={id}
                    onClick={() => void runSheetAction(id)}
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

        {/* IA */}
        <AnimatePresence>
          {aiResult && (
            <AIResultSheet
              state={aiResult}
              onClose={() => setAIResult(null)}
              onReplace={() => { handleContentChange(aiResult.text ?? content); setAIResult(null) }}
              onAppend={() => { appendContent(aiResult.text ?? ''); setAIResult(null) }}
            />
          )}
          {suggestions && (
            <SuggestionsSheet
              state={suggestions}
              notes={allNotes}
              currentTitle={title}
              currentTags={tags}
              onApplyTitle={(t) => handleTitleChange(t)}
              onAddTag={(t) => updateTags([...draftRef.current.tags, t])}
              onLinkNote={(n) => { appendContent(`[[${n.title ?? ''}]]`); showToast('Conexão criada') }}
              onAddIdea={(idea) => { appendContent(`- [ ] ${idea}`); showToast('Ideia adicionada como tarefa') }}
              onClose={() => setSuggestions(null)}
            />
          )}
        </AnimatePresence>

        {noteId && (
          <NeighborhoodMap noteId={noteId} open={mapOpen} onClose={() => setMapOpen(false)} />
        )}

        <AnimatePresence>
          {audioOpen && (
            <AudioRecorder
              onClose={() => setAudioOpen(false)}
              onSave={(t) => { appendContent(t); setAudioOpen(false) }}
            />
          )}
        </AnimatePresence>
      </motion.main>
    </SwipeBackWrapper>
  )
}
