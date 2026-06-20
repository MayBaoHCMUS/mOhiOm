'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Step4Panel, Step4PanelState } from '@/context/ComicGenerationContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BubbleType =
  | 'speech' | 'thought' | 'shout' | 'sfx' | 'narration' | 'none'
  | 'whisper' | 'double' | 'electric' | 'round' | 'square'
  | 'scream' | 'heart' | 'burst' | 'wobbly';
export type TailDir =
  | 'up-left' | 'up' | 'up-right'
  | 'left'             | 'right'
  | 'down-left' | 'down' | 'down-right'
  | 'none';
export interface BubblePosition { x: number; y: number }
export interface BubbleSize { w: number; h: number }

export interface SingleBubble {
  id: string;
  dialogue: string | null;
  bubbleType: BubbleType;
  tailDir: TailDir;
  bubblePosition: BubblePosition;
  bubbleSize: BubbleSize;
  fontSize: number;
  rotation: number;  // degrees, used by SFX; 0 for all other types
  opacity: number;   // 0–1; 1 = fully opaque
  fillColor?: string; // bubble background; defaults to white
  textColor?: string; // text color; defaults to #111111
  character?: string;
  zIndex: number;
  crossPanel?: boolean; // when true: hidden in panel, rendered on the page overlay
}
export type PanelBubbles = SingleBubble[];

// Legacy type kept for backward-compat with export.ts
export interface DialoguePanelData {
  dialogue: string | null;
  bubbleType: BubbleType;
  tailDir: TailDir;
  bubblePosition: BubblePosition;
  bubbleSize: BubbleSize;
  fontSize: number;
}

interface DialogueEditorProps {
  panelsByPage: [number, Step4Panel[]][];
  panelStates: Record<string, Step4PanelState>;
  panelBubbles: Record<string, PanelBubbles>;
  pageLayoutNames: Record<number, string>;
  onSaveBubbles: (panelId: string, bubbles: PanelBubbles) => void;
  onExport: () => void;
  onAutoImport: () => void;
}

// ── Layout constants (mirrors Step4Generation) ────────────────────────────────

const LAYOUT_ROW_STRUCTURES: Record<string, number[][]> = {
  splash: [[0]], stacked: [[0],[1]], side_by_side: [[0,1]],
  three_rows: [[0],[1],[2]], top_wide: [[0],[1,2]], bottom_wide: [[0,1],[2]],
  grid_2x2: [[0,1],[2,3]], top_wide_3: [[0],[1,2,3]], bottom_wide_3: [[0,1,2],[3]],
  four_rows: [[0],[1],[2],[3]], wide_2x2: [[0],[1,2],[3,4]], '2x2_wide': [[0,1],[2,3],[4]],
  grid_3x2: [[0,1,2],[3,4,5]], grid_2x3: [[0,1],[2,3],[4,5]],
};

const BASE_PAGE_W = 600;
const BASE_PAGE_H = BASE_PAGE_W * (297 / 210); // A4 portrait ratio
const ZOOM_PRESETS = [0.5, 0.75, 1.0];
const MIN_BUBBLE_W = 60;
const MIN_BUBBLE_H = 40;

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId(): string {
  if (typeof window !== 'undefined' && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function isNoneText(text: string | null | undefined): boolean {
  if (!text) return true;
  const t = text.trim();
  return t === '' || t.toUpperCase() === 'NONE';
}

function hasTailSupport(type: BubbleType): boolean {
  return ['speech', 'thought', 'shout', 'whisper', 'double', 'electric',
          'round', 'square', 'scream', 'wobbly'].includes(type);
}

function tailDirForType(type: BubbleType, current: TailDir): TailDir {
  if (!hasTailSupport(type)) return 'none';
  return current === 'none' ? 'down-left' : current;
}

function buildGridStyle(rows: number[][]): React.CSSProperties {
  const maxCols = Math.max(...rows.map(r => r.length));
  return {
    display: 'grid',
    gridTemplateRows: rows.map(() => '1fr').join(' '),
    gridTemplateColumns: `repeat(${maxCols}, 1fr)`,
    gap: 6,
    padding: 8,
    background: 'white',
    boxShadow: '0 4px 32px rgba(0,0,0,0.22)',
    width: BASE_PAGE_W,
    height: BASE_PAGE_H,
    flexShrink: 0,
  };
}

function getPanelGridPlacement(rows: number[][], panelIndex: number): React.CSSProperties {
  for (let r = 0; r < rows.length; r++) {
    const col = rows[r].indexOf(panelIndex);
    if (col === -1) continue;
    const maxCols = Math.max(...rows.map(x => x.length));
    const colSpan = maxCols / rows[r].length;
    return {
      gridRow: r + 1,
      gridColumn: `${col * colSpan + 1} / span ${colSpan}`,
    };
  }
  return {};
}

function computeFitZoom(viewportW: number, viewportH: number, pad = 48): number {
  const scaleW = (viewportW - pad * 2) / BASE_PAGE_W;
  const scaleH = (viewportH - pad * 2) / BASE_PAGE_H;
  return Math.min(scaleW, scaleH, 1.0);
}

// tail tip offset from bubble center in panel-local pixels
function tailTipOffset(dir: TailDir, w: number, h: number): { dx: number; dy: number } {
  const TAIL = 20;
  switch (dir) {
    case 'up-left':    return { dx: -w * 0.3, dy: -h / 2 - TAIL };
    case 'up':         return { dx: 0,         dy: -h / 2 - TAIL };
    case 'up-right':   return { dx:  w * 0.3,  dy: -h / 2 - TAIL };
    case 'left':       return { dx: -w / 2 - TAIL, dy: 0 };
    case 'right':      return { dx:  w / 2 + TAIL, dy: 0 };
    case 'down-left':  return { dx: -w * 0.3, dy:  h / 2 + TAIL };
    case 'down':       return { dx: 0,         dy:  h / 2 + TAIL };
    case 'down-right': return { dx:  w * 0.3,  dy:  h / 2 + TAIL };
    default:           return { dx: 0,         dy:  h / 2 + TAIL };
  }
}

// Per-type font size defaults and slider bounds
const BUBBLE_TYPE_DEFAULTS: Record<BubbleType, { fontSize: number; minFont: number; maxFont: number }> = {
  speech:    { fontSize: 13, minFont: 8,  maxFont: 20 },
  thought:   { fontSize: 12, minFont: 8,  maxFont: 20 },
  shout:     { fontSize: 18, minFont: 16, maxFont: 48 },
  sfx:       { fontSize: 24, minFont: 16, maxFont: 48 },
  narration: { fontSize: 11, minFont: 8,  maxFont: 20 },
  none:      { fontSize: 14, minFont: 8,  maxFont: 20 },
  whisper:   { fontSize: 11, minFont: 8,  maxFont: 18 },
  double:    { fontSize: 13, minFont: 8,  maxFont: 20 },
  electric:  { fontSize: 13, minFont: 8,  maxFont: 22 },
  round:     { fontSize: 12, minFont: 8,  maxFont: 20 },
  square:    { fontSize: 12, minFont: 8,  maxFont: 18 },
  scream:    { fontSize: 20, minFont: 16, maxFont: 48 },
  heart:     { fontSize: 12, minFont: 8,  maxFont: 18 },
  burst:     { fontSize: 14, minFont: 10, maxFont: 32 },
  wobbly:    { fontSize: 12, minFont: 8,  maxFont: 20 },
};

// Starburst/spike polygon — shared by shout, scream, burst
function spikyPts(cx: number, cy: number, outerRX: number, outerRY: number, spikes: number, innerRatio = 0.82): string {
  const innerRX = outerRX * innerRatio;
  const innerRY = outerRY * innerRatio;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const erx = i % 2 === 0 ? outerRX : innerRX;
    const ery = i % 2 === 0 ? outerRY : innerRY;
    pts.push(`${cx + Math.cos(angle) * erx},${cy + Math.sin(angle) * ery}`);
  }
  return pts.join(' ');
}

// Wobbly blob path — 4 cubic beziers with offset control points
function wobblyPath(cx: number, cy: number, rx: number, ry: number): string {
  const wx = rx * 0.14;
  const wy = ry * 0.12;
  return [
    `M ${cx + rx},${cy}`,
    `C ${cx + rx},${cy - ry * 0.55 + wy} ${cx + rx * 0.55 + wx},${cy - ry} ${cx},${cy - ry}`,
    `C ${cx - rx * 0.55 - wx},${cy - ry} ${cx - rx},${cy - ry * 0.55 - wy} ${cx - rx},${cy}`,
    `C ${cx - rx},${cy + ry * 0.55 + wy} ${cx - rx * 0.55 + wx},${cy + ry} ${cx},${cy + ry}`,
    `C ${cx + rx * 0.55 - wx},${cy + ry} ${cx + rx},${cy + ry * 0.55 - wy} ${cx + rx},${cy}`,
    'Z',
  ].join(' ');
}

// Heart SVG path centered at (cx,cy) within rx × ry bounds
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

// Simple word-wrap: splits text into lines that fit within maxWidth
function wrapTextToLines(text: string, maxWidth: number, fontSize: number, isBangers: boolean): string[] {
  const avgCharW = isBangers ? fontSize * 0.72 : fontSize * 0.56;
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / avgCharW));
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function dirFromVector(dx: number, dy: number): TailDir {
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle < -157.5 || angle >= 157.5) return 'left';
  if (angle < -112.5) return 'up-left';
  if (angle < -67.5)  return 'up';
  if (angle < -22.5)  return 'up-right';
  if (angle <  22.5)  return 'right';
  if (angle <  67.5)  return 'down-right';
  if (angle < 112.5)  return 'down';
  return 'down-left';
}

// ── Manga SVG Bubble Renderer ─────────────────────────────────────────────────

interface BubbleSVGProps {
  bubble: SingleBubble;
  w: number;
  h: number;
  dimmed?: boolean;
}

