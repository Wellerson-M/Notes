'use client'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { THEMES, applyTheme, getTheme, type ThemeId } from '@/lib/theme'

/** Grade de temas com prévia das cores; a troca é instantânea e fica salva neste aparelho */
export default function ThemePicker() {
  const [current, setCurrent] = useState<ThemeId | null>(null)

  useEffect(() => {
    // localStorage só existe no cliente — lido depois da montagem para não divergir do SSR
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(getTheme())
  }, [])

  const choose = (id: ThemeId) => {
    applyTheme(id)
    setCurrent(id)
  }

  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {THEMES.map((t) => {
        const [bg, surface, accent] = t.swatch
        const active = current === t.id
        return (
          <button
            key={t.id}
            onClick={() => choose(t.id)}
            aria-pressed={active}
            className="touch-feedback flex flex-col gap-2 rounded-xl p-2 text-left"
            style={{
              background: 'var(--bg-elevated)',
              border: `1.5px solid ${active ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
            }}
          >
            {/* Miniatura: fundo, um "card" e o botão de destaque */}
            <div className="relative rounded-lg overflow-hidden" style={{ height: 54, background: bg, border: '1px solid rgba(127,127,127,0.18)' }}>
              <div style={{ position: 'absolute', left: 8, right: 26, top: 8, height: 22, borderRadius: 6, background: surface }}>
                <div style={{ margin: '6px 7px', height: 3, width: '55%', borderRadius: 2, background: t.light ? '#00000033' : '#ffffff33' }} />
                <div style={{ margin: '0 7px', height: 3, width: '35%', borderRadius: 2, background: accent }} />
              </div>
              <div style={{ position: 'absolute', right: 7, bottom: 7, width: 15, height: 15, borderRadius: '50%', background: accent }} />
              {active && (
                <div className="flex items-center justify-center" style={{ position: 'absolute', left: 7, bottom: 6, width: 16, height: 16, borderRadius: '50%', background: accent }}>
                  <Check size={11} strokeWidth={3} style={{ color: bg }} />
                </div>
              )}
            </div>
            <div className="px-1">
              <div className="font-sans" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
              <div className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: '15px' }}>{t.description}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
