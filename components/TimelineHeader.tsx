'use client'
import { useState } from 'react'
import { Search } from 'lucide-react'
import SyncIndicator from './SyncIndicator'
import Link from 'next/link'

interface Props {
  onSearchFocus?: () => void
  showSearch?: boolean
}

export default function TimelineHeader({ onSearchFocus, showSearch = true }: Props) {
  const [searchValue, setSearchValue] = useState('')

  return (
    <div
      className="sticky top-0 z-40"
      style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 pt-safe"
        style={{ height: 56, paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
      >
        <span
          className="font-sans font-semibold tracking-tight"
          style={{ fontSize: 18, color: 'var(--text-primary)' }}
        >
          Grafi
          <span style={{ color: 'var(--accent-amber)' }}>t</span>
          e
        </span>

        <div className="flex items-center gap-3">
          <SyncIndicator />
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--accent-amber)',
              fontSize: 13,
            }}
          >
            W
          </div>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 pb-3">
          <Link href="/search" className="block">
            <div
              className="flex items-center gap-2 rounded-xl px-4"
              style={{
                height: 40,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <span
                className="font-serif italic"
                style={{ color: 'var(--text-muted)', fontSize: 14 }}
              >
                o que você está procurando?
              </span>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}

interface MinimalHeaderProps {
  title?: string
  onBack?: () => void
  rightSlot?: React.ReactNode
}

export function MinimalHeader({ title, onBack, rightSlot }: MinimalHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-4 sticky top-0 z-40"
      style={{
        height: 48,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <button
        onClick={onBack}
        className="touch-feedback flex items-center gap-1.5 py-2"
        style={{ color: 'var(--accent-amber)', fontSize: 14, fontWeight: 500 }}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M7 1L1 7L7 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {title && <span>{title}</span>}
      </button>
      {rightSlot && <div>{rightSlot}</div>}
    </div>
  )
}
