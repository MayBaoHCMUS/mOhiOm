function stripDataPrefix(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
  return match ? match[1] : dataUrl
}

export interface PublishResult {
  comic_id:   string
  reader_url: string
  page_count: number
}

export interface PublishStats {
  comic_id:     string
  title:        string
  page_count:   number
  read_count:   number
  published_at: number
}

/**
 * Calls the comic-reader server directly from the browser rather than through
 * /api/manga-proxy.
 *
 * The proxy existed only to dodge CORS, but the server already sends
 * `Access-Control-Allow-Origin` for the app's origin (verified: the preflight
 * for POST /publish returns 200 with allow-methods incl. POST). Routing through
 * Vercel instead capped the request at Vercel's 4.5 MB body limit, and a
 * publish payload carries every page as base64 — so any comic over ~3.3 MB of
 * PNG failed with 413 FUNCTION_PAYLOAD_TOO_LARGE. Going direct removes the cap
 * entirely; the browser talks to the tunnel with no serverless hop in between.
 */
async function proxy<T>(
  apiUrl: string,
  path:   string,
  method: string      = 'POST',
  payload?: unknown,
): Promise<T> {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(payload !== undefined && method !== 'GET' ? { body: JSON.stringify(payload) } : {}),
  })
  if (!res.ok) {
    // FastAPI errors come back as { detail }, not the { error } the proxy used.
    const err = await res.json().catch(() => ({})) as { detail?: unknown; error?: string }
    const detail = typeof err.detail === 'string' ? err.detail : undefined
    throw new Error(detail ?? err.error ?? `Comic server error ${res.status}`)
  }
  // DELETE and any non-JSON success (e.g. 204) have nothing to parse — the old
  // proxy collapsed those to { ok: true }, so keep callers seeing the same thing.
  if (res.status === 204 || !(res.headers.get('content-type') ?? '').includes('application/json')) {
    return { ok: true } as T
  }
  return res.json() as Promise<T>
}

export async function publishComic(
  apiUrl: string,
  pages:  string[],
  title:  string,
  author: string,
): Promise<PublishResult> {
  return proxy<PublishResult>(apiUrl, '/publish', 'POST', {
    pages:  pages.map(stripDataPrefix),
    title,
    author,
  })
}

export async function getComicStats(apiUrl: string, comicId: string): Promise<PublishStats> {
  return proxy<PublishStats>(apiUrl, `/r/${comicId}/stats`, 'GET')
}

export async function unpublishComic(apiUrl: string, comicId: string): Promise<void> {
  await proxy(apiUrl, `/r/${comicId}`, 'DELETE')
}

export function buildShareUrl(apiUrl: string, readerUrl: string): string {
  return `${apiUrl}${readerUrl}`
}
