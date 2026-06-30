'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
import {
  Play, Loader2, CheckCircle2, Info, AlertCircle, Clock,
  Plus, Trash2, Upload, ImageIcon, Download,
} from 'lucide-react'
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
const STYLES = ['manga', 'realistic', 'cartoon', 'anime', 'watercolor', 'sketch']
const SCALES = [0.0, 0.4, 0.6, 0.8]

const BASE_INPUT: React.CSSProperties = {
  width: '100%', height: 36,
  border: '1px solid #E5E7EB', borderRadius: 8,
  padding: '0 12px', fontSize: 13, color: '#374151',
  background: '#FFFFFF', outline: 'none',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
}

// ── Root component ─────────────────────────────────────────────────

export function EvaluationDashboard() {
  const [tab, setTab] = useState<'ablation' | 'clip'>('ablation')
  const [apiUrl, setApiUrl] = useState('')

  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_KEY) ?? ''
    setApiUrl(stored.replace(/\/$/, ''))
  }, [])

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Page header — #F8FAFF band */}
      <div style={{
        background: '#F8FAFF', borderBottom: '1px solid #E5E7EB',
        padding: '28px 32px 24px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4, lineHeight: 1.2 }}>
            Evaluation Tools
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Research data collection — Chapter 6.3 (Ablation) &amp; 6.4 (CLIP Score)
          </p>
        </div>
        <span style={{
          background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 12,
          padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#6B7280',
          marginTop: 4, whiteSpace: 'nowrap',
        }}>
          Thesis Research
        </span>
      </div>

      {/* Server URL warning */}
      {!apiUrl && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 32px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A',
          fontSize: 12, color: '#92400E',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
          Kaggle server URL not set — go to the{' '}
          <a href="/studio/publish" style={{ fontWeight: 600, textDecoration: 'underline' }}>Publish page</a>{' '}
          and enter it first.
        </div>
      )}

      {/* Tab switcher — pill style */}
      <div style={{ padding: '24px 32px 0 32px' }}>
        <div style={{
          display: 'inline-flex', background: '#F3F4F6', borderRadius: 8,
          padding: 4, minWidth: 480,
        }}>
          {(['ablation', 'clip'] as const).map((t, i) => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{
              flex: 1, height: 36, padding: '0 24px', borderRadius: 6,
              fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#2563EB' : '#6B7280',
              background: tab === t ? '#FFFFFF' : 'transparent',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
              border: 'none', cursor: 'pointer',
              transition: 'all 150ms ease', whiteSpace: 'nowrap',
            }}>
              {i === 0 ? 'Ablation IP-Adapter' : 'CLIP Score'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 32px 48px 32px' }}>
        {tab === 'ablation'
          ? <AblationTab apiUrl={apiUrl} />
          : <ClipScoreTab apiUrl={apiUrl} />
        }
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Ablation Tab
// ════════════════════════════════════════════════════════════════

type StoryIdStatus = 'idle' | 'checking' | 'found' | 'new' | 'invalid'

function AblationTab({ apiUrl }: { apiUrl: string }) {
  const [storyId, setStoryId]           = useState('story_eval_01')
  const [scenePrompt, setScenePrompt]   = useState('')
  const [style, setStyle]               = useState('manga')
  const [refFile, setRefFile]           = useState<File | null>(null)
  const [running, setRunning]           = useState(false)
  const [lastResults, setLastResults]   = useState<AblationRunRecord['results'] | null>(null)
  const [lastStoryId, setLastStoryId]   = useState('')
  const [runs, setRuns]                 = useState<AblationRunRecord[]>([])
  const [error, setError]               = useState<string | null>(null)
  const [toast, setToast]               = useState<string | null>(null)
  const [activeRunId, setActiveRunId]   = useState<string | null>(null)
  const [focused, setFocused]           = useState<string | null>(null)
  const [storyIdStatus, setStoryIdStatus] = useState<StoryIdStatus>('idle')
  const [storyIdMsg, setStoryIdMsg]     = useState('')

  useEffect(() => { setRuns(getAblationRuns()) }, [])

  const summary = useMemo(() => computeAblationSummary(runs), [runs])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleStoryIdBlur() {
    const val = storyId.trim()
    if (!val) { setStoryIdStatus('idle'); setStoryIdMsg(''); return }
    if (!/^[a-zA-Z0-9_]+$/.test(val) || val.length < 3 || val.length > 50) {
      setStoryIdStatus('invalid')
      setStoryIdMsg('Story ID can only contain letters, numbers, and underscores (3–50 chars)')
      return
    }
    setStoryIdStatus('checking')
    setTimeout(() => {
      const allRuns = getAblationRuns()
      const matching = allRuns.filter(r => r.story_id === val)
      if (matching.length > 0) {
        setStoryIdStatus('found')
        setStoryIdMsg(`${val} found · ${matching.length} previous run${matching.length !== 1 ? 's' : ''}`)
      } else {
        setStoryIdStatus('new')
        setStoryIdMsg('New story ID — will create a new run group')
      }
    }, 400)
  }

  async function handleRun() {
    if (!refFile || !scenePrompt.trim() || !storyId.trim() || !apiUrl || running) return
    setRunning(true); setError(null)
    try {
      const refB64 = await fileToBase64(refFile)
      const { results } = await runAblation(apiUrl, {
        story_id: storyId, scene_prompt: scenePrompt,
        reference_image_b64: refB64, style, scales: SCALES,
      })
      setLastResults(results); setLastStoryId(storyId)
      recordAblationRun({ story_id: storyId, scene_prompt: scenePrompt, style, results })
      setRuns(getAblationRuns())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed — check console and server status.')
    } finally { setRunning(false) }
  }

  function handleLoadRun(run: AblationRunRecord) {
    setStoryId(run.story_id); setScenePrompt(run.scene_prompt); setStyle(run.style)
    setLastResults(run.results); setLastStoryId(run.story_id)
    setActiveRunId(run.id); showToast(`Loaded run: ${run.story_id}`)
  }

  function handleRemove(id: string) {
    removeAblationRun(id); setRuns(getAblationRuns())
    if (activeRunId === id) setActiveRunId(null)
  }

  function handleClearAll() {
    if (!window.confirm('Clear all recorded ablation runs?')) return
    clearAblationRuns(); setRuns([]); setLastResults(null); setActiveRunId(null)
  }

  const canRun = !!refFile && !!scenePrompt.trim() && !!storyId.trim() && !!style.trim() && !!apiUrl && !running

  // Summary stats
  const bestRow    = summary.length > 0 ? summary.reduce((b, r) => Number(r.mean) > Number(b.mean) ? r : b, summary[0]) : null
  const avgSim     = summary.length > 0 ? summary.reduce((s, r) => s + Number(r.mean), 0) / summary.length : 0
  const passCount  = summary.filter(r => r.passCount === r.total && r.total > 0).length

  function inputStyle(name: string): React.CSSProperties {
    const isErrStory  = storyIdStatus === 'invalid' && name === 'storyId'
    const isGoodStory = storyIdStatus === 'found'   && name === 'storyId'
    const isFocused   = focused === name
    return {
      ...BASE_INPUT,
      borderColor: isErrStory ? '#DC2626' : isGoodStory ? '#16A34A' : isFocused ? '#2563EB' : '#E5E7EB',
      boxShadow: isFocused
        ? isErrStory  ? '0 0 0 3px #FEE2E2'
        : isGoodStory ? '0 0 0 3px #DCFCE7'
        : '0 0 0 3px #DBEAFE'
        : 'none',
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, right: 32, zIndex: 9999,
          background: '#111827', color: '#FFFFFF', borderRadius: 8,
          padding: '10px 16px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>{toast}</div>
      )}

      {/* Run form */}
      <EvalCard>
        <SectionLabel>Run Ablation Test</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* Reference image */}
          <div>
            <FieldLabel>Reference image</FieldLabel>
            <input type="file" accept="image/png,image/jpeg,image/webp"
              onChange={e => setRefFile(e.target.files?.[0] ?? null)}
              className="w-full text-[11px] text-on-surface-variant file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:text-[11px] file:bg-surface-container file:text-on-surface-variant"
              style={{ ...BASE_INPUT, height: 'auto', padding: '6px 8px' }} />
          </div>

          {/* Story ID */}
          <div>
            <FieldLabel>Story ID</FieldLabel>
            <div style={{ position: 'relative' }}>
              <input
                value={storyId}
                onChange={e => { setStoryId(e.target.value); setStoryIdStatus('idle'); setStoryIdMsg('') }}
                onFocus={() => setFocused('storyId')}
                onBlur={() => { setFocused(null); handleStoryIdBlur() }}
                style={{ ...inputStyle('storyId'), paddingRight: 32 }}
              />
              {storyIdStatus === 'checking' && <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />}
              {storyIdStatus === 'found'    && <CheckCircle2 size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#16A34A' }} />}
              {storyIdStatus === 'new'      && <Info size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#D97706' }} />}
              {storyIdStatus === 'invalid'  && <AlertCircle size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#DC2626' }} />}
            </div>
            {storyIdMsg && (
              <p style={{
                fontSize: 11, marginTop: 4,
                color: storyIdStatus === 'found' ? '#16A34A' : storyIdStatus === 'new' ? '#D97706' : '#DC2626',
              }}>{storyIdMsg}</p>
            )}
          </div>
        </div>

        {/* Style */}
        <div style={{ marginBottom: 12 }}>
          <FieldLabel>Style</FieldLabel>
          <select value={style} onChange={e => setStyle(e.target.value)}
            onFocus={() => setFocused('style')} onBlur={() => setFocused(null)}
            style={inputStyle('style')}>
            {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Scene prompt */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Scene prompt</FieldLabel>
          <input value={scenePrompt} onChange={e => setScenePrompt(e.target.value)}
            onFocus={() => setFocused('prompt')} onBlur={() => setFocused(null)}
            placeholder="pale child kneeling in dim alley, looking down"
            style={inputStyle('prompt')} />
        </div>

        {/* Run button */}
        <button type="button" onClick={handleRun} disabled={!canRun} style={{
          width: '100%', height: 44, background: canRun ? '#2563EB' : '#E5E7EB',
          borderRadius: 8, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: canRun ? 'pointer' : 'not-allowed',
          fontSize: 14, fontWeight: 600, color: canRun ? '#FFFFFF' : '#9CA3AF',
          opacity: running ? 0.75 : 1, transition: 'all 150ms ease',
        }}>
          {running
            ? <Loader2 size={16} className="animate-spin" />
            : <Play size={16} fill="currentColor" />
          }
          {running ? 'Running ablation...' : canRun ? 'Run Ablation — 4 Scales' : 'Fill all fields to run'}
        </button>

        {error && (
          <p style={{ fontSize: 11, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>{error}</p>
        )}
      </EvalCard>

      {/* Last run thumbnails + chart */}
      {lastResults && (
        <EvalCard>
          <SectionLabel>Latest run — {lastStoryId}</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {lastResults.map(r => (
              <div key={r.ip_scale} style={{ flex: 1, textAlign: 'center', padding: 8, background: '#F9FAFB', borderRadius: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/png;base64,${r.panel_b64}`} alt={`scale ${r.ip_scale}`}
                  style={{ width: '100%', height: 56, objectFit: 'cover', borderRadius: 4, marginBottom: 4 }} />
                <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>scale {r.ip_scale}</div>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: r.similarity_score >= 0.90 ? '#16A34A' : r.similarity_score >= 0.75 ? '#D97706' : '#DC2626',
                }}>
                  {r.similarity_score.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
          <AblationBarChart data={lastResults} />
        </EvalCard>
      )}

      {/* Aggregate results */}
      <EvalCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionLabel>
            {runs.length === 1 ? 'Results — 1 Story Run' : `Results — ${runs.length} Stories Run`}
          </SectionLabel>
          <div style={{ display: 'flex', gap: 6 }}>
            <SmallBtn onClick={() => exportAblationCSV(runs)} disabled={!runs.length}>
              <Download size={11} /> Export CSV
            </SmallBtn>
            <SmallBtn onClick={handleClearAll} disabled={!runs.length}>Clear all</SmallBtn>
          </div>
        </div>

        {summary.length === 0 ? (
          <p style={{ fontSize: 11, color: '#9CA3AF' }}>No runs recorded yet.</p>
        ) : (
          <>
            {/* Summary stats bar */}
            {bestRow && (
              <div style={{
                background: '#F8FAFF', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '12px 16px', marginBottom: 16,
                display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
              }}>
                <StatCell label="Best scale"       value={String(bestRow.scale)}                valueColor="#111827" />
                <StatCell label="Best similarity"  value={Number(bestRow.mean).toFixed(4)}      valueColor="#16A34A" />
                <StatCell label="Avg similarity"   value={avgSim.toFixed(4)}                   valueColor={avgSim >= 0.75 ? '#16A34A' : '#DC2626'} />
                <StatCell label="Pass rate"
                  value={`${passCount}/${summary.length} (${Math.round(passCount / summary.length * 100)}%)`}
                  valueColor={passCount === summary.length ? '#16A34A' : '#D97706'} />
              </div>
            )}

            {/* Results table */}
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', height: 36, borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ textAlign: 'left',   padding: '0 16px', ...TH_STYLE }}>Scale</th>
                    <th style={{ textAlign: 'right',  padding: '0 16px', ...TH_STYLE }}>Mean Similarity</th>
                    <th style={{ textAlign: 'center', padding: '0 16px', ...TH_STYLE }}>Pass (≥0.75)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(s => {
                    const isBest = bestRow && s.scale === bestRow.scale
                    const mean   = Number(s.mean)
                    const passed = s.passCount === s.total && s.total > 0
                    return (
                      <tr key={s.scale} style={{
                        height: 44, borderBottom: '1px solid #F3F4F6',
                        background: isBest ? '#F0FDF4' : undefined,
                        borderLeft: isBest ? '3px solid #16A34A' : '3px solid transparent',
                      }}>
                        <td style={{ padding: '0 16px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {isBest && <span style={{ fontSize: 12, color: '#16A34A', marginRight: 4 }}>★</span>}
                          {s.scale}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0 16px', fontSize: 13, fontWeight: 500, color: mean >= 0.90 ? '#16A34A' : mean >= 0.75 ? '#D97706' : '#DC2626' }}>
                          {mean.toFixed(4)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '0 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            background: passed ? '#DCFCE7' : '#FEE2E2',
                            color: passed ? '#16A34A' : '#DC2626',
                            borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                          }}>
                            {passed ? '✓' : '✗'} {s.passCount}/{s.total}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </EvalCard>

      {/* Run history */}
      {runs.length > 0 && (
        <EvalCard>
          <SectionLabel>Run History</SectionLabel>
          <div>
            {runs.map(run => (
              <div key={run.id} onClick={() => handleLoadRun(run)} style={{
                display: 'flex', alignItems: 'center', height: 40, padding: '0 12px',
                borderRadius: 6, cursor: 'pointer',
                background: activeRunId === run.id ? '#EFF6FF' : 'transparent',
                borderLeft: activeRunId === run.id ? '2px solid #2563EB' : '2px solid transparent',
                transition: 'background 100ms ease',
              }}
              onMouseEnter={e => { if (activeRunId !== run.id) (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB' }}
              onMouseLeave={e => { if (activeRunId !== run.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <Clock size={14} style={{ color: '#9CA3AF', flexShrink: 0, marginRight: 8 }} />
                <span style={{
                  flex: 1, fontSize: 13, color: '#374151',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {run.story_id} · {run.scene_prompt.slice(0, 50)}
                </span>
                <span style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0, marginLeft: 8 }}>
                  {new Date(run.ts).toLocaleDateString()}
                </span>
                <button type="button" onClick={e => { e.stopPropagation(); handleRemove(run.id) }}
                  aria-label="Remove run"
                  className="hover-red"
                  style={{ flexShrink: 0, marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: '0 4px', fontSize: 14 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#D1D5DB'}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </EvalCard>
      )}
    </div>
  )
}

const TH_STYLE: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  color: '#9CA3AF', textTransform: 'uppercase',
}

function StatCell({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: valueColor }}>{value}</div>
    </div>
  )
}

function AblationBarChart({ data }: { data: { ip_scale: number; similarity_score: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.map(d => String(d.ip_scale)),
        datasets: [{ data: data.map(d => d.similarity_score), backgroundColor: '#2563EB', borderRadius: 4, borderSkipped: false }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { min: 0, max: 1, ticks: { font: { size: 10 } } },
        },
      },
    })
    return () => { chartRef.current?.destroy() }
  }, [data])

  return <div style={{ position: 'relative', height: 140 }}><canvas ref={canvasRef} role="img" aria-label="Similarity score by IP-Adapter scale" /></div>
}

// ════════════════════════════════════════════════════════════════
// CLIP Score Tab
// ════════════════════════════════════════════════════════════════

function ClipScoreTab({ apiUrl }: { apiUrl: string }) {
  const [manualPairs, setManualPairs] = useState<ClipPairInput[]>([{ prompt: '', image_b64: '', style: 'manga' }])
  const [fileNames,   setFileNames]   = useState<string[]>([''])
  const [running,     setRunning]     = useState(false)
  const [results,     setResults]     = useState<ClipScoreResultItem[] | null>(null)
  const [usedPairs,   setUsedPairs]   = useState<ClipPairInput[]>([])
  const [error,       setError]       = useState<string | null>(null)

  const validPairs = manualPairs.filter(p => p.prompt.trim() && p.image_b64)
  const canRun     = validPairs.length > 0 && !!apiUrl && !running
  const n          = validPairs.length

  async function handleRun() {
    if (!canRun) return
    setRunning(true); setError(null)
    try {
      const res = await runBatchClipScore(apiUrl, validPairs.map(p => ({ prompt: p.prompt, image_b64: p.image_b64 })))
      setResults(res.results); setUsedPairs(validPairs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed — check console and server status.')
    } finally { setRunning(false) }
  }

  function addRow() {
    if (manualPairs.length >= 10) return
    setManualPairs(prev => [...prev, { prompt: '', image_b64: '', style: 'manga' }])
    setFileNames(prev => [...prev, ''])
  }

  function removeRow(i: number) {
    setManualPairs(prev => prev.filter((_, idx) => idx !== i))
    setFileNames(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, patch: Partial<ClipPairInput>) {
    setManualPairs(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p))
  }

  async function handleFile(i: number, file: File | null) {
    if (!file) {
      updateRow(i, { image_b64: '' })
      setFileNames(prev => prev.map((n, idx) => idx === i ? '' : n))
      return
    }
    const b64 = await fileToBase64(file)
    updateRow(i, { image_b64: b64 })
    setFileNames(prev => prev.map((nm, idx) => idx === i ? file.name : nm))
  }

  const summary     = useMemo(() => results ? computeClipSummaryByStyle(usedPairs, results) : [], [results, usedPairs])
  const overallMean = useMemo(() => results?.length
    ? Math.round(results.reduce((s, r) => s + r.clip_score, 0) / results.length * 100) / 100
    : 0, [results])

  const btnLabel = running
    ? `Running... (${n} pair${n !== 1 ? 's' : ''})`
    : n === 0
      ? 'Add at least 1 pair to run'
      : `Run Batch CLIP Score (${n} pair${n !== 1 ? 's' : ''})`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>

      <EvalCard>
        <SectionLabel>Manual Upload (Style · Prompt · Image)</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {manualPairs.map((pair, i) => (
            <div key={i} style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px' }}>

              {/* Row number badge */}
              <span style={{
                position: 'absolute', top: -8, left: 12, fontSize: 10, fontWeight: 700,
                color: '#9CA3AF', background: '#FFFFFF', padding: '0 6px',
              }}>#{i + 1}</span>

              {/* Delete button */}
              {manualPairs.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} title="Remove this pair" style={{
                  position: 'absolute', top: 10, right: 10, background: 'none',
                  border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 2,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#D1D5DB'}
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Line 1: Style + Prompt */}
              <div style={{ display: 'flex', gap: 8, paddingRight: manualPairs.length > 1 ? 28 : 0 }}>
                <select value={pair.style} onChange={e => updateRow(i, { style: e.target.value })} style={{
                  width: 140, height: 36, border: '1px solid #E5E7EB', borderRadius: 6,
                  padding: '0 8px', fontSize: 13, color: '#374151', background: '#FFFFFF', flexShrink: 0,
                }}>
                  {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input value={pair.prompt} onChange={e => updateRow(i, { prompt: e.target.value })}
                  placeholder="Scene prompt — describe the image content"
                  style={{ flex: 1, height: 36, border: '1px solid #E5E7EB', borderRadius: 6, padding: '0 12px', fontSize: 13, outline: 'none', background: '#FFFFFF' }} />
              </div>

              {/* Line 2: Image upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                {fileNames[i] ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#EFF6FF', border: '1px solid #BFDBFE',
                    borderRadius: 6, height: 32, padding: '0 10px',
                  }}>
                    <ImageIcon size={13} style={{ color: '#2563EB', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#2563EB', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileNames[i].length > 24 ? fileNames[i].slice(0, 24) + '…' : fileNames[i]}
                    </span>
                    <button type="button" onClick={() => handleFile(i, null)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#93C5FD', padding: 0, lineHeight: 1, fontSize: 14,
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#2563EB'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#93C5FD'}
                    >×</button>
                  </div>
                ) : (
                  <label style={{ cursor: 'pointer' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      height: 32, padding: '0 14px',
                      background: '#F9FAFB', border: '1.5px dashed #D1D5DB',
                      borderRadius: 6, fontSize: 12, color: '#6B7280',
                    }}>
                      <Upload size={13} style={{ color: '#9CA3AF' }} />
                      Choose image...
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
                      onChange={e => handleFile(i, e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add row button */}
        <button type="button" onClick={addRow} disabled={manualPairs.length >= 10} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          height: 36, width: '100%', background: '#F9FAFB',
          border: '1.5px dashed #D1D5DB', borderRadius: 8,
          fontSize: 13, color: '#6B7280', cursor: manualPairs.length >= 10 ? 'not-allowed' : 'pointer',
          opacity: manualPairs.length >= 10 ? 0.5 : 1, marginBottom: 12,
        }}>
          <Plus size={14} style={{ color: '#9CA3AF' }} />
          {manualPairs.length >= 10 ? 'Maximum 10 pairs reached' : '+ Add row'}
        </button>

        {/* Run button */}
        <button type="button" onClick={handleRun} disabled={!canRun} style={{
          width: '100%', height: 44, background: canRun ? '#2563EB' : '#E5E7EB',
          borderRadius: 8, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: canRun ? 'pointer' : 'not-allowed',
          fontSize: 14, fontWeight: 600, color: canRun ? '#FFFFFF' : '#9CA3AF',
          opacity: running ? 0.75 : 1, transition: 'all 150ms ease',
        }}>
          {running
            ? <Loader2 size={16} className="animate-spin" />
            : canRun ? <Play size={16} fill="currentColor" /> : null
          }
          {btnLabel}
        </button>

        {error && (
          <p style={{ fontSize: 11, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>{error}</p>
        )}
      </EvalCard>

      {/* Results */}
      {results && (
        <>
          <EvalCard>
            <SectionLabel>Mean CLIP score by style</SectionLabel>
            <ClipBarChart data={summary} />
          </EvalCard>
          <EvalCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                {results.length} panels · overall mean <strong>{overallMean}</strong>
              </span>
              <SmallBtn onClick={() => exportClipScoreCSV(usedPairs, results)}>
                <Download size={11} /> Export CSV
              </SmallBtn>
            </div>
          </EvalCard>
        </>
      )}
    </div>
  )
}

function ClipBarChart({ data }: { data: { style: string; mean: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !data.length) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.map(d => d.style),
        datasets: [{ data: data.map(d => d.mean), backgroundColor: ['#2563EB', '#059669', '#D97706', '#7C3AED'], borderRadius: 4, borderSkipped: false }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { min: 0, max: 0.4, ticks: { font: { size: 10 } } },
        },
      },
    })
    return () => { chartRef.current?.destroy() }
  }, [data])

  return <div style={{ position: 'relative', height: 150 }}><canvas ref={canvasRef} role="img" aria-label="Mean CLIP score by style" /></div>
}

// ── Shared primitives ──────────────────────────────────────────────

function EvalCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 20px' }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 16, margin: '0 0 16px 0' }}>
      {children}
    </p>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{children}</label>
}

function SmallBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 11, padding: '6px 12px', borderRadius: 6,
      border: '1px solid #E5E7EB', color: '#6B7280', background: '#FFFFFF',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1, transition: 'all 150ms ease',
    }}>
      {children}
    </button>
  )
}
