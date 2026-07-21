/**
 * Composites panel images with SVG bubble overlays into PNG blobs.
 * Uses Canvas API (not html2canvas) for reliable SVG rendering.
 * Mirrors the rendering logic of MangaBubbleSVG in DialogueEditor.tsx.
 */

import JSZip from 'jszip';
import type { SingleBubble, BubbleType, TailDir } from '@/components/studio-steps/DialogueEditor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isNoneText(t: string | null | undefined): boolean {
  const s = (t ?? '').trim();
  return s === '' || s.toUpperCase() === 'NONE';
}

function hasTailSupport(type: BubbleType): boolean {
  return ['speech', 'thought', 'shout', 'whisper', 'double', 'electric',
          'round', 'square', 'scream', 'wobbly'].includes(type);
}

// Mirrors DialogueEditor.tsx wrapTextToLines (char-count estimate, no canvas needed)
function wrapTextToLines(text: string, maxWidth: number, fontSize: number, isBangers: boolean): string[] {
  const avgCharW = isBangers ? fontSize * 0.72 : fontSize * 0.56;
  const maxChars = Math.max(1, Math.floor(maxWidth / avgCharW));
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (test.length > maxChars && cur) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── Shape path helpers (identical to DialogueEditor.tsx) ─────────────────────

function spikyPts(cx: number, cy: number, outerRX: number, outerRY: number, spikes: number, innerRatio = 0.82): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const erx = i % 2 === 0 ? outerRX : outerRX * innerRatio;
    const ery = i % 2 === 0 ? outerRY : outerRY * innerRatio;
    pts.push(`${cx + Math.cos(angle) * erx},${cy + Math.sin(angle) * ery}`);
  }
  return pts.join(' ');
}

function buildCloudPath(w: number, h: number): string {
  return `M ${w*0.18} ${h*0.75} C ${w*0.04} ${h*0.75},${w*0.02} ${h*0.55},${w*0.10} ${h*0.48} C ${w*0.06} ${h*0.28},${w*0.22} ${h*0.18},${w*0.32} ${h*0.26} C ${w*0.33} ${h*0.10},${w*0.47} ${h*0.04},${w*0.50} ${h*0.08} C ${w*0.53} ${h*0.04},${w*0.67} ${h*0.10},${w*0.68} ${h*0.26} C ${w*0.78} ${h*0.18},${w*0.94} ${h*0.28},${w*0.90} ${h*0.48} C ${w*0.98} ${h*0.55},${w*0.96} ${h*0.75},${w*0.82} ${h*0.75} C ${w*0.80} ${h*0.88},${w*0.62} ${h*0.94},${w*0.50} ${h*0.90} C ${w*0.38} ${h*0.94},${w*0.20} ${h*0.88},${w*0.18} ${h*0.75} Z`;
}

function wobblyPath(cx: number, cy: number, rx: number, ry: number): string {
  const wx = rx * 0.14, wy = ry * 0.12;
  return [
    `M ${cx + rx},${cy}`,
    `C ${cx + rx},${cy - ry * 0.55 + wy} ${cx + rx * 0.55 + wx},${cy - ry} ${cx},${cy - ry}`,
    `C ${cx - rx * 0.55 - wx},${cy - ry} ${cx - rx},${cy - ry * 0.55 - wy} ${cx - rx},${cy}`,
    `C ${cx - rx},${cy + ry * 0.55 + wy} ${cx - rx * 0.55 + wx},${cy + ry} ${cx},${cy + ry}`,
    `C ${cx + rx * 0.55 - wx},${cy + ry} ${cx + rx},${cy + ry * 0.55 - wy} ${cx + rx},${cy}`,
    'Z',
  ].join(' ');
}

function heartPath(cx: number, cy: number, rx: number, ry: number): string {
  return [
    `M ${cx},${cy - ry * 0.2}`,
    `C ${cx + rx * 0.5},${cy - ry} ${cx + rx},${cy - ry * 0.5} ${cx + rx},${cy}`,
    `C ${cx + rx},${cy + ry * 0.5} ${cx},${cy + ry * 0.75} ${cx},${cy + ry}`,
    `C ${cx},${cy + ry * 0.75} ${cx - rx},${cy + ry * 0.5} ${cx - rx},${cy}`,
    `C ${cx - rx},${cy - ry * 0.5} ${cx - rx * 0.5},${cy - ry} ${cx},${cy - ry * 0.2}`,
    'Z',
  ].join(' ');
}

