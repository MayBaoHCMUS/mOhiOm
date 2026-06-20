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
  dialogueData: Record<string, DialoguePanelData>;
  onSave: (panelId: string, data: DialoguePanelData) => void;
  onExport: () => void;
  onAutoImport: () => void;
}

// ── Defaults & helpers ────────────────────────────────────────────────────────

const DEFAULT_DATA: DialoguePanelData = {
  dialogue: null,
  bubbleType: 'speech',
  tailDir: 'down-left',
  bubblePosition: { x: 0.5, y: 0.35 },
  bubbleSize: { w: 160, h: 80 },
  fontSize: 14,
};

const MIN_W = 60, MIN_H = 40;

function getDefaultData(panel: Step4Panel, data: Record<string, DialoguePanelData>): DialoguePanelData {
  return data[panel.id] ?? DEFAULT_DATA;
}

function tailDirForType(type: BubbleType, current: TailDir): TailDir {
  if (type === 'sfx' || type === 'narration' || type === 'none') return 'none';
  return current === 'none' ? 'down-left' : current;
}
function hasTailSupport(type: BubbleType) {
  return type !== 'none' && type !== 'sfx' && type !== 'narration';
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── SVG bubble rendering ──────────────────────────────────────────────────────

const PAD = 3;
const TAIL_LEN = 18;

const BCFG = {
  speech:    { fill: '#ffffff', stroke: '#111111', sw: 1.5, rx: 10, tc: '#111111', bold: false, italic: false },
  thought:   { fill: '#f7f7f2', stroke: '#555555', sw: 1.5, rx: 20, tc: '#222222', bold: false, italic: false },
  shout:     { fill: '#ffffff', stroke: '#111111', sw: 2.5, rx: 4,  tc: '#111111', bold: true,  italic: false },
  sfx:       { fill: '#111111', stroke: '#111111', sw: 1,   rx: 3,  tc: '#ffffff', bold: true,  italic: false },
  narration: { fill: '#f0f0ff', stroke: '#5050b0', sw: 1,   rx: 4,  tc: '#22224a', bold: false, italic: true  },
  none:      { fill: 'transparent', stroke: 'transparent', sw: 0, rx: 0, tc: '#000', bold: false, italic: false },
} as const;

function tailPolygon(dir: TailDir, w: number, h: number): string {
  const S = TAIL_LEN;
  const p = PAD;
  switch (dir) {
    case 'down-left':  return `${w*0.15},${h-p} ${w*0.04},${h-p+S} ${w*0.32},${h-p}`;
    case 'down':       return `${w*0.43},${h-p} ${w*0.5},${h-p+S} ${w*0.57},${h-p}`;
    case 'down-right': return `${w*0.68},${h-p} ${w*0.96},${h-p+S} ${w*0.85},${h-p}`;
    case 'up-left':    return `${w*0.15},${p} ${w*0.04},${p-S} ${w*0.32},${p}`;
    case 'up':         return `${w*0.43},${p} ${w*0.5},${p-S} ${w*0.57},${p}`;
    case 'up-right':   return `${w*0.68},${p} ${w*0.96},${p-S} ${w*0.85},${p}`;
    case 'left':       return `${p},${h*0.38} ${p-S},${h*0.5} ${p},${h*0.62}`;
    case 'right':      return `${w-p},${h*0.38} ${w-p+S},${h*0.5} ${w-p},${h*0.62}`;
    case 'none':       return '';
  }
}

function thoughtCircles(dir: TailDir, w: number, h: number) {
  const p = PAD;
  let ax = 0, ay = 0, vx = 0, vy = 0;
  switch (dir) {
    case 'down-left':  ax=w*0.2; ay=h-p; vx=-0.6; vy=0.8;  break;
    case 'down':       ax=w*0.5; ay=h-p; vx=0;    vy=1;     break;
    case 'down-right': ax=w*0.8; ay=h-p; vx=0.6;  vy=0.8;  break;
    case 'up-left':    ax=w*0.2; ay=p;   vx=-0.6; vy=-0.8; break;
    case 'up':         ax=w*0.5; ay=p;   vx=0;    vy=-1;    break;
    case 'up-right':   ax=w*0.8; ay=p;   vx=0.6;  vy=-0.8; break;
    case 'left':       ax=p;     ay=h*0.5; vx=-1; vy=0;     break;
    case 'right':      ax=w-p;   ay=h*0.5; vx=1;  vy=0;     break;
    default: return [];
  }
  const len = Math.sqrt(vx*vx + vy*vy);
  vx /= len; vy /= len;
  return [
    { cx: ax + vx * 6,  cy: ay + vy * 6,  r: 4.5 },
    { cx: ax + vx * 13, cy: ay + vy * 13, r: 3   },
    { cx: ax + vx * 19, cy: ay + vy * 19, r: 1.8 },
  ];
}

function BubbleSVG({
  text, type, tailDir, fontSize, w, h,
}: { text: string; type: BubbleType; tailDir: TailDir; fontSize: number; w: number; h: number }) {
  if (type === 'none') return null;

  const cfg = BCFG[type];
  const showTail = tailDir !== 'none' && hasTailSupport(type);
  const bodyX = PAD, bodyY = PAD;
  const bodyW = w - PAD * 2, bodyH = h - PAD * 2;

  return (
    <svg
      width={w} height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
    >
      {/* Bubble body */}
      <rect
        x={bodyX} y={bodyY} width={bodyW} height={bodyH}
        rx={cfg.rx}
        fill={cfg.fill} stroke={cfg.stroke} strokeWidth={cfg.sw}
      />

      {/* Shout extra outline ring */}
      {type === 'shout' && (
        <rect
          x={bodyX - 3} y={bodyY - 3} width={bodyW + 6} height={bodyH + 6}
          rx={cfg.rx + 2}
          fill="none" stroke={cfg.stroke} strokeWidth={0.8}
        />
      )}

      {/* Speech/shout tail */}
      {showTail && type !== 'thought' && (
        <polygon
          points={tailPolygon(tailDir, w, h)}
          fill={cfg.fill} stroke={cfg.stroke} strokeWidth={cfg.sw}
          strokeLinejoin="round"
        />
      )}

      {/* Thought tail circles */}
      {showTail && type === 'thought' && thoughtCircles(tailDir, w, h).map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r}
          fill={cfg.fill} stroke={cfg.stroke} strokeWidth={cfg.sw} />
      ))}

      {/* Text via foreignObject for proper wrapping */}
      <foreignObject x={bodyX + 6} y={bodyY + 4} width={bodyW - 12} height={bodyH - 8}>
        <div
          style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: `${fontSize}px`,
            fontWeight: cfg.bold ? 800 : 500,
            fontStyle: cfg.italic ? 'italic' : 'normal',
            color: cfg.tc,
            lineHeight: 1.3,
            textAlign: 'center',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            letterSpacing: type === 'sfx' ? '0.06em' : undefined,
            userSelect: 'none',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {text || '…'}
        </div>
      </foreignObject>
    </svg>
  );
}

