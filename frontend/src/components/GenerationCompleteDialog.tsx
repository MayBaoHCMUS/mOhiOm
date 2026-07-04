'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface GenerationCompleteDialogProps {
  pageCount: number
  onOpenEditor: () => Promise<void>
  onSkipToExport: () => void
}

export function GenerationCompleteDialog({
  pageCount,
  onOpenEditor,
  onSkipToExport,
}: GenerationCompleteDialogProps) {
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState<string | null>(null)

  async function handleOpenEditor() {
    setSaving(true)
    setError(null)
    try {
      await onOpenEditor()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-6 flex flex-col items-center text-center gap-4 mt-4">
      <div className="w-11 h-11 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <span className="text-emerald-600 text-xl">✓</span>
      </div>

      <div>
        <p className="text-base font-bold text-on-surface">Your comic is ready</p>
        <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
          {pageCount} {pageCount === 1 ? 'page' : 'pages'} generated.
          Want to add finishing touches before exporting?
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-500 font-medium -mt-1">{error}</p>
      )}

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          type="button"
          onClick={handleOpenEditor}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity w-full disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              Open Comic Editor
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/20 text-white leading-none">
                optional
              </span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onSkipToExport}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl border border-outline-variant/40 text-on-surface-variant text-sm hover:bg-surface-container transition-colors w-full disabled:opacity-40"
        >
          Skip — export now
        </button>
      </div>
    </div>
  )
}
