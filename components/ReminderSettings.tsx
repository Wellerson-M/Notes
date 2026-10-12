'use client'
import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, Copy, Send } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import ReminderChips from './ReminderChips'
import { ALL_DAY_OPTIONS, TIMED_OPTIONS, type ReminderSettings as Settings } from '@/lib/reminders'
import { disablePush, enablePush, fetchPushStatus, pushSupported, savePushSettings, testPush, type PushStatus } from '@/lib/notify'

const label: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)' }
const ghostButton: React.CSSProperties = {
  background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 13,
  border: '1px solid var(--border-subtle)', cursor: 'pointer',
}

function ago(ms: number, now: number): string {
  const min = Math.round((now - ms) / 60000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  if (min < 1440) return `há ${Math.round(min / 60)} h`
  return `há ${Math.round(min / 1440)} dias`
}

/** Lembretes: ligar as notificações neste aparelho, padrões de aviso e o "relógio" do servidor */
export default function ReminderSettings({ connected }: { connected: boolean }) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loadedAt, setLoadedAt] = useState(0)
  const showToast = useUIStore((s) => s.showToast)

  const load = useCallback(async () => {
    const s = await fetchPushStatus()
    setStatus(s)
    setFailed(!s)
    setLoadedAt(Date.now())
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca do servidor ao abrir
    if (connected) void load()
  }, [connected, load])

  if (!connected) {
    return <p className="px-5 py-3 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Entre com a senha (em Sincronização) para receber lembretes.</p>
  }
  if (!status) {
    return <p className="px-5 py-3 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{failed ? 'Não deu para carregar os lembretes agora.' : 'carregando...'}</p>
  }

  const save = async (patch: Partial<Settings>) => {
    setStatus({ ...status, settings: { ...status.settings, ...patch } })
    const next = await savePushSettings(patch)
    if (!next) showToast('Não deu para salvar agora')
  }

  const toggleDevice = async () => {
    setBusy(true)
    if (status.subscribed) {
      await disablePush()
      showToast('Notificações desligadas neste aparelho')
    } else {
      const err = await enablePush(status.publicKey)
      showToast(err ?? 'Notificações ligadas ✓')
    }
    await load()
    setBusy(false)
  }

  const { settings } = status
  const tickOk = !!settings.lastTick && settings.lastTickSource === 'relógio' && loadedAt - settings.lastTick < 15 * 60_000

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-col gap-2">
        <button
          onClick={() => void toggleDevice()}
          disabled={busy || (!status.subscribed && !pushSupported())}
          className="touch-feedback flex items-center justify-center gap-2 rounded-xl py-3 font-sans"
          style={status.subscribed
            ? { ...ghostButton, fontSize: 14 }
            : { background: 'var(--accent-amber)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          {status.subscribed ? <BellOff size={16} /> : <Bell size={16} />}
          {busy ? 'um instante...' : status.subscribed ? 'Desligar neste aparelho' : 'Ligar notificações neste aparelho'}
        </button>
        {status.subscribed && (
          <button
            onClick={async () => { const ok = await testPush(); showToast(ok ? 'Teste enviado — olhe as notificações' : 'O teste não chegou; tente desligar e ligar de novo') }}
            className="touch-feedback flex items-center justify-center gap-2 rounded-xl py-2.5 font-sans"
            style={ghostButton}
          >
            <Send size={14} /> Mandar uma notificação de teste
          </button>
        )}
        <span className="font-sans" style={label}>
          {!pushSupported() && !status.subscribed
            ? 'Este navegador não recebe notificações. No celular, abra pelo app instalado.'
            : `${status.subscribed ? 'Este aparelho recebe os avisos. ' : ''}${status.devices === 1 ? '1 aparelho ligado' : `${status.devices} aparelhos ligados`}.`}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-sans" style={label}>Aviso padrão das notas com hora</span>
        <ReminderChips options={TIMED_OPTIONS} value={settings.timed} onChange={(timed) => void save({ timed })} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-sans" style={label}>Aviso padrão das notas do dia todo</span>
        <ReminderChips options={ALL_DAY_OPTIONS} value={settings.allDay} onChange={(allDay) => void save({ allDay })} allDay />
        <label className="flex items-center gap-2 font-sans" style={label}>
          avisar às
          <input
            type="time"
            value={settings.allDayTime}
            onChange={(e) => { if (/^\d\d:\d\d$/.test(e.target.value)) void save({ allDayTime: e.target.value }) }}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 14, colorScheme: 'inherit' }}
          />
        </label>
        <span className="font-sans" style={{ ...label, fontSize: 11 }}>
          Nenhum marcado = sem aviso. Cada nota pode trocar o seu (ou desligar) em “agendar”.
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-xl px-3 py-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <span className="font-sans" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
          {tickOk ? '⏱ Relógio dos lembretes funcionando' : '⏱ Falta ligar o relógio dos lembretes'}
        </span>
        <span className="font-sans" style={{ ...label, lineHeight: '17px' }}>
          {settings.lastTick ? `Última conferência ${ago(settings.lastTick, loadedAt)} (${settings.lastTickSource}). ` : ''}
          {tickOk
            ? 'Os avisos saem na hora certa, mesmo com o app fechado.'
            : 'Sem ele, os avisos só saem quando algum aparelho está com o app aberto. Configure uma vez (grátis):'}
        </span>
        {!tickOk && (
          <ol className="font-sans" style={{ ...label, lineHeight: '17px', paddingLeft: 16, listStyle: 'decimal' }}>
            <li>Crie uma conta em <strong>cron-job.org</strong> e toque em “Create cronjob”.</li>
            <li>Em URL, cole o link abaixo; em “Execution schedule”, escolha <strong>Every minute</strong>.</li>
            <li>Salve. Em 1 ou 2 minutos esta caixa muda para “funcionando”.</li>
          </ol>
        )}
        <button
          onClick={async () => { try { await navigator.clipboard.writeText(status.cronUrl); showToast('Link copiado') } catch { showToast(status.cronUrl) } }}
          className="touch-feedback flex items-center justify-center gap-2 rounded-lg py-2 font-sans"
          style={{ ...ghostButton, background: 'var(--bg-surface)' }}
        >
          <Copy size={13} /> Copiar link do relógio
        </button>
      </div>

      <p className="font-sans" style={{ ...label, fontSize: 11, lineHeight: '16px' }}>
        <strong>No relógio (Amazfit/Zepp):</strong> no app Zepp → seu relógio → Notificações de apps → ative “Notas” (ou “Chrome”, se o app não aparecer). Notas do Vault avisam só “Lembrete do Vault”, sem o conteúdo.
      </p>
    </div>
  )
}
