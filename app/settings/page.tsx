'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Cloud, Palette, Sparkles, Lock, Info, ChevronRight } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import SyncIndicator from '@/components/SyncIndicator'
import { useUIStore } from '@/store/ui'

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="noise-card rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      <div
        className="flex items-center gap-2 px-5 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Icon size={14} style={{ color: 'var(--accent-amber)' }} />
        <span className="font-sans font-semibold uppercase tracking-widest" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, onClick, danger = false, children }: {
  label: string; value?: string; onClick?: () => void; danger?: boolean; children?: React.ReactNode
}) {
  return (
    <div
      className="touch-feedback flex items-center justify-between px-5 py-3.5"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <span className="font-sans" style={{ fontSize: 14, color: danger ? 'var(--danger)' : 'var(--text-primary)' }}>
        {label}
      </span>
      {children ?? (
        <div className="flex items-center gap-2">
          {value && <span className="font-sans" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{value}</span>}
          {onClick && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      )}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className="touch-feedback"
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: value ? 'var(--accent-amber)' : 'var(--bg-elevated)',
        border: `1px solid ${value ? 'var(--accent-amber)' : 'var(--border-strong)'}`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s, border 0.2s',
        flexShrink: 0,
      }}
    >
      <motion.div
        animate={{ x: value ? 19 : 2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          position: 'absolute',
          top: 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
        }}
      />
    </div>
  )
}

const SNAPSHOTS = [
  { label: '21/05 14:32', size: '4.2 MB' },
  { label: '20/05 23:15', size: '4.1 MB' },
  { label: '19/05 18:00', size: '3.9 MB' },
  { label: '18/05 10:44', size: '3.8 MB' },
  { label: '17/05 09:12', size: '3.7 MB' },
]

export default function SettingsPage() {
  const [biometria, setBiometria] = useState(true)
  const [autoSummary, setAutoSummary] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [aiActions, setAIActions] = useState(['Resumir', 'Virar tarefas', 'Corrigir português'])
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const allAIActions = ['Resumir', 'Virar tarefas', 'Expandir', 'Traduzir', 'Corrigir português', 'Transformar em tópicos']

  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100dvh', paddingBottom: 88 }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center px-5 pt-safe"
        style={{
          height: 56,
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
        }}
      >
        <span className="font-sans font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)' }}>
          Configurações
        </span>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* 1. Backup */}
        <Section title="Backup" icon={Cloud}>
          {/* Status card */}
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              className="noise-card rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
            >
              <div className="flex flex-col gap-1">
                <span className="font-sans font-semibold" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  Último backup
                </span>
                <div className="flex items-center gap-1.5">
                  <SyncIndicator status="ok" />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>há 7 minutos</span>
                </div>
              </div>
              <button
                onClick={() => {
                  useUIStore?.getState?.()?.setSyncStatus?.('syncing')
                  setTimeout(() => {
                    useUIStore?.getState?.()?.setSyncStatus?.('ok')
                    showToast('Backup concluído')
                  }, 1500)
                }}
                className="touch-feedback px-3 py-1.5 rounded-lg font-sans font-medium"
                style={{
                  background: 'var(--accent-amber-soft)',
                  color: 'var(--accent-amber)',
                  border: '1px solid rgba(232,165,71,0.2)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Backup agora
              </button>
            </div>
          </div>

          <Row label="Frequência" value="A cada 15min" onClick={() => {}} />
          <Row label="Conta Google" value="wellerson@gmail.com" onClick={() => {}} />

          {/* Snapshots */}
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="font-sans" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              Restaurar de backup
            </span>
            <div className="flex flex-col gap-1 mt-2">
              {SNAPSHOTS.map((s, i) => (
                <div
                  key={i}
                  className="touch-feedback flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.size}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Drive space */}
          <div className="px-5 py-4">
            <div className="flex justify-between mb-2">
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Espaço no Drive</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>12.4 MB / 15 GB</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: '0.08%', height: '100%', background: 'var(--accent-amber)', borderRadius: 2 }} />
            </div>
          </div>
        </Section>

        {/* 2. Aparência */}
        <Section title="Aparência" icon={Palette}>
          <Row label="Tema" value="Grafite Dark" />
          <Row label="Tipografia de leitura" value="Newsreader" onClick={() => {}} />
          <Row label="Tamanho da fonte">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>A</span>
              <input
                type="range"
                min={14}
                max={22}
                defaultValue={17}
                style={{ width: 80, accentColor: 'var(--accent-amber)' }}
              />
              <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>A</span>
            </div>
          </Row>
          <Row label="Reduzir movimento">
            <Toggle value={reducedMotion} onChange={setReducedMotion} />
          </Row>
        </Section>

        {/* 3. IA */}
        <Section title="Inteligência Artificial" icon={Sparkles}>
          <Row label="Provedor" value="Gemini (gratuito)" onClick={() => {}} />
          <Row label="Resumo automático em notas longas">
            <Toggle value={autoSummary} onChange={setAutoSummary} />
          </Row>
          <div className="px-5 py-3">
            <span className="font-sans" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              Ações rápidas habilitadas
            </span>
            <div className="flex flex-wrap gap-2 mt-2">
              {allAIActions.map((a) => {
                const active = aiActions.includes(a)
                return (
                  <button
                    key={a}
                    onClick={() => setAIActions(prev =>
                      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
                    )}
                    className="touch-feedback rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      background: active ? 'var(--accent-amber-soft)' : 'var(--bg-elevated)',
                      color: active ? 'var(--accent-amber)' : 'var(--text-muted)',
                      border: `1px solid ${active ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        {/* 4. Vault e Privacidade */}
        <Section title="Vault e Privacidade" icon={Lock}>
          <Row label="Biometria para abrir vault">
            <Toggle value={biometria} onChange={setBiometria} />
          </Row>
          <Row label="Auto-lock" value="30 segundos" onClick={() => {}} />
          <Row label="Esquecer histórico de busca" danger onClick={() => showToast('Histórico apagado')} />
        </Section>

        {/* 5. Sobre */}
        <Section title="Sobre" icon={Info}>
          <Row label="Versão" value="0.1.1" />
          <Row label="Exportar tudo" onClick={() => showToast('Preparando export...')} />
          <Row label="Importar de outro app" onClick={() => {}} />
          <Row label="Termos de uso" onClick={() => {}} />
          <Row label="Privacidade" onClick={() => {}} />
          <div style={{ borderBottom: 'none' }}>
            <Row label="GitHub" value="github.com/grafite" onClick={() => {}} />
          </div>
        </Section>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          style={{
            position: 'fixed',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-amber)',
            borderRadius: 12,
            padding: '10px 20px',
            fontSize: 13,
            color: 'var(--text-primary)',
            zIndex: 70,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </motion.div>
      )}

      <BottomNav />
    </main>
  )
}
