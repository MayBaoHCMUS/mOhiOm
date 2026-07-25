'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  SUS_QUESTIONS,
  calcSUSScore,
  getSUSGrade,
  saveResponseLocal,
  loadResponsesLocal,
  clearResponsesLocal,
  type SUSResponse,
} from '@/lib/susScoring'
import {
  saveSUSToBackend,
  fetchSUSFromBackend,
  exportSUSCSV,
  exportSUSLocalCSV,
  clearSUSOnBackend,
} from '@/lib/susApi'

// ── Full-page survey ──────────────────────────────────────────────────────────

interface SUSFormProps {
  participantId: string
  taskId?: string
  onComplete?: (score: number) => void
}

const SCALE_LABELS: Record<number, string> = { 1: 'SD', 2: 'D', 3: 'N', 4: 'A', 5: 'SA' }

export function SUSForm({ participantId, taskId, onComplete }: SUSFormProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  const allAnswered = SUS_QUESTIONS.every((q) => answers[q.id] !== undefined)
  const progress = Object.keys(answers).length

  function handleSubmit() {
    if (!allAnswered) return
    const s = calcSUSScore(answers)
    const resp: SUSResponse = {
      participant_id: participantId,
      answers,
      score: s,
      submitted_at: new Date().toISOString(),
      task_id: taskId,
    }

    saveResponseLocal(resp)
    saveSUSToBackend(resp).catch((err) =>
      console.warn('SUS backend save failed (localStorage kept):', err)
    )

    setScore(s)
    setSubmitted(true)
    onComplete?.(s)
  }

  if (submitted && score !== null) {
    const grade = getSUSGrade(score)
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div
          style={{
            background: grade.color + '18',
            border: `1.5px solid ${grade.color}40`,
            borderRadius: 16,
            padding: '2rem',
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, color: grade.color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: grade.color, marginTop: 4 }}>{grade.label}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            {grade.desc} · Thank you, {participantId}!
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: '#888',
            marginBottom: 6,
          }}
        >
          Usability Survey · {participantId}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>How was your experience?</h1>
        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
          Rate each statement 1 (Strongly Disagree) to 5 (Strongly Agree).
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: '#888' }}>Progress</span>
          <span style={{ fontSize: 11, color: '#888' }}>{progress}/10</span>
        </div>
        <div style={{ height: 4, background: '#e1e0d9', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progress * 10}%`,
              background: '#185FA5',
              borderRadius: 2,
              transition: 'width 0.2s',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
        {SUS_QUESTIONS.map((q, idx) => {
          const selected = answers[q.id]
          return (
            <div
              key={q.id}
              style={{
                background: selected ? '#f8f8f6' : '#fafaf8',
                border: `0.5px solid ${selected ? '#ccc' : '#e1e0d9'}`,
                borderRadius: 12,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#bbb', minWidth: 22, paddingTop: 2 }}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: '#111', margin: 0 }}>{q.text}</p>
              </div>
              <div
                style={{ paddingLeft: 32, display: 'flex', gap: 6 }}
                role="radiogroup"
                aria-label={`Question ${q.id}`}
              >
                {[1, 2, 3, 4, 5].map((val) => {
                  const isSel = selected === val
                  return (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      aria-label={`${val} — ${SCALE_LABELS[val]}`}
                      onClick={() => setAnswers((p) => ({ ...p, [q.id]: val }))}
                      style={{
                        flex: 1,
                        padding: '8px 4px 6px',
                        borderRadius: 8,
                        border: isSel ? '1.5px solid #185FA5' : '0.5px solid #e1e0d9',
                        background: isSel ? '#185FA5' : 'transparent',
                        color: isSel ? '#fff' : '#888',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: isSel ? 700 : 400,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{val}</span>
                      <span style={{ fontSize: 9, letterSpacing: '.02em' }}>{SCALE_LABELS[val]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ position: 'sticky', bottom: 12 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered}
          style={{
            width: '100%',
            padding: '13px 24px',
            borderRadius: 12,
            border: 'none',
            background: allAnswered ? '#185FA5' : '#e1e0d9',
            color: allAnswered ? '#fff' : '#aaa',
            fontSize: 14,
            fontWeight: 600,
            cursor: allAnswered ? 'pointer' : 'not-allowed',
          }}
        >
          {allAnswered ? 'Submit survey →' : `Answer ${10 - progress} more to submit`}
        </button>
      </div>
    </div>
  )
}

// ── Researcher results view ───────────────────────────────────────────────────

const actionButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '0.5px solid #e1e0d9',
  background: 'transparent',
  fontSize: 13,
  cursor: 'pointer',
}

export function SUSResults() {
  const [responses, setResponses] = useState<SUSResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'server' | 'local'>('server')
  const [notice, setNotice] = useState<string | null>(null)
  // Clearing is irreversible, so it takes a deliberate second step: the researcher
  // has to type the word out before the delete button becomes live.
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    if (source === 'server') {
      try {
        const data = await fetchSUSFromBackend()
        setResponses(
          data.responses.map((r) => ({
            participant_id: r.participant_id,
            // Server keys answers as q1..q10; the local shape is keyed by number.
            answers: Object.fromEntries(
              Object.entries(r.answers).map(([k, v]) => [parseInt(k.replace('q', ''), 10), v])
            ),
            score: r.score,
            submitted_at: r.submitted_at,
            task_id: r.task_id ?? undefined,
          }))
        )
      } catch {
        // Backend unreachable — show whatever this browser cached instead.
        setSource('local')
        setResponses(loadResponsesLocal())
        setNotice('Backend unreachable — showing this browser’s local cache.')
      }
    } else {
      setResponses(loadResponsesLocal())
    }
    setLoading(false)
  }, [source])

  useEffect(() => {
    load()
  }, [load])

  async function handleExport() {
    try {
      const ok = source === 'server' ? await exportSUSCSV() : exportSUSLocalCSV(responses)
      if (!ok) setNotice('Nothing to export yet.')
    } catch (err) {
      setNotice(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleClear() {
    setClearing(true)
    try {
      let message: string
      if (source === 'server') {
        const n = await clearSUSOnBackend()
        message = `Deleted ${n} response${n === 1 ? '' : 's'} from MongoDB.`
      } else {
        clearResponsesLocal()
        message = 'Local cache cleared.'
      }
      setConfirmText('')
      setConfirming(false)
      // load() resets the notice, so report the outcome only after it settles.
      await load()
      setNotice(message)
    } catch (err) {
      setNotice(`Clear failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setClearing(false)
    }
  }

  const scores = responses.map((r) => r.score)
  const mean = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const grade = mean !== null ? getSUSGrade(mean) : null

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Loading…</div>

  return (
    <div
      style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: '1.5rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {notice && (
        <div
          style={{
            background: '#FFFBEB',
            border: '0.5px solid #FDE68A',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            color: '#92400E',
          }}
        >
          {notice}
        </div>
      )}

      {!responses.length ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
          <p style={{ marginBottom: 16 }}>No responses yet.</p>
        </div>
      ) : (
        <>
          <div
            style={{
              background: '#f5f5f0',
              border: '0.5px solid #e1e0d9',
              borderRadius: 16,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 52, fontWeight: 700, color: grade?.color, lineHeight: 1 }}>{mean}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: grade?.color }}>{grade?.label}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Mean SUS</div>
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Participants', value: responses.length },
                { label: 'Min', value: Math.min(...scores) },
                { label: 'Max', value: Math.max(...scores) },
                { label: 'Threshold', value: '71+' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: '#f5f5f0',
              border: '0.5px solid #e1e0d9',
              borderRadius: 12,
              padding: '16px 20px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: '#888',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Per-participant scores
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {responses.map((r, i) => {
                const g = getSUSGrade(r.score)
                return (
                  <div
                    key={`${r.participant_id}-${r.submitted_at}-${i}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 500, minWidth: 40 }}>{r.participant_id}</span>
                    <div style={{ flex: 1, height: 20, background: '#e1e0d9', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${r.score}%`,
                          height: '100%',
                          background: g.color,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 6,
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>
                          {r.score >= 20 ? r.score : ''}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: g.color, minWidth: 28 }}>{r.score}</span>
                    <span style={{ fontSize: 10, color: g.color, minWidth: 56 }}>{g.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={handleExport} style={{ ...actionButtonStyle, flex: 1, fontWeight: 500 }}>
          Export CSV →
        </button>
        <button type="button" onClick={load} style={{ ...actionButtonStyle, color: '#888' }}>
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setSource((s) => (s === 'server' ? 'local' : 'server'))}
          style={{ ...actionButtonStyle, fontSize: 12, color: '#888' }}
        >
          {source === 'server' ? 'MongoDB ✓' : 'localStorage'}
        </button>
      </div>

      {responses.length > 0 &&
        (confirming ? (
          <div
            style={{
              border: '1px solid #FCA5A5',
              background: '#FEF2F2',
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: '#991B1B', margin: 0 }}>
              Delete all {responses.length} response{responses.length === 1 ? '' : 's'}?
            </p>
            <p style={{ fontSize: 12, color: '#B91C1C', margin: '4px 0 10px' }}>
              {source === 'server'
                ? 'This wipes the MongoDB collection. There is no backup — export the CSV first if you still need this data.'
                : 'This clears this browser’s local cache only.'}
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              aria-label="Type DELETE to confirm"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #FCA5A5',
                background: '#fff',
                fontSize: 13,
                marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleClear}
                disabled={confirmText !== 'DELETE' || clearing}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: confirmText === 'DELETE' && !clearing ? '#DC2626' : '#FECACA',
                  color: confirmText === 'DELETE' && !clearing ? '#fff' : '#F87171',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: confirmText === 'DELETE' && !clearing ? 'pointer' : 'not-allowed',
                }}
              >
                {clearing ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                  setConfirmText('')
                }}
                style={{ ...actionButtonStyle, background: '#fff', color: '#888' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{ ...actionButtonStyle, borderColor: '#FCA5A5', color: '#B91C1C', fontSize: 12 }}
          >
            Clear all responses…
          </button>
        ))}
    </div>
  )
}
