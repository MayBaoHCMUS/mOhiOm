export type CoverTemplate = 'minimal' | 'manga' | 'dark' | 'artistic'

export interface CoverConfig {
  template:     CoverTemplate
  title:        string
  subtitle:     string
  author:       string
  year:         string
  characterB64: string | null
}

export const COVER_W = 1200
export const COVER_H = 1600

// ── Helpers ───────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http'))
      ? src
      : `data:image/png;base64,${src}`
  })
}

function drawWrappedText(
  ctx:        CanvasRenderingContext2D,
  text:       string,
  x:          number,
  y:          number,
  maxWidth:   number,
  lineHeight: number,
): number {
  if (!text) return 0
  const words = text.split(' ')
  let line    = ''
  let lineIdx = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIdx * lineHeight)
      line = word
      lineIdx++
    } else {
      line = test
    }
  }
  if (line) { ctx.fillText(line, x, y + lineIdx * lineHeight); lineIdx++ }
  return lineIdx
}

// ── Template renderers ─────────────────────────────────────────────

function renderMinimal(
  ctx:    CanvasRenderingContext2D,
  config: CoverConfig,
  img:    HTMLImageElement | null,
): void {
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, COVER_W, COVER_H)

  ctx.fillStyle = '#111111'
  ctx.fillRect(60, 80, COVER_W - 120, 4)
  ctx.fillRect(60, COVER_H - 84, COVER_W - 120, 4)

  if (img) {
    const imgH = Math.round(COVER_H * 0.52)
    const imgW = Math.round(img.naturalWidth * (imgH / img.naturalHeight))
    const imgX = (COVER_W - imgW) / 2
    ctx.drawImage(img, imgX, 120, imgW, imgH)
  }

  ctx.fillStyle = '#111111'
  ctx.font      = "bold 96px 'Arial', sans-serif"
  ctx.textAlign = 'center'
  const titleY  = img ? COVER_H * 0.62 : COVER_H * 0.38
  drawWrappedText(ctx, config.title.toUpperCase(), COVER_W / 2, titleY, COVER_W - 120, 108)

  if (config.subtitle) {
    ctx.font      = "48px 'Arial', sans-serif"
    ctx.fillStyle = '#555555'
    ctx.fillText(config.subtitle, COVER_W / 2, titleY + 220)
  }

  ctx.font      = "36px 'Arial', sans-serif"
  ctx.fillStyle = '#888888'
  const byLine  = [config.author, config.year].filter(Boolean).join('  ·  ')
  if (byLine) ctx.fillText(byLine, COVER_W / 2, COVER_H - 120)
}

function renderManga(
  ctx:    CanvasRenderingContext2D,
  config: CoverConfig,
  img:    HTMLImageElement | null,
): void {
  ctx.fillStyle = '#0A0A0A'
  ctx.fillRect(0, 0, COVER_W, COVER_H)

  ctx.strokeStyle = '#1A1A1A'
  ctx.lineWidth   = 1
  const cx = COVER_W / 2, cy = COVER_H * 0.38
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(angle) * 900, cy + Math.sin(angle) * 1200)
    ctx.stroke()
  }

  if (img) {
    const imgH = Math.round(COVER_H * 0.62)
    const imgW = Math.round(img.naturalWidth * (imgH / img.naturalHeight))
    const imgX = (COVER_W - imgW) / 2
    ctx.drawImage(img, imgX, 60, imgW, imgH)
  }

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, COVER_H - 280, COVER_W, 280)

  ctx.fillStyle = '#0A0A0A'
  ctx.font      = "bold 88px 'Arial', sans-serif"
  ctx.textAlign = 'center'
  drawWrappedText(ctx, config.title.toUpperCase(), COVER_W / 2, COVER_H - 220, COVER_W - 60, 96)

  if (config.author) {
    ctx.font      = "32px 'Arial', sans-serif"
    ctx.fillStyle = '#444444'
    ctx.fillText(config.author, COVER_W / 2, COVER_H - 28)
  }

  if (config.subtitle) {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(60, 60, 220, 64)
    ctx.fillStyle = '#0A0A0A'
    ctx.font      = "bold 36px 'Arial', sans-serif"
    ctx.textAlign = 'left'
    ctx.fillText(config.subtitle, 80, 104)
    ctx.textAlign = 'center'
  }
}

