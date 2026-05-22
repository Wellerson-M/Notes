import NewNoteClient from './new-note-client'

type NewNotePageProps = {
  searchParams?: {
    mode?: string | string[]
  }
}

export default function NewNotePage({ searchParams }: NewNotePageProps) {
  const mode = Array.isArray(searchParams?.mode) ? searchParams.mode[0] : searchParams?.mode

  return <NewNoteClient mode={mode ?? 'text'} />
}
