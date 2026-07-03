export type PageNumberShape = 'none' | 'circle' | 'pill' | 'square'

export interface PageNumberConfig {
  enabled:   boolean
  position:  'bottom-center' | 'bottom-right' | 'bottom-left'
  startPage: number
  fontSize:  number
  color:     string
  shape:     PageNumberShape
  shapeBg:   string
}

export const DEFAULT_PAGE_NUMBER_CONFIG: PageNumberConfig = {
  enabled:   false,
  position:  'bottom-center',
  startPage: 1,
  fontSize:  24,
  color:     '#ffffff',
  shape:     'pill',
  shapeBg:   '#111111',
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawPageNumber(
  ctx:     CanvasRenderingContext2D,
  label:   string,
  config:  PageNumberConfig,
  canvasW: number,
  canvasH: number,
) {
  const fs      = config.fontSize
  const padding = Math.round(fs * 0.45)
  const margin  = Math.round(fs * 1.2)

  ctx.font = `bold ${fs}px sans-serif`
  const textW = ctx.measureText(label).width
  const textH = fs

  // X: left edge of text
  let tx: number
  if (config.position === 'bottom-left')       tx = margin
  else if (config.position === 'bottom-right')  tx = canvasW - textW - margin
  else                                           tx = (canvasW - textW) / 2

  // Y: baseline (textBaseline = 'bottom')
  const ty = canvasH - margin

  if (config.shape !== 'none') {
    const shapeW = textW + padding * 2
    const shapeH = textH + padding * 2
    const sx = tx - padding
    const sy = ty - textH - padding

    ctx.save()
    ctx.fillStyle = config.shapeBg
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur  = 6

    if (config.shape === 'circle') {
      const r = Math.max(shapeW, shapeH) / 2
      ctx.beginPath()
      ctx.arc(sx + shapeW / 2, sy + shapeH / 2, r, 0, Math.PI * 2)
      ctx.fill()
    } else if (config.shape === 'pill') {
      const r = shapeH / 2
      ctx.beginPath()
      ctx.roundRect(sx, sy, shapeW, shapeH, r)
      ctx.fill()
    } else {
      ctx.fillRect(sx, sy, shapeW, shapeH)
    }

    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle   = config.color
  ctx.textBaseline = 'bottom'
  ctx.fillText(label, tx, ty)
  ctx.restore()
}

export async function applyPageNumbering(
  pages:  string[],
  config: PageNumberConfig,
): Promise<string[]> {
  if (!config.enabled || typeof document === 'undefined') return pages

  return Promise.all(
    pages.map(async (dataUrl, i) => {
      const img    = await loadImage(dataUrl)
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      drawPageNumber(ctx, String(config.startPage + i), config, canvas.width, canvas.height)
      return canvas.toDataURL('image/png')
    }),
  )
}