// ── Drag / resize handles on the image canvas ─────────────────────────────────

type HandleId = 'tl' | 'tm' | 'tr' | 'ml' | 'mr' | 'bl' | 'bm' | 'br';
type DragType = 'move' | HandleId;

const HANDLES: Array<{ id: HandleId; style: React.CSSProperties; cursor: string }> = [
  { id: 'tl', cursor: 'nwse-resize', style: { top: -5,   left:  -5  } },
  { id: 'tm', cursor: 'ns-resize',   style: { top: -5,   left:  '50%', transform: 'translateX(-50%)' } },
  { id: 'tr', cursor: 'nesw-resize', style: { top: -5,   right: -5  } },
  { id: 'ml', cursor: 'ew-resize',   style: { top: '50%', left:  -5, transform: 'translateY(-50%)' } },
  { id: 'mr', cursor: 'ew-resize',   style: { top: '50%', right: -5, transform: 'translateY(-50%)' } },
  { id: 'bl', cursor: 'nesw-resize', style: { bottom: -5, left:  -5  } },
  { id: 'bm', cursor: 'ns-resize',   style: { bottom: -5, left:  '50%', transform: 'translateX(-50%)' } },
  { id: 'br', cursor: 'nwse-resize', style: { bottom: -5, right: -5  } },
];

