'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Link2, Plus, Check, Sparkles } from 'lucide-react'
import type { Note } from '@/lib/types'
import { relatedNotes, type Draft } from '@/lib/related'
import { localVectors } from '@/lib/semantic'
import { noteHref } from '@/lib/routes'
import { getPreview } from '@/lib/notes'

interface Props {
  draft: Draft
  notes: Note[]
  /** Liga a nota (o [[Título]] vai para a linha "Relacionadas:" no fim, nunca no meio do texto) */
  onLink: (title: string) => void
}

/**
 * "Conexões" da nota, estilo Obsidian: notas parecidas pelo conteúdo e pelas tags, calculadas no
 * aparelho. Um toque em "ligar" cria a ligação sem você digitar [[ ]] no meio do texto.
 */
export default function RelatedNotes({ draft, notes, onLink }: Props) {
  const [vectors, setVectors] = useState<Map<string, number[]> | undefined>()
  const [justLinked, setJustLinked] = useState<Record<string, true>>({})

  // Vetores da busca por sentido, se já existirem no aparelho (não chama a IA)
  const ids = useMemo(() => notes.map((n) => n.id).join(','), [notes])
  useEffect(() => {
    let alive = true
    localVectors(ids ? ids.split(',') : []).then((v) => { if (alive) setVectors(v.size ? v : undefined) }).catch(() => {})
    return () => { alive = false }
  }, [ids])

  // Recalcula com o texto "assentado" (não a cada tecla)
  const [settled, setSettled] = useState(draft)
  useEffect(() => {
    const t = setTimeout(() => setSettled(draft), 700)
    return () => clearTimeout(t)
  }, [draft])

  const related = useMemo(() => relatedNotes(settled, notes, { limit: 6, vectors }), [settled, notes, vectors])
  const linkedTitles = useMemo(() => new Set([...settled.content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim().toLowerCase())), [settled.content])

  const suggestions = related.filter((r) => !r.linked && !linkedTitles.has((r.note.title ?? '').toLowerCase()))
  if (!suggestions.length) return null
  const linkable = suggestions.filter((r) => r.note.title && !justLinked[r.note.id])

  const link = (n: Note) => {
    if (!n.title) return
    onLink(n.title)
    setJustLinked((s) => ({ ...s, [n.id]: true }))
  }

  return (
    <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 font-sans font-semibold uppercase" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          <Sparkles size={12} style={{ color: 'var(--accent-amber)' }} /> Conexões sugeridas
        </span>
        {linkable.length > 1 && (
          <button
            onClick={() => linkable.slice(0, 3).forEach((r) => link(r.note))}
            className="touch-feedback font-sans font-medium"
            style={{
              fontSize: 11, color: 'var(--accent-amber)', background: 'var(--accent-amber-soft)',
              border: '1px solid rgba(var(--accent-rgb), 0.2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            ligar as {Math.min(3, linkable.length)} melhores
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {suggestions.map((r, i) => {
          const done = !!justLinked[r.note.id]
          return (
            <motion.div
              key={r.note.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className="noise-card flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <Link href={noteHref(r.note.id)} className="flex-1" style={{ minWidth: 0 }}>
                <div className="flex items-center gap-2">
                  <Link2 size={12} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                  <span className="font-sans font-medium line-clamp-1" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {r.note.title || getPreview(r.note.content, 40) || 'sem título'}
                  </span>
                </div>
                <p className="font-sans line-clamp-1" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {r.reason}
                </p>
              </Link>
              {r.note.title && (
                <button
                  onClick={() => link(r.note)}
                  disabled={done}
                  aria-label={`Ligar a ${r.note.title}`}
                  className="touch-feedback flex items-center gap-1 font-sans flex-shrink-0"
                  style={{
                    fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '5px 10px', border: 'none',
                    cursor: done ? 'default' : 'pointer',
                    background: done ? 'transparent' : 'var(--accent-amber-soft)',
                    color: done ? 'var(--success)' : 'var(--accent-amber)',
                  }}
                >
                  {done ? <><Check size={12} /> ligada</> : <><Plus size={12} /> ligar</>}
                </button>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
