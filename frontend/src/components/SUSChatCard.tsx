'use client'

import { useState } from 'react'
import { SUS_QUESTIONS, calcSUSScore, getSUSGrade, saveResponseLocal } from '@/lib/susScoring'
import { saveSUSToBackend } from '@/lib/susApi'

interface SUSChatCardProps {
  participantId: string
  taskId?: string
  onComplete: (score: number) => void
}

const SCALE = [1, 2, 3, 4, 5]

/** Compact SUS survey rendered inline in the Mo chat thread. */
export function SUSChatCard({ participantId, taskId, onComplete }: SUSChatCardProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  const progress = Object.keys(answers).length
  const allAnswered = progress === 10

  function handleAnswer(qId: number, val: number) {
    setAnswers((prev) => ({ ...prev, [qId]: val }))
  }

  function handleSubmit() {
    if (!allAnswered) return
    const s = calcSUSScore(answers)
    const resp = {
      participant_id: participantId,
      answers,
      score: s,
      submitted_at: new Date().toISOString(),
      task_id: taskId,
    }

    // localStorage first — synchronous, offline-safe.
    saveResponseLocal(resp)
    // Then MongoDB, fire-and-forget: the UI must not wait on the network.
    saveSUSToBackend(resp).catch((err) =>
      console.warn('SUS backend save failed (localStorage kept):', err)
    )

    setScore(s)
    setSubmitted(true)
    onComplete(s)
  }

  if (submitted && score !== null) {
    const grade = getSUSGrade(score)
    return (
      <div
        style={{
          background: '#f0faf5',
          border: `1.5px solid ${grade.color}40`,
          borderRadius: 12,
          padding: '14px 16px',
          textAlign: 'center',
          minWidth: 200,
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: grade.color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: grade.color, marginTop: 2 }}>{grade.label}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>SUS Score · Thank you!</div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '0.5px solid #e1e0d9',
        borderRadius: 14,
        overflow: 'hidden',
        width: 'min(360px, 90vw)',
      }}
    >
      <div
        style={{
          padding: '12px 14px 10px',
          borderBottom: '0.5px solid #e1e0d9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Quick Usability Survey</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>10 questions · ~2 minutes</div>
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>{progress}/10</div>
      </div>

      <div style={{ height: 3, background: '#f0f0ee' }}>
        <div style={{ height: '100%', width: `${progress * 10}%`, background: '#185FA5', transition: 'width 0.2s' }} />
      </div>

      <div
        style={{
          maxHeight: 380,
          overflowY: 'auto',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {SUS_QUESTIONS.map((q, idx) => {
          const selected = answers[q.id]
          return (
            <div key={q.id}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#bbb', minWidth: 18, paddingTop: 1 }}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <p style={{ fontSize: 12, lineHeight: 1.5, color: '#222', margin: 0 }}>{q.text}</p>
              </div>
              <div
                style={{ paddingLeft: 26, display: 'flex', gap: 5 }}
                role="radiogroup"
                aria-label={`Question ${q.id}`}
              >
                {SCALE.map((val) => {
                  const isSel = selected === val
                  return (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      aria-label={String(val)}
                      onClick={() => handleAnswer(q.id, val)}
                      style={{
                        flex: 1,
                        height: 34,
                        borderRadius: 8,
                        border: isSel ? '1.5px solid #185FA5' : '0.5px solid #e1e0d9',
                        background: isSel ? '#185FA5' : '#fafaf8',
                        color: isSel ? '#fff' : '#888',
                        fontSize: 12,
                        fontWeight: isSel ? 700 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.1s',
                      }}
                    >
                      {val}
                    </button>
                  )
                })}
              </div>
              {(idx === 0 || idx === 9) && (
                <div style={{ paddingLeft: 26, display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: 9, color: '#ccc' }}>Disagree</span>
                  <span style={{ fontSize: 9, color: '#ccc' }}>Agree</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e1e0d9' }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 10,
            border: 'none',
            background: allAnswered ? '#185FA5' : '#e1e0d9',
            color: allAnswered ? '#fff' : '#aaa',
            fontSize: 13,
            fontWeight: 600,
            cursor: allAnswered ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          {allAnswered ? 'Submit →' : `${10 - progress} more to go`}
        </button>
      </div>
    </div>
  )
}
