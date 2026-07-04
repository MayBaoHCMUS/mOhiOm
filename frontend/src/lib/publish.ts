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

/** All Kaggle server calls go through /api/manga-proxy to avoid CORS. */
async function proxy<T>(
  apiUrl: string,
  path:   string,
  method: string      = 'POST',
  payload?: unknown,
): Promise<T> {
  const res = await fetch('/api/manga-proxy', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ apiUrl, path, method, payload }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Proxy error ${res.status}`)
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
