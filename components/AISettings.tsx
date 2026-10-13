'use client'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { MODEL_PREFS, getModelPref, setModelPref, type ModelPref, type ModelTier } from '@/lib/ai-models'

/** Escolha do modelo da IA (fica neste aparelho) */
export function ModelPicker() {
  const [pref, setPref] = useState<ModelPref | null>(null)

  useEffect(() => {
    // localStorage só existe no cliente — lido depois da montagem para não divergir do SSR
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPref(getModelPref())
  }, [])

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="font-sans px-1 pb-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Modelo</span>
      {MODEL_PREFS.map((m) => {
        const active = pref === m.id
        return (
          <button
            key={m.id}
            onClick={() => { setModelPref(m.id); setPref(m.id) }}
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
              <span className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {m.label}{m.id === 'auto' ? ' · recomendado' : ''}
              </span>
              <span className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '16px' }}>{m.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

type UsageRow = { day: string; model: string; requests: number; limited: number; errors: number; inputTokens: number; outputTokens: number; lastLimitedAt?: number; lastError?: string; lastErrorAt?: number }
type ModelInfo = { id: string; label: string; dailyLimit: number }
type Report = {
  today: string
  todayByModel: UsageRow[]
  week: UsageRow[]
  models: Record<ModelTier, ModelInfo>
  embed: ModelInfo
}

const fmtNum = (n: number) => n >= 10000 ? `${Math.round(n / 1000)} mil` : n.toLocaleString('pt-BR')

/** Uso da IA: pedidos de hoje por modelo contra o limite estimado do plano grátis */
export function AIUsage({ connected }: { connected: boolean }) {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!connected) return
    fetch('/api/ai', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setReport)
      .catch(() => setError(true))
  }, [connected])

  if (!connected) return null
  if (error) return <p className="px-5 py-3 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Não deu para ler o uso agora.</p>
  if (!report) return <p className="px-5 py-3 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>lendo o uso...</p>

  const lines: ModelInfo[] = [report.models.fast, report.models.smart, report.models.pro, report.embed]
  const row = (id: string) => report.todayByModel.find((r) => r.model === id)
  const weekTotal = report.week.reduce((s, r) => s + r.requests, 0)
  const weekTokens = report.week.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0)
  const lastLimit = report.todayByModel.map((r) => r.lastLimitedAt ?? 0).sort((a, b) => b - a)[0]
  const lastError = report.todayByModel.filter((r) => r.lastError).sort((a, b) => (b.lastErrorAt ?? 0) - (a.lastErrorAt ?? 0))[0]

  return (
    <div className="flex flex-col gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex items-baseline justify-between">
        <span className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Uso de hoje</span>
        <span className="font-sans" style={{ fontSize: 12, color: 'var(--success)' }}>custo: R$ 0 (plano grátis)</span>
      </div>
      {lines.map((m) => {
        const r = row(m.id)
        const used = r?.requests ?? 0
        const pct = Math.min(100, (used / m.dailyLimit) * 100)
        const hitLimit = (r?.limited ?? 0) > 0
        return (
          <div key={m.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between font-sans" style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-primary)' }}>{m.label}</span>
              <span style={{ color: hitLimit ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {used} / ~{m.dailyLimit}{hitLimit ? ' · limite atingido' : ''}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${hitLimit ? 100 : Math.max(pct, used ? 2 : 0)}%`, borderRadius: 3, background: hitLimit ? 'var(--danger)' : pct > 80 ? 'var(--warning)' : 'var(--accent-amber)' }} />
            </div>
          </div>
        )
      })}
      <p className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: '16px' }}>
        Últimos 7 dias: {weekTotal} pedidos · {fmtNum(weekTokens)} tokens.
        {lastLimit ? ` Último limite atingido às ${new Date(lastLimit).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.` : ''}
        {lastError ? ` Última falha (${lastError.model}, ${new Date(lastError.lastErrorAt ?? 0).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}): ${lastError.lastError}.` : ''}
        {' '}A cota zera às 4h/5h (horário de Brasília). Os limites são estimativas: o Google não informa quanto resta, e quando um modelo esgota o app troca sozinho pelo outro.
      </p>
    </div>
  )
}
