'use client'

import StudioSidebar from '@/components/StudioSidebar'
import StudioTopBar from '@/components/StudioTopBar'
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard'

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />
      <main className="ml-[var(--studio-sidebar-width)] pt-24 min-h-screen">
        <AnalyticsDashboard />
      </main>
    </div>
  )
}