// ── SVG text element generator ────────────────────────────────────────────────

function svgTextEl(
  lines: string[], cx: number, cy: number, fontSize: number,
  fontFamily: string, fontWeight: string | number, fill: string,
  stroke?: string, strokeWidth?: number, letterSpacing?: string,
  textAnchor: 'middle' | 'start' = 'middle', lineHeight = 1.3,
  fontStyle = 'normal',
): string {
  const lh = fontSize * lineHeight;
  const startY = cy - (lines.length * lh) / 2 + fontSize * 0.75;
  const tspans = lines.map((line, i) =>
    `<tspan x="${cx}" y="${startY + i * lh}">${esc(line)}</tspan>`
  ).join('');
  const parts = [
    `font-family="${fontFamily}"`,
    `font-size="${fontSize}"`,
    `font-weight="${fontWeight}"`,
    `fill="${fill}"`,
    stroke          ? `stroke="${stroke}"`                 : '',
    strokeWidth     ? `stroke-width="${strokeWidth}"`      : '',
    strokeWidth     ? `stroke-linejoin="round"`            : '',
    strokeWidth     ? `paint-order="stroke fill"`          : '',
    letterSpacing   ? `letter-spacing="${letterSpacing}"`  : '',
    `text-anchor="${textAnchor}"`,
    fontStyle !== 'normal' ? `font-style="${fontStyle}"`   : '',
  ].filter(Boolean).join(' ');
  return `<text ${parts}>${tspans}</text>`;
}

// Top-anchored box text (narration / square)
function svgBoxTextEl(
  lines: string[], cx: number, cy: number, rx: number, ry: number,
  fontSize: number, fontFamily: string, fontStyle: string, fill: string,
): string {
  const x0 = cx - rx + fontSize * 0.5;
  const tspans = lines.map((line, i) =>
    `<tspan x="${x0}" y="${(cy - ry) + fontSize * 1.1 + i * fontSize * 1.35}">${esc(line)}</tspan>`
  ).join('');
  return `<text font-family="${fontFamily}" font-size="${fontSize}" font-style="${fontStyle}" fill="${fill}" text-anchor="start">${tspans}</text>`;
}

// ── Tail point helper ─────────────────────────────────────────────────────────

function tailPtsStr(tailDir: TailDir, cx: number, cy: number, erx: number, ery: number): string {
  if (tailDir === 'none') return '';
  const TAIL = 22, TW = 7;
  switch (tailDir) {
    case 'down-left':  return `${cx-erx*0.25-TW},${cy+ery-2} ${cx-erx*0.6},${cy+ery+TAIL} ${cx-erx*0.25+TW},${cy+ery-2}`;
    case 'down':       return `${cx-TW},${cy+ery-2} ${cx},${cy+ery+TAIL} ${cx+TW},${cy+ery-2}`;
    case 'down-right': return `${cx+erx*0.25-TW},${cy+ery-2} ${cx+erx*0.6},${cy+ery+TAIL} ${cx+erx*0.25+TW},${cy+ery-2}`;
    case 'up-left':    return `${cx-erx*0.25-TW},${cy-ery+2} ${cx-erx*0.6},${cy-ery-TAIL} ${cx-erx*0.25+TW},${cy-ery+2}`;
    case 'up':         return `${cx-TW},${cy-ery+2} ${cx},${cy-ery-TAIL} ${cx+TW},${cy-ery+2}`;
    case 'up-right':   return `${cx+erx*0.25-TW},${cy-ery+2} ${cx+erx*0.6},${cy-ery-TAIL} ${cx+erx*0.25+TW},${cy-ery+2}`;
    case 'left':       return `${cx-erx+2},${cy-TW} ${cx-erx-TAIL},${cy} ${cx-erx+2},${cy+TW}`;
    case 'right':      return `${cx+erx-2},${cy-TW} ${cx+erx+TAIL},${cy} ${cx+erx-2},${cy+TW}`;
    default:           return '';
  }
}

