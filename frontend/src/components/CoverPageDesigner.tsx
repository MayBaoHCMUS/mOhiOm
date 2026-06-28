'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { renderCover, type CoverConfig, type CoverTemplate } from '@/lib/coverPage'

const TEMPLATES: { key: CoverTemplate; label: string; desc: string }[] = [
  { key: 'minimal',  label: 'Minimal',  desc: 'Clean white, typographic' },
  { key: 'manga',    label: 'Manga',    desc: 'Black bg, speed lines'    },
  { key: 'dark',     label: 'Dark',     desc: 'Dark purple, dramatic'    },
  { key: 'artistic', label: 'Artistic', desc: 'Vintage book style'       },
]

interface CoverPageDesignerProps {
  storyTitle:    string
  characterB64?: string | null
  onConfirm:     (coverB64: string) => void
  onCancel:      () => void
}

export function CoverPageDesigner({
  storyTitle,
  characterB64,
  onConfirm,
  onCancel,
}: CoverPageDesignerProps) {
  const [config, setConfig] = useState<CoverConfig>({
    template:     'minimal',
    title:        storyTitle || '',
    subtitle:     '',
    author:       '',
    year:         new Date().getFullYear().toString(),
    characterB64: characterB64 ?? null,
  })
  const [previewB64, setPreviewB64] = useState<string | null>(null)
  const [rendering,  setRendering]  = useState(false)
  const [confirming, setConfirming] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshPreview = useCallback(async (cfg: CoverConfig) => {
    setRendering(true)
    try {
      const b64 = await renderCover(cfg)
      setPreviewB64(b64)
    } catch (err) {
      console.error('Cover render failed:', err)
    } finally {
      setRendering(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => refreshPreview(config), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [config, refreshPreview])

  function update<K extends keyof CoverConfig>(key: K, value: CoverConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  function handleCharacterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      update('characterB64', result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  async function handleConfirm() {
    if (!config.title.trim()) return
    setConfirming(true)
    try {
      const b64 = previewB64 ?? await renderCover(config)
      onConfirm(b64)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div
        className="bg-surface rounded-2xl border border-outline-variant/20 flex flex-col overflow-hidden shadow-2xl"
        style={{ width: 'min(900px, 95vw)', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 shrink-0">
          <h2 className="text-[15px] font-medium text-on-surface m-0">Design Cover Page</h2>
          <button
            onClick={onCancel}
            className="bg-transparent border-0 text-lg text-on-surface-variant cursor-pointer p-1 leading-none hover:text-on-surface transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body — 2 cols */}
        <div
          className="overflow-y-auto flex-1 grid"
          style={{ gridTemplateColumns: '1fr 300px' }}
        >
          {/* Form col */}
          <div className="p-5 flex flex-col gap-4 border-r border-outline-variant/20 overflow-y-auto">

            {/* Template selector */}
            <div>
              <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1.5">
                Template
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {TEMPLATES.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => update('template', t.key)}
                    className={`p-2.5 rounded-xl text-left cursor-pointer flex flex-col gap-0.5 transition-colors ${
                      config.template === t.key
                        ? 'border-[1.5px] border-primary bg-primary/5'
                        : 'border border-outline-variant/30 hover:border-outline-variant/60'
                    }`}
                  >
                    <span className="text-xs font-medium text-on-surface">{t.label}</span>
                    <span className="text-[10px] text-on-surface-variant">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1.5" htmlFor="cpd-title">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="cpd-title"
                type="text"
                value={config.title}
                onChange={e => update('title', e.target.value)}
                placeholder="Story title"
                className="w-full px-2.5 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface text-[13px] outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1.5" htmlFor="cpd-subtitle">
                Subtitle / Volume
              </label>
              <input
                id="cpd-subtitle"
                type="text"
                value={config.subtitle}
                onChange={e => update('subtitle', e.target.value)}
                placeholder="e.g. Vol. 1, Chapter 1–5, …"
                className="w-full px-2.5 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface text-[13px] outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Author */}
            <div>
              <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1.5" htmlFor="cpd-author">
                Author
              </label>
              <input
                id="cpd-author"
                type="text"
                value={config.author}
                onChange={e => update('author', e.target.value)}
                placeholder="Author name"
                className="w-full px-2.5 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface text-[13px] outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Year */}
            <div>
              <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1.5" htmlFor="cpd-year">
                Year
              </label>
              <input
                id="cpd-year"
                type="text"
                value={config.year}
                onChange={e => update('year', e.target.value)}
                placeholder="2025"
                className="w-24 px-2.5 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface text-[13px] outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Character image */}
            <div>
              <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1.5">
                Character image
              </label>
              {config.characterB64 && (
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src={`data:image/png;base64,${config.characterB64}`}
                    alt="Character"
                    className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20"
                  />
                  <button
                    type="button"
                    className="text-[11px] text-on-surface-variant bg-transparent border-0 cursor-pointer underline hover:text-on-surface transition-colors"
                    onClick={() => update('characterB64', null)}
                  >
                    Remove
                  </button>
                </div>
              )}
              <label
                htmlFor="cpd-char-upload"
                className="inline-block text-xs px-3 py-1.5 rounded-xl border border-outline-variant/30 cursor-pointer text-on-surface hover:bg-surface-container-low transition-colors"
              >
                {config.characterB64 ? 'Change image' : 'Upload character image'}
              </label>
              <input
                id="cpd-char-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleCharacterUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Preview col */}
          <div className="p-5 flex flex-col gap-2">
            <span className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase">
              Preview
            </span>
            <div className="flex-1 flex items-start justify-center min-h-[300px] relative">
              {rendering && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-on-surface-variant">
                  <span
                    className="w-5 h-5 rounded-full border-2 border-outline-variant border-t-on-surface animate-spin"
                    aria-hidden="true"
                  />
                  Rendering…
                </div>
              )}
              {previewB64 && !rendering && (
                <img
                  src={`data:image/png;base64,${previewB64}`}
                  alt="Cover preview"
                  className="w-full rounded border border-outline-variant/20 block"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-outline-variant/20 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-outline-variant/30 bg-transparent text-on-surface text-[13px] cursor-pointer hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!config.title.trim() || confirming}
            className="px-5 py-2 rounded-xl border-0 bg-primary text-on-primary text-[13px] font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirming ? 'Generating…' : 'Add cover page'}
          </button>
        </div>
      </div>
    </div>
  )
}
