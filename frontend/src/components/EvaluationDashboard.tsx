'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
import {
  runAblation, runBatchClipScore,
  recordAblationRun, getAblationRuns, removeAblationRun, clearAblationRuns,
  computeAblationSummary, computeClipSummaryByStyle,
  exportAblationCSV, exportClipScoreCSV,
  fileToBase64,
  type AblationRunRecord, type ClipPairInput, type ClipScoreResultItem,
} from '@/lib/evaluation'

Chart.register(...registerables)

const SESSION_KEY = 'mohiom-image-api-url'
const STYLES = ['manga', 'webtoon', 'chibi', 'watercolor']
const SCALES = [0.0, 0.4, 0.6, 0.8]

// ── Root component ────────────────────────────────────────────────

export function EvaluationDashboard() {
  const [tab, setTab] = useState<'ablation' | 'clip'>('ablation')
  const [apiUrl, setApiUrl] = useState('')

  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_KEY) ?? ''
    setApiUrl(stored.replace(/\/$/, ''))
  }, [])

  return (
    <div className="px-8 py-8 pb-16 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-on-surface">Evaluation Tools</h1>
        <p className="text-[12px] text-on-surface-variant mt-1">
          Research data collection — Chương 6.3 (Ablation) &amp; 6.4 (CLIP Score)
        </p>
      </div>

      {/* Server URL status */}
      {!apiUrl && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-5 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">
          <span className="material-symbols-outlined text-base">warning</span>
          Kaggle server URL not set — go to the{' '}
          <a href="/studio/publish" className="font-semibold underline">Publish page</a>{' '}
          and enter it first.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 p-1 bg-surface-container rounded-xl">
        <TabBtn active={tab === 'ablation'} onClick={() => setTab('ablation')}>
          Ablation IP-Adapter
        </TabBtn>
        <TabBtn active={tab === 'clip'} onClick={() => setTab('clip')}>
          CLIP Score
        </TabBtn>
      </div>

      {tab === 'ablation'
        ? <AblationTab apiUrl={apiUrl} />
        : <ClipScoreTab apiUrl={apiUrl} />
      }
    </div>
  )
}

