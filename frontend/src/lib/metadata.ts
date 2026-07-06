export interface ComicMetadata {
  title:       string
  author:      string
  description: string
  language:    string
  series:      string
  volume:      string
  year:        string
  publisher:   string
}

export const DEFAULT_METADATA: ComicMetadata = {
  title:       '',
  author:      '',
  description: '',
  language:    'vi',
  series:      '',
  volume:      '',
  year:        new Date().getFullYear().toString(),
  publisher:   'mOhiOm',
}

const STORAGE_KEY = 'comic_metadata'

/** Load metadata from localStorage, merged with defaults. */
export function loadMetadata(): ComicMetadata {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_METADATA }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_METADATA, ...parsed }
  } catch {
    return { ...DEFAULT_METADATA }
  }
}

/** Persist metadata to localStorage. Silently swallows storage errors. */
export function saveMetadata(meta: ComicMetadata): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
  } catch { /* noop — private browsing or quota exceeded */ }
}

/** Clear persisted metadata and return defaults. */
export function clearMetadata(): ComicMetadata {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  return { ...DEFAULT_METADATA }
}

/**
 * Build the filename stem used by all export functions.
 * Keeps Vietnamese characters; replaces spaces with underscores.
 */
export function buildFilename(meta: ComicMetadata): string {
  const parts = [meta.title || 'comic', meta.volume || '', meta.year || ''].filter(Boolean)
  return (
    parts
      .join('_')
      // keep ASCII word chars + Vietnamese (Latin Extended + Vietnamese block)
      .replace(/[^\w\sÀ-ɏḀ-ỿ]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'comic'
  )
}
