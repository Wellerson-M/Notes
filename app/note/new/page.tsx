import { Suspense } from 'react'
import NewNoteClient from './new-note-client'

function NewNoteFallback() {
  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100dvh' }} />
  )
}

export default function NewNotePage() {
  return (
    <Suspense fallback={<NewNoteFallback />}>
      <NewNoteClient />
    </Suspense>
  )
}
