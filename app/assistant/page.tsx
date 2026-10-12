'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AssistantClient from './assistant-client'

// Página estática (lê ?q= no cliente) para abrir offline pelo service worker
function AssistantRoute() {
  return <AssistantClient initialQuery={useSearchParams().get('q') ?? ''} />
}

export default function AssistantPage() {
  return (
    <Suspense>
      <AssistantRoute />
    </Suspense>
  )
}
