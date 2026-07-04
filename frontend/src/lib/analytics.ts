// ── Event schema ──────────────────────────────────────────────────
export interface GenerateEvent {
  id:             string
  ts:             number        // Date.now()
  type:           "panel" | "story" | "export" | "character_save"
  story_id:       string
  style:          string        // "manga" | "webtoon" | "chibi" | "watercolor"
  mood?:          string
  intensity?:     number        // 1–5
  duration_ms:    number        // actual time (performance.now delta)
  has_character:  boolean
  ip_scale?:      number
  export_format?: "pdf" | "epub" | "zip"
  page_count?:    number
  panel_count?:   number
}

const STORAGE_KEY = "comic_events"
const MAX_EVENTS  = 500

// ── Write ─────────────────────────────────────────────────────────
export function trackEvent(event: Omit<GenerateEvent, "id" | "ts">): void {
  try {
    const existing: GenerateEvent[] =
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    existing.push({ ...event, id: Date.now().toString(), ts: Date.now() })
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(existing.slice(-MAX_EVENTS))
    )
  } catch {
    // localStorage disabled — fail silently
  }
}

// ── Read ──────────────────────────────────────────────────────────
export function getEvents(filters?: {
  type?:     GenerateEvent["type"]
  story_id?: string
  since?:    number
}): GenerateEvent[] {
  try {
    const all: GenerateEvent[] =
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    return all.filter(e =>
      (!filters?.type     || e.type     === filters.type) &&
      (!filters?.story_id || e.story_id === filters.story_id) &&
      (!filters?.since    || e.ts       >= filters.since)
    )
  } catch {
    return []
  }
}

export function clearEvents(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}

// ── Compute ───────────────────────────────────────────────────────
export interface DashboardMetrics {
  total_panels:          number
  total_stories:         number
  avg_gen_ms:            number   // 0 means no valid timing data
  style_dist:            Record<string, number>
  mood_dist:             Record<string, number>
  char_usage_pct:        number
  export_count:          number
  export_completion_pct: number   // % of stories exported at least once (always 0–100)
  daily_counts:          { date: string; count: number }[]
}

export function computeMetrics(events: GenerateEvent[], daysToShow = 7): DashboardMetrics {
  const panels  = events.filter(e => e.type === "panel" || e.type === "story")
  const exports = events.filter(e => e.type === "export")
  const storyIds = new Set(panels.map(e => e.story_id))

  // style distribution
  const style_dist: Record<string, number> = {}
  for (const e of panels) {
    style_dist[e.style] = (style_dist[e.style] ?? 0) + 1
  }

  // mood distribution
  const mood_dist: Record<string, number> = {}
  for (const e of panels) {
    if (e.mood) mood_dist[e.mood] = (mood_dist[e.mood] ?? 0) + 1
  }

  // avg gen time — exclude panels with no timing data (duration_ms === 0)
  const timedPanels = panels.filter(e => e.duration_ms > 0)
  const avg_gen_ms = timedPanels.length
    ? Math.round(timedPanels.reduce((s, e) => s + e.duration_ms, 0) / timedPanels.length)
    : 0

  // export completion: unique stories exported / total stories (always 0–100)
  const exportedStoryIds = new Set(
    exports.map(e => e.story_id).filter(id => storyIds.has(id))
  )
  const export_completion_pct = storyIds.size
    ? Math.min(100, Math.round(exportedStoryIds.size / storyIds.size * 100))
    : 0

  // daily counts — label format depends on days shown
  const daily_counts = Array.from({ length: daysToShow }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (daysToShow - 1 - i))
    let date: string
    if (daysToShow <= 7) {
      date = d.toLocaleDateString("en-US", { weekday: "short" })
    } else if (daysToShow <= 30) {
      date = `${d.getMonth() + 1}/${d.getDate()}`
    } else {
      date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const dayEnd   = dayStart + 86_400_000
    const count = panels.filter(e => e.ts >= dayStart && e.ts < dayEnd).length
    return { date, count }
  })

  return {
    total_panels:          panels.length,
    total_stories:         storyIds.size,
    avg_gen_ms,
    style_dist,
    mood_dist,
    char_usage_pct:        panels.length
      ? Math.round(panels.filter(e => e.has_character).length / panels.length * 100)
      : 0,
    export_count:          exports.length,
    export_completion_pct,
    daily_counts,
  }
}
