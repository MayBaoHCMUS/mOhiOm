'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  getPublishHistory, removeFromHistory, fetchLiveStats,
  type PublishedComicRecord,
} from '@/lib/publishHistory'

const SESSION_KEY = 'mohiom-image-api-url'

export function PublishHistory() {
  const localImageApiUrl = typeof window !== 'undefined'
    ? (window.sessionStorage.getItem(SESSION_KEY) ?? '')
    : ''

  const [history,   setHistory]   = useState<PublishedComicRecord[]>([])
  const [liveStats, setLiveStats] = useState<Map<string, number>>(new Map())
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const records = getPublishHistory()
    setHistory(records)
    refreshStats(records)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshStats(records: PublishedComicRecord[]) {
    setLoading(true)
    const ids = records.map(r => r.comic_id)
    const map = await fetchLiveStats(localImageApiUrl, ids)
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
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
        <p style={{ fontSize: 13 }}>No published comics yet.</p>
        <p style={{ fontSize: 11, marginTop: 6 }}>
          Comics you publish from the Comic Editor will appear here.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 1rem' }}>

      {/* Summary header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--color-surface-container-low)',
        borderRadius: 8,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-on-surface)' }}>
            {history.length} published {history.length === 1 ? 'comic' : 'comics'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
            {loading ? 'Loading read counts…' : `${totalReads} total reads`}
          </div>
        </div>
        <button
          onClick={() => refreshStats(history)}
          disabled={loading}
          style={{
            fontSize: 11, padding: '5px 12px', borderRadius: 8,
            border: '0.5px solid var(--color-outline)', background: 'transparent',
            color: 'var(--color-on-surface)', cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map(record => {
          const readCount = liveStats.get(record.comic_id)
          const isExpired = !liveStats.has(record.comic_id) && !loading
          return (
            <div
              key={record.comic_id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: 'var(--color-surface-container)',
                border: '0.5px solid var(--color-outline)',
                borderRadius: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 500, color: 'var(--color-on-surface)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {record.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                  {record.page_count} {record.page_count === 1 ? 'page' : 'pages'} · {new Date(record.published_at).toLocaleDateString()}
                  {isExpired && (
                    <span style={{ color: '#ef4444', marginLeft: 6 }}>
                      · expired (server restarted)
                    </span>
                  )}
                </div>
              </div>

              {!isExpired && (
                <div style={{ textAlign: 'center', minWidth: 50 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-on-surface)' }}>
                    {readCount ?? '…'}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--color-on-surface-variant)' }}>
                    {readCount === 1 ? 'read' : 'reads'}
                  </div>
                </div>
              )}

              {!isExpired && (
                <a
                  href={record.reader_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open reader"
                  style={{
                    fontSize: 14, color: 'var(--color-on-surface-variant)',
                    textDecoration: 'none', padding: 4,
                  }}
                >
                  <i className="ti ti-external-link" aria-hidden="true" />
                </a>
              )}

              <button
                onClick={() => handleRemove(record.comic_id)}
                aria-label="Remove from history"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-on-surface-variant)', fontSize: 14, padding: 4,
                }}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
