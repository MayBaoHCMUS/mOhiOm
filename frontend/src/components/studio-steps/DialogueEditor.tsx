'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Step4Panel, Step4PanelState } from '@/context/ComicGenerationContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BubbleType = 'speech' | 'thought' | 'shout' | 'sfx' | 'narration' | 'none';
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
  character?: string;
  zIndex: number;
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
  return type === 'speech' || type === 'thought' || type === 'shout';
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
};

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

function MangaBubbleSVG({ bubble, w, h, dimmed }: BubbleSVGProps) {
  const { bubbleType: type, tailDir, dialogue, fontSize, rotation } = bubble;

  if (type === 'none' || (isNoneText(dialogue) && type !== 'sfx')) return null;

  const text = dialogue ?? '';
  const fill = '#ffffff';
  const stroke = '#1a1a1a';
  const opacity = dimmed ? 0.8 : 1;
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
            fill="white"
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
  function tailPts(): string {
    if (!hasTailSupport(type) || tailDir === 'none') return '';
    const TW = 7; // half-width of tail base on body edge
    switch (tailDir) {
      case 'down-left':  return `${cx-rx*0.25-TW},${cy+ry-2} ${cx-rx*0.6},${cy+ry+TAIL} ${cx-rx*0.25+TW},${cy+ry-2}`;
      case 'down':       return `${cx-TW},${cy+ry-2} ${cx},${cy+ry+TAIL} ${cx+TW},${cy+ry-2}`;
      case 'down-right': return `${cx+rx*0.25-TW},${cy+ry-2} ${cx+rx*0.6},${cy+ry+TAIL} ${cx+rx*0.25+TW},${cy+ry-2}`;
      case 'up-left':    return `${cx-rx*0.25-TW},${cy-ry+2} ${cx-rx*0.6},${cy-ry-TAIL} ${cx-rx*0.25+TW},${cy-ry+2}`;
      case 'up':         return `${cx-TW},${cy-ry+2} ${cx},${cy-ry-TAIL} ${cx+TW},${cy-ry+2}`;
      case 'up-right':   return `${cx+rx*0.25-TW},${cy-ry+2} ${cx+rx*0.6},${cy-ry-TAIL} ${cx+rx*0.25+TW},${cy-ry+2}`;
      case 'left':       return `${cx-rx+2},${cy-TW} ${cx-rx-TAIL},${cy} ${cx-rx+2},${cy+TW}`;
      case 'right':      return `${cx+rx-2},${cy-TW} ${cx+rx+TAIL},${cy} ${cx+rx-2},${cy+TW}`;
      default:           return '';
    }
  }

  // Shout spike polygon in viewBox coords
  function shoutPts(): string {
    const spikes = 8;
    const outerRX = rx, outerRY = ry;
    const innerRX = rx * 0.82, innerRY = ry * 0.82;
    const pts: string[] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const erx = i % 2 === 0 ? outerRX : innerRX;
      const ery = i % 2 === 0 ? outerRY : innerRY;
      pts.push(`${cx + Math.cos(angle) * erx},${cy + Math.sin(angle) * ery}`);
    }
    return pts.join(' ');
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

  const tailPoints = tailPts();
  const strokeW = type === 'shout' ? 2.5 : 2;

  // Text area: inset within body shape
  const textInset = type === 'thought' ? 0.25 : type === 'narration' ? 0.06 : 0.16;
  const textW = w * (1 - textInset * 2);
  const isBangers = false;
  const lines = wrapTextToLines(text, textW, fontSize, isBangers);

  const fontFamily = "'Comic Neue', 'Comic Sans MS', cursive";
  const fontWeight = type === 'shout' ? 700 : 400;
  const fontStyle = type === 'narration' ? 'italic' : 'normal';
  const textFill = type === 'narration' ? '#22224a' : '#111111';
  const textAnchor = type === 'narration' ? 'start' as const : 'middle' as const;
  const textCX = type === 'narration' ? cx - rx + fontSize * 0.5 : cx;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w} height={h}
      style={{ overflow: 'visible', opacity, pointerEvents: 'none', display: 'block' }}
    >
      {/* ── SPEECH ── */}
      {type === 'speech' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />}
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={strokeW} />
          <SvgText lines={lines} cx={textCX} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={textFill} textAnchor={textAnchor} />
        </>
      )}

      {/* ── THOUGHT ── */}
      {type === 'thought' && (
        <>
          {hasTailSupport(type) && tailDir !== 'none' && thoughtTrail().map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={fill} stroke={stroke} strokeWidth={1.5} />
          ))}
          {/* Cloud: 5 overlapping ellipses, drawn fill-first then stroke-only pass to unify outline */}
          {[
            { ox: 0,          oy: 0,           ex: rx*0.80, ey: ry*0.80 },
            { ox: -rx*0.42,   oy: -ry*0.18,    ex: rx*0.52, ey: ry*0.60 },
            { ox:  rx*0.42,   oy: -ry*0.18,    ex: rx*0.52, ey: ry*0.60 },
            { ox: -rx*0.60,   oy:  ry*0.18,    ex: rx*0.42, ey: ry*0.48 },
            { ox:  rx*0.60,   oy:  ry*0.18,    ex: rx*0.42, ey: ry*0.48 },
          ].map((e, i) => (
            <ellipse key={i} cx={cx+e.ox} cy={cy+e.oy} rx={e.ex} ry={e.ey} fill={fill} stroke={stroke} strokeWidth={1.5} />
          ))}
          <SvgText lines={lines} cx={textCX} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={textFill} textAnchor={textAnchor} />
        </>
      )}

      {/* ── SHOUT ── */}
      {type === 'shout' && (
        <>
          {tailPoints && <polygon points={tailPoints} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />}
          <polygon points={shoutPts()} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="miter" />
          <SvgText lines={lines} cx={textCX} cy={cy} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight} fill={textFill} textAnchor={textAnchor} />
        </>
      )}

      {/* ── NARRATION ── */}
      {type === 'narration' && (
        <>
          <rect x={cx-rx} y={cy-ry} width={rx*2} height={ry*2} fill="#fffef0" stroke={stroke} strokeWidth={2} rx={0} />
          <text
            fontFamily={fontFamily}
            fontSize={fontSize}
            fontStyle={fontStyle}
            fill={textFill}
            textAnchor={textAnchor}
            style={{ userSelect: 'none' }}
          >
            {lines.map((line, i) => (
              <tspan key={i} x={textCX} y={(cy - ry) + fontSize * 1.1 + i * fontSize * 1.35}>{line}</tspan>
            ))}
          </text>
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
  zoom: number;
  onBubbleSelect: (panelId: string, bubbleId: string) => void;
  onBubbleDeselect: () => void;
  onBubbleAdd: (panelId: string, normX: number, normY: number) => void;
  onBubbleUpdate: (panelId: string, bubbleId: string, patch: Partial<SingleBubble>) => void;
  onDragCommit: () => void;
  onContextMenu: (panelId: string, bubbleId: string, x: number, y: number) => void;
}

function PanelCell({
  panel, panelIndex, imageUrl, bubbles, layoutRows,
  selectedBubbleId, zoom,
  onBubbleSelect, onBubbleDeselect, onBubbleAdd, onBubbleUpdate, onDragCommit, onContextMenu,
}: PanelCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  // Local visual override during drag — avoids parent re-renders on every frame
  const [dragOverride, setDragOverride] = useState<Partial<SingleBubble> | null>(null);

  const gridPlacement = getPanelGridPlacement(layoutRows, panelIndex);
  const sortedBubbles = [...bubbles].sort((a, b) => a.zIndex - b.zIndex);
  const selectedBubble = bubbles.find(b => b.id === selectedBubbleId) ?? null;

  // Drag state
  const dragRef = useRef<{
    handle: DragHandle;
    startMX: number; startMY: number;
    startBubble: SingleBubble;
    cellW: number; cellH: number;
    cellLeft: number; cellTop: number;
  } | null>(null);
  const isDraggingRef = useRef(false);

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
    const patch = computePatch(e);
    if (patch) setDragOverride(patch); // local state only — no parent re-render
  }, [computePatch]);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragRef.current) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    const patch = computePatch(e);
    if (patch) onBubbleUpdate(panel.id, dragRef.current.startBubble.id, patch);
    dragRef.current = null;
    isDraggingRef.current = false;
    setDragOverride(null);
    if (cellRef.current) cellRef.current.style.cursor = '';
    onDragCommit(); // flush save immediately after drag
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
        // deselect if clicking on panel background (not a bubble)
        if (e.target === cellRef.current || (e.target as HTMLElement).tagName === 'IMG') {
          onBubbleDeselect();
        }
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
              style={{ position: 'absolute', left, top, width: b.bubbleSize.w, height: b.bubbleSize.h, zIndex: b.zIndex, pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onBubbleSelect(panel.id, b.id); }}
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
            style={{ position: 'absolute', left, top, width: bw, height: bh, zIndex: selectedBubble.zIndex + 1 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
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

            {/* Move handle (top center) */}
            <div
              style={{
                position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                width: 20, height: 14,
                background: '#6366f1', borderRadius: 3,
                cursor: 'grab', zIndex: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onPointerDown={(e) => startDrag(e, 'move', displayBubble)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 10, color: 'white' }}>drag_indicator</span>
            </div>

            {/* Corner resize handles */}
            <div style={{ ...handleStyle, top: -HANDLE_SIZE/2-1, left: -HANDLE_SIZE/2-1, cursor: 'nwse-resize' }}
              onPointerDown={(e) => startDrag(e, 'tl', displayBubble)} />
            <div style={{ ...handleStyle, top: -HANDLE_SIZE/2-1, right: -HANDLE_SIZE/2-1, cursor: 'nesw-resize' }}
              onPointerDown={(e) => startDrag(e, 'tr', displayBubble)} />
            <div style={{ ...handleStyle, bottom: -HANDLE_SIZE/2-1, left: -HANDLE_SIZE/2-1, cursor: 'nesw-resize' }}
              onPointerDown={(e) => startDrag(e, 'bl', displayBubble)} />
            <div style={{ ...handleStyle, bottom: -HANDLE_SIZE/2-1, right: -HANDLE_SIZE/2-1, cursor: 'nwse-resize' }}
              onPointerDown={(e) => startDrag(e, 'br', displayBubble)} />

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
                onPointerDown={(e) => startDrag(e, 'tail', displayBubble)}
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
  { type: 'sfx',       label: 'SFX',       icon: 'electric_bolt' },
  { type: 'narration', label: 'Narration', icon: 'article' },
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

  if (!selectedBubble || !selectedPanelId) {
    return (
      <div style={{ width: 280, borderLeft: '1px solid var(--color-outline)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', background: 'var(--color-surface-container-lowest)' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-outline)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: mutedColor, marginBottom: 10 }}>
            Bubble Editor
          </p>
          <div style={{ background: 'var(--color-surface-container-low)', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: 12, color: mutedColor, lineHeight: 1.5, marginBottom: 0 }}>
              Click a bubble on the canvas to edit it, or click inside any panel to add a new speech bubble.
            </p>
          </div>
        </div>

        <div style={{ padding: '12px 14px', flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: mutedColor, marginBottom: 8 }}>
            Page Summary
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                    background: selectedPanelId === panel.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: hasBubbles ? '#1D9E75' : 'var(--color-outline)',
                  }} />
                  <span style={{ fontSize: 12, color: hasBubbles ? 'var(--color-on-surface)' : mutedColor, fontStyle: hasBubbles ? 'normal' : 'italic', flex: 1 }}>
                    Panel {panel.panelNumber}
                    {hasBubbles ? ` — ${firstType}${count > 1 ? ` ×${count}` : ''}` : ' — No dialogue'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-outline)' }}>
          <button type="button" onClick={onAutoImport}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${primaryColor}`,
              background: 'rgba(0,88,190,0.06)',
              color: primaryColor, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>
            Auto-import from script
          </button>
        </div>
      </div>
    );
  }

  // Bubble selected
  const selectedPanel = currentPanels.find(p => p.id === selectedPanelId);
  const bubbleIndex = (panelBubbles[selectedPanelId] ?? []).findIndex(b => b.id === selectedBubble.id) + 1;

  return (
    <div style={{ width: 280, borderLeft: '1px solid var(--color-outline)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', background: 'var(--color-surface-container-lowest)' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-outline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface)' }}>
          Panel {selectedPanel?.panelNumber} · Bubble {bubbleIndex}
        </span>
        <button type="button" onClick={onBubbleDelete}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}
          title="Delete bubble">
          ✕
        </button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Text */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Text</label>
          <textarea
            value={localText}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={3}
            style={{
              width: '100%', padding: '7px 9px', borderRadius: 7, resize: 'vertical', minHeight: 64,
              border: '1px solid var(--color-outline)', background: 'var(--color-surface-container-low)',
              fontSize: 13, color: 'var(--color-on-surface)', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }}
            placeholder="Enter dialogue..."
          />
        </div>

        {/* Bubble type grid */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Bubble Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {BUBBLE_TYPE_OPTIONS.map(({ type, label, icon }) => {
              const active = selectedBubble.bubbleType === type;
              return (
                <button key={type} type="button"
                  onClick={() => onBubbleChange({
                    bubbleType: type,
                    tailDir: tailDirForType(type, selectedBubble.tailDir),
                    fontSize: BUBBLE_TYPE_DEFAULTS[type].fontSize,
                  })}
                  style={{
                    padding: '7px 4px', borderRadius: 7, border: `1.5px solid ${active ? primaryColor : 'var(--color-outline)'}`,
                    background: active ? 'rgba(0,88,190,0.09)' : 'transparent',
                    color: active ? primaryColor : mutedColor,
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    fontSize: 10, fontWeight: active ? 600 : 400,
                  }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

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
  onBringFront: () => void;
  onSendBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ContextMenu({ x, y, onBringFront, onSendBack, onDuplicate, onDelete, onClose }: CtxMenuProps) {
  useEffect(() => {
    const close = () => onClose();
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  return (
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
        { label: 'Bring to Front', icon: 'flip_to_front', action: onBringFront, danger: false },
        { label: 'Send to Back',   icon: 'flip_to_back',  action: onSendBack,  danger: false },
        { label: 'Duplicate',      icon: 'content_copy',  action: onDuplicate, danger: false },
        null,
        { label: 'Delete',         icon: 'delete',        action: onDelete,    danger: true  },
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

  const addBubble = useCallback((panelId: string, normX: number, normY: number) => {
    const existing = panelBubbles[panelId] ?? [];
    const maxZ = existing.length ? Math.max(...existing.map(b => b.zIndex)) : 0;
    const newBubble: SingleBubble = {
      id: genId(),
      dialogue: null,
      bubbleType: 'speech',
      tailDir: 'down-left',
      bubblePosition: { x: normX, y: normY },
      bubbleSize: { w: 160, h: 80 },
      fontSize: BUBBLE_TYPE_DEFAULTS.speech.fontSize,
      rotation: 0,
      zIndex: maxZ + 1,
    };
    const updated = [...existing, newBubble];
    triggerSave(panelId, updated);
    setSelectedBubble({ panelId, bubbleId: newBubble.id });
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
    if (!bubble) return;

    if (action === 'del') { deleteBubble(panelId, bubbleId); return; }
    if (action === 'front') {
      const maxZ = Math.max(...existing.map(b => b.zIndex));
      const updated = existing.map(b => b.id === bubbleId ? { ...b, zIndex: maxZ + 1 } : b);
      triggerSave(panelId, updated);
    } else if (action === 'back') {
      const minZ = Math.min(...existing.map(b => b.zIndex));
      const updated = existing.map(b => b.id === bubbleId ? { ...b, zIndex: minZ - 1 } : b);
      triggerSave(panelId, updated);
    } else if (action === 'dup') {
      const maxZ = Math.max(...existing.map(b => b.zIndex));
      const newBubble: SingleBubble = {
        ...bubble,
        id: genId(),
        bubblePosition: { x: clamp(bubble.bubblePosition.x + 0.05, 0, 0.95), y: clamp(bubble.bubblePosition.y + 0.05, 0, 0.95) },
        zIndex: maxZ + 1,
      };
      triggerSave(panelId, [...existing, newBubble]);
      setSelectedBubble({ panelId, bubbleId: newBubble.id });
    }
  }, [contextMenu, panelBubbles, deleteBubble, triggerSave]);

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
                  zoom={zoom}
                  onBubbleSelect={(pId, bId) => setSelectedBubble({ panelId: pId, bubbleId: bId })}
                  onBubbleDeselect={() => setSelectedBubble(null)}
                  onBubbleAdd={addBubble}
                  onBubbleUpdate={updateBubble}
                  onDragCommit={flushSave}
                  onContextMenu={(pId, bId, x, y) => { setContextMenu({ panelId: pId, bubbleId: bId, x, y }); }}
                />
              ))}
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
