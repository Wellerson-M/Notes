'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Tag, Sparkles, Compass } from 'lucide-react'
import Link from 'next/link'
import type { Note } from '@/lib/types'
import { getPreview } from '@/lib/notes'
import { useNotes } from '@/lib/repo'
import { loadRecentSearches, saveRecentSearch } from '@/lib/recent-searches'
import EmptyState from '@/components/EmptyState'
import { noteHref } from '@/lib/routes'
import { AIError, AI_LOGIN_MESSAGE } from '@/lib/ai'
import ConnectInline from '@/components/ConnectInline'
import { ensureEmbeddings, semanticSearch } from '@/lib/semantic'

type Tab = 'texto' | 'sentido' | 'ia' | 'tags' | 'datas'

type Semantic =
  | { status: 'idle' }
  | { status: 'indexing'; done: number; total: number }
  | { status: 'searching' }
  | { status: 'done'; results: { note: Note; score: number }[] }
  | { status: 'error'; message: string }

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: 'var(--accent-amber-soft)', color: 'var(--accent-amber)', borderRadius: 2 }}>{part}</mark>
      : part
  )
}

function searchNotes(notes: Note[], query: string): Note[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return notes
    .map((n) => {
      const score =
        (n.title?.toLowerCase().includes(q) ? 3 : 0) +
        (n.content.toLowerCase().includes(q) ? 2 : 0) +
        (n.tags.some((t) => t.toLowerCase().includes(q)) ? 1 : 0)
      return { n, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.n)
}

function getAllTags(notes: Note[]) {
  const map: Record<string, number> = {}
  notes.forEach((n) => n.tags.forEach((t) => { map[t] = (map[t] || 0) + 1 }))
  return Object.entries(map).sort((a, b) => b[1] - a[1])
}

const dateInputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  colorScheme: 'dark',
  width: '100%',
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('texto')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    // localStorage só existe no cliente — lido depois da montagem para não divergir do SSR
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(loadRecentSearches())
  }, [])

  // Notas do Vault ficam fora da busca
  const allNotes = useNotes()
  const notes = useMemo(() => (allNotes ?? []).filter((n) => !n.inVault), [allNotes])
  const results = useMemo(() => searchNotes(notes, query), [notes, query])
  const tags = useMemo(() => getAllTags(notes), [notes])

  // Busca por sentido: indexa o que falta (só na primeira vez é demorado) e compara vetores
  const [semantic, setSemantic] = useState<Semantic>({ status: 'idle' })
  const notesRef = useRef(notes)
  useEffect(() => { notesRef.current = notes }, [notes])
  useEffect(() => {
    if (activeTab !== 'sentido' || query.trim().length < 3) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        await ensureEmbeddings(notesRef.current, (done, total) => {
          if (!cancelled && total > 0 && done < total) setSemantic({ status: 'indexing', done, total })
        })
        if (cancelled) return
        setSemantic({ status: 'searching' })
        const results = await semanticSearch(query.trim(), notesRef.current)
        if (!cancelled) setSemantic({ status: 'done', results })
      } catch (e) {
        if (!cancelled) setSemantic({ status: 'error', message: e instanceof AIError ? e.message : 'A busca por sentido falhou agora.' })
      }
    }, 700)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [activeTab, query])

  const dateResults = useMemo(() => {
    if (!from && !to) return []
    const start = from ? new Date(from + 'T00:00:00').getTime() : -Infinity
    const end = to ? new Date(to + 'T23:59:59').getTime() : Infinity
    return notes
      .filter((n) => { const t = new Date(n.createdAt).getTime(); return t >= start && t <= end })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [notes, from, to])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'texto', label: 'Texto' },
    { id: 'sentido', label: 'Por sentido' },
    { id: 'ia', label: 'Perguntar à IA' },
    { id: 'tags', label: 'Tags' },
    { id: 'datas', label: 'Datas' },
  ]

  const askAI = () => router.push(`/assistant${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`)

  const renderResult = (note: Note) => (
    <Link href={noteHref(note.id)} key={note.id} onClick={() => saveRecentSearch(query)}>
      <div
        className="touch-feedback noise-card rounded-2xl px-5 py-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        {note.title && (
          <div className="font-sans font-semibold mb-1" style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: '20px' }}>
            {highlightText(note.title, query)}
          </div>
        )}
        <div className="font-serif line-clamp-2" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '20px' }}>
          {highlightText(getPreview(note.content), query)}
        </div>
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{ fontSize: 10, color: 'var(--accent-amber)', background: 'var(--accent-amber-soft)', borderRadius: 20, padding: '1px 7px' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )

  return (
    <main style={{ minHeight: '100dvh' }}>
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
            style={{ height: 44, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
          >
            <Search size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && activeTab === 'ia') askAI() }}
              placeholder={activeTab === 'ia' ? 'pergunte qualquer coisa...' : activeTab === 'sentido' ? 'descreva a ideia, sem precisar da palavra exata' : 'o que você está procurando?'}
              className="flex-1 amber-caret font-serif italic"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 15,
                caretColor: 'var(--accent-amber)',
                minWidth: 0,
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Limpar">
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
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="touch-feedback px-3 py-1.5 rounded-lg font-sans font-medium flex-shrink-0"
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
        {activeTab === 'sentido' ? (
          query.trim().length < 3 ? (
            <p className="font-serif italic pt-4" style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: '24px' }}>
              Encontre notas pelo assunto, mesmo sem a palavra exata — &ldquo;aquela ideia de viagem&rdquo;, &ldquo;coisas sobre saúde&rdquo;.
              Na primeira vez, as notas são indexadas pela IA (o Vault fica de fora).
            </p>
          ) : semantic.status === 'indexing' ? (
            <p className="font-sans pt-4" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              indexando suas notas... {semantic.done}/{semantic.total}
            </p>
          ) : semantic.status === 'searching' || semantic.status === 'idle' ? (
            <p className="font-sans pt-4" style={{ fontSize: 13, color: 'var(--text-muted)' }}>procurando...</p>
          ) : semantic.status === 'error' && semantic.message === AI_LOGIN_MESSAGE ? (
            <div className="pt-4"><ConnectInline /></div>
          ) : semantic.status === 'error' ? (
            <p className="font-sans pt-4" style={{ fontSize: 14, color: 'var(--danger)' }}>{semantic.message}</p>
          ) : semantic.results.length === 0 ? (
            <EmptyState icon={<Compass size={32} style={{ color: 'var(--text-disabled)' }} />} message="nada parecido por aqui..." paddingTop={60} />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {semantic.results.length} nota{semantic.results.length > 1 ? 's' : ''} sobre isso
              </p>
              {semantic.results.map((r) => renderResult(r.note))}
            </div>
          )
        ) : activeTab === 'ia' ? (
          <div className="flex flex-col items-start gap-4 pt-4">
            <p className="font-serif italic" style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: '24px' }}>
              Pergunte do seu jeito — &ldquo;o que ficou decidido na reunião?&rdquo;, &ldquo;quais livros eu quero ler?&rdquo;.
              A IA lê suas notas e responde.
            </p>
            <button
              onClick={askAI}
              className="touch-feedback flex items-center gap-2 rounded-xl px-5 py-3 font-sans"
              style={{ background: 'var(--accent-amber)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              <Sparkles size={16} />
              {query.trim() ? 'Perguntar' : 'Abrir o assistente'}
            </button>
          </div>
        ) : activeTab === 'tags' ? (
          tags.length === 0 ? (
            <EmptyState message="nenhuma tag ainda" paddingTop={60} />
          ) : (
            <div className="flex flex-col gap-2">
              {tags.filter(([t]) => !query || t.includes(query.toLowerCase())).map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => { setQuery(tag); setActiveTab('texto') }}
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
          )
        ) : activeTab === 'datas' ? (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <label className="flex flex-col gap-2 flex-1 font-sans" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                De
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInputStyle} />
              </label>
              <label className="flex flex-col gap-2 flex-1 font-sans" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Até
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInputStyle} />
              </label>
            </div>
            {(from || to) && (
              <p className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {dateResults.length} nota{dateResults.length === 1 ? '' : 's'} no período
              </p>
            )}
            <div className="flex flex-col gap-3">{dateResults.map(renderResult)}</div>
          </div>
        ) : !query ? (
          recent.length > 0 && (
            <div>
              <p className="font-sans font-medium uppercase tracking-widest mb-3" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                Buscas recentes
              </p>
              <div className="flex flex-wrap gap-2">
                {recent.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="touch-feedback rounded-full px-3 py-1.5 font-sans"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center">
            <EmptyState
              icon={<span style={{ fontSize: 40, opacity: 0.2 }}>🔍</span>}
              message="nada com essas palavras..."
              paddingTop={60}
            />
            <button
              onClick={askAI}
              className="touch-feedback flex items-center gap-2 font-sans"
              style={{ color: 'var(--accent-amber)', fontSize: 14, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Sparkles size={14} /> perguntar à IA
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {results.length} resultado{results.length > 1 ? 's' : ''}
            </p>
            {results.map(renderResult)}
          </div>
        )}
      </div>
    </main>
  )
}