// SVG <text> with manual word-wrap via <tspan>
function SvgText({ lines, cx, cy, fontSize, fontFamily, fontWeight, fill, stroke, strokeWidth, letterSpacing, textAnchor = 'middle', lineHeight = 1.3 }: {
  lines: string[]; cx: number; cy: number; fontSize: number;
  fontFamily: string; fontWeight: string | number; fill: string;
  stroke?: string; strokeWidth?: number; letterSpacing?: string;
  textAnchor?: 'middle' | 'start'; lineHeight?: number;
}) {
  const lh = fontSize * lineHeight;
  const totalH = lines.length * lh;
  const startY = cy - totalH / 2 + fontSize * 0.75; // baseline of first line

  return (
    <text
      fontFamily={fontFamily}
      fontSize={fontSize}
      fontWeight={fontWeight}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      paintOrder={stroke ? 'stroke fill' : undefined}
      strokeLinejoin={stroke ? 'round' : undefined}
      letterSpacing={letterSpacing}
      textAnchor={textAnchor}
      style={{ userSelect: 'none' }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={cx} y={startY + i * lh}>{line}</tspan>
      ))}
    </text>
  );
}

function buildCloudPath(w: number, h: number): string {
  return `M ${w*0.18} ${h*0.75} C ${w*0.04} ${h*0.75},${w*0.02} ${h*0.55},${w*0.10} ${h*0.48} C ${w*0.06} ${h*0.28},${w*0.22} ${h*0.18},${w*0.32} ${h*0.26} C ${w*0.33} ${h*0.10},${w*0.47} ${h*0.04},${w*0.50} ${h*0.08} C ${w*0.53} ${h*0.04},${w*0.67} ${h*0.10},${w*0.68} ${h*0.26} C ${w*0.78} ${h*0.18},${w*0.94} ${h*0.28},${w*0.90} ${h*0.48} C ${w*0.98} ${h*0.55},${w*0.96} ${h*0.75},${w*0.82} ${h*0.75} C ${w*0.80} ${h*0.88},${w*0.62} ${h*0.94},${w*0.50} ${h*0.90} C ${w*0.38} ${h*0.94},${w*0.20} ${h*0.88},${w*0.18} ${h*0.75} Z`;
}

function MangaBubbleSVG({ bubble, w, h, dimmed }: BubbleSVGProps) {
  const { bubbleType: type, tailDir, dialogue, fontSize, rotation } = bubble;

  if (type === 'none' || (isNoneText(dialogue) && type !== 'sfx')) return null;

  const text = dialogue ?? '';
  const fill = bubble.fillColor ?? '#ffffff';
  const stroke = '#1a1a1a';
  const opacity = (bubble.opacity ?? 1) * (dimmed ? 0.8 : 1);
  const userTextColor = bubble.textColor;
  const TAIL = 22;

  // ── SFX: pure text, no container ──────────────────────────────────────────
  if (type === 'sfx') {
    const sfxSize = Math.max(fontSize, 24);
    const cx = w / 2, cy = h / 2;
    const lines = wrapTextToLines(text, w * 0.9, sfxSize, true);
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w} height={h}
        style={{ overflow: 'visible', opacity, pointerEvents: 'none', display: 'block' }}
      >
        <g transform={rotation ? `rotate(${rotation}, ${cx}, ${cy})` : undefined}>
          <SvgText
            lines={lines} cx={cx} cy={cy}
            fontSize={sfxSize}
            fontFamily="Bangers, Impact, sans-serif"
            fontWeight="normal"
            fill={userTextColor ?? 'white'}
            stroke="#1a1a1a"
            strokeWidth={3}
            letterSpacing="0.06em"
          />
        </g>
      </svg>
    );
  }

  // ── Shaped bubbles ─────────────────────────────────────────────────────────
  // viewBox is 1:1 with display size; tail overflows via overflow:visible
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 2;
  const ry = h / 2 - 2;

  // Tail polygon points (in viewBox space, body centered at cx,cy)
  function tailPts(erx = rx, ery = ry): string {
    if (!hasTailSupport(type) || tailDir === 'none') return '';
    const TW = 7; // half-width of tail base on body edge
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

  // Thought trail circles in viewBox coords
  function thoughtTrail(): { cx: number; cy: number; r: number }[] {
    let tx: number, ty: number;
    switch (tailDir) {
      case 'down-left':  tx = cx - rx*0.35; ty = cy + ry + TAIL; break;
      case 'down':       tx = cx;            ty = cy + ry + TAIL; break;
      case 'down-right': tx = cx + rx*0.35; ty = cy + ry + TAIL; break;
      case 'up-left':    tx = cx - rx*0.35; ty = cy - ry - TAIL; break;
      case 'up':         tx = cx;            ty = cy - ry - TAIL; break;
      case 'up-right':   tx = cx + rx*0.35; ty = cy - ry - TAIL; break;
      case 'left':       tx = cx - rx - TAIL; ty = cy; break;
      case 'right':      tx = cx + rx + TAIL; ty = cy; break;
      default:           tx = cx; ty = cy + ry + TAIL; break;
    }
    // edge point on cloud perimeter toward tail direction
    const edgeX = cx + (tx - cx) * 0.62;
    const edgeY = cy + (ty - cy) * 0.62;
    return [
      { cx: edgeX, cy: edgeY, r: 5.5 },
      { cx: edgeX + (tx-edgeX)*0.48, cy: edgeY + (ty-edgeY)*0.48, r: 3.5 },
      { cx: tx, cy: ty, r: 2 },
    ];
  }

  // Per-type visual properties
  const isSpiky   = type === 'shout' || type === 'scream' || type === 'burst';
  const isRound   = type === 'round';
  const circR     = Math.min(rx, ry);  // for round type
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
  const bodyStroke = type === 'electric'  ? '#DAA520'
                   : type === 'heart'     ? '#FF6B9D'
                   : type === 'wobbly'    ? '#6699CC'
                   : type === 'scream'    ? '#CC0000'
                   : stroke;

  const tailPoints = tailPts(isRound ? circR : rx, isRound ? circR : ry);

  // Text area: inset within body shape
  const textInset = type === 'thought' ? 0.25 : type === 'narration' || type === 'square' ? 0.06 : isSpiky ? 0.22 : 0.16;
  const textW = w * (1 - textInset * 2);
  const isBangers = type === 'shout' || type === 'scream' || type === 'burst';
  const lines = wrapTextToLines(text, textW, fontSize, isBangers);

  const fontFamily = isBangers
    ? 'Bangers, Impact, sans-serif'
    : type === 'square'
    ? 'monospace'
    : type === 'whisper' || type === 'wobbly'
    ? "'Comic Neue', 'Comic Sans MS', cursive"
    : "'Comic Neue', 'Comic Sans MS', cursive";
  const fontWeight  = type === 'shout' || type === 'scream' ? 700 : 400;
  const fontStyle   = type === 'narration' || type === 'whisper' || type === 'wobbly' ? 'italic' : 'normal';
  const textFill    = userTextColor ?? (type === 'narration' ? '#22224a' : type === 'scream' ? '#660000' : '#111111');
  const textAnchor  = type === 'narration' || type === 'square' ? 'start' as const : 'middle' as const;
  const textCX      = type === 'narration' || type === 'square' ? cx - rx + fontSize * 0.5 : cx;
  const textCY      = type === 'narration' || type === 'square'
    ? (cy - ry + fontSize * 1.1)  // top-anchored in boxes
    : cy;

  // Narration/square: top-anchored tspan rendering
  const renderBoxText = () => (
    <text fontFamily={fontFamily} fontSize={fontSize} fontStyle={fontStyle} fill={textFill} textAnchor={textAnchor} style={{ userSelect: 'none' }}>
      {lines.map((line, i) => (
        <tspan key={i} x={textCX} y={(cy - ry) + fontSize * 1.1 + i * fontSize * 1.35}>{line}</tspan>
      ))}
    </text>
  );

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w} height={h}
      style={{ overflow: 'visible', opacity, pointerEvents: 'none', display: 'block' }}
    >
      {/* ── SPEECH ── */}
      {type === 'speech' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={bodyFill} stroke={bodyStroke} strokeWidth={strokeW} strokeLinejoin="round" />}
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={bodyFill} stroke={bodyStroke} strokeWidth={strokeW} />
          <SvgText lines={lines} cx={textCX} cy={textCY} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={textFill} textAnchor={textAnchor} />
        </>
      )}

      {/* ── WHISPER — dashed oval, italic ── */}
      {type === 'whisper' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={bodyFill} stroke={bodyStroke} strokeWidth={1.5} strokeDasharray="6,3" strokeLinejoin="round" />}
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={bodyFill} stroke={bodyStroke} strokeWidth={1.5} strokeDasharray="6,3" />
          <SvgText lines={lines} cx={cx} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={400} fill={textFill} />
        </>
      )}

      {/* ── DOUBLE — two concentric ovals ── */}
      {type === 'double' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={bodyFill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />}
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={bodyFill} stroke={stroke} strokeWidth={strokeW} />
          <ellipse cx={cx} cy={cy} rx={Math.max(rx - 7, 4)} ry={Math.max(ry - 7, 4)} fill="none" stroke={stroke} strokeWidth={1.5} />
          <SvgText lines={lines} cx={cx} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={textFill} />
        </>
      )}

      {/* ── ELECTRIC — gold dashed oval ── */}
      {type === 'electric' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={bodyFill} stroke={bodyStroke} strokeWidth={strokeW} strokeLinejoin="round" />}
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={bodyFill} stroke={bodyStroke} strokeWidth={strokeW} strokeDasharray="4,2" />
          <SvgText lines={lines} cx={cx} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={textFill} />
        </>
      )}

      {/* ── ROUND — perfect circle ── */}
      {type === 'round' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={bodyFill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />}
          <circle cx={cx} cy={cy} r={circR} fill={bodyFill} stroke={stroke} strokeWidth={strokeW} />
          <SvgText lines={lines} cx={cx} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={textFill} />
        </>
      )}

      {/* ── SQUARE — sharp rectangle, monospace ── */}
      {type === 'square' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={bodyFill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />}
          <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} fill={bodyFill} stroke={stroke} strokeWidth={strokeW} rx={2} />
          {renderBoxText()}
        </>
      )}

      {/* ── SHOUT — spiky star (8 spikes) ── */}
      {type === 'shout' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={bodyFill} stroke={bodyStroke} strokeWidth={strokeW} strokeLinejoin="round" />}
          <polygon points={spikyPts(cx, cy, rx, ry, 8)} fill={bodyFill} stroke={bodyStroke} strokeWidth={strokeW} strokeLinejoin="miter" />
          <SvgText lines={lines} cx={cx} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={textFill} />
        </>
      )}

      {/* ── SCREAM — denser spike star (14 spikes), red ── */}
      {type === 'scream' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={bodyFill} stroke={bodyStroke} strokeWidth={strokeW} strokeLinejoin="round" />}
          <polygon points={spikyPts(cx, cy, rx, ry, 14, 0.78)} fill={bodyFill} stroke={bodyStroke} strokeWidth={strokeW} strokeLinejoin="miter" />
          <SvgText lines={lines} cx={cx} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={700} fill={textFill} />
        </>
      )}

      {/* ── THOUGHT — arc-based cloud path, works at all sizes ── */}
      {type === 'thought' && (() => {
        const minDim = Math.min(w, h);
        const sw = Math.max(1.5, minDim * 0.022);
        const dotR1 = Math.max(3.5, minDim * 0.048);
        const dotR2 = Math.max(2.5, minDim * 0.034);
        const dotR3 = Math.max(1.5, minDim * 0.021);
        const trail = tailDir !== 'none' ? thoughtTrail() : [];
        return (
          <>
            <path d={buildCloudPath(w, h)} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
            {trail.map((c, i) => {
              const r = i === 0 ? dotR1 : i === 1 ? dotR2 : dotR3;
              return (
                <g key={`tt${i}`}>
                  <circle cx={c.cx} cy={c.cy} r={r} fill={fill} />
                  <circle cx={c.cx} cy={c.cy} r={r} fill="none" stroke={stroke} strokeWidth={Math.max(0.8, sw * (0.8 - i * 0.1))} />
                </g>
              );
            })}
            <SvgText lines={lines} cx={cx} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={textFill} />
          </>
        );
      })()}

      {/* ── NARRATION ── */}
      {type === 'narration' && (
        <>
          <rect x={cx-rx} y={cy-ry} width={rx*2} height={ry*2} fill={bodyFill} stroke={stroke} strokeWidth={2} rx={0} />
          {renderBoxText()}
        </>
      )}

      {/* ── HEART — no tail ── */}
      {type === 'heart' && (
        <>
          <path d={heartPath(cx, cy, rx, ry)} fill={bodyFill} stroke={bodyStroke} strokeWidth={2} strokeLinejoin="round" />
          <SvgText lines={lines} cx={cx} cy={cy + ry * 0.15} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={userTextColor ?? '#880033'} />
        </>
      )}

      {/* ── BURST — starburst, no tail, Bangers ── */}
      {type === 'burst' && (
        <>
          <polygon points={spikyPts(cx, cy, rx, ry, 10, 0.65)} fill={bodyFill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="miter" />
          <SvgText lines={lines} cx={cx} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={700} fill={textFill} />
        </>
      )}

      {/* ── WOBBLY — organic blob, blue stroke ── */}
      {type === 'wobbly' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={bodyFill} stroke={bodyStroke} strokeWidth={2} strokeLinejoin="round" />}
          <path d={wobblyPath(cx, cy, rx, ry)} fill={bodyFill} stroke={bodyStroke} strokeWidth={2} />
          <SvgText lines={lines} cx={cx} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={userTextColor ?? '#334466'} />
        </>
      )}
    </svg>
  );
}

