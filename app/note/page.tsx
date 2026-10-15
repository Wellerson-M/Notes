'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { isLocked, useNote } from '@/lib/repo'
import { noteHref } from '@/lib/routes'
import NoteEditor, { type NoteDraft } from '@/components/NoteEditor'

const blank = <div style={{ minHeight: '100dvh', background: 'var(--bg-base)' }} />

/** Conteúdo compartilhado de outro app (share_target do manifest): título, texto e link */
function sharedDraft(params: URLSearchParams): NoteDraft | undefined {
  const title = params.get('title')?.trim() ?? ''
  const text = params.get('text')?.trim() ?? ''
  const url = params.get('url')?.trim() ?? ''
  if (!title && !text && !url) return undefined
  // Muitos apps mandam o link dentro do texto; não repetir
  const body = [text, url && !text.includes(url) ? url : ''].filter(Boolean).join('\n\n')
  return { title, content: body }
}

/**
 * `/note?id=<id>` abre uma nota; `/note?mode=<modo>` começa uma nova
 * (`&vault=1` cria direto no Vault; `title`/`text`/`url` vêm do "compartilhar" do sistema)
 */
function NoteRoute() {
  const params = useSearchParams()
  const id = params.get('id')
  const mode = params.get('mode') ?? 'text'
  const date = params.get('date')
  const inVault = params.get('vault') === '1'
  // `&date=AAAA-MM-DD` (vindo da Agenda) começa a nota já agendada para o dia
  const schedule = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : undefined
  const shared = sharedDraft(params) ?? (schedule ? { title: '', content: '' } : undefined)
  if (shared && schedule) shared.schedule = schedule

  /**
   * Nota nova que acabou de nascer: a URL troca para `?id=` (assim recarregar, o Android
   * restaurar o app ou a atualização automática reabrem ESTA nota, e não uma em branco que
   * viraria uma nota duplicada), mas o editor continua o mesmo — sem perder cursor e teclado.
   */
  const [adopted, setAdopted] = useState<{ id: string; key: string; mode: string; initial?: NoteDraft; inVault: boolean } | null>(null)
  if (id && adopted?.id === id) {
    const a = adopted
    return <NoteEditor key={a.key} note={null} mode={a.mode} initial={a.initial} inVault={a.inVault} />
  }

  // key: ao trocar de nota (wikilink) ou começar outra, o editor reinicia do zero
  if (!id) {
    const key = `new-${mode}-${params.toString()}`
    const onCreated = (newId: string) => {
      setAdopted({ id: newId, key, mode, initial: shared, inVault })
      window.history.replaceState(null, '', noteHref(newId))
    }
    return <NoteEditor key={key} note={null} mode={mode} initial={shared} inVault={inVault} onCreated={onCreated} />
  }
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
  if (isLocked(note)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '100dvh', padding: 32 }}>
        <Lock size={28} style={{ color: 'var(--accent-gold)' }} />
        <p className="font-serif italic" style={{ color: 'var(--text-secondary)', fontSize: 16 }}>esta nota está no Vault trancado</p>
        <Link href="/vault" className="font-sans" style={{ color: 'var(--accent-amber)', fontSize: 14, fontWeight: 500 }}>
          Abrir o Vault
        </Link>
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
