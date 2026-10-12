import { isAuthenticated, unauthorized } from '@/lib/auth'
import { snooze } from '@/lib/push'

/** "Adiar" na própria notificação (o service worker chama com o cookie de sessão) */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized()
  const b = await request.json().catch(() => null) as { title?: unknown; body?: unknown; url?: unknown; tag?: unknown; minutes?: unknown } | null
  const minutes = typeof b?.minutes === 'number' && b.minutes >= 1 && b.minutes <= 1440 ? b.minutes : 10
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  const url = str(b?.url, 300)
  if (!url.startsWith('/')) return Response.json({ error: 'inválido' }, { status: 400 })
  const body = str(b?.body, 300).replace(/^adiado · /, '')
  await snooze({ title: str(b?.title, 120) || 'Lembrete', body: `adiado · ${body}`, url, tag: str(b?.tag, 100) || 'adiado' }, minutes)
  return Response.json({ ok: true })
}
