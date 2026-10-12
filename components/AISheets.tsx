'use client'
import { motion } from 'framer-motion'
import { Sparkles, Link2, Plus, Check } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { renderMarkdown } from './MarkdownEditor'
import type { Suggestions } from '@/lib/ai-types'
import { AI_LOGIN_MESSAGE } from '@/lib/ai'
import ConnectInline from './ConnectInline'
import type { Note } from '@/lib/types'

const LOADING_LABELS: Record<string, string> = {
  summarize: 'resumindo...',
  tasks: 'procurando tarefas...',
  expand: 'desenvolvendo as ideias...',
  translate: 'traduzindo...',
  fix: 'revisando o texto...',
  topics: 'organizando em tópicos...',
  suggest: 'lendo suas notas...',
  ocr: 'lendo a imagem...',
  review: 'relendo a semana...',
}

export function AIThinking({ action }: { action: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      >
        <Sparkles size={18} style={{ color: 'var(--accent-amber)' }} />
      </motion.div>
      <span className="font-serif italic" style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
        {LOADING_LABELS[action] ?? 'pensando...'}
      </span>
    </div>
  )
}

export function AIError({ message }: { message: string }) {
  if (message === AI_LOGIN_MESSAGE) {
    return <div className="px-5 py-5"><ConnectInline /></div>
  }
  return (
    <p className="font-sans px-5 py-6" style={{ fontSize: 14, color: 'var(--danger)', lineHeight: '20px' }}>
      {message}
    </p>
  )
}

function SheetButton({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="touch-feedback flex-1 rounded-xl py-3 font-sans"
      style={{
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        background: primary ? 'var(--accent-amber)' : 'var(--bg-elevated)',
        color: primary ? '#111210' : 'var(--text-secondary)',
        border: primary ? 'none' : '1px solid var(--border-subtle)',
      }}
    >
      {label}
    </button>
  )
}

/** Resultado de uma transformação: o usuário decide se substitui, acrescenta ou descarta */
export function AIResultSheet({
  state, onReplace, onAppend, onClose,
}: {
  state: { action: string; loading: boolean; text?: string; error?: string }
  onReplace: () => void
  onAppend: () => void
  onClose: () => void
}) {
  // Tarefas e resumos são acréscimos naturais; o resto costuma substituir
  const appendFirst = state.action === 'tasks' || state.action === 'summarize' || state.action === 'ocr'
  return (
    <BottomSheet title="IA" onClose={onClose}>
      {state.loading ? (
        <AIThinking action={state.action} />
      ) : state.error ? (
        <AIError message={state.error} />
      ) : (
        <>
          <div className="px-5 py-4 font-serif" style={{ fontSize: 15, lineHeight: '26px', color: 'var(--text-secondary)' }}>
            {renderMarkdown(state.text ?? '')}
          </div>
          <div className="flex gap-2 px-4 pb-4">
            <SheetButton label="Descartar" onClick={onClose} />
            {appendFirst ? (
              <>
                <SheetButton label="Substituir" onClick={onReplace} />
                <SheetButton label="Inserir no fim" onClick={onAppend} primary />
              </>
            ) : (
              <>
                <SheetButton label="Inserir no fim" onClick={onAppend} />
                <SheetButton label="Substituir" onClick={onReplace} primary />
              </>
            )}
          </div>
        </>
      )}
    </BottomSheet>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans font-semibold uppercase mb-2 mt-4" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
      {children}
    </p>
  )
}

/** Sugestões da IA — cada item é aplicado com um toque */
export function SuggestionsSheet({
  state, notes, currentTitle, currentTags, onApplyTitle, onAddTag, onLinkNote, onAddIdea, onClose,
}: {
  state: { loading: boolean; data?: Suggestions; error?: string }
  notes: Note[]
  currentTitle: string
  currentTags: string[]
  onApplyTitle: (t: string) => void
  onAddTag: (t: string) => void
  onLinkNote: (n: Note) => void
  onAddIdea: (idea: string) => void
  onClose: () => void
}) {
  const data = state.data
  const related = (data?.related ?? [])
    .map((r) => ({ ...r, note: notes.find((n) => n.id === r.noteId) }))
    .filter((r): r is typeof r & { note: Note } => !!r.note)

  return (
    <BottomSheet title="Sugestões" onClose={onClose}>
      {state.loading ? (
        <AIThinking action="suggest" />
      ) : state.error ? (
        <AIError message={state.error} />
      ) : data ? (
        <div className="px-5 pb-6">
          {data.title && data.title !== currentTitle && (
            <>
              <SectionLabel>Título</SectionLabel>
              <button
                onClick={() => onApplyTitle(data.title)}
                className="touch-feedback w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
              >
                <span className="font-serif" style={{ fontSize: 16, color: 'var(--text-primary)' }}>{data.title}</span>
                <span style={{ fontSize: 12, color: 'var(--accent-amber)', flexShrink: 0 }}>usar</span>
              </button>
            </>
          )}

          {data.tags.length > 0 && (
            <>
              <SectionLabel>Tags</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag) => {
                  const has = currentTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => !has && onAddTag(tag)}
                      className="touch-feedback flex items-center gap-1"
                      style={{
                        fontSize: 13, borderRadius: 20, padding: '4px 12px', cursor: has ? 'default' : 'pointer',
                        color: 'var(--accent-amber)',
                        background: has ? 'var(--accent-amber-soft)' : 'transparent',
                        border: '1px solid rgba(232,165,71,0.3)',
                      }}
                    >
                      {has ? <Check size={12} /> : <Plus size={12} />}#{tag}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {related.length > 0 && (
            <>
              <SectionLabel>Notas relacionadas</SectionLabel>
              <div className="flex flex-col gap-2">
                {related.map(({ note, reason }) => (
                  <button
                    key={note.id}
                    onClick={() => onLinkNote(note)}
                    className="touch-feedback rounded-xl px-4 py-3 text-left"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  >
                    <div className="flex items-center gap-2">
                      <Link2 size={12} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                      <span className="font-sans font-medium" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        {note.title ?? 'sem título'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--accent-amber)', marginLeft: 'auto', flexShrink: 0 }}>conectar</span>
                    </div>
                    <p className="font-serif" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: '18px' }}>{reason}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {data.ideas.length > 0 && (
            <>
              <SectionLabel>Ideias</SectionLabel>
              <div className="flex flex-col gap-2">
                {data.ideas.map((idea) => (
                  <button
                    key={idea}
                    onClick={() => onAddIdea(idea)}
                    className="touch-feedback flex items-start gap-3 rounded-xl px-4 py-3 text-left"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  >
                    <Plus size={14} style={{ color: 'var(--accent-amber)', marginTop: 3, flexShrink: 0 }} />
                    <span className="font-serif" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: '20px' }}>{idea}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </BottomSheet>
  )
}
