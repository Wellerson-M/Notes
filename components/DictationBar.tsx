'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, RotateCcw, X } from 'lucide-react'
import { useSpeech } from '@/hooks/useSpeech'

interface Props {
  /** Texto confirmado: entra na nota onde o cursor estava */
  onInsert: (text: string) => void
  onClose: () => void
}

/**
 * Ditado dentro da nota, sem sair dela: a nota continua visível, o que você fala aparece aqui
 * e só entra no texto quando tocar em "inserir" (no ponto onde o cursor estava).
 * "Apagar" descarta o que foi dito e continua ouvindo. A escuta não para sozinha em pausas.
 */
export default function DictationBar({ onInsert, onClose }: Props) {
  const { listening, text, error, start, stop, reset } = useSpeech()

  useEffect(() => { start() }, [start])

  const insert = () => {
    stop()
    const t = text.trim()
    if (t) onInsert(t)
    else onClose()
  }

  return (
    <motion.div
      className="app-bar"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70,
        background: 'var(--bg-surface)', borderTop: '1px solid var(--border-default)',
        borderRadius: '18px 18px 0 0', boxShadow: '0 -8px 24px rgba(var(--bg-rgb), 0.5)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
      }}
    >
      <div className="flex items-center gap-2 px-5 pt-4">
        <motion.span
          animate={listening ? { opacity: [1, 0.3, 1] } : { opacity: 0.3 }}
          transition={{ duration: 1.2, repeat: listening ? Infinity : 0 }}
          style={{ width: 8, height: 8, borderRadius: '50%', background: listening ? 'var(--danger)' : 'var(--text-muted)' }}
        />
        <span className="font-sans flex-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {listening ? 'ouvindo — entra onde o cursor estava' : 'microfone parado'}
        </span>
        <button
          onClick={() => { stop(); onClose() }}
          aria-label="Cancelar ditado"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
        >
          <X size={18} />
        </button>
      </div>

      <div
        className="font-serif px-5 pt-2"
        style={{ minHeight: 60, maxHeight: '30vh', overflowY: 'auto', fontSize: 16, lineHeight: '26px', color: 'var(--text-primary)' }}
      >
        {text || <span className="italic" style={{ color: 'var(--text-muted)' }}>{error ?? 'pode falar...'}</span>}
        {text && error && <span className="font-sans" style={{ display: 'block', fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{error}</span>}
      </div>

      <div className="flex items-center gap-2 px-4 pt-3">
        <button
          onClick={reset}
          disabled={!text}
          className="touch-feedback flex items-center justify-center gap-1.5 font-sans rounded-xl"
          style={{
            flex: 1, height: 42, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: text ? 'pointer' : 'default', opacity: text ? 1 : 0.45,
          }}
        >
          <RotateCcw size={15} /> Apagar o que falei
        </button>
        {!listening && !error && (
          <button
            onClick={() => start({ keep: true })}
            className="touch-feedback font-sans rounded-xl"
            style={{ height: 42, padding: '0 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--accent-amber)', fontSize: 13, cursor: 'pointer' }}
          >
            continuar
          </button>
        )}
        <button
          onClick={insert}
          className="touch-feedback flex items-center justify-center gap-1.5 font-sans rounded-xl"
          style={{ flex: 1, height: 42, background: 'var(--accent-amber)', border: 'none', color: 'var(--on-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Check size={15} strokeWidth={2.6} /> Inserir na nota
        </button>
      </div>
    </motion.div>
  )
}