// ── PanelCell ─────────────────────────────────────────────────────────────────

type DragHandle = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'tail';

interface PanelCellProps {
  panel: Step4Panel;
  panelIndex: number;
  imageUrl: string | null;
  bubbles: PanelBubbles;
  layoutRows: number[][];
  selectedBubbleId: string | null;
  editingBubbleId: string | null;
  zoom: number;
  onBubbleSelect: (panelId: string, bubbleId: string) => void;
  onBubbleDeselect: () => void;
  onBubbleAdd: (panelId: string, normX: number, normY: number, bubbleType?: BubbleType) => void;
  onBubbleUpdate: (panelId: string, bubbleId: string, patch: Partial<SingleBubble>) => void;
  onDragCommit: () => void;
  onContextMenu: (panelId: string, bubbleId: string, x: number, y: number) => void;
  onEditStart: (panelId: string, bubbleId: string) => void;
  onEditEnd: () => void;
}

function PanelCell({
  panel, panelIndex, imageUrl, bubbles, layoutRows,
  selectedBubbleId, editingBubbleId, zoom,
  onBubbleSelect, onBubbleDeselect, onBubbleAdd, onBubbleUpdate, onDragCommit, onContextMenu,
  onEditStart, onEditEnd,
}: PanelCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  // Local visual override during drag — avoids parent re-renders on every frame
  const [dragOverride, setDragOverride] = useState<Partial<SingleBubble> | null>(null);

  const gridPlacement = getPanelGridPlacement(layoutRows, panelIndex);
  const sortedBubbles = [...bubbles].filter(b => !b.crossPanel).sort((a, b) => a.zIndex - b.zIndex);
  const selectedBubble = bubbles.find(b => b.id === selectedBubbleId && !b.crossPanel) ?? null;

  // Drag state
  const dragRef = useRef<{
    handle: DragHandle;
    startMX: number; startMY: number;
    startBubble: SingleBubble;
    cellW: number; cellH: number;
    cellLeft: number; cellTop: number;
  } | null>(null);
  const isDraggingRef = useRef(false);
  const dragActiveRef = useRef(false); // true only once pointer moves past 3px threshold

  // Compute patch from current pointer event — shared by onPointerMove and onPointerUp
  const computePatch = useCallback((e: React.PointerEvent): Partial<SingleBubble> | null => {
    const d = dragRef.current;
    if (!d) return null;
    const screenDx = e.clientX - d.startMX;
    const screenDy = e.clientY - d.startMY;
    const logDx = screenDx / zoom;
    const logDy = screenDy / zoom;
    const sb = d.startBubble;

    if (d.handle === 'tail') {
      const mouseX = (e.clientX - d.cellLeft) / zoom;
      const mouseY = (e.clientY - d.cellTop) / zoom;
      const bubbleCX = sb.bubblePosition.x * d.cellW;
      const bubbleCY = sb.bubblePosition.y * d.cellH;
      return { tailDir: dirFromVector(mouseX - bubbleCX, mouseY - bubbleCY) };
    }

    if (d.handle === 'move') {
      return {
        bubblePosition: {
          x: clamp(sb.bubblePosition.x + logDx / d.cellW, 0.05, 0.95),
          y: clamp(sb.bubblePosition.y + logDy / d.cellH, 0.05, 0.95),
        },
      };
    }

    // Resize handles
    let newW = sb.bubbleSize.w, newH = sb.bubbleSize.h;
    let newX = sb.bubblePosition.x, newY = sb.bubblePosition.y;
    switch (d.handle) {
      case 'tl': newW = Math.max(MIN_BUBBLE_W, sb.bubbleSize.w - logDx); newH = Math.max(MIN_BUBBLE_H, sb.bubbleSize.h - logDy);
        newX = sb.bubblePosition.x + logDx / d.cellW / 2; newY = sb.bubblePosition.y + logDy / d.cellH / 2; break;
      case 'tr': newW = Math.max(MIN_BUBBLE_W, sb.bubbleSize.w + logDx); newH = Math.max(MIN_BUBBLE_H, sb.bubbleSize.h - logDy);
        newY = sb.bubblePosition.y + logDy / d.cellH / 2; break;
      case 'bl': newW = Math.max(MIN_BUBBLE_W, sb.bubbleSize.w - logDx); newH = Math.max(MIN_BUBBLE_H, sb.bubbleSize.h + logDy);
        newX = sb.bubblePosition.x + logDx / d.cellW / 2; break;
      case 'br': newW = Math.max(MIN_BUBBLE_W, sb.bubbleSize.w + logDx); newH = Math.max(MIN_BUBBLE_H, sb.bubbleSize.h + logDy); break;
    }
    return {
      bubbleSize: { w: newW, h: newH },
      bubblePosition: { x: clamp(newX, 0.05, 0.95), y: clamp(newY, 0.05, 0.95) },
    };
  }, [zoom]);

  const startDrag = useCallback((e: React.PointerEvent, handle: DragHandle, bubble: SingleBubble) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cellRef.current) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const rect = cellRef.current.getBoundingClientRect();
    dragRef.current = {
      handle,
      startMX: e.clientX, startMY: e.clientY,
      startBubble: { ...bubble },
      cellW: rect.width / zoom,
      cellH: rect.height / zoom,
      cellLeft: rect.left,
      cellTop: rect.top,
    };
    isDraggingRef.current = true;
    cellRef.current.style.cursor =
      handle === 'move' ? 'grabbing' :
      handle === 'tail' ? 'crosshair' :
      (handle === 'tl' || handle === 'br') ? 'nwse-resize' : 'nesw-resize';
  }, [zoom]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragRef.current) return;
    if (!dragActiveRef.current) {
      const dx = e.clientX - dragRef.current.startMX;
      const dy = e.clientY - dragRef.current.startMY;
      if (Math.hypot(dx, dy) < 3) return;
      dragActiveRef.current = true;
    }
    const patch = computePatch(e);
    if (patch) setDragOverride(patch);
  }, [computePatch]);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragRef.current) return;
    const wasActive = dragActiveRef.current;
    const bubbleId = dragRef.current.startBubble.id;
    // Compute patch BEFORE clearing dragRef — computePatch reads from it
    const patch = wasActive ? computePatch(e) : null;
    dragRef.current = null;
    isDraggingRef.current = false;
    dragActiveRef.current = false;
    setDragOverride(null);
    if (cellRef.current) cellRef.current.style.cursor = '';
    if (wasActive && patch) {
      onBubbleUpdate(panel.id, bubbleId, patch);
      onDragCommit();
    }
  }, [computePatch, panel.id, onBubbleUpdate, onDragCommit]);

  const handleCellClick = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) return;
    if (!cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    onBubbleAdd(panel.id, clamp(normX, 0.05, 0.95), clamp(normY, 0.05, 0.95));
  }, [panel.id, onBubbleAdd]);

  const handleAddClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onBubbleAdd(panel.id, 0.5, 0.35);
  }, [panel.id, onBubbleAdd]);

  return (
    <div
      ref={cellRef}
      style={{
        ...gridPlacement,
        position: 'relative',
        overflow: 'hidden',
        border: isHovered && !selectedBubbleId
          ? '2px solid rgba(99,102,241,0.5)'
          : '2px solid #1a1a1a',
        background: '#1a1a1a',
        cursor: 'crosshair',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCellClick}
      onMouseDown={(e) => {
        if (e.target === cellRef.current || (e.target as HTMLElement).tagName === 'IMG') {
          onBubbleDeselect();
        }
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('bubbleType') as BubbleType | '';
        if (!type) return;
        const rect = cellRef.current?.getBoundingClientRect();
        if (!rect) return;
        const normX = clamp((e.clientX - rect.left) / rect.width, 0.05, 0.95);
        const normY = clamp((e.clientY - rect.top) / rect.height, 0.05, 0.95);
        onBubbleAdd(panel.id, normX, normY, type);
      }}
    >
      {/* Panel image */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl} alt=""
          draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
          <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.18)', fontSize: 28 }}>crop_original</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>P{panel.panelNumber}</span>
        </div>
      )}

      {/* Non-selected bubbles SVG overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {sortedBubbles.filter(b => b.id !== selectedBubbleId).map(b => {
          const cellEl = cellRef.current;
          if (!cellEl) return null;
          const cellW = cellEl.clientWidth;
          const cellH = cellEl.clientHeight;
          const left = b.bubblePosition.x * cellW - b.bubbleSize.w / 2;
          const top = b.bubblePosition.y * cellH - b.bubbleSize.h / 2;
          return (
            <div key={b.id}
              style={{ position: 'absolute', left, top, width: b.bubbleSize.w, height: b.bubbleSize.h, zIndex: b.zIndex, pointerEvents: 'auto', cursor: 'grab' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onBubbleSelect(panel.id, b.id);
                startDrag(e, 'move', b);
              }}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onDoubleClick={(e) => { e.stopPropagation(); onEditStart(panel.id, b.id); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(panel.id, b.id, e.clientX, e.clientY); }}
            >
              <MangaBubbleSVG bubble={b} w={b.bubbleSize.w} h={b.bubbleSize.h} dimmed={!!selectedBubbleId} />
            </div>
          );
        })}
      </div>

      {/* Selected bubble with handles */}
      {selectedBubble && (() => {
        const cellEl = cellRef.current;
        if (!cellEl) return null;
        // Merge drag override for smooth visual updates during drag (no parent re-renders)
        const displayBubble = dragOverride ? { ...selectedBubble, ...dragOverride } : selectedBubble;
        const cellW = cellEl.clientWidth;
        const cellH = cellEl.clientHeight;
        const left = displayBubble.bubblePosition.x * cellW - displayBubble.bubbleSize.w / 2;
        const top = displayBubble.bubblePosition.y * cellH - displayBubble.bubbleSize.h / 2;
        const bw = displayBubble.bubbleSize.w;
        const bh = displayBubble.bubbleSize.h;
        const tip = hasTailSupport(displayBubble.bubbleType) && displayBubble.tailDir !== 'none'
          ? tailTipOffset(displayBubble.tailDir, bw, bh) : null;

        const HANDLE_SIZE = 10;
        const handleStyle: React.CSSProperties = {
          position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE,
          background: 'white', border: '2px solid #6366f1',
          borderRadius: 2, transform: 'rotate(45deg)',
          cursor: 'nwse-resize', zIndex: 30,
        };

        return (
          <div
            style={{ position: 'absolute', left, top, width: bw, height: bh, zIndex: selectedBubble.zIndex + 1, cursor: 'grab' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => { e.stopPropagation(); startDrag(e, 'move', displayBubble); }}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onDoubleClick={(e) => { e.stopPropagation(); onEditStart(panel.id, selectedBubble.id); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(panel.id, selectedBubble.id, e.clientX, e.clientY); }}
          >
            <MangaBubbleSVG bubble={displayBubble} w={bw} h={bh} />

            {/* Dashed selection border */}
            <div style={{
              position: 'absolute', inset: -2,
              border: '1.5px dashed #6366f1',
              borderRadius: 3,
              pointerEvents: 'none',
            }} />

            {/* Corner resize handles */}
            <div style={{ ...handleStyle, top: -HANDLE_SIZE/2-1, left: -HANDLE_SIZE/2-1, cursor: 'nwse-resize' }}
              onPointerDown={(e) => { e.stopPropagation(); startDrag(e, 'tl', displayBubble); }} />
            <div style={{ ...handleStyle, top: -HANDLE_SIZE/2-1, right: -HANDLE_SIZE/2-1, cursor: 'nesw-resize' }}
              onPointerDown={(e) => { e.stopPropagation(); startDrag(e, 'tr', displayBubble); }} />
            <div style={{ ...handleStyle, bottom: -HANDLE_SIZE/2-1, left: -HANDLE_SIZE/2-1, cursor: 'nesw-resize' }}
              onPointerDown={(e) => { e.stopPropagation(); startDrag(e, 'bl', displayBubble); }} />
            <div style={{ ...handleStyle, bottom: -HANDLE_SIZE/2-1, right: -HANDLE_SIZE/2-1, cursor: 'nwse-resize' }}
              onPointerDown={(e) => { e.stopPropagation(); startDrag(e, 'br', displayBubble); }} />

            {/* Tail handle */}
            {tip && (
              <div
                style={{
                  position: 'absolute',
                  left: bw / 2 + tip.dx - 6,
                  top: bh / 2 + tip.dy - 6,
                  width: 12, height: 12,
                  background: '#6366f1', borderRadius: '50%',
                  border: '2px solid white',
                  cursor: 'crosshair', zIndex: 30,
                }}
                onPointerDown={(e) => { e.stopPropagation(); startDrag(e, 'tail', displayBubble); }}
              />
            )}

            {/* Inline text editor — double-click or auto on new bubble */}
            {editingBubbleId === selectedBubble.id && selectedBubble.bubbleType !== 'none' && selectedBubble.bubbleType !== 'sfx' && (
              <textarea
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={selectedBubble.dialogue ?? ''}
                onChange={(e) => onBubbleUpdate(panel.id, selectedBubble.id, { dialogue: e.target.value })}
                onBlur={onEditEnd}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onEditEnd(); } }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', inset: '12% 10%',
                  background: 'transparent', border: 'none', outline: 'none',
                  resize: 'none', textAlign: 'center',
                  fontSize: selectedBubble.fontSize / zoom,
                  color: 'transparent', caretColor: selectedBubble.textColor ?? '#111111',
                  fontFamily: 'Bangers, sans-serif',
                  lineHeight: 1.3, zIndex: 25,
                  cursor: 'text', overflow: 'hidden',
                }}
              />
            )}

          </div>
        );
      })()}

      {/* Panel number badge */}
      <div style={{
        position: 'absolute', top: 4, left: 4, zIndex: 20,
        background: 'rgba(0,0,0,0.45)',
        color: 'rgba(255,255,255,0.7)',
        fontSize: 9, fontWeight: 600,
        padding: '1px 5px', borderRadius: 3,
        pointerEvents: 'none',
      }}>
        P{panel.panelNumber}
      </div>

      {/* Bubble count badge */}
      {bubbles.length >= 2 && (
        <div style={{
          position: 'absolute', top: 4, right: 32, zIndex: 20,
          background: 'rgba(99,102,241,0.85)',
          color: 'white',
          fontSize: 9, fontWeight: 700,
          padding: '1px 5px', borderRadius: 3,
          pointerEvents: 'none',
        }}>
          ×{bubbles.length}
        </div>
      )}

      {/* Add bubble [+] button on hover */}
      {isHovered && (
        <button
          type="button"
          onClick={handleAddClick}
          style={{
            position: 'absolute', top: 4, right: 4, zIndex: 25,
            width: 22, height: 22,
            background: 'rgba(99,102,241,0.9)',
            border: 'none', borderRadius: '50%',
            color: 'white', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}
          title="Add speech bubble"
        >
          +
        </button>
      )}
    </div>
  );
}

