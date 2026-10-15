'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Cloud, Palette, Sparkles, Lock, Info, ChevronRight, CalendarDays, Bell, HardDriveDownload, Mic, Waypoints } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import SyncIndicator from '@/components/SyncIndicator'
import { useUIStore } from '@/store/ui'
import { db, getMeta } from '@/lib/db'
import { syncNow } from '@/lib/sync'
import { useNotes } from '@/lib/repo'
import { getPreview } from '@/lib/notes'
import { clearRecentSearches } from '@/lib/recent-searches'
import type { Note } from '@/lib/types'
import { APP_VERSION, APP_BUILT_AT, applyUpdate, checkForUpdate } from '@/lib/updates'
import { makeZip } from '@/lib/zip'
import ThemePicker from '@/components/ThemePicker'
import { AIUsage, ModelPicker } from '@/components/AISettings'
import CalendarLink from '@/components/CalendarLink'
import ReminderSettings from '@/components/ReminderSettings'
import PasswordChange from '@/components/PasswordChange'
import ServerBackups from '@/components/ServerBackups'
import { canShareFiles, lastBackupAt, saveBackup } from '@/lib/backup'
import { getVoiceAutoSend, setVoiceAutoSend } from '@/hooks/useSpeech'
import { useRouter } from 'next/navigation'
import VoiceSettings from '@/components/VoiceSettings'
import { getGalaxyOn, setGalaxyOn } from '@/components/GalaxyBackdrop'
import { getLinksInText, setLinksInText } from '@/lib/related'

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="noise-card overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'calc(var(--card-radius) + 2px)', boxShadow: 'var(--card-shadow)' }}>
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

type ServerStatus = { authenticated: boolean; configured: boolean; ai: boolean }

/** "hoje às 14:32", "ontem às 09:10", "10/10 às 18:05" */
function whenText(t: number | string | undefined): string {
  if (!t) return '—'
  const d = new Date(t)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const day = new Date(d); day.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000)
  if (diff === 0) return `hoje às ${time}`
  if (diff === 1) return `ontem às ${time}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`
}

const SYNC_LABELS: Record<string, string> = {
  ok: 'sincronizado',
  syncing: 'sincronizando...',
  error: 'erro ao sincronizar',
  offline: 'sem internet — salvo no aparelho',
  unauthorized: 'não conectado',
}

