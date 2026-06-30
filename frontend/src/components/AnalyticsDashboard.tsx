'use client'

import {
  Chart,
  registerables,
  type ChartConfiguration,
} from 'chart.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle,
  Clock,
  Download,
  Eye,
  LayoutGrid,
  Minus,
  MoreVertical,
  PieChart,
  RefreshCw,
  Smile,
  Upload,
  Users,
} from 'lucide-react'
import {
  clearEvents,
  computeMetrics,
  getEvents,
  type DashboardMetrics,
  type GenerateEvent,
} from '@/lib/analytics'
import {
  getPublishHistory,
  fetchLiveStats,
  type PublishedComicRecord,
} from '@/lib/publishHistory'

Chart.register(...registerables)

type Range = 7 | 30 | 'all'

const DONUT_COLORS = ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#059669', '#DC2626']

// ── data helpers ──────────────────────────────────────────────────

function loadPeriodEvents(range: Range): { current: GenerateEvent[]; prev: GenerateEvent[] } {
  if (range === 'all') return { current: getEvents({}), prev: [] }
  const periodMs = (range as number) * 86_400_000
  const now = Date.now()
  const current = getEvents({ since: now - periodMs })
  const prev = getEvents({ since: now - 2 * periodMs }).filter(e => e.ts < now - periodMs)
  return { current, prev }
}

function getDaysToShow(range: Range, events: GenerateEvent[]): number {
  if (range !== 'all') return range as number
  if (events.length === 0) return 7
  const minTs = Math.min(...events.map(e => e.ts))
  return Math.min(90, Math.max(7, Math.ceil((Date.now() - minTs) / 86_400_000)))
}

function exportCSV(events: GenerateEvent[], range: Range) {
  const header = 'id,timestamp,type,story_id,style,mood,duration_ms,has_character,export_format'
  const rows = events.map(e =>
    [
      e.id,
      new Date(e.ts).toISOString(),
      e.type,
      e.story_id,
      e.style,
      e.mood ?? '',
      e.duration_ms,
      e.has_character,
      e.export_format ?? '',
    ].join(',')
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analytics-${range}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── trend ─────────────────────────────────────────────────────────

type TrendInfo =
  | { kind: 'first' }
  | { kind: 'neutral' }
  | { kind: 'up'; text: string }
  | { kind: 'down'; text: string }

function getTrend(
  current: number,
  prev: number,
  fmt?: (n: number) => string
): TrendInfo | null {
  if (current === 0 && prev === 0) return null
  if (prev === 0) return { kind: 'first' }
  const diff = current - prev
  if (diff === 0) return { kind: 'neutral' }
  const abs = fmt ? fmt(Math.abs(diff)) : `${Math.abs(diff)}`
  return { kind: diff > 0 ? 'up' : 'down', text: `${diff > 0 ? '+' : '-'}${abs} vs last period` }
}

function TrendBadge({ trend }: { trend: TrendInfo | null }) {
  if (!trend) return null
  if (trend.kind === 'first') {
    return <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>First recorded</span>
  }
  if (trend.kind === 'neutral') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>
        <Minus size={10} />No change
      </span>
    )
  }
  const color = trend.kind === 'up' ? '#16A34A' : '#DC2626'
  const Icon = trend.kind === 'up' ? ArrowUp : ArrowDown
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color, fontWeight: 500 }}>
      <Icon size={10} />
      {trend.text}
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────

interface KPICardProps {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  value: React.ReactNode
  label: string
  tooltip?: string
  trend: TrendInfo | null
  ctaText?: string
  ctaHref?: string
}