// ── PageBubbleLayer ───────────────────────────────────────────────────────────
// Renders bubbles with crossPanel:true in an absolute overlay covering the full page.
// Bubble positions (0-1) are treated as page-relative (×BASE_PAGE_W / ×BASE_PAGE_H).

export const PAGE_PANEL_PREFIX = '__page__'; // kept for backward-compat with MongoDB records

interface PageBubbleLayerProps {
  panels: Step4Panel[];
  panelBubbles: Record<string, PanelBubbles>;
  selectedBubble: { panelId: string; bubbleId: string } | null;
  zoom: number;
  onBubbleSelect: (panelId: string, bubbleId: string) => void;
  onBubbleDeselect: () => void;
  onBubbleUpdate: (panelId: string, bubbleId: string, patch: Partial<SingleBubble>) => void;
  onDragCommit: () => void;
  onContextMenu: (panelId: string, bubbleId: string, x: number, y: number) => void;
}

function PageBubbleLayer({
  panels, panelBubbles, selectedBubble, zoom,
  onBubbleSelect, onBubbleDeselect, onBubbleUpdate, onDragCommit, onContextMenu,
}: PageBubbleLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [dragOverride, setDragOverride] = useState<Partial<SingleBubble> | null>(null);
  const dragRef = useRef<{
    handle: DragHandle;
    startMX: number; startMY: number;
    startBubble: SingleBubble;
    sourcePanelId: string;
    cellW: number; cellH: number;
    cellLeft: number; cellTop: number;
  } | null>(null);
  const isDraggingRef = useRef(false);

  // Collect cross-panel bubbles from all panels, keeping track of source panel
  const crossItems = useMemo(() =>
    panels.flatMap(p =>
      (panelBubbles[p.id] ?? [])
        .filter(b => b.crossPanel)
        .map(b => ({ bubble: b, panelId: p.id }))
    ).sort((a, b) => a.bubble.zIndex - b.bubble.zIndex),
    [panels, panelBubbles]
  );

  const selectedItem = selectedBubble
    ? crossItems.find(x => x.panelId === selectedBubble.panelId && x.bubble.id === selectedBubble.bubbleId) ?? null
    : null;

  const computePatch = useCallback((e: React.PointerEvent): Partial<SingleBubble> | null => {
    const d = dragRef.current;
    if (!d) return null;
    const logDx = (e.clientX - d.startMX) / zoom;
    const logDy = (e.clientY - d.startMY) / zoom;
    const sb = d.startBubble;

    if (d.handle === 'tail') {
      const mouseX = (e.clientX - d.cellLeft) / zoom;
      const mouseY = (e.clientY - d.cellTop) / zoom;
      return { tailDir: dirFromVector(mouseX - sb.bubblePosition.x * d.cellW, mouseY - sb.bubblePosition.y * d.cellH) };
    }
    if (d.handle === 'move') {
      return {
        bubblePosition: {
          x: clamp(sb.bubblePosition.x + logDx / d.cellW, 0.02, 0.98),
          y: clamp(sb.bubblePosition.y + logDy / d.cellH, 0.02, 0.98),
        },
      };
    }
    let newW = sb.bubbleSize.w, newH = sb.bubbleSize.h;
    let newX = sb.bubblePosition.x, newY = sb.bubblePosition.y;
    switch (d.handle) {
      case 'tl': newW = Math.max(MIN_BUBBLE_W, sb.bubbleSize.w - logDx); newH = Math.max(MIN_BUBBLE_H, sb.bubbleSize.h - logDy);
        newX = sb.bubblePosition.x + logDx / d.cellW / 2; newY = sb.bubblePosition.y + logDy / d.cellH / 2; break;
      case 'tr': newW = Math.max(MIN_BUBBLE_W, sb.bubbleSize.w + logDx); newH = Math.max(MIN_BUBBLE_H, sb.bubbleSize.h - logDy);
        newY = sb.bubblePosition.y + logDy / d.cellH / 2; break;
      case 'bl': newW = Math.max(MIN_BUBBLE_W, sb.bubbleSize.w - logDx); newH = Math.max(MIN_BUBBLE_H, sb.bubbleSize.h + logDy);
        newX = sb.bubblePosition.x + logDx / d.cellW / 2; break;
      case 'br': newW = Math.max(MIN_BUBBLE_W, sb.bubbleSize.w + logDx); newH = Math.max(MIN_BUBBLE_H, sb.bubbleSize.h + logDy); break;
    }
    return { bubbleSize: { w: newW, h: newH }, bubblePosition: { x: clamp(newX, 0.02, 0.98), y: clamp(newY, 0.02, 0.98) } };
  }, [zoom]);

  const startDrag = useCallback((e: React.PointerEvent, handle: DragHandle, bubble: SingleBubble, srcPanelId: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!layerRef.current) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const rect = layerRef.current.getBoundingClientRect();
    dragRef.current = {
      handle, startMX: e.clientX, startMY: e.clientY,
      startBubble: { ...bubble },
      sourcePanelId: srcPanelId,
      cellW: rect.width / zoom, cellH: rect.height / zoom,
      cellLeft: rect.left, cellTop: rect.top,
    };
    isDraggingRef.current = true;
  }, [zoom]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragRef.current) return;
    const patch = computePatch(e);
    if (patch) setDragOverride(patch);
  }, [computePatch]);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragRef.current) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    const patch = computePatch(e);
    if (patch) onBubbleUpdate(dragRef.current.sourcePanelId, dragRef.current.startBubble.id, patch);
    dragRef.current = null; isDraggingRef.current = false; setDragOverride(null);
    onDragCommit();
  }, [computePatch, onBubbleUpdate, onDragCommit]);

  const HANDLE_SIZE = 10;
  const handleStyle: React.CSSProperties = {
    position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE,
    background: 'white', border: '2px solid #10b981',
    borderRadius: 2, transform: 'rotate(45deg)', cursor: 'nwse-resize', zIndex: 30,
  };

  return (
    <div
      ref={layerRef}
      style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}
      onClick={() => onBubbleDeselect()}
    >
      {/* Non-selected cross-panel bubbles */}
      {crossItems.filter(x => x.bubble.id !== selectedItem?.bubble.id).map(({ bubble: b, panelId: srcId }) => {
        const left = b.bubblePosition.x * BASE_PAGE_W - b.bubbleSize.w / 2;
        const top  = b.bubblePosition.y * BASE_PAGE_H - b.bubbleSize.h / 2;
        return (
          <div key={b.id}
            style={{ position: 'absolute', left, top, width: b.bubbleSize.w, height: b.bubbleSize.h, zIndex: b.zIndex, pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onBubbleSelect(srcId, b.id); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(srcId, b.id, e.clientX, e.clientY); }}
          >
            <MangaBubbleSVG bubble={b} w={b.bubbleSize.w} h={b.bubbleSize.h} dimmed={!!selectedItem} />
          </div>
        );
      })}

      {/* Selected cross-panel bubble with handles */}
      {selectedItem && (() => {
        const { bubble: selB, panelId: selPanelId } = selectedItem;
        const displayBubble = dragOverride ? { ...selB, ...dragOverride } : selB;
        const left = displayBubble.bubblePosition.x * BASE_PAGE_W - displayBubble.bubbleSize.w / 2;
        const top  = displayBubble.bubblePosition.y * BASE_PAGE_H - displayBubble.bubbleSize.h / 2;
        const bw = displayBubble.bubbleSize.w, bh = displayBubble.bubbleSize.h;
        const tip = hasTailSupport(displayBubble.bubbleType) && displayBubble.tailDir !== 'none'
          ? tailTipOffset(displayBubble.tailDir, bw, bh) : null;
        return (
          <div
            style={{ position: 'absolute', left, top, width: bw, height: bh, zIndex: selB.zIndex + 1, pointerEvents: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(selPanelId, selB.id, e.clientX, e.clientY); }}
          >
            <MangaBubbleSVG bubble={displayBubble} w={bw} h={bh} dimmed={false} />
            {/* Move handle */}
            <div style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 10 }}
              onPointerDown={(e) => startDrag(e, 'move', selB, selPanelId)} />
            {/* Corner resize handles — green tint to distinguish from panel bubbles */}
            {(['tl','tr','bl','br'] as DragHandle[]).map(h => (
              <div key={h} style={{
                ...handleStyle, borderColor: '#10b981',
                top: h.includes('t') ? -HANDLE_SIZE/2 : undefined,
                bottom: h.includes('b') ? -HANDLE_SIZE/2 : undefined,
                left: h.includes('l') ? -HANDLE_SIZE/2 : undefined,
                right: h.includes('r') ? -HANDLE_SIZE/2 : undefined,
                cursor: (h === 'tl' || h === 'br') ? 'nwse-resize' : 'nesw-resize',
              }}
                onPointerDown={(e) => startDrag(e, h, selB, selPanelId)} />
            ))}
            {/* Tail direction handle */}
            {tip && (
              <div style={{
                position: 'absolute', width: 12, height: 12, borderRadius: '50%',
                background: '#10b981', border: '2px solid white',
                left: bw / 2 + tip.dx - 6, top: bh / 2 + tip.dy - 6,
                cursor: 'crosshair', zIndex: 31,
              }}
                onPointerDown={(e) => startDrag(e, 'tail', selB, selPanelId)} />
            )}
            {/* Selection outline */}
            <div style={{ position: 'absolute', inset: -2, border: '2px dashed #10b981', borderRadius: 3, pointerEvents: 'none', zIndex: 5 }} />
          </div>
        );
      })()}
    </div>
  );
}

