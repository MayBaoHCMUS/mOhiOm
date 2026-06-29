'use client'

import { useState } from 'react'
import { publishComic } from '@/lib/publish'
import { PublishDialog } from '@/components/PublishDialog'
import { useComicGeneration } from '@/context/ComicGenerationContext'
import type { ComicMetadata } from '@/lib/metadata'

interface PublishButtonProps {
  pageImages:      string[]
  metadata:        ComicMetadata
  getExportPages?: () => Promise<string[]>
}

export function PublishButton({ pageImages, metadata, getExportPages }: PublishButtonProps) {
  const { localImageApiUrl } = useComicGeneration()

  const [status,     setStatus]     = useState<'idle' | 'publishing' | 'done' | 'error'>('idle')
  const [comicId,    setComicId]    = useState<string | null>(null)
  const [readerUrl,  setReaderUrl]  = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  async function handlePublish() {
    if (status === 'publishing') return
    setStatus('publishing')
    try {
      const pages = getExportPages ? await getExportPages() : pageImages
      const result = await publishComic(
        localImageApiUrl,
        pages,
        metadata.title  || 'Comic',
        metadata.author || '',
      )
      setComicId(result.comic_id)
      setReaderUrl(result.reader_url)
      setStatus('done')
      setShowDialog(true)
    } catch (err) {
      console.error('Publish failed:', err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const isBusy = status === 'publishing' || !pageImages.length || !localImageApiUrl
  const label  = {
    idle:       'Publish',
    publishing: 'Publishing…',
    done:       'Published ✓',
    error:      'Failed — retry',
  }[status]

  const borderColor = status === 'done'  ? '#059669'
                    : status === 'error' ? '#ef4444'
                    : 'var(--color-primary)'
  const textColor   = status === 'done'  ? '#059669'
                    : status === 'error' ? '#ef4444'
                    : 'var(--color-primary)'

  return (
    <div>
      <button
        type="button"
        onClick={status === 'done' ? () => setShowDialog(true) : handlePublish}
        disabled={isBusy}
        aria-busy={status === 'publishing'}
        style={{
          width: '100%', padding: '8px 14px', borderRadius: 8,
          border: `1px solid ${borderColor}`, background: 'transparent',
          color: textColor, fontSize: 12, fontWeight: 500,
          cursor: isBusy ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: isBusy ? 0.5 : 1, transition: 'opacity 0.15s',
        }}
      >
        {status === 'publishing' ? (
          <span style={{
            width: 13, height: 13,
            border: '2px solid currentColor', borderTopColor: 'transparent',
            borderRadius: '50%', display: 'inline-block',
            animation: 'pb-spin 0.7s linear infinite',
          }} aria-hidden="true" />
        ) : (
          <span aria-hidden="true">🌐</span>
        )}
        {label}
      </button>

      {!localImageApiUrl && (
        <p style={{ fontSize: 10, color: '#d97706', marginTop: 4 }}>
          Set Image API URL in Step 1 to enable publish.
        </p>
      )}

      {showDialog && comicId && readerUrl && (
        <PublishDialog
          apiUrl={localImageApiUrl}
          comicId={comicId}
          readerUrl={readerUrl}
          title={metadata.title || 'Comic'}
          pageCount={pageImages.length || 0}
          onClose={() => setShowDialog(false)}
          onUnpublish={() => {
            setStatus('idle')
            setComicId(null)
            setReaderUrl(null)
            setShowDialog(false)
          }}
        />
      )}

      <style>{`@keyframes pb-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
