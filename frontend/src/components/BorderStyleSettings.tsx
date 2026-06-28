'use client'

import { useRef, useState } from 'react'
import {
  recomposePages,
  DEFAULT_BORDER_CONFIG,
  type BorderConfig,
} from '@/lib/borderComposer'

// ── Border color presets ──────────────────────────────────────────
const BORDER_COLOR_PRESETS = [
  { label: 'Black',     hex: '#111827', border: undefined },
  { label: 'White',     hex: '#FFFFFF', border: '#D1D5DB' },
  { label: 'Dark Gray', hex: '#374151', border: undefined },
  { label: 'Sepia',     hex: '#8B6914', border: undefined },
  { label: 'Blue',      hex: '#2563EB', border: undefined },
]

// ── Page background presets ───────────────────────────────────────
const BG_PRESETS = [
  { label: 'White',     hex: '#FFFFFF', border: '#D1D5DB', textColor: '#374151' },
  { label: 'Off-white', hex: '#FAF7F2', border: '#D1D5DB', textColor: '#374151' },
  { label: 'Black',     hex: '#111827', border: undefined,  textColor: '#FFFFFF' },
  { label: 'Gray',      hex: '#6B7280', border: undefined,  textColor: '#FFFFFF' },
  { label: 'Sepia',     hex: '#F5E6D3', border: '#D1D5DB', textColor: '#374151' },
]

interface SwatchProps {
  hex:       string
  border?:   string
  label:     string
  selected:  boolean
  textColor?: string
  onClick:   () => void
}

function Swatch({ hex, border, label, selected, textColor, onClick }: SwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: hex,
        border: `1.5px solid ${border ?? '#E5E7EB'}`,
        cursor: 'pointer',
        transition: 'box-shadow 120ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: selected
          ? '0 0 0 2px #FFFFFF, 0 0 0 4px #2563EB'
          : undefined,
      }}
    >
      {selected && (
        <span style={{ fontSize: 10, fontWeight: 700, color: textColor ?? '#FFFFFF', lineHeight: 1 }}>✓</span>
      )}
    </button>
  )
}

interface BorderStyleSettingsProps {
  config:          BorderConfig
  onChange:        (config: BorderConfig) => void
  samplePanels:    string[]
  sampleLayoutKey: string
  allPanelImages:  string[][]
  allLayouts:      string[]
  onApply:         (newPages: string[]) => void
}

export function BorderStyleSettings({
  config,
  onChange,
  samplePanels: _samplePanels,
  sampleLayoutKey: _sampleLayoutKey,
  allPanelImages,
  allLayouts,
  onApply,
}: BorderStyleSettingsProps) {
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const customBorderRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof BorderConfig>(key: K, value: BorderConfig[K]) {
    onChange({ ...config, [key]: value })
  }

  async function doApply() {
    setConfirming(false)
    if (applying || !allPanelImages.length) return
    setApplying(true)
    setProgress(null)
    try {
      const newPages = await recomposePages(
        allPanelImages, allLayouts, config,
        (c, t) => setProgress({ current: c, total: t }),
      )
      onApply(newPages)
    } finally {
      setApplying(false)
      setProgress(null)
    }
  }

  const canApply = allPanelImages.length > 0 && !applying

  return (
    <div className="flex flex-col gap-3">

      {/* Border color */}
      <div>
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Border color</p>
        <div className="flex items-center gap-2 flex-wrap">
          {BORDER_COLOR_PRESETS.map(p => (
            <Swatch
              key={p.hex}
              hex={p.hex}
              border={p.border}
              label={p.label}
              selected={config.borderColor.toUpperCase() === p.hex.toUpperCase()}
              textColor={p.hex === '#FFFFFF' ? '#374151' : '#FFFFFF'}
              onClick={() => update('borderColor', p.hex)}
            />
          ))}
          {/* Custom color picker */}
          <button
            type="button"
            title="Custom color"
            onClick={() => customBorderRef.current?.click()}
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              border: '1.5px solid #E5E7EB',
              cursor: 'pointer',
              opacity: 0.85,
              flexShrink: 0,
            }}
          />
          <input
            ref={customBorderRef}
            type="color"
            value={config.borderColor}
            onChange={e => update('borderColor', e.target.value)}
            className="sr-only"
            aria-label="Custom border color"
          />
        </div>
      </div>

      {/* Border width */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="bs-bwidth" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
            Border width
          </label>
          <span className="text-[10px] font-semibold text-on-surface">{config.borderWidth}px</span>
        </div>
        <input
          id="bs-bwidth"
          type="range"
          min={0} max={8} step={1}
          value={config.borderWidth}
          onChange={e => update('borderWidth', parseInt(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-on-surface-variant mt-0.5">
          <span>None</span>
          <span>Thick</span>
        </div>
      </div>

      {/* Gutter width */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="bs-gwidth" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
            Gutter width
          </label>
          <span className="text-[10px] font-semibold text-on-surface">{config.gutterWidth}px</span>
        </div>
        <input
          id="bs-gwidth"
          type="range"
          min={0} max={40} step={2}
          value={config.gutterWidth}
          onChange={e => update('gutterWidth', parseInt(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-on-surface-variant mt-0.5">
          <span>Tight</span>
          <span>Airy</span>
        </div>
      </div>

      {/* Page background */}
      <div>
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Page background</p>
        <div className="flex items-center gap-2 flex-wrap">
          {BG_PRESETS.map(p => (
            <Swatch
              key={p.hex}
              hex={p.hex}
              border={p.border}
              label={p.label}
              selected={config.pageBg.toUpperCase() === p.hex.toUpperCase()}
              textColor={p.textColor}
              onClick={() => update('pageBg', p.hex)}
            />
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_BORDER_CONFIG })}
        className="text-[11px] text-on-surface-variant hover:text-on-surface underline self-start bg-transparent border-0 cursor-pointer p-0 transition-colors"
      >
        Reset to defaults
      </button>

      <div className="h-px bg-outline-variant/20" />

      {/* Apply — secondary outlined button with inline confirmation */}
      {!allPanelImages.length && (
        <p className="text-[11px] text-on-surface-variant">
          Panel images are required to apply border styles.
        </p>
      )}
      {progress && (
        <p className="text-[11px] text-on-surface-variant" aria-live="polite">
          Re-composing page {progress.current} of {progress.total}…
        </p>
      )}

      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-on-surface-variant flex-1">
            Apply to all {allPanelImages.length} pages?
          </span>
          <button
            type="button"
            onClick={doApply}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold"
          >
            ✓ Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-[11px] font-semibold"
          >
            ✕ Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => canApply && setConfirming(true)}
          disabled={!canApply}
          aria-busy={applying}
          className="w-full py-2.5 rounded-xl border-[1.5px] border-primary bg-white text-primary text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors hover:bg-blue-50"
        >
          {applying
            ? `Re-composing… (${progress?.current ?? 0}/${allPanelImages.length})`
            : 'Apply to all pages'}
        </button>
      )}
    </div>
  )
}
