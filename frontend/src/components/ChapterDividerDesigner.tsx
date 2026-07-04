'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  renderChapterDivider,
  DEFAULT_DIVIDER_CONFIG,
  type ChapterDividerConfig,
  type DividerStyle,
} from '@/lib/chapterDivider'

const STYLES: { key: DividerStyle; label: string; desc: string }[] = [
  { key: 'light',   label: 'Light',   desc: 'White, clean'         },
  { key: 'dark',    label: 'Dark',    desc: 'Black, purple accent' },
  { key: 'manga',   label: 'Manga',   desc: 'Speed lines, bold'    },
  { key: 'minimal', label: 'Minimal', desc: 'Off-white, no rule'   },
]

interface ChapterDividerDesignerProps {
  // 0 = before page 1 (insert at beginning), N = after page N
  insertAfterIndex: number
  onInsert:  (dividerB64: string, afterIndex: number) => void
  onCancel:  () => void
}

export function ChapterDividerDesigner({
  insertAfterIndex,
  onInsert,
  onCancel,
}: ChapterDividerDesignerProps) {
  const [config,     setConfig]     = useState<ChapterDividerConfig>(DEFAULT_DIVIDER_CONFIG)
  const [previewB64, setPreviewB64] = useState<string | null>(null)
  const [rendering,  setRendering]  = useState(false)
  const [inserting,  setInserting]  = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshPreview = useCallback(async (cfg: ChapterDividerConfig) => {
    if (!cfg.title.trim()) { setPreviewB64(null); return }
    setRendering(true)
    try {
      const b64 = await renderChapterDivider(cfg)
      setPreviewB64(b64)
    } catch { /* noop */ }
    finally { setRendering(false) }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => refreshPreview(config), 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [config, refreshPreview])

  function update<K extends keyof ChapterDividerConfig>(key: K, value: ChapterDividerConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  async function handleInsert() {
    if (!config.title.trim()) return
    setInserting(true)
    try {
      const b64 = previewB64 ?? await renderChapterDivider(config)
      onInsert(b64, insertAfterIndex)
    } finally {
      setInserting(false)
    }
  }

  const insertLabel = insertAfterIndex === 0 ? 'at the beginning' : `after page ${insertAfterIndex}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div
        className="bg-surface rounded-2xl border border-outline-variant/20 flex flex-col overflow-hidden shadow-2xl"
        style={{ width: 'min(860px, 92vw)', maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 shrink-0">
          <h2 className="text-[15px] font-medium text-on-surface m-0">Insert chapter divider</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-on-surface-variant">Inserting {insertLabel}</span>
            <button
              onClick={onCancel}
              className="bg-transparent border-0 text-lg text-on-surface-variant cursor-pointer p-1 leading-none hover:text-on-surface transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body — 2 cols */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left — form */}
          <div className="flex-1 flex flex-col gap-5 p-5 overflow-y-auto border-r border-outline-variant/20">

            {/* Style selector */}
            <div>
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Style</p>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map(s => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => update('style', s.key)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      config.style === s.key
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant/30 hover:border-outline-variant/60 bg-transparent'
                    }`}
                  >
                    <div className={`text-xs font-semibold ${config.style === s.key ? 'text-primary' : 'text-on-surface'}`}>
                      {s.label}
                    </div>
                    <div className="text-[10px] text-on-surface-variant mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chapter label */}
            <div>
              <label htmlFor="cdv-label" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Chapter label
              </label>
              <input
                id="cdv-label"
                type="text"
                value={config.chapterLabel}
                onChange={e => update('chapterLabel', e.target.value)}
                placeholder="Chapter 1"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-transparent text-on-surface text-sm focus:outline-none focus:border-primary/60 transition-colors"
              />
              <p className="text-[11px] text-on-surface-variant mt-1">
                Displayed small above the title. Leave blank to hide.
              </p>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="cdv-title" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                id="cdv-title"
                type="text"
                value={config.title}
                onChange={e => update('title', e.target.value)}
                placeholder="The beginning"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-transparent text-on-surface text-sm focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            {/* Tagline */}
            <div>
              <label htmlFor="cdv-tagline" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Tagline
              </label>
              <input
                id="cdv-tagline"
                type="text"
                value={config.tagline}
                onChange={e => update('tagline', e.target.value)}
                placeholder="An optional quote or subtitle"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-transparent text-on-surface text-sm focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>

          {/* Right — preview */}
          <div className="flex flex-col gap-3 p-4 overflow-y-auto" style={{ width: 280, flexShrink: 0 }}>
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Preview</p>
            <div className="flex-1 bg-surface-container-low rounded-xl border border-outline-variant/20 flex items-center justify-center min-h-[200px] relative">
              {rendering && (
                <div className="flex flex-col items-center gap-2" aria-live="polite">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-outline-variant border-t-on-surface animate-spin"
                    aria-hidden="true"
                  />
                  <span className="text-[11px] text-on-surface-variant">Rendering…</span>
                </div>
              )}
              {!rendering && previewB64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${previewB64}`}
                  alt="Chapter divider preview"
                  className="w-full rounded-lg block"
                />
              )}
              {!rendering && !previewB64 && (
                <span className="text-xs text-on-surface-variant">Enter a title to preview</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-outline-variant/20 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-outline-variant/30 bg-transparent text-on-surface text-sm cursor-pointer hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!config.title.trim() || inserting}
            className="px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity"
          >
            {inserting ? 'Inserting…' : 'Insert divider'}
          </button>
        </div>
      </div>
    </div>
  )
}