function renderDark(
  ctx:    CanvasRenderingContext2D,
  config: CoverConfig,
  img:    HTMLImageElement | null,
): void {
  ctx.fillStyle = '#0D0D14'
  ctx.fillRect(0, 0, COVER_W, COVER_H)
  ctx.fillStyle = '#1A1A2E'
  ctx.fillRect(0, COVER_H * 0.5, COVER_W, COVER_H * 0.5)

  ctx.strokeStyle = '#534AB7'
  ctx.lineWidth   = 3
  ctx.beginPath()
  ctx.moveTo(60, 60); ctx.lineTo(COVER_W - 60, 60)
  ctx.moveTo(60, COVER_H - 60); ctx.lineTo(COVER_W - 60, COVER_H - 60)
  ctx.stroke()

  if (img) {
    const imgH = Math.round(COVER_H * 0.55)
    const imgW = Math.round(img.naturalWidth * (imgH / img.naturalHeight))
    ctx.globalAlpha = 0.85
    ctx.drawImage(img, (COVER_W - imgW) / 2, 100, imgW, imgH)
    ctx.globalAlpha = 1.0
  }

  ctx.fillStyle = '#FFFFFF'
  ctx.font      = "bold 90px 'Arial', sans-serif"
  ctx.textAlign = 'center'
  const titleY  = img ? COVER_H * 0.63 : COVER_H * 0.35
  drawWrappedText(ctx, config.title, COVER_W / 2, titleY, COVER_W - 100, 100)

  if (config.subtitle) {
    ctx.fillStyle = '#AFA9EC'
    ctx.font      = "44px 'Arial', sans-serif"
    ctx.fillText(config.subtitle, COVER_W / 2, titleY + 210)
  }

  if (config.author) {
    ctx.fillStyle = '#7F77DD'
    ctx.font      = "34px 'Arial', sans-serif"
    ctx.fillText(config.author, COVER_W / 2, COVER_H - 90)
  }
}

function renderArtistic(
  ctx:    CanvasRenderingContext2D,
  config: CoverConfig,
  img:    HTMLImageElement | null,
): void {
  ctx.fillStyle = '#FDF6E3'
  ctx.fillRect(0, 0, COVER_W, COVER_H)

  ctx.strokeStyle = '#C8A96E'
  ctx.lineWidth   = 12
  ctx.strokeRect(30, 30, COVER_W - 60, COVER_H - 60)
  ctx.strokeStyle = '#E8C98A'
  ctx.lineWidth   = 4
  ctx.strokeRect(46, 46, COVER_W - 92, COVER_H - 92)

  if (img) {
    const imgH = Math.round(COVER_H * 0.50)
    const imgW = Math.round(img.naturalWidth * (imgH / img.naturalHeight))
    ctx.drawImage(img, (COVER_W - imgW) / 2, 180, imgW, imgH)
  }

  ctx.fillStyle = '#3D2B0A'
  ctx.font      = "bold 88px 'Georgia', serif"
  ctx.textAlign = 'center'
  const titleY  = img ? COVER_H * 0.65 : COVER_H * 0.35
  drawWrappedText(ctx, config.title, COVER_W / 2, titleY, COVER_W - 140, 98)

  ctx.fillStyle = '#C8A96E'
  ctx.fillRect(COVER_W / 2 - 150, titleY + 196, 300, 3)

  if (config.subtitle) {
    ctx.fillStyle = '#7A5C2A'
    ctx.font      = "italic 42px 'Georgia', serif"
    ctx.fillText(config.subtitle, COVER_W / 2, titleY + 258)
  }

  if (config.author) {
    ctx.fillStyle = '#5A3E10'
    ctx.font      = "38px 'Georgia', serif"
    const byLine  = config.year ? `${config.author}  ·  ${config.year}` : config.author
    ctx.fillText(byLine, COVER_W / 2, COVER_H - 100)
  }
}

// ── Main export function ───────────────────────────────────────────

/**
 * Render cover page, returns pure base64 PNG (no data: prefix).
 */
export async function renderCover(config: CoverConfig): Promise<string> {
  const canvas  = document.createElement('canvas')
  canvas.width  = COVER_W
  canvas.height = COVER_H
  const ctx     = canvas.getContext('2d')
  if (!ctx) throw new Error('Cannot get 2d context')

  const img = config.characterB64
    ? await loadImage(config.characterB64).catch(() => null)
    : null

  switch (config.template) {
    case 'manga':    renderManga(ctx, config, img);    break
    case 'dark':     renderDark(ctx, config, img);     break
    case 'artistic': renderArtistic(ctx, config, img); break
    default:         renderMinimal(ctx, config, img);  break
  }

  return canvas.toDataURL('image/png').split(',')[1]
}
