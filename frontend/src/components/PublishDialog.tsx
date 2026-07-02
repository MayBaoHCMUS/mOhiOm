'use client'

import { useState, useEffect, useRef } from 'react'
import { buildShareUrl, getComicStats, unpublishComic } from '@/lib/publish'

interface PublishDialogProps {
  apiUrl:      string
  comicId:     string
  readerUrl:   string
  title:       string
  pageCount:   number
  onClose:     () => void
  onUnpublish?: () => void
}

export function PublishDialog({
  apiUrl, comicId, readerUrl, title, pageCount, onClose, onUnpublish,
}: PublishDialogProps) {
  const shareUrl = buildShareUrl(apiUrl, readerUrl)
  const [copied,        setCopied]       = useState(false)
  const [embedCopied,   setEmbedCopied]  = useState(false)
  const [tab,           setTab]          = useState<'link' | 'embed' | 'stats'>('link')
  const [readCount,     setReadCount]    = useState<number | null>(null)
  const [unpublishing,  setUnpublishing] = useState(false)
  const qrContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!qrContainerRef.current) return
    const container = qrContainerRef.current
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    script.onload = () => {
      if (!container) return
      container.innerHTML = ''
      // @ts-expect-error — QRCode loaded via CDN, not npm
      new QRCode(container, {
        text: shareUrl, width: 160, height: 160,
        colorDark: '#111111', colorLight: '#ffffff',
      })
    }
    document.head.appendChild(script)
    return () => {
      try { document.head.removeChild(script) } catch { /* already removed */ }
    }
  }, [shareUrl])

  useEffect(() => {
    async function fetchStats() {
      try {
        const s = await getComicStats(apiUrl, comicId)
        setReadCount(s.read_count)
      } catch { /* noop */ }
    }
    fetchStats()
    const id = setInterval(fetchStats, 15_000)
    return () => clearInterval(id)
  }, [apiUrl, comicId])

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setEmbedCopied(true)
      setTimeout(() => setEmbedCopied(false), 2000)
    })
  }

  async function handleUnpublish() {
    if (!window.confirm('Remove this comic from public access?')) return
    setUnpublishing(true)
    try {
      await unpublishComic(apiUrl, comicId)
      onUnpublish?.()
      onClose()
    } finally {
      setUnpublishing(false)
    }
  }

  const embedCode = [
    `<iframe`,
    `  src="${shareUrl}"`,
    `  width="480"`,
    `  height="680"`,
    `  style="border:none;border-radius:8px"`,
    `  title="${title}"`,
    `></iframe>`,
  ].join('\n')

  const TABS = [
    { id: 'link'  as const, label: 'Share link' },
    { id: 'embed' as const, label: 'Embed'      },
    { id: 'stats' as const, label: 'Stats'      },
  ]

  return (
    <div style={{
      background: 'var(--color-surface-container-low)',
      borderRadius: 12,
      border: '1px solid var(--color-outline-variant)',
      overflow: 'hidden',
      marginTop: 8,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px',
        borderBottom: '1px solid var(--color-outline-variant)',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>
            Published
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
            {title} · {pageCount} {pageCount === 1 ? 'page' : 'pages'}
            {readCount !== null && (
              <span style={{ marginLeft: 8 }}>
                · {readCount} {readCount === 1 ? 'read' : 'reads'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--color-on-surface-variant)',
            lineHeight: 1, padding: 4, borderRadius: 6,
          }}
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-outline-variant)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', background: 'transparent',
              fontSize: 11, fontWeight: 500,
              color: tab === t.id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 14 }}>

        {tab === 'link' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* URL + copy */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={shareUrl}
                readOnly
                onFocus={e => e.target.select()}
                style={{
                  flex: 1, padding: '7px 9px', borderRadius: 8,
                  border: '1px solid var(--color-outline-variant)',
                  background: 'var(--color-surface-container-lowest, #fff)',
                  color: 'var(--color-on-surface)',
                  fontSize: 11, fontFamily: 'monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  outline: 'none',
                }}
              />
              <button
                onClick={copyLink}
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  border: '1px solid var(--color-outline-variant)',
                  background: copied ? '#d1fae5' : 'transparent',
                  color: copied ? '#065f46' : 'var(--color-on-surface)',
                  fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'background 0.2s',
                }}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>

            {/* Open reader */}
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
                background: 'transparent', fontSize: 12,
                textDecoration: 'none', fontWeight: 500,
              }}
            >
              ↗ Open reader
            </a>

            {/* QR code */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', marginBottom: 8 }}>
                Scan to read on mobile
              </div>
              <div
                ref={qrContainerRef}
                aria-label="QR code for shareable link"
                style={{
                  display: 'inline-block', background: '#fff', padding: 10,
                  borderRadius: 8, border: '1px solid var(--color-outline-variant)',
                  minWidth: 160, minHeight: 160,
                }}
              />
            </div>

            {/* Remove */}
            <div style={{ textAlign: 'center', marginTop: 2 }}>
              <button
                onClick={handleUnpublish}
                disabled={unpublishing}
                style={{
                  fontSize: 11, color: '#ef4444', background: 'none', border: 'none',
                  cursor: unpublishing ? 'not-allowed' : 'pointer',
                  textDecoration: 'underline', opacity: unpublishing ? 0.5 : 1,
                }}
              >
                {unpublishing ? 'Removing…' : 'Remove from public access'}
              </button>
            </div>
          </div>
        )}

        {tab === 'embed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', margin: 0 }}>
              Copy this snippet to embed the comic reader in any website.
            </p>
            <pre style={{
              background: 'var(--color-surface-container-lowest, #fff)',
              border: '1px solid var(--color-outline-variant)',
              borderRadius: 8, padding: '10px 12px',
              fontSize: 10, fontFamily: 'monospace',
              color: 'var(--color-on-surface)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              margin: 0,
            }}>
              {embedCode}
            </pre>
            <button
              onClick={copyEmbed}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid var(--color-outline-variant)',
                background: embedCopied ? '#d1fae5' : 'transparent',
                color: embedCopied ? '#065f46' : 'var(--color-on-surface)',
                fontSize: 11, cursor: 'pointer', alignSelf: 'flex-start',
                transition: 'background 0.2s',
              }}
            >
              {embedCopied ? 'Copied ✓' : 'Copy embed code'}
            </button>
          </div>
        )}

        {tab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              background: 'var(--color-surface-container-lowest, #fff)',
              borderRadius: 8, padding: '16px 12px', textAlign: 'center',
              border: '1px solid var(--color-outline-variant)',
            }}>
              <div style={{ fontSize: 40, fontWeight: 600, color: 'var(--color-on-surface)', lineHeight: 1 }}>
                {readCount ?? '…'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 6 }}>
                {readCount === 1 ? 'person read this' : 'people read this'}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>
              Updates every 15 seconds · Comic ID: {comicId}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
