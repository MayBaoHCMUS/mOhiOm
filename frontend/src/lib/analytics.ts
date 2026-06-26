// ── Event schema ──────────────────────────────────────────────────
export interface GenerateEvent {
  id:             string
  ts:             number        // Date.now()
  type:           "panel" | "story" | "export" | "character_save"
  story_id:       string
  style:          string        // "manga" | "webtoon" | "chibi" | "watercolor"
  mood?:          string        // từ StoryAnalyzer scene
  intensity?:     number        // 1–5
  duration_ms:    number        // thời gian thực tế (performance.now delta)
  has_character:  boolean       // có inject IP-Adapter reference không
  ip_scale?:      number        // ip_adapter_scale dùng
  export_format?: "pdf" | "epub" | "zip"
  page_count?:    number        // số trang khi export
  panel_count?:   number        // số panels khi generate story
}

const STORAGE_KEY = "comic_events"
const MAX_EVENTS  = 500   // giới hạn để localStorage không overflow (~100KB)

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
    // localStorage disabled (private browsing) — fail silently
  }
}

// ── Read ──────────────────────────────────────────────────────────
export function getEvents(filters?: {
  type?:     GenerateEvent["type"]
  story_id?: string
  since?:    number   // timestamp ms
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
  total_panels:       number
  total_stories:      number
  avg_gen_ms:         number
  style_dist:         Record<string, number>   // { manga: 45, webtoon: 20, ... }
  mood_dist:          Record<string, number>   // { emotional: 12, action: 8, ... }
  char_usage_pct:     number   // % panels có character reference
  export_count:       number
  export_rate_pct:    number   // exports / unique stories * 100
  daily_counts:       { date: string; count: number }[]  // last 7 days
}

export function computeMetrics(events: GenerateEvent[]): DashboardMetrics {
  const panels  = events.filter(e => e.type === "panel" || e.type === "story")
  const exports = events.filter(e => e.type === "export")
  const stories = new Set(panels.map(e => e.story_id))

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

  // daily counts (last 7 days)
  const daily_counts = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const date = d.toLocaleDateString("vi-VN", { weekday: "short" })
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const dayEnd   = dayStart + 86_400_000
    const count = panels.filter(e => e.ts >= dayStart && e.ts < dayEnd).length
    return { date, count }
  })

  return {
    total_panels:    panels.length,
    total_stories:   stories.size,
    avg_gen_ms:      panels.length
      ? Math.round(panels.reduce((s, e) => s + e.duration_ms, 0) / panels.length)
      : 0,
    style_dist,
    mood_dist,
    char_usage_pct:  panels.length
      ? Math.round(panels.filter(e => e.has_character).length / panels.length * 100)
      : 0,
    export_count:    exports.length,
    export_rate_pct: stories.size
      ? Math.round(exports.length / stories.size * 100)
      : 0,
    daily_counts,
  }
}
