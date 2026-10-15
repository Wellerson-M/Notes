'use client'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Square, RotateCcw } from 'lucide-react'
import ParticleField from './ParticleField'
import { useVoice } from '@/hooks/useVoice'

interface Props {
  onClose: () => void
  onSave: (transcript: string) => void
  /** Texto do botão de parar (ex.: "Parar e enviar" no assistente) */
  stopLabel?: string
  /** Entrega sozinho quando a pessoa para de falar (assistente) */
  autoSend?: boolean
  /** Nomes e termos das notas, para o ditado pela IA acertar a grafia (lido na hora) */
  getContext?: () => string
}

export default function AudioRecorder({ onClose, onSave, stopLabel = 'Parar e inserir', autoSend = false, getContext }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const { listening, text: transcript, error, start, reset, finish, busy, ready, engine } = useVoice({ endOnSilence: autoSend, getContext })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const delivered = useRef(false)
  const startedRef = useRef(false)

  // Com autoSend, a escuta termina sozinha após a fala: entrega o texto assim que estiver transcrito
  useEffect(() => {
    if (listening) { startedRef.current = true; return }
    if (!autoSend || busy || !startedRef.current || delivered.current || !transcript.trim()) return
    delivered.current = true
    onSave(transcript.trim())
  }, [autoSend, listening, busy, transcript, onSave])

  useEffect(() => {
    if (!ready) return
    start()
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [ready, start])

  useEffect(() => {
    if (!listening && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [listening])

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const [finishing, setFinishing] = useState(false)
  const handleStop = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (delivered.current || finishing) return
    setFinishing(true)
    const text = (await finish()).trim()
    if (delivered.current) return
    delivered.current = true
    if (text) onSave(text)
    else onClose()
  }

  // Generate random-ish waveform heights
  const waveHeights = Array.from({ length: 40 }, (_, i) =>
    20 + Math.abs(Math.sin(i * 0.7) * 50 + Math.cos(i * 1.2) * 30)
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-base)',
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      {/* Campo de partículas reativo à amplitude — complementa a waveform.
          Retorna null sozinho se os efeitos estiverem desligados em Settings. */}
      <div style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
        <ParticleField mode="audio" />
      </div>

      {/* Cancel button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 'max(env(safe-area-inset-top, 0px), 16px)',
          left: 20,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Cancelar
      </button>

      {/* Waveform */}
      <div className="flex items-end gap-0.5 justify-center" style={{ height: 80, width: '100%', maxWidth: 320 }}>
        {waveHeights.map((h, i) => (
          <motion.div
            key={i}
            animate={!listening ? { height: '10%' } : { height: [`${h}%`, `${Math.min(100, h * 1.3)}%`, `${h}%`] }}
            transition={!listening ? { duration: 0.3 } : {
              duration: 0.8 + (i % 4) * 0.2,
              repeat: Infinity,
              delay: i * 0.04,
              ease: 'easeInOut',
            }}
            style={{
              flex: 1,
              borderRadius: 2,
              background: i % 3 === 0 ? 'var(--accent-amber)' : 'var(--border-strong)',
              minHeight: 4,
            }}
          />
        ))}
      </div>

      {/* Timer */}
      <motion.span
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: 'var(--accent-amber)',
          fontFamily: 'var(--font-mono)',
          marginTop: 24,
          letterSpacing: 2,
        }}
      >
        {formatTime(elapsed)}
      </motion.span>

      {/* Live transcript */}
      <div
        style={{
          marginTop: 32,
          width: '100%',
          maxWidth: 380,
          minHeight: 80,
          fontFamily: 'var(--font-serif)',
          fontSize: 17,
          lineHeight: '30px',
          color: 'var(--text-primary)',
          textAlign: 'left',
        }}
      >
        {transcript || (
          <span className="italic" style={{ color: 'var(--text-muted)' }}>
            {error ?? (finishing || busy ? 'transcrevendo...' : listening ? (autoSend ? 'pode falar — envio quando você parar' : engine === 'ai' ? 'pode falar — pausas não cortam' : 'pode falar...') : '')}
          </span>
        )}
        {transcript && error && (
          <span className="font-sans" style={{ display: 'block', fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</span>
        )}
        {listening && <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
          style={{ color: 'var(--accent-amber)' }}
        >
          |
        </motion.span>}
      </div>

      {/* Apagar (recomeça a fala) · parar */}
      <div className="flex items-center justify-center" style={{ marginTop: 48, gap: 28, width: '100%' }}>
      <button
        onClick={reset}
        disabled={!transcript}
        aria-label="Apagar o que eu falei"
        className="touch-feedback flex flex-col items-center gap-1 font-sans"
        style={{
          width: 64, background: 'none', border: 'none', cursor: transcript ? 'pointer' : 'default',
          color: 'var(--text-secondary)', opacity: transcript ? 1 : 0.35, fontSize: 11, fontWeight: 500,
        }}
      >
        <span style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={18} />
        </span>
        apagar
      </button>
      <motion.button
        onClick={() => void handleStop()}
        whileTap={{ scale: 0.92 }}
        aria-label={stopLabel}
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--accent-gold)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(var(--gold-rgb), 0.3)',
        }}
      >
        <Square size={24} fill="currentColor" style={{ color: 'var(--on-accent)' }} />
      </motion.button>
      <div style={{ width: 64 }} />
      </div>

      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, fontWeight: 500 }}>
        {stopLabel}
      </span>
    </motion.div>
  )
}
