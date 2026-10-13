'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Note } from '@/lib/types'
import { completeTag, suggestTags, type Draft } from '@/lib/related'

interface Props {
  draft: Draft
  notes: Note[]
  /** O que está sendo digitado no campo "+ tag" */
  query: string
  /** Campo de tag em foco: mostra as sugestões mesmo se a nota já tiver tags */
  focused: boolean
  onAdd: (tag: string) => void
}

/**
 * Sugestões de tag embaixo das tags da nota. Digitando: completa com as tags que você já usa.
 * Sem digitar: as tags que combinam com o texto e com as notas parecidas (e, se faltar, palavras
 * fortes do texto como tag nova). Tags iguais são outra forma de ligar notas.
 */
export default function TagSuggest({ draft, notes, query, focused, onAdd }: Props) {
  // Calcula com o texto "assentado", não a cada tecla
  const [settled, setSettled] = useState(draft)
  useEffect(() => {
    const t = setTimeout(() => setSettled(draft), 800)
    return () => clearTimeout(t)
  }, [draft])

  const suggestions = useMemo(() => suggestTags(settled, notes), [settled, notes])
  const completions = useMemo(() => completeTag(query, notes, draft.tags), [query, notes, draft.tags])

  const typed = query.trim().replace(/^#/, '').toLowerCase()
  const items: { tag: string; existing: boolean }[] = typed
    ? [...completions.map((tag) => ({ tag, existing: true })), ...(completions.includes(typed) || draft.tags.includes(typed) ? [] : [{ tag: typed, existing: false }])]
    : suggestions

  // Sem foco, só aparece numa nota ainda sem tags (discreto); com foco, sempre
  if (!items.length || (!focused && (draft.tags.length > 0 || typed))) return null

  return (
    <div className="flex items-center flex-wrap gap-1.5 -mt-4 mb-6">
      <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {typed ? 'tags:' : 'sugestões:'}
      </span>
      {items.map(({ tag, existing }) => (
        <button
          key={tag}
          // Não tira o foco do campo de tag (senão o blur grava o que estava digitado)
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAdd(tag)}
          className="touch-feedback font-sans"
          style={{
            fontSize: 11, borderRadius: 20, padding: '3px 9px', cursor: 'pointer',
            color: existing ? 'var(--accent-amber)' : 'var(--text-secondary)',
            background: existing ? 'transparent' : 'var(--bg-elevated)',
            border: `1px dashed ${existing ? 'rgba(var(--accent-rgb), 0.45)' : 'var(--border-strong)'}`,
          }}
        >
          + #{tag}{!existing && <span style={{ color: 'var(--text-muted)' }}> · nova</span>}
        </button>
      ))}
    </div>
  )
}
