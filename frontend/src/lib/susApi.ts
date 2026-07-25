/**
 * SUS survey backend calls — persists responses to MongoDB via FastAPI.
 *
 * Plain fetch rather than the axios client in services/api.ts: these endpoints are
 * unauthenticated by design (participants have no account), so none of the cookie
 * or interceptor behavior applies.
 */

import { getSUSGrade, type SUSResponse } from '@/lib/susScoring'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'

export interface SUSServerResponse {
  id: string
  participant_id: string
  answers: Record<string, number> // { q1: 4, q2: 2, ... }
  score: number
  task_id: string | null
  submitted_at: string
  created_at: string
}

export interface SUSFetchResult {
  count: number
  mean_score: number | null
  responses: SUSServerResponse[]
}

/**
 * Fire-and-forget from the caller's perspective — always invoked with .catch(),
 * never awaited, so a slow or dead backend can't stall the submit button.
 */
export async function saveSUSToBackend(payload: {
  participant_id: string
  answers: Record<number, number>
  score: number
  task_id?: string
  submitted_at?: string
}): Promise<void> {
  // The API keys answers by name: { 1: 4 } -> { q1: 4 }
  const answers: Record<string, number> = {}
  for (let i = 1; i <= 10; i++) {
    answers[`q${i}`] = payload.answers[i]
  }

  const res = await fetch(`${API_BASE}/survey/sus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: payload.participant_id,
      answers,
      score: payload.score,
      task_id: payload.task_id,
      submitted_at: payload.submitted_at,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SUS save failed ${res.status}: ${text}`)
  }
}

/** Admin-only: needs the session cookie, and 401/403 for anyone off the allowlist. */
export async function fetchSUSFromBackend(): Promise<SUSFetchResult> {
  const res = await fetch(`${API_BASE}/survey/sus`, { credentials: 'include' })
  if (res.status === 401 || res.status === 403) {
    throw new Error('Not authorized to read SUS responses')
  }
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return res.json()
}

/**
 * Admin-only: wipes every stored response. Irreversible — there is no soft-delete
 * and no backup, so callers must confirm before reaching this. Returns the count.
 */
export async function clearSUSOnBackend(): Promise<number> {
  const res = await fetch(`${API_BASE}/survey/sus`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error('Not authorized to clear SUS responses')
  }
  if (!res.ok) throw new Error(`Clear failed: ${res.status}`)
  const data = await res.json()
  return data.deleted_count ?? 0
}

const CSV_HEADER = [
  'participant_id',
  'score',
  'grade',
  'task_id',
  ...Array.from({ length: 10 }, (_, i) => `Q${i + 1}`),
  'submitted_at',
]

function cellToCSV(value: string | number): string {
  const s = String(value)
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCSV(rows: (string | number)[][], filename: string): void {
  const csv = [CSV_HEADER, ...rows].map((row) => row.map(cellToCSV).join(',')).join('\n')
  // BOM so Excel reads the file as UTF-8 and renders Vietnamese labels correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Exports the MongoDB dataset. Returns false if there was nothing to export. */
export async function exportSUSCSV(): Promise<boolean> {
  const data = await fetchSUSFromBackend()
  if (!data.responses.length) return false

  const rows = data.responses.map((r) => [
    r.participant_id,
    r.score,
    getSUSGrade(r.score).label,
    r.task_id ?? '',
    ...Array.from({ length: 10 }, (_, i) => r.answers[`q${i + 1}`] ?? ''),
    r.submitted_at,
  ])
  downloadCSV(rows, 'sus_results.csv')
  return true
}

/** Same CSV shape, from the localStorage cache — used when the results view is in local mode. */
export function exportSUSLocalCSV(responses: SUSResponse[]): boolean {
  if (!responses.length) return false

  const rows = responses.map((r) => [
    r.participant_id,
    r.score,
    getSUSGrade(r.score).label,
    r.task_id ?? '',
    ...Array.from({ length: 10 }, (_, i) => r.answers[i + 1] ?? ''),
    r.submitted_at,
  ])
  downloadCSV(rows, 'sus_results_local.csv')
  return true
}
