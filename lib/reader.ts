'use client'
import { useSyncExternalStore } from 'react'
import { ai, AIError } from './ai'
import { DEFAULT_TTS_VOICE, TTS_VOICES } from './ai-models'

/**
 * "Ouvir": lê uma nota (ou um resumo da IA) em voz alta. Um leitor só para o app inteiro — a
 * barra (ListenBar) continua tocando se você trocar de tela.
 *
 *  - `natural` (padrão): voz do Gemini, bem humana. O texto vai em trechos; o próximo é pedido
 *    enquanto o atual toca. A cota grátis de voz é pequena (poucos pedidos por minuto): se acabar,
 *    o leitor continua do mesmo ponto com a voz do aparelho e avisa.
 *  - `device`: a voz do próprio aparelho (speechSynthesis), escolhendo a mais natural em pt-BR.
 */

export type ReaderEngine = 'natural' | 'device'
export type ReaderStatus = 'idle' | 'loading' | 'playing' | 'paused'
export type ReaderState = {
  status: ReaderStatus
  title: string
  /** Identifica o que está tocando (o botão "ouvir" de cada lugar sabe se é o dele) */
  key: string
  engine: ReaderEngine
  index: number
  total: number
  rate: number
  notice: string | null
}

const KEYS = { engine: 'grafite-reader-engine', voice: 'grafite-reader-voice', device: 'grafite-reader-device-voice', rate: 'grafite-reader-rate' }
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* modo privado */ } }

export const getReaderEngine = (): ReaderEngine => (read(KEYS.engine) === 'device' ? 'device' : 'natural')
export const setReaderEngine = (e: ReaderEngine) => write(KEYS.engine, e)
export const getReaderVoice = () => { const v = read(KEYS.voice); return TTS_VOICES.some((x) => x.id === v) ? v! : DEFAULT_TTS_VOICE }
export const setReaderVoice = (v: string) => write(KEYS.voice, v)
export const getDeviceVoiceURI = () => read(KEYS.device) ?? ''
export const setDeviceVoiceURI = (uri: string) => write(KEYS.device, uri)
export const RATES = [0.9, 1, 1.15, 1.3]
const getRate = () => { const r = Number(read(KEYS.rate)); return RATES.includes(r) ? r : 1 }

