import 'server-only'
import { createECDH, createHmac, randomUUID } from 'node:crypto'
import webpush from 'web-push'
import { mongoDb, notesCollection } from './mongo'
import {
  DEFAULT_REMINDERS, MAX_OFFSET, effectiveOffsets, reminderWhen, zonedDateKey, zonedToUtc,
  type ReminderSettings,
} from './reminders'
import type { Schedule } from './schedule'

/**
 * Lembretes por notificação (Web Push). Quem dispara é o servidor: um "relógio" externo
 * (cron-job.org) chama /api/push/tick a cada minuto, e cada sync também confere de carona.
 * Cada aviso enviado fica registrado em `push_sent` — chamadas repetidas nunca avisam duas vezes.
 */

export type PushSub = { _id: string; keys: { p256dh: string; auth: string }; createdAt: number; ua?: string }
type Meta = ReminderSettings & { _id: 'settings'; lastTick?: number; lastTickSource?: string }
type Snooze = { _id: string; title: string; body: string; url: string; tag: string; fireAt: number }
export type PushPayload = { title: string; body: string; url: string; tag: string; noteId?: string }

/** Atraso máximo aceito para um aviso (relógio atrasado ainda avisa; mais que isso, perdeu a graça) */
const GRACE_MS = 45 * 60_000
const SUBJECT = 'https://github.com/Wellerson-M/Notes'

// ── Chaves VAPID derivadas da APP_PASSWORD: nenhuma variável nova; trocar a senha troca as chaves
let vapidCache: { password: string; publicKey: string; privateKey: string } | null = null

export function vapidKeys(): { publicKey: string; privateKey: string } | null {
  const password = process.env.APP_PASSWORD
  if (!password) return null
  if (vapidCache?.password === password) return vapidCache
  for (let i = 0; ; i++) {
    // Uma chave P-256 válida é qualquer número < n; a chance de precisar de outra volta é ~1e-10
    const priv = createHmac('sha256', password).update(`grafite-vapid-v1:${i}`).digest()
    try {
      const ecdh = createECDH('prime256v1')
      ecdh.setPrivateKey(priv)
      vapidCache = { password, publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: priv.toString('base64url') }
      return vapidCache
    } catch { /* tenta o próximo */ }
  }
}

/** Chave do link do "relógio" (cron): derivada da senha, como a do feed da agenda */
export function cronToken(): string | null {
  const password = process.env.APP_PASSWORD
  if (!password) return null
  return createHmac('sha256', password).update('grafite-cron-v1').digest('hex').slice(0, 32)
}

// ── Coleções ────────────────────────────────────────────────────────────
let indexed: Promise<unknown> | undefined

async function cols() {
  const db = await mongoDb()
  const sent = db.collection<{ _id: string; at: Date }>('push_sent')
  indexed ??= sent.createIndex({ at: 1 }, { expireAfterSeconds: 14 * 86400 }).catch(() => { indexed = undefined })
  await indexed
  return {
    subs: db.collection<PushSub>('push_subs'),
    meta: db.collection<Meta>('push_meta'),
    sent,
    snoozes: db.collection<Snooze>('push_snooze'),
  }
}

export async function getReminderSettings(): Promise<ReminderSettings & { lastTick?: number; lastTickSource?: string }> {
  const { meta } = await cols()
  const doc = await meta.findOne({ _id: 'settings' })
  const { _id: _ignored, ...rest } = doc ?? { _id: 'settings' }
  return { ...DEFAULT_REMINDERS, ...rest }
}

export async function saveReminderSettings(patch: Partial<ReminderSettings>) {
  const { meta } = await cols()
  await meta.updateOne({ _id: 'settings' }, { $set: patch }, { upsert: true })
}

export async function addSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, ua?: string) {
  const { subs } = await cols()
  await subs.updateOne(
    { _id: sub.endpoint },
    { $set: { keys: sub.keys, ua: ua?.slice(0, 200) }, $setOnInsert: { createdAt: Date.now() } },
    { upsert: true },
  )
}

export async function removeSubscription(endpoint: string) {
  const { subs } = await cols()
  await subs.deleteOne({ _id: endpoint })
}

export async function countSubscriptions() {
  const { subs } = await cols()
  return subs.countDocuments()
}

export async function hasSubscription(endpoint: string) {
  const { subs } = await cols()
  return !!(await subs.findOne({ _id: endpoint }, { projection: { _id: 1 } }))
}

