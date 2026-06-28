// Shared style properties — used to configure the next watermark to add
export interface WatermarkTemplate {
  text:     string
  rotation: number   // degrees
  fontSize: number   // at 600px-wide canvas; scaled proportionally on export
  color:    string
  opacity:  number   // 0–1
}

// A placed watermark instance on the canvas
export interface WatermarkConfig extends WatermarkTemplate {
  id: string
  x:  number   // 0–1 fractional horizontal centre
  y:  number   // 0–1 fractional vertical centre
}

export const DEFAULT_WATERMARK_TEMPLATE: WatermarkTemplate = {
  text:     '',
  rotation: 0,
  fontSize: 28,
  color:    '#111827',
  opacity:  0.20,
}

export function createWatermark(template: WatermarkTemplate, x = 0.5, y = 0.5): WatermarkConfig {
  return { ...template, id: crypto.randomUUID(), x, y }
}

// ── Helpers ────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('loadImage failed'))
    img.src = src.startsWith('data:') ? src : `data:image/png;base64,${src}`
  })
}

function drawWatermark(
  ctx:     CanvasRenderingContext2D,
  config:  WatermarkConfig,
  canvasW: number,
  canvasH: number,
): void {
  if (!config.text.trim()) return

  const fontSize = config.fontSize * (canvasW / 600)

  ctx.save()
  ctx.globalAlpha  = config.opacity
  ctx.fillStyle    = config.color
  ctx.font         = `400 ${fontSize}px Arial, sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'

  ctx.translate(config.x * canvasW, config.y * canvasH)
  if (config.rotation) ctx.rotate((config.rotation * Math.PI) / 180)
  ctx.fillText(config.text, 0, 0)

  ctx.restore()
}

async function watermarkImage(src: string, watermarks: WatermarkConfig[]): Promise<string> {
  const img    = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx    = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  for (const wm of watermarks) drawWatermark(ctx, wm, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

/**
 * Apply all placed watermarks to every page image.
 * Returns new string[] — does NOT mutate input. Called at export time only.
 */
export async function applyWatermark(
  pageImages:  string[],
  watermarks:  WatermarkConfig[],
  onProgress?: (current: number, total: number) => void,
): Promise<string[]> {
  const active = watermarks.filter(w => w.text.trim())
  if (!active.length) return pageImages

  const result: string[] = []
  for (let i = 0; i < pageImages.length; i++) {
    onProgress?.(i + 1, pageImages.length)
    result.push(await watermarkImage(pageImages[i], active))
  }
  return result
}
