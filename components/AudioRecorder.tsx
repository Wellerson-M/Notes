'use client'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Square, X } from 'lucide-react'

const MOCK_TRANSCRIPT_CHUNKS = [
  'Pensando em como simplificar o ',
  'processo... ',
  'Uma ideia seria começar com apenas ',
  'uma pergunta essencial ao usuário. ',
  'Isso reduz a fricção e ',
  'aumenta o engajamento inicial.',
]

interface Props {
  onClose: () => void
  onSave: (transcript: string) => void
}

export default function AudioRecorder({ onClose, onSave }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [transcriptIndex, setTranscriptIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)

    const addChunk = (i: number) => {
      if (i >= MOCK_TRANSCRIPT_CHUNKS.length) return
      setTranscript((t) => t + MOCK_TRANSCRIPT_CHUNKS[i])
      setTranscriptIndex(i + 1)
      transcriptRef.current = setTimeout(() => addChunk(i + 1), 1200)
    }
    transcriptRef.current = setTimeout(() => addChunk(0), 800)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (transcriptRef.current) clearTimeout(transcriptRef.current)
    }
  }, [])

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const handleStop = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (transcriptRef.current) clearTimeout(transcriptRef.current)
    const fullTranscript = MOCK_TRANSCRIPT_CHUNKS.join('')
    onSave(fullTranscript)
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
            animate={{ height: [`${h}%`, `${Math.min(100, h * 1.3)}%`, `${h}%`] }}
            transition={{
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
        {transcript}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
          style={{ color: 'var(--accent-amber)' }}
        >
          |
        </motion.span>
      </div>

      {/* Stop button */}
      <motion.button
        onClick={handleStop}
        whileTap={{ scale: 0.92 }}
        style={{
          marginTop: 48,
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--accent-gold)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(212, 175, 55, 0.3)',
        }}
      >
        <Square size={24} fill="#111210" color="#111210" />
      </motion.button>

      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, fontWeight: 500 }}>
        Parar e inserir
      </span>
    </motion.div>
  )
}
