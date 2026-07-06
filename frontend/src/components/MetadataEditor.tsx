'use client'

import { useEffect } from 'react'
import { saveMetadata, DEFAULT_METADATA, type ComicMetadata } from '@/lib/metadata'

interface MetadataEditorProps {
  metadata: ComicMetadata
  onChange: (meta: ComicMetadata) => void
}

const LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
]

export function MetadataEditor({ metadata, onChange }: MetadataEditorProps) {
  useEffect(() => {
    saveMetadata(metadata)
  }, [metadata])

  function update<K extends keyof ComicMetadata>(key: K, value: ComicMetadata[K]) {
    onChange({ ...metadata, [key]: value })
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Title */}
      <div>
        <label htmlFor="me-title" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
          Title <span className="text-red-500 normal-case font-bold">*</span>
        </label>
        <input
          id="me-title"
          type="text"
          value={metadata.title}
          onChange={e => update('title', e.target.value)}
          placeholder="My Comic"
          maxLength={120}
          className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-transparent text-on-surface text-xs focus:outline-none focus:border-primary/60 transition-colors"
        />
        <p className="text-[10px] text-on-surface-variant mt-1">
          Used as the exported file name and PDF/EPUB document title.
        </p>
      </div>

      {/* Author */}
      <div>
        <label htmlFor="me-author" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
          Author
        </label>
        <input
          id="me-author"
          type="text"
          value={metadata.author}
          onChange={e => update('author', e.target.value)}
          placeholder="Your name"
          maxLength={120}
          className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-transparent text-on-surface text-xs focus:outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="me-desc" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
          Description
        </label>
        <textarea
          id="me-desc"
          value={metadata.description}
          onChange={e => update('description', e.target.value)}
          placeholder="A short synopsis of your story…"
          maxLength={500}
          rows={3}
          className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-transparent text-on-surface text-xs focus:outline-none focus:border-primary/60 transition-colors resize-y leading-relaxed"
        />
      </div>

      {/* Series + Volume — 2 col */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="me-series" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
            Series
          </label>
          <input
            id="me-series"
            type="text"
            value={metadata.series}
            onChange={e => update('series', e.target.value)}
            placeholder="Series name"
            maxLength={80}
            className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-transparent text-on-surface text-xs focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="me-volume" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
            Volume
          </label>
          <input
            id="me-volume"
            type="text"
            value={metadata.volume}
            onChange={e => update('volume', e.target.value)}
            placeholder="Vol. 1"
            maxLength={40}
            className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-transparent text-on-surface text-xs focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
      </div>

      {/* Language + Year — 2 col */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="me-lang" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
            Language
          </label>
          <select
            id="me-lang"
            value={metadata.language}
            onChange={e => update('language', e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface text-on-surface text-xs focus:outline-none focus:border-primary/60 transition-colors cursor-pointer"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="me-year" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
            Year
          </label>
          <input
            id="me-year"
            type="text"
            value={metadata.year}
            onChange={e => update('year', e.target.value)}
            placeholder="2025"
            maxLength={9}
            className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-transparent text-on-surface text-xs focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
      </div>

      {/* Publisher */}
      <div>
        <label htmlFor="me-pub" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
          Publisher
        </label>
        <input
          id="me-pub"
          type="text"
          value={metadata.publisher}
          onChange={e => update('publisher', e.target.value)}
          placeholder="mOhiOm"
          maxLength={80}
          className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-transparent text-on-surface text-xs focus:outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_METADATA })}
        className="text-[11px] text-on-surface-variant hover:text-on-surface underline self-start bg-transparent border-0 cursor-pointer p-0 transition-colors"
      >
        Reset to defaults
      </button>
    </div>
  )
}
