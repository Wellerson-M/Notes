'use client'
import { DEFAULT_REMINDERS, type ReminderSettings } from './reminders'

/** Lado do aparelho dos lembretes: permissão, inscrição no push e padrões guardados */

export type PushStatus = {
  publicKey: string
  settings: ReminderSettings & { lastTick?: number; lastTickSource?: string }
  devices: number
  subscribed: boolean
  cronUrl: string
}

const SETTINGS_KEY = 'grafite-reminders'

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Padrões vistos por último (o editor mostra "padrão: 15 min antes" mesmo offline) */
export function cachedReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_REMINDERS, ...JSON.parse(raw) }
  } catch { /* sem armazenamento */ }
  return DEFAULT_REMINDERS
}

export function cacheReminderSettings(s: ReminderSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ timed: s.timed, allDay: s.allDay, allDayTime: s.allDayTime, tz: s.tz })) } catch { /* ok */ }
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  return (await (await registration())?.pushManager.getSubscription()) ?? null
}

export async function fetchPushStatus(): Promise<PushStatus | null> {
  const sub = await currentSubscription().catch(() => null)
  const q = sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ''
  const res = await fetch(`/api/push${q}`).catch(() => null)
  if (!res?.ok) return null
  const status = (await res.json()) as PushStatus
  cacheReminderSettings(status.settings)
  return status
}

const b64ToBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

/** Pede permissão e inscreve este aparelho. Devolve uma mensagem de erro, ou null se deu certo. */
export async function enablePush(publicKey: string): Promise<string | null> {
  if (!pushSupported()) return 'Este navegador não recebe notificações. No celular, use o app instalado pelo Chrome.'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'As notificações estão bloqueadas. Libere em Configurações do Android → Apps → Grafite Notas (ou Chrome) → Notificações.'
  const reg = await registration()
  if (!reg) return 'O app ainda está se instalando. Feche e abra de novo.'
  // Sempre uma inscrição nova: a antiga pode ter sido recusada pelo serviço de push (o servidor
  // já a esqueceu) ou ser de outra chave (a chave muda quando a senha do app muda)
  await (await reg.pushManager.getSubscription())?.unsubscribe().catch(() => {})
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) })
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  }).catch(() => null)
  return res?.ok ? null : 'Não deu para registrar este aparelho agora.'
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => null)
  await sub.unsubscribe().catch(() => {})
}

export async function testPush(): Promise<boolean> {
  const sub = await currentSubscription()
  const res = await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub?.endpoint }) }).catch(() => null)
  if (!res?.ok) return false
  return ((await res.json()) as { delivered: number }).delivered > 0
}

export async function savePushSettings(patch: Partial<ReminderSettings>): Promise<ReminderSettings | null> {
  const res = await fetch('/api/push', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).catch(() => null)
  if (!res?.ok) return null
  const { settings } = (await res.json()) as { settings: ReminderSettings }
  cacheReminderSettings(settings)
  return settings
}
