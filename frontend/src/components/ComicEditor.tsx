'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Hash,
  ImagePlus,
  Layers,
  Loader2,
  Palette,
  X,
} from 'lucide-react'
import { useComicGeneration } from '@/context/ComicGenerationContext'
import type { Step4Panel, Step4PanelState } from '@/context/ComicGenerationContext'
import { BASE_PAGE_W, MangaBubbleSVG } from '@/components/studio-steps/DialogueEditor'
import type { PanelBubbles } from '@/components/studio-steps/DialogueEditor'
import {
  LAYOUT_PANEL_RECTS,
  TEMPLATES_BY_COUNT,
} from '@/components/studio-steps/Step4Generation'
import { CoverPageDesigner } from '@/components/CoverPageDesigner'
import { ChapterDividerDesigner } from '@/components/ChapterDividerDesigner'
import { PageNumberingSettings } from '@/components/PageNumberingSettings'
import { WatermarkSettings } from '@/components/WatermarkSettings'
import { BorderStyleSettings } from '@/components/BorderStyleSettings'
import { applyPageNumbering, DEFAULT_PAGE_NUMBER_CONFIG } from '@/lib/pageNumbering'
import type { PageNumberConfig } from '@/lib/pageNumbering'
import { applyWatermark, createWatermark, DEFAULT_WATERMARK_TEMPLATE } from '@/lib/watermark'
import type { WatermarkConfig, WatermarkTemplate } from '@/lib/watermark'
import { DEFAULT_BORDER_CONFIG, previewBorderStyle, recomposePages } from '@/lib/borderComposer'
import { compositePanelToBlob } from '@/lib/bubbles/exportComposite'
import type { BorderConfig } from '@/lib/borderComposer'
import { PAGE_W, PAGE_H } from '@/lib/layoutTemplates'
import { exportAsZip, exportAsPdf, exportAsEpub, exportAsCbz } from '@/lib/export'
import type { ExportPage } from '@/lib/export'
import { loadMetadata, type ComicMetadata } from '@/lib/metadata'
import { MetadataEditor } from '@/components/MetadataEditor'
import { bubblesApi } from '@/services/api'
import type { CloudProjectListItem } from '@/services/api'

type ExportFormat   = 'pdf' | 'cbz' | 'png' | 'epub'
type FinishSection  = 'cover' | 'style' | 'overlays' | 'info'

// ── coordinate space: LAYOUT_PANEL_RECTS uses a 48 × 64 grid ──────
const PBW = 48
const PBH = 64

// Canvas display dimensions — match the compositing canvas ratio (PAGE_W×PAGE_H)
// so dividers, recomposed pages, and panel pages all appear the same size.
const CANVAS_W = BASE_PAGE_W
const CANVAS_H = Math.round(BASE_PAGE_W * (PAGE_H / PAGE_W))  // 600 × (1600/1200) = 800

function rectToStyle(r: { x: number; y: number; w: number; h: number }) {
  return {
    left:   `${(r.x / PBW) * 100}%`,
    top:    `${(r.y / PBH) * 100}%`,
    width:  `${(r.w / PBW) * 100}%`,
    height: `${(r.h / PBH) * 100}%`,
  }
}

function defaultLayout(panelCount: number): string {
  return (TEMPLATES_BY_COUNT[panelCount] ?? TEMPLATES_BY_COUNT[1])?.[0] ?? 'single'
}

interface DividerPage {
  afterPage: number  // 0 = before page 1, N = after page N
  b64: string
}

// ── Gradient system (matches Home + Publish pages) ─────────────────
const PROJECT_GRADIENTS_EDITOR = [
  'from-violet-900 via-purple-800 to-indigo-900',
  'from-slate-900 via-blue-900 to-cyan-900',
  'from-rose-900 via-pink-800 to-fuchsia-900',
  'from-amber-900 via-orange-800 to-red-900',
  'from-emerald-900 via-teal-800 to-cyan-900',
  'from-indigo-900 via-violet-800 to-purple-900',
]
function gradientForProject(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PROJECT_GRADIENTS_EDITOR[hash % PROJECT_GRADIENTS_EDITOR.length]
}

const EDITOR_ACCENT_COLORS = [
  '#7C3AED', '#0891B2', '#059669', '#DC2626',
  '#D97706', '#2563EB', '#DB2777', '#65A30D',
]
function editorAccentFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return EDITOR_ACCENT_COLORS[hash % EDITOR_ACCENT_COLORS.length]
}

const formatEditorTitle = (slug: string): string =>
  slug.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function formatEditorDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1)   return 'just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7)   return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

const EDITOR_STEP_BADGES = [
  { label: 'S1', key: 'has_step1' as const, title: 'Story Setup' },
  { label: 'S2', key: 'has_step2' as const, title: 'Story Breakdown' },
  { label: 'S3', key: 'has_step2_images' as const, title: 'Designs & References' },
  { label: 'S4', key: 'has_step3' as const, title: 'Panel Script' },
  { label: 'S5', key: 'has_step4' as const, title: 'Image Generation' },
]