/** Markdown → texto corrido para ler (sem #, [[ ]], caixinhas, links...) */
export function speechText(markdown: string): string {
  return markdown
    .split('\n')
    .filter((l) => !/^\s*relacionadas?:/i.test(l))
    .map((l) => l
      .replace(/^\s*#{1,6}\s+(.*)$/, '$1.')
      .replace(/^\s*[-*]\s+\[[xX]\]\s+(.*)$/, '$1 (feito).')
      .replace(/^\s*[-*]\s+\[ \]\s+(.*)$/, '$1.')
      .replace(/^\s*(?:[-*]|\d+\.)\s+(.*)$/, '$1.')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*---+\s*$/, '')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/[*_`~]+/g, '')
      .replace(/([.!?:;,])\.$/, '$1')
      .trim())
    .filter(Boolean)
    .join('\n')
}

/** Trechos curtos (o primeiro bem curto, para começar logo), sempre quebrando em fim de frase */
export function chunkText(text: string, first = 180, max = 520): string[] {
  const sentences = text.replace(/\n+/g, '\n').split(/(?<=[.!?…])\s+|\n/).map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  let cur = ''
  for (const s of sentences) {
    const limit = out.length === 0 ? first : max
    if (cur && (cur + ' ' + s).length > limit) { out.push(cur); cur = '' }
    if (s.length > max) {
      // Frase enorme sem ponto: corta nas vírgulas ou espaços
      for (const piece of s.match(new RegExp(`.{1,${max}}(?:[,;]\\s|\\s|$)`, 'g')) ?? [s]) out.push(piece.trim())
      continue
    }
    cur = cur ? `${cur} ${s}` : s
  }
  if (cur) out.push(cur)
  return out
}

// ── Voz do aparelho ─────────────────────────────────────────────────────
function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis
  const now = synth.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices())
    synth.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1200)
  })
}

/** Vozes em português, as mais naturais primeiro (Natural/Online/Google; as "Desktop" do Windows por último) */
export async function deviceVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  const all = await voicesReady()
  const score = (v: SpeechSynthesisVoice) =>
    (/pt[-_]BR/i.test(v.lang) ? 10 : 0) +
    (/natural|neural|online|premium|enhanced|aprimorad/i.test(v.name) ? 6 : 0) +
    (/google/i.test(v.name) ? 4 : 0) +
    (/francisca|thalita|antonio|luciana|felipe|camila|vitoria|vitória/i.test(v.name) ? 2 : 0) -
    (/desktop|maria\b|daniel\b/i.test(v.name) ? 3 : 0)
  return all.filter((v) => /^pt/i.test(v.lang)).sort((a, b) => score(b) - score(a))
}

async function pickDeviceVoice() {
  const list = await deviceVoices()
  const saved = getDeviceVoiceURI()
  return list.find((v) => v.voiceURI === saved) ?? list[0] ?? null
}

// ── Leitor ──────────────────────────────────────────────────────────────
/** WAV de silêncio: "destrava" o <audio> dentro do toque (iPhone exige gesto para tocar) */
let silent: string | null = null
function silentWav(): string {
  if (silent) return silent
  const b = new ArrayBuffer(46)
  const v = new DataView(b)
  const s = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  s(0, 'RIFF'); v.setUint32(4, 38, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, 2, true)
  silent = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }))
  return silent
}

const IDLE: ReaderState = { status: 'idle', title: '', key: '', engine: 'natural', index: 0, total: 0, rate: 1, notice: null }

class Reader {
  state: ReaderState = IDLE
  private listeners = new Set<() => void>()
  private chunks: string[] = []
  private run = 0
  private audio: HTMLAudioElement | null = null
  private cache = new Map<string, Promise<string>>()

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  get = () => this.state
  private set(p: Partial<ReaderState>) { this.state = { ...this.state, ...p }; this.listeners.forEach((f) => f()) }

  /** Começa a ler (chamar dentro do toque do usuário) */
  play(markdown: string, title: string, key = title) {
    this.stop()
    const text = speechText(markdown)
    if (!text) return
    this.chunks = chunkText(text)
    const engine = getReaderEngine()
    // Cria e destrava o <audio> agora, ainda dentro do gesto
    if (engine === 'natural') {
      this.audio ??= new Audio()
      this.audio.src = silentWav()
      void this.audio.play().catch(() => {})
    }
    const run = ++this.run
    this.set({ status: 'loading', title, key, engine, index: 0, total: this.chunks.length, rate: getRate(), notice: null })
    void (engine === 'natural' ? this.natural(run, 0) : this.device(run, 0))
  }

  pause() {
    if (this.state.status !== 'playing') return
    if (this.state.engine === 'natural') this.audio?.pause()
    // speechSynthesis.pause() não funciona no Android: para e recomeça o trecho atual
    else { this.run++; window.speechSynthesis.cancel() }
    this.set({ status: 'paused' })
  }

  resume() {
    if (this.state.status !== 'paused') return
    if (this.state.engine === 'natural' && this.audio) {
      void this.audio.play().catch(() => {})
      this.set({ status: 'playing' })
    } else {
      const run = ++this.run
      void this.device(run, this.state.index)
    }
  }

  stop() {
    this.run++
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src') }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    if (this.state.status !== 'idle') this.set({ ...IDLE, rate: this.state.rate })
  }

  setRate(rate: number) {
    write(KEYS.rate, String(rate))
    if (this.audio) this.audio.playbackRate = rate
    this.set({ rate })
    // Na voz do aparelho a velocidade vale a partir do próximo trecho
  }

  private fetchChunk(i: number): Promise<string> {
    const text = this.chunks[i]
    const voice = getReaderVoice()
    const k = `${voice}|${text}`
    let p = this.cache.get(k)
    if (!p) {
      p = ai.speak(text, voice).then(({ audio, mimeType }) => {
        const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
        return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
      })
      p.catch(() => this.cache.delete(k))
      this.cache.set(k, p)
      if (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value!)
    }
    return p
  }

  private async natural(run: number, from: number) {
    for (let i = from; i < this.chunks.length; i++) {
      if (run !== this.run) return
      let url: string
      try {
        url = await this.fetchChunk(i)
      } catch (e) {
        if (run !== this.run) return
        // Cota da voz natural acabou (ou sem internet): segue com a voz do aparelho, do mesmo ponto
        const why = e instanceof AIError && /limite/i.test(e.message) ? 'a voz natural atingiu o limite grátis por agora' : 'a voz natural não respondeu'
        this.set({ engine: 'device', notice: `${why} — continuando com a voz do aparelho` })
        return this.device(run, i)
      }
      if (run !== this.run) return
      // Pede o próximo enquanto este toca
      if (i + 1 < this.chunks.length) void this.fetchChunk(i + 1).catch(() => {})
      this.set({ status: this.state.status === 'paused' ? 'paused' : 'playing', index: i })
      const ok = await this.playUrl(run, url)
      if (!ok) return
    }
    if (run === this.run) this.stop()
  }

  private playUrl(run: number, url: string): Promise<boolean> {
    const audio = (this.audio ??= new Audio())
    return new Promise((resolve) => {
      audio.onended = () => resolve(run === this.run)
      audio.onerror = () => resolve(run === this.run)
      audio.src = url
      audio.playbackRate = this.state.rate
      if (this.state.status !== 'paused') void audio.play().catch(() => this.set({ status: 'paused' }))
      // Um stop() no meio troca o run: libera quem está esperando
      const check = setInterval(() => { if (run !== this.run) { clearInterval(check); resolve(false) } }, 250)
      audio.addEventListener('ended', () => clearInterval(check), { once: true })
    })
  }

  private async device(run: number, from: number) {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) { this.set({ notice: 'Este aparelho não tem leitura em voz alta.' }); return }
    const voice = await pickDeviceVoice()
    for (let i = from; i < this.chunks.length; i++) {
      if (run !== this.run) return
      this.set({ status: 'playing', index: i, engine: 'device' })
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(this.chunks[i])
        u.lang = voice?.lang ?? 'pt-BR'
        if (voice) u.voice = voice
        u.rate = this.state.rate
        u.onend = () => resolve()
        u.onerror = () => resolve()
        synth.speak(u)
      })
    }
    if (run === this.run) this.stop()
  }
}

export const reader = new Reader()

export function useReader(): ReaderState {
  return useSyncExternalStore(reader.subscribe, reader.get, () => IDLE)
}

/** Teste da voz em Ajustes */
export function previewVoice() {
  reader.play('Oi! É assim que eu leio as suas notas. Dá para trocar a voz e a velocidade quando quiser.', 'Teste de voz', 'teste')
}

