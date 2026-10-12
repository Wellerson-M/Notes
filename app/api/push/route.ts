import { isAuthenticated, unauthorized } from '@/lib/auth'
import { describeDbError } from '@/lib/mongo'
import {
  addSubscription, countSubscriptions, cronToken, getReminderSettings, hasSubscription,
  removeSubscription, saveReminderSettings, vapidKeys,
} from '@/lib/push'
import { ALL_DAY_OPTIONS, TIMED_OPTIONS, cleanOffsets, isValidTz, type ReminderSettings } from '@/lib/reminders'

/** Lembretes: estado (GET), inscrever este aparelho (POST), padrões (PUT), desinscrever (DELETE) */

async function guard(fn: () => Promise<Response>) {
  if (!(await isAuthenticated())) return unauthorized()
  try { return await fn() } catch (err) {
    console.error('[api/push]', err)
    return Response.json({ error: describeDbError(err) }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return guard(async () => {
    const keys = vapidKeys()
    if (!keys) return Response.json({ error: 'APP_PASSWORD não configurada' }, { status: 503 })
    const endpoint = new URL(request.url).searchParams.get('endpoint')
    const settings = await getReminderSettings()
    return Response.json({
      publicKey: keys.publicKey,
      settings,
      devices: await countSubscriptions(),
      subscribed: endpoint ? await hasSubscription(endpoint) : false,
      cronUrl: `${new URL(request.url).origin}/api/push/tick?k=${cronToken()}`,
    })
  })
}

export async function POST(request: Request) {
  return guard(async () => {
    const body = await request.json().catch(() => null) as { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; tz?: unknown } | null
    const s = body?.subscription
    if (typeof s?.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000 ||
      typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') {
      return Response.json({ error: 'inscrição inválida' }, { status: 400 })
    }
    await addSubscription({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, request.headers.get('user-agent') ?? undefined)
    if (isValidTz(body?.tz)) await saveReminderSettings({ tz: body.tz })
    return Response.json({ ok: true })
  })
}

export async function PUT(request: Request) {
  return guard(async () => {
    const body = await request.json().catch(() => null) as Partial<Record<keyof ReminderSettings, unknown>> | null
    const patch: Partial<ReminderSettings> = {}
    if (body?.timed !== undefined) {
      const v = cleanOffsets(body.timed, TIMED_OPTIONS)
      if (!v) return Response.json({ error: 'avisos inválidos' }, { status: 400 })
      patch.timed = v
    }
    if (body?.allDay !== undefined) {
      const v = cleanOffsets(body.allDay, ALL_DAY_OPTIONS)
      if (!v) return Response.json({ error: 'avisos inválidos' }, { status: 400 })
      patch.allDay = v
    }
    if (body?.allDayTime !== undefined) {
      if (typeof body.allDayTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.allDayTime)) return Response.json({ error: 'horário inválido' }, { status: 400 })
      patch.allDayTime = body.allDayTime
    }
    if (body?.tz !== undefined && isValidTz(body.tz)) patch.tz = body.tz
    await saveReminderSettings(patch)
    return Response.json({ settings: await getReminderSettings() })
  })
}

export async function DELETE(request: Request) {
  return guard(async () => {
    const body = await request.json().catch(() => null) as { endpoint?: unknown } | null
    if (typeof body?.endpoint === 'string') await removeSubscription(body.endpoint)
    return Response.json({ ok: true })
  })
}
