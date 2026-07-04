'use client'

import { useRef } from 'react'
import type { PageNumberConfig, PageNumberShape } from '@/lib/pageNumbering'

const SHAPES: { key: PageNumberShape; label: string }[] = [
  { key: 'pill',   label: 'Pill'   },
  { key: 'circle', label: 'Circle' },
  { key: 'square', label: 'Square' },
  { key: 'none',   label: 'None'   },
]

const COLOR_PRESETS = [
  { hex: '#111827', border: undefined,  textColor: '#FFFFFF', label: 'Black'     },
  { hex: '#FFFFFF', border: '#D1D5DB',  textColor: '#374151', label: 'White'     },
  { hex: '#374151', border: undefined,  textColor: '#FFFFFF', label: 'Dark gray' },
  { hex: '#F5E6D3', border: '#D1D5DB',  textColor: '#374151', label: 'Sepia'     },
  { hex: '#2563EB', border: undefined,  textColor: '#FFFFFF', label: 'Blue'      },
]

interface SwatchRowProps {
  label:    string
  value:    string
  onChange: (hex: string) => void
}

function SwatchRow({ label, value, onChange }: SwatchRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {COLOR_PRESETS.map(p => {
          const selected = value.toUpperCase() === p.hex.toUpperCase()
          return (
            <button
              key={p.hex}
              type="button"
              title={p.label}
              onClick={() => onChange(p.hex)}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: p.hex,
                border: `1.5px solid ${p.border ?? '#E5E7EB'}`,
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'box-shadow 120ms ease',
                boxShadow: selected ? '0 0 0 2px #FFFFFF, 0 0 0 4px #2563EB' : undefined,
              }}
            >
              {selected && (
                <span style={{ fontSize: 10, fontWeight: 700, color: p.textColor, lineHeight: 1 }}>✓</span>
              )}
            </button>
          )
        })}
        {/* Custom color */}
        <button
          type="button"
          title="Custom color"
          onClick={() => inputRef.current?.click()}
          style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
            border: '1.5px solid #E5E7EB',
            cursor: 'pointer', opacity: 0.85, flexShrink: 0,
          }}
        />
        <input ref={inputRef} type="color" value={value} onChange={e => onChange(e.target.value)} className="sr-only" />
      </div>
    </div>
  )
}

interface PageNumberingSettingsProps {
  config:     PageNumberConfig
  onChange:   (c: PageNumberConfig) => void
  totalPages: number
}

export function PageNumberingSettings({ config, onChange, totalPages }: PageNumberingSettingsProps) {
  function set<K extends keyof PageNumberConfig>(key: K, value: PageNumberConfig[K]) {
    onChange({ ...config, [key]: value })
  }

  return (
    <div className="space-y-3 p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
      {/* Enable toggle */}
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-xs font-semibold text-on-surface">Page numbers</span>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => set('enabled', !config.enabled)}
          className={`w-9 h-5 rounded-full transition-colors ${config.enabled ? 'bg-primary' : 'bg-outline-variant'}`}
        >
          <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${config.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </label>

      {config.enabled && (
        <>
          {/* Shape */}
          <div>
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Shape</p>
            <div className="flex gap-1">
              {SHAPES.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => set('shape', s.key)}
                  className={`flex-1 py-1 text-[10px] rounded-lg border transition-colors ${
                    config.shape === s.key
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Badge color — only shown when a shape is active */}
          {config.shape !== 'none' && (
            <SwatchRow label="Badge color" value={config.shapeBg} onChange={v => set('shapeBg', v)} />
          )}

          {/* Text color */}
          <SwatchRow label="Text color" value={config.color} onChange={v => set('color', v)} />

          {/* Position */}
          <div>
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Position</p>
            <div className="flex gap-1">
              {(['bottom-left', 'bottom-center', 'bottom-right'] as const).map(pos => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => set('position', pos)}
                  className={`flex-1 py-1 text-[10px] rounded-lg border transition-colors ${
                    config.position === pos
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {pos === 'bottom-left' ? 'Left' : pos === 'bottom-center' ? 'Center' : 'Right'}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[11px] text-on-surface-variant">Size</span>
              <span className="text-[11px] text-on-surface-variant">{config.fontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={48}
              value={config.fontSize}
              onChange={e => set('fontSize', parseInt(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Start page */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-on-surface-variant shrink-0">Start at</label>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={config.startPage}
              onChange={e => set('startPage', Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 text-sm border border-outline-variant/30 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </>
      )}
    </div>
  )
}
