'use client'

import StudioSidebar from '@/components/StudioSidebar'
import StudioTopBar from '@/components/StudioTopBar'
import { EvaluationDashboard } from '@/components/EvaluationDashboard'

export default function EvaluationPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />
      <main className="ml-[var(--studio-sidebar-width)] pt-24 min-h-screen">
        <EvaluationDashboard />
      </main>
    </div>
  )
}