function KPICard({ icon, iconBg, iconColor, value, label, tooltip, trend, ctaText, ctaHref }: KPICardProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: `1px solid ${hovered ? '#BFDBFE' : '#E5E7EB'}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'all 150ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor,
          flexShrink: 0,
        }}>
          {icon}
        </div>
        {ctaText && ctaHref && (
          <a
            href={ctaHref}
            style={{ fontSize: 12, color: '#2563EB', fontWeight: 500, textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}
          >
            {ctaText}
          </a>
        )}
      </div>

      <div style={{ fontSize: 32, fontWeight: 700, color: '#111827', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>

      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {tooltip && (
          <span title={tooltip} style={{ cursor: 'help', color: '#9CA3AF', fontSize: 12 }}>ⓘ</span>
        )}
      </div>

      <TrendBadge trend={trend} />
    </div>
  )
}

// ── shared containers ─────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  rightElement,
}: {
  title: string
  subtitle?: string
  rightElement?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '32px 32px 16px 32px' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {rightElement}
    </div>
  )
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: 12,
      padding: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {children}
    </div>
  )
}

function EmptyState({ icon, text, subtext }: { icon: React.ReactNode; text: string; subtext: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 0', gap: 8,
    }}>
      <div style={{ color: '#D1D5DB' }}>{icon}</div>
      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{text}</div>
      <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', maxWidth: 220 }}>{subtext}</div>
    </div>
  )
}

// ── charts ────────────────────────────────────────────────────────

function DoughnutChart({ data }: { data: Record<string, number> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  const labels = Object.keys(data)
  const values = Object.values(data)
  const total = values.reduce((s, v) => s + v, 0)

  useEffect(() => {
    if (!ref.current || total === 0) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: DONUT_COLORS.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#FFFFFF',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed} panel${ctx.parsed !== 1 ? 's' : ''}`,
            },
          },
        },
      },
    } as ChartConfiguration)
    return () => { chartRef.current?.destroy() }
  }, [data, total]) // eslint-disable-line react-hooks/exhaustive-deps

  if (total === 0) {
    return (
      <EmptyState
        icon={<PieChart size={32} />}
        text="No style data yet"
        subtext="Generate panels to see style distribution"
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {labels.map((k, i) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B7280' }}>
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: DONUT_COLORS[i], flexShrink: 0, display: 'inline-block',
            }} />
            {k} {total ? Math.round(values[i] / total * 100) : 0}%
          </span>
        ))}
      </div>
      <div style={{ position: 'relative', height: 160 }}>
        <canvas ref={ref} role="img" aria-label="Style distribution chart" />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{total}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>panels</div>
        </div>
      </div>
    </div>
  )
}

function MoodBarChart({ data }: { data: Record<string, number> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  const labels = Object.keys(data)
  const values = Object.values(data)
  const hasMoodData = labels.length > 0 && values.some(v => v > 0)

  useEffect(() => {
    if (!ref.current || !hasMoodData) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: '#2563EB',
          hoverBackgroundColor: '#1D4ED8',
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 11 }, color: '#9CA3AF' },
          },
          y: {
            border: { display: false },
            grid: { color: '#F3F4F6' },
            ticks: { font: { size: 11 }, color: '#9CA3AF', stepSize: 1 },
            min: 0,
          },
        },
      },
    } as ChartConfiguration)
    return () => { chartRef.current?.destroy() }
  }, [data, hasMoodData]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasMoodData) {
    return (
      <EmptyState
        icon={<Smile size={32} />}
        text="No mood data yet"
        subtext="Mood is detected from dialogue in your panels"
      />
    )
  }

  return (
    <div style={{ position: 'relative', height: 160 }}>
      <canvas ref={ref} role="img" aria-label="Mood distribution chart" />
    </div>
  )
}

function ActivityLineChart({ data }: { data: { date: string; count: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  const maxCount = Math.max(...data.map(d => d.count), 0)
  const yMax = Math.ceil((maxCount * 1.2) / 5) * 5 || 5
  const yStep = Math.max(1, Math.ceil(yMax / 5))

  useEffect(() => {
    if (!ref.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [{
          data: data.map(d => d.count),
          borderColor: '#2563EB',
          backgroundColor: (ctx) => {
            const canvas = ctx.chart.canvas
            const gradient = canvas.getContext('2d')?.createLinearGradient(0, 0, 0, 280)
            if (!gradient) return 'rgba(239,246,255,0.4)'
            gradient.addColorStop(0, 'rgba(239,246,255,0.8)')
            gradient.addColorStop(1, 'rgba(239,246,255,0)')
            return gradient
          },
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: data.map(d => d.count === 0 ? '#D1D5DB' : '#2563EB'),
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            borderWidth: 0,
            padding: { x: 10, y: 6 } as never,
            callbacks: {
              title: (items) => items[0]?.label ?? '',
              label: (ctx) => {
                const n = ctx.parsed.y
                return n === 0 ? 'No panels generated' : `${n} panel${n !== 1 ? 's' : ''} generated`
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 11 }, color: '#9CA3AF' },
          },
          y: {
            border: { display: false },
            grid: { color: '#F3F4F6' },
            ticks: { font: { size: 11 }, color: '#9CA3AF', stepSize: yStep },
            min: 0,
            max: yMax,
          },
        },
      },
    } as ChartConfiguration)
    return () => { chartRef.current?.destroy() }
  }, [data, yMax, yStep]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', height: 280 }}>
      <canvas ref={ref} role="img" aria-label="Panels generated per day" />
    </div>
  )
}

