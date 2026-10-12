'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, ArrowUp, Sparkles, FilePlus, FileText, ExternalLink, Check } from 'lucide-react'
import type { AssistantAction, ChatTurn } from '@/lib/ai-types'
import type { Note } from '@/lib/types'
import { ai, AIError, AI_LOGIN_MESSAGE } from '@/lib/ai'
import ConnectInline from '@/components/ConnectInline'
import { notesRepo, useNotes } from '@/lib/repo'
import { useUIStore } from '@/store/ui'
import { renderMarkdown } from '@/components/MarkdownEditor'
import AudioRecorder from '@/components/AudioRecorder'
import SwipeBackWrapper from '@/components/SwipeBackWrapper'
import { AIThinking } from '@/components/AISheets'
import { noteHref } from '@/lib/routes'

type Message = {
  id: number
  role: 'user' | 'assistant'
  text: string
  actions?: AssistantAction[]
  noteIds?: string[]
  error?: boolean
}

const EXAMPLES = [
  'anota: comprar pão, leite e café amanhã',
  'o que eu tenho pendente essa semana?',
  'me dá ideias para o fim de semana',
  'resume o que anotei sobre trabalho',
]

export default function AssistantClient({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const notes = useNotes()
  const showToast = useUIStore((s) => s.showToast)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [applied, setApplied] = useState<Record<string, true>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const sentInitial = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || loading || !notes) return
    const history: ChatTurn[] = messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }))
    setMessages((m) => [...m, { id: Date.now(), role: 'user', text }])
    setInput('')
    setLoading(true)
    try {
      const reply = await ai.assistant(text, history, notes)
      setMessages((m) => [...m, {
        id: Date.now() + 1,
        role: 'assistant',
        text: reply.reply,
        actions: reply.actions ?? [],
        noteIds: reply.noteIds ?? [],
      }])
    } catch (e) {
      const msg = e instanceof AIError ? e.message : 'A IA não conseguiu responder agora.'
      setMessages((m) => [...m, { id: Date.now() + 1, role: 'assistant', text: msg, error: true }])
    } finally {
      setLoading(false)
    }
  }

  // Pergunta vinda da busca (?q=) é enviada assim que as notas carregarem
  useEffect(() => {
    if (initialQuery && notes && !sentInitial.current) {
      sentInitial.current = true
      void send(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, notes])

  const applyAction = async (key: string, action: AssistantAction) => {
    if (action.type === 'open_note') {
      router.push(noteHref(action.noteId))
      return
    }
    if (action.type === 'create_note') {
      const note = await notesRepo.create({ title: action.title || null, content: action.content, tags: action.tags ?? [] })
      setApplied((a) => ({ ...a, [key]: true }))
      showToast('Nota criada', { actionLabel: 'abrir', onAction: () => router.push(noteHref(note.id)) })
      return
    }
    if (action.type === 'append_to_note') {
      const target = await notesRepo.get(action.noteId)
      if (!target) { showToast('Essa nota não existe mais'); return }
      const sep = target.content.trim() ? '\n' : ''
      await notesRepo.update(target.id, { content: target.content.replace(/\s*$/, '') + sep + '\n' + action.content })
      setApplied((a) => ({ ...a, [key]: true }))
      showToast(`Adicionado em “${target.title ?? 'sem título'}”`)
    }
  }

  const noteById = (id: string): Note | undefined => notes?.find((n) => n.id === id)

  return (
    <SwipeBackWrapper onBack={() => router.back()}>
      <main style={{ background: 'var(--bg-base)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
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
            onClick={() => router.back()}
            className="touch-feedback flex items-center gap-1.5 py-2"
            style={{ color: 'var(--accent-amber)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
              <path d="M7 1L1 7L7 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Voltar
          </button>
          <span className="flex items-center gap-1.5 font-sans font-semibold" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
            <Sparkles size={14} style={{ color: 'var(--accent-amber)' }} /> Assistente
          </span>
          <div style={{ width: 56 }} />
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col gap-4 px-4 py-5" style={{ paddingBottom: 120 }}>
          {messages.length === 0 && !loading && (
            <div className="flex flex-col gap-3 pt-6">
              <p className="font-serif italic" style={{ fontSize: 20, color: 'var(--text-primary)', lineHeight: '28px' }}>
                Fala comigo do seu jeito.
              </p>
              <p className="font-sans" style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: '20px' }}>
                Eu leio suas notas (menos as do Vault), respondo perguntas, crio notas e acrescento coisas nas que já existem.
              </p>
              <div className="flex flex-col gap-2 mt-3">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="touch-feedback rounded-xl px-4 py-3 text-left font-serif italic"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}
                  >
                    &ldquo;{ex}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'stretch', maxWidth: m.role === 'user' ? '85%' : '100%' }}
            >
              {m.role === 'user' ? (
                <div
                  className="font-sans rounded-2xl px-4 py-2.5"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 14, lineHeight: '20px' }}
                >
                  {m.text}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="font-serif" style={{ fontSize: 15, lineHeight: '24px', color: m.error ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    {m.error && m.text === AI_LOGIN_MESSAGE ? <ConnectInline /> : m.error ? m.text : renderMarkdown(m.text)}
                  </div>

                  {/* Notas citadas */}
                  {!!m.noteIds?.length && (
                    <div className="flex flex-wrap gap-2">
                      {m.noteIds.map((id) => noteById(id)).filter(Boolean).map((n) => (
                        <Link
                          key={n!.id}
                          href={noteHref(n!.id)}
                          className="touch-feedback flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-sans"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-secondary)' }}
                        >
                          <FileText size={12} style={{ color: 'var(--accent-amber)' }} />
                          {(n!.title ?? 'sem título').slice(0, 32)}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Ações propostas */}
                  {m.actions?.map((action, i) => {
                    const key = `${m.id}-${i}`
                    return (
                      <ActionCard
                        key={key}
                        action={action}
                        done={!!applied[key]}
                        target={'noteId' in action ? noteById(action.noteId) : undefined}
                        onApply={() => applyAction(key, action)}
                      />
                    )
                  })}
                </div>
              )}
            </motion.div>
          ))}

          {loading && <AIThinking action="assistant" />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="app-bar fixed bottom-0 left-0 right-0 z-40 px-3 pt-2"
          style={{
            background: 'var(--bg-base)',
            borderTop: '1px solid var(--border-subtle)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)',
          }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); void send(input) }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) }
              }}
              rows={1}
              placeholder="escreva ou toque no microfone..."
              className="flex-1 amber-caret font-serif"
              style={{
                resize: 'none',
                maxHeight: 120,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 20,
                padding: '10px 16px',
                color: 'var(--text-primary)',
                fontSize: 15,
                lineHeight: '20px',
                outline: 'none',
                caretColor: 'var(--accent-amber)',
                fieldSizing: 'content',
              } as React.CSSProperties}
            />
            <AnimatePresence mode="wait" initial={false}>
              {input.trim() ? (
                <motion.button
                  key="send"
                  type="submit"
                  disabled={loading}
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  aria-label="Enviar"
                  style={roundButton(true)}
                >
                  <ArrowUp size={20} style={{ color: 'var(--on-accent)' }} strokeWidth={2.5} />
                </motion.button>
              ) : (
                <motion.button
                  key="mic"
                  type="button"
                  onClick={() => setVoiceOpen(true)}
                  disabled={loading}
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  aria-label="Falar"
                  style={roundButton(true)}
                >
                  <Mic size={20} style={{ color: 'var(--on-accent)' }} strokeWidth={2.2} />
                </motion.button>
              )}
            </AnimatePresence>
          </form>
        </div>

        <AnimatePresence>
          {voiceOpen && (
            <AudioRecorder
              stopLabel="Enviar agora"
              autoSend
              onClose={() => setVoiceOpen(false)}
              onSave={(t) => { setVoiceOpen(false); void send(t) }}
            />
          )}
        </AnimatePresence>
      </main>
    </SwipeBackWrapper>
  )
}