// Thought trail circles
function thoughtTrailCircles(tailDir: TailDir, cx: number, cy: number, rx: number, ry: number): string {
  const TAIL = 22;
  let tx: number, ty: number;
  switch (tailDir) {
    case 'down-left':  tx = cx - rx*0.35; ty = cy + ry + TAIL; break;
    case 'down':       tx = cx;           ty = cy + ry + TAIL; break;
    case 'down-right': tx = cx + rx*0.35; ty = cy + ry + TAIL; break;
    case 'up-left':    tx = cx - rx*0.35; ty = cy - ry - TAIL; break;
    case 'up':         tx = cx;           ty = cy - ry - TAIL; break;
    case 'up-right':   tx = cx + rx*0.35; ty = cy - ry - TAIL; break;
    case 'left':       tx = cx - rx - TAIL; ty = cy; break;
    case 'right':      tx = cx + rx + TAIL; ty = cy; break;
    default:           tx = cx;           ty = cy + ry + TAIL; break;
  }
  const ex = cx + (tx - cx) * 0.62;
  const ey = cy + (ty - cy) * 0.62;
  const circles = [
    { x: ex, y: ey, r: 5.5 },
    { x: ex + (tx-ex)*0.48, y: ey + (ty-ey)*0.48, r: 3.5 },
    { x: tx, y: ty, r: 2 },
  ];
  return circles.map(c =>
    `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="white" stroke="#1a1a1a" stroke-width="1.5"/>`
  ).join('');
}

// ── Per-bubble SVG content (no <svg> wrapper) ─────────────────────────────────