// ── main dashboard ────────────────────────────────────────────────

const PUBLISH_SESSION_KEY = 'mohiom-image-api-url'

export function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>(7)
  const [events, setEvents] = useState<GenerateEvent[]>([])
  const [prevEvents, setPrevEvents] = useState<GenerateEvent[]>([])
  const [showOverflow, setShowOverflow] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  const [publishHistory, setPublishHistory] = useState<PublishedComicRecord[]>([])
  const [liveStats, setLiveStats] = useState<Map<string, number>>(new Map())
  const [statsLoading, setStatsLoading] = useState(false)
  const [publishApiUrl, setPublishApiUrl] = useState('')

  async function loadLiveStats(url: string, records: PublishedComicRecord[]) {
    setStatsLoading(true)
    const ids = records.map(r => r.comic_id)
    const map = await fetchLiveStats(url, ids)
    setLiveStats(map)
    setStatsLoading(false)
  }

  useEffect(() => {
    const records = getPublishHistory()
    setPublishHistory(records)
    const url = window.sessionStorage.getItem(PUBLISH_SESSION_KEY) ?? ''
    setPublishApiUrl(url)
    if (url && records.length) {
      loadLiveStats(url, records)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const { current, prev } = loadPeriodEvents(range)
    setEvents(current)
    setPrevEvents(prev)
  }, [range])

  useEffect(() => {
    const id = setInterval(() => {
      const { current, prev } = loadPeriodEvents(range)
      setEvents(current)
      setPrevEvents(prev)
    }, 30_000)
    return () => clearInterval(id)
  }, [range])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const daysToShow = getDaysToShow(range, events)
  const metrics: DashboardMetrics = useMemo(() => computeMetrics(events, daysToShow), [events, daysToShow])
  const prevMetrics: DashboardMetrics = useMemo(() => computeMetrics(prevEvents, daysToShow), [prevEvents, daysToShow])

  const showTrend = range !== 'all'
  const t = (cur: number, prev: number, fmt?: (n: number) => string) =>
    showTrend ? getTrend(cur, prev, fmt) : null

  const panelsTrend     = t(metrics.total_panels,          prevMetrics.total_panels)
  const storiesTrend    = t(metrics.total_stories,         prevMetrics.total_stories)
  const avgTimeTrend    = t(metrics.avg_gen_ms,            prevMetrics.avg_gen_ms,
    n => `${(n / 1000).toFixed(1)}s`)
  const charTrend       = t(metrics.char_usage_pct,        prevMetrics.char_usage_pct,
    n => `${n}%`)
  const exportsTrend    = t(metrics.export_count,          prevMetrics.export_count)
  const completionTrend = t(metrics.export_completion_pct, prevMetrics.export_completion_pct,
    n => `${n}%`)

  const avgTimeDisplay = metrics.avg_gen_ms > 0
    ? `${(metrics.avg_gen_ms / 1000).toFixed(1)}s`
    : '—'
  const avgTimeColor = metrics.avg_gen_ms > 0 ? '#111827' : '#9CA3AF'

  const storyWord = metrics.total_stories === 1 ? 'story' : 'stories'
  const periodLabel = range === 'all'
    ? `All time · ${metrics.total_panels} panels across ${metrics.total_stories} ${storyWord}`
    : `Last ${range}d · ${metrics.total_panels} panels across ${metrics.total_stories} ${storyWord}`

  const handleClear = () => {
    setShowOverflow(false)
    if (!window.confirm('Clear all analytics data? This cannot be undone.')) return
    clearEvents()
    const { current, prev } = loadPeriodEvents(range)
    setEvents(current)
    setPrevEvents(prev)
  }

  const rangeOptions: [Range, string][] = [[7, '7d'], [30, '30d'], ['all', 'All time']]

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ── Zone 1: Page Header ── */}
      <div style={{
        background: '#F8FAFF',
        borderBottom: '1px solid #E5E7EB',
        padding: '28px 32px 24px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4, lineHeight: 1.2 }}>
            Analytics
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Track your comic generation activity and performance
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {/* Segmented time control */}
          <div style={{
            display: 'inline-flex',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            background: '#F9FAFB',
            overflow: 'hidden',
            height: 32,
          }}>
            {rangeOptions.map(([r, label], idx) => (
              <button
                key={String(r)}
                onClick={() => setRange(r)}
                style={{
                  padding: '0 14px',
                  fontSize: 13,
                  fontWeight: range === r ? 600 : 500,
                  color: range === r ? '#2563EB' : '#6B7280',
                  background: range === r ? '#FFFFFF' : 'transparent',
                  boxShadow: range === r ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  border: 'none',
                  borderRight: idx < rangeOptions.length - 1 ? '1px solid #E5E7EB' : 'none',
                  cursor: 'pointer',
                  height: '100%',
                  transition: 'all 100ms ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Export + overflow */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <HoverButton
              onClick={() => exportCSV(events, range)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 32 }}
            >
              <Download size={14} />
              Export data
            </HoverButton>

            <div ref={overflowRef} style={{ position: 'relative' }}>
              <HoverButton
                onClick={() => setShowOverflow(v => !v)}
                style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <MoreVertical size={14} />
              </HoverButton>
              {showOverflow && (
                <div style={{
                  position: 'absolute', top: 36, right: 0,
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  minWidth: 160,
                  zIndex: 50,
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={handleClear}
                    style={{
                      width: '100%', padding: '10px 16px',
                      fontSize: 13, fontWeight: 500,
                      color: '#DC2626', background: 'transparent',
                      border: 'none', textAlign: 'left', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    Clear all data
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ paddingBottom: 48 }}>

        {/* ── Zone 2: Overview KPI ── */}
        <SectionHeader title="Overview" subtitle={periodLabel} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '0 32px' }}>
          <KPICard
            icon={<LayoutGrid size={18} />}
            iconBg="#EFF6FF" iconColor="#2563EB"
            value={metrics.total_panels}
            label="Panels generated"
            trend={panelsTrend}
            ctaText="View panels →"
            ctaHref="/studio"
          />
          <KPICard
            icon={<BookOpen size={18} />}
            iconBg="#F0FDF4" iconColor="#16A34A"
            value={metrics.total_stories}
            label="Stories created"
            trend={storiesTrend}
            ctaText="View stories →"
            ctaHref="/studio/my-stories"
          />
          <KPICard
            icon={<Clock size={18} />}
            iconBg="#FFFBEB" iconColor="#D97706"
            value={<span style={{ color: avgTimeColor }}>{avgTimeDisplay}</span>}
            label="Avg time / panel"
            trend={avgTimeTrend}
          />
          <KPICard
            icon={<Users size={18} />}
            iconBg="#F5F3FF" iconColor="#7C3AED"
            value={`${metrics.char_usage_pct}%`}
            label="Character ref usage"
            tooltip="% of panels generated using a character reference image"
            trend={charTrend}
            ctaText="View characters →"
            ctaHref="/studio/character-manager"
          />
          <KPICard
            icon={<Upload size={18} />}
            iconBg="#ECFDF5" iconColor="#059669"
            value={metrics.export_count}
            label="Exports"
            trend={exportsTrend}
            ctaText="View exports →"
            ctaHref="/studio/export"
          />
          <KPICard
            icon={<CheckCircle size={18} />}
            iconBg="#F0FDF4" iconColor="#16A34A"
            value={`${metrics.export_completion_pct}%`}
            label="Export completion"
            tooltip="% of your stories that have been exported at least once"
            trend={completionTrend}
          />
        </div>

        {/* ── Zone 3: Charts ── */}

        {/* Style + Mood side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '32px 32px 0 32px' }}>
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Style Distribution</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Breakdown of art styles across all panels</div>
            </div>
            <ChartCard>
              <DoughnutChart data={metrics.style_dist} />
            </ChartCard>
          </div>

          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Mood Distribution</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Emotional tone detected across panel dialogue</div>
            </div>
            <ChartCard>
              <MoodBarChart data={metrics.mood_dist} />
            </ChartCard>
          </div>
        </div>

        {/* Generation Activity */}
        <SectionHeader
          title="Generation Activity"
          subtitle="Panels generated each day in selected period"
          rightElement={
            <button
              onClick={() => exportCSV(events, range)}
              style={{
                fontSize: 13, fontWeight: 500, color: '#2563EB',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none' }}
            >
              Download CSV →
            </button>
          }
        />
        <div style={{ padding: '0 32px 32px 32px' }}>
          <ChartCard>
            <ActivityLineChart data={metrics.daily_counts} />
          </ChartCard>
        </div>

        {/* ── Zone 4: Publish Performance ── */}
        <SectionHeader
          title="Publish Performance"
          subtitle="Live reader counts for your published comics"
          rightElement={
            publishHistory.length > 0 && publishApiUrl ? (
              <HoverButton
                onClick={() => loadLiveStats(publishApiUrl, publishHistory)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 32 }}
              >
                <RefreshCw size={13} className={statsLoading ? 'animate-spin' : ''} />
                Refresh
              </HoverButton>
            ) : undefined
          }
        />

        <div style={{ padding: '0 32px 48px 32px' }}>
          {/* Total readers KPI */}
          {publishHistory.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <KPICard
                icon={<Eye size={18} />}
                iconBg="#F5F3FF" iconColor="#7C3AED"
                value={
                  statsLoading
                    ? <span style={{ fontSize: 20, color: '#9CA3AF' }}>…</span>
                    : !publishApiUrl
                    ? <span style={{ fontSize: 20, color: '#9CA3AF' }}>—</span>
                    : Array.from(liveStats.values()).reduce((s, v) => s + v, 0)
                }
                label="Total readers across all published comics"
                trend={null}
                ctaText="Publish history →"
                ctaHref="/studio/publish-history"
              />
            </div>
          )}

          {/* Per-comic table */}
          <ChartCard>
            {publishHistory.length === 0 ? (
              <EmptyState
                icon={<Eye size={32} />}
                text="No published comics yet"
                subtext="Publish a comic from the Export page to see reader counts here"
              />
            ) : !publishApiUrl ? (
              <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 10, color: '#6B7280', fontSize: 13 }}>
                <span style={{ fontSize: 18 }}>ⓘ</span>
                Enter your server URL on the Export page to load live reader counts.
              </div>
            ) : (
              <div>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 60px 110px 80px 32px',
                  gap: 8,
                  paddingBottom: 8,
                  borderBottom: '1px solid #F3F4F6',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  <span>Comic</span>
                  <span style={{ textAlign: 'right' }}>Pages</span>
                  <span>Published</span>
                  <span style={{ textAlign: 'right' }}>Reads</span>
                  <span />
                </div>

                {publishHistory.map(record => {
                  const count = liveStats.get(record.comic_id)
                  const isExpired = !statsLoading && publishApiUrl && !liveStats.has(record.comic_id) && liveStats.size > 0
                  return (
                    <div
                      key={record.comic_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 60px 110px 80px 32px',
                        gap: 8,
                        padding: '10px 0',
                        borderBottom: '1px solid #F9FAFB',
                        alignItems: 'center',
                        fontSize: 13,
                        color: '#374151',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.title || record.comic_id}
                        </div>
                        {isExpired && (
                          <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>expired (server restarted)</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', color: '#6B7280' }}>{record.page_count}</div>
                      <div style={{ color: '#6B7280', fontSize: 12 }}>
                        {new Date(record.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 600, color: isExpired ? '#9CA3AF' : '#111827' }}>
                        {statsLoading
                          ? <span style={{ color: '#9CA3AF' }}>…</span>
                          : count !== undefined
                          ? count
                          : '—'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <a
                          href={record.reader_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open reader"
                          style={{ color: '#9CA3AF', fontSize: 14, textDecoration: 'none', lineHeight: 1 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#2563EB' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF' }}
                        >
                          ↗
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

// ── shared hover button ───────────────────────────────────────────

function HoverButton({
  onClick,
  style: extraStyle,
  children,
}: {
  onClick: () => void
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const base: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    ...extraStyle,
  }
  return (
    <button
      onClick={onClick}
      style={base}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = '#2563EB'
        el.style.color = '#2563EB'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = '#E5E7EB'
        el.style.color = '#374151'
      }}
    >
      {children}
    </button>
  )
}
