'use client'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { noteHref } from '@/lib/routes'

/** `[[Título]]` renderizado: link para a nota com esse título, ou apagado se ela não existir */
export default function WikiLink({ title }: { title: string }) {
  const target = useLiveQuery(
    () => db.notes.filter((n) => !n.deleted && n.title?.toLowerCase() === title.toLowerCase()).first(),
    [title],
  )

  if (!target) {
    return <span style={{ color: 'var(--text-muted)', borderBottom: '1px dashed var(--border-strong)' }}>{title}</span>
  }

  return (
    <Link
      href={noteHref(target.id)}
      // O corpo do editor entra em modo edição ao clicar; o link não deve disparar isso
      onClick={(e) => e.stopPropagation()}
      style={{ color: 'var(--accent-amber)', textDecoration: 'underline', textDecorationColor: 'rgba(232,165,71,0.4)', textUnderlineOffset: 3 }}
    >
      {title}
    </Link>
  )
}
