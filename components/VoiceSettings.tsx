'use client'
import { useEffect, useState } from 'react'
import { Check, Volume2 } from 'lucide-react'
import { getDictationEngine, setDictationEngine, type DictationEngine } from '@/hooks/useVoice'
import { TTS_VOICES } from '@/lib/ai-models'
import {
  deviceVoices, getDeviceVoiceURI, getReaderEngine, getReaderVoice, previewVoice, reader,
  setDeviceVoiceURI, setReaderEngine, setReaderVoice, type ReaderEngine,
} from '@/lib/reader'

type Option<T extends string> = { id: T; label: string; description?: string }

function Choice<T extends string>({ title, options, value, onChange }: { title: string; options: Option<T>[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="font-sans px-1 pb-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{title}</span>
      {options.map((o) => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className="touch-feedback flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
            style={{
              background: active ? 'var(--accent-amber-soft)' : 'transparent',
              border: `1px solid ${active ? 'var(--accent-border)' : 'transparent'}`,
              cursor: 'pointer',
            }}
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `1.5px solid ${active ? 'var(--accent-amber)' : 'var(--border-strong)'}`,
                background: active ? 'var(--accent-amber)' : 'transparent',
              }}
            >
              {active && <Check size={11} strokeWidth={3} style={{ color: 'var(--on-accent)' }} />}
            </span>
            <span className="flex flex-col">
              <span className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{o.label}</span>
              {o.description && <span className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '16px' }}>{o.description}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const DICTATION: Option<DictationEngine>[] = [
  { id: 'ai', label: 'Pela IA · recomendado', description: 'grava e o Gemini transcreve: pausas não cortam a fala e acerta mais nomes e termos' },
  { id: 'browser', label: 'Do navegador', description: 'texto na hora, mas no Android corta se você pausar e voltar a falar logo' },
]

const READER: Option<ReaderEngine>[] = [
  { id: 'natural', label: 'Voz natural (IA)', description: 'voz humana do Gemini; a cota grátis é pequena, e quando acaba usa a do aparelho' },
  { id: 'device', label: 'Voz do aparelho', description: 'grátis e sem limite; a qualidade depende do celular ou do PC' },
]

/** Ditado e "Ouvir" (tudo fica neste aparelho) */
export default function VoiceSettings() {
  const [dictation, setDictation] = useState<DictationEngine | null>(null)
  const [engine, setEngine] = useState<ReaderEngine | null>(null)
  const [voice, setVoice] = useState<string | null>(null)
  const [device, setDevice] = useState<{ id: string; label: string }[]>([])
  const [deviceURI, setDeviceURI] = useState('')

  useEffect(() => {
    // localStorage e vozes só existem no cliente
    /* eslint-disable react-hooks/set-state-in-effect */
    setDictation(getDictationEngine())
    setEngine(getReaderEngine())
    setVoice(getReaderVoice())
    setDeviceURI(getDeviceVoiceURI())
    /* eslint-enable react-hooks/set-state-in-effect */
    void deviceVoices().then((list) => {
      setDevice(list.map((v) => ({ id: v.voiceURI, label: `${v.name.replace(/^Microsoft |^Google /, '')}${/pt[-_]PT/i.test(v.lang) ? ' (Portugal)' : ''}` })))
    })
  }, [])

  const test = () => { reader.stop(); previewVoice() }

  return (
    <>
      <Choice title="Ditado" options={DICTATION} value={dictation} onChange={(v) => { setDictationEngine(v); setDictation(v) }} />
      <Choice title="Ouvir notas" options={READER} value={engine} onChange={(v) => { setReaderEngine(v); setEngine(v) }} />
      {engine === 'natural' && (
        <Choice
          title="Voz natural"
          options={TTS_VOICES}
          value={voice}
          onChange={(v) => { setReaderVoice(v); setVoice(v); test() }}
        />
      )}
      {engine === 'device' && device.length > 0 && (
        <Choice
          title="Voz do aparelho"
          options={device.slice(0, 8)}
          value={deviceURI || device[0].id}
          onChange={(v) => { setDeviceVoiceURI(v); setDeviceURI(v); test() }}
        />
      )}
      <button
        onClick={test}
        className="touch-feedback flex items-center gap-2 w-full px-5 py-3.5 font-sans"
        style={{ background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--accent-amber)', fontSize: 14 }}
      >
        <Volume2 size={15} /> Testar a voz
      </button>
    </>
  )
}
