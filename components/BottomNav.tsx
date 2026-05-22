'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Clock, Lock, Settings } from 'lucide-react'
import { useUIStore } from '@/store/ui'

const tabs = [
  { id: 'timeline', href: '/', label: 'Notas', Icon: Clock },
  { id: 'journal', href: '/journal', label: 'Diário', Icon: BookOpen },
  { id: 'vault', href: '/vault', label: 'Vault', Icon: Lock },
  { id: 'settings', href: '/settings', label: 'Config', Icon: Settings },
] as const

export default function BottomNav() {
  const pathname = usePathname()
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around pb-safe"
      style={{
        height: 64,
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border-subtle)',
        zIndex: 50,
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
      }}
    >
      {tabs.map(({ id, href, label, Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={id}
            href={href}
            onClick={() => setActiveTab(id)}
            className="touch-feedback flex flex-col items-center gap-0.5 px-4 py-1"
            style={{ minWidth: 60 }}
          >
            <Icon
              size={20}
              style={{ color: active ? 'var(--accent-amber)' : 'var(--text-muted)' }}
              strokeWidth={active ? 2.5 : 1.8}
            />
            {active && (
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--accent-amber)',
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                {label}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
