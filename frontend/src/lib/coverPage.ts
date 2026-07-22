export type CoverTemplate = 'minimal' | 'manga' | 'dark' | 'artistic'
export type CoverBgKind  = CoverTemplate | 'blank'

export const COVER_W = 1200
export const COVER_H = 1600

// ── Layer model ────────────────────────────────────────────────────
// A cover is a background + freely positioned layers (text / image).
// All layer coords are in canvas space (0..COVER_W, 0..COVER_H) with the
// origin at each layer's top-left. Text is drawn with baseline 'top'.

export type FontFamily = 'sans' | 'serif'
export type TextAlign  = 'left' | 'center' | 'right'

interface LayerBase {
  id: string
  z:  number
}

export interface TextLayer extends LayerBase {
  type:     'text'
  text:     string
  x:        number
  y:        number
  width:    number   // wrap box width
  fontSize: number
  color:    string
  font:     FontFamily
  bold:     boolean
  italic:   boolean
  align:    TextAlign
}

export interface ImageLayer extends LayerBase {
  type:   'image'
  src:    string     // base64 (no prefix), data:, blob: or http url
  x:      number
  y:      number
  width:  number
  height: number
}

export type Layer = TextLayer | ImageLayer

export interface CoverBackground {
  kind:  CoverBgKind
  color: string      // used when kind === 'blank'
}

export interface CoverDoc {
  background: CoverBackground
  layers:     Layer[]
}

export interface LayerBox { x: number; y: number; w: number; h: number }

// Legacy config kept for callers that still describe a cover declaratively.
export interface CoverConfig {
  template:     CoverTemplate
  title:        string
  subtitle:     string
  author:       string
  year:         string
  characterB64: string | null
}

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

