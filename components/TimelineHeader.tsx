'use client'
import { useState } from 'react'
import { Search, Sparkles, Waypoints } from 'lucide-react'
import SyncIndicator from './SyncIndicator'
import GraphView from './GraphView'
import Link from 'next/link'

interface Props {
  showSearch?: boolean
}

export default function TimelineHeader({ showSearch = true }: Props) {
  const [graphOpen, setGraphOpen] = useState(false)

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
          className="font-serif font-semibold tracking-tight"
          style={{ fontSize: 20, color: 'var(--text-primary)' }}
        >
          grafite <span style={{ color: 'var(--accent-amber)' }}>notas</span>
        </span>

        <div className="flex items-center gap-3">
          <SyncIndicator />
          <button
            onClick={() => setGraphOpen(true)}
            aria-label="Grafo de conexões"
            className="touch-feedback"
            style={{ padding: 4, display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Waypoints size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <Link href="/assistant" aria-label="Assistente de IA" className="touch-feedback" style={{ padding: 4, display: 'flex' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-amber)' }} />
          </Link>
          <Link href="/settings">
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
          </Link>
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
      <GraphView open={graphOpen} onClose={() => setGraphOpen(false)} />
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