function applyResize(
  handle: HandleId, dx: number, dy: number,
  startCX: number, startCY: number, startW: number, startH: number,
): { cx: number; cy: number; w: number; h: number } {
  const r = startCX + startW / 2, l = startCX - startW / 2;
  const b = startCY + startH / 2, t = startCY - startH / 2;
  let w = startW, h = startH, cx = startCX, cy = startCY;

  switch (handle) {
    case 'br': w = Math.max(MIN_W, startW+dx); h = Math.max(MIN_H, startH+dy); cx=l+w/2; cy=t+h/2; break;
    case 'tl': w = Math.max(MIN_W, startW-dx); h = Math.max(MIN_H, startH-dy); cx=r-w/2; cy=b-h/2; break;
    case 'tr': w = Math.max(MIN_W, startW+dx); h = Math.max(MIN_H, startH-dy); cx=l+w/2; cy=b-h/2; break;
    case 'bl': w = Math.max(MIN_W, startW-dx); h = Math.max(MIN_H, startH+dy); cx=r-w/2; cy=t+h/2; break;
    case 'bm': h = Math.max(MIN_H, startH+dy); cy=t+h/2; break;
    case 'tm': h = Math.max(MIN_H, startH-dy); cy=b-h/2; break;
    case 'mr': w = Math.max(MIN_W, startW+dx); cx=l+w/2; break;
    case 'ml': w = Math.max(MIN_W, startW-dx); cx=r-w/2; break;
  }
  return { cx, cy, w, h };
}

interface ImageCanvasProps {
  imageUrl: string | null;
  text: string;
  type: BubbleType;
  tailDir: TailDir;
  fontSize: number;
  position: BubblePosition;
  size: BubbleSize;
  onPositionChange: (p: BubblePosition) => void;
  onSizeChange: (s: BubbleSize) => void;
}

function ImageCanvas({
  imageUrl, text, type, tailDir, fontSize,
  position, size, onPositionChange, onSizeChange,
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ref-based drag state to avoid stale closures
  const dragRef = useRef<{
    type: DragType;
    startMX: number; startMY: number;
    startCX: number; startCY: number; // bubble center in px
    startW: number;  startH: number;
    canvasW: number; canvasH: number;
  } | null>(null);

  const posRef = useRef(position);
  posRef.current = position;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const onPosRef = useRef(onPositionChange);
  onPosRef.current = onPositionChange;
  const onSzRef = useRef(onSizeChange);
  onSzRef.current = onSizeChange;

  const [isDragging, setIsDragging] = useState(false);
  const [dragCursor, setDragCursor] = useState('grab');

  const startDrag = useCallback((e: React.MouseEvent, dtype: DragType) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const p = posRef.current;
    const s = sizeRef.current;
    dragRef.current = {
      type: dtype,
      startMX: e.clientX, startMY: e.clientY,
      startCX: p.x * rect.width,
      startCY: p.y * rect.height,
      startW: s.w, startH: s.h,
      canvasW: rect.width, canvasH: rect.height,
    };
    setIsDragging(true);
    setDragCursor(dtype === 'move' ? 'grabbing' : (HANDLES.find(h => h.id === dtype)?.cursor ?? 'nwse-resize'));
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startMX;
      const dy = e.clientY - d.startMY;

      if (d.type === 'move') {
        const newCX = clamp(d.startCX + dx, 0, d.canvasW);
        const newCY = clamp(d.startCY + dy, 0, d.canvasH);
        onPosRef.current({ x: newCX / d.canvasW, y: newCY / d.canvasH });
      } else {
        const { cx, cy, w, h } = applyResize(
          d.type as HandleId, dx, dy,
          d.startCX, d.startCY, d.startW, d.startH,
        );
        onPosRef.current({
          x: clamp(cx / d.canvasW, 0, 1),
          y: clamp(cy / d.canvasH, 0, 1),
        });
        onSzRef.current({ w, h });
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      setDragCursor('grab');
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // Re-render on container resize
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => forceUpdate(n => n + 1));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const canvasW = containerRef.current?.clientWidth ?? 400;
  const left = position.x * canvasW - size.w / 2;
  const top  = position.y * 280 - size.h / 2;
  const showBubble = type !== 'none';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: 280,
        background: '#000',
        borderRadius: 10,
        overflow: 'hidden',
        flexShrink: 0,
        touchAction: 'none',
        userSelect: 'none',
        cursor: showBubble && !isDragging ? 'default' : 'default',
      }}
    >
      {/* Panel image */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
          draggable={false}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined text-4xl" style={{ color: 'rgba(255,255,255,0.2)' }}>crop_original</span>
        </div>
      )}

      {/* Bubble widget */}
      {showBubble && (
        <div
          style={{
            position: 'absolute',
            left: left,
            top: top,
            width: size.w,
            height: size.h,
            cursor: dragCursor,
            zIndex: 10,
          }}
          onMouseDown={(e) => startDrag(e, 'move')}
        >
          {/* SVG bubble (overflows for tail) */}
          <BubbleSVG
            text={text} type={type} tailDir={tailDir} fontSize={fontSize}
            w={size.w} h={size.h}
          />

          {/* Dashed bounding box */}
          <div style={{
            position: 'absolute', inset: -2,
            border: '1.5px dashed rgba(110,140,255,0.75)',
            borderRadius: 3,
            pointerEvents: 'none',
          }} />

          {/* 8 resize handles */}
          {HANDLES.map((h) => (
            <div
              key={h.id}
              onMouseDown={(e) => startDrag(e, h.id)}
              style={{
                position: 'absolute',
                width: 9, height: 9,
                background: '#7B9BF0',
                border: '1.5px solid #fff',
                borderRadius: 2,
                zIndex: 20,
                cursor: h.cursor,
                ...h.style,
              }}
            />
          ))}
        </div>
      )}

      {/* Hint text */}
      {showBubble && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '6px 0 4px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>
            Drag to move · Drag corners to resize
          </span>
        </div>
      )}
    </div>
  );
}

