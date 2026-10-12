'use client'
import { useEffect, useState } from 'react'
import { History, Lock } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { renderMarkdown } from './MarkdownEditor'
import { listVersions, type VersionView } from '@/lib/history'
import { getPreview, getRelativeDate } from '@/lib/notes'

const REASON: Record<VersionView['reason'], string> = {
  edit: 'edição',
  conflict: 'conflito entre aparelhos',
  restore: 'antes de restaurar',
}

/** Versões anteriores da nota (guardadas só neste aparelho); tocar abre a prévia e permite restaurar */
export default function VersionsSheet({ noteId, onRestore, onClose }: {
  noteId: string
  onRestore: (v: VersionView) => void
  onClose: () => void
}) {
  const [versions, setVersions] = useState<VersionView[] | null>(null)
  const [selected, setSelected] = useState<VersionView | null>(null)

  useEffect(() => {
    void listVersions(noteId).then(setVersions)
  }, [noteId])

  return (
    <BottomSheet title={selected ? 'Prévia da versão' : 'Versões anteriores'} onClose={onClose}>
      {selected ? (
        <>
          <div className="px-5 pt-4 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {new Date(selected.savedAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })} · {REASON[selected.reason]}
          </div>
          <div className="px-5 py-3 font-serif" style={{ fontSize: 15, lineHeight: '26px', color: 'var(--text-secondary)' }}>
            {selected.title && <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{selected.title}</div>}
            {renderMarkdown(selected.content)}
          </div>
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={() => setSelected(null)}
              className="touch-feedback flex-1 rounded-xl py-3 font-sans"
              style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              Voltar
            </button>
            <button
              onClick={() => onRestore(selected)}
              className="touch-feedback flex-1 rounded-xl py-3 font-sans"
              style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--accent-amber)', color: '#111210', border: 'none' }}
            >
              Restaurar
            </button>
          </div>
        </>
      ) : versions === null ? null : versions.length === 0 ? (
        <p className="font-serif italic px-5 py-8" style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: '22px' }}>
          nenhuma versão anterior ainda — uma é guardada a cada 10 minutos de edição e sempre que outro aparelho sobrescrever esta nota.
        </p>
      ) : (
        <div className="flex flex-col gap-2 p-4">
          {versions.map((v) => (
            <button
              key={v.seq}
              disabled={v.locked}
              onClick={() => setSelected(v)}
              className="touch-feedback flex flex-col gap-1 rounded-xl px-4 py-3 text-left"
              style={{ background: 'var(--bg-elevated)', border: `1px solid ${v.reason === 'conflict' ? 'var(--warning)' : 'var(--border-subtle)'}`, cursor: v.locked ? 'default' : 'pointer' }}
            >
              <div className="flex items-center gap-2 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {v.locked ? <Lock size={12} /> : <History size={12} style={{ color: 'var(--accent-amber)' }} />}
                {getRelativeDate(new Date(v.savedAt).toISOString())} · {REASON[v.reason]}
              </div>
              <div className="font-serif line-clamp-2" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '19px' }}>
                {v.locked ? 'cifrada — abra o Vault para ver' : (v.title ? `${v.title} — ` : '') + (getPreview(v.content, 140) || 'vazia')}
              </div>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  )
}
