import type { Note } from './types'

/** Agenda: datas sempre como texto local (AAAA-MM-DD / HH:MM), sem fuso — "dia 20 às 9h" é o que a pessoa disse */

export type Schedule = NonNullable<Note['schedule']>

const pad = (n: number) => String(n).padStart(2, '0')

/** Data local do aparelho como AAAA-MM-DD */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const todayKey = () => dateKey(new Date())

/** Momento para ordenar: dia + hora (sem hora = começo do dia, antes dos com hora) */
export const sortValue = (s: Schedule) => `${s.date} ${s.time ?? '00:00'}`

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** "hoje", "amanhã", "sexta", "ter, 20 de out" */
export function dayLabel(key: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = parseKey(key)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff === -1) return 'ontem'
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()]
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
}

export function scheduleLabel(s: Schedule): string {
  return s.time ? `${dayLabel(s.date)} às ${s.time.replace(/^0/, '')}` : dayLabel(s.date)
}

/** Já passou? Com hora, compara até o minuto; o dia todo só passa quando o dia acaba. */
export function isPast(s: Schedule): boolean {
  if (!s.time) return s.date < todayKey()
  return sortValue(s) < `${todayKey()} ${new Date().toTimeString().slice(0, 5)}`
}

/** Atalhos do seletor de data */
export function quickDates(): { label: string; date: string }[] {
  const now = new Date()
  const toWeekday = (target: number) => addDays(now, ((target - now.getDay() + 7) % 7) || 7)
  return [
    { label: 'Hoje', date: dateKey(now) },
    { label: 'Amanhã', date: dateKey(addDays(now, 1)) },
    { label: 'Sábado', date: dateKey(toWeekday(6)) },
    { label: 'Segunda', date: dateKey(toWeekday(1)) },
    { label: 'Em 1 semana', date: dateKey(addDays(now, 7)) },
  ]
}

// ── iCalendar (.ics) ───────────────────────────────────────────────────
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Quebra linhas longas como manda a RFC 5545 (75 bytes) */
function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (new TextEncoder().encode(rest).length > 73) {
    let cut = 73
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 73) cut--
    out.push(rest.slice(0, cut))
    rest = ' ' + rest.slice(cut)
  }
  out.push(rest)
  return out.join('\r\n')
}

const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '')

/** Evento de uma nota. Com hora: 30 min no horário local ("flutuante"); sem hora: o dia todo. */
export function icsEvent(note: Pick<Note, 'id' | 'title' | 'content' | 'updatedAt'> & { schedule: Schedule }, url?: string): string[] {
  const { date, time } = note.schedule
  const d = date.replace(/-/g, '')
  const lines = [
    'BEGIN:VEVENT',
    `UID:${note.id}@grafite-notas`,
    `DTSTAMP:${stamp(new Date(note.updatedAt).toISOString())}`,
  ]
  if (time) {
    const [h, m] = time.split(':').map(Number)
    const end = new Date(2000, 0, 1, h, m + 30)
    lines.push(`DTSTART:${d}T${pad(h)}${pad(m)}00`, `DTEND:${d}T${pad(end.getHours())}${pad(end.getMinutes())}00`)
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(note.title ?? 'Nota')}`, 'TRIGGER:-PT15M', 'END:VALARM')
  } else {
    const next = dateKey(addDays(parseKey(date), 1)).replace(/-/g, '')
    lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`)
  }
  lines.push(`SUMMARY:${icsEscape(note.title?.trim() || note.content.trim().split('\n')[0].slice(0, 60) || 'Nota')}`)
  const desc = note.content.trim().slice(0, 1500)
  if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`)
  if (url) lines.push(`URL:${url}`)
  lines.push('END:VEVENT')
  return lines.map(fold)
}

export function icsCalendar(events: string[][], name = 'Notas'): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grafite Notas//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(name)}`,
    'X-PUBLISHED-TTL:PT1H',
    ...events.flat(),
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
