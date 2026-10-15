'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, RotateCcw, X } from 'lucide-react'
import { useVoice } from '@/hooks/useVoice'

interface Props {
  /** Texto confirmado: entra na nota onde o cursor estava */
  onInsert: (text: string) => void
  onClose: () => void
  /** Nomes e termos das notas + texto antes do cursor (ditado pela IA; lido na hora de transcrever) */
  getContext?: () => string
  /** Nota do Vault: usa só o reconhecimento do navegador */
  noAI?: boolean
}

/**
 * Ditado dentro da nota, sem sair dela: a nota continua visível, o que você fala aparece aqui
 * e só entra no texto quando tocar em "inserir" (no ponto onde o cursor estava).
 * "Apagar" descarta o que foi dito e continua ouvindo. A escuta não para sozinha em pausas.
 */
export default function DictationBar({ onInsert, onClose, getContext, noAI }: Props) {
  const voice = useVoice({ getContext, noAI })
  const { listening, text, error, start, stop, reset, finish, retry, busy, failed, level, engine, ready } = voice
  const [inserting, setInserting] = useState(false)

  useEffect(() => { if (ready) start() }, [ready, start])

  const insert = async () => {
    setInserting(true)
    const t = (await finish()).trim()
    setInserting(false)
    if (t) onInsert(t)
    else onClose()
  }

  const status = inserting
    ? 'transcrevendo o último trecho...'
    : listening
      ? engine === 'ai' ? 'ouvindo — pode pausar à vontade' : 'ouvindo — entra onde o cursor estava'
      : 'microfone parado'

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
        <LevelDot listening={listening} level={level} />
        <span className="font-sans flex-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {status}
          {engine === 'ai' && <span style={{ color: 'var(--accent-amber)', marginLeft: 6 }}>· IA</span>}
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
        {text || (
          <span className="italic" style={{ color: 'var(--text-muted)' }}>
            {error ?? (busy ? 'transcrevendo...' : 'pode falar...')}
          </span>
        )}
        {text && busy && <span className="font-sans" style={{ color: 'var(--text-muted)', fontSize: 13 }}> …</span>}
        {text && error && <span className="font-sans" style={{ display: 'block', fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{error}</span>}
        {failed && (
          <button
            onClick={retry}
            className="font-sans"
            style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--accent-amber)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
          >
            tentar transcrever de novo
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 pt-3">
        <button
          onClick={reset}
          disabled={!text && !busy}
          className="touch-feedback flex items-center justify-center gap-1.5 font-sans rounded-xl"
          style={{
            flex: 1, height: 42, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: text ? 'pointer' : 'default', opacity: text || busy ? 1 : 0.45,
          }}
        >
          <RotateCcw size={15} /> Apagar o que falei
        </button>
        {!listening && !error && !inserting && (
          <button
            onClick={() => start({ keep: true })}
            className="touch-feedback font-sans rounded-xl"
            style={{ height: 42, padding: '0 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--accent-amber)', fontSize: 13, cursor: 'pointer' }}
          >
            continuar
          </button>
        )}
        <button
          onClick={() => void insert()}
          disabled={inserting}
          className="touch-feedback flex items-center justify-center gap-1.5 font-sans rounded-xl"
          style={{ flex: 1, height: 42, background: 'var(--accent-amber)', border: 'none', color: 'var(--on-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: inserting ? 0.7 : 1 }}
        >
          <Check size={15} strokeWidth={2.6} /> {inserting ? 'Transcrevendo...' : 'Inserir na nota'}
        </button>
      </div>
    </motion.div>
  )
}

/** Ponto vermelho que cresce com o volume da voz (mostra que o microfone está pegando) */
function LevelDot({ listening, level }: { listening: boolean; level: number }) {
  return (
    <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: listening ? 'var(--danger)' : 'var(--text-muted)',
          opacity: listening ? 1 : 0.3,
          transform: `scale(${listening ? 1 + level * 0.9 : 1})`,
          transition: 'transform 80ms linear',
        }}
      />
    </span>
  )
}
