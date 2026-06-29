import { LAYOUT_TEMPLATES, PAGE_W, PAGE_H, FALLBACK_LAYOUT_KEY } from './layoutTemplates'
import type { Polygon } from './layoutTemplates'

export type { Polygon }

export interface BorderConfig {
  borderColor: string
  borderWidth: number
  gutterColor: string
  gutterWidth: number
  pageMargin:  number
  pageBg:      string
}

export const DEFAULT_BORDER_CONFIG: BorderConfig = {
  borderColor: '#0A0A0A',
  borderWidth: 3,
  gutterColor: '#FFFFFF',
  gutterWidth: 10,
  pageMargin:  24,
  pageBg:      '#FFFFFF',
}

// ── Helpers ────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('loadImage failed'))
    img.src = (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http'))
      ? src
      : `data:image/png;base64,${src}`
  })
}

// Scale-to-cover: returns source rect for the 9-arg drawImage form
function scaleCover(
  img:     HTMLImageElement,
  targetW: number,
  targetH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const ratio   = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight)
  const scaledW = img.naturalWidth  * ratio
  const scaledH = img.naturalHeight * ratio
  const sx = (scaledW - targetW) / 2 / ratio
  const sy = (scaledH - targetH) / 2 / ratio
  const sw = targetW / ratio
  const sh = targetH / ratio
  return { sx, sy, sw, sh }
}

/**
 * Paste a panel image into a polygon slot, clipping to the polygon boundary.
 * Uses ctx.save/restore so the clip path doesn't leak to subsequent draws.
 */
async function pastePanelIntoPolygon(
  ctx:  CanvasRenderingContext2D,
  src:  string,
  poly: Polygon,
): Promise<void> {
  const img = await loadImage(src)

  const xs = poly.map(p => p[0])
  const ys = poly.map(p => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(...ys), y1 = Math.max(...ys)
  const bw = x1 - x0
  const bh = y1 - y0

  ctx.save()
  ctx.beginPath()
  poly.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
  ctx.closePath()
  ctx.clip()

  const { sx, sy, sw, sh } = scaleCover(img, bw, bh)
  ctx.drawImage(img, sx, sy, sw, sh, x0, y0, bw, bh)

  ctx.restore()
}

/**
 * Draw polygon border on top of the panel image.
 * Called AFTER pastePanelIntoPolygon.
 */
function drawPolygonBorder(
  ctx:    CanvasRenderingContext2D,
  poly:   Polygon,
  config: BorderConfig,
): void {
  if (config.borderWidth <= 0) return
  ctx.beginPath()
  poly.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
  ctx.closePath()
  ctx.strokeStyle = config.borderColor
  ctx.lineWidth   = config.borderWidth
  ctx.stroke()
}

/**
 * Re-compose a single page from panel images + layout key + border config.
 * Returns pure base64 PNG (no data: prefix).
 */
async function recomposePage(
  panelSrcs: string[],
  layoutKey: string,
  config:    BorderConfig,
): Promise<string> {
  const canvas  = document.createElement('canvas')
  canvas.width  = PAGE_W
  canvas.height = PAGE_H
  const ctx     = canvas.getContext('2d')!

  // 1. Page background
  ctx.fillStyle = config.pageBg
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)

  // 2. Gutter color area (between panels)
  if (config.gutterColor !== config.pageBg) {
    const m = config.pageMargin
    ctx.fillStyle = config.gutterColor
    ctx.fillRect(m, m, PAGE_W - 2 * m, PAGE_H - 2 * m)
  }

  // 3. Look up panel polygons
  const template = LAYOUT_TEMPLATES[layoutKey] ?? LAYOUT_TEMPLATES[FALLBACK_LAYOUT_KEY]
  const panels   = template.slice(0, panelSrcs.length)

  // 4. Paste each panel image then draw its border
  for (let i = 0; i < panels.length; i++) {
    if (!panelSrcs[i]) continue
    await pastePanelIntoPolygon(ctx, panelSrcs[i], panels[i].polygon)
    drawPolygonBorder(ctx, panels[i].polygon, config)
  }

  return canvas.toDataURL('image/png').split(',')[1]
}

/**
 * Re-compose all pages with new border config.
 * Returns new string[] of pure base64 PNGs — does NOT mutate input.
 * Replaces pages[] in state immediately (not just at export).
 */
export async function recomposePages(
  panelImages:  string[][],
  layouts:      string[],
  config:       BorderConfig,
  onProgress?:  (current: number, total: number) => void,
): Promise<string[]> {
  const result: string[] = []
  for (let i = 0; i < panelImages.length; i++) {
    onProgress?.(i + 1, panelImages.length)
    result.push(await recomposePage(panelImages[i], layouts[i] ?? FALLBACK_LAYOUT_KEY, config))
  }
  return result
}

/**
 * Re-compose a single page for the live preview.
 * Returns pure base64 PNG.
 */
export async function previewBorderStyle(
  panelSrcs: string[],
  layoutKey: string,
  config:    BorderConfig,
): Promise<string> {
  return recomposePage(panelSrcs, layoutKey, config)
}
