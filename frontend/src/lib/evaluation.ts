// ── Proxy helper (same pattern as lib/publish.ts) ─────────────────
async function proxy<T>(
  apiUrl: string,
  path: string,
  method: string = 'POST',
  payload?: unknown,
): Promise<T> {
  const res = await fetch('/api/manga-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiUrl, path, method, payload }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Proxy error ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Types ─────────────────────────────────────────────────────────

export interface AblationResultItem {
  ip_scale: number
  similarity_score: number
  face_detected: boolean
  panel_b64: string
}

export interface AblationRunRecord {
  id: string
  story_id: string
  scene_prompt: string
  style: string
  ts: number
  results: AblationResultItem[]
}

export interface ClipPairInput {
  prompt: string
  image_b64: string
  style: string
}

export interface ClipScoreResultItem {
  prompt_preview: string
  clip_score: number
}

// ── API calls ─────────────────────────────────────────────────────

export async function runAblation(
  apiUrl: string,
  params: {
    story_id: string
    scene_prompt: string
    reference_image_b64: string
    style: string
    scales: number[]
    num_inference_steps?: number
  },
): Promise<{ results: AblationResultItem[] }> {
  return proxy(apiUrl, '/eval/ablation-ip-adapter', 'POST', {
    story_id: params.story_id,
    scene_prompt: params.scene_prompt,
    reference_image_b64: params.reference_image_b64,
    style: params.style,
    scales: params.scales,
    num_inference_steps: params.num_inference_steps ?? 20,
  })
}

export async function runBatchClipScore(
  apiUrl: string,
  pairs: { prompt: string; image_b64: string }[],
): Promise<{ results: ClipScoreResultItem[]; mean_clip_score: number }> {
  return proxy(apiUrl, '/eval/batch-clip-score', 'POST', { pairs })
}

// ── Local persistence ─────────────────────────────────────────────

const ABLATION_KEY = 'ablation_runs'

function stripPanelImages(records: AblationRunRecord[]): AblationRunRecord[] {
  return records.map(r => ({ ...r, results: r.results.map(res => ({ ...res, panel_b64: '' })) }))
}

// Each result carries a full base64 PNG per scale — a handful of runs is enough
// to blow past localStorage's ~5-10MB per-origin quota. Try the full record
// first (so recently-viewed runs still show thumbnails), then degrade: drop
// this run's images, then — if quota is already exhausted by older runs —
// strip images from everything already stored, so the numeric history (what
// the summary table and stdev/detection-rate actually need) never silently
// stops accumulating.
export function recordAblationRun(run: Omit<AblationRunRecord, 'id' | 'ts'>): boolean {
  const record: AblationRunRecord = {
    ...run,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  }
  const existing = getAblationRuns()

  try {
    localStorage.setItem(ABLATION_KEY, JSON.stringify([...existing, record]))
    return true
  } catch (err) {
    console.warn('[recordAblationRun] Full record too large for localStorage, retrying without panel images:', err)
  }

  try {
    const slimRecord = { ...record, results: record.results.map(res => ({ ...res, panel_b64: '' })) }
    localStorage.setItem(ABLATION_KEY, JSON.stringify([...existing, slimRecord]))
    return true
  } catch (err) {
    console.warn('[recordAblationRun] Still too large — stripping images from all stored runs and retrying:', err)
  }

  try {
    const slimRecord = { ...record, results: record.results.map(res => ({ ...res, panel_b64: '' })) }
    localStorage.setItem(ABLATION_KEY, JSON.stringify([...stripPanelImages(existing), slimRecord]))
    return true
  } catch (err) {
    console.error('[recordAblationRun] Failed to save run — localStorage unavailable or full:', err)
    return false
  }
}

export function getAblationRuns(): AblationRunRecord[] {
  try {
    return JSON.parse(localStorage.getItem(ABLATION_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function removeAblationRun(id: string): void {
  try {
    const existing = getAblationRuns().filter(r => r.id !== id)
    localStorage.setItem(ABLATION_KEY, JSON.stringify(existing))
  } catch { /* noop */ }
}

export function clearAblationRuns(): void {
  try { localStorage.removeItem(ABLATION_KEY) } catch { /* noop */ }
}

// ── Aggregation ───────────────────────────────────────────────────

export interface AblationScaleSummary {
  scale: number
  mean: number
  median: number
  stdev: number
  detectionRate: number
  passCount: number
  total: number
}

function median(scores: number[]): number {
  if (!scores.length) return 0
  const sorted = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function stdev(scores: number[]): number {
  if (scores.length < 2) return 0
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (scores.length - 1)
  return Math.sqrt(variance)
}

export function computeAblationSummary(
  runs: AblationRunRecord[],
  passThreshold = 0.75,
): AblationScaleSummary[] {
  const byScale = new Map<number, number[]>()
  const detectedByScale = new Map<number, number>()
  const totalByScale = new Map<number, number>()
  for (const run of runs) {
    for (const r of run.results) {
      if (!byScale.has(r.ip_scale)) byScale.set(r.ip_scale, [])
      byScale.get(r.ip_scale)!.push(r.similarity_score)
      totalByScale.set(r.ip_scale, (totalByScale.get(r.ip_scale) ?? 0) + 1)
      if (r.face_detected) detectedByScale.set(r.ip_scale, (detectedByScale.get(r.ip_scale) ?? 0) + 1)
    }
  }
  return Array.from(byScale.entries())
    .sort(([a], [b]) => a - b)
    .map(([scale, scores]) => {
      const total = totalByScale.get(scale) ?? 0
      const detected = detectedByScale.get(scale) ?? 0
      return {
        scale,
        mean: scores.length ? round4(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        median: round4(median(scores)),
        stdev: round4(stdev(scores)),
        detectionRate: total ? round4((detected / total) * 100) : 0,
        passCount: scores.filter(s => s >= passThreshold).length,
        total: scores.length,
      }
    })
}

export interface ClipStyleSummary {
  style: string
  mean: number
  count: number
}

export function computeClipSummaryByStyle(
  pairs: ClipPairInput[],
  results: ClipScoreResultItem[],
): ClipStyleSummary[] {
  const byStyle = new Map<string, number[]>()
  pairs.forEach((pair, i) => {
    const score = results[i]?.clip_score
    if (score === undefined) return
    if (!byStyle.has(pair.style)) byStyle.set(pair.style, [])
    byStyle.get(pair.style)!.push(score)
  })
  return Array.from(byStyle.entries()).map(([style, scores]) => ({
    style,
    mean: scores.length ? round4(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    count: scores.length,
  }))
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

// ── File → base64 helper ──────────────────────────────────────────

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // strip "data:image/png;base64," prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── CSV export ────────────────────────────────────────────────────

function downloadCSV(rows: (string | number)[][], filename: string): void {
  const csv = rows.map(row => row.map(cellToCSV).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function cellToCSV(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportAblationCSV(runs: AblationRunRecord[]): void {
  const rows: (string | number)[][] = [
    ['story_id', 'scene_prompt', 'style', 'ip_scale', 'similarity_score', 'face_detected', 'timestamp'],
  ]
  for (const run of runs) {
    for (const r of run.results) {
      rows.push([
        run.story_id, run.scene_prompt, run.style,
        r.ip_scale, r.similarity_score, r.face_detected ? 'yes' : 'no',
        new Date(run.ts).toISOString(),
      ])
    }
  }
  downloadCSV(rows, 'ablation_results.csv')
}

export function exportClipScoreCSV(
  pairs: ClipPairInput[],
  results: ClipScoreResultItem[],
): void {
  const rows: (string | number)[][] = [['style', 'prompt_preview', 'clip_score']]
  pairs.forEach((pair, i) => {
    rows.push([pair.style, results[i]?.prompt_preview ?? '', results[i]?.clip_score ?? ''])
  })
  downloadCSV(rows, 'clip_score_results.csv')
}
