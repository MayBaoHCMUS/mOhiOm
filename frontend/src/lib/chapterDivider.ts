export type DividerStyle = 'light' | 'dark' | 'manga' | 'minimal'

export interface ChapterDividerConfig {
  style:        DividerStyle
  chapterLabel: string
  title:        string
  tagline:      string
}

export const DIVIDER_W = 1200
export const DIVIDER_H = 1600

export const DEFAULT_DIVIDER_CONFIG: ChapterDividerConfig = {
  style:        'light',
  chapterLabel: 'Chapter 1',
  title:        '',
  tagline:      '',
}

// ── Helpers ────────────────────────────────────────────────────────

function drawCenteredText(
  ctx:        CanvasRenderingContext2D,
  text:       string,
  y:          number,
  font:       string,
  color:      string,
  maxWidth:   number,
  lineHeight: number,
): number {
  if (!text.trim()) return y
  ctx.font      = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  const words = text.split(' ')
  let line     = ''
  let currentY = y

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, DIVIDER_W / 2, currentY)
      currentY += lineHeight
      line = word
    } else {
      line = test
    }
  }
  if (line) {
    ctx.fillText(line, DIVIDER_W / 2, currentY)
    currentY += lineHeight
  }
  return currentY
}

// ── Style renderers ────────────────────────────────────────────────

function renderLight(ctx: CanvasRenderingContext2D, config: ChapterDividerConfig): void {
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, DIVIDER_W, DIVIDER_H)

  const centerY = DIVIDER_H * 0.38
  let y = centerY

  if (config.chapterLabel) {
    y = drawCenteredText(
      ctx, config.chapterLabel.toUpperCase(), y,
      '400 36px Arial, sans-serif', '#888780',
      DIVIDER_W - 240, 46,
    ) + 24
  }

  ctx.fillStyle = '#D3D1C7'
  ctx.fillRect(DIVIDER_W / 2 - 120, y, 240, 1)
  y += 28

  y = drawCenteredText(
    ctx, config.title, y,
    '500 88px Arial, sans-serif', '#111111',
    DIVIDER_W - 160, 100,
  )

  if (config.tagline) {
    y += 28
    drawCenteredText(
      ctx, config.tagline, y,
      '400 38px Arial, sans-serif', '#888780',
      DIVIDER_W - 280, 50,
    )
  }

  ctx.fillStyle = '#D3D1C7'
  ctx.fillRect(60, DIVIDER_H - 80, DIVIDER_W - 120, 1)
}

function renderDark(ctx: CanvasRenderingContext2D, config: ChapterDividerConfig): void {
  ctx.fillStyle = '#0A0A0A'
  ctx.fillRect(0, 0, DIVIDER_W, DIVIDER_H)

  const centerY = DIVIDER_H * 0.38
  let y = centerY

  if (config.chapterLabel) {
    y = drawCenteredText(
      ctx, config.chapterLabel.toUpperCase(), y,
      '400 36px Arial, sans-serif', '#5F5E5A',
      DIVIDER_W - 240, 46,
    ) + 20
  }

  ctx.fillStyle = '#534AB7'
  ctx.fillRect(DIVIDER_W / 2 - 80, y, 160, 2)
  y += 32

  y = drawCenteredText(
    ctx, config.title, y,
    '500 88px Arial, sans-serif', '#FFFFFF',
    DIVIDER_W - 160, 100,
  )

  if (config.tagline) {
    y += 28
    drawCenteredText(
      ctx, config.tagline, y,
      '400 38px Arial, sans-serif', '#5F5E5A',
      DIVIDER_W - 280, 50,
    )
  }
}

function renderManga(ctx: CanvasRenderingContext2D, config: ChapterDividerConfig): void {
  ctx.fillStyle = '#0A0A0A'
  ctx.fillRect(0, 0, DIVIDER_W, DIVIDER_H)

  const cx = DIVIDER_W / 2
  const cy = DIVIDER_H * 0.42
  ctx.strokeStyle = '#1A1A1A'
  ctx.lineWidth   = 1
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * 60, cy + Math.sin(angle) * 60)
    ctx.lineTo(cx + Math.cos(angle) * 1000, cy + Math.sin(angle) * 1300)
    ctx.stroke()
  }

  const boxH = 200
  const boxY = cy - boxH / 2 - 40
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, boxY, DIVIDER_W, boxH)

  drawCenteredText(
    ctx, config.title.toUpperCase(), boxY + 36,
    '500 88px Arial, sans-serif', '#0A0A0A',
    DIVIDER_W - 80, 100,
  )

  if (config.chapterLabel) {
    drawCenteredText(
      ctx, config.chapterLabel.toUpperCase(), boxY - 60,
      '400 34px Arial, sans-serif', '#FFFFFF',
      DIVIDER_W - 240, 44,
    )
  }

  if (config.tagline) {
    drawCenteredText(
      ctx, config.tagline, boxY + boxH + 30,
      '400 36px Arial, sans-serif', '#888780',
      DIVIDER_W - 280, 48,
    )
  }
}

function renderMinimal(ctx: CanvasRenderingContext2D, config: ChapterDividerConfig): void {
  ctx.fillStyle = '#F8F7F2'
  ctx.fillRect(0, 0, DIVIDER_W, DIVIDER_H)

  const centerY = DIVIDER_H * 0.42
  let y = centerY

  if (config.chapterLabel) {
    y = drawCenteredText(
      ctx, config.chapterLabel, y,
      '400 32px Arial, sans-serif', '#B4B2A9',
      DIVIDER_W - 320, 42,
    ) + 32
  }

  y = drawCenteredText(
    ctx, config.title, y,
    '500 72px Arial, sans-serif', '#2C2C2A',
    DIVIDER_W - 200, 86,
  )

  if (config.tagline) {
    y += 24
    drawCenteredText(
      ctx, config.tagline, y,
      '400 34px Arial, sans-serif', '#B4B2A9',
      DIVIDER_W - 320, 46,
    )
  }
}

// ── Main export ────────────────────────────────────────────────────

export async function renderChapterDivider(config: ChapterDividerConfig): Promise<string> {
  const canvas  = document.createElement('canvas')
  canvas.width  = DIVIDER_W
  canvas.height = DIVIDER_H
  const ctx     = canvas.getContext('2d')
  if (!ctx) throw new Error('Cannot get 2d context')

  switch (config.style) {
    case 'dark':    renderDark(ctx, config);    break
    case 'manga':   renderManga(ctx, config);   break
    case 'minimal': renderMinimal(ctx, config); break
    default:        renderLight(ctx, config);   break
  }

  return canvas.toDataURL('image/png').split(',')[1]
}
