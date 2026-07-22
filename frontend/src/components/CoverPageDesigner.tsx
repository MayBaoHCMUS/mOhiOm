'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Type, ImagePlus, Trash2, ArrowUp, ArrowDown,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, RotateCcw,
} from 'lucide-react'
import {
  COVER_W, COVER_H, renderCoverDoc, renderDocToB64, createDefaultDoc, newLayerId,
  type CoverDoc, type CoverBgKind, type Layer, type TextLayer, type ImageLayer, type LayerBox,
} from '@/lib/coverPage'

const BACKGROUNDS: { key: CoverBgKind; label: string }[] = [
  { key: 'minimal',  label: 'Minimal'  },
  { key: 'manga',    label: 'Manga'    },
  { key: 'dark',     label: 'Dark'     },
  { key: 'artistic', label: 'Artistic' },
  { key: 'blank',    label: 'Blank'    },
]

interface CoverPageDesignerProps {
  storyTitle:    string
  characterB64?: string | null
  onConfirm:     (coverB64: string) => void
  onCancel:      () => void
}

interface Gesture {
  mode:   'move' | 'resize'
  id:     string
  kind:   'text' | 'image'
  startPX: number
  startPY: number
  startX:  number
  startY:  number
  aspect?: number   // image only
}

function darkTextFor(kind: CoverBgKind): string {
  return kind === 'dark' || kind === 'manga' ? '#FFFFFF' : '#111111'
}

