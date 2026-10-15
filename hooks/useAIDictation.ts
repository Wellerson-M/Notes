'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ai, AIError } from '@/lib/ai'

/**
 * Ditado pela IA: o microfone grava sem parar (MediaRecorder) e o áudio vai para o Gemini
 * transcrever. Diferente do reconhecimento do navegador, uma pausa nunca corta a fala — no
 * Android o navegador reinicia a escuta a cada frase e perdia o começo da seguinte.
 *
 * Para o texto ir aparecendo durante a fala, a gravação é fatiada em trechos, sempre numa
 * pausa (nunca no meio de uma palavra), e cada trecho é transcrito assim que fecha.
 */

/** Um trecho fecha na primeira pausa depois deste tempo */
const MIN_SEGMENT_MS = 10_000
/** Depois disto, uma pausa curta já basta */
const SOFT_MAX_MS = 40_000
/** E aqui fecha de qualquer jeito (o áudio de um trecho tem que caber num pedido) */
const HARD_MAX_MS = 75_000
const PAUSE_MS = 650
const SHORT_PAUSE_MS = 220
/** Assistente com envio automático: silêncio que encerra depois da fala */
const AUTO_STOP_MS = 2800
const TICK_MS = 60

export const aiDictationSupported = () =>
  typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

function pickMime(): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']) {
    try { if (MediaRecorder.isTypeSupported(t)) return t } catch { /* navegador antigo */ }
  }
  return ''
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

type Segment = { id: number; status: 'pending' | 'done' | 'failed'; text: string; blob: Blob; mime: string }
type Live = { rec: MediaRecorder; id: number; gen: number; startedAt: number; hadVoice: boolean }

const MIC_ERRORS: Record<string, string> = {
  NotAllowedError: 'Permita o uso do microfone para ditar.',
  SecurityError: 'Permita o uso do microfone para ditar.',
  NotFoundError: 'Nenhum microfone encontrado.',
  NotReadableError: 'O microfone está sendo usado por outro app.',
}

