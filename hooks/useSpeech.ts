'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/* Tipos mínimos da Web Speech API — ainda não estão no lib.dom do TypeScript */
type SpeechAlternative = { transcript: string }
type SpeechResult = { isFinal: boolean; 0: SpeechAlternative }
type SpeechEvent = { resultIndex: number; results: { length: number; [i: number]: SpeechResult } }
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const speechSupported = () => getRecognitionCtor() !== null

const ERRORS: Record<string, string> = {
  'not-allowed': 'Permita o uso do microfone para ditar.',
  'service-not-allowed': 'Permita o uso do microfone para ditar.',
  'no-speech': 'Não ouvi nada. Tente de novo.',
  network: 'O ditado precisa de internet.',
  'audio-capture': 'Nenhum microfone encontrado.',
}

/**
 * Ditado em português. O navegador corta a escuta em silêncios longos;
 * enquanto `listening` for true, reiniciamos automaticamente.
 */
export function useSpeech() {
  const [listening, setListening] = useState(false)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<Recognition | null>(null)
  const wantRef = useRef(false)

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setError('Seu navegador não tem ditado por voz. Use o Chrome.')
      return
    }
    setError(null)
    const rec = new Ctor()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let interimChunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) setFinalText((t) => (t ? t + ' ' : '') + r[0].transcript.trim())
        else interimChunk += r[0].transcript
      }
      setInterim(interimChunk)
    }
    rec.onerror = (e) => {
      if (e.error === 'aborted') return
      if (e.error !== 'no-speech') wantRef.current = false
      setError(ERRORS[e.error] ?? 'O ditado falhou. Tente de novo.')
    }
    rec.onend = () => {
      setInterim('')
      if (wantRef.current) {
        try { rec.start() } catch { wantRef.current = false; setListening(false) }
      } else {
        setListening(false)
      }
    }
    recRef.current = rec
    wantRef.current = true
    setListening(true)
    try { rec.start() } catch { /* já estava rodando */ }
  }, [])

  const stop = useCallback(() => {
    wantRef.current = false
    recRef.current?.stop()
  }, [])

  const reset = useCallback(() => { setFinalText(''); setInterim('') }, [])

  useEffect(() => () => { wantRef.current = false; recRef.current?.abort() }, [])

  /** Texto completo até agora, incluindo o trecho ainda não confirmado */
  const text = [finalText, interim].filter(Boolean).join(' ')

  return { listening, text, finalText, interim, error, start, stop, reset }
}