/** Manda para todos os aparelhos inscritos (ou só um); inscrições vencidas são apagadas */
export async function sendToAll(payload: PushPayload, only?: string): Promise<number> {
  const keys = vapidKeys()
  if (!keys) return 0
  const { subs } = await cols()
  const list = await subs.find(only ? { _id: only } : {}).toArray()
  const results = await Promise.all(list.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s._id, keys: s.keys }, JSON.stringify(payload), {
        vapidDetails: { subject: SUBJECT, ...keys },
        TTL: 3600,
        urgency: 'high',
      })
      return true
    } catch (err) {
      const { statusCode: status, body } = err as { statusCode?: number; body?: string }
      console.error('[push]', status, body?.slice(0, 200) ?? (err as Error).message)
      // 404/410 = o aparelho cancelou a inscrição (desinstalou, limpou os dados): não adianta insistir
      if (status === 404 || status === 410) await subs.deleteOne({ _id: s._id })
      return false
    }
  }))
  return results.filter(Boolean).length
}

type ScheduledNote = { _id: string; title: string | null; content: string; inVault?: boolean; schedule: Schedule }

function firstLine(text: string, max = 90): string {
  const line = text.split('\n').map((l) => l.replace(/^[#>\-*\s]+|\[[ xX]\]\s*/g, '').trim()).find(Boolean) ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function payloadFor(n: ScheduledNote, offset: number): PushPayload {
  const url = `/note?id=${encodeURIComponent(n._id)}`
  const when = reminderWhen(offset, n.schedule)
  if (n.inVault) return { title: 'Lembrete do Vault', body: `${when} · abra o app para ver`, url, tag: n._id, noteId: n._id }
  const title = n.title?.trim() || firstLine(n.content, 60) || 'Lembrete'
  const extra = n.title?.trim() ? firstLine(n.content) : ''
  return { title, body: extra ? `${when}\n${extra}` : when, url, tag: n._id, noteId: n._id }
}

/**
 * Confere o que está na hora de avisar e manda. Chamado pelo cron e de carona pelo sync.
 * Com `minGapMs`, não faz nada se outra conferência rodou há pouco.
 */
export async function runReminders(source: string, minGapMs = 0): Promise<{ sent: number; notes?: string[]; skipped?: boolean }> {
  const now = Date.now()
  const c = await cols()
  const settings = await getReminderSettings()
  if (minGapMs && settings.lastTick && now - settings.lastTick < minGapMs) return { sent: 0, skipped: true }
  await c.meta.updateOne({ _id: 'settings' }, { $set: { lastTick: now, lastTickSource: source } }, { upsert: true })
  if (!(await c.subs.estimatedDocumentCount())) return { sent: 0 }

  const { tz } = settings
  const notes = await (await notesCollection())
    .find({
      deleted: { $ne: true },
      'schedule.date': { $gte: zonedDateKey(now - 86400000, tz), $lte: zonedDateKey(now + (MAX_OFFSET + 1440) * 60000, tz) },
    })
    .project<ScheduledNote>({ title: 1, content: 1, inVault: 1, schedule: 1 })
    .toArray()

  const today = zonedDateKey(now, tz)
  const due: { key: string; payload: PushPayload }[] = []
  for (const n of notes) {
    const s = n.schedule
    const base = zonedToUtc(s.date, s.time ?? settings.allDayTime, tz)
    // O compromisso já passou: não adianta avisar
    if (s.time ? now > base + 10 * 60_000 : s.date < today) continue
    for (const offset of effectiveOffsets(s, settings)) {
      const fireAt = base - offset * 60_000
      if (fireAt > now || fireAt < now - GRACE_MS) continue
      due.push({ key: `${n._id}|${s.date}|${s.time ?? ''}|${offset}`, payload: payloadFor(n, offset) })
    }
  }

  let sent = 0
  const sentNotes: string[] = []
  for (const d of due) {
    // Reserva o aviso antes de mandar: duas conferências ao mesmo tempo não avisam em dobro
    const claimed = await c.sent.insertOne({ _id: d.key, at: new Date() }).then(() => true, () => false)
    if (claimed && (await sendToAll(d.payload))) { sent++; sentNotes.push(d.payload.tag) }
  }

  for (const z of await c.snoozes.find({ fireAt: { $lte: now } }).toArray()) {
    const { deletedCount } = await c.snoozes.deleteOne({ _id: z._id })
    if (deletedCount) sent += (await sendToAll({ title: z.title, body: z.body, url: z.url, tag: z.tag })) ? 1 : 0
  }
  // Só os ids (o log do serviço de cron não deve ver o conteúdo)
  return { sent, notes: sentNotes }
}

/** "Adiar": guarda o aviso para mandar de novo daqui a alguns minutos */
export async function snooze(p: { title: string; body: string; url: string; tag: string }, minutes: number) {
  const { snoozes } = await cols()
  await snoozes.insertOne({ _id: randomUUID(), ...p, fireAt: Date.now() + minutes * 60_000 })
}