function download(name: string, content: string | Blob, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(typeof content === 'string' ? new Blob([content], { type }) : content)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function SettingsPage() {
  const router = useRouter()
  const { particleEffects, setParticleEffects, reducedMotion, setReducedMotion, syncStatus, syncError, showToast, vaultLocked } = useUIStore()
  const notes = useNotes()
  const [server, setServer] = useState<ServerStatus | null>(null)
  const [serverError, setServerError] = useState(false)
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [lastSync, setLastSync] = useState<number | undefined>()
  const [live, setLive] = useState<{ version?: string; builtAt?: string } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [lastBackup, setLastBackup] = useState<number | undefined>()
  const [backupStale, setBackupStale] = useState(false)
  const [shareable, setShareable] = useState(false)
  const [voiceAutoSend, setVoiceAutoSendState] = useState(false)
  const [galaxy, setGalaxy] = useState(true)
  const [linksInText, setLinksInTextState] = useState(false)

  useEffect(() => {
    // Só no cliente: localStorage, IndexedDB e o compartilhar do sistema
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShareable(canShareFiles())
    setVoiceAutoSendState(getVoiceAutoSend())
    setGalaxy(getGalaxyOn())
    setLinksInTextState(getLinksInText())
    void lastBackupAt().then((t) => { setLastBackup(t); setBackupStale(!t || Date.now() - t > 14 * 86400000) })
  }, [])

  const refreshStatus = async () => {
    try {
      const res = await fetch('/api/auth')
      setServer(await res.json())
      setServerError(false)
    } catch {
      setServerError(true)
    }
    setLastSync(await getMeta<number>('lastSyncAt'))
    // Versão que está no ar, para comparar com a deste aparelho
    fetch('/api/version', { cache: 'no-store' }).then((r) => r.json()).then(setLive).catch(() => setLive(null))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshStatus()
  }, [syncStatus])

  const login = async () => {
    if (!password) return
    setLoggingIn(true)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null)
    setLoggingIn(false)
    if (!res) { showToast('Sem conexão com o servidor'); return }
    if (!res.ok) { showToast('Senha incorreta'); return }
    setPassword('')
    showToast('Conectado — sincronizando...')
    await syncNow()
    await refreshStatus()
  }

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' }).catch(() => null)
    useUIStore.getState().setSyncStatus('unauthorized')
    await refreshStatus()
    showToast('Desconectado. As notas continuam no aparelho.')
  }

  const manualSync = async () => {
    const r = await syncNow()
    showToast(
      r === 'ok' ? 'Tudo sincronizado' :
      r === 'offline' ? 'Sem internet agora' :
      r === 'unauthorized' ? 'Entre com a senha primeiro' :
      (useUIStore.getState().syncError ?? 'Não deu para sincronizar')
    )
  }

  const checkUpdate = async () => {
    if (await checkForUpdate()) {
      showToast('Atualizando...')
      await applyUpdate()
    } else {
      showToast(navigator.onLine ? 'Você já está na versão mais nova' : 'Sem internet agora')
    }
  }

  const stamp = () => new Date().toISOString().slice(0, 10)

  /** Backup completo, como está gravado: as notas do Vault vão cifradas */
  const exportAll = async (share: boolean) => {
    const r = await saveBackup({ share })
    if (!r) return
    setLastBackup(Date.now())
    setBackupStale(false)
    showToast(`${r.count} notas no backup${r.sealed ? ` (${r.sealed} do Vault, cifradas)` : ''}${r.via === 'share' ? ' — enviado' : ''}`)
  }

  /** Um .md por nota, para abrir em qualquer editor (Obsidian, VS Code...). O Vault fica de fora. */
  const exportMarkdown = () => {
    const list = (notes ?? []).filter((n) => !n.inVault)
    const used = new Set<string>()
    const files = list.map((n) => {
      const base = (n.title || getPreview(n.content, 40) || 'nota').replace(/[\\/:*?"<>|#\n]/g, '-').trim().slice(0, 60) || 'nota'
      let name = base
      for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})`
      used.add(name.toLowerCase())
      const front = [
        '---',
        `criada: ${n.createdAt}`,
        `editada: ${n.updatedAt}`,
        n.tags.length ? `tags: [${n.tags.join(', ')}]` : null,
        n.pinned ? 'fixada: true' : null,
        '---',
        '',
      ].filter((l) => l !== null).join('\n')
      return { name: `${name}.md`, content: front + (n.title ? `# ${n.title}\n\n` : '') + n.content + '\n', date: new Date(n.updatedAt) }
    })
    download(`grafite-notas-${stamp()}.zip`, makeZip(files), 'application/zip')
    showToast(`${files.length} notas em markdown (Vault fica de fora)`)
  }

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Note[]
      if (!Array.isArray(parsed)) throw new Error('formato')
      const valid = parsed.filter((n) => n && typeof n.id === 'string' && typeof n.content === 'string')
      // Importação não sobrescreve notas mais novas que já estejam no aparelho
      let count = 0
      for (const n of valid) {
        const local = await db.notes.get(n.id)
        if (local && local.updatedAt >= n.updatedAt) continue
        const now = new Date().toISOString()
        // Notas do Vault chegam cifradas (`cipher`) e continuam assim
        const defaults: Note = {
          id: n.id, content: n.content, title: null, tags: [], pinned: false, inVault: !!n.cipher,
          attachments: {}, createdAt: now, updatedAt: now,
        }
        await db.notes.put({ ...defaults, ...(n as Partial<Note>), dirty: 1 })
        count++
      }
      showToast(`${count} notas importadas`)
      void syncNow()
    } catch {
      showToast('Arquivo inválido — use um export do Grafite Notas')
    }
  }

  const connected = server?.authenticated
  const total = notes?.length ?? 0

  return (
    <main style={{ minHeight: '100dvh', paddingBottom: 88 }}>
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
        {/* 1. Sincronização */}
        <Section title="Sincronização" icon={Cloud}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              className="noise-card rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
            >
              <div className="flex flex-col gap-1" style={{ minWidth: 0 }}>
                <span className="font-sans font-semibold" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {total} {total === 1 ? 'nota' : 'notas'} no aparelho
                </span>
                <div className="flex items-center gap-1.5">
                  <SyncIndicator />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {SYNC_LABELS[syncStatus]}
                    {syncStatus === 'ok' && lastSync ? ` · ${whenText(lastSync)}` : ''}
                  </span>
                </div>
                {syncStatus === 'error' && syncError && (
                  <span style={{ fontSize: 12, color: 'var(--danger)', lineHeight: '17px' }}>{syncError}</span>
                )}
                {syncStatus !== 'ok' && lastSync && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>último sync com sucesso: {whenText(lastSync)}</span>
                )}
              </div>
              {connected && (
                <button
                  onClick={manualSync}
                  disabled={syncStatus === 'syncing'}
                  className="touch-feedback px-3 py-1.5 rounded-lg font-sans font-medium flex-shrink-0"
                  style={{
                    background: 'var(--accent-amber-soft)',
                    color: 'var(--accent-amber)',
                    border: '1px solid rgba(var(--accent-rgb), 0.2)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Sincronizar
                </button>
              )}
            </div>
          </div>

          {serverError ? (
            <p className="px-5 py-4 font-sans" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Sem conexão com o servidor. Suas notas continuam salvas no aparelho.
            </p>
          ) : server && !server.configured ? (
            <p className="px-5 py-4 font-sans" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '20px' }}>
              O servidor ainda não foi configurado: faltam <code>MONGODB_URI</code> e <code>APP_PASSWORD</code> nas variáveis de ambiente.
            </p>
          ) : server && !connected ? (
            <form
              onSubmit={(e) => { e.preventDefault(); void login() }}
              className="flex gap-2 px-5 py-4"
            >
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="senha do app"
                className="flex-1 amber-caret font-sans"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  caretColor: 'var(--accent-amber)',
                  minWidth: 0,
                }}
              />
              <button
                type="submit"
                disabled={loggingIn || !password}
                className="touch-feedback rounded-xl px-4 font-sans"
                style={{
                  background: 'var(--accent-amber)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: 'pointer', opacity: loggingIn || !password ? 0.6 : 1,
                }}
              >
                {loggingIn ? '...' : 'Entrar'}
              </button>
            </form>
          ) : connected ? (
            <>
              <PasswordChange kind="app" />
              <Row label="Sair deste aparelho" onClick={logout} />
            </>
          ) : null}
        </Section>

        {/* 2. Aparência */}
        <Section title="Aparência" icon={Palette}>
          <ThemePicker />
          <Row label="Reduzir movimento">
            <Toggle value={reducedMotion} onChange={setReducedMotion} />
          </Row>
          <Row label="Efeitos de partícula">
            <Toggle value={particleEffects} onChange={setParticleEffects} />
          </Row>
          <Row label="Fundo de galáxia no PC">
            <Toggle value={galaxy} onChange={(v) => { setGalaxyOn(v); setGalaxy(v) }} />
          </Row>
        </Section>

        <Section title="Conexões" icon={Waypoints}>
          <Row label="Guardar ligações dentro do texto">
            <Toggle value={linksInText} onChange={(v) => { setLinksInText(v); setLinksInTextState(v) }} />
          </Row>
          <p className="px-5 py-3 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '18px' }}>
            {linksInText
              ? 'O “ligar” escreve [[Título]] na linha “Relacionadas:” no fim da nota.'
              : 'O “ligar” guarda a ligação fora do texto: aparece em “Ligada a” e no grafo, mas não entra no conteúdo — copiar a nota não leva os links. Em cada nota dá para mover as ligações para dentro ou para fora.'}
          </p>
        </Section>

        {/* 3. IA */}
        <Section title="Inteligência Artificial" icon={Sparkles}>
          <Row label="Provedor" value="Google Gemini (grátis)" />
          <ModelPicker />
          <AIUsage connected={!!connected} />
          <Row
            label="Status"
            value={!server ? '...' : !server.ai ? 'falta a chave' : connected ? 'pronta' : 'entre com a senha'}
          />
          <Row label="Assistente envia sozinho quando eu paro de falar">
            <Toggle value={voiceAutoSend} onChange={(v) => { setVoiceAutoSend(v); setVoiceAutoSendState(v) }} />
          </Row>
          <Link href="/assistant">
            <Row label="Abrir o assistente" onClick={() => {}} />
          </Link>
          <p className="px-5 py-3 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '18px' }}>
            Notas do Vault nunca são enviadas para a IA. No plano gratuito o Google pode usar o conteúdo enviado para melhorar os modelos.
          </p>
        </Section>

        <Section title="Voz" icon={Mic}>
          <VoiceSettings />
        </Section>

        <Section title="Lembretes" icon={Bell}>
          <ReminderSettings connected={!!connected} />
        </Section>

        <Section title="Agenda do celular" icon={CalendarDays}>
          <CalendarLink connected={!!connected} />
        </Section>

        <Section title="Vault e Privacidade" icon={Lock}>
          <Row label="Vault" value={vaultLocked ? 'trancado' : 'aberto'} onClick={() => router.push('/vault')} />
          <PasswordChange kind="vault" />
          <Row label="Esquecer histórico de busca" danger onClick={() => { clearRecentSearches(); showToast('Histórico apagado') }} />
        </Section>

        {/* 5. Backup */}
        <div id="backup" style={{ scrollMarginTop: 72 }}>
        <Section title="Backup" icon={HardDriveDownload}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="font-sans" style={{ fontSize: 13, color: backupStale ? 'var(--warning)' : 'var(--text-secondary)' }}>
              Último backup em arquivo: {lastBackup ? whenText(lastBackup) : 'nunca'}
            </p>
            <p className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '17px' }}>
              Guarde fora do Atlas: no Google Drive ou e-mail ({shareable ? 'use “Enviar backup”' : 'baixe e envie'}), e de vez em quando numa pasta do PC que vá para o OneDrive. As notas do Vault vão cifradas.
            </p>
          </div>
          {shareable && <Row label="Enviar backup (Drive, e-mail...)" onClick={() => void exportAll(true)} />}
          <Row label="Baixar backup (.json)" onClick={() => void exportAll(false)} />
          <Row label="Exportar em Markdown (.zip)" onClick={exportMarkdown} />
          <Row label="Restaurar de um backup" onClick={() => importRef.current?.click()} />
          <ServerBackups connected={!!connected} />
        </Section>
        </div>

        <Section title="Sobre o app" icon={Info}>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = '' }}
          />
          <Row label="Neste aparelho" value={`${APP_VERSION} · ${whenText(APP_BUILT_AT)}`} />
          <Row
            label="No ar"
            value={!live?.version ? '...' : `${live.version} · ${whenText(live.builtAt)}`}
          />
          {live?.version && live.version !== APP_VERSION ? (
            <Row label="Há uma versão nova — atualizar" onClick={checkUpdate} />
          ) : (
            <p className="px-5 py-3 font-sans" style={{ fontSize: 12, color: live?.version ? 'var(--success)' : 'var(--text-muted)' }}>
              {live?.version ? '✓ você está na versão mais nova' : 'conferindo a versão no ar...'}
            </p>
          )}
          <Row label="Procurar atualização" onClick={checkUpdate} />
        </Section>
      </div>

      <BottomNav />
    </main>
  )
}