export function CoverPageDesigner({
  storyTitle,
  characterB64,
  onConfirm,
  onCancel,
}: CoverPageDesignerProps) {
  const [doc,        setDoc]        = useState<CoverDoc | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [boxes,      setBoxes]      = useState<Record<string, LayerBox>>({})
  const [confirming, setConfirming] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgMap    = useRef<Record<string, HTMLImageElement | null>>({})
  const gesture   = useRef<Gesture | null>(null)
  const [imgTick, setImgTick] = useState(0)   // bumped when an image finishes loading

  const selected = doc?.layers.find(l => l.id === selectedId) ?? null

  // ── Mutation helpers ─────────────────────────────────────────────
  const updateLayer = useCallback((id: string, patch: Partial<TextLayer> | Partial<ImageLayer>) => {
    setDoc(d => d ? { ...d, layers: d.layers.map(l => l.id === id ? ({ ...l, ...patch } as Layer) : l) } : d)
  }, [])

  const removeLayer = useCallback((id: string) => {
    setDoc(d => d ? { ...d, layers: d.layers.filter(l => l.id !== id) } : d)
    setSelectedId(cur => cur === id ? null : cur)
  }, [])

  // ── Build the initial document ───────────────────────────────────
  useEffect(() => {
    let alive = true
    createDefaultDoc('minimal', { title: storyTitle, characterB64: characterB64 ?? null })
      .then(d => { if (alive) setDoc(d) })
    return () => { alive = false }
  }, [storyTitle, characterB64])

  // ── Keep image elements loaded for every image layer ─────────────
  useEffect(() => {
    if (!doc) return
    for (const l of doc.layers) {
      if (l.type !== 'image') continue
      const existing = imgMap.current[l.id]
      if (existing && existing.dataset.src === l.src) continue
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.dataset.src = l.src
      img.onload = () => { imgMap.current[l.id] = img; setImgTick(t => t + 1) }
      img.src = l.src.startsWith('data:') || l.src.startsWith('blob:') || l.src.startsWith('http')
        ? l.src
        : `data:image/png;base64,${l.src}`
      imgMap.current[l.id] = null
    }
  }, [doc])

  // ── Render the canvas whenever the doc (or a loaded image) changes ─
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !doc) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setBoxes(renderCoverDoc(ctx, doc, imgMap.current))
  }, [doc, imgTick])

  // ── Global pointer handlers for drag / resize (stable, ref-driven) ─
  useEffect(() => {
    function toCanvas(clientX: number, clientY: number) {
      const c = canvasRef.current
      if (!c) return { x: 0, y: 0 }
      const r = c.getBoundingClientRect()
      return {
        x: (clientX - r.left) * (COVER_W / r.width),
        y: (clientY - r.top)  * (COVER_H / r.height),
      }
    }
    function handleMove(e: PointerEvent) {
      const g = gesture.current
      if (!g) return
      const p = toCanvas(e.clientX, e.clientY)
      setDoc(d => {
        if (!d) return d
        return {
          ...d,
          layers: d.layers.map(l => {
            if (l.id !== g.id) return l
            if (g.mode === 'move') {
              return { ...l, x: Math.round(g.startX + (p.x - g.startPX)), y: Math.round(g.startY + (p.y - g.startPY)) } as Layer
            }
            if (l.type === 'image') {
              const aspect = g.aspect ?? l.width / l.height
              const wFromX = p.x - g.startX
              const wFromY = (p.y - g.startY) * aspect
              const w = Math.max(60, Math.min(COVER_W, Math.round(Math.max(wFromX, wFromY))))
              return { ...l, width: w, height: Math.round(w / aspect) } as Layer
            }
            const w = Math.max(80, Math.min(COVER_W, Math.round(p.x - g.startX)))
            return { ...l, width: w } as Layer
          }),
        }
      })
    }
    function handleUp() { gesture.current = null }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [])

  // ── Keyboard: nudge / delete selected layer ──────────────────────
  useEffect(() => {
    if (!selectedId) return
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const nudge = e.shiftKey ? 40 : 8
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLayer(selectedId!); return }
      const d: Record<string, [number, number]> = {
        ArrowUp: [0, -nudge], ArrowDown: [0, nudge], ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0],
      }
      const mv = d[e.key]
      if (!mv) return
      e.preventDefault()
      setDoc(prev => prev ? {
        ...prev,
        layers: prev.layers.map(l => l.id === selectedId
          ? ({ ...l, x: l.x + mv[0], y: l.y + mv[1] } as Layer) : l),
      } : prev)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function bumpZ(id: string, dir: 1 | -1) {
    setDoc(d => {
      if (!d) return d
      const zs = d.layers.map(l => l.z)
      const target = dir === 1 ? Math.max(...zs) + 1 : Math.min(...zs) - 1
      return { ...d, layers: d.layers.map(l => l.id === id ? { ...l, z: target } : l) }
    })
  }

  function addText() {
    if (!doc) return
    const maxZ = doc.layers.reduce((m, l) => Math.max(m, l.z), 0)
    const id = newLayerId('text')
    const layer: TextLayer = {
      id, type: 'text', z: maxZ + 1,
      text: 'New text', x: 80, y: Math.round(COVER_H / 2), width: COVER_W - 160,
      fontSize: 72, color: darkTextFor(doc.background.kind), font: 'sans',
      bold: false, italic: false, align: 'center',
    }
    setDoc(d => d ? { ...d, layers: [...d.layers, layer] } : d)
    setSelectedId(id)
  }

  function addImageFromFile(file: File) {
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      const probe = new Image()
      probe.onload = () => {
        setDoc(d => {
          if (!d) return d
          const maxZ = d.layers.reduce((m, l) => Math.max(m, l.z), 0)
          const h = Math.round(COVER_H * 0.42)
          const w = Math.round(probe.naturalWidth * (h / probe.naturalHeight))
          const id = newLayerId('img')
          const layer: ImageLayer = {
            id, type: 'image', z: maxZ + 1,
            src: dataUrl.split(',')[1], x: Math.round((COVER_W - w) / 2), y: 160, width: w, height: h,
          }
          setSelectedId(id)
          return { ...d, layers: [...d.layers, layer] }
        })
      }
      probe.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  async function resetLayout() {
    if (!doc) return
    const d = await createDefaultDoc(doc.background.kind, {
      title: storyTitle, characterB64: characterB64 ?? null,
    })
    d.background.color = doc.background.color
    imgMap.current = {}
    setSelectedId(null)
    setDoc(d)
  }

  async function handleConfirm() {
    if (!doc) return
    setConfirming(true)
    try {
      // Selection/resize chrome is a DOM overlay, never drawn to the canvas,
      // so the export is already clean.
      const b64 = await renderDocToB64(doc)
      onConfirm(b64)
    } finally {
      setConfirming(false)
    }
  }

  // ── Canvas gesture starters ──────────────────────────────────────
  function onCanvasPointerDown(e: React.PointerEvent) {
    if (!doc) return
    const c = canvasRef.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const px = (e.clientX - r.left) * (COVER_W / r.width)
    const py = (e.clientY - r.top)  * (COVER_H / r.height)
    const hit = [...doc.layers].sort((a, b) => b.z - a.z)
      .find(l => { const b = boxes[l.id]; return b && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h })
    if (!hit) { setSelectedId(null); return }
    setSelectedId(hit.id)
    gesture.current = {
      mode: 'move', id: hit.id, kind: hit.type,
      startPX: px, startPY: py, startX: hit.x, startY: hit.y,
    }
    e.preventDefault()
  }

  function onResizePointerDown(e: React.PointerEvent) {
    if (!selected) return
    e.stopPropagation()
    e.preventDefault()
    const c = canvasRef.current
    if (!c) return
    const r = c.getBoundingClientRect()
    gesture.current = {
      mode: 'resize', id: selected.id, kind: selected.type,
      startPX: (e.clientX - r.left) * (COVER_W / r.width),
      startPY: (e.clientY - r.top)  * (COVER_H / r.height),
      startX: selected.x, startY: selected.y,
      aspect: selected.type === 'image' ? selected.width / selected.height : undefined,
    }
  }

  const selBox = selectedId ? boxes[selectedId] : null

  // ── UI ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div
        className="bg-surface rounded-2xl border border-outline-variant/20 flex flex-col overflow-hidden shadow-2xl"
        style={{ width: 'min(1000px, 96vw)', maxHeight: '92vh' }}
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

        {/* Body — controls | canvas */}
        <div className="overflow-hidden flex-1 grid" style={{ gridTemplateColumns: '280px 1fr' }}>

          {/* Controls */}
          <div className="p-4 flex flex-col gap-4 border-r border-outline-variant/20 overflow-y-auto">

            {/* Background */}
            <div>
              <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1.5">
                Background
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {BACKGROUNDS.map(b => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setDoc(d => d ? { ...d, background: { ...d.background, kind: b.key } } : d)}
                    className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                      doc?.background.kind === b.key
                        ? 'border-[1.5px] border-primary bg-primary/5 text-on-surface'
                        : 'border border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {doc?.background.kind === 'blank' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={doc.background.color}
                    onChange={e => setDoc(d => d ? { ...d, background: { ...d.background, color: e.target.value } } : d)}
                    className="w-8 h-8 rounded cursor-pointer border border-outline-variant/30 bg-transparent p-0"
                    aria-label="Background color"
                  />
                  <span className="text-[11px] text-on-surface-variant">Background color</span>
                </div>
              )}
            </div>

            {/* Add elements */}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={addText}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-outline-variant/30 text-xs text-on-surface cursor-pointer hover:bg-surface-container-low transition-colors"
              >
                <Type size={14} /> Text
              </button>
              <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-outline-variant/30 text-xs text-on-surface cursor-pointer hover:bg-surface-container-low transition-colors">
                <ImagePlus size={14} /> Image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) addImageFromFile(f); e.target.value = '' }}
                />
              </label>
            </div>

            <div className="h-px bg-outline-variant/20" />

            {/* Selected layer properties */}
            {!selected && (
              <p className="text-[12px] text-on-surface-variant leading-relaxed">
                Drag any element on the canvas to move it. Grab the corner handle to resize.
                Select an element to edit it, or add text / an image above.
              </p>
            )}

            {selected?.type === 'text' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1.5">
                    Text
                  </label>
                  <textarea
                    value={selected.text}
                    onChange={e => updateLayer(selected.id, { text: e.target.value })}
                    rows={2}
                    className="w-full px-2.5 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface text-[13px] outline-none focus:border-primary transition-colors resize-y"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1">Size</label>
                    <input
                      type="number" min={12} max={240}
                      value={selected.fontSize}
                      onChange={e => updateLayer(selected.id, { fontSize: Math.max(12, Math.min(240, Number(e.target.value) || 12)) })}
                      className="w-full px-2 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-on-surface text-[13px] outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1">Color</label>
                    <input
                      type="color"
                      value={selected.color}
                      onChange={e => updateLayer(selected.id, { color: e.target.value })}
                      className="w-10 h-9 rounded cursor-pointer border border-outline-variant/30 bg-transparent p-0"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {([['bold', Bold], ['italic', Italic]] as const).map(([k, Icon]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => updateLayer(selected.id, { [k]: !selected[k] } as Partial<TextLayer>)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg border cursor-pointer transition-colors ${
                        selected[k] ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                      }`}
                      aria-label={k}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                  <div className="w-px h-6 bg-outline-variant/20 mx-0.5" />
                  {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => updateLayer(selected.id, { align: a })}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg border cursor-pointer transition-colors ${
                        selected.align === a ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                      }`}
                      aria-label={`Align ${a}`}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] font-medium text-on-surface-variant tracking-wider uppercase block mb-1">Font</label>
                  <div className="flex gap-1.5">
                    {(['sans', 'serif'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => updateLayer(selected.id, { font: f })}
                        className={`flex-1 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selected.font === f ? 'border-primary bg-primary/5 text-on-surface' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60'
                        } ${f === 'serif' ? 'font-serif' : ''}`}
                      >
                        {f === 'sans' ? 'Sans' : 'Serif'}
                      </button>
                    ))}
                  </div>
                </div>

                <LayerActions onForward={() => bumpZ(selected.id, 1)} onBack={() => bumpZ(selected.id, -1)} onDelete={() => removeLayer(selected.id)} />
              </div>
            )}

            {selected?.type === 'image' && (
              <div className="flex flex-col gap-3">
                <img
                  src={selected.src.startsWith('data:') || selected.src.startsWith('http') ? selected.src : `data:image/png;base64,${selected.src}`}
                  alt="Selected"
                  className="w-full max-h-32 object-contain rounded-lg border border-outline-variant/20 bg-surface-container-low"
                />
                <label className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-outline-variant/30 text-xs text-on-surface cursor-pointer hover:bg-surface-container-low transition-colors">
                  Replace image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      const reader = new FileReader()
                      reader.onload = ev => updateLayer(selected.id, { src: (ev.target?.result as string).split(',')[1] })
                      reader.readAsDataURL(f)
                      e.target.value = ''
                    }}
                  />
                </label>
                <LayerActions onForward={() => bumpZ(selected.id, 1)} onBack={() => bumpZ(selected.id, -1)} onDelete={() => removeLayer(selected.id)} />
              </div>
            )}

            <div className="mt-auto pt-2">
              <button
                type="button"
                onClick={resetLayout}
                className="flex items-center gap-1.5 text-[12px] text-on-surface-variant hover:text-on-surface bg-transparent border-0 cursor-pointer transition-colors"
              >
                <RotateCcw size={13} /> Reset to template layout
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="p-5 flex items-start justify-center bg-surface-container-low/40 overflow-y-auto">
            <div className="relative w-full" style={{ maxWidth: 'min(100%, 480px)' }}>
              <canvas
                ref={canvasRef}
                width={COVER_W}
                height={COVER_H}
                onPointerDown={onCanvasPointerDown}
                className="w-full block rounded border border-outline-variant/20 shadow-sm touch-none select-none"
                style={{ aspectRatio: `${COVER_W} / ${COVER_H}` }}
              />
              {/* Selection + resize chrome (DOM overlay, excluded from export) */}
              {selBox && (
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className="absolute border-[1.5px] border-primary border-dashed"
                    style={{
                      left:   `${(selBox.x / COVER_W) * 100}%`,
                      top:    `${(selBox.y / COVER_H) * 100}%`,
                      width:  `${(selBox.w / COVER_W) * 100}%`,
                      height: `${(selBox.h / COVER_H) * 100}%`,
                    }}
                  >
                    <div
                      onPointerDown={onResizePointerDown}
                      className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm bg-primary border border-white cursor-nwse-resize pointer-events-auto"
                      style={{ touchAction: 'none' }}
                    />
                  </div>
                </div>
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
            disabled={!doc || confirming}
            className="px-5 py-2 rounded-xl border-0 bg-primary text-on-primary text-[13px] font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirming ? 'Generating…' : 'Add cover page'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LayerActions({ onForward, onBack, onDelete }: { onForward: () => void; onBack: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onForward} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-outline-variant/30 text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors" title="Bring forward">
        <ArrowUp size={13} /> Front
      </button>
      <button type="button" onClick={onBack} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-outline-variant/30 text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors" title="Send back">
        <ArrowDown size={13} /> Back
      </button>
      <button type="button" onClick={onDelete} className="flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-red-500 hover:border-red-500/40 cursor-pointer transition-colors" title="Delete">
        <Trash2 size={13} />
      </button>
    </div>
  )
}