function buildBubbleContent(bubble: SingleBubble, w: number, h: number): string {
  const { bubbleType: type, tailDir, dialogue, fontSize, rotation } = bubble;
  if (type === 'none' || (isNoneText(dialogue) && type !== 'sfx')) return '';

  const text = dialogue ?? '';
  const fill  = bubble.fillColor ?? '#ffffff';
  const stroke = '#1a1a1a';
  const userTextColor = bubble.textColor;
  const cx = w / 2, cy = h / 2;
  const rx = w / 2 - 2, ry = h / 2 - 2;
  const circR = Math.min(rx, ry);

  // ── SFX ──────────────────────────────────────────────────────────────────
  if (type === 'sfx') {
    const sfxSize = Math.max(fontSize, 24);
    const lines = wrapTextToLines(text, w * 0.9, sfxSize, true);
    const rotAttr = rotation ? ` transform="rotate(${rotation}, ${cx}, ${cy})"` : '';
    const textEl = svgTextEl(lines, cx, cy, sfxSize,
      'Bangers, Impact, Arial Black, sans-serif', 'normal', userTextColor ?? 'white', '#1a1a1a', 3, '0.06em');
    return `<g${rotAttr}>${textEl}</g>`;
  }

  // ── Shared per-type properties ────────────────────────────────────────────
  const strokeW   = type === 'shout' || type === 'scream' ? 2.5 : 2;
  const bodyFillDefault = type === 'electric'  ? 'rgba(255,255,200,0.95)'
                        : type === 'narration' ? '#fffef0'
                        : type === 'whisper'   ? 'rgba(255,255,255,0.88)'
                        : type === 'heart'     ? '#FFE0E0'
                        : type === 'burst'     ? '#FFFACD'
                        : type === 'wobbly'    ? 'rgba(240,248,255,0.95)'
                        : type === 'scream'    ? '#FFF0F0'
                        : fill;
  const bodyFill = bubble.fillColor ? fill : bodyFillDefault;
  const bodyStroke = type === 'electric' ? '#DAA520'
                   : type === 'heart'    ? '#FF6B9D'
                   : type === 'wobbly'   ? '#6699CC'
                   : type === 'scream'   ? '#CC0000'
                   : stroke;

  const isBangers  = type === 'shout' || type === 'scream' || type === 'burst';
  const textInset  = type === 'thought' ? 0.25
                   : type === 'narration' || type === 'square' ? 0.06
                   : isBangers ? 0.22 : 0.16;
  const textW      = w * (1 - textInset * 2);
  const lines      = wrapTextToLines(text, textW, fontSize, isBangers);

  const fontFamily = isBangers
    ? 'Bangers, Impact, Arial Black, sans-serif'
    : type === 'square'
    ? 'monospace'
    : "'Comic Neue', 'Comic Sans MS', cursive";
  const fontWeight = type === 'shout' || type === 'scream' ? 700 : 400;
  const _fontStyle = type === 'narration' || type === 'whisper' || type === 'wobbly' ? 'italic' : 'normal';
  const textFill   = userTextColor ?? (type === 'narration' ? '#22224a' : type === 'scream' ? '#660000' : '#111111');
  const textAnchor: 'middle' | 'start' = 'middle';
  const textCX     = cx;
  const textCY     = cy;

  const isRound    = type === 'round';
  const tailErx    = isRound ? circR : rx;
  const tailEry    = isRound ? circR : ry;
  const hasTail    = hasTailSupport(type) && tailDir !== 'none';
  const tailPoly   = hasTail ? `<polygon points="${tailPtsStr(tailDir, cx, cy, tailErx, tailEry)}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>` : '';

  // ── Speech ────────────────────────────────────────────────────────────────
  if (type === 'speech') return [
    tailPoly,
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="${strokeW}"/>`,
    svgTextEl(lines, textCX, textCY, fontSize, fontFamily, fontWeight, textFill, undefined, undefined, undefined, textAnchor),
  ].join('');

  // ── Whisper ───────────────────────────────────────────────────────────────
  if (type === 'whisper') return [
    hasTail ? `<polygon points="${tailPtsStr(tailDir, cx, cy, rx, ry)}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="1.5" stroke-dasharray="6,3" stroke-linejoin="round"/>` : '',
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="1.5" stroke-dasharray="6,3"/>`,
    svgTextEl(lines, cx, cy, fontSize, fontFamily, 400, textFill, undefined, undefined, undefined, 'middle', 1.3, 'italic'),
  ].join('');

  // ── Double ────────────────────────────────────────────────────────────────
  if (type === 'double') return [
    tailPoly,
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bodyFill}" stroke="${stroke}" stroke-width="${strokeW}"/>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(rx-7,4)}" ry="${Math.max(ry-7,4)}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`,
    svgTextEl(lines, cx, cy, fontSize, fontFamily, fontWeight, textFill),
  ].join('');

  // ── Electric ──────────────────────────────────────────────────────────────
  if (type === 'electric') return [
    hasTail ? `<polygon points="${tailPtsStr(tailDir, cx, cy, rx, ry)}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>` : '',
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="${strokeW}" stroke-dasharray="4,2"/>`,
    svgTextEl(lines, cx, cy, fontSize, fontFamily, fontWeight, textFill),
  ].join('');

  // ── Round ─────────────────────────────────────────────────────────────────
  if (type === 'round') return [
    hasTail ? `<polygon points="${tailPtsStr(tailDir, cx, cy, circR, circR)}" fill="${bodyFill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>` : '',
    `<circle cx="${cx}" cy="${cy}" r="${circR}" fill="${bodyFill}" stroke="${stroke}" stroke-width="${strokeW}"/>`,
    svgTextEl(lines, cx, cy, fontSize, fontFamily, fontWeight, textFill),
  ].join('');

  // ── Square ────────────────────────────────────────────────────────────────
  if (type === 'square') return [
    hasTail ? `<polygon points="${tailPtsStr(tailDir, cx, cy, rx, ry)}" fill="${bodyFill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>` : '',
    `<rect x="${cx-rx}" y="${cy-ry}" width="${rx*2}" height="${ry*2}" fill="${bodyFill}" stroke="${stroke}" stroke-width="${strokeW}" rx="2"/>`,
    svgBoxTextEl(lines, cx, cy, rx, ry, fontSize, fontFamily, 'normal', textFill),
  ].join('');

  // ── Shout ─────────────────────────────────────────────────────────────────
  if (type === 'shout') return [
    hasTail ? `<polygon points="${tailPtsStr(tailDir, cx, cy, rx, ry)}" fill="${bodyFill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>` : '',
    `<polygon points="${spikyPts(cx, cy, rx, ry, 8)}" fill="${bodyFill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="miter"/>`,
    svgTextEl(lines, cx, cy, fontSize, fontFamily, 700, textFill),
  ].join('');

  // ── Scream ────────────────────────────────────────────────────────────────
  if (type === 'scream') return [
    hasTail ? `<polygon points="${tailPtsStr(tailDir, cx, cy, rx, ry)}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>` : '',
    `<polygon points="${spikyPts(cx, cy, rx, ry, 14, 0.78)}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="${strokeW}" stroke-linejoin="miter"/>`,
    svgTextEl(lines, cx, cy, fontSize, fontFamily, 700, textFill),
  ].join('');

  // ── Thought — arc-based cloud path ───────────────────────────────────────
  if (type === 'thought') {
    const minDim = Math.min(w, h);
    const sw = Math.max(1.5, minDim * 0.022);
    const dotR1 = Math.max(3.5, minDim * 0.048);
    const dotR2 = Math.max(2.5, minDim * 0.034);
    const dotR3 = Math.max(1.5, minDim * 0.021);
    const _trail = tailDir !== 'none' ? thoughtTrailCircles(tailDir, cx, cy, rx, ry) : '';
    const pathStr = `<path d="${buildCloudPath(w, h)}" fill="${fill}" stroke="#1a1a1a" stroke-width="${sw}" stroke-linejoin="round"/>`;
    // Tail dots sized per thoughtTrailCircles (r values already set); supplement dotR scaling for the 3 dots
    const trailDots = tailDir !== 'none' ? (() => {
      const _pts = thoughtTrailCircles(tailDir, cx, cy, rx, ry);
      // thoughtTrailCircles returns an SVG string — rebuild with scaled radii
      const { x: tx, y: ty } = (() => {
        const map: Record<string, { x: number; y: number }> = {
          'down-left':  { x: cx - rx*0.35, y: cy + ry + 22 },
          'down':       { x: cx,            y: cy + ry + 22 },
          'down-right': { x: cx + rx*0.35,  y: cy + ry + 22 },
          'up-left':    { x: cx - rx*0.35,  y: cy - ry - 22 },
          'up':         { x: cx,             y: cy - ry - 22 },
          'up-right':   { x: cx + rx*0.35,  y: cy - ry - 22 },
          'left':       { x: cx - rx - 22,   y: cy },
          'right':      { x: cx + rx + 22,   y: cy },
        };
        return map[tailDir] ?? { x: cx, y: cy + ry + 22 };
      })();
      const eX = cx + (tx - cx) * 0.62, eY = cy + (ty - cy) * 0.62;
      const m = (a: number, b: number) => a + (b - a) * 0.48;
      return [
        `<circle cx="${eX}" cy="${eY}" r="${dotR1}" fill="${fill}" stroke="#1a1a1a" stroke-width="${Math.max(0.8, sw * 0.8)}"/>`,
        `<circle cx="${m(eX,tx)}" cy="${m(eY,ty)}" r="${dotR2}" fill="${fill}" stroke="#1a1a1a" stroke-width="${Math.max(0.8, sw * 0.7)}"/>`,
        `<circle cx="${tx}" cy="${ty}" r="${dotR3}" fill="${fill}" stroke="#1a1a1a" stroke-width="${Math.max(0.8, sw * 0.6)}"/>`,
      ].join('');
    })() : '';
    return [pathStr, trailDots, svgTextEl(lines, cx, cy, fontSize, fontFamily, fontWeight, textFill)].join('');
  }

  // ── Narration ─────────────────────────────────────────────────────────────
  if (type === 'narration') return [
    `<rect x="${cx-rx}" y="${cy-ry}" width="${rx*2}" height="${ry*2}" fill="${bodyFill}" stroke="${stroke}" stroke-width="2"/>`,
    svgBoxTextEl(lines, cx, cy, rx, ry, fontSize, fontFamily, 'italic', userTextColor ?? '#22224a'),
  ].join('');

  // ── Heart ─────────────────────────────────────────────────────────────────
  if (type === 'heart') return [
    `<path d="${heartPath(cx, cy, rx, ry)}" fill="${fill === '#ffffff' ? '#FFE0E0' : fill}" stroke="#FF6B9D" stroke-width="2" stroke-linejoin="round"/>`,
    svgTextEl(lines, cx, cy + ry * 0.15, fontSize, fontFamily, fontWeight, userTextColor ?? '#880033'),
  ].join('');

  // ── Burst ─────────────────────────────────────────────────────────────────
  if (type === 'burst') return [
    `<polygon points="${spikyPts(cx, cy, rx, ry, 10, 0.65)}" fill="${fill === '#ffffff' ? '#FFFACD' : fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="miter"/>`,
    svgTextEl(lines, cx, cy, fontSize, fontFamily, 700, textFill),
  ].join('');

  // ── Wobbly ────────────────────────────────────────────────────────────────
  if (type === 'wobbly') return [
    hasTail ? `<polygon points="${tailPtsStr(tailDir, cx, cy, rx, ry)}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="2" stroke-linejoin="round"/>` : '',
    `<path d="${wobblyPath(cx, cy, rx, ry)}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="2"/>`,
    svgTextEl(lines, cx, cy, fontSize, fontFamily, fontWeight, userTextColor ?? '#334466', undefined, undefined, undefined, 'middle', 1.3, 'italic'),
  ].join('');

  return '';
}