// Computes tail direction pointing from bubble toward panel center (character approximation)
function autoDetectTailDir(bubblePos: BubblePosition): TailDir {
  const dx = 0.5 - bubblePos.x;
  const dy = 0.5 - bubblePos.y;
  if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return 'down';
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle >= -22.5  && angle <  22.5)  return 'right';
  if (angle >=  22.5  && angle <  67.5)  return 'down-right';
  if (angle >=  67.5  && angle < 112.5)  return 'down';
  if (angle >= 112.5  && angle < 157.5)  return 'down-left';
  if (angle >= 157.5  || angle < -157.5) return 'left';
  if (angle >= -157.5 && angle < -112.5) return 'up-left';
  if (angle >= -112.5 && angle <  -67.5) return 'up';
  return 'up-right';
}

// ── BubbleSidebar ─────────────────────────────────────────────────────────────

interface BubbleSidebarProps {
  selectedBubble: SingleBubble | null;
  selectedPanelId: string | null;
  currentPanels: Step4Panel[];
  panelBubbles: Record<string, PanelBubbles>;
  saveStatus: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';
  onBubbleChange: (patch: Partial<SingleBubble>) => void;
  onBubbleDelete: () => void;
  onPanelSelect: (panelId: string) => void;
  onAutoImport: () => void;
  onRetrySave: () => void;
}

const BUBBLE_TYPE_OPTIONS: { type: BubbleType; label: string; icon: string }[] = [
  { type: 'speech',    label: 'Speech',    icon: 'chat_bubble' },
  { type: 'thought',   label: 'Thought',   icon: 'cloud' },
  { type: 'shout',     label: 'Shout',     icon: 'campaign' },
  { type: 'scream',    label: 'Scream',    icon: 'warning' },
  { type: 'whisper',   label: 'Whisper',   icon: 'hearing' },
  { type: 'double',    label: 'Double',    icon: 'adjust' },
  { type: 'electric',  label: 'Electric',  icon: 'bolt' },
  { type: 'round',     label: 'Round',     icon: 'circle' },
  { type: 'square',    label: 'Square',    icon: 'crop_square' },
  { type: 'wobbly',    label: 'Wobbly',    icon: 'water' },
  { type: 'burst',     label: 'Burst',     icon: 'stars' },
  { type: 'heart',     label: 'Heart',     icon: 'favorite' },
  { type: 'sfx',       label: 'SFX',       icon: 'electric_bolt' },
  { type: 'narration', label: 'Caption',   icon: 'article' },
  { type: 'none',      label: 'None',      icon: 'block' },
];

