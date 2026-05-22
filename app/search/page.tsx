'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Tag } from 'lucide-react'
import Link from 'next/link'
import { mockNotes, Note } from '@/mocks/notes'

type Tab = 'texto' | 'semantica' | 'tags' | 'datas'

const RECENT_SEARCHES = ['reunião design', 'pensar rápido', 'receita', 'TypeScript']

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: 'var(--accent-amber-soft)', color: 'var(--accent-amber)', borderRadius: 2 }}>{part}</mark>
      : part
  )
}

function searchNotes(notes: Note[], query: string): (Note & { relevance?: number })[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return notes
    .map((n) => {
      const score =
        (n.title?.toLowerCase().includes(q) ? 3 : 0) +
        (n.content.toLowerCase().includes(q) ? 2 : 0) +
        (n.tags.some((t) => t.toLowerCase().includes(q)) ? 1 : 0)
      return { ...n, relevance: score }
    })
    .filter((n) => n.relevance! > 0)
    .sort((a, b) => b.relevance! - a.relevance!)
}

function getAllTags() {
  const map: Record<string, number> = {}
  mockNotes.forEach((n) => n.tags.forEach((t) => { map[t] = (map[t] || 0) + 1 }))
  return Object.entries(map).sort((a, b) => b[1] - a[1])
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('texto')
  const [results, setResults] = useState<ReturnType<typeof searchNotes>>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    setResults(searchNotes(mockNotes, query))
  }, [query])

  const tags = getAllTags()
  const tabs: { id: Tab; label: string }[] = [
    { id: 'texto', label: 'Texto' },
    { id: 'semantica', label: 'Semântica' },
    { id: 'tags', label: 'Tags' },
    { id: 'datas', label: 'Datas' },
  ]

  const getPreview = (note: Note) =>
    note.content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/^[-*]\s+/gm, '')
      .split('\n')
      .filter((l) => l.trim())
      .join(' ')
      .trim()
      .slice(0, 120)

  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100dvh' }}>
      {/* Search input */}
      <div
        className="sticky top-0 z-40 px-4 pt-safe"
        style={{
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 12,
          paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 flex-1 rounded-xl px-4"
            style={{
              height: 44,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          >
            <Search size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="o que você está procurando?"
              className="flex-1 amber-caret font-serif italic"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 15,
                caretColor: 'var(--accent-amber)',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
          <button
            onClick={() => router.back()}
            style={{ color: 'var(--accent-amber)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            Cancelar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="touch-feedback px-3 py-1.5 rounded-lg font-sans font-medium"
              style={{
                fontSize: 12,
                background: activeTab === tab.id ? 'var(--accent-amber-soft)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-amber)' : 'var(--text-muted)',
                border: `1px solid ${activeTab === tab.id ? 'var(--accent-amber)' : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {!query ? (
          /* Recent searches */
          <div>
            <p className="font-sans font-medium uppercase tracking-widest mb-3" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              Buscas recentes
            </p>
            <div className="flex flex-wrap gap-2">
              {RECENT_SEARCHES.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="touch-feedback rounded-full px-3 py-1.5 font-sans"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : activeTab === 'tags' ? (
          /* Tags tab */
          <div className="flex flex-col gap-2">
            {tags.filter(([t]) => !query || t.includes(query.toLowerCase())).map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setQuery(tag)}
                className="touch-feedback flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
              >
                <div className="flex items-center gap-2">
                  <Tag size={14} style={{ color: 'var(--accent-amber)' }} />
                  <span className="font-sans" style={{ fontSize: 14, color: 'var(--text-primary)' }}>#{tag}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count}</span>
              </button>
            ))}
          </div>
        ) : activeTab === 'datas' ? (
          /* Datas tab */
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-sans" style={{ fontSize: 13, color: 'var(--text-muted)' }}>De</label>
              <input
                type="date"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  colorScheme: 'dark',
                  width: '100%',
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-sans" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Até</label>
              <input
                type="date"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  colorScheme: 'dark',
                  width: '100%',
                }}
              />
            </div>
          </div>
        ) : results.length === 0 ? (
          /* Empty results */
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: 60 }}>
            <span style={{ fontSize: 40, opacity: 0.2 }}>🔍</span>
            <p className="font-serif italic" style={{ color: 'var(--text-muted)', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
              nada por aqui ainda...
            </p>
          </div>
        ) : (
          /* Results */
          <div className="flex flex-col gap-3">
            <p className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {results.length} resultado{results.length > 1 ? 's' : ''}
            </p>
            {results.map((note) => (
              <Link href={`/note/${note.id}`} key={note.id}>
                <div
                  className="touch-feedback noise-card rounded-2xl px-5 py-4"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                >
                  {/* Relevance bar (semantic mode) */}
                  {activeTab === 'semantica' && (
                    <div className="flex items-center gap-2 mb-2">
                      <div style={{ flex: 1, height: 2, background: 'var(--bg-elevated)', borderRadius: 1, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.round((note.relevance! / 5) * 100)}%`,
                            height: '100%',
                            background: 'var(--accent-amber)',
                            borderRadius: 1,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--accent-amber)', flexShrink: 0 }}>
                        {Math.round((note.relevance! / 5) * 100)}% relevante
                      </span>
                    </div>
                  )}

                  {note.title && (
                    <div className="font-sans font-semibold mb-1" style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: '20px' }}>
                      {highlightText(note.title, query)}
                    </div>
                  )}
                  <div className="font-serif line-clamp-2" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '20px' }}>
                    {highlightText(getPreview(note), query)}
                  </div>
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 10,
                            color: 'var(--accent-amber)',
                            background: 'var(--accent-amber-soft)',
                            borderRadius: 20,
                            padding: '1px 7px',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
