import { checkCalendarToken } from '@/lib/auth'
import { notesCollection } from '@/lib/mongo'
import { icsCalendar, icsEvent } from '@/lib/schedule'

/**
 * Feed da agenda (iCalendar) para assinar no Google Agenda / Agenda Samsung:
 * todas as notas com data, fora do Vault. Acesso pela chave do link (?k=), sem cookie.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  if (!checkCalendarToken(url.searchParams.get('k'))) return new Response('não autorizado', { status: 401 })

  const col = await notesCollection()
  const notes = await col
    .find({ deleted: { $ne: true }, inVault: { $ne: true }, 'schedule.date': { $exists: true } })
    .project<{ _id: string; title: string | null; content: string; updatedAt: string; schedule: { date: string; time?: string } }>({ title: 1, content: 1, updatedAt: 1, schedule: 1 })
    .toArray()

  const events = notes.map((n) => icsEvent({ id: n._id, title: n.title, content: n.content, updatedAt: n.updatedAt, schedule: n.schedule }, `${url.origin}/note?id=${encodeURIComponent(n._id)}`))
  return new Response(icsCalendar(events, 'Grafite Notas'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="notas.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
