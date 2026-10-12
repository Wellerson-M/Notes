import { calendarToken, isAuthenticated, unauthorized } from '@/lib/auth'

/** Link de assinatura da agenda (só para quem está logado) */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) return unauthorized()
  const token = calendarToken()
  if (!token) return Response.json({ error: 'APP_PASSWORD não configurada' }, { status: 503 })
  const origin = new URL(request.url).origin
  const feed = `${origin}/api/agenda?k=${token}`
  const webcal = feed.replace(/^https?:/, 'webcal:')
  return Response.json({
    feed,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  })
}
