'use client'
import { offsetLabel } from '@/lib/reminders'

/** Escolha de vários avisos ("na hora", "15 min antes"...); nenhum marcado = sem aviso */
export default function ReminderChips({ options, value, onChange, allDay = false }: {
  options: number[]
  value: number[]
  onChange: (next: number[]) => void
  allDay?: boolean
}) {
  const toggle = (o: number) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o].sort((a, b) => a - b))

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            aria-pressed={on}
            className="touch-feedback rounded-full px-3 py-1.5 font-sans"
            style={{
              fontSize: 13, cursor: 'pointer',
              background: on ? 'var(--accent-amber-soft)' : 'var(--bg-elevated)',
              color: on ? 'var(--accent-amber)' : 'var(--text-secondary)',
              border: `1px solid ${on ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
            }}
          >
            {offsetLabel(o, allDay)}
          </button>
        )
      })}
    </div>
  )
}