function roundButton(primary: boolean): React.CSSProperties {
  return {
    width: 42,
    height: 42,
    flexShrink: 0,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: primary ? 'var(--accent-amber)' : 'var(--bg-elevated)',
  }
}

function ActionCard({ action, done, target, onApply }: {
  action: AssistantAction
  done: boolean
  target?: Note
  onApply: () => void
}) {
  if ('noteId' in action && !target) return null // a IA citou uma nota que não existe

  const { Icon, label, button, preview } =
    action.type === 'create_note'
      ? { Icon: FilePlus, label: `Nova nota: ${action.title || 'sem título'}`, button: 'Criar', preview: action.content }
      : action.type === 'append_to_note'
        ? { Icon: FileText, label: `Acrescentar em “${target?.title ?? 'sem título'}”`, button: 'Adicionar', preview: action.content }
        : { Icon: ExternalLink, label: target?.title ?? 'sem título', button: 'Abrir', preview: '' }

  return (
    <div
      className="noise-card rounded-2xl px-4 py-3"
      style={{ background: 'var(--bg-surface)', border: `1px solid ${done ? 'var(--border-subtle)' : 'rgba(var(--accent-rgb), 0.35)'}` }}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
        <span className="font-sans font-medium flex-1" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
        <button
          onClick={onApply}
          disabled={done}
          className="touch-feedback flex items-center gap-1 font-sans"
          style={{
            fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '5px 12px', flexShrink: 0,
            cursor: done ? 'default' : 'pointer',
            background: done ? 'transparent' : 'var(--accent-amber)',
            color: done ? 'var(--success)' : 'var(--on-accent)',
            border: 'none',
          }}
        >
          {done ? <><Check size={12} /> feito</> : button}
        </button>
      </div>
      {preview && (
        <div className="font-serif mt-2" style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-muted)' }}>
          {renderMarkdown(preview.length > 400 ? preview.slice(0, 400) + '…' : preview)}
        </div>
      )}
    </div>
  )
}