export function useAIDictation({ endOnSilence = false, getContext }: { endOnSilence?: boolean; getContext?: () => string } = {}) {
  const [listening, setListening] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])
  const [error, setError] = useState<string | null>(null)
  /** Volume do microfone (0–1), para a barra mostrar que está ouvindo */
  const [level, setLevel] = useState(0)

  const segRef = useRef<Segment[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const liveRef = useRef<Live | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wantRef = useRef(false)
  /** Sobe a cada "apagar": trechos de antes que ainda estavam a caminho são descartados */
  const genRef = useRef(0)
  const seqRef = useRef(0)
  const mimeRef = useRef('')
  const pendingRef = useRef(new Set<Promise<void>>())
  const contextRef = useRef(getContext)
  const startedRef = useRef<Promise<void> | null>(null)
  useEffect(() => { contextRef.current = getContext }, [getContext])

  const commit = useCallback((next: Segment[]) => { segRef.current = next; setSegments(next) }, [])
  const patch = useCallback((id: number, p: Partial<Segment>) => commit(segRef.current.map((s) => (s.id === id ? { ...s, ...p } : s))), [commit])

  const transcribe = useCallback((seg: Segment) => {
    const job = (async () => {
      try {
        const text = await ai.transcribe({ base64: await toBase64(seg.blob), mimeType: seg.mime }, contextRef.current?.() ?? '')
        if (segRef.current.some((s) => s.id === seg.id)) patch(seg.id, { status: 'done', text })
      } catch (e) {
        if (!segRef.current.some((s) => s.id === seg.id)) return
        patch(seg.id, { status: 'failed' })
        setError(e instanceof AIError ? e.message : 'Não deu para transcrever um trecho.')
      }
    })()
    pendingRef.current.add(job)
    void job.finally(() => pendingRef.current.delete(job))
  }, [patch])

  const releaseMic = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    setLevel(0)
  }

  /** Começa um trecho novo. Ao fechar, o trecho vai para a fila de transcrição (se teve fala) */
  const openSegment = useCallback((): Live => {
    const mime = mimeRef.current
    const rec = new MediaRecorder(streamRef.current!, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined)
    const live: Live = { rec, id: ++seqRef.current, gen: genRef.current, startedAt: Date.now(), hadVoice: false }
    const chunks: Blob[] = []
    let done!: () => void
    const stopped = new Promise<void>((r) => { done = r })
    pendingRef.current.add(stopped)
    void stopped.finally(() => pendingRef.current.delete(stopped))
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    rec.onstop = () => {
      if (live.hadVoice && live.gen === genRef.current && chunks.length) {
        const type = rec.mimeType || mime || 'audio/webm'
        const seg: Segment = { id: live.id, status: 'pending', text: '', blob: new Blob(chunks, { type }), mime: type }
        commit([...segRef.current, seg])
        transcribe(seg)
      }
      if (!wantRef.current && !liveRef.current) releaseMic()
      done()
    }
    rec.start()
    return live
  }, [transcribe, commit])

  /** Fecha o trecho atual; com `again`, abre outro antes (sem buraco na gravação) */
  const rotate = useCallback((again: boolean) => {
    const old = liveRef.current
    liveRef.current = again ? openSegment() : null
    if (old && old.rec.state !== 'inactive') old.rec.stop()
  }, [openSegment])

  const stop = useCallback(() => {
    wantRef.current = false
    setListening(false)
    if (liveRef.current) rotate(false)
    else releaseMic()
  }, [rotate])

  const start = useCallback((opts?: { keep?: boolean }) => {
    if (!aiDictationSupported()) { setError('Este navegador não grava áudio. Use o Chrome.'); return }
    if (wantRef.current) return
    setError(null)
    if (!opts?.keep) { genRef.current++; commit([]) }
    wantRef.current = true
    setListening(true)
    startedRef.current = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        })
        if (!wantRef.current) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        mimeRef.current = pickMime()

        // Medidor de volume: decide onde há fala e onde há pausa
        let analyser: AnalyserNode | null = null
        try {
          const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          const ctx = new Ctx()
          await ctx.resume().catch(() => {})
          ctxRef.current = ctx
          analyser = ctx.createAnalyser()
          analyser.fftSize = 1024
          ctx.createMediaStreamSource(stream).connect(analyser)
          if (ctx.state !== 'running') analyser = null
        } catch { analyser = null }

        liveRef.current = openSegment()
        const buf = new Float32Array(1024)
        let floor = 0.01
        let lastVoice = 0
        let heardAny = false
        tickRef.current = setInterval(() => {
          const live = liveRef.current
          if (!live) return
          const now = Date.now()
          const age = now - live.startedAt
          if (!analyser) {
            // Sem medidor (iPhone sem gesto, por exemplo): fatia por tempo e transcreve tudo
            live.hadVoice = true
            if (age >= SOFT_MAX_MS) rotate(true)
            return
          }
          analyser.getFloatTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
          const rms = Math.sqrt(sum / buf.length)
          // O ruído de fundo sobe devagar e desce rápido; fala = bem acima dele
          floor = rms < floor ? floor * 0.9 + rms * 0.1 : floor * 0.995 + rms * 0.005
          const speaking = rms > Math.max(0.012, floor * 2.2)
          setLevel(Math.min(1, rms * 9))
          if (speaking) { lastVoice = now; live.hadVoice = true; heardAny = true }
          const silence = now - Math.max(lastVoice, live.startedAt)

          if (endOnSilence && heardAny && now - lastVoice >= AUTO_STOP_MS) { stop(); return }
          if (
            (age >= MIN_SEGMENT_MS && silence >= PAUSE_MS) ||
            (age >= SOFT_MAX_MS && silence >= SHORT_PAUSE_MS) ||
            age >= HARD_MAX_MS
          ) rotate(true)
        }, TICK_MS)
      } catch (e) {
        wantRef.current = false
        setListening(false)
        setError(MIC_ERRORS[(e as DOMException)?.name] ?? 'Não deu para abrir o microfone.')
        releaseMic()
      }
    })()
  }, [endOnSilence, openSegment, rotate, stop, commit])

  /** Para de gravar e espera a transcrição de tudo; devolve o texto completo */
  const finish = useCallback(async (): Promise<string> => {
    await startedRef.current
    stop()
    while (pendingRef.current.size) await Promise.allSettled([...pendingRef.current])
    return joined(segRef.current)
  }, [stop])

  /** Apaga o que foi dito até agora e continua ouvindo */
  const reset = useCallback(() => {
    genRef.current++
    commit([])
    setError(null)
    if (wantRef.current && liveRef.current) rotate(true)
  }, [rotate, commit])

  /** Tenta de novo os trechos que falharam (sem internet, limite da IA...) */
  const retry = useCallback(() => {
    setError(null)
    for (const s of segRef.current) if (s.status === 'failed') { patch(s.id, { status: 'pending' }); transcribe(s) }
  }, [transcribe, patch])

  useEffect(() => () => {
    wantRef.current = false
    genRef.current++
    const live = liveRef.current
    liveRef.current = null
    if (live && live.rec.state !== 'inactive') live.rec.stop()
    releaseMic()
  }, [])

  const busy = segments.some((s) => s.status === 'pending')
  const failed = segments.some((s) => s.status === 'failed')
  return { listening, text: joined(segments), busy, failed, error, level, start, stop, reset, finish, retry }
}

const joined = (segs: Segment[]) =>
  [...segs].sort((a, b) => a.id - b.id).filter((s) => s.status === 'done' && s.text).map((s) => s.text.trim()).join(' ')
