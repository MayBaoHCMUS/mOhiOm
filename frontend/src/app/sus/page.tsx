'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { SUSForm } from '@/components/SUSForm'
import { getOrCreateLocalParticipantId } from '@/lib/susScoring'

// Deliberately outside /studio: study participants have no account, and the studio
// layout redirects anonymous visitors to /login.

function SUSPageInner() {
  const params = useSearchParams()
  const participantId = params.get('p') ?? getOrCreateLocalParticipantId()
  const taskId = params.get('task') ?? undefined

  return <SUSForm participantId={participantId} taskId={taskId} />
}

export default function SUSPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#fff' }}>
      <Suspense fallback={<div style={{ padding: '2rem', color: '#888' }}>Loading…</div>}>
        <SUSPageInner />
      </Suspense>
    </main>
  )
}
