'use client'
import { motion } from 'framer-motion'
import { Check, CheckSquare, List, Heading, Bold, Link2, Quote, Minus, CalendarDays, Mic, ListOrdered, Clock } from 'lucide-react'
import { useKeyboardInset } from '@/hooks/useKeyboardInset'

/** Um atalho da barra: insere no cursor (ou abre algo), sem tirar o foco do texto */
export type QuickItem = { id: string; label: string; Icon?: typeof Check; hint?: string }

/** Atalhos fixos da barra acima do teclado */
export const QUICK_ITEMS: QuickItem[] = [
  { id: 'task', label: 'tarefa', Icon: CheckSquare },
  { id: 'list', label: 'lista', Icon: List },
  { id: 'numbered', label: '1.', Icon: ListOrdered },
  { id: 'heading', label: 'título', Icon: Heading },
  { id: 'bold', label: 'negrito', Icon: Bold },
  { id: 'link', label: 'ligar nota', Icon: Link2 },
  { id: 'quote', label: 'citação', Icon: Quote },
  { id: 'divider', label: 'divisória', Icon: Minus },
  { id: 'today', label: 'hoje', Icon: CalendarDays },
  { id: 'now', label: 'hora', Icon: Clock },
]

/** Opções que aparecem ao digitar um caractere no começo da linha */
export const TRIGGER_ITEMS: Record<'-' | '/', QuickItem[]> = {
  '-': [
    { id: 'list', label: 'lista', Icon: List, hint: '•' },
    { id: 'task', label: 'tarefa', Icon: CheckSquare, hint: '☐' },
    { id: 'divider', label: 'divisória', Icon: Minus, hint: '—' },
  ],
  '/': [
    { id: 'task', label: 'tarefa', Icon: CheckSquare },
    { id: 'list', label: 'lista', Icon: List },
    { id: 'numbered', label: 'numerada', Icon: ListOrdered },
    { id: 'heading', label: 'título', Icon: Heading },
    { id: 'subheading', label: 'subtítulo', Icon: Heading },
    { id: 'quote', label: 'citação', Icon: Quote },
    { id: 'divider', label: 'divisória', Icon: Minus },
    { id: 'link', label: 'ligar nota', Icon: Link2 },
    { id: 'today', label: 'data de hoje', Icon: CalendarDays },
    { id: 'now', label: 'hora', Icon: Clock },
  ],
}

interface Props {
  /** Gatilho ativo ("-" ou "/" digitado no começo da linha): mostra as opções dele no lugar dos atalhos */
  trigger: '-' | '/' | null
  onPick: (id: string, fromTrigger: boolean) => void
  onDismissTrigger: () => void
  onDictate?: () => void
  onDone: () => void
}

/**
 * Barra que fica colada em cima do teclado enquanto se escreve: atalhos de formatação,
 * ditado e "Concluir" (sai da edição e continua na nota). Os botões não roubam o foco
 * do texto (preventDefault no pointerdown), então o teclado não fecha a cada toque.
 */
export default function EditorAccessory({ trigger, onPick, onDismissTrigger, onDictate, onDone }: Props) {
  const inset = useKeyboardInset()
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault()
  const items = trigger ? TRIGGER_ITEMS[trigger] : QUICK_ITEMS

  return (
    <motion.div
      className="app-bar"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      onPointerDown={keep}
      onMouseDown={keep}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: inset, zIndex: 45,
        background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)',
        paddingBottom: inset ? 0 : 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {trigger && (
        <div className="flex items-center justify-between px-4 pt-2 font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{trigger === '/' ? 'inserir…' : 'transformar em…'}</span>
          <button onClick={onDismissTrigger} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
            manter “{trigger}”
          </button>
        </div>
      )}
      <div className="flex items-center" style={{ height: 48 }}>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto px-2 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {!trigger && onDictate && (
            <Chip label="ditar" Icon={Mic} amber onClick={onDictate} />
          )}
          {items.map((it) => (
            <Chip key={it.id} label={it.label} Icon={it.Icon} hint={it.hint} highlight={!!trigger} onClick={() => onPick(it.id, !!trigger)} />
          ))}
        </div>
        <button
          onClick={onDone}
          className="touch-feedback flex items-center gap-1 font-sans flex-shrink-0"
          style={{
            margin: '0 8px 0 4px', padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'var(--accent-amber)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 600,
          }}
        >
          <Check size={14} strokeWidth={2.6} /> Concluir
        </button>
      </div>
    </motion.div>
  )
}

function Chip({ label, Icon, hint, amber, highlight, onClick }: {
  label: string; Icon?: typeof Check; hint?: string; amber?: boolean; highlight?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="touch-feedback flex items-center gap-1.5 font-sans flex-shrink-0"
      style={{
        height: 34, padding: '0 11px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
        background: highlight ? 'var(--accent-amber-soft)' : 'var(--bg-elevated)',
        border: `1px solid ${highlight ? 'rgba(var(--accent-rgb), 0.35)' : 'var(--border-subtle)'}`,
        color: amber || highlight ? 'var(--accent-amber)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
      }}
    >
      {hint ? <span style={{ fontSize: 13 }}>{hint}</span> : Icon && <Icon size={14} />}
      {label}
    </button>
  )
}
