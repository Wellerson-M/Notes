'use client'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { THEMES, applyTheme, getTheme, type ThemeId } from '@/lib/theme'

/**
 * Grade de temas. Cada miniatura usa o próprio tema de verdade (data-theme no elemento):
 * fundo, cantos, fonte de título e destaque — o que se vê é o que o app vira.
 */
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
    try { navigator.vibrate?.(8) } catch { /* sem vibração */ }
  }

  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {THEMES.map((t) => {
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
            {/* Miniatura no próprio tema */}
            <div
              data-theme={t.id}
              className="relative overflow-hidden"
              style={{
                height: 84, borderRadius: 10, border: '1px solid rgba(127,127,127,0.2)',
                backgroundColor: 'var(--bg-base)', backgroundImage: 'var(--ambient)', backgroundSize: 'cover',
              }}
            >
              <div
                style={{
                  position: 'absolute', left: 8, right: 8, top: 9, padding: '7px 8px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'calc(var(--card-radius) / 2 + 2px)', boxShadow: 'var(--card-shadow)',
                }}
              >
                <div className="font-title" style={{ fontSize: 11, lineHeight: '13px', color: 'var(--text-primary)' }}>Ideias da semana</div>
                <div className="flex items-center gap-1" style={{ marginTop: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, border: '1px solid var(--border-strong)' }} />
                  <span style={{ height: 3, width: '45%', borderRadius: 2, background: 'var(--text-muted)', opacity: 0.6 }} />
                </div>
                <div style={{ marginTop: 5, height: 3, width: '30%', borderRadius: 2, background: 'var(--accent-amber)' }} />
              </div>
              <div
                className="flex items-center justify-center"
                style={{ position: 'absolute', right: 8, bottom: 7, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-amber)', color: 'var(--on-accent)', fontSize: 12, lineHeight: 1 }}
              >
                {active ? <Check size={11} strokeWidth={3} /> : '+'}
              </div>
              <span style={{ position: 'absolute', left: 9, bottom: 5, fontSize: 14 }}>{t.emoji}</span>
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