// ── Project picker ─────────────────────────────────────────────────
function ProjectPicker({
  onSelect, onGoPipeline,
}: {
  onSelect: (id: string) => Promise<void>
  onGoPipeline: () => void
}) {
  const { listCloudProjects } = useComicGeneration()
  const [projects, setProjects] = useState<CloudProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    listCloudProjects()
      .then(list => setProjects(list.filter(p => p.has_step4)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [listCloudProjects])

  async function openProject(id: string) {
    setLoadingId(id)
    await onSelect(id)
    setLoadingId(null)
  }

  return (
    <div className="flex flex-col bg-white flex-1 overflow-y-auto">

      {/* Page header — #F8FAFF band */}
      <div style={{ background: '#F8FAFF', borderBottom: '1px solid #E5E7EB', padding: '28px 32px 24px 32px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4, lineHeight: 1.2 }}>
          Comic Editor
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
          Open a project to continue editing your comic
        </p>
      </div>

      {/* Content */}
      <div className="px-8 py-8 flex-1">

        {/* Section header */}
        {!loading && (
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <p className="text-[18px] font-semibold text-on-surface">Your Projects</p>
              <p className="text-[12px] text-on-surface-variant mt-0.5">
                Projects with completed image generation are ready to edit
              </p>
            </div>
            {projects.length > 0 && (
              <span className="text-[12px] text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full shrink-0">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-on-surface-variant py-16">
            <Loader2 size={18} className="animate-spin" />
            Loading cloud projects…
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center text-center mt-16 max-w-sm mx-auto">
            <Layers size={40} className="text-outline-variant mb-4" />
            <p className="text-[18px] font-semibold text-on-surface mb-2">No projects ready to edit</p>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              Complete image generation in the Comic Pipeline to unlock a project for editing here.
            </p>
            <button
              type="button"
              onClick={onGoPipeline}
              className="mt-6 px-6 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary/90 transition-colors"
            >
              Go to Comic Pipeline →
            </button>
          </div>
        )}

        {/* Card grid */}
        {!loading && projects.length > 0 && (
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {projects.map(p => {
              const gradient = gradientForProject(p.project_id)
              const accent = editorAccentFor(p.project_id)
              const displayTitle = formatEditorTitle(p.project_id)
              const genre = p.genre?.split('/')[0].split(',')[0].trim()
              const isLoading = loadingId === p.project_id

              return (
                <div
                  key={p.project_id}
                  onClick={() => openProject(p.project_id)}
                  className="group bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all cursor-pointer"
                >
                  {/* Gradient thumbnail */}
                  <div className={`relative h-[72px] bg-gradient-to-br ${gradient} flex flex-col justify-between p-3`}>
                    {genre && (
                      <span className="self-start text-[9px] font-bold uppercase tracking-[0.06em] text-white bg-black/30 rounded px-1.5 py-0.5">
                        {genre}
                      </span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.90)', textShadow: '0 1px 3px rgba(0,0,0,0.30)', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayTitle}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3" style={{ borderLeft: `4px solid ${accent}` }}>
                    {/* Title + slug */}
                    <div className="mb-1">
                      <p className="text-[13px] font-bold text-on-surface truncate" title={p.project_id}>
                        {displayTitle}
                      </p>
                      <span style={{ fontSize: 10, color: '#D1D5DB', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                        {p.project_id}
                      </span>
                    </div>

                    {/* Subtitle: genre · relative date */}
                    <p className="text-[11px] text-on-surface-variant mb-2.5"
                      title={new Date(p.saved_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}>
                      {[genre, `Last saved ${formatEditorDate(p.saved_at)}`].filter(Boolean).join(' · ')}
                    </p>

                    {/* Step badges S1–S5 */}
                    <div className="flex items-center gap-1 mb-3">
                      {EDITOR_STEP_BADGES.map(({ label, key, title }) => {
                        const done = !!p[key]
                        return (
                          <span key={label} title={`${title}${done ? ' ✓' : ''}`} style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 26, height: 20, borderRadius: 10, fontSize: 9, fontWeight: 700,
                            ...(done
                              ? { background: '#DCFCE7', color: '#16A34A', border: 'none' }
                              : { background: 'transparent', color: '#D1D5DB', border: '1.5px solid #E5E7EB' }),
                          }}>
                            {label}
                          </span>
                        )
                      })}
                    </div>

                    {/* Open button */}
                    <button
                      type="button"
                      disabled={loadingId !== null}
                      onClick={e => { e.stopPropagation(); openProject(p.project_id) }}
                      className="w-full h-9 rounded-xl border-[1.5px] border-primary text-primary text-[13px] font-semibold hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isLoading && <Loader2 size={12} className="animate-spin" />}
                      {isLoading ? 'Opening…' : 'Open in Editor'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Divider insert zone / active chapter bar between page thumbnails ─
function ChapterDividerZone({
  afterPage,
  isActive,
  chapterNumber,
  onInsert,
  onRemove,
  onSelect,
}: {
  afterPage:     number
  isActive:      boolean
  chapterNumber: number
  onInsert:      (p: number) => void
  onRemove:      (p: number) => void
  onSelect?:     () => void
}) {
  if (isActive) {
    return (
      <div
        onClick={onSelect}
        style={{ height: 28, width: '100%', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
      >
        {/* Dark bar */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 4, background: '#1E293B', borderRadius: 2 }} />
        {/* Ch. N label */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', background: '#1E293B', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', zIndex: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#FFFFFF' }}>Ch. {chapterNumber}</span>
        </div>
        {/* Remove */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove(afterPage) }}
          style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', zIndex: 2 }}
          title="Remove divider"
        >
          <X size={10} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="group relative flex items-center justify-center cursor-pointer px-3"
      style={{ height: 20 }}
      onClick={() => onInsert(afterPage)}
      title="Insert chapter divider here"
    >
      <div className="absolute inset-x-3 h-px bg-outline-variant/30 group-hover:bg-primary group-hover:h-0.5 transition-all duration-150" />
      <div className="relative z-10 w-4 h-4 rounded-full bg-surface-container-low border border-outline-variant/40 flex items-center justify-center transition-all duration-150 group-hover:bg-primary group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/25">
        <span className="text-[9px] leading-none text-outline-variant group-hover:text-white font-bold transition-colors duration-150">+</span>
      </div>
    </div>
  )
}

// ── Divider preview in center canvas ─────────────────────────────
function DividerPreview({ b64 }: { b64: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      const availW = el.clientWidth - 48
      const availH = el.clientHeight - 48
      setScale(Math.min(availW / CANVAS_W, availH / CANVAS_H, 1.3))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center bg-surface-container-low overflow-hidden"
    >
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${b64}`}
          alt="Chapter divider"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    </div>
  )
}

// ── Left page strip ────────────────────────────────────────────────
function PageStrip({
  panelsByPage,
  panelStates,
  pageStates,
  selectedPage,
  selectedDivider,
  dividerPages,
  onSelect,
  onSelectDivider,
  onInsertDivider,
  onRemoveDivider,
}: {
  panelsByPage:    Array<[number, Step4Panel[]]>
  panelStates:     Record<string, Step4PanelState>
  pageStates:      Record<string, Step4PanelState>
  selectedPage:    number
  selectedDivider: number | null
  dividerPages:    DividerPage[]
  onSelect:        (page: number) => void
  onSelectDivider: (afterPage: number | null) => void
  onInsertDivider: (afterPage: number) => void
  onRemoveDivider: (afterPage: number) => void
}) {
  // Compute chapter numbers: sort dividers by afterPage and assign sequential numbers
  const dividerChapterNums = dividerPages
    .slice()
    .sort((a, b) => a.afterPage - b.afterPage)
    .reduce<Record<number, number>>((acc, d, i) => { acc[d.afterPage] = i + 1; return acc }, {})

  return (
    <div className="w-40 shrink-0 flex flex-col overflow-y-auto bg-surface-container-low border-r border-outline-variant/20 py-3 pb-20">
      {panelsByPage.map(([page, panels], pageIdx) => {
        const isActive = page === selectedPage && selectedDivider === null
        const pageImageUrl = pageStates[`page-${page}`]?.imageUrl ?? null
        const layout = defaultLayout(panels.length)
        const rects  = LAYOUT_PANEL_RECTS[layout] ?? LAYOUT_PANEL_RECTS['single']
        const order  = panels.map(p => p.id)

        // Completion badge data
        const generatedCount = pageImageUrl
          ? 1
          : panels.filter(p => panelStates[p.id]?.imageUrl).length
        const totalCount = pageImageUrl ? 1 : panels.length
        const isComplete = generatedCount === totalCount
        const isEmpty    = generatedCount === 0

        return (
          <div key={`pg-${page}`} className="flex flex-col">
            {/* Divider zone BEFORE this page (only for first page = afterPage 0) */}
            {pageIdx === 0 && (() => {
              const afterPage = 0
              const divActive = !!dividerPages.find(d => d.afterPage === afterPage)
              return (
                <ChapterDividerZone
                  afterPage={afterPage}
                  isActive={divActive}
                  chapterNumber={dividerChapterNums[afterPage] ?? 1}
                  onInsert={onInsertDivider}
                  onRemove={onRemoveDivider}
                  onSelect={() => { onSelectDivider(afterPage) }}
                />
              )
            })()}

            {/* Page thumbnail */}
            <button
              onClick={() => { onSelect(page); onSelectDivider(null) }}
              className={`mx-3 rounded-xl overflow-hidden border-2 transition-all ${
                isActive ? 'border-primary shadow-[0_0_0_3px_#DBEAFE]' : 'border-transparent hover:border-outline-variant/40'
              }`}
            >
              <div
                className="relative bg-white"
                style={{ paddingTop: `${(CANVAS_H / CANVAS_W) * 100}%` }}
              >
              {pageImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pageImageUrl}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                // Panel mode thumbnail — panel grid
                rects.map((rect, i) => {
                  const panelId = order[i]
                  const state = panelId ? panelStates[panelId] : null
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        ...rectToStyle(rect),
                        background: '#F3F4F6',
                        outline: '0.5px solid #E5E7EB',
                        overflow: 'hidden',
                      }}
                    >
                      {state?.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={state.imageUrl}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                  )
                })
              )}

              {/* Page number badge — bottom-left */}
              <div style={{ position: 'absolute', bottom: 4, left: 4, zIndex: 10, background: 'rgba(0,0,0,0.55)', borderRadius: 3, padding: '1px 5px', pointerEvents: 'none' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.4 }}>P{page}</span>
              </div>

              {/* Completion badge — top-right */}
              <div style={{
                position: 'absolute', top: 4, right: 4, zIndex: 10,
                background: isComplete ? '#16A34A' : isEmpty ? 'rgba(0,0,0,0.40)' : '#D97706',
                borderRadius: 3, padding: '1px 5px', pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: isComplete ? '#FFFFFF' : isEmpty ? 'rgba(255,255,255,0.9)' : '#FFFFFF', lineHeight: 1.4 }}>
                  {generatedCount}/{totalCount}
                </span>
              </div>
            </div>
          </button>

          {/* Divider zone AFTER this page */}
          {(() => {
            const afterPage = page
            const divActive = !!dividerPages.find(d => d.afterPage === afterPage)
            return (
              <ChapterDividerZone
                afterPage={afterPage}
                isActive={divActive}
                chapterNumber={dividerChapterNums[afterPage] ?? 1}
                onInsert={onInsertDivider}
                onRemove={onRemoveDivider}
                onSelect={() => { onSelectDivider(afterPage) }}
              />
            )
          })()}
        </div>
      )
      })}
    </div>
  )
}

// ── Draggable watermark overlay on the canvas ──────────────────────
function WatermarkDragHandle({
  config,
  scale,
  onMove,
  onDelete,
}: {
  config:   WatermarkConfig
  scale:    number
  onMove:   (id: string, x: number, y: number) => void
  onDelete: (id: string) => void
}) {
  const isDragging = useRef(false)
  const start      = useRef({ mx: 0, my: 0, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [hovering, setHovering] = useState(false)

  const isActive = hovering || dragging

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    setDragging(true)
    start.current = { mx: e.clientX, my: e.clientY, x: config.x, y: config.y }

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current) return
      const dx = (ev.clientX - start.current.mx) / (CANVAS_W * scale)
      const dy = (ev.clientY - start.current.my) / (CANVAS_H * scale)
      onMove(
        config.id,
        Math.max(0.01, Math.min(0.99, start.current.x + dx)),
        Math.max(0.01, Math.min(0.99, start.current.y + dy)),
      )
    }
    function onUp() {
      isDragging.current = false
      setDragging(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left:     `${config.x * 100}%`,
        top:      `${config.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => { if (!isDragging.current) setHovering(false) }}
      >
        <div
          onMouseDown={handleMouseDown}
          style={{
            transform:  `rotate(${config.rotation}deg)`,
            color:      config.color,
            opacity:    isActive ? Math.max(config.opacity, 0.55) : config.opacity,
            fontSize:   config.fontSize,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 400,
            cursor:     dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            padding:    '2px 6px',
            outline:    isActive ? '1.5px dashed rgba(37,99,235,0.55)' : undefined,
            outlineOffset: 5,
            borderRadius: 3,
            transition: 'opacity 120ms',
          }}
        >
          {config.text}
        </div>

        {isActive && (
          <button
            type="button"
            title="Remove watermark"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onDelete(config.id)}
            style={{
              position: 'absolute', top: -8, right: -8,
              width: 16, height: 16, borderRadius: '50%',
              background: '#EF4444', border: '1.5px solid #FFFFFF',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#FFFFFF', fontSize: 11, fontWeight: 900, lineHeight: 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)', padding: 0,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

// ── Editor canvas ──────────────────────────────────────────────────
function EditorCanvas({
  panels,
  panelStates,
  panelBubbles,
  pageImageUrl,
  layoutName,
  displayOrder,
  watermarks,
  onWatermarkMove,
  onWatermarkDelete,
  onWatermarkDrop,
}: {
  panels:             Step4Panel[]
  panelStates:        Record<string, Step4PanelState>
  panelBubbles?:      Record<string, PanelBubbles>
  pageImageUrl:       string | null
  layoutName:         string
  displayOrder:       string[]
  watermarks?:        WatermarkConfig[]
  onWatermarkMove?:   (id: string, x: number, y: number) => void
  onWatermarkDelete?: (id: string) => void
  onWatermarkDrop?:   (x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      const availW = el.clientWidth - 48
      const availH = el.clientHeight - 48
      setScale(Math.min(availW / CANVAS_W, availH / CANVAS_H, 1.3))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const rects = LAYOUT_PANEL_RECTS[layoutName] ?? LAYOUT_PANEL_RECTS['single']

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center bg-surface-container-low overflow-hidden"
    >
      <div
        style={{
          position: 'relative',
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          background: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          flexShrink: 0,
        }}
        onDragOver={e => {
          if (e.dataTransfer.types.includes('application/watermark-drag')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDrop={e => {
          if (!e.dataTransfer.types.includes('application/watermark-drag')) return
          e.preventDefault()
          if (!onWatermarkDrop) return
          // getBoundingClientRect accounts for the CSS scale transform,
          // so dividing by rect dimensions gives true fractional position.
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          const x = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width))
          const y = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height))
          onWatermarkDrop(x, y)
        }}
      >
        {pageImageUrl ? (
          // Full Page mode — show the composite page image directly
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pageImageUrl}
            alt="Page"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            draggable={false}
          />
        ) : (
          // Panel mode — show individual panel images in the layout grid
          rects.map((rect, slotIdx) => {
            const panelId = displayOrder[slotIdx]
            const panel = panels.find(p => p.id === panelId) ?? panels[slotIdx]
            if (!panel) return null
            const state = panelStates[panel.id]

            return (
              <div
                key={panel.id}
                style={{
                  position: 'absolute',
                  ...rectToStyle(rect),
                  outline: '1px solid #E5E7EB',
                  overflow: 'hidden',
                  background: '#F9FAFB',
                }}
              >
                {state?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.imageUrl}
                    alt={panel.contextLabel}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-outline-variant">
                    {state?.status === 'loading' ? (
                      <Loader2 size={18} className="animate-spin text-primary" />
                    ) : state?.status === 'error' ? (
                      <span className="text-[10px] text-red-400">Error</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-2xl">crop_original</span>
                        <span style={{ fontSize: 9 }}>{panel.contextLabel}</span>
                      </>
                    )}
                  </div>
                )}
                {/* Bubble overlays — read-only preview */}
                {(panelBubbles?.[panel.id] ?? []).map(b => {
                  const panelW = rect.w / PBW * CANVAS_W
                  const panelH = rect.h / PBH * CANVAS_H
                  return (
                    <div
                      key={b.id}
                      style={{
                        position: 'absolute',
                        left: b.bubblePosition.x * panelW - b.bubbleSize.w / 2,
                        top:  b.bubblePosition.y * panelH - b.bubbleSize.h / 2,
                        width: b.bubbleSize.w,
                        height: b.bubbleSize.h,
                        zIndex: b.zIndex,
                        pointerEvents: 'none',
                      }}
                    >
                      <MangaBubbleSVG bubble={b} w={b.bubbleSize.w} h={b.bubbleSize.h} />
                    </div>
                  )
                })}
              </div>
            )
          })
        )}

        {/* Draggable watermark overlays — one per placed watermark, not baked into the image */}
        {watermarks?.map(w => (
          <WatermarkDragHandle
            key={w.id}
            config={w}
            scale={scale}
            onMove={onWatermarkMove ?? (() => {})}
            onDelete={onWatermarkDelete ?? (() => {})}
          />
        ))}
      </div>
    </div>
  )
}

// ── Finish tab ────────────────────────────────────────────────────
interface BorderStyleProps {
  config:          BorderConfig
  onChange:        (c: BorderConfig) => void
  samplePanels:    string[]
  sampleLayoutKey: string
  allPanelImages:  string[][]
  allLayouts:      string[]
  onApply:         (newPages: string[]) => void
}

function FinishTab({
  activeSection,
  hasCover,
  pnConfig,
  watermarks,
  wmTemplate,
  borderStyle,
  metadata,
  totalPages,
  dividerCount,
  onOpenCoverDesigner,
  onRemoveCover,
  onChangePnConfig,
  onWmTemplateChange,
  onAddWatermark,
  onDeleteWatermark,
  onChangeMetadata,
}: {
  activeSection:     FinishSection
  hasCover:          boolean
  pnConfig:          PageNumberConfig
  watermarks:        WatermarkConfig[]
  wmTemplate:        WatermarkTemplate
  borderStyle:       BorderStyleProps
  metadata:          ComicMetadata
  totalPages:        number
  dividerCount:      number
  onOpenCoverDesigner: () => void
  onRemoveCover:     () => void
  onChangePnConfig:  (c: PageNumberConfig) => void
  onWmTemplateChange: (t: WatermarkTemplate) => void
  onAddWatermark:    () => void
  onDeleteWatermark: (id: string) => void
  onChangeMetadata:  (m: ComicMetadata) => void
}) {
  return (
    <div className="p-3 pb-24">
      {/* ── COVER section ────────────────────────────────────── */}
      {activeSection === 'cover' && (
        <div className="space-y-4">
          {/* Cover page */}
          <div>
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Cover page</p>
            {hasCover ? (
              <div className="flex items-center gap-2.5 p-2 bg-surface-container-low border border-outline-variant/20 rounded-xl">
                <div style={{ width: 36, height: 52, borderRadius: 4, background: '#E5E7EB', border: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined text-base text-outline-variant">image</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-on-surface truncate">Cover page</p>
                  <button type="button" onClick={onOpenCoverDesigner} className="text-[12px] text-primary hover:underline">Edit →</button>
                </div>
                <button type="button" onClick={onRemoveCover} className="text-on-surface-variant/60 hover:text-red-500 transition-colors shrink-0" title="Remove cover">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenCoverDesigner}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all bg-blue-50 hover:bg-blue-100 text-left"
                style={{ border: '1.5px dashed #BFDBFE' }}
              >
                <ImagePlus size={22} className="text-primary shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-primary">+ Design cover page</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Add a custom cover to your comic</p>
                </div>
              </button>
            )}
          </div>

          {/* Chapter dividers */}
          <div>
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Chapter dividers</p>
            {dividerCount === 0 ? (
              <p className="text-[11px] text-on-surface-variant leading-relaxed flex items-center gap-1.5 flex-wrap">
                Click the <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-surface-container-low border border-outline-variant/30 font-semibold text-on-surface">+</span> lines between pages in the left strip.
                <ArrowLeft size={11} className="text-on-surface-variant/60 shrink-0" style={{ animation: 'nudgeLeft 1.5s ease-in-out infinite' }} />
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-on-surface font-medium">
                  {dividerCount} divider{dividerCount > 1 ? 's' : ''} inserted
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">{dividerCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STYLE section ────────────────────────────────────── */}
      {activeSection === 'style' && (
        <BorderStyleSettings
          config={borderStyle.config}
          onChange={borderStyle.onChange}
          samplePanels={borderStyle.samplePanels}
          sampleLayoutKey={borderStyle.sampleLayoutKey}
          allPanelImages={borderStyle.allPanelImages}
          allLayouts={borderStyle.allLayouts}
          onApply={borderStyle.onApply}
        />
      )}

      {/* ── OVERLAYS section ─────────────────────────────────── */}
      {activeSection === 'overlays' && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Page numbers</p>
            <PageNumberingSettings config={pnConfig} onChange={onChangePnConfig} totalPages={totalPages} />
          </div>
          <div>
            <WatermarkSettings
              template={wmTemplate}
              onTemplateChange={onWmTemplateChange}
              watermarks={watermarks}
              onAdd={onAddWatermark}
              onDelete={onDeleteWatermark}
            />
          </div>
        </div>
      )}

      {/* ── INFO section ─────────────────────────────────────── */}
      {activeSection === 'info' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider flex-1">Comic info</p>
            {!metadata.title && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Required</span>
            )}
          </div>
          <MetadataEditor metadata={metadata} onChange={onChangeMetadata} />

          <div className="mt-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-[13px] font-semibold text-blue-800">Ready to export?</p>
            <p className="text-[12px] text-on-surface-variant mt-0.5 leading-relaxed">
              All settings applied. Use the bar below to choose a format and export.
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <ArrowDown size={12} className="text-blue-500 animate-bounce" />
              <span className="text-[12px] text-blue-600">See export options</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ComicEditor ───────────────────────────────────────────────

interface ComicEditorProps {
  initialProjectId?: string | null
  initialTitle?:     string | null
}

export function ComicEditor({ initialProjectId, initialTitle }: ComicEditorProps = {}) {
  const router = useRouter()
  const {
    step4,
    step4PanelsByPage,
    loadFromCloud,
    clearProjectFromUrl,
    projectId,
    pageLayoutNames,
    borderConfig,
    setBorderConfig,
    saveToCloud,
    cloudSaveStatus,
  } = useComicGeneration()

  const panels      = step4.data?.panels ?? []
  const panelStates = useMemo(() => step4.data?.panelStates ?? {}, [step4.data?.panelStates])
  const pageStates  = useMemo(() => step4.data?.pageStates  ?? {}, [step4.data?.pageStates])
  const hasProject  = panels.length > 0
  const [forcePicker, setForcePicker] = useState(false)

  // ── auto-load from URL param ─────────────────────────────────────
  const [autoLoading,  setAutoLoading]  = useState(!!initialProjectId)
  const [autoLoadErr,  setAutoLoadErr]  = useState<string | null>(null)

  useEffect(() => {
    if (!initialProjectId) return
    setAutoLoading(true)
    loadFromCloud(initialProjectId).then(result => {
      if (!result.success) setAutoLoadErr(result.error ?? 'Failed to load project.')
    }).finally(() => setAutoLoading(false))
  // run once on mount — intentionally omit loadFromCloud to avoid stale closure re-fire
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── load dialogue bubbles from MongoDB ──────────────────────────
  const [panelBubbles, setPanelBubbles] = useState<Record<string, PanelBubbles>>({})
  const bubblesLoadedForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!projectId || bubblesLoadedForRef.current === projectId) return
    bubblesLoadedForRef.current = projectId
    bubblesApi.getForComic(projectId).then(res => {
      const map: Record<string, PanelBubbles> = {}
      for (const doc of res.data) map[doc.panelId] = doc.bubbles as PanelBubbles
      if (Object.keys(map).length > 0) setPanelBubbles(map)
    }).catch(() => {})
  }, [projectId])

  // ── local state ─────────────────────────────────────────────────
  const [selectedPage, setSelectedPage] = useState(1)
  // Divider pages: selectedDivider is the afterPage value of the active divider
  const [dividerPages,       setDividerPages]       = useState<DividerPage[]>([])
  const [selectedDivider,    setSelectedDivider]    = useState<number | null>(null)
  const [showDividerDesigner, setShowDividerDesigner] = useState(false)
  const [dividerInsertAfter,  setDividerInsertAfter]  = useState<number>(0)
  // Finish tab state
  const [hasCover,           setHasCover]           = useState(false)
  const [coverB64,           setCoverB64]           = useState<string | null>(null)
  const [pnConfig,           setPnConfig]           = useState<PageNumberConfig>(DEFAULT_PAGE_NUMBER_CONFIG)
  const [watermarks,         setWatermarks]         = useState<WatermarkConfig[]>([])
  const [wmTemplate,         setWmTemplate]         = useState<WatermarkTemplate>(DEFAULT_WATERMARK_TEMPLATE)
  const [recomposedPages,    setRecomposedPages]    = useState<string[] | null>(null)
  const [metadata,           setMetadata]           = useState<ComicMetadata>(() => {
    const stored = loadMetadata()
    // Prefer URL-supplied title > stored title > projectId slug
    const fallback = initialTitle || projectId || ''
    if (!stored.title && fallback) return { ...stored, title: fallback }
    return stored
  })
  const [showCoverDesigner,  setShowCoverDesigner]  = useState(false)
  const [exportLoading,      setExportLoading]      = useState<string | null>(null)
  const [exportState,        setExportState]        = useState<'idle' | 'success' | 'error'>('idle')
  const [selectedFormat,     setSelectedFormat]     = useState<ExportFormat>('pdf')
  const [activeSection,      setActiveSection]      = useState<FinishSection>('cover')

  // Set initial selected page when panels load
  useEffect(() => {
    if (step4PanelsByPage.length > 0) {
      setSelectedPage(step4PanelsByPage[0][0])
    }
  }, [step4PanelsByPage])

  // ── derived data ─────────────────────────────────────────────────
  const panelsOnCurrentPage = useMemo(() => {
    const entry = step4PanelsByPage.find(([p]) => p === selectedPage)
    return entry ? entry[1] : []
  }, [step4PanelsByPage, selectedPage])

  const layoutForCurrentPage = defaultLayout(panelsOnCurrentPage.length)
  const orderForCurrentPage  = panelsOnCurrentPage.map(p => p.id)
  const totalPages = step4PanelsByPage.length

  // Detect Full Page mode: any page has an image in pageStates
  const isPageMode = useMemo(
    () => step4PanelsByPage.some(([page]) => pageStates[`page-${page}`]?.imageUrl),
    [step4PanelsByPage, pageStates],
  )

  // Raw panel images per page (no bubbles) — used as base before compositing.
  const rawPanelImages = useMemo(() => {
    if (isPageMode) {
      return step4PanelsByPage.map(([page]) => {
        const img = pageStates[`page-${page}`]?.imageUrl
        return img ? [img] : []
      })
    }
    return step4PanelsByPage.map(([, panels]) =>
      panels.map(p => panelStates[p.id]?.imageUrl ?? '').filter(Boolean)
    )
  }, [isPageMode, step4PanelsByPage, panelStates, pageStates])

  // Panel images with bubbles composited in — async because compositePanelToBlob is canvas-based.
  const [allPanelImages, setAllPanelImages] = useState<string[][]>([])
  useEffect(() => {
    let cancelled = false
    async function composite() {
      if (isPageMode || Object.keys(panelBubbles).length === 0) {
        if (!cancelled) setAllPanelImages(rawPanelImages)
        return
      }
      const composed = await Promise.all(
        step4PanelsByPage.map(async ([, panels], pageIdx) => {
          const raw = rawPanelImages[pageIdx] ?? []
          return Promise.all(
            panels.map(async (panel, i) => {
              const url = raw[i]
              if (!url) return ''
              const bubbles = panelBubbles[panel.id]
              if (!bubbles?.length) return url
              try {
                const blob = await compositePanelToBlob(url, bubbles)
                return await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader()
                  reader.onload = () => resolve(reader.result as string)
                  reader.onerror = reject
                  reader.readAsDataURL(blob)
                })
              } catch { return url }
            })
          )
        })
      )
      if (!cancelled) setAllPanelImages(composed.map(page => page.filter(Boolean)))
    }
    void composite()
    return () => { cancelled = true }
  }, [rawPanelImages, panelBubbles, isPageMode, step4PanelsByPage])

  const allLayouts = useMemo(() => {
    if (isPageMode) {
      return step4PanelsByPage.map(() => 'full_bleed')
    }
    return step4PanelsByPage.map(([pageNumber, panels]) =>
      pageLayoutNames[pageNumber] ?? defaultLayout(panels.length)
    )
  }, [isPageMode, step4PanelsByPage, pageLayoutNames])

  // ── auto-recompose when a saved borderConfig is restored from cloud ──────────
  const autoRecomposeRef = useRef<string | null>(null)
  useEffect(() => {
    const key = projectId ?? ''
    if (!key || autoRecomposeRef.current === key) return
    if (!allPanelImages.length || allPanelImages.every(p => p.length === 0)) return
    const isDefault = JSON.stringify(borderConfig) === JSON.stringify(DEFAULT_BORDER_CONFIG)
    if (isDefault) { autoRecomposeRef.current = key; return }
    autoRecomposeRef.current = key
    recomposePages(allPanelImages, allLayouts, borderConfig)
      .then(pages => setRecomposedPages(pages))
      .catch(() => {})
  }, [projectId, allPanelImages, allLayouts, borderConfig])

  // Recomposed page for the currently selected panel page
  const currentPageIndex = step4PanelsByPage.findIndex(([p]) => p === selectedPage)
  const activeRecomposedPage = recomposedPages !== null && currentPageIndex >= 0
    ? recomposedPages[currentPageIndex] ?? null
    : null


  // ── Live border preview on the main canvas ───────────────────────────────
  const [borderPreviewB64, setBorderPreviewB64] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const panels = allPanelImages[currentPageIndex] ?? []
    const layout = allLayouts[currentPageIndex] ?? 'single'
    if (!panels.length) { setBorderPreviewB64(null); return }
    const t = setTimeout(async () => {
      try {
        const b64 = await previewBorderStyle(panels, layout, borderConfig)
        if (!cancelled) setBorderPreviewB64(b64)
      } catch { /* noop */ }
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [borderConfig, allPanelImages, allLayouts, currentPageIndex])

  // ── Live canvas preview (watermark + page numbers on the main canvas) ──────
  const [canvasPreviewUrl, setCanvasPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function buildPreview() {
      // Base image priority: border preview → applied border → full-page → null
      const base: string | null =
        borderPreviewB64 ? `data:image/png;base64,${borderPreviewB64}` :
        activeRecomposedPage ? `data:image/png;base64,${activeRecomposedPage}` :
        pageStates[`page-${selectedPage}`]?.imageUrl ?? null

      // Only rebuild the canvas preview when page numbers are active — watermark is
      // now a draggable HTML overlay and is not baked into the preview image.
      const needsPreview = pnConfig.enabled && base
      if (!needsPreview) {
        if (!cancelled) setCanvasPreviewUrl(null)
        return
      }

      // Calculate the correct page number for this page in the final export order
      const coverOffset = hasCover ? 1 : 0
      const dividersBeforePage = dividerPages.filter(
        d => d.afterPage === 0 || d.afterPage < selectedPage
      ).length
      const exportIdx      = coverOffset + dividersBeforePage + (selectedPage - 1)
      const previewPageNum = pnConfig.startPage + exportIdx

      let preview = [base!]
      if (pnConfig.enabled) {
        preview = await applyPageNumbering(preview, { ...pnConfig, startPage: previewPageNum })
      }
      if (!cancelled) setCanvasPreviewUrl(preview[0] ?? null)
    }
    buildPreview()
    return () => { cancelled = true }
  }, [pnConfig, selectedPage, borderPreviewB64, activeRecomposedPage, pageStates, hasCover, dividerPages])

  // ── panel counts for bottom bar ──────────────────────────────────
  const totalPanelCount = isPageMode ? step4PanelsByPage.length : panels.length
  const totalGeneratedPanels = useMemo(() => {
    if (isPageMode) return step4PanelsByPage.filter(([page]) => pageStates[`page-${page}`]?.imageUrl).length
    return panels.filter(p => panelStates[p.id]?.imageUrl).length
  }, [isPageMode, step4PanelsByPage, pageStates, panels, panelStates])

  // Auto-reset export success after 2.5s
  useEffect(() => {
    if (exportState !== 'success') return
    const t = setTimeout(() => setExportState('idle'), 2500)
    return () => clearTimeout(t)
  }, [exportState])

  // ── handlers ─────────────────────────────────────────────────────
  const handleLoadProject = useCallback(async (id: string) => {
    await loadFromCloud(id)
  }, [loadFromCloud])

  const handleAddCover = useCallback((b64: string) => {
    const dataUrl = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`
    setCoverB64(dataUrl)
    setHasCover(true)
    setShowCoverDesigner(false)
  }, [])

  const handleRemoveCover = useCallback(() => {
    setHasCover(false)
    setCoverB64(null)
  }, [])

  const handleOpenDividerDesigner = useCallback((afterPage: number) => {
    setDividerInsertAfter(afterPage)
    setShowDividerDesigner(true)
  }, [])

  const handleInsertDivider = useCallback((b64: string, afterPage: number) => {
    setDividerPages(prev => [
      ...prev.filter(d => d.afterPage !== afterPage),
      { afterPage, b64 },
    ])
    setShowDividerDesigner(false)
  }, [])

  const handleRemoveDivider = useCallback((afterPage: number) => {
    setDividerPages(prev => prev.filter(d => d.afterPage !== afterPage))
    setSelectedDivider(prev => (prev === afterPage ? null : prev))
  }, [])

  async function buildExportPages(): Promise<ExportPage[]> {
    let rawPages: string[]

    if (recomposedPages) {
      rawPages = recomposedPages.map(b64 => `data:image/png;base64,${b64}`)
    } else {
      const pageStateEntries = Object.entries(step4.data?.pageStates ?? {})
        .filter(([, s]) => (s as Step4PanelState).status === 'success' && (s as Step4PanelState).imageUrl)
        .sort(([a], [b]) => Number(a.replace('page-', '')) - Number(b.replace('page-', '')))

      if (pageStateEntries.length > 0) {
        // Full page mode — use page images directly
        rawPages = pageStateEntries.map(([, s]) => (s as Step4PanelState).imageUrl as string)
      } else {
        // Panel mode — composite individual panel images into full pages
        const b64Pages = await recomposePages(allPanelImages, allLayouts, DEFAULT_BORDER_CONFIG)
        rawPages = b64Pages.map(b64 => `data:image/png;base64,${b64}`)
      }
    }

    const allImages: string[] = []
    if (hasCover && coverB64) allImages.push(coverB64)

    // Insert dividers at afterPage=0 (before all panel pages)
    dividerPages
      .filter(d => d.afterPage === 0)
      .forEach(d => allImages.push(`data:image/png;base64,${d.b64}`))

    rawPages.forEach((imgUrl, idx) => {
      const pageNum = idx + 1
      allImages.push(imgUrl)
      dividerPages
        .filter(d => d.afterPage === pageNum)
        .forEach(d => allImages.push(`data:image/png;base64,${d.b64}`))
    })

    const numbered    = await applyPageNumbering(allImages, pnConfig)
    const watermarked = await applyWatermark(numbered, watermarks)
    return watermarked.map((imageUrl, i) => ({ pageNumber: i + 1, imageUrl, panels: [] }))
  }

  async function handleExport(format: ExportFormat) {
    if (exportLoading) return
    setExportLoading(format)
    setExportState('idle')
    try {
      const pages = await buildExportPages()
      const opts  = { includeMetadata: false, projectId: projectId ?? 'comic', meta: metadata }
      if (format === 'pdf')  await exportAsPdf(pages, opts)
      if (format === 'cbz')  await exportAsCbz(pages, opts)
      if (format === 'png')  await exportAsZip(pages, opts)
      if (format === 'epub') await exportAsEpub(pages, opts)
      setExportState('success')
    } catch (err) {
      console.error('Export failed:', err)
      setExportState('error')
    } finally {
      setExportLoading(null)
    }
  }

  const activeDividerB64 = selectedDivider !== null
    ? dividerPages.find(d => d.afterPage === selectedDivider)?.b64 ?? null
    : null

  // ── render ────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col bg-surface"
      style={{ height: '100vh', marginLeft: 'var(--studio-sidebar-width)', paddingTop: 64 }}
    >
      {/* Auto-loading overlay when arriving from the pipeline */}
      {autoLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-on-surface-variant">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm font-medium">Loading your comic…</p>
        </div>
      )}

      {/* Auto-load error */}
      {!autoLoading && autoLoadErr && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10">
          <p className="text-sm text-red-500 font-medium">{autoLoadErr}</p>
          <button
            type="button"
            onClick={() => router.push('/studio')}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold"
          >
            Back to pipeline
          </button>
        </div>
      )}

      {!autoLoading && !autoLoadErr && (!hasProject || forcePicker) ? (
        <ProjectPicker
          onSelect={async (id) => { setForcePicker(false); await handleLoadProject(id) }}
          onGoPipeline={() => router.push('/studio')}
        />
      ) : !autoLoading && !autoLoadErr && (
        <>
        {/* Editor top bar — back button + project breadcrumb */}
        <div className="flex items-center gap-2 px-3 h-9 border-b border-outline-variant/20 bg-surface shrink-0">
          <button
            type="button"
            onClick={() => { setForcePicker(true); clearProjectFromUrl() }}
            className="flex items-center gap-1.5 text-[12px] text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeft size={13} />
            All Projects
          </button>
          {projectId && (
            <>
              <span className="text-[12px] text-outline-variant/60">/</span>
              <span className="text-[12px] font-medium text-on-surface truncate max-w-[200px]">
                {projectId.replace(/_/g, ' ')}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left page strip */}
          <PageStrip
            panelsByPage={step4PanelsByPage}
            panelStates={panelStates}
            pageStates={pageStates}
            selectedPage={selectedPage}
            selectedDivider={selectedDivider}
            dividerPages={dividerPages}
            onSelect={setSelectedPage}
            onSelectDivider={setSelectedDivider}
            onInsertDivider={handleOpenDividerDesigner}
            onRemoveDivider={handleRemoveDivider}
          />

          {/* Center: canvas + page nav */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeDividerB64 !== null ? (
              <DividerPreview b64={activeDividerB64} />
            ) : (
              <EditorCanvas
                panels={panelsOnCurrentPage}
                panelStates={panelStates}
                panelBubbles={panelBubbles}
                pageImageUrl={
                  // Priority: pn preview (border baked in, no wm) →
                  // live border preview → applied border → raw full-page → null (panel grid)
                  // Watermark is shown as a draggable HTML overlay, not baked here.
                  canvasPreviewUrl ??
                  (borderPreviewB64 ? `data:image/png;base64,${borderPreviewB64}` : null) ??
                  (activeRecomposedPage ? `data:image/png;base64,${activeRecomposedPage}` : null) ??
                  pageStates[`page-${selectedPage}`]?.imageUrl ?? null
                }
                layoutName={layoutForCurrentPage}
                displayOrder={orderForCurrentPage}
                watermarks={watermarks}
                onWatermarkMove={(id, x, y) => setWatermarks(prev => prev.map(w => w.id === id ? { ...w, x, y } : w))}
                onWatermarkDelete={(id) => setWatermarks(prev => prev.filter(w => w.id !== id))}
                onWatermarkDrop={(x, y) => {
                  if (!wmTemplate.text.trim()) return
                  setWatermarks(prev => [...prev, createWatermark(wmTemplate, x, y)])
                }}
              />
            )}

            {/* Page navigation — only when viewing a panel page */}
            {totalPages > 1 && selectedDivider === null && (
              <div className="flex items-center justify-center gap-4 py-2.5 border-t border-outline-variant/20 bg-surface shrink-0">
                <button
                  onClick={() => setSelectedPage(p => Math.max(p - 1, step4PanelsByPage[0]?.[0] ?? 1))}
                  disabled={selectedPage === (step4PanelsByPage[0]?.[0] ?? 1)}
                  className="p-1 rounded-lg hover:bg-surface-container-low disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium text-on-surface-variant">
                  Page {selectedPage} / {totalPages}
                </span>
                <button
                  onClick={() => {
                    const lastPage = step4PanelsByPage[step4PanelsByPage.length - 1]?.[0] ?? 1
                    setSelectedPage(p => Math.min(p + 1, lastPage))
                  }}
                  disabled={selectedPage === (step4PanelsByPage[step4PanelsByPage.length - 1]?.[0] ?? 1)}
                  className="p-1 rounded-lg hover:bg-surface-container-low disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Right sidebar — finish tools */}
          <div className="w-72 shrink-0 border-l border-outline-variant/20 bg-surface flex flex-col overflow-hidden">
            {/* ── Section tabs ── */}
            <div className="flex border-b border-outline-variant/20 shrink-0 bg-surface">
              {([
                { id: 'cover',    label: 'Cover',    Icon: BookOpen  },
                { id: 'style',    label: 'Style',    Icon: Palette   },
                { id: 'overlays', label: 'Overlays', Icon: Hash      },
                { id: 'info',     label: 'Info',     Icon: FileText  },
              ] as { id: FinishSection; label: string; Icon: React.ElementType }[]).map(tab => {
                const active = activeSection === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSection(tab.id)}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 border-b-2 transition-colors"
                    style={{
                      borderBottomColor: active ? '#2563EB' : 'transparent',
                      background: active ? '#F8FAFF' : 'transparent',
                    }}
                  >
                    <tab.Icon size={15} style={{ color: active ? '#2563EB' : '#9CA3AF' }} />
                    <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? '#2563EB' : '#9CA3AF' }}>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-y-auto">
              <FinishTab
                activeSection={activeSection}
                hasCover={hasCover}
                pnConfig={pnConfig}
                watermarks={watermarks}
                wmTemplate={wmTemplate}
                borderStyle={{
                  config: borderConfig,
                  onChange: setBorderConfig,
                  samplePanels: allPanelImages[0] ?? [],
                  sampleLayoutKey: allLayouts[0] ?? 'grid_2x2',
                  allPanelImages,
                  allLayouts,
                  onApply: setRecomposedPages,
                }}
                metadata={metadata}
                dividerCount={dividerPages.length}
                totalPages={totalPages + (hasCover ? 1 : 0) + dividerPages.length}
                onOpenCoverDesigner={() => setShowCoverDesigner(true)}
                onRemoveCover={handleRemoveCover}
                onChangePnConfig={setPnConfig}
                onWmTemplateChange={setWmTemplate}
                onAddWatermark={() => {
                  if (!wmTemplate.text.trim()) return
                  setWatermarks(prev => [...prev, createWatermark(wmTemplate)])
                }}
                onDeleteWatermark={(id) => setWatermarks(prev => prev.filter(w => w.id !== id))}
                onChangeMetadata={setMetadata}
              />
            </div>
          </div>
        </div>

        {/* ── Sticky bottom export bar ──────────────────────────────── */}
        <div
          className="shrink-0 h-16 flex items-center gap-4 px-6 bg-surface border-t border-outline-variant/20 z-50"
          style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}
        >
          {/* Progress summary */}
          <div className="flex-1 min-w-0">
            {totalPanelCount > 0 && totalGeneratedPanels === totalPanelCount ? (
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
                <CheckCircle size={14} className="shrink-0" />
                All {totalPanelCount} panels ready
              </span>
            ) : (
              <span className="text-[13px] text-on-surface-variant">
                {totalGeneratedPanels} / {totalPanelCount} panels · {totalPages} pages
              </span>
            )}
          </div>

          {/* Save to Cloud */}
          {projectId && (
            <button
              type="button"
              onClick={() => saveToCloud()}
              disabled={cloudSaveStatus === 'saving'}
              className={`h-9 px-4 rounded-xl border text-[12px] font-medium flex items-center gap-1.5 shrink-0 transition-colors ${
                cloudSaveStatus === 'saved'
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                  : cloudSaveStatus === 'saving'
                    ? 'border-outline-variant text-on-surface-variant opacity-60 cursor-not-allowed'
                    : 'border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
              }`}
            >
              {cloudSaveStatus === 'saving' ? (
                <><Loader2 size={13} className="animate-spin" />Saving…</>
              ) : cloudSaveStatus === 'saved' ? (
                <><CheckCircle size={13} />Saved</>
              ) : (
                <>☁ Save to Cloud</>
              )}
            </button>
          )}

          {/* Format pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-on-surface-variant mr-1">Format:</span>
            {([
              { id: 'pdf',  label: 'PDF',  desc: 'Readable & printable' },
              { id: 'cbz',  label: 'CBZ',  desc: 'Comic reader apps' },
              { id: 'png',  label: 'PNG',  desc: 'Image sequence' },
              { id: 'epub', label: 'EPUB', desc: 'E-reader devices' },
            ] as { id: ExportFormat; label: string; desc: string }[]).map(fmt => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setSelectedFormat(fmt.id)}
                title={`${fmt.label} — ${fmt.desc}`}
                className={`h-7 px-3 rounded-full border-[1.5px] text-[12px] font-medium transition-colors ${
                  selectedFormat === fmt.id
                    ? 'bg-primary/10 border-primary text-primary font-semibold'
                    : 'bg-surface border-outline-variant/40 text-on-surface-variant hover:border-outline-variant'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>

          {/* Export button */}
          <button
            type="button"
            onClick={() => exportState !== 'success' && handleExport(selectedFormat)}
            disabled={exportLoading !== null}
            className={`h-10 px-5 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 shrink-0 transition-all active:scale-[0.98] ${
              exportState === 'success'
                ? 'bg-emerald-600 cursor-default'
                : exportState === 'error'
                  ? 'bg-red-600 hover:bg-red-700 cursor-pointer'
                  : exportLoading
                    ? 'bg-primary opacity-75 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 cursor-pointer'
            }`}
            style={{ boxShadow: '0 1px 3px rgba(37,99,235,0.25)' }}
          >
            {exportLoading ? (
              <><Loader2 size={15} className="animate-spin" />Exporting…</>
            ) : exportState === 'success' ? (
              <><CheckCircle size={15} />Download ready!</>
            ) : exportState === 'error' ? (
              <><AlertCircle size={15} />Export failed — Retry</>
            ) : (
              <><Download size={15} />Export Comic</>
            )}
          </button>
        </div>
        </>
      )}

      {showCoverDesigner && (
        <CoverPageDesigner
          storyTitle={projectId ?? ''}
          onConfirm={handleAddCover}
          onCancel={() => setShowCoverDesigner(false)}
        />
      )}

      {showDividerDesigner && (
        <ChapterDividerDesigner
          insertAfterIndex={dividerInsertAfter}
          onInsert={handleInsertDivider}
          onCancel={() => setShowDividerDesigner(false)}
        />
      )}
    </div>
  )
}
