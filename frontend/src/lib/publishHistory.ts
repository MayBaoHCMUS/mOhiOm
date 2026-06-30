const STORAGE_KEY = 'publish_history'

export interface PublishedComicRecord {
  comic_id:     string
  reader_url:   string
  title:        string
  page_count:   number
  published_at: number   // local timestamp (ms) when published from this browser
}

/** Record a newly published comic in localStorage. Called right after /publish succeeds. */
export function recordPublish(record: PublishedComicRecord): void {
  try {
    const existing: PublishedComicRecord[] =
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    existing.unshift(record)   // newest first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 100)))
  } catch { /* noop — private browsing */ }
}

/** Get all comics published from this browser, newest first. */
export function getPublishHistory(): PublishedComicRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Remove one entry from local history (does not unpublish on the server). */
export function removeFromHistory(comicId: string): void {
  try {
    const existing = getPublishHistory().filter(r => r.comic_id !== comicId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  } catch { /* noop */ }
}

/**
 * Fetch live read counts for a list of comic IDs.
 * Uses the aggregate /admin/publish-stats endpoint (one request for all comics)
 * instead of N requests to /r/{id}/stats.
 * All Kaggle server calls go through /api/manga-proxy to avoid CORS.
 */
export async function fetchLiveStats(
  apiUrl: string,
  comicIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!comicIds.length || !apiUrl) return map

  try {
    const res = await fetch('/api/manga-proxy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ apiUrl, path: '/admin/publish-stats', method: 'GET' }),
    })
    if (!res.ok) return map
    const data = await res.json() as { comics: { comic_id: string; read_count: number }[] }
    for (const c of data.comics) {
      map.set(c.comic_id, c.read_count)
    }
  } catch { /* noop — server may have restarted, comics are gone */ }

  return map
}
