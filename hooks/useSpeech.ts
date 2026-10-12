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

/** Silêncio depois da fala que encerra a escuta quando `endOnSilence` está ligado */
const SILENCE_MS = 1200

const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)

/**
 * Junta dois trechos sem repetir a parte em comum. O Chrome do Android reenvia a frase inteira
 * a cada resultado ("oi" → "oi tudo" → "oi tudo bem"), e às vezes repete o fim do trecho anterior.
 */
export function joinSpeech(a: string, b: string): string {
  const A = a.trim()
  const B = b.trim()
  if (!A) return B
  if (!B) return A
  const wa = words(A)
  const wb = words(B)
  if (wb.length >= wa.length && wa.every((w, i) => wb[i] === w)) return B // b estende a
  if (wa.length >= wb.length && wb.every((w, i) => wa[wa.length - wb.length + i] === w)) return A // b já está no fim de a
  // Sobreposição: o fim de a é o começo de b (uma palavra só conta se tiver 4+ letras,
  // para não engolir "e", "o", "de" repetidos de propósito)
  for (let k = Math.min(wa.length, wb.length) - 1; k >= 1; k--) {
    if (k === 1 && wb[0].length < 4) break
    if (wa.slice(-k).every((w, i) => wb[i] === w)) {
      return `${A} ${B.split(/\s+/).slice(k).join(' ')}`.trim()
    }
  }
  return `${A} ${B}`
}

const mergeAll = (parts: string[]) => parts.reduce(joinSpeech, '')

/**
 * Ditado em português. O navegador corta a escuta em silêncios longos; enquanto `listening`
 * for true, reiniciamos automaticamente. Com `endOnSilence`, para sozinho logo depois da fala
 * (usado no assistente, para enviar sem precisar tocar em "parar").
 */
export function useSpeech({ endOnSilence = false }: { endOnSilence?: boolean } = {}) {
  const [listening, setListening] = useState(false)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<Recognition | null>(null)
  const wantRef = useRef(false)
  /** Texto confirmado de sessões anteriores (a escuta reinicia várias vezes) */
  const committedRef = useRef('')
  const sessionRef = useRef('')
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSilence = () => { if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null } }

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setError('Seu navegador não tem ditado por voz. Use o Chrome.')
      return
    }
    setError(null)
    committedRef.current = ''
    sessionRef.current = ''
    const rec = new Ctor()
    rec.lang = 'pt-BR'
    // No Android, o modo contínuo repete frases; lá é uma frase por sessão, reiniciando sozinho
    rec.continuous = !/Android/i.test(navigator.userAgent)
    rec.interimResults = true

    rec.onresult = (e) => {
      // Remonta a sessão inteira a cada evento (o resultIndex do Android não é confiável)
      const finals: string[] = []
      const pending: string[] = []
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        ;(r.isFinal ? finals : pending).push(r[0].transcript)
      }
      sessionRef.current = mergeAll(finals)
      setFinalText(joinSpeech(committedRef.current, sessionRef.current))
      setInterim(mergeAll(pending))

      if (endOnSilence) {
        clearSilence()
        silenceRef.current = setTimeout(() => {
          silenceRef.current = null
          if (!joinSpeech(committedRef.current, sessionRef.current)) return
          wantRef.current = false
          rec.stop()
        }, SILENCE_MS)
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'aborted') return
      if (e.error === 'no-speech' && (committedRef.current || sessionRef.current)) return // pausa normal
      if (e.error !== 'no-speech') wantRef.current = false
      setError(ERRORS[e.error] ?? 'O ditado falhou. Tente de novo.')
    }
    rec.onend = () => {
      // Com endOnSilence, o relógio de silêncio continua valendo entre sessões: no Android cada
      // pausa curta encerra a sessão, e isso não quer dizer que a pessoa terminou de falar
      if (!endOnSilence || !wantRef.current) clearSilence()
      committedRef.current = joinSpeech(committedRef.current, sessionRef.current)
      sessionRef.current = ''
      setFinalText(committedRef.current)
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
  }, [endOnSilence])

  const stop = useCallback(() => {
    wantRef.current = false
    clearSilence()
    recRef.current?.stop()
  }, [])

  const reset = useCallback(() => {
    committedRef.current = ''
    sessionRef.current = ''
    setFinalText('')
    setInterim('')
  }, [])

  useEffect(() => () => { wantRef.current = false; clearSilence(); recRef.current?.abort() }, [])

  /** Texto completo até agora, incluindo o trecho ainda não confirmado */
  const text = joinSpeech(finalText, interim)

  return { listening, text, finalText, interim, error, start, stop, reset }
}
