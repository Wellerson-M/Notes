'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useNote } from '@/lib/repo'
import NoteEditor from '@/components/NoteEditor'

const blank = <div style={{ minHeight: '100dvh', background: 'var(--bg-base)' }} />

/** `/note?id=<id>` abre uma nota; `/note?mode=<modo>` começa uma nova */
function NoteRoute() {
  const params = useSearchParams()
  const id = params.get('id')
  const mode = params.get('mode') ?? 'text'

  // key: ao trocar de nota (wikilink) ou começar outra, o editor reinicia do zero
  if (!id) return <NoteEditor key={`new-${mode}`} note={null} mode={mode} />
  return <ExistingNote key={id} id={id} />
}

function ExistingNote({ id }: { id: string }) {
  const note = useNote(id)
  if (note === undefined) return blank
  if (note === null) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <p className="font-serif italic" style={{ color: 'var(--text-muted)' }}>Nota não encontrada</p>
      </div>
    )
  }
  return <NoteEditor note={note} />
}

export default function NotePage() {
  return (
    <Suspense fallback={blank}>
      <NoteRoute />
    </Suspense>
  )
}
