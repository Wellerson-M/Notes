'use client'
import Link from 'next/link'
import { Link2, X } from 'lucide-react'
import type { Note } from '@/lib/types'
import { noteHref } from '@/lib/routes'
import { getPreview } from '@/lib/notes'

interface Props {
  /** Notas ligadas fora do texto */
  linked: Note[]
  /** Quantas ligações estão no texto, na linha "Relacionadas:" */
  inTextCount: number
  onRemove: (id: string) => void
  /** Tira a linha "Relacionadas:" do texto e guarda as ligações aqui */
  onMoveOut: () => void
  /** Põe as ligações de fora na linha "Relacionadas:" do texto */
  onMoveIn: () => void
}

/**
 * "Ligada a": as ligações guardadas fora do texto. Elas valem igual a um [[link]] (mapa,
 * "mencionada em"), mas não sujam o conteúdo — copiar ou limpar a nota não as leva.
 */
export default function NoteLinks({ linked, inTextCount, onRemove, onMoveOut, onMoveIn }: Props) {
  if (!linked.length && !inTextCount) return null
  const label = (n: Note) => n.title || getPreview(n.content, 40) || 'sem título'

  return (
    <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="flex items-center gap-1.5 font-sans font-semibold uppercase" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          <Link2 size={12} style={{ color: 'var(--accent-amber)' }} /> Ligada a
        </span>
        {inTextCount > 0 ? (
          <SmallAction onClick={onMoveOut}>tirar {inTextCount > 1 ? `as ${inTextCount}` : 'a'} do texto</SmallAction>
        ) : linked.length > 0 ? (
          <SmallAction onClick={onMoveIn} subtle>pôr no texto</SmallAction>
        ) : null}
      </div>

      {inTextCount > 0 && !linked.length && (
        <p className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '18px' }}>
          As ligações desta nota estão no próprio texto, na linha “Relacionadas:”.
        </p>
      )}

      {linked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linked.map((n) => (
            <span
              key={n.id}
              className="flex items-center font-sans"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontSize: 12, maxWidth: '100%' }}
            >
              <Link href={noteHref(n.id)} className="line-clamp-1" style={{ color: 'var(--text-primary)', padding: '6px 4px 6px 10px' }}>
                {label(n)}
              </Link>
              <button
                onClick={() => onRemove(n.id)}
                aria-label={`Desligar ${label(n)}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px 8px 6px 4px', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SmallAction({ children, onClick, subtle = false }: { children: React.ReactNode; onClick: () => void; subtle?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="touch-feedback font-sans font-medium"
      style={{
        fontSize: 11, borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
        color: subtle ? 'var(--text-muted)' : 'var(--accent-amber)',
        background: subtle ? 'transparent' : 'var(--accent-amber-soft)',
        border: `1px solid ${subtle ? 'var(--border-default)' : 'rgba(var(--accent-rgb), 0.2)'}`,
      }}
    >
      {children}
    </button>
  )
}