// ── BubblePill ────────────────────────────────────────────────────────────────

const PILL_STYLES: Record<BubbleType, { bg: string; text: string; label: string }> = {
  speech:    { bg: '#E1F5EE', text: '#085041', label: 'Speech'    },
  thought:   { bg: '#EEEDFE', text: '#26215C', label: 'Thought'   },
  shout:     { bg: '#FAECE7', text: '#712B13', label: 'Shout'     },
  sfx:       { bg: '#2C2C2A', text: '#F1EFE8', label: 'SFX'       },
  narration: { bg: '#E6F1FB', text: '#042C53', label: 'Narration' },
  none:      { bg: '#F3F4F6', text: '#6B7280', label: 'None'      },
};

function BubblePill({ type }: { type: BubbleType }) {
  const s = PILL_STYLES[type];
  return (
    <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

// ── Type grid ─────────────────────────────────────────────────────────────────

const TYPE_OPTS: { type: BubbleType; label: string; icon: string }[] = [
  { type: 'speech',    label: 'Speech',    icon: 'chat_bubble' },
  { type: 'thought',   label: 'Thought',   icon: 'cloud'       },
  { type: 'shout',     label: 'Shout',     icon: 'campaign'    },
  { type: 'sfx',       label: 'SFX',       icon: 'music_note'  },
  { type: 'narration', label: 'Narration', icon: 'menu_book'   },
  { type: 'none',      label: 'None',      icon: 'block'       },
];

function TypeGrid({ selected, onChange }: { selected: BubbleType; onChange: (t: BubbleType) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {TYPE_OPTS.map(({ type, label, icon }) => {
        const active = selected === type;
        return (
          <button key={type} type="button" onClick={() => onChange(type)}
            className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[11px] font-medium transition-all"
            style={{
              border: active ? '1.5px solid var(--color-primary)' : '0.5px solid var(--color-outline)',
              background: active ? 'rgba(0,88,190,0.06)' : 'transparent',
              color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
            }}>
            <span className="material-symbols-outlined text-base">{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Compass tail grid ─────────────────────────────────────────────────────────

const COMPASS: (TailDir | null)[][] = [
  ['up-left', 'up', 'up-right'],
  ['left', null, 'right'],
  ['down-left', 'down', 'down-right'],
];
const COMPASS_ARROWS: Record<TailDir, string> = {
  'up-left': '↖', 'up': '↑', 'up-right': '↗',
  'left': '←', 'right': '→',
  'down-left': '↙', 'down': '↓', 'down-right': '↘', 'none': '−',
};

function CompassGrid({ selected, onChange }: { selected: TailDir; onChange: (d: TailDir) => void }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: 'var(--color-on-surface-variant)' }}>
        Tail direction
      </p>
      <div className="flex items-center gap-3">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gap: 3 }}>
          {COMPASS.flat().map((dir, i) => {
            if (dir === null) {
              return (
                <div key="center"
                  className="flex items-center justify-center rounded text-base"
                  style={{ width: 28, height: 28, background: 'var(--color-surface-container)',
                    border: '0.5px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                  ·
                </div>
              );
            }
            const active = selected === dir;
            return (
              <button key={`${dir}-${i}`} type="button" onClick={() => onChange(dir)}
                className="flex items-center justify-center rounded font-bold transition-all"
                style={{
                  width: 28, height: 28, fontSize: 14,
                  border: active ? '1.5px solid var(--color-primary)' : '0.5px solid var(--color-outline)',
                  background: active ? 'rgba(0,88,190,0.1)' : 'transparent',
                  color: active ? 'var(--color-primary)' : 'var(--color-on-surface)',
                }}>
                {COMPASS_ARROWS[dir]}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => onChange('none')}
          className="flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-lg text-[11px] font-medium transition-all"
          style={{
            border: selected === 'none' ? '1.5px solid var(--color-primary)' : '0.5px solid var(--color-outline)',
            background: selected === 'none' ? 'rgba(0,88,190,0.08)' : 'transparent',
            color: selected === 'none' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          }}>
          <span className="material-symbols-outlined text-sm">remove</span>
          No tail
        </button>
      </div>
    </div>
  );
}

// ── Editor Pane ───────────────────────────────────────────────────────────────

interface EditorPaneProps {
  panel: Step4Panel;
  imageUrl: string | null;
  editState: DialoguePanelData;
  saveStatus: 'idle' | 'saved';
  hasPrev: boolean;
  hasNext: boolean;
  onTypeChange: (t: BubbleType) => void;
  onTailChange: (d: TailDir) => void;
  onDialogueChange: (v: string) => void;
  onPositionChange: (p: BubblePosition) => void;
  onSizeChange: (s: BubbleSize) => void;
  onFontSizeChange: (n: number) => void;
  onSave: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function EditorPane({
  panel, imageUrl, editState, saveStatus,
  hasPrev, hasNext,
  onTypeChange, onTailChange, onDialogueChange,
  onPositionChange, onSizeChange, onFontSizeChange,
  onSave, onPrev, onNext,
}: EditorPaneProps) {
  const text = editState.dialogue ?? '';

  return (
    <div className="flex flex-col overflow-y-auto"
      style={{ background: 'var(--color-surface-container-low)', borderLeft: '0.5px solid var(--color-outline)', flex: 1, minHeight: 0 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-outline)' }}>
        <p className="text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>
          Pg.{panel.pageNumber} · Panel {panel.panelNumber}
        </p>
        <div className="flex items-center gap-1.5">
          <button type="button" disabled={!hasPrev} onClick={onPrev}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity disabled:opacity-30"
            style={{ border: '0.5px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
            ← Prev
          </button>
          <button type="button" disabled={!hasNext} onClick={onNext}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity disabled:opacity-30"
            style={{ border: '0.5px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
            Next →
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
        {/* Image canvas with draggable bubble */}
        <ImageCanvas
          imageUrl={imageUrl}
          text={text}
          type={editState.bubbleType}
          tailDir={editState.tailDir}
          fontSize={editState.fontSize}
          position={editState.bubblePosition}
          size={editState.bubbleSize}
          onPositionChange={onPositionChange}
          onSizeChange={onSizeChange}
        />

        {/* Dialogue textarea + font size */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--color-on-surface-variant)' }}>
            Dialogue text
          </p>
          <textarea
            value={text}
            onChange={(e) => onDialogueChange(e.target.value)}
            placeholder="Enter dialogue, SFX, or narration…"
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 resize-none outline-none transition-all"
            style={{
              background: 'var(--color-surface-container-lowest)',
              border: '0.5px solid var(--color-outline)',
              color: 'var(--color-on-surface)',
              fontSize: 13,
            }}
          />
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] font-medium flex-shrink-0"
              style={{ color: 'var(--color-on-surface-variant)' }}>
              Font size
            </span>
            <input type="range" min={10} max={22} step={1}
              value={editState.fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              className="flex-1 h-1 accent-blue-600" />
            <span className="text-[11px] font-semibold w-8 text-right flex-shrink-0"
              style={{ color: 'var(--color-on-surface)' }}>
              {editState.fontSize}px
            </span>
          </div>
        </div>

        {/* Bubble type */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--color-on-surface-variant)' }}>
            Bubble type
          </p>
          <TypeGrid selected={editState.bubbleType} onChange={onTypeChange} />
        </div>

        {/* Tail direction */}
        {hasTailSupport(editState.bubbleType) && (
          <CompassGrid selected={editState.tailDir} onChange={onTailChange} />
        )}

        {/* Save */}
        <button type="button" onClick={onSave}
          className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: saveStatus === 'saved' ? '#1D9E75' : 'var(--color-primary)' }}>
          {saveStatus === 'saved' ? 'Saved ✓' : 'Save panel'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DialogueEditor({
  panelsByPage, panelStates, dialogueData, onSave, onExport, onAutoImport,
}: DialogueEditorProps) {
  const allPanels = panelsByPage.flatMap(([, ps]) => ps);
  const pageIds   = panelsByPage.map(([n]) => n);

  const [currentPage,    setCurrentPage]    = useState<number>(pageIds[0] ?? 1);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [editState,      setEditState]      = useState<DialoguePanelData>(DEFAULT_DATA);
  const [saveStatus,     setSaveStatus]     = useState<'idle' | 'saved'>('idle');

  const currentPanels = useMemo(
    () => panelsByPage.find(([n]) => n === currentPage)?.[1] ?? [],
    [panelsByPage, currentPage],
  );
  const selectedPanel = currentPanels.find((p) => p.id === selectedPanelId) ?? null;

  const filledCount = allPanels.filter((p) => {
    const d = dialogueData[p.id];
    return d?.dialogue && d.dialogue.trim().length > 0;
  }).length;

  const savePanel = useCallback((id: string, data: DialoguePanelData) => {
    onSave(id, { ...data, dialogue: data.dialogue?.trim() || null });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1200);
  }, [onSave]);

  const selectPanel = useCallback((panelId: string) => {
    if (selectedPanelId && selectedPanelId !== panelId) {
      onSave(selectedPanelId, { ...editState, dialogue: editState.dialogue?.trim() || null });
    }
    const panel = allPanels.find((p) => p.id === panelId);
    if (!panel) return;
    setSelectedPanelId(panelId);
    setEditState(getDefaultData(panel, dialogueData));
    setSaveStatus('idle');
  }, [selectedPanelId, editState, allPanels, dialogueData, onSave]);

  const clearDialogue = useCallback((panelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleared: DialoguePanelData = { ...DEFAULT_DATA, dialogue: null, bubbleType: 'none' };
    onSave(panelId, cleared);
    if (panelId === selectedPanelId) setEditState(cleared);
  }, [onSave, selectedPanelId]);

  const navPanel = useCallback((dir: 1 | -1) => {
    if (!selectedPanelId) return;
    const idx = currentPanels.findIndex((p) => p.id === selectedPanelId);
    if (idx === -1) return;
    onSave(selectedPanelId, { ...editState, dialogue: editState.dialogue?.trim() || null });
    const next = currentPanels[idx + dir];
    if (!next) return;
    setSelectedPanelId(next.id);
    setEditState(getDefaultData(next, dialogueData));
    setSaveStatus('idle');
  }, [selectedPanelId, currentPanels, editState, dialogueData, onSave]);

  const handleTypeChange = useCallback((t: BubbleType) => {
    setEditState((prev) => ({ ...prev, bubbleType: t, tailDir: tailDirForType(t, prev.tailDir) }));
  }, []);

  const selectedIdx = selectedPanelId ? currentPanels.findIndex((p) => p.id === selectedPanelId) : -1;

  return (
    <div className="flex flex-col" style={{ height: 620 }}>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-outline)' }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-primary)' }}>chat_bubble</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>Dialogue editor</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: filledCount === allPanels.length ? '#E1F5EE' : 'rgba(0,88,190,0.08)',
              color: filledCount === allPanels.length ? '#085041' : 'var(--color-primary)',
            }}>
            {filledCount} / {allPanels.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onAutoImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{ border: '0.5px solid var(--color-primary)', background: 'rgba(0,88,190,0.05)', color: 'var(--color-primary)' }}>
            <span className="material-symbols-outlined text-sm">bolt</span>
            Auto-import
          </button>
          <button type="button" onClick={onExport}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--color-primary)' }}>
            Go to export →
          </button>
        </div>
      </div>

      {/* Page tabs */}
      <div className="flex items-center overflow-x-auto flex-shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-outline)' }}>
        {panelsByPage.map(([pageNum, panels]) => {
          const filled = panels.filter((p) => { const d = dialogueData[p.id]; return d?.dialogue?.trim(); }).length;
          const dotColor = filled === panels.length ? '#1D9E75' : filled > 0 ? '#EF9F27' : 'var(--color-outline)';
          const active = currentPage === pageNum;
          return (
            <button key={pageNum} type="button"
              onClick={() => {
                if (selectedPanelId) onSave(selectedPanelId, { ...editState, dialogue: editState.dialogue?.trim() || null });
                setCurrentPage(pageNum);
                setSelectedPanelId(null);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
              Page {pageNum}
            </button>
          );
        })}
      </div>

      {/* Grid: panel list (35%) + editor (65%) */}
      <div className="flex-1 overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '35% 65%', minHeight: 0 }}>

        {/* Panel list */}
        <div className="overflow-y-auto" style={{ borderRight: '0.5px solid var(--color-outline)' }}>
          {currentPanels.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--color-on-surface-variant)' }}>No panels</p>
          )}
          {currentPanels.map((panel) => {
            const data = dialogueData[panel.id];
            const hasDialogue = !!(data?.dialogue?.trim());
            const isActive = panel.id === selectedPanelId;
            const imgUrl = panelStates[panel.id]?.imageUrl ?? null;
            return (
              <div key={panel.id} onClick={() => selectPanel(panel.id)}
                className="flex items-center gap-2.5 cursor-pointer"
                style={{
                  padding: '8px 10px 8px 8px',
                  borderBottom: '0.5px solid var(--color-outline)',
                  borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  background: isActive ? 'rgba(0,88,190,0.04)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-container-low)'; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                  style={{ width: 44, height: 44, background: 'var(--color-surface-container)', border: '0.5px solid var(--color-outline)' }}>
                  {imgUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    : <span className="material-symbols-outlined text-base opacity-20">crop_original</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                    Pg.{panel.pageNumber} · Panel {panel.panelNumber}
                  </p>
                  <p className="text-[11px] mt-0.5 truncate"
                    style={{ color: hasDialogue ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontStyle: hasDialogue ? 'normal' : 'italic' }}>
                    {hasDialogue ? (data?.dialogue ?? '') : 'No dialogue'}
                  </p>
                  {data?.bubbleType && data.bubbleType !== 'none' && (
                    <div className="mt-0.5"><BubblePill type={data.bubbleType} /></div>
                  )}
                </div>
                {hasDialogue && (
                  <button type="button" onClick={(e) => clearDialogue(panel.id, e)}
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs hover:opacity-60 transition-opacity"
                    style={{ color: 'var(--color-on-surface-variant)' }} title="Clear">
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Editor pane */}
        <div className="overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
          {!selectedPanel ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
              <span className="material-symbols-outlined text-4xl opacity-20">chat_bubble_outline</span>
              <p className="text-xs text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                Click a panel to edit its dialogue
              </p>
            </div>
          ) : (
            <EditorPane
              panel={selectedPanel}
              imageUrl={panelStates[selectedPanel.id]?.imageUrl ?? null}
              editState={editState}
              saveStatus={saveStatus}
              hasPrev={selectedIdx > 0}
              hasNext={selectedIdx !== -1 && selectedIdx < currentPanels.length - 1}
              onTypeChange={handleTypeChange}
              onTailChange={(d) => setEditState((p) => ({ ...p, tailDir: d }))}
              onDialogueChange={(v) => setEditState((p) => ({ ...p, dialogue: v }))}
              onPositionChange={(pos) => setEditState((p) => ({ ...p, bubblePosition: pos }))}
              onSizeChange={(s) => setEditState((p) => ({ ...p, bubbleSize: s }))}
              onFontSizeChange={(n) => setEditState((p) => ({ ...p, fontSize: n }))}
              onSave={() => savePanel(selectedPanel.id, editState)}
              onPrev={() => navPanel(-1)}
              onNext={() => navPanel(1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
