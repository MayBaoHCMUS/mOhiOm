'use client'

import {
  Chart,
  registerables,
  type ChartConfiguration,
} from 'chart.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { clearEvents, computeMetrics, getEvents, type GenerateEvent } from '@/lib/analytics'

Chart.register(...registerables)

type Range = 7 | 30 | 'all'

const COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#e34948', '#4a3aa7', '#eb6834']

function loadEvents(range: Range): GenerateEvent[] {
  const since = range === 'all' ? 0 : Date.now() - (range as number) * 86_400_000
  return getEvents({ since })
}

export function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>(7)
  const [events, setEvents] = useState<GenerateEvent[]>(() => loadEvents(7))

  const refresh = (r: Range) => setEvents(loadEvents(r))

  useEffect(() => { refresh(range) }, [range])

  const metrics = useMemo(() => computeMetrics(events), [events])

  useEffect(() => {
    const id = setInterval(() => refresh(range), 30_000)
    return () => clearInterval(id)
  }, [range])

  const handleClear = () => {
    if (!window.confirm('Xoá toàn bộ analytics data?')) return
    clearEvents()
    refresh(range)
  }

  return (
    <>
      <style>{`
        .an-dashboard { padding: 1.5rem; display: flex; flex-direction: column; gap: 16px; max-width: 900px; }
        .an-header    { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .an-header h2 { font-size: 18px; font-weight: 600; margin: 0; flex: 1; color: var(--color-on-surface); }
        .an-range     { display: flex; gap: 4px; }
        .an-range button {
          padding: 4px 12px; border-radius: 20px;
          border: 0.5px solid var(--color-outline-variant);
          background: transparent; cursor: pointer;
          font-size: 12px; color: var(--color-on-surface-variant);
        }
        .an-range button.active { background: #EEEDFE; color: #3C3489; border-color: #AFA9EC; }
        .an-clear {
          padding: 4px 10px; border-radius: 8px;
          border: 0.5px solid var(--color-outline-variant);
          background: transparent; color: var(--color-on-surface-variant);
          font-size: 12px; cursor: pointer;
        }
        .an-kpi-row   { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
        .an-kpi       {
          background: var(--color-surface-container-low);
          border-radius: 8px; padding: 1rem;
          display: flex; flex-direction: column; gap: 4px;
        }
        .an-kpi-val   { font-size: 26px; font-weight: 500; color: var(--color-on-surface); line-height: 1; }
        .an-kpi-lbl   { font-size: 11px; color: var(--color-on-surface-variant); }
        .an-chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .an-card      {
          background: var(--color-surface-container);
          border: 0.5px solid var(--color-outline-variant);
          border-radius: 12px; padding: 14px 16px;
        }
        .an-card-title { font-size: 12px; font-weight: 500; color: var(--color-on-surface); margin-bottom: 10px; }
        .an-legend    { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
        .an-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--color-on-surface-variant); }
        .an-legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
        .an-empty     { padding: 3rem; text-align: center; color: var(--color-on-surface-variant); }
        @media (max-width: 600px) { .an-chart-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="an-dashboard">
        <div className="an-header">
          <h2>Analytics</h2>
          <div className="an-range">
            {([7, 30, 'all'] as Range[]).map(r => (
              <button
                key={r}
                className={range === r ? 'active' : ''}
                onClick={() => { setRange(r); refresh(r) }}
              >
                {r === 'all' ? 'Tất cả' : `${r} ngày`}
              </button>
            ))}
          </div>
          <button className="an-clear" onClick={handleClear}>Xoá data</button>
        </div>

        {events.length === 0 ? (
          <div className="an-empty">
            <p>Chưa có dữ liệu. Hãy tạo một vài panels để xem analytics.</p>
          </div>
        ) : (
          <>
            <div className="an-kpi-row">
              <KPICard value={metrics.total_panels}                              label="Panels sinh" />
              <KPICard value={metrics.total_stories}                             label="Stories tạo" />
              <KPICard value={`${Math.round(metrics.avg_gen_ms / 1000)}s`}       label="Avg thời gian/panel" />
              <KPICard value={`${metrics.char_usage_pct}%`}                      label="Dùng character ref" />
              <KPICard value={metrics.export_count}                              label="Lần export" />
              <KPICard value={`${metrics.export_rate_pct}%`}                     label="Export rate" />
            </div>

            <div className="an-chart-grid">
              <ChartCard title="Style distribution">
                <DoughnutChart data={metrics.style_dist} />
              </ChartCard>
              <ChartCard title="Mood distribution">
                <BarChart data={metrics.mood_dist} />
              </ChartCard>
            </div>

            <ChartCard title="Panels sinh theo ngày">
              <LineChart data={metrics.daily_counts} />
            </ChartCard>
          </>
        )}
      </div>
    </>
  )
}

function KPICard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="an-kpi">
      <span className="an-kpi-val">{value}</span>
      <span className="an-kpi-lbl">{label}</span>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="an-card">
      <div className="an-card-title">{title}</div>
      {children}
    </div>
  )
}

function DoughnutChart({ data }: { data: Record<string, number> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const labels = Object.keys(data)
    const values = Object.values(data)

    chartRef.current?.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: COLORS.slice(0, labels.length),
          borderWidth: 2,
          borderColor: 'transparent',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } },
        },
      },
    } as ChartConfiguration)
    return () => { chartRef.current?.destroy() }
  }, [data])

  const total = Object.values(data).reduce((s, v) => s + v, 0)

  return (
    <div>
      <div className="an-legend">
        {Object.entries(data).map(([k, v], i) => (
          <span key={k} className="an-legend-item">
            <span className="an-legend-dot" style={{ background: COLORS[i] }} />
            {k} {total ? Math.round(v / total * 100) : 0}%
          </span>
        ))}
      </div>
      <div style={{ position: 'relative', height: 160 }}>
        <canvas ref={ref} role="img" aria-label={`Biểu đồ style distribution`} />
      </div>
    </div>
  )
}

function BarChart({ data }: { data: Record<string, number> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const labels = Object.keys(data)
    const values = Object.values(data)

    chartRef.current?.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: COLORS.slice(0, labels.length),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { border: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    } as ChartConfiguration)
    return () => { chartRef.current?.destroy() }
  }, [data])

  return (
    <div style={{ position: 'relative', height: 160 }}>
      <canvas ref={ref} role="img" aria-label={`Biểu đồ mood distribution`} />
    </div>
  )
}

function LineChart({ data }: { data: { date: string; count: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!ref.current) return

    chartRef.current?.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [{
          data: data.map(d => d.count),
          borderColor: '#2a78d6',
          backgroundColor: 'rgba(42,120,214,0.08)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#2a78d6',
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            border: { display: false },
            ticks: { font: { size: 11 }, stepSize: 1 },
            min: 0,
          },
        },
      },
    } as ChartConfiguration)
    return () => { chartRef.current?.destroy() }
  }, [data])

  return (
    <div style={{ position: 'relative', height: 120 }}>
      <canvas ref={ref} role="img" aria-label="Biểu đồ số panels sinh theo ngày trong 7 ngày gần nhất" />
    </div>
  )
}
