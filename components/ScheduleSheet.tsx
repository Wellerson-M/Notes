'use client'
import { useState } from 'react'
import { CalendarPlus, X } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { icsCalendar, icsEvent, quickDates, scheduleLabel, todayKey, type Schedule } from '@/lib/schedule'
import { noteHref } from '@/lib/routes'
import type { Note } from '@/lib/types'

const fieldStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: 15,
  outline: 'none',
  width: '100%',
}

/**
 * Leva um evento para a agenda do celular. No Android, o menu "compartilhar" com o arquivo .ics
 * oferece a Agenda Samsung / Google Agenda; sem compartilhamento de arquivos, baixa o .ics
 * (abrir o download também importa).
 */
export async function downloadIcs(note: Pick<Note, 'id' | 'title' | 'content' | 'updatedAt'> & { schedule: Schedule }) {
  const ics = icsCalendar([icsEvent(note, `${location.origin}${noteHref(note.id)}`)])
  const name = `${(note.title || 'nota').replace(/[\\/:*?"<>|]/g, '-').slice(0, 50)}.ics`
  const file = new File([ics], name, { type: 'text/calendar' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: note.title ?? 'Nota' })
      return
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return // a pessoa fechou o menu
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Escolher quando a nota "acontece": atalhos, data e hora livres, tirar da agenda */
export default function ScheduleSheet({ value, onChange, onClose, onExport }: {
  value?: Schedule
  onChange: (next: Schedule | undefined) => void
  onClose: () => void
  onExport: () => void
}) {
  const [date, setDate] = useState(value?.date ?? todayKey())
  const [time, setTime] = useState(value?.time ?? '')
  const quick = quickDates()

  const save = (d = date, t = time) => onChange({ date: d, ...(t ? { time: t } : {}) })

  return (
    <BottomSheet title={value ? `Agenda · ${scheduleLabel(value)}` : 'Agendar'} onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => setDate(q.date)}
              className="touch-feedback rounded-full px-3 py-1.5 font-sans"
              style={{
                fontSize: 13, cursor: 'pointer',
                background: date === q.date ? 'var(--accent-amber)' : 'var(--bg-elevated)',
                color: date === q.date ? 'var(--on-accent)' : 'var(--text-secondary)',
                border: `1px solid ${date === q.date ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
              }}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <label className="flex flex-col gap-1.5 flex-1 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Dia
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ ...fieldStyle, colorScheme: 'inherit' }} />
          </label>
          <label className="flex flex-col gap-1.5 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', width: 130 }}>
            Hora (opcional)
            <div className="flex items-center gap-1">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...fieldStyle, colorScheme: 'inherit' }} />
              {time && (
                <button onClick={() => setTime('')} aria-label="Sem hora" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <X size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          </label>
        </div>

        <button
          onClick={() => save()}
          className="touch-feedback rounded-xl py-3 font-sans"
          style={{ background: 'var(--accent-amber)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          {value ? 'Salvar data' : 'Agendar'}
        </button>

        {value && (
          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="touch-feedback flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 font-sans"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 13, border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
            >
              <CalendarPlus size={14} /> Agenda do celular
            </button>
            <button
              onClick={() => onChange(undefined)}
              className="touch-feedback flex-1 rounded-xl py-2.5 font-sans"
              style={{ background: 'transparent', color: 'var(--danger)', fontSize: 13, border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
            >
              Tirar da agenda
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
