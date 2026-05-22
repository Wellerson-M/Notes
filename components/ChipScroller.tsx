'use client'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

export default function ChipScroller({ children, className = '' }: Props) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto ${className}`}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 2,
      }}
    >
      {children}
    </div>
  )
}

interface ChipProps {
  label: string
  active?: boolean
  onClick?: () => void
}

export function Chip({ label, active = false, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className="touch-feedback whitespace-nowrap rounded-full text-xs font-medium px-3 py-1.5 flex-shrink-0 transition-colors"
      style={{
        background: active ? 'var(--accent-amber-soft)' : 'var(--bg-elevated)',
        color: active ? 'var(--accent-amber)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
        fontSize: 12,
      }}
    >
      {label}
    </button>
  )
}
