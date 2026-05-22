'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import HeatmapCalendar from '@/components/HeatmapCalendar'
import { mockNotes, getRelativeDate } from '@/mocks/notes'
import Link from 'next/link'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WEEK_DAYS_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

function groupByDay(notes: typeof mockNotes, year: number, month: number) {
  const grouped: Record<number, typeof mockNotes> = {}
  notes.forEach((n) => {
    const d = new Date(n.createdAt)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!grouped[day]) grouped[day] = []
      grouped[day].push(n)
    }
  })
  return grouped
}

export default function JournalPage() {
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(4) // maio = index 4
  const [selectedDay, setSelectedDay] = useState<number | undefined>(21) // hoje

  const grouped = groupByDay(mockNotes, year, month)
  const daysWithNotes = Object.keys(grouped).map(Number).sort((a, b) => b - a)

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(undefined)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(undefined)
  }

  const displayNotes = selectedDay && grouped[selectedDay]
    ? grouped[selectedDay]
    : daysWithNotes.flatMap(d => grouped[d] ?? [])

  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100dvh', paddingBottom: 88 }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 pt-safe flex items-center justify-between"
        style={{
          height: 56,
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
        }}
      >
        <button
          onClick={prevMonth}
          className="touch-feedback p-2 rounded-lg"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-sans font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)' }}>
          {MONTH_FULL[month]}. {year}
        </span>
        <button
          onClick={nextMonth}
          className="touch-feedback p-2 rounded-lg"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Heatmap */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <HeatmapCalendar
          notes={mockNotes}
          year={year}
          month={month}
          selectedDay={selectedDay}
          onSelectDay={(d) => setSelectedDay(d === selectedDay ? undefined : d)}
        />
      </div>

      {/* Day groups */}
      <div className="flex flex-col gap-6 px-4 py-4">
        {daysWithNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: 60 }}>
            <p className="font-serif italic" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
              nenhuma nota neste mês
            </p>
          </div>
        ) : (
          (selectedDay && grouped[selectedDay] ? [selectedDay] : daysWithNotes).map((day) => {
            const dayNotes = grouped[day] ?? []
            const date = new Date(year, month, day)
            const weekDay = WEEK_DAYS_FULL[date.getDay()]
            const dayStr = `${weekDay}, ${day} de ${MONTH_FULL[month].toLowerCase()}`

            return (
              <div key={day}>
                {/* Day header */}
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="font-serif font-medium" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
                    {dayStr}
                  </h2>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    ({dayNotes.length} {dayNotes.length === 1 ? 'nota' : 'notas'})
                  </span>
                </div>

                {/* Compact note list */}
                <div className="flex flex-col gap-2">
                  {dayNotes.map((note) => {
                    const time = new Date(note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    const preview = note.content
                      .replace(/^#{1,6}\s+/gm, '')
                      .replace(/\*\*/g, '')
                      .replace(/^[-*]\s+/gm, '')
                      .split('\n')
                      .filter(l => l.trim())
                      .join(' ')
                      .trim()

                    return (
                      <Link href={`/note/${note.id}`} key={note.id}>
                        <div
                          className="touch-feedback noise-card rounded-xl px-4 py-3"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div style={{ minWidth: 0, flex: 1 }}>
                              {note.title && (
                                <div className="font-sans font-medium line-clamp-1" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                  {note.title}
                                </div>
                              )}
                              <div className="font-serif line-clamp-1" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: note.title ? 2 : 0 }}>
                                {preview.slice(0, 80)}
                              </div>
                            </div>
                            <span className="font-sans flex-shrink-0" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{time}</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      <BottomNav />
    </main>
  )
}