let idSeq = 0
export function newLayerId(prefix = 'l'): string {
  idSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${idSeq}`
}

export function fontString(l: TextLayer): string {
  const family = l.font === 'serif' ? "'Georgia', serif" : "'Arial', sans-serif"
  return `${l.italic ? 'italic ' : ''}${l.bold ? 'bold ' : ''}${l.fontSize}px ${family}`
}

export function lineHeightOf(l: TextLayer): number {
  return Math.round(l.fontSize * 1.18)
}

/** Wrap `text` into lines that fit `maxWidth` under the current ctx.font. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') { out.push(''); continue }
    const words = paragraph.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) out.push(line)
  }
  return out
}

/** Height (canvas px) a text layer occupies once wrapped. */
export function measureTextHeight(ctx: CanvasRenderingContext2D, l: TextLayer): number {
  ctx.font = fontString(l)
  const lines = wrapLines(ctx, l.text || ' ', l.width)
  return Math.max(1, lines.length) * lineHeightOf(l)
}

// ── Background renderers (decorative chrome only, no text/image) ────

function renderBackground(ctx: CanvasRenderingContext2D, bg: CoverBackground): void {
  switch (bg.kind) {
    case 'blank': {
      ctx.fillStyle = bg.color || '#FFFFFF'
      ctx.fillRect(0, 0, COVER_W, COVER_H)
      break
    }
    case 'manga': {
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
      break
    }
    case 'dark': {
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
      break
    }
    case 'artistic': {
      ctx.fillStyle = '#FDF6E3'
      ctx.fillRect(0, 0, COVER_W, COVER_H)
      ctx.strokeStyle = '#C8A96E'
      ctx.lineWidth   = 12
      ctx.strokeRect(30, 30, COVER_W - 60, COVER_H - 60)
      ctx.strokeStyle = '#E8C98A'
      ctx.lineWidth   = 4
      ctx.strokeRect(46, 46, COVER_W - 92, COVER_H - 92)
      break
    }
    case 'minimal':
    default: {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, COVER_W, COVER_H)
      ctx.fillStyle = '#111111'
      ctx.fillRect(60, 80, COVER_W - 120, 4)
      ctx.fillRect(60, COVER_H - 84, COVER_W - 120, 4)
      break
    }
  }
}

// ── Layer renderers ────────────────────────────────────────────────

function drawTextLayer(ctx: CanvasRenderingContext2D, l: TextLayer): LayerBox {
  ctx.font         = fontString(l)
  ctx.fillStyle    = l.color
  ctx.textBaseline = 'top'
  ctx.textAlign    = l.align
  const lh    = lineHeightOf(l)
  const lines = wrapLines(ctx, l.text || ' ', l.width)
  const tx =
    l.align === 'center' ? l.x + l.width / 2 :
    l.align === 'right'  ? l.x + l.width     :
    l.x
  lines.forEach((line, i) => {
    if (line) ctx.fillText(line, tx, l.y + i * lh)
  })
  return { x: l.x, y: l.y, w: l.width, h: Math.max(1, lines.length) * lh }
}

function drawImageLayer(ctx: CanvasRenderingContext2D, l: ImageLayer, img: HTMLImageElement | null): LayerBox {
  if (img) ctx.drawImage(img, l.x, l.y, l.width, l.height)
  return { x: l.x, y: l.y, w: l.width, h: l.height }
}

/**
 * Render the whole document. Returns the on-canvas bounding box of each layer
 * (keyed by id) so callers can position selection/resize chrome over it.
 */
export function renderCoverDoc(
  ctx:     CanvasRenderingContext2D,
  doc:     CoverDoc,
  imgMap:  Record<string, HTMLImageElement | null>,
): Record<string, LayerBox> {
  renderBackground(ctx, doc.background)
  const boxes: Record<string, LayerBox> = {}
  const ordered = [...doc.layers].sort((a, b) => a.z - b.z)
  for (const layer of ordered) {
    boxes[layer.id] = layer.type === 'text'
      ? drawTextLayer(ctx, layer)
      : drawImageLayer(ctx, layer, imgMap[layer.id] ?? null)
  }
  return boxes
}

// ── Default document (seeds free-form layers that look like a template) ─

interface DefaultFields {
  title:        string
  subtitle?:    string
  author?:      string
  year?:        string
  characterB64?: string | null
}

interface TemplateStyle {
  font:       FontFamily
  titleColor: string
  subColor:   string
  byColor:    string
}

const TEMPLATE_STYLE: Record<CoverBgKind, TemplateStyle> = {
  minimal:  { font: 'sans',  titleColor: '#111111', subColor: '#555555', byColor: '#888888' },
  manga:    { font: 'sans',  titleColor: '#FFFFFF', subColor: '#DDDDDD', byColor: '#AAAAAA' },
  dark:     { font: 'sans',  titleColor: '#FFFFFF', subColor: '#AFA9EC', byColor: '#7F77DD' },
  artistic: { font: 'serif', titleColor: '#3D2B0A', subColor: '#7A5C2A', byColor: '#5A3E10' },
  blank:    { font: 'sans',  titleColor: '#111111', subColor: '#555555', byColor: '#888888' },
}

/**
 * Build a starter document for a background kind, seeding a character image
 * (if given) plus title / subtitle / byline text layers positioned like the
 * old fixed templates. Everything is then freely movable.
 */
export async function createDefaultDoc(kind: CoverBgKind, fields: DefaultFields): Promise<CoverDoc> {
  const style   = TEMPLATE_STYLE[kind] ?? TEMPLATE_STYLE.minimal
  const layers: Layer[] = []
  let z = 0
  let hasImage = false

  if (fields.characterB64) {
    const img = await loadImage(fields.characterB64).catch(() => null)
    if (img) {
      const h = Math.round(COVER_H * 0.5)
      const w = Math.round(img.naturalWidth * (h / img.naturalHeight))
      layers.push({
        id: newLayerId('img'), type: 'image', z: z++,
        src: fields.characterB64,
        x: Math.round((COVER_W - w) / 2), y: 120, width: w, height: h,
      })
      hasImage = true
    }
  }

  const boxX     = 80
  const boxW     = COVER_W - 160
  const titleY   = hasImage ? Math.round(COVER_H * 0.60) : Math.round(COVER_H * 0.34)

  layers.push({
    id: newLayerId('title'), type: 'text', z: z++,
    text: (fields.title || 'Title').toUpperCase(),
    x: boxX, y: titleY, width: boxW,
    fontSize: style.font === 'serif' ? 90 : 96,
    color: style.titleColor, font: style.font, bold: true, italic: false, align: 'center',
  })

  if (fields.subtitle) {
    layers.push({
      id: newLayerId('sub'), type: 'text', z: z++,
      text: fields.subtitle, x: boxX, y: titleY + 170, width: boxW,
      fontSize: 46, color: style.subColor, font: style.font,
      bold: false, italic: style.font === 'serif', align: 'center',
    })
  }

  const byline = [fields.author, fields.year].filter(Boolean).join('  ·  ')
  if (byline) {
    layers.push({
      id: newLayerId('by'), type: 'text', z: z++,
      text: byline, x: boxX, y: COVER_H - 160, width: boxW,
      fontSize: 36, color: style.byColor, font: style.font,
      bold: false, italic: false, align: 'center',
    })
  }

  return { background: { kind, color: '#FFFFFF' }, layers }
}

// ── Export ─────────────────────────────────────────────────────────

/** Render a document to a base64 PNG (no data: prefix). */
export async function renderDocToB64(doc: CoverDoc): Promise<string> {
  const canvas  = document.createElement('canvas')
  canvas.width  = COVER_W
  canvas.height = COVER_H
  const ctx     = canvas.getContext('2d')
  if (!ctx) throw new Error('Cannot get 2d context')

  const imgMap: Record<string, HTMLImageElement | null> = {}
  await Promise.all(
    doc.layers
      .filter((l): l is ImageLayer => l.type === 'image')
      .map(async l => { imgMap[l.id] = await loadImage(l.src).catch(() => null) }),
  )

  renderCoverDoc(ctx, doc, imgMap)
  return canvas.toDataURL('image/png').split(',')[1]
}