// ── Tab button ────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
        active
          ? 'bg-surface text-primary shadow-sm'
          : 'text-on-surface-variant hover:text-on-surface'
      }`}>
      {children}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
// Ablation Tab
// ════════════════════════════════════════════════════════════════

function AblationTab({ apiUrl }: { apiUrl: string }) {
  const [storyId, setStoryId] = useState('story_eval_01')
  const [scenePrompt, setScenePrompt] = useState('')
  const [style, setStyle] = useState('manga')
  const [refFile, setRefFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [lastResults, setLastResults] = useState<AblationRunRecord['results'] | null>(null)
  const [lastStoryId, setLastStoryId] = useState('')
  const [runs, setRuns] = useState<AblationRunRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setRuns(getAblationRuns()) }, [])

  const summary = useMemo(() => computeAblationSummary(runs), [runs])

  async function handleRun() {
    if (!refFile || !scenePrompt.trim() || !apiUrl || running) return
    setRunning(true)
    setError(null)
    try {
      const refB64 = await fileToBase64(refFile)
      const { results } = await runAblation(apiUrl, {
        story_id: storyId,
        scene_prompt: scenePrompt,
        reference_image_b64: refB64,
        style,
        scales: SCALES,
      })
      setLastResults(results)
      setLastStoryId(storyId)
      recordAblationRun({ story_id: storyId, scene_prompt: scenePrompt, style, results })
      setRuns(getAblationRuns())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed — check console and server status.')
    } finally {
      setRunning(false)
    }
  }

  function handleRemove(id: string) {
    removeAblationRun(id)
    setRuns(getAblationRuns())
  }

  function handleClearAll() {
    if (!window.confirm('Clear all recorded ablation runs?')) return
    clearAblationRuns()
    setRuns([])
    setLastResults(null)
  }

  const canRun = !!refFile && !!scenePrompt.trim() && !!apiUrl && !running

  return (
    <div className="space-y-4">

      {/* Run form */}
      <Card>
        <SectionLabel>Chạy ablation test</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Reference image">
            <input type="file" accept="image/png,image/jpeg,image/webp"
              onChange={e => setRefFile(e.target.files?.[0] ?? null)}
              className="w-full text-[11px] text-on-surface-variant file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:text-[11px] file:bg-surface-container file:text-on-surface-variant" />
          </Field>
          <Field label="Story ID">
            <input value={storyId} onChange={e => setStoryId(e.target.value)}
              className="field w-full text-[12px]" />
          </Field>
        </div>
        <Field label="Style">
          <select value={style} onChange={e => setStyle(e.target.value)}
            className="field w-full text-[12px] mb-3">
            {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Scene prompt">
          <input value={scenePrompt} onChange={e => setScenePrompt(e.target.value)}
            placeholder="pale child kneeling in dim alley, looking down"
            className="field w-full text-[12px] mb-4" />
        </Field>
        <button type="button" onClick={handleRun} disabled={!canRun}
          className={`w-full py-2.5 rounded-xl text-[13px] font-semibold border transition-all flex items-center justify-center gap-2 ${
            canRun
              ? 'border-primary text-primary hover:bg-primary/5'
              : 'border-outline-variant/30 text-on-surface-variant/50 cursor-not-allowed'
          }`}>
          {running && <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          {running ? 'Đang chạy 4 scales…' : 'Run ablation (4 scales)'}
        </button>
        {error && (
          <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{error}</p>
        )}
      </Card>

      {/* Last run result */}
      {lastResults && (
        <Card>
          <SectionLabel>Kết quả — {lastStoryId}</SectionLabel>
          <div className="flex gap-2 mb-3">
            {lastResults.map(r => (
              <div key={r.ip_scale} className="flex-1 text-center p-2 bg-surface-container-low rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/png;base64,${r.panel_b64}`} alt={`scale ${r.ip_scale}`}
                  className="w-full h-14 object-cover rounded mb-1" />
                <div className="text-[9px] text-on-surface-variant mb-0.5">scale {r.ip_scale}</div>
                <div className={`text-[13px] font-semibold ${
                  r.similarity_score >= 0.75 ? 'text-emerald-600'
                  : r.similarity_score >= 0.5 ? 'text-amber-600'
                  : 'text-red-600'
                }`}>
                  {r.similarity_score}
                </div>
              </div>
            ))}
          </div>
          <AblationBarChart data={lastResults} />
        </Card>
      )}

      {/* Aggregate summary */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Tổng hợp — {runs.length} stories đã chạy</SectionLabel>
          <div className="flex gap-1.5">
            <SmallBtn onClick={() => exportAblationCSV(runs)} disabled={!runs.length}>Export CSV</SmallBtn>
            <SmallBtn onClick={handleClearAll} disabled={!runs.length}>Clear all</SmallBtn>
          </div>
        </div>
        {summary.length === 0 ? (
          <EmptyHint>Chưa có run nào được ghi lại.</EmptyHint>
        ) : (
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-[10px] text-on-surface-variant uppercase tracking-wider text-left">
                <th className="pb-2 font-semibold">Scale</th>
                <th className="pb-2 font-semibold">Mean similarity</th>
                <th className="pb-2 font-semibold">Pass (≥0.75)</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(s => (
                <tr key={s.scale} className="border-t border-outline-variant/20">
                  <td className="py-2 text-on-surface">{s.scale}</td>
                  <td className="py-2 font-medium text-on-surface">{s.mean}</td>
                  <td className="py-2 text-on-surface-variant">{s.passCount}/{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Run history (for removing bad runs) */}
      {runs.length > 0 && (
        <Card>
          <SectionLabel>Lịch sử runs</SectionLabel>
          <div className="space-y-1">
            {runs.map(run => (
              <div key={run.id} className="flex items-center gap-2 py-1.5 border-b border-outline-variant/15 last:border-0">
                <span className="flex-1 text-[11px] text-on-surface-variant truncate">
                  {run.story_id} · {run.scene_prompt.slice(0, 50)}
                </span>
                <span className="text-[10px] text-on-surface-variant/50 shrink-0">
                  {new Date(run.ts).toLocaleDateString()}
                </span>
                <button type="button" onClick={() => handleRemove(run.id)}
                  aria-label="Remove run"
                  className="shrink-0 text-[12px] text-on-surface-variant/40 hover:text-red-500 transition-colors px-1">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function AblationBarChart({ data }: { data: { ip_scale: number; similarity_score: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.map(d => String(d.ip_scale)),
        datasets: [{
          data: data.map(d => d.similarity_score),
          backgroundColor: '#2563EB',
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { min: 0, max: 1, ticks: { font: { size: 10 } } },
        },
      },
    })
    return () => { chartRef.current?.destroy() }
  }, [data])

  return (
    <div className="relative h-[140px]">
      <canvas ref={canvasRef} role="img" aria-label="Similarity score by IP-Adapter scale" />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// CLIP Score Tab
// ════════════════════════════════════════════════════════════════

function ClipScoreTab({ apiUrl }: { apiUrl: string }) {
  const [manualPairs, setManualPairs] = useState<ClipPairInput[]>([
    { prompt: '', image_b64: '', style: 'manga' },
  ])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ClipScoreResultItem[] | null>(null)
  const [usedPairs, setUsedPairs] = useState<ClipPairInput[]>([])
  const [error, setError] = useState<string | null>(null)

  const activePairs = manualPairs.filter(p => p.prompt.trim() && p.image_b64)

  async function handleRun() {
    if (!activePairs.length || !apiUrl || running) return
    setRunning(true)
    setError(null)
    try {
      const res = await runBatchClipScore(
        apiUrl,
        activePairs.map(p => ({ prompt: p.prompt, image_b64: p.image_b64 })),
      )
      setResults(res.results)
      setUsedPairs(activePairs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed — check console and server status.')
    } finally {
      setRunning(false)
    }
  }

  function addRow() {
    setManualPairs(prev => [...prev, { prompt: '', image_b64: '', style: 'manga' }])
  }

  function removeRow(i: number) {
    setManualPairs(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, patch: Partial<ClipPairInput>) {
    setManualPairs(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p))
  }

  async function handleFile(i: number, file: File | null) {
    if (!file) return
    const b64 = await fileToBase64(file)
    updateRow(i, { image_b64: b64 })
  }

  const summary = useMemo(
    () => results ? computeClipSummaryByStyle(usedPairs, results) : [],
    [results, usedPairs],
  )
  const overallMean = useMemo(
    () => results?.length
      ? Math.round(results.reduce((s, r) => s + r.clip_score, 0) / results.length * 100) / 100
      : 0,
    [results],
  )

  const canRun = activePairs.length > 0 && !!apiUrl && !running

  return (
    <div className="space-y-4">

      {/* Input panel */}
      <Card>
        <SectionLabel>Upload thủ công (style · prompt · image)</SectionLabel>
        <div className="space-y-2 mb-3">
          {manualPairs.map((pair, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr_120px_24px] gap-2 items-center">
              <select value={pair.style} onChange={e => updateRow(i, { style: e.target.value })}
                className="field text-[11px]">
                {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={pair.prompt} onChange={e => updateRow(i, { prompt: e.target.value })}
                placeholder="Scene prompt"
                className="field text-[11px]" />
              <div className="relative">
                <input type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={e => handleFile(i, e.target.files?.[0] ?? null)}
                  className="w-full text-[10px] text-on-surface-variant file:mr-1 file:px-1.5 file:py-0.5 file:rounded file:border-0 file:text-[10px] file:bg-surface-container file:text-on-surface-variant" />
                {pair.image_b64 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] flex items-center justify-center leading-none">✓</span>
                )}
              </div>
              <button type="button" onClick={() => removeRow(i)}
                className="text-on-surface-variant/40 hover:text-red-500 transition-colors text-[12px] text-center">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow}
          className="text-[11px] text-primary hover:underline mb-4">
          + Add row
        </button>

        <button type="button" onClick={handleRun} disabled={!canRun}
          className={`w-full py-2.5 rounded-xl text-[13px] font-semibold border transition-all flex items-center justify-center gap-2 ${
            canRun
              ? 'border-primary text-primary hover:bg-primary/5'
              : 'border-outline-variant/30 text-on-surface-variant/50 cursor-not-allowed'
          }`}>
          {running && <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          {running
            ? 'Đang tính CLIP score…'
            : `Run batch CLIP score (${activePairs.length} pair${activePairs.length !== 1 ? 's' : ''})`}
        </button>
        {error && (
          <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{error}</p>
        )}
      </Card>

      {/* Results */}
      {results && (
        <>
          <Card>
            <SectionLabel>Mean CLIP score theo style</SectionLabel>
            <ClipBarChart data={summary} />
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-on-surface-variant">
                {results.length} panels · overall mean <strong>{overallMean}</strong>
              </span>
              <SmallBtn onClick={() => exportClipScoreCSV(usedPairs, results)}>Export CSV</SmallBtn>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function ClipBarChart({ data }: { data: { style: string; mean: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !data.length) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.map(d => d.style),
        datasets: [{
          data: data.map(d => d.mean),
          backgroundColor: ['#2563EB', '#059669', '#D97706', '#7C3AED'],
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { min: 0, max: 0.4, ticks: { font: { size: 10 } } },
        },
      },
    })
    return () => { chartRef.current?.destroy() }
  }, [data])

  return (
    <div className="relative h-[150px]">
      <canvas ref={canvasRef} role="img" aria-label="Mean CLIP score by style" />
    </div>
  )
}

// ── Shared small components ───────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl px-4 py-4">
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-on-surface-variant/60 mb-3">
      {children}
    </p>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-on-surface-variant mb-1">{label}</label>
      {children}
    </div>
  )
}

function SmallBtn({ onClick, disabled, children }: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="text-[11px] px-3 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
      {children}
    </button>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-on-surface-variant/60">{children}</p>
}
