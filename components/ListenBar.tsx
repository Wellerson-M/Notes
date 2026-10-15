'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Pause, Play, Volume2, X } from 'lucide-react'
import { RATES, reader, useReader } from '@/lib/reader'

/**
 * Barra do "Ouvir": aparece no topo enquanto algo está sendo lido, em qualquer tela.
 * Pausar, velocidade e parar.
 */
export default function ListenBar() {
  const s = useReader()
  const open = s.status !== 'idle'
  const nextRate = RATES[(RATES.indexOf(s.rate) + 1) % RATES.length]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-bar"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          style={{
            position: 'fixed', left: 0, right: 0, zIndex: 85,
            top: 'calc(max(env(safe-area-inset-top, 0px), 0px) + 56px)',
            padding: '0 12px', pointerEvents: 'none',
          }}
          role="region"
          aria-label="Leitura em voz alta"
        >
          <div
            className="flex items-center gap-2 font-sans"
            style={{
              pointerEvents: 'auto', margin: '0 auto', maxWidth: 520,
              background: 'var(--bg-elevated)', border: '1px solid var(--accent-border)', borderRadius: 16,
              padding: '8px 8px 8px 12px', boxShadow: '0 8px 24px rgba(var(--bg-rgb), 0.55)',
            }}
          >
            <Volume2 size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="line-clamp-1" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {s.title || 'Ouvindo'}
              </div>
              <div className="line-clamp-1" style={{ fontSize: 11, color: s.notice ? 'var(--warning)' : 'var(--text-muted)' }}>
                {s.notice ?? (s.status === 'loading'
                  ? 'preparando a voz...'
                  : `${s.engine === 'natural' ? 'voz natural' : 'voz do aparelho'} · ${s.index + 1} de ${s.total}`)}
              </div>
            </div>
            <button
              onClick={() => reader.setRate(nextRate)}
              aria-label={`Velocidade ${s.rate}x`}
              className="touch-feedback"
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 9,
                color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, padding: '5px 7px', cursor: 'pointer', minWidth: 42,
              }}
            >
              {s.rate.toString().replace('.', ',')}x
            </button>
            <button
              onClick={() => (s.status === 'paused' ? reader.resume() : reader.pause())}
              disabled={s.status === 'loading'}
              aria-label={s.status === 'paused' ? 'Continuar' : 'Pausar'}
              className="touch-feedback flex items-center justify-center"
              style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'var(--accent-amber)', color: 'var(--on-accent)', opacity: s.status === 'loading' ? 0.6 : 1,
              }}
            >
              {s.status === 'paused' || s.status === 'loading' ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
            </button>
            <button
              onClick={() => reader.stop()}
              aria-label="Parar leitura"
              className="touch-feedback flex items-center justify-center"
              style={{ width: 30, height: 34, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Botão "ouvir" para um texto qualquer (resumo da IA, resposta do assistente...) */
export function ListenButton({ text, title, id, label = 'ouvir' }: { text: string; title: string; id: string; label?: string }) {
  const s = useReader()
  const mine = s.key === id && s.status !== 'idle'
  return (
    <button
      onClick={() => (mine ? reader.stop() : reader.play(text, title, id))}
      className="touch-feedback flex items-center gap-1.5 font-sans"
      aria-label={mine ? 'Parar leitura' : 'Ouvir em voz alta'}
      style={{
        fontSize: 12, fontWeight: 500, borderRadius: 9, padding: '5px 10px', cursor: 'pointer',
        background: mine ? 'var(--accent-amber-soft)' : 'transparent',
        border: `1px solid ${mine ? 'var(--accent-border)' : 'var(--border-default)'}`,
        color: mine ? 'var(--accent-amber)' : 'var(--text-secondary)',
      }}
    >
      {mine ? <X size={13} /> : <Volume2 size={13} />}
      {mine ? 'parar' : label}
    </button>
  )
}
