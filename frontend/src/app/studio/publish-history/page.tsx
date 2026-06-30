'use client'

import Link from 'next/link'
import StudioSidebar from '@/components/StudioSidebar'
import StudioTopBar from '@/components/StudioTopBar'
import { PublishHistory } from '@/components/PublishHistory'
import { ArrowLeft } from 'lucide-react'

export default function PublishHistoryPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="ml-[var(--studio-sidebar-width)] pt-24 min-h-screen flex flex-col">

        {/* Page header band — matches Publish page style */}
        <div style={{ background: '#F8FAFF', borderBottom: '1px solid #E5E7EB', padding: '28px 32px 24px 32px', flexShrink: 0 }}>
          <Link href="/studio/publish"
            className="inline-flex items-center gap-1.5 text-[12px] text-on-surface-variant hover:text-primary transition-colors mb-3">
            <ArrowLeft size={14} />
            Back to Publish
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4, lineHeight: 1.2 }}>
            Publish History
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            A record of all comics you&apos;ve published to the web reader
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-8 pb-16 flex-1">
          <div className="max-w-3xl mx-auto">
            <PublishHistory />
          </div>
        </div>

      </main>
    </div>
  )
}
