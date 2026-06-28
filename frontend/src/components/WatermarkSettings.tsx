'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
import {
  DEFAULT_WATERMARK_TEMPLATE,
  type WatermarkConfig,
  type WatermarkTemplate,
} from '@/lib/watermark'

const COLOR_PRESETS = [
  { hex: '#111827', border: undefined,  textColor: '#FFFFFF', label: 'Black'     },
  { hex: '#FFFFFF', border: '#D1D5DB',  textColor: '#374151', label: 'White'     },
  { hex: '#374151', border: undefined,  textColor: '#FFFFFF', label: 'Dark gray' },
  { hex: '#F5E6D3', border: '#D1D5DB',  textColor: '#374151', label: 'Sepia'     },
  { hex: '#2563EB', border: undefined,  textColor: '#FFFFFF', label: 'Blue'      },
]

interface WatermarkSettingsProps {
  template:         WatermarkTemplate
  onTemplateChange: (t: WatermarkTemplate) => void
  watermarks:       WatermarkConfig[]
  onAdd:            () => void
  onDelete:         (id: string) => void
}

export function WatermarkSettings({
  template,
  onTemplateChange,
  watermarks,
  onAdd,
  onDelete,
}: WatermarkSettingsProps) {
  const customColorRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof WatermarkTemplate>(key: K, value: WatermarkTemplate[K]) {
    onTemplateChange({ ...template, [key]: value })
  }

  const canAdd = template.text.trim().length > 0

  return (
    <div className="space-y-3 p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/20">

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-on-surface">Watermarks</span>
        {watermarks.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {watermarks.length} on canvas
          </span>
        )}
      </div>

      {/* Text */}
      <div>
        <label htmlFor="wm-text" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
          Text
        </label>
        <input
          id="wm-text"
          type="text"
          value={template.text}
          onChange={e => set('text', e.target.value)}
          placeholder="© MyComic 2025"
          maxLength={80}
          className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-transparent text-on-surface text-xs focus:outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      {/* Style preview + Add button */}
      {canAdd && (
        <>
          <div className="flex items-stretch gap-2">
            {/* Draggable style preview */}
            <div
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('application/watermark-drag', 'true')
                e.dataTransfer.effectAllowed = 'copy'
              }}
              style={{
                flex: 1,
                height: 52,
                background: '#F3F4F6',
                borderRadius: 8,
                border: '1.5px dashed #93C5FD',
                cursor: 'grab',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  transform:  `rotate(${template.rotation}deg)`,
                  color:      template.color,
                  opacity:    template.opacity,
                  fontSize:   Math.max(8, Math.min(template.fontSize * 0.38, 20)),
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: 400,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  userSelect:    'none',
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center',
                  display: 'block',
                }}
              >
                {template.text}
              </span>
            </div>

            {/* Add to canvas */}
            <button
              type="button"
              onClick={onAdd}
              title="Add watermark to canvas at centre"
              className="px-3 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-[11px] font-semibold transition-colors shrink-0"
            >
              + Add
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant text-center -mt-1">
            Drag preview onto canvas · or click Add
          </p>
        </>
      )}

      {/* Color */}
      <div>
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Color</p>
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_PRESETS.map(p => {
            const selected = template.color.toUpperCase() === p.hex.toUpperCase()
            return (
              <button
                key={p.hex}
                type="button"
                title={p.label}
                onClick={() => set('color', p.hex)}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: p.hex,
                  border: `1.5px solid ${p.border ?? '#E5E7EB'}`,
                  cursor: 'pointer', flexShrink: 0,
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
          <button
            type="button"
            title="Custom color"
            onClick={() => customColorRef.current?.click()}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              border: '1.5px solid #E5E7EB',
              cursor: 'pointer', opacity: 0.85, flexShrink: 0,
            }}
          />
          <input ref={customColorRef} type="color" value={template.color} onChange={e => set('color', e.target.value)} className="sr-only" />
        </div>
      </div>

      {/* Opacity */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="wm-opacity" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Opacity</label>
          <span className="text-[10px] font-semibold text-on-surface">{Math.round(template.opacity * 100)}%</span>
        </div>
        <input id="wm-opacity" type="range" min={0.05} max={0.60} step={0.05}
          value={template.opacity} onChange={e => set('opacity', parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Rotation */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="wm-rotation" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Rotation</label>
          <span className="text-[10px] font-semibold text-on-surface">{template.rotation}°</span>
        </div>
        <input id="wm-rotation" type="range" min={-45} max={45} step={1}
          value={template.rotation} onChange={e => set('rotation', parseInt(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-on-surface-variant mt-0.5">
          <span>−45°</span><span>+45°</span>
        </div>
      </div>

      {/* Font size */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="wm-size" className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Size</label>
          <span className="text-[10px] font-semibold text-on-surface">{template.fontSize}px</span>
        </div>
        <input id="wm-size" type="range" min={16} max={80} step={2}
          value={template.fontSize} onChange={e => set('fontSize', parseInt(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Reset template */}
      <button
        type="button"
        onClick={() => onTemplateChange({ ...DEFAULT_WATERMARK_TEMPLATE })}
        className="text-[11px] text-on-surface-variant hover:text-on-surface underline bg-transparent border-0 cursor-pointer p-0 transition-colors"
      >
        Reset style
      </button>

      {/* Active watermarks list */}
      {watermarks.length > 0 && (
        <>
          <div className="h-px bg-outline-variant/20" />
          <div>
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">On canvas</p>
            <div className="space-y-1">
              {watermarks.map((w, i) => (
                <div key={w.id} className="flex items-center gap-2 px-2 py-1.5 bg-surface-container-low rounded-lg">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: w.color, flexShrink: 0, border: '1px solid #E5E7EB' }} />
                  <span className="flex-1 text-[11px] text-on-surface truncate">
                    {w.text || `Watermark ${i + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(w.id)}
                    className="text-on-surface-variant/50 hover:text-red-500 transition-colors shrink-0 p-0 bg-transparent border-0 cursor-pointer"
                    title="Remove"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
