'use client'
import { Note } from '@/mocks/notes'

interface Props {
  notes: Note[]
  year: number
  month: number // 0-indexed
  selectedDay?: number
  onSelectDay?: (day: number) => void
}

export default function HeatmapCalendar({ notes, year, month, selectedDay, onSelectDay }: Props) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  // Count notes per day
  const countByDay: Record<number, number> = {}
  notes.forEach((n) => {
    const d = new Date(n.createdAt)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      countByDay[day] = (countByDay[day] || 0) + 1
    }
  })

  const maxCount = Math.max(...Object.values(countByDay), 1)

  const today = new Date('2026-05-21')
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  const getIntensity = (day: number) => {
    const count = countByDay[day] || 0
    if (count === 0) return 0
    return Math.min(1, count / maxCount)
  }

  const getCellColor = (intensity: number) => {
    if (intensity === 0) return 'var(--bg-elevated)'
    const alpha = 0.2 + intensity * 0.7
    return `rgba(232, 165, 71, ${alpha})`
  }

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  // Build grid (offset + days)
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div>
      {/* Week day labels */}
      <div className="grid grid-cols-7 mb-1 px-1">
        {weekDays.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontSize: 10,
              color: 'var(--text-muted)',
              fontWeight: 600,
              paddingBottom: 4,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 px-1">
        {cells.map((day, i) => (
          <button
            key={i}
            onClick={() => day && onSelectDay?.(day)}
            disabled={!day}
            style={{
              aspectRatio: '1',
              borderRadius: 6,
              border: day && isToday(day) ? '1.5px solid var(--accent-amber)' : '1px solid transparent',
              background: day ? getCellColor(getIntensity(day)) : 'transparent',
              cursor: day ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: day && selectedDay === day ? 700 : 400,
              color: day
                ? countByDay[day]
                  ? 'var(--text-primary)'
                  : 'var(--text-muted)'
                : 'transparent',
              transition: 'background 0.15s',
              outline: day && selectedDay === day ? '2px solid var(--accent-amber)' : 'none',
              outlineOffset: 1,
            }}
          >
            {day || ''}
          </button>
        ))}
      </div>
    </div>
  )
}
