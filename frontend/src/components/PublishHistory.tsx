'use client'

import { useState, useEffect, useMemo } from 'react'
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import {
  getPublishHistory, removeFromHistory, fetchLiveStats,
  type PublishedComicRecord,
} from '@/lib/publishHistory'

const SESSION_KEY = 'mohiom-image-api-url'

export function PublishHistory() {
  const [apiUrl, setApiUrl] = useState('')
  const [history, setHistory] = useState<PublishedComicRecord[]>([])
  const [liveStats, setLiveStats] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = window.sessionStorage.getItem(SESSION_KEY) ?? ''
    setApiUrl(url)
    const records = getPublishHistory()
    setHistory(records)
    refreshStats(url, records)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshStats(url: string, records: PublishedComicRecord[]) {
    setLoading(true)
    const ids = records.map(r => r.comic_id)
    const map = await fetchLiveStats(url, ids)
    setLiveStats(map)
    setLoading(false)
  }

  function handleRemove(comicId: string) {
    removeFromHistory(comicId)
    setHistory(prev => prev.filter(r => r.comic_id !== comicId))
  }

  const totalReads = useMemo(
    () => history.reduce((sum, r) => sum + (liveStats.get(r.comic_id) ?? 0), 0),
    [history, liveStats],
  )

  if (!history.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
        <span className="material-symbols-outlined text-5xl mb-3 text-outline">history</span>
        <p className="text-[14px] font-medium">No published comics yet</p>
        <p className="text-[12px] mt-1 text-on-surface-variant/70">
          Comics you publish from the{' '}
          <a href="/studio/publish" className="text-primary hover:underline">Publish page</a>
          {' '}will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Summary bar */}
      <div className="flex items-center justify-between bg-surface-container-low border border-outline-variant/20 rounded-2xl px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-on-surface">
            {history.length} published {history.length === 1 ? 'comic' : 'comics'}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            {loading ? 'Loading read counts…' : `${totalReads} total reads`}
            {!apiUrl && !loading && (
              <span className="text-amber-600 ml-2">· Set server URL on Publish page to load counts</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshStats(apiUrl, history)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/40 text-[11px] font-medium text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Records list */}
      <div className="space-y-2">
        {history.map(record => {
          const readCount = liveStats.get(record.comic_id)
          const isExpired = !liveStats.has(record.comic_id) && !loading

          return (
            <div key={record.comic_id}
              className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-4 py-3 hover:shadow-sm transition-shadow">

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-on-surface truncate">{record.title}</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {record.page_count} {record.page_count === 1 ? 'page' : 'pages'}
                  {' · '}
                  {new Date(record.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {isExpired && (
                    <span className="text-red-500 ml-2">· expired (server restarted)</span>
                  )}
                </p>
              </div>

              {/* Read count */}
              {!isExpired && (
                <div className="text-center min-w-[44px] shrink-0">
                  <p className="text-[16px] font-semibold text-on-surface leading-none">
                    {loading ? '…' : (readCount ?? '—')}
                  </p>
                  <p className="text-[9px] text-on-surface-variant mt-0.5 uppercase tracking-wide">
                    {readCount === 1 ? 'read' : 'reads'}
                  </p>
                </div>
              )}

              {/* Open link */}
              {!isExpired && (
                <a href={record.reader_url} target="_blank" rel="noopener noreferrer"
                  aria-label="Open reader"
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors">
                  <ExternalLink size={14} />
                </a>
              )}

              {/* Remove */}
              <button type="button" onClick={() => handleRemove(record.comic_id)}
                aria-label="Remove from history"
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant/40 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