const TAIL_DIRS: (TailDir | null)[][] = [
  ['up-left',   'up',   'up-right'  ],
  ['left',      null,   'right'     ],
  ['down-left', 'down', 'down-right'],
];

const TAIL_ICONS: Record<string, string> = {
  'up-left': '↖', 'up': '↑', 'up-right': '↗',
  'left': '←', 'right': '→',
  'down-left': '↙', 'down': '↓', 'down-right': '↘',
};

function BubbleSidebar({
  selectedBubble, selectedPanelId, currentPanels, panelBubbles,
  saveStatus, onBubbleChange, onBubbleDelete, onPanelSelect, onAutoImport, onRetrySave,
}: BubbleSidebarProps) {
  const [localText, setLocalText] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local text when selected bubble changes
  useEffect(() => {
    setLocalText(selectedBubble?.dialogue ?? '');
  }, [selectedBubble?.id, selectedBubble?.dialogue]);

  const handleTextChange = (v: string) => {
    setLocalText(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onBubbleChange({ dialogue: v || null });
    }, 500);
  };

  const primaryColor = 'var(--color-primary)';
  const mutedColor = 'var(--color-on-surface-variant)';

  // Bubble palette — always shown at top (drag tiles onto panels to create)
  const palette = (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-outline)', flexShrink: 0 }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: mutedColor, marginBottom: 6 }}>
        Drag to add bubble
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {BUBBLE_TYPE_OPTIONS.map(({ type, label, icon }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('bubbleType', type);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            style={{
              padding: '6px 4px', borderRadius: 7,
              border: '1.5px solid var(--color-outline)',
              background: selectedBubble?.bubbleType === type
                ? 'rgba(0,88,190,0.09)'
                : 'var(--color-surface-container-low)',
              color: selectedBubble?.bubbleType === type ? primaryColor : mutedColor,
              cursor: 'grab', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              fontSize: 10, fontWeight: 500, userSelect: 'none',
            }}
            onClick={() => selectedBubble && onBubbleChange({
              bubbleType: type,
              tailDir: tailDirForType(type, selectedBubble.tailDir),
              fontSize: BUBBLE_TYPE_DEFAULTS[type].fontSize,
            })}
            title={`Drag to panel to add ${label} bubble`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );

  if (!selectedBubble || !selectedPanelId) {
    return (
      <div style={{ width: 280, borderLeft: '1px solid var(--color-outline)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', background: 'var(--color-surface-container-lowest)' }}>
        {palette}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-outline)' }}>
          <button type="button" onClick={onAutoImport}
            style={{
              width: '100%', padding: '7px 12px', borderRadius: 8,
              border: `1px solid ${primaryColor}`,
              background: 'rgba(0,88,190,0.06)',
              color: primaryColor, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>
            Auto-import from script
          </button>
        </div>
        <div style={{ padding: '10px 12px', flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: mutedColor, marginBottom: 6 }}>
            Page Summary
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {currentPanels.map((panel) => {
              const bubbles = panelBubbles[panel.id] ?? [];
              const hasBubbles = bubbles.length > 0 && bubbles.some(b => !isNoneText(b.dialogue));
              const firstType = bubbles.find(b => !isNoneText(b.dialogue))?.bubbleType ?? null;
              const count = bubbles.filter(b => !isNoneText(b.dialogue)).length;
              return (
                <button key={panel.id} type="button"
                  onClick={() => onPanelSelect(panel.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', borderRadius: 6, border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: hasBubbles ? '#1D9E75' : 'var(--color-outline)' }} />
                  <span style={{ fontSize: 12, color: hasBubbles ? 'var(--color-on-surface)' : mutedColor, fontStyle: hasBubbles ? 'normal' : 'italic', flex: 1 }}>
                    Panel {panel.panelNumber}{hasBubbles ? ` — ${firstType}${count > 1 ? ` ×${count}` : ''}` : ' — No dialogue'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Bubble selected
  const isPageBubble = selectedBubble.crossPanel === true;
  const selectedPanel = currentPanels.find(p => p.id === selectedPanelId);
  const bubbleIndex = (panelBubbles[selectedPanelId ?? ''] ?? []).findIndex(b => b.id === selectedBubble.id) + 1;

  return (
    <div style={{ width: 280, borderLeft: '1px solid var(--color-outline)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', background: 'var(--color-surface-container-lowest)' }}>
      {palette}

      {/* Selected bubble header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-outline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: isPageBubble ? '#10b981' : 'var(--color-on-surface)' }}>
          {isPageBubble ? `Cross-panel · Bubble ${bubbleIndex}` : `Panel ${selectedPanel?.panelNumber} · Bubble ${bubbleIndex}`}
        </span>
        <button type="button" onClick={onBubbleDelete}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}
          title="Delete bubble">
          ✕
        </button>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        {/* Text — still in sidebar as secondary edit path */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>Text</label>
          <textarea
            value={localText}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={3}
            style={{
              width: '100%', padding: '7px 9px', borderRadius: 7, resize: 'vertical', minHeight: 60,
              border: '1px solid var(--color-outline)', background: 'var(--color-surface-container-low)',
              fontSize: 13, color: 'var(--color-on-surface)', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }}
            placeholder="Type dialogue here or double-click bubble on canvas..."
          /></div>

        {/* Font size */}
        {selectedBubble.bubbleType !== 'none' && (() => {
          const { minFont, maxFont } = BUBBLE_TYPE_DEFAULTS[selectedBubble.bubbleType];
          return (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
                Font Size — {selectedBubble.fontSize}px
              </label>
              <input type="range" min={minFont} max={maxFont} step={1}
                value={selectedBubble.fontSize}
                onChange={(e) => onBubbleChange({ fontSize: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 10, color: mutedColor }}>{minFont}px</span>
                <span style={{ fontSize: 10, color: mutedColor }}>{maxFont}px</span>
              </div>
            </div>
          );
        })()}

        {/* SFX rotation */}
        {selectedBubble.bubbleType === 'sfx' && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
              Rotation — {selectedBubble.rotation ?? 0}°
            </label>
            <input type="range" min={-20} max={20} step={1}
              value={selectedBubble.rotation ?? 0}
              onChange={(e) => onBubbleChange({ rotation: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 10, color: mutedColor }}>−20°</span>
              <span style={{ fontSize: 10, color: mutedColor }}>+20°</span>
            </div>
          </div>
        )}

        {/* Opacity */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
            Opacity — {Math.round((selectedBubble.opacity ?? 1) * 100)}%
          </label>
          <input type="range" min={10} max={100} step={5}
            value={Math.round((selectedBubble.opacity ?? 1) * 100)}
            onChange={(e) => onBubbleChange({ opacity: Number(e.target.value) / 100 })}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 10, color: mutedColor }}>10%</span>
            <span style={{ fontSize: 10, color: mutedColor }}>100%</span>
          </div>
        </div>

        {/* Colors */}
        {selectedBubble.bubbleType !== 'none' && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
              Colors
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: mutedColor, marginBottom: 4 }}>Background</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="color"
                    value={selectedBubble.fillColor ?? '#ffffff'}
                    onChange={(e) => onBubbleChange({ fillColor: e.target.value })}
                    style={{ width: 32, height: 28, padding: 1, border: `1px solid ${primaryColor}33`, borderRadius: 6, cursor: 'pointer', background: 'none' }}
                  />
                  <span style={{ fontSize: 10, color: mutedColor, fontFamily: 'monospace' }}>
                    {selectedBubble.fillColor ?? '#ffffff'}
                  </span>
                  {selectedBubble.fillColor && (
                    <button type="button"
                      onClick={() => onBubbleChange({ fillColor: undefined })}
                      title="Reset to default"
                      style={{ fontSize: 11, color: mutedColor, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>
                      ↺
                    </button>
                  )}
                </div>
              </div>
              {selectedBubble.bubbleType !== 'sfx' && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: mutedColor, marginBottom: 4 }}>Text</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="color"
                      value={selectedBubble.textColor ?? '#111111'}
                      onChange={(e) => onBubbleChange({ textColor: e.target.value })}
                      style={{ width: 32, height: 28, padding: 1, border: `1px solid ${primaryColor}33`, borderRadius: 6, cursor: 'pointer', background: 'none' }}
                    />
                    <span style={{ fontSize: 10, color: mutedColor, fontFamily: 'monospace' }}>
                      {selectedBubble.textColor ?? '#111111'}
                    </span>
                    {selectedBubble.textColor && (
                      <button type="button"
                        onClick={() => onBubbleChange({ textColor: undefined })}
                        title="Reset to default"
                        style={{ fontSize: 11, color: mutedColor, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tail direction */}
        {hasTailSupport(selectedBubble.bubbleType) && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Tail Direction
              </label>
              <button type="button"
                title="Auto-point tail toward panel center (approximates character position)"
                onClick={() => {
                  const dir = autoDetectTailDir(selectedBubble.bubblePosition);
                  onBubbleChange({ tailDir: dir });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 12,
                  border: `1px solid ${primaryColor}`,
                  background: 'rgba(0,88,190,0.05)', color: primaryColor,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                <span style={{ fontSize: 13 }}>🎯</span>
                Auto-point
              </button>
            </div>

            {/* 3×3 compass grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 36px)', gap: 5, margin: '0 auto', width: 118 }}>
              {TAIL_DIRS.flat().map((dir, idx) => {
                if (!dir) {
                  /* center reference cell — non-clickable */
                  return (
                    <div key={idx} style={{
                      width: 36, height: 36, borderRadius: 6,
                      background: '#E5E7EB',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        width: 14, height: 9, borderRadius: 7,
                        border: '1.5px solid #9CA3AF', background: 'white',
                      }} />
                    </div>
                  );
                }
                const active = selectedBubble.tailDir === dir;
                return (
                  <button key={dir} type="button"
                    onClick={() => onBubbleChange({ tailDir: dir })}
                    style={{
                      width: 36, height: 36, borderRadius: 6,
                      border: 'none',
                      background: active ? primaryColor : '#F3F4F6',
                      color: active ? '#fff' : '#6B7280',
                      cursor: 'pointer', fontSize: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.12s, color 0.12s',
                    }}>
                    {TAIL_ICONS[dir]}
                  </button>
                );
              })}
            </div>

            {/* No tail */}
            <button type="button"
              onClick={() => onBubbleChange({ tailDir: 'none' })}
              style={{
                marginTop: 8, width: '100%', height: 32,
                borderRadius: 6,
                border: selectedBubble.tailDir === 'none'
                  ? `2px dashed ${primaryColor}`
                  : '1.5px dashed #D1D5DB',
                background: selectedBubble.tailDir === 'none' ? 'rgba(0,88,190,0.06)' : 'transparent',
                color: selectedBubble.tailDir === 'none' ? primaryColor : '#6B7280',
                cursor: 'pointer', fontSize: 12, fontWeight: selectedBubble.tailDir === 'none' ? 600 : 400,
              }}>
              ○ No tail
            </button>
          </div>
        )}
      </div>

      {/* Save status */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--color-outline)', marginTop: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 38,
      }}>
        {saveStatus === 'idle' && (
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>✓ All changes saved</span>
        )}
        {saveStatus === 'unsaved' && (
          <span style={{ fontSize: 11, color: '#F59E0B' }}>● Unsaved · <kbd style={{ fontFamily: 'inherit', opacity: 0.7 }}>Ctrl+S</kbd> to save</span>
        )}
        {saveStatus === 'saving' && (
          <span style={{ fontSize: 11, color: '#6B7280' }}>Saving...</span>
        )}
        {saveStatus === 'saved' && (
          <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>✓ Saved</span>
        )}
        {saveStatus === 'error' && (
          <>
            <span style={{ fontSize: 11, color: '#EF4444' }}>⚠ Save failed</span>
            <button type="button" onClick={onRetrySave}
              style={{
                fontSize: 11, color: '#EF4444', fontWeight: 600,
                border: 'none', background: 'none', cursor: 'pointer',
                textDecoration: 'underline', padding: 0,
              }}>
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface CtxMenuProps {
  x: number; y: number;
  isCrossPanel: boolean;
  onBringFront: () => void;
  onSendBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ContextMenu({ x, y, isCrossPanel, onBringFront, onSendBack, onDuplicate, onDelete, onClose }: CtxMenuProps) {
  // Use a backdrop div instead of document mousedown listener.
  // The document listener fires before click, causing a re-render that clears contextMenu
  // before handleContextMenuAction can read it. The backdrop approach avoids this: the menu
  // div's onMouseDown stops propagation so the backdrop never fires on item clicks.
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onMouseDown={() => onClose()} />
      <div
        style={{
          position: 'fixed', left: x, top: y, zIndex: 200,
          background: 'white', border: '1px solid var(--color-outline)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          minWidth: 160, padding: '4px 0',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {[
          {
            label: isCrossPanel ? 'Send to Back' : 'Bring to Front',
            icon: isCrossPanel ? 'flip_to_back' : 'flip_to_front',
            action: isCrossPanel ? onSendBack : onBringFront,
            danger: false,
          },
          { label: 'Duplicate', icon: 'content_copy', action: onDuplicate, danger: false },
          null,
          { label: 'Delete', icon: 'delete', action: onDelete, danger: true },
        ].map((item, i) => {
          if (!item) return <div key={i} style={{ height: 1, background: 'var(--color-outline)', margin: '3px 0' }} />;
          return (
            <button key={item.label} type="button"
              onClick={() => { item.action(); onClose(); }}
              style={{
                width: '100%', padding: '7px 14px', border: 'none', background: 'none',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: item.danger ? '#ef4444' : 'var(--color-on-surface)',
                cursor: 'pointer', textAlign: 'left',
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Main DialogueEditor component ─────────────────────────────────────────────

export default function DialogueEditor({
  panelsByPage, panelStates, panelBubbles, pageLayoutNames,
  onSaveBubbles, onExport, onAutoImport,
}: DialogueEditorProps) {
  const pageIds = panelsByPage.map(([n]) => n);
  const allPanels = panelsByPage.flatMap(([, ps]) => ps);

  const [currentPage, setCurrentPage] = useState<number>(pageIds[0] ?? 1);
  const [selectedBubble, setSelectedBubble] = useState<{ panelId: string; bubbleId: string } | null>(null);
  const [editingBubbleId, setEditingBubbleId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle');
  const [zoom, setZoom] = useState<number>(0.75);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ panelId: string; bubbleId: string; x: number; y: number } | null>(null);

  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const spaceDownRef = useRef(false);
  const panStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const currentPanels = useMemo(
    () => panelsByPage.find(([n]) => n === currentPage)?.[1] ?? [],
    [panelsByPage, currentPage],
  );

  const selectedBubbleObj = useMemo(() => {
    if (!selectedBubble) return null;
    return (panelBubbles[selectedBubble.panelId] ?? []).find(b => b.id === selectedBubble.bubbleId) ?? null;
  }, [selectedBubble, panelBubbles]);

  // Fit zoom on mount / page change
  useEffect(() => {
    if (!canvasAreaRef.current) return;
    const rect = canvasAreaRef.current.getBoundingClientRect();
    setZoom(computeFitZoom(rect.width - 280, rect.height));
    setPanOffset({ x: 0, y: 0 });
  }, [currentPage]);

  // Stable ref to flushSave so keyboard handler doesn't recreate on every render
  const flushSaveRef = useRef<() => void>(() => {});

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceDownRef.current = true; }
      if (e.key === 'Escape') { setSelectedBubble(null); setContextMenu(null); }
      if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        flushSaveRef.current();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBubble) {
        const focused = document.activeElement?.tagName ?? '';
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(focused)) {
          deleteBubble(selectedBubble.panelId, selectedBubble.bubbleId);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDownRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBubble]);

  // Ctrl+wheel zoom
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(z => clamp(z - e.deltaY * 0.001, 0.25, 2.0));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Tracks the latest unsaved change — flushed by interval or Ctrl+S
  const pendingSaveRef = useRef<{ panelId: string; bubbles: PanelBubbles } | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = useCallback(() => {
    if (!pendingSaveRef.current) return;
    const { panelId, bubbles } = pendingSaveRef.current;
    pendingSaveRef.current = null;
    setSaveStatus('saving');
    try {
      onSaveBubbles(panelId, bubbles);
      setSaveStatus('saved');
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [onSaveBubbles]);

  // Apply change immediately (so bubbles stay at new position), mark for persistence via Ctrl+S/30s
  const triggerSave = useCallback((panelId: string, bubbles: PanelBubbles) => {
    onSaveBubbles(panelId, bubbles);   // update parent state now — no snap-back
    pendingSaveRef.current = { panelId, bubbles };
    setSaveStatus('unsaved');
  }, [onSaveBubbles]);

  const retrySave = useCallback(() => {
    flushSave();
  }, [flushSave]);

  // Keep ref in sync so keyboard handler (registered before flushSave) can call it
  useEffect(() => { flushSaveRef.current = flushSave; }, [flushSave]);

  // 30-second auto-save interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingSaveRef.current) flushSave();
    }, 30_000);
    return () => clearInterval(interval);
  }, [flushSave]);

  // Navigate page — flush any pending save first
  const navigatePage = useCallback((targetPage: number) => {
    if (pendingSaveRef.current) flushSave();
    setCurrentPage(targetPage);
    setSelectedBubble(null);
  }, [flushSave]);

  const addBubble = useCallback((panelId: string, normX: number, normY: number, bubbleType: BubbleType = 'speech') => {
    const existing = panelBubbles[panelId] ?? [];
    const maxZ = existing.length ? Math.max(...existing.map(b => b.zIndex)) : 0;
    const newBubble: SingleBubble = {
      id: genId(),
      dialogue: null,
      bubbleType,
      tailDir: tailDirForType(bubbleType, 'down-left'),
      bubblePosition: { x: normX, y: normY },
      bubbleSize: { w: 160, h: 80 },
      fontSize: BUBBLE_TYPE_DEFAULTS[bubbleType].fontSize,
      rotation: 0,
      opacity: 1,
      zIndex: maxZ + 1,
    };
    const updated = [...existing, newBubble];
    triggerSave(panelId, updated);
    setSelectedBubble({ panelId, bubbleId: newBubble.id });
    setEditingBubbleId(newBubble.id);
  }, [panelBubbles, triggerSave]);

  // Update + save — called on drag end and sidebar changes
  const updateBubble = useCallback((panelId: string, bubbleId: string, patch: Partial<SingleBubble>) => {
    const existing = panelBubbles[panelId] ?? [];
    const updated = existing.map(b => b.id === bubbleId ? { ...b, ...patch } : b);
    triggerSave(panelId, updated);
  }, [panelBubbles, triggerSave]);

  const deleteBubble = useCallback((panelId: string, bubbleId: string) => {
    const existing = panelBubbles[panelId] ?? [];
    const updated = existing.filter(b => b.id !== bubbleId);
    triggerSave(panelId, updated);
    setSelectedBubble(null);
  }, [panelBubbles, triggerSave]);

  const handleBubbleChange = useCallback((patch: Partial<SingleBubble>) => {
    if (!selectedBubble) return;
    updateBubble(selectedBubble.panelId, selectedBubble.bubbleId, patch);
  }, [selectedBubble, updateBubble]);

  const handleContextMenuAction = useCallback((action: 'front' | 'back' | 'dup' | 'del') => {
    if (!contextMenu) return;
    const { panelId, bubbleId } = contextMenu;
    const existing = panelBubbles[panelId] ?? [];
    const bubble = existing.find(b => b.id === bubbleId);
    console.log('[ctx]', action, { panelId, bubbleId, found: !!bubble, existingLen: existing.length, panelKeys: Object.keys(panelBubbles) });
    if (!bubble) return;

    if (action === 'front') {
      // Mark cross-panel: bubble stays in its panel array, page overlay renders it
      updateBubble(panelId, bubbleId, { crossPanel: true });
      return;
    }
    if (action === 'back') {
      updateBubble(panelId, bubbleId, { crossPanel: false });
      return;
    }
    if (action === 'del') { deleteBubble(panelId, bubbleId); return; }
    if (action === 'dup') {
      const maxZ = Math.max(...existing.map(b => b.zIndex));
      const newBubble: SingleBubble = {
        ...bubble,
        id: genId(),
        crossPanel: false,
        bubblePosition: { x: clamp(bubble.bubblePosition.x + 0.05, 0, 0.95), y: clamp(bubble.bubblePosition.y + 0.05, 0, 0.95) },
        zIndex: maxZ + 1,
      };
      triggerSave(panelId, [...existing, newBubble]);
      setSelectedBubble({ panelId, bubbleId: newBubble.id });
    }
  }, [contextMenu, panelBubbles, updateBubble, deleteBubble, triggerSave]);

  // Single canonical definition: panel has dialogue when it has ≥1 bubble with non-empty, non-NONE text
  const panelHasDialogue = (panelId: string) => {
    const bs = panelBubbles[panelId] ?? [];
    return bs.length > 0 && bs.some(b => !isNoneText(b.dialogue));
  };

  const filledCount = allPanels.filter(p => panelHasDialogue(p.id)).length;

  const currentPageIdx = pageIds.indexOf(currentPage);
  const layoutName = pageLayoutNames[currentPage] ?? 'stacked';
  const layoutRows = LAYOUT_ROW_STRUCTURES[layoutName] ?? [[0]];

  // Page dot color: green=all done, orange=partial, gray=none
  const pageDotColor = (pageNum: number): string => {
    const panels = panelsByPage.find(([n]) => n === pageNum)?.[1] ?? [];
    const filled = panels.filter(p => panelHasDialogue(p.id)).length;
    if (filled === panels.length && panels.length > 0) return '#1D9E75';
    if (filled > 0) return '#F59E0B';
    return 'var(--color-outline)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid var(--color-outline)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary)' }}>chat_bubble</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>Dialogue Editor</span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600,
            background: filledCount === allPanels.length ? '#E1F5EE' : 'rgba(0,88,190,0.08)',
            color: filledCount === allPanels.length ? '#085041' : 'var(--color-primary)',
          }}>
            {filledCount}/{allPanels.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={onAutoImport}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              borderRadius: 20, border: '1px solid var(--color-primary)',
              background: 'rgba(0,88,190,0.05)', color: 'var(--color-primary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>
            Auto-import
          </button>
          <button type="button" onClick={onExport}
            style={{
              padding: '5px 14px', borderRadius: 20, border: 'none',
              background: 'var(--color-primary)', color: 'white',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
            Go to Export →
          </button>
        </div>
      </div>

      {/* Page navigation bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', borderBottom: '1px solid var(--color-outline)', flexShrink: 0,
        background: 'var(--color-surface-container-lowest)',
      }}>
        <button type="button"
          onClick={() => { const idx = currentPageIdx - 1; if (idx >= 0) navigatePage(pageIds[idx]); }}
          disabled={currentPageIdx <= 0}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-outline)', background: 'none', cursor: currentPageIdx > 0 ? 'pointer' : 'default', opacity: currentPageIdx > 0 ? 1 : 0.35, fontSize: 12, color: 'var(--color-on-surface)' }}>
          ← Page
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface)' }}>
            {`Page ${currentPage} of ${pageIds.length}`}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {pageIds.map(n => (
                <button key={n} type="button" onClick={() => navigatePage(n)}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', border: 'none',
                    background: n === currentPage ? 'var(--color-primary)' : pageDotColor(n),
                    cursor: 'pointer', padding: 0,
                    transform: n === currentPage ? 'scale(1.4)' : 'scale(1)',
                    transition: 'transform 0.15s',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
              <span><span style={{ color: '#1D9E75' }}>●</span> All done</span>
              <span><span style={{ color: '#F59E0B' }}>◐</span> Partial</span>
              <span><span style={{ color: 'var(--color-outline)' }}>○</span> None</span>
            </div>
          </div>
        </div>

        <button type="button"
          onClick={() => { const idx = currentPageIdx + 1; if (idx < pageIds.length) navigatePage(pageIds[idx]); }}
          disabled={currentPageIdx >= pageIds.length - 1}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-outline)', background: 'none', cursor: currentPageIdx < pageIds.length - 1 ? 'pointer' : 'default', opacity: currentPageIdx < pageIds.length - 1 ? 1 : 0.35, fontSize: 12, color: 'var(--color-on-surface)' }}>
          Page →
        </button>
      </div>

      {/* Canvas area + sidebar */}
      <div ref={canvasAreaRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Canvas viewport */}
        <div style={{
          flex: 1, overflow: 'hidden', position: 'relative',
          background: '#E8E8E8',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: 24,
        }}
          onMouseDown={(e) => {
            if (!spaceDownRef.current) return;
            e.preventDefault();
            panStartRef.current = { mx: e.clientX, my: e.clientY, ox: panOffset.x, oy: panOffset.y };
          }}
          onMouseMove={(e) => {
            if (!panStartRef.current) return;
            setPanOffset({
              x: panStartRef.current.ox + e.clientX - panStartRef.current.mx,
              y: panStartRef.current.oy + e.clientY - panStartRef.current.my,
            });
          }}
          onMouseUp={() => { panStartRef.current = null; }}
        >
          {/* Transformed page container */}
          <div style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: 'top center',
            flexShrink: 0,
          }}>
            {/* Page (white comic page with panel grid) */}
            <div style={{ position: 'relative' }}>
              <div style={buildGridStyle(layoutRows)}>
              {currentPanels.map((panel, idx) => (
                <PanelCell
                  key={panel.id}
                  panel={panel}
                  panelIndex={idx}
                  imageUrl={panelStates[panel.id]?.imageUrl ?? null}
                  bubbles={panelBubbles[panel.id] ?? []}
                  layoutRows={layoutRows}
                  selectedBubbleId={selectedBubble?.panelId === panel.id ? selectedBubble.bubbleId : null}
                  editingBubbleId={selectedBubble?.panelId === panel.id ? editingBubbleId : null}
                  zoom={zoom}
                  onBubbleSelect={(pId, bId) => { setSelectedBubble({ panelId: pId, bubbleId: bId }); setEditingBubbleId(null); }}
                  onBubbleDeselect={() => { setSelectedBubble(null); setEditingBubbleId(null); }}
                  onBubbleAdd={addBubble}
                  onBubbleUpdate={updateBubble}
                  onDragCommit={flushSave}
                  onContextMenu={(pId, bId, x, y) => { setContextMenu({ panelId: pId, bubbleId: bId, x, y }); }}
                  onEditStart={(_, bId) => setEditingBubbleId(bId)}
                  onEditEnd={() => setEditingBubbleId(null)}
                />
              ))}
              </div>
              {/* Cross-panel bubble overlay — sits above all panels */}
              <PageBubbleLayer
                panels={currentPanels}
                panelBubbles={panelBubbles}
                selectedBubble={selectedBubble}
                zoom={zoom}
                onBubbleSelect={(pId, bId) => setSelectedBubble({ panelId: pId, bubbleId: bId })}
                onBubbleDeselect={() => setSelectedBubble(null)}
                onBubbleUpdate={updateBubble}
                onDragCommit={flushSave}
                onContextMenu={(pId, bId, x, y) => setContextMenu({ panelId: pId, bubbleId: bId, x, y })}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <BubbleSidebar
          selectedBubble={selectedBubbleObj}
          selectedPanelId={selectedBubble?.panelId ?? null}
          currentPanels={currentPanels}
          panelBubbles={panelBubbles}
          saveStatus={saveStatus}
          onBubbleChange={handleBubbleChange}
          onBubbleDelete={() => selectedBubble && deleteBubble(selectedBubble.panelId, selectedBubble.bubbleId)}
          onPanelSelect={(panelId) => {
            const bs = panelBubbles[panelId];
            if (bs?.length) setSelectedBubble({ panelId, bubbleId: bs[0].id });
            else setSelectedBubble(null);
          }}
          onAutoImport={onAutoImport}
          onRetrySave={retrySave}
        />
      </div>

      {/* Zoom bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
        padding: '6px 16px', borderTop: '1px solid var(--color-outline)', flexShrink: 0,
        background: 'var(--color-surface-container-lowest)',
      }}>
        <button type="button" onClick={() => setZoom(z => clamp(z - 0.1, 0.25, 2.0))}
          style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--color-outline)', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          −
        </button>
        {ZOOM_PRESETS.map(z => (
          <button key={z} type="button" onClick={() => setZoom(z)}
            style={{
              padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: zoom === z ? 700 : 400,
              border: `1px solid ${zoom === z ? 'var(--color-primary)' : 'var(--color-outline)'}`,
              background: zoom === z ? 'rgba(0,88,190,0.08)' : 'none',
              color: zoom === z ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              cursor: 'pointer',
            }}>
            {Math.round(z * 100)}%
          </button>
        ))}
        <button type="button" onClick={() => setZoom(z => clamp(z + 0.1, 0.25, 2.0))}
          style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--color-outline)', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          +
        </button>
        <button type="button" onClick={() => {
          if (!canvasAreaRef.current) return;
          const rect = canvasAreaRef.current.getBoundingClientRect();
          setZoom(computeFitZoom(rect.width - 280, rect.height));
          setPanOffset({ x: 0, y: 0 });
        }}
          style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, border: '1px solid var(--color-outline)', background: 'none', color: 'var(--color-on-surface-variant)', cursor: 'pointer' }}>
          ⊡ Fit
        </button>
        <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', minWidth: 32 }}>
          {Math.round(zoom * 100)}%
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', marginLeft: 8 }}>
          Ctrl+scroll to zoom · Space+drag to pan
        </span>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          isCrossPanel={(panelBubbles[contextMenu.panelId] ?? []).find(b => b.id === contextMenu.bubbleId)?.crossPanel === true}
          onBringFront={() => handleContextMenuAction('front')}
          onSendBack={() => handleContextMenuAction('back')}
          onDuplicate={() => handleContextMenuAction('dup')}
          onDelete={() => handleContextMenuAction('del')}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
