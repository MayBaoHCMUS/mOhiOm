/**
 * System Usability Scale — questions, scoring, and local persistence.
 *
 * Single source of truth: SUSForm and SUSChatCard both import from here so the
 * question wording and scoring can never drift apart between the two surfaces.
 * Question text is the standardized SUS instrument — do not reword it.
 */

export interface SUSQuestion {
  id: number
  text: string
  polarity: 'positive' | 'negative'
}

export const SUS_QUESTIONS: SUSQuestion[] = [
  { id: 1,  text: 'I think that I would like to use this system frequently.',                                   polarity: 'positive' },
  { id: 2,  text: 'I found the system unnecessarily complex.',                                                  polarity: 'negative' },
  { id: 3,  text: 'I thought the system was easy to use.',                                                      polarity: 'positive' },
  { id: 4,  text: 'I think that I would need the support of a technical person to be able to use this system.',  polarity: 'negative' },
  { id: 5,  text: 'I found the various functions in this system were well integrated.',                          polarity: 'positive' },
  { id: 6,  text: 'I thought there was too much inconsistency in this system.',                                  polarity: 'negative' },
  { id: 7,  text: 'I would imagine that most people would learn to use this system very quickly.',               polarity: 'positive' },
  { id: 8,  text: 'I found the system very cumbersome to use.',                                                  polarity: 'negative' },
  { id: 9,  text: 'I felt very confident using the system.',                                                     polarity: 'positive' },
  { id: 10, text: 'I needed to learn a lot of things before I could get going with this system.',                polarity: 'negative' },
]

/** Returns 0-100, or -1 if any question is unanswered. */
export function calcSUSScore(answers: Record<number, number>): number {
  let sum = 0
  for (const q of SUS_QUESTIONS) {
    const val = answers[q.id]
    if (val === undefined) return -1
    sum += q.polarity === 'positive' ? val - 1 : 5 - val
  }
  return Math.round(sum * 2.5)
}

export function getSUSGrade(score: number): { label: string; color: string; desc: string } {
  if (score >= 85) return { label: 'Excellent', color: '#0f6e56', desc: 'Best Imaginable' }
  if (score >= 71) return { label: 'Good',      color: '#1baf7a', desc: 'Above Average'  }
  if (score >= 51) return { label: 'OK',        color: '#eda100', desc: 'Below Average'  }
  return { label: 'Poor', color: '#c0392b', desc: 'Not Acceptable' }
}

export interface SUSResponse {
  participant_id: string
  answers: Record<number, number>
  score: number
  submitted_at: string
  task_id?: string
}

const STORAGE_KEY = 'sus_responses'
const PARTICIPANT_KEY = 'sus_participant_id'

/**
 * Local cache of submissions — written synchronously on submit so a response is
 * never lost to a failed network call. Deduped by participant so a re-submission
 * replaces the earlier one locally (the server keeps an append-only log).
 */
export function saveResponseLocal(resp: SUSResponse): void {
  try {
    const existing: SUSResponse[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    const filtered = existing.filter((r) => r.participant_id !== resp.participant_id)
    filtered.push(resp)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch {
    // private browsing / quota — the server write is the durable copy
  }
}

export function loadResponsesLocal(): SUSResponse[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function clearResponsesLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Stable per-browser participant label, used when the study link has no ?p= param.
 * Kept in localStorage so a participant who reloads keeps the same id.
 */
export function getOrCreateLocalParticipantId(): string {
  try {
    const existing = localStorage.getItem(PARTICIPANT_KEY)
    if (existing) return existing
    const generated = `P-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    localStorage.setItem(PARTICIPANT_KEY, generated)
    return generated
  } catch {
    return `P-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  }
}
