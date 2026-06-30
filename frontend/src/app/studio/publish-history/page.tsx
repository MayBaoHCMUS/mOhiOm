'use client'

import StudioSidebar from '@/components/StudioSidebar'
import StudioTopBar from '@/components/StudioTopBar'
import { PublishHistory } from '@/components/PublishHistory'

export default function PublishHistoryPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />
      <main className="ml-[var(--studio-sidebar-width)] pt-24 px-8 pb-12 min-h-screen">
        <h1 className="text-lg font-semibold mb-6">Publish History</h1>
        <PublishHistory />
      </main>
    </div>
  )
}
