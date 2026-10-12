import type { Schedule } from './schedule'

/**
 * Lembretes: cada aviso é "X minutos antes" do momento da nota. Com hora, o momento é a hora;
 * no dia todo, é o horário escolhido nos Ajustes (padrão 9h) do próprio dia.
 * `schedule.remind` ausente = usa o padrão; `[]` = sem aviso.
 */

export type ReminderSettings = {
  /** Avisos padrão de notas com hora (minutos antes) */
  timed: number[]
  /** Avisos padrão de notas do dia todo (minutos antes do horário abaixo) */
  allDay: number[]
  /** Horário de referência das notas do dia todo (HH:MM) */
  allDayTime: string
  /** Fuso do aparelho que configurou (as datas das notas são "de parede") */
  tz: string
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  timed: [15],
  allDay: [0],
  allDayTime: '09:00',
  tz: 'America/Sao_Paulo',
}

export const TIMED_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 1440]
export const ALL_DAY_OPTIONS = [0, 1440, 2880, 10080]

/** Maior antecedência possível: o servidor só olha notas até esse ponto à frente */
export const MAX_OFFSET = 10080

export function offsetLabel(min: number, allDay = false): string {
  if (allDay) {
    if (min === 0) return 'no dia'
    if (min === 1440) return '1 dia antes'
    if (min === 10080) return '1 semana antes'
    return `${Math.round(min / 1440)} dias antes`
  }
  if (min === 0) return 'na hora'
  if (min < 60) return `${min} min antes`
  if (min === 1440) return '1 dia antes'
  if (min % 1440 === 0) return `${min / 1440} dias antes`
  return `${min / 60} h antes`
}

/** Avisos que valem para esta data (os da nota ou o padrão) */
export function effectiveOffsets(s: Schedule, settings: Pick<ReminderSettings, 'timed' | 'allDay'>): number[] {
  if (s.remind) return s.remind
  return s.time ? settings.timed : settings.allDay
}

/** "15 min antes", "na hora e 1 dia antes", "sem aviso" */
export function remindSummary(offsets: number[], allDay: boolean): string {
  if (!offsets.length) return 'sem aviso'
  const labels = [...offsets].sort((a, b) => a - b).map((o) => offsetLabel(o, allDay))
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} e ${labels.at(-1)}`
}

// ── Fuso: as datas das notas são de parede; o servidor converte no fuso do aparelho ─────────

/** Quantos ms o fuso está à frente do UTC naquele instante */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/** "2026-10-20" + "09:30" no fuso → instante em ms */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  let utc = wall - tzOffsetMs(wall, tz)
  utc = wall - tzOffsetMs(utc, tz) // segunda passada acerta a virada de horário de verão
  return utc
}

/** Data de parede (AAAA-MM-DD) de um instante no fuso */
export function zonedDateKey(utcMs: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(utcMs))
}

export function isValidTz(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

export function cleanOffsets(v: unknown, allowed: number[]): number[] | null {
  if (!Array.isArray(v) || v.length > 6) return null
  const out = [...new Set(v.filter((x): x is number => typeof x === 'number' && allowed.includes(x)))]
  return out.length === v.length ? out.sort((a, b) => a - b) : null
}

/** Texto do aviso: "daqui a 15 min · 14:30", "agora · 14:30", "amanhã · dia todo" */
export function reminderWhen(offset: number, s: Schedule): string {
  if (!s.time) {
    if (offset === 0) return 'hoje'
    if (offset === 1440) return 'amanhã'
    return `em ${Math.round(offset / 1440)} dias`
  }
  const at = s.time.replace(/^0/, '')
  if (offset === 0) return `agora · ${at}`
  if (offset < 60) return `daqui a ${offset} min · ${at}`
  if (offset < 1440) return `daqui a ${offset / 60} h · ${at}`
  return offset === 1440 ? `amanhã às ${at}` : `em ${offset / 1440} dias, às ${at}`
}
