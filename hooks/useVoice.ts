'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSpeech } from './useSpeech'
import { aiDictationSupported, useAIDictation } from './useAIDictation'

/**
 * Ditado com dois motores, mesma interface:
 *  - `ai` (padrão): grava o áudio e o Gemini transcreve. Não corta em pausas e entende melhor
 *    nomes, termos e frases longas; o texto aparece em blocos, a cada pausa.
 *  - `browser`: reconhecimento do próprio navegador. Instantâneo, mas no Android reinicia a
 *    cada frase (perde o começo se você voltar a falar logo) e erra mais.
 */
export type DictationEngine = 'ai' | 'browser'

const ENGINE_KEY = 'grafite-dictation-engine'

export function getDictationEngine(): DictationEngine {
  try {
    const v = localStorage.getItem(ENGINE_KEY)
    if (v === 'ai' || v === 'browser') return v
  } catch { /* modo privado */ }
  return 'ai'
}

export function setDictationEngine(engine: DictationEngine) {
  try { localStorage.setItem(ENGINE_KEY, engine) } catch { /* modo privado */ }
}

/** `noAI`: nunca usa a IA (notas do Vault não saem do aparelho para o Gemini) */
export function useVoice({ endOnSilence = false, getContext, noAI = false }: { endOnSilence?: boolean; getContext?: () => string; noAI?: boolean } = {}) {
  // Lido depois de montar (localStorage não existe no servidor)
  const [engine, setEngine] = useState<DictationEngine | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEngine(!noAI && getDictationEngine() === 'ai' && aiDictationSupported() ? 'ai' : 'browser')
  }, [noAI])

  const browser = useSpeech({ endOnSilence })
  const aiVoice = useAIDictation({ endOnSilence, getContext })
  const { stop: browserStop, text: browserText } = browser
  const browserFinish = useCallback(async () => {
    browserStop()
    return browserText.trim()
  }, [browserStop, browserText])

  // `ready`: o motor já foi escolhido — só então a tela deve chamar start()
  if (engine === 'ai') return { ...aiVoice, engine, ready: true }
  return {
    ...browser,
    engine: 'browser' as const,
    busy: false,
    failed: false,
    level: browser.listening ? 0.5 : 0,
    finish: browserFinish,
    retry: () => {},
    ready: engine !== null,
  }
}
