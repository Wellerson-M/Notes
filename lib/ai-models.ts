/**
 * Modelos da IA — compartilhado por Ajustes (escolha e consumo) e por /api/ai (decisão).
 * Os limites do plano grátis do Gemini mudam com frequência e o Google não expõe quanto resta:
 * os números abaixo são estimativas; o que vale de verdade é o contador de uso e o registro
 * de "limite atingido" que o servidor guarda.
 */

export type ModelPref = 'auto' | 'fast' | 'smart' | 'pro'
export type ModelTier = Exclude<ModelPref, 'auto'>

export const MODEL_TIERS: Record<ModelTier, { label: string; description: string; defaultId: string; dailyLimit: number }> = {
  fast: { label: 'Rápido', description: 'Flash-Lite · ~1,5s · cota grande', defaultId: 'gemini-flash-lite-latest', dailyLimit: 1000 },
  smart: { label: 'Inteligente', description: 'Flash · pensa antes · 5–20s', defaultId: 'gemini-flash-latest', dailyLimit: 250 },
  pro: { label: 'Máximo', description: 'Pro · o melhor e o mais lento · cota pequena', defaultId: 'gemini-pro-latest', dailyLimit: 100 },
}

export const EMBED_LABEL = { label: 'Busca por sentido', defaultId: 'gemini-embedding-001', dailyLimit: 1000 }

export const MODEL_PREFS: { id: ModelPref; label: string; description: string }[] = [
  { id: 'auto', label: 'Automático', description: 'rápido no dia a dia; o Inteligente para fotos, expandir texto e resumos da semana' },
  { id: 'fast', label: MODEL_TIERS.fast.label, description: MODEL_TIERS.fast.description },
  { id: 'smart', label: MODEL_TIERS.smart.label, description: MODEL_TIERS.smart.description },
  { id: 'pro', label: MODEL_TIERS.pro.label, description: MODEL_TIERS.pro.description },
]

/** Pedido resumido o bastante para decidir o modelo */
export type TaskInfo = { kind: string; action?: string; size: number }

/**
 * Automático: o Rápido resolve conversa, sugestões e transformações curtas; o Inteligente fica
 * com o que pede mais raciocínio (ler foto, expandir, retrospectiva, textos longos).
 * Devolve [principal, reserva].
 */
export function pickTiers(pref: ModelPref, task: TaskInfo): [ModelTier, ModelTier] {
  if (pref === 'fast') return ['fast', 'smart']
  if (pref === 'smart') return ['smart', 'fast']
  if (pref === 'pro') return ['pro', 'smart']
  const heavy = task.kind === 'ocr' || task.kind === 'review' || task.action === 'expand' || task.size > 8000
  return heavy ? ['smart', 'fast'] : ['fast', 'smart']
}

const PREF_KEY = 'grafite-ai-model'

export function getModelPref(): ModelPref {
  try {
    const v = localStorage.getItem(PREF_KEY) as ModelPref | null
    return v && MODEL_PREFS.some((p) => p.id === v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function setModelPref(pref: ModelPref) {
  try { localStorage.setItem(PREF_KEY, pref) } catch { /* modo privado */ }
}

/** Dia da cota do Gemini: zera à meia-noite do horário do Pacífico (4h/5h em Brasília) */
export function quotaDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d)
}