// ── Full overlay SVG for a panel ──────────────────────────────────────────────

function buildOverlaySvg(bubbles: SingleBubble[], W: number, H: number): string {
  const sorted = [...bubbles].sort((a, b) => a.zIndex - b.zIndex);
  const elements = sorted
    .filter(b => b.bubbleType !== 'none' && !isNoneText(b.dialogue))
    .map(b => {
      const bw = b.bubbleSize.w;
      const bh = b.bubbleSize.h;
      const x = b.bubblePosition.x * W - bw / 2;
      const y = b.bubblePosition.y * H - bh / 2;
      const inner = buildBubbleContent(b, bw, bh);
      if (!inner) return '';
      const opacityAttr = (b.opacity ?? 1) < 1 ? ` opacity="${b.opacity ?? 1}"` : '';
      return `<svg x="${x}" y="${y}" width="${bw}" height="${bh}" overflow="visible"${opacityAttr}>${inner}</svg>`;
    })
    .filter(Boolean);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" overflow="visible">${elements.join('')}</svg>`;
}

// ── Canvas compositing ────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image`));
    img.src = src;
  });
}

// Same crop math the browser applies for object-fit:cover — center-crops the
// source to match targetRatio exactly, so panel images get cropped identically
// here and in the live editor (which displays panels with object-fit:cover).
function computeCoverCrop(srcW: number, srcH: number, targetRatio: number): { sx: number; sy: number; sw: number; sh: number } {
  const srcRatio = srcW / srcH;
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  if (srcRatio > targetRatio) {
    sw = srcH * targetRatio;
    sx = (srcW - sw) / 2;
  } else if (srcRatio < targetRatio) {
    sh = srcW / targetRatio;
    sy = (srcH - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

export async function compositePanelToBlob(
  imageUrl: string,
  bubbles: SingleBubble[],
  targetAspectRatio?: number,
): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const naturalW = img.naturalWidth || 512;
  const naturalH = img.naturalHeight || 512;
  const crop = targetAspectRatio
    ? computeCoverCrop(naturalW, naturalH, targetAspectRatio)
    : { sx: 0, sy: 0, sw: naturalW, sh: naturalH };
  const W = crop.sw;
  const H = crop.sh;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Draw the cropped region of the panel image — matches the editor's
  // object-fit:cover view, so bubble positions (recorded against that
  // cropped view) land in the same place here.
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, W, H);

  // Draw bubble overlay
  const active = bubbles.filter(b => b.bubbleType !== 'none' && !isNoneText(b.dialogue));
  if (active.length > 0) {
    const svgStr = buildOverlaySvg(active, W, H);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const svgImg = await loadImage(url);
      ctx.drawImage(svgImg, 0, 0, W, H);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    );
  });
}

// ── Public export API ─────────────────────────────────────────────────────────

export interface CompositePanel {
  label: string;       // filename without extension
  imageUrl: string;
  bubbles: SingleBubble[];
  aspectRatio?: number; // panel box width:height ratio, for object-fit:cover-accurate cropping
}

export async function exportWithDialogueAsZip(
  panels: CompositePanel[],
  projectId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const zip = new JSZip();

  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    const blob = await compositePanelToBlob(panel.imageUrl, panel.bubbles, panel.aspectRatio);
    zip.file(`${panel.label}.png`, blob);
    onProgress?.(i + 1, panels.length);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comic-${projectId}-with-dialogue.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
