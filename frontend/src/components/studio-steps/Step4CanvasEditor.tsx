'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { Step4Panel } from '@/context/ComicGenerationContext';
import { comicLayoutApi, bubblesApi } from '@/services/api';
import type { ConfirmLayoutResponse, SuggestLayoutResponse, BubbleDataPayload } from '@/services/api';
import type { SingleBubble, PanelBubbles, BubbleType } from '@/components/studio-steps/DialogueEditor';

// ── Page dimensions (match backend) ─────────────────────────────────────────
const PAGE_W = 1240;
const PAGE_H = 1754;

// ── Layout template constants ────────────────────────────────────────────────
const MANGA_TEMPLATES_BY_COUNT: Record<number, string[]> = {
  1: ['full_bleed'],
  2: ['diagonal_split_2', 'one_large_two_small', 'two_small_one_large'],
  3: ['three_panels_row', 'one_large_two_small', 'two_small_one_large', 'diagonal_3_panels', 'cinematic_strips'],
  4: ['grid_2x2', 'action_dynamic_4', 'splash_top', 'asymmetric_4', 'vertical_flow'],
  5: ['manga_classic_5', 'splash_top', 'splash_bottom'],
  6: ['cinematic_strips'],
};

const MANGA_DISPLAY: Record<string, string> = {
  full_bleed: 'Full Bleed', diagonal_split_2: 'Diagonal Split', one_large_two_small: 'Feature Left',
  two_small_one_large: 'Feature Right', three_panels_row: 'Three Row', diagonal_3_panels: 'Diagonal 3',
  cinematic_strips: 'Cinematic', grid_2x2: '2×2 Grid', action_dynamic_4: 'Action ✕',
  splash_top: 'Splash Top', splash_bottom: 'Splash Bottom', asymmetric_4: 'Asymmetric',
  vertical_flow: 'Flow', manga_classic_5: 'Classic 5',
};

// ── Compact 32×22 layout icons for the left panel list ──────────────────────
// viewBox="0 0 32 22", fill="#E5E7EB", stroke="#9CA3AF", strokeWidth="0.5"
const LAYOUT_ICONS: Record<string, React.ReactNode> = {
  full_bleed: <rect x="0.5" y="0.5" width="31" height="21" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/>,
  diagonal_split_2: <><polygon points="0.5,0.5 18,0.5 15,21.5 0.5,21.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><polygon points="20,0.5 31.5,0.5 31.5,21.5 17,21.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  one_large_two_small: <><rect x="0.5" y="0.5" width="17" height="21" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="19" y="0.5" width="12" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="19" y="12" width="12" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  two_small_one_large: <><rect x="0.5" y="0.5" width="12" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="0.5" y="12" width="12" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="14" y="0.5" width="17" height="21" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  three_panels_row: <><rect x="0.5" y="0.5" width="8" height="21" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="10.5" y="0.5" width="10" height="21" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="22.5" y="0.5" width="9" height="21" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  diagonal_3_panels: <><rect x="0.5" y="0.5" width="31" height="10" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><polygon points="0.5,12 13,12 11,21.5 0.5,21.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><polygon points="15,12 31.5,12 31.5,21.5 13,21.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  cinematic_strips: <><rect x="0.5" y="0.5" width="31" height="6" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="0.5" y="8" width="31" height="6" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="0.5" y="15.5" width="31" height="6" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  grid_2x2: <><rect x="0.5" y="0.5" width="14" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="17" y="0.5" width="14" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="0.5" y="12" width="14" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="17" y="12" width="14" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  action_dynamic_4: <><polygon points="0.5,0.5 14,0.5 12,10.5 0.5,10.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><polygon points="18,0.5 31.5,0.5 31.5,10.5 20,10.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><polygon points="0.5,12 12,12 14,21.5 0.5,21.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><polygon points="20,12 31.5,12 31.5,21.5 18,21.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  splash_top: <><rect x="0.5" y="0.5" width="31" height="13" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="0.5" y="15" width="9" height="6.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="11" y="15" width="9" height="6.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="21.5" y="15" width="10" height="6.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  splash_bottom: <><rect x="0.5" y="0.5" width="9" height="6.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="11" y="0.5" width="9" height="6.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="21.5" y="0.5" width="10" height="6.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="0.5" y="9" width="31" height="13" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  asymmetric_4: <><rect x="0.5" y="0.5" width="17" height="14" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="19" y="0.5" width="12" height="6" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="19" y="8" width="12" height="7" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="0.5" y="16" width="31" height="5.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  vertical_flow: <><rect x="0.5" y="0.5" width="9" height="21" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="11" y="0.5" width="20.5" height="10" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="11" y="12" width="13" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="26" y="12" width="5.5" height="9.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
  manga_classic_5: <><rect x="0.5" y="0.5" width="18" height="8" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="20" y="0.5" width="11.5" height="8" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="0.5" y="10" width="8" height="5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="10" y="10" width="21.5" height="5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/><rect x="0.5" y="17" width="31" height="4.5" rx="0.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5"/></>,
};

const MANGA_SCENE_TYPES = [
  { value: 'default', label: 'Auto' }, { value: 'action', label: 'Action' },
  { value: 'dialogue', label: 'Dialogue' }, { value: 'emotional', label: 'Emotional' },
  { value: 'establishing', label: 'Establishing' }, { value: 'climax', label: 'Climax' },
];

const MANGA_SVGS: Record<string, React.ReactNode> = {
  full_bleed: <rect x="2" y="2" width="44" height="60" rx="1" fill="currentColor"/>,
  diagonal_split_2: <><polygon points="2,2 32,2 24,62 2,62" fill="currentColor"/><polygon points="34,2 46,2 46,62 26,62" fill="currentColor"/></>,
  one_large_two_small: <><rect x="2" y="2" width="26" height="60" rx="1" fill="currentColor"/><rect x="31" y="2" width="15" height="28" rx="1" fill="currentColor"/><rect x="31" y="33" width="15" height="29" rx="1" fill="currentColor"/></>,
  two_small_one_large: <><rect x="2" y="2" width="15" height="28" rx="1" fill="currentColor"/><rect x="2" y="33" width="15" height="29" rx="1" fill="currentColor"/><rect x="20" y="2" width="26" height="60" rx="1" fill="currentColor"/></>,
  three_panels_row: <><rect x="2" y="2" width="12" height="60" rx="1" fill="currentColor"/><rect x="17" y="2" width="14" height="60" rx="1" fill="currentColor"/><rect x="34" y="2" width="12" height="60" rx="1" fill="currentColor"/></>,
  diagonal_3_panels: <><rect x="2" y="2" width="44" height="24" rx="1" fill="currentColor"/><polygon points="2,28 22,28 17,62 2,62" fill="currentColor"/><polygon points="24,28 46,28 46,62 19,62" fill="currentColor"/></>,
  cinematic_strips: <><rect x="2" y="2" width="44" height="17" rx="1" fill="currentColor"/><rect x="2" y="23" width="44" height="17" rx="1" fill="currentColor"/><rect x="2" y="44" width="44" height="18" rx="1" fill="currentColor"/></>,
  grid_2x2: <><rect x="2" y="2" width="20" height="28" rx="1" fill="currentColor"/><rect x="26" y="2" width="20" height="28" rx="1" fill="currentColor"/><rect x="2" y="34" width="20" height="28" rx="1" fill="currentColor"/><rect x="26" y="34" width="20" height="28" rx="1" fill="currentColor"/></>,
  action_dynamic_4: <><polygon points="2,2 21,2 18,30 2,30" fill="currentColor"/><polygon points="27,2 46,2 46,30 29,30" fill="currentColor"/><polygon points="2,33 18,33 21,62 2,62" fill="currentColor"/><polygon points="29,33 46,33 46,62 27,62" fill="currentColor"/></>,
  splash_top: <><rect x="2" y="2" width="44" height="34" rx="1" fill="currentColor"/><rect x="2" y="39" width="12" height="23" rx="1" fill="currentColor"/><rect x="18" y="39" width="12" height="23" rx="1" fill="currentColor"/><rect x="34" y="39" width="12" height="23" rx="1" fill="currentColor"/></>,
  splash_bottom: <><rect x="2" y="2" width="12" height="23" rx="1" fill="currentColor"/><rect x="18" y="2" width="12" height="23" rx="1" fill="currentColor"/><rect x="34" y="2" width="12" height="23" rx="1" fill="currentColor"/><rect x="2" y="28" width="44" height="34" rx="1" fill="currentColor"/></>,
  asymmetric_4: <><rect x="2" y="2" width="25" height="36" rx="1" fill="currentColor"/><rect x="30" y="2" width="16" height="16" rx="1" fill="currentColor"/><rect x="30" y="21" width="16" height="17" rx="1" fill="currentColor"/><rect x="2" y="41" width="44" height="21" rx="1" fill="currentColor"/></>,
  vertical_flow: <><rect x="2" y="2" width="13" height="28" rx="1" fill="currentColor"/><rect x="18" y="2" width="28" height="28" rx="1" fill="currentColor"/><rect x="2" y="34" width="24" height="28" rx="1" fill="currentColor"/><rect x="29" y="34" width="17" height="28" rx="1" fill="currentColor"/></>,
  manga_classic_5: <><rect x="2" y="2" width="27" height="22" rx="1" fill="currentColor"/><rect x="32" y="2" width="14" height="22" rx="1" fill="currentColor"/><rect x="2" y="27" width="15" height="16" rx="1" fill="currentColor"/><rect x="20" y="27" width="26" height="16" rx="1" fill="currentColor"/><rect x="2" y="46" width="44" height="16" rx="1" fill="currentColor"/></>,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function stripBold(t: string) { return t.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1'); }
function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// Build a clip-path polygon in LOCAL pixel space (coords relative to the slot's own top-left).
function localClipPath(polygon: [number, number][], x1: number, y1: number, scaleX: number, scaleY: number): string {
  const pts = polygon.map(([px, py]) => `${Math.round((px - x1) * scaleX)}px ${Math.round((py - y1) * scaleY)}px`).join(', ');
  return `polygon(${pts})`;
}

// ── Single panel slot rendered on the comic-page canvas ──────────────────────
function CanvasPanelSlot({
  panel, left, top, width, height, clipPath, panelState, bubbles,
  selected, onSelect, onGenerate, onSelectBubble, selectedBubbleId,
}: {
  panel: Step4Panel;
  left: number; top: number; width: number; height: number;
  clipPath?: string;
  panelState?: { status: string; imageUrl: string | null };
  bubbles: PanelBubbles;
  selected: boolean;
  onSelect: () => void;
  onGenerate: () => void;
  onSelectBubble: (id: string) => void;
  selectedBubbleId: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const imageUrl = panelState?.imageUrl ?? null;
  const status = panelState?.status ?? 'idle';
  const isGenerating = status === 'loading';
  const isError = status === 'error';

  // Outline: selected=blue, error=red, else manga border
  const outline = selected
    ? '2px solid #3B82F6'
    : isError
      ? '2px solid #FCA5A5'
      : '1.5px solid #1a1a1a';

  return (
    <div
      style={{
        position: 'absolute',
        left, top, width, height,
        overflow: 'hidden',
        clipPath,
        outline,
        outlineOffset: selected ? -2 : 0,
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── DONE: generated image ── */}
      {imageUrl && (
        <>
          <img
            src={imageUrl}
            alt={`Panel ${panel.panelNumber}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            draggable={false}
          />
          {/* Bubble overlays */}
          {bubbles.map((b) => (
            <div
              key={b.id}
              onClick={(e) => { e.stopPropagation(); onSelectBubble(b.id); }}
              style={{
                position: 'absolute',
                left: b.bubblePosition.x * width,
                top: b.bubblePosition.y * height,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(255,255,255,0.92)',
                border: selectedBubbleId === b.id ? '2px solid #3B82F6' : '1px solid rgba(0,0,0,0.35)',
                borderRadius: 5,
                padding: '2px 5px',
                fontSize: 8,
                maxWidth: Math.min(width * 0.65, 110),
                lineHeight: 1.3,
                cursor: 'pointer',
                zIndex: 10,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            >
              {b.dialogue?.slice(0, 28) ?? '…'}
            </div>
          ))}
          {/* Hover action bar */}
          {hovered && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '3px 6px', background: 'rgba(0,0,0,0.62)',
            }}>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 4, border: 'none', cursor: 'pointer' }}>
                ↺ Regen
              </button>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 4, border: 'none', cursor: 'pointer' }}>
                ✓ Select
              </button>
            </div>
          )}
        </>
      )}

      {/* ── GENERATING ── */}
      {!imageUrl && isGenerating && (
        <div style={{ position: 'absolute', inset: 0, background: '#EFF6FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ width: 22, height: 22, border: '2px solid #2563EB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          <span style={{ fontSize: 9, color: '#2563EB', fontWeight: 600 }}>Generating…</span>
        </div>
      )}

      {/* ── ERROR ── */}
      {!imageUrl && isError && (
        <div style={{ position: 'absolute', inset: 0, background: '#FEF2F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <button type="button"
            onClick={(e) => { e.stopPropagation(); onGenerate(); }}
            style={{ fontSize: 9, color: '#EF4444', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            ↺ Retry
          </button>
        </div>
      )}

      {/* ── PENDING — wireframe slot ── */}
      {!imageUrl && !isGenerating && !isError && (
        <div style={{
          position: 'absolute', inset: 0,
          background: hovered ? '#EFF6FF' : '#F8F9FA',
          border: `1.5px solid ${hovered ? '#2563EB' : '#CBD5E1'}`,
          boxSizing: 'border-box',
          transition: 'background 0.12s, border-color 0.12s',
          cursor: hovered ? 'pointer' : 'default',
        }}>
          {/* Corner badge */}
          <span style={{
            position: 'absolute', top: 4, left: 4,
            fontSize: 7, fontWeight: 700, color: '#9CA3AF',
            background: 'rgba(255,255,255,0.85)', borderRadius: 2, padding: '1px 3px', lineHeight: 1.2,
            pointerEvents: 'none',
          }}>
            P{panel.panelNumber}
          </span>
          {/* Center content */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
          }}>
            <span style={{ fontSize: Math.max(10, Math.min(18, width / 8)), opacity: 0.25, lineHeight: 1 }}>🖼</span>
            <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600, textAlign: 'center', padding: '0 6px' }}>
              Panel {panel.panelNumber}
            </span>
            {panel.shotType && width > 60 && (
              <span style={{ fontSize: 8, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', padding: '0 6px', lineHeight: 1.3 }}>
                {stripBold(panel.shotType).replace(/_/g, ' ')}
              </span>
            )}
            {hovered && width > 80 && (
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                style={{ marginTop: 3, padding: '3px 10px', background: '#2563EB', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 4, border: 'none', cursor: 'pointer' }}>
                ⚡ Generate
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Default wireframe (shown before any layout is confirmed) ──────────────────
function DefaultWireframeSlot({
  panel, x, y, w, h, onGenerate,
}: {
  panel: Step4Panel; x: number; y: number; w: number; h: number;
  onGenerate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const shotStr = panel.shotType ? stripBold(panel.shotType).replace(/_/g, ' ') : null;
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width: w, height: h,
        background: hovered ? '#EFF6FF' : '#F8FAFC',
        border: `1.5px dashed ${hovered ? '#2563EB' : '#CBD5E1'}`,
        boxSizing: 'border-box',
        cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ position: 'absolute', top: 5, left: 6, fontSize: 8, fontWeight: 700, color: '#94A3B8', lineHeight: 1 }}>
        P{panel.panelNumber}
      </span>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
          <rect x="2" y="3" width="20" height="18" rx="2" stroke="#CBD5E1" strokeWidth="1.5" />
          <circle cx="8.5" cy="9" r="1.5" stroke="#CBD5E1" strokeWidth="1.5" />
          <path d="M2 16l5-5 4 4 3-3 8 8" stroke="#CBD5E1" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 10, fontWeight: 500, color: '#94A3B8' }}>Panel {panel.panelNumber}</span>
        {shotStr && w > 60 && (
          <span style={{ fontSize: 9, color: '#94A3B8', fontStyle: 'italic' }}>{shotStr}</span>
        )}
        {hovered && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onGenerate(); }}
            style={{ marginTop: 4, padding: '4px 10px', background: '#2563EB', color: '#fff', fontSize: 10, fontWeight: 600, borderRadius: 5, border: 'none', cursor: 'pointer' }}
          >
            ⚡ Generate
          </button>
        )}
      </div>
    </div>
  );
}

function DefaultWireframe({
  panels, pageW, pageH, onGeneratePanel,
}: {
  panels: Step4Panel[];
  pageW: number;
  pageH: number;
  onGeneratePanel: (panel: Step4Panel) => void;
}) {
  const sorted = useMemo(() => [...panels].sort((a, b) => a.panelNumber - b.panelNumber), [panels]);
  const cols = sorted.length === 1 ? 1 : 2;
  const rows = Math.ceil(sorted.length / cols);
  const PAD = 0.02;
  const GAP = 0.015;
  const usableW = 1 - PAD * 2;
  const usableH = 1 - PAD * 2;
  const cellW = (usableW - GAP * (cols - 1)) / cols;
  const cellH = (usableH - GAP * (rows - 1)) / rows;

  return (
    <>
      {sorted.map((panel, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const isLastOdd = sorted.length % cols === 1 && idx === sorted.length - 1 && cols > 1;
        const xPct = isLastOdd ? PAD + (usableW - cellW) / 2 : PAD + col * (cellW + GAP);
        const yPct = PAD + row * (cellH + GAP);
        return (
          <DefaultWireframeSlot
            key={panel.id}
            panel={panel}
            x={Math.round(xPct * pageW)}
            y={Math.round(yPct * pageH)}
            w={Math.round(cellW * pageW)}
            h={Math.round(cellH * pageH)}
            onGenerate={() => onGeneratePanel(panel)}
          />
        );
      })}
    </>
  );
}

// ── Center canvas ─────────────────────────────────────────────────────────────
// Base page display width at zoom=1.0
const PAGE_BASE_W = 480;

function CenterCanvas({
  panels, confirmedLayout, isConfirming, selectedLayoutName,
  panelStates, panelBubbles, selectedPanelId, selectedBubbleId,
  zoom, onZoomChange,
  onClickBackground, onSelectPanel, onGeneratePanel, onSelectBubble,
}: {
  panels: Step4Panel[];
  confirmedLayout: ConfirmLayoutResponse | null;
  isConfirming: boolean;
  selectedLayoutName: string;
  panelStates: Record<string, { status: string; imageUrl: string | null }>;
  panelBubbles: Record<string, PanelBubbles>;
  selectedPanelId: string | null;
  selectedBubbleId: string | null;
  zoom: number;
  onZoomChange: (z: number) => void;
  onClickBackground: () => void;
  onSelectPanel: (id: string) => void;
  onGeneratePanel: (panel: Step4Panel) => void;
  onSelectBubble: (panelId: string, bubbleId: string) => void;
}) {
  const sortedPanels = useMemo(() => [...panels].sort((a, b) => a.panelNumber - b.panelNumber), [panels]);

  // Fade animation when layout changes
  const [panelsVisible, setPanelsVisible] = useState(true);
  const prevLayoutSigRef = useRef<string | null>(null);
  const layoutSig = confirmedLayout
    ? confirmedLayout.panels.map(p => (p.bbox as number[]).join(',')).join('|')
    : null;
  useEffect(() => {
    if (prevLayoutSigRef.current !== null && prevLayoutSigRef.current !== layoutSig && layoutSig !== null) {
      setPanelsVisible(false);
      const t = setTimeout(() => setPanelsVisible(true), 100);
      prevLayoutSigRef.current = layoutSig;
      return () => clearTimeout(t);
    }
    prevLayoutSigRef.current = layoutSig;
  }, [layoutSig]);

  // Compute display dimensions from zoom
  const pageW = Math.round(PAGE_BASE_W * zoom);
  const pageH = Math.round(pageW * (PAGE_H / PAGE_W));
  const scaleX = pageW / PAGE_W;
  const scaleY = pageH / PAGE_H;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    onZoomChange(Math.max(0.4, Math.min(2.0, parseFloat((zoom + delta).toFixed(1)))));
  }, [zoom, onZoomChange]);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ minHeight: 0, background: '#D4D4D4' }}
    >
      {/* Scrollable canvas area */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto p-6"
        onClick={onClickBackground}
        onWheel={handleWheel}
        style={{ minHeight: 0 }}
      >
        {/* The white comic page */}
        <div
          style={{
            position: 'relative',
            width: pageW,
            height: pageH,
            background: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
            flexShrink: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!confirmedLayout ? (
            isConfirming && selectedLayoutName && MANGA_SVGS[selectedLayoutName] ? (
              /* Immediate SVG wireframe preview while API computes exact coords */
              <div style={{
                position: 'absolute', inset: 0, background: '#F9FAFB',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <svg
                  viewBox="0 0 48 64"
                  width="85%" height="85%"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.18, pointerEvents: 'none' }}
                >
                  <g style={{ color: '#2563EB' }}>{MANGA_SVGS[selectedLayoutName]}</g>
                </svg>
                <div style={{ width: 20, height: 20, border: '2.5px solid #2563EB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                <p style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', margin: 0 }}>
                  {MANGA_DISPLAY[selectedLayoutName] ?? selectedLayoutName}
                </p>
                <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Calculating panel positions…</p>
              </div>
            ) : panels.length > 0 ? (
              /* Default 2-column wireframe grid — shown immediately on mount */
              <DefaultWireframe
                panels={panels}
                pageW={pageW}
                pageH={pageH}
                onGeneratePanel={onGeneratePanel}
              />
            ) : (
              /* No panels available yet */
              <div style={{
                position: 'absolute', inset: 0,
                border: '2px dashed #D1D5DB', background: '#F9FAFB',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 36, opacity: 0.4 }}>📐</span>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', margin: 0 }}>Select a layout template</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>from the left panel to begin</p>
              </div>
            )
          ) : (
            /* ── Positioned panel slots (fade-in/out on layout change) ── */
            <div style={{
              position: 'absolute', inset: 0,
              opacity: panelsVisible ? 1 : 0,
              transition: panelsVisible ? 'opacity 0.15s ease-in' : 'opacity 0.1s ease-out',
            }}>
              {sortedPanels.map((panel, idx) => {
                const slot = confirmedLayout.panels[idx];
                if (!slot) return null;

                const [x1, y1, x2, y2] = slot.bbox as [number, number, number, number];
                const left   = Math.round(x1 * scaleX);
                const top    = Math.round(y1 * scaleY);
                const width  = Math.round((x2 - x1) * scaleX);
                const height = Math.round((y2 - y1) * scaleY);

                const clipPath = (slot as { has_diagonal?: boolean }).has_diagonal
                  ? localClipPath(slot.polygon as [number, number][], x1, y1, scaleX, scaleY)
                  : undefined;

                return (
                  <CanvasPanelSlot
                    key={panel.id}
                    panel={panel}
                    left={left} top={top} width={width} height={height}
                    clipPath={clipPath}
                    panelState={panelStates[panel.id] as { status: string; imageUrl: string | null } | undefined}
                    bubbles={panelBubbles[panel.id] ?? []}
                    selected={selectedPanelId === panel.id}
                    onSelect={() => onSelectPanel(panel.id)}
                    onGenerate={() => onGeneratePanel(panel)}
                    onSelectBubble={(bId) => onSelectBubble(panel.id, bId)}
                    selectedBubbleId={selectedBubbleId}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}


// ── Page tab navigator ────────────────────────────────────────────────────────
function PageTabNav({
  pages, currentPage, panelStates, onChangePage, zoom, onZoomChange,
}: {
  pages: [number, Step4Panel[]][];
  currentPage: number;
  panelStates: Record<string, { status: string; imageUrl: string | null }>;
  onChangePage: (n: number) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
}) {
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'flex-end', background: '#fff', borderBottom: '1px solid #E5E7EB', flexShrink: 0, padding: '0 16px' }}>
      {/* Page tabs */}
      <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, overflowX: 'auto', minWidth: 0, scrollbarWidth: 'none' }}>
        {pages.map(([pageNum, panels]) => {
          const total = panels.length;
          const done = panels.filter(p => panelStates[p.id]?.imageUrl).length;
          const isActive = pageNum === currentPage;
          const pct = total > 0 ? done / total : 0;
          const allDone = done === total && total > 0;
          return (
            <button key={pageNum} type="button" onClick={() => onChangePage(pageNum)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flexShrink: 0,
                padding: '8px 14px 0 14px', height: 44, cursor: 'pointer', background: 'none', border: 'none',
                borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
                transition: 'border-color 0.15s',
              }}
            >
              <span style={{ fontSize: 12, color: isActive ? '#2563EB' : '#6B7280', fontWeight: isActive ? 600 : 400, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                Page {pageNum}{allDone ? ' ✓' : ''}
              </span>
              <span style={{ fontSize: 10, color: '#9CA3AF', lineHeight: 1.2, marginBottom: 3 }}>{done}/{total}</span>
              <div style={{ width: '100%', height: 2, borderRadius: 1, background: '#E5E7EB', overflow: 'hidden', marginBottom: 1 }}>
                <div style={{ height: '100%', width: `${pct * 100}%`, background: allDone ? '#22C55E' : pct > 0 ? '#2563EB' : '#E5E7EB', borderRadius: 1, transition: 'width 0.3s' }} />
              </div>
            </button>
          );
        })}
      </div>
      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0, paddingBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#374151', minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoomChange(Math.max(0.4, parseFloat((zoom - 0.25).toFixed(2))))}
          style={{ width: 24, height: 24, border: '1px solid #E5E7EB', borderRadius: 4, background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
          −
        </button>
        <button type="button" onClick={() => onZoomChange(Math.min(2.0, parseFloat((zoom + 0.25).toFixed(2))))}
          style={{ width: 24, height: 24, border: '1px solid #E5E7EB', borderRadius: 4, background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
          +
        </button>
      </div>
    </div>
  );
}

// ── Drawer layout list ────────────────────────────────────────────────────────
const DRAWER_LAYOUTS = [
  { id: 'grid_2x2',         label: '2×2 Grid',  count: 4 },
  { id: 'action_dynamic_4', label: 'Action X',  count: 4 },
  { id: 'splash_top',       label: 'Splash Top', count: 4 },
  { id: 'asymmetric_4',     label: 'Asymmetric', count: 4 },
  { id: 'cinematic_strips', label: 'Cinematic',  count: 3 },
  { id: 'vertical_flow',    label: 'Flow',        count: 4 },
] as const;

// ── Slim belt (48px icon column) ──────────────────────────────────────────────
function SlimBelt({
  activeDrawer,
  onToggleDrawer,
}: {
  activeDrawer: null | 'layout' | 'generation' | 'script';
  onToggleDrawer: (panel: 'layout' | 'generation' | 'script') => void;
}) {
  const btns: { id: 'layout' | 'generation' | 'script'; label: string; icon: string }[] = [
    { id: 'layout',     label: 'Layout',   icon: '⊞' },
    { id: 'generation', label: 'Generate', icon: '⚡' },
    { id: 'script',     label: 'Script',   icon: '📝' },
  ];
  return (
    <div style={{ width: 48, flexShrink: 0, background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4 }}>
      {btns.map(({ id, label, icon }) => {
        const isActive = activeDrawer === id;
        return (
          <button key={id} type="button" title={label} onClick={() => onToggleDrawer(id)}
            style={{
              width: 36, height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              borderRadius: 8, cursor: 'pointer',
              background: isActive ? '#EFF6FF' : 'transparent',
              border: isActive ? '1px solid #BFDBFE' : '1px solid transparent',
              color: isActive ? '#2563EB' : '#6B7280',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: 9, fontWeight: 500, lineHeight: 1 }}>{label}</span>
          </button>
        );
      })}

    </div>
  );
}

// ── Detail drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({
  activeDrawer, onClose,
  selectedLayout, onSelectLayout, comicPageMode, setComicPageMode,
  layoutSuggestion, isSuggLoading, onGetSuggestion,
  currentPage, panels, panelStates, isGenerating,
  onGenerateCurrentPage, onRegeneratePanel,
  panelBubbles, onAutoImportDialogue,
}: {
  activeDrawer: null | 'layout' | 'generation' | 'script';
  onClose: () => void;
  selectedLayout: string;
  onSelectLayout: (name: string) => void;
  comicPageMode: string | null;
  setComicPageMode: (mode: 'page' | 'panel') => void;
  layoutSuggestion: SuggestLayoutResponse | null;
  isSuggLoading: boolean;
  onGetSuggestion: () => void;
  currentPage: number;
  panels: Step4Panel[];
  panelStates: Record<string, { status: string; imageUrl: string | null }>;
  isGenerating: boolean;
  onGenerateCurrentPage: () => void;
  onRegeneratePanel: (panel: Step4Panel) => void;
  panelBubbles: Record<string, PanelBubbles>;
  onAutoImportDialogue: () => void;
}) {
  const isOpen = activeDrawer !== null;
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    if (activeDrawer !== null) {
      const t = setTimeout(() => setContentVisible(true), 80);
      return () => clearTimeout(t);
    } else {
      setContentVisible(false);
    }
  }, [activeDrawer]);

  const titles: Record<string, string> = { layout: 'Layout', generation: 'Generation', script: 'Script' };
  const sortedPanels = useMemo(() => [...panels].sort((a, b) => a.panelNumber - b.panelNumber), [panels]);
  const totalOnPage = panels.length;
  const donePanelsOnPage = panels.filter(p => panelStates[p.id]?.imageUrl).length;
  const pctOnPage = totalOnPage > 0 ? donePanelsOnPage / totalOnPage : 0;
  const panelsWithDialogueOnPage = Math.min(panels.filter(p => (panelBubbles[p.id]?.length ?? 0) > 0).length, totalOnPage);

  return (
    <div style={{
      width: isOpen ? 280 : 0,
      minWidth: isOpen ? 280 : 0,
      flexShrink: 0,
      background: '#fff',
      borderLeft: '1px solid #E5E7EB',
      overflow: 'hidden',
      transition: 'width 220ms ease-in-out, min-width 220ms ease-in-out',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        width: 280, minWidth: 280, height: '100%', display: 'flex', flexDirection: 'column',
        opacity: contentVisible ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}>
        {/* Drawer header */}
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 0 16px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
            {activeDrawer ? titles[activeDrawer] : ''}
          </span>
          <button type="button" onClick={onClose}
            style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', borderRadius: 4, fontSize: 14 }}>
            ✕
          </button>
        </div>

        {/* Drawer body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* ── LAYOUT PANEL ── */}
          {activeDrawer === 'layout' && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>View Mode</p>
              <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: 6, padding: 2, background: '#F3F4F6', marginBottom: 16 }}>
                {(['panel', 'page'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setComicPageMode(m)}
                    style={{ flex: 1, height: 28, borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: comicPageMode === m ? '#2563EB' : 'transparent', color: comicPageMode === m ? '#fff' : '#374151', transition: 'background 0.12s, color 0.12s' }}>
                    {m === 'panel' ? 'Panel by Panel' : 'Full Page'}
                  </button>
                ))}
              </div>

              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Layout</p>
              <select value={selectedLayout} onChange={e => onSelectLayout(e.target.value)}
                style={{ width: '100%', height: 36, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '0 10px', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                {DRAWER_LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <button type="button" onClick={onGetSuggestion} disabled={isSuggLoading}
                style={{ width: '100%', height: 32, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, fontSize: 12, fontWeight: 500, color: '#2563EB', cursor: isSuggLoading ? 'not-allowed' : 'pointer', opacity: isSuggLoading ? 0.7 : 1, marginBottom: layoutSuggestion ? 6 : 16 }}>
                {isSuggLoading ? '…' : '✨ AI Suggest Layout'}
              </button>
              {layoutSuggestion && (
                <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 16px', padding: '8px 10px', background: '#F9FAFB', borderRadius: 6, lineHeight: 1.4 }}>
                  💡 {layoutSuggestion.reason ?? `Suggested: ${layoutSuggestion.suggested}`}
                </p>
              )}

              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Templates</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {DRAWER_LAYOUTS.map(l => {
                  const isActive = selectedLayout === l.id;
                  return (
                    <button key={l.id} type="button" onClick={() => onSelectLayout(l.id)}
                      style={{ padding: 6, borderRadius: 8, cursor: 'pointer', textAlign: 'left', background: isActive ? '#EFF6FF' : '#fff', border: `${isActive ? 2 : 1}px solid ${isActive ? '#2563EB' : '#E5E7EB'}`, position: 'relative', transition: 'border-color 0.12s, background 0.12s' }}>
                      <div style={{ width: '100%', height: 52, background: isActive ? '#DBEAFE' : '#F3F4F6', borderRadius: 4, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <svg viewBox="0 0 32 22" width="90%" height="90%">
                          {LAYOUT_ICONS[l.id]}
                        </svg>
                      </div>
                      <p style={{ fontSize: 10, fontWeight: 500, color: '#374151', margin: '0 0 2px' }}>{l.label}</p>
                      <p style={{ fontSize: 9, color: '#9CA3AF', margin: 0 }}>{l.count} panels</p>
                      {isActive && (
                        <div style={{ position: 'absolute', bottom: 6, right: 6, width: 14, height: 14, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 8, color: '#fff' }}>✓</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── GENERATION PANEL ── */}
          {activeDrawer === 'generation' && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Page {currentPage} Status</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#374151' }}>Generated: {donePanelsOnPage}/{totalOnPage}</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#E5E7EB', marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctOnPage * 100}%`, background: '#2563EB', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <button type="button" onClick={onGenerateCurrentPage} disabled={isGenerating}
                style={{ width: '100%', height: 40, background: isGenerating ? '#2563EB' : '#2563EB', opacity: isGenerating ? 0.75 : 1, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {isGenerating
                  ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.9s linear infinite', flexShrink: 0 }} />Generating...</>
                  : donePanelsOnPage === totalOnPage && totalOnPage > 0
                    ? <span style={{ color: '#fff' }}>✓ Page {currentPage} Done</span>
                    : <>⚡ Generate Page {currentPage}</>
                }
              </button>
              <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', margin: '0 0 16px' }}>{totalOnPage} panels on Page {currentPage}</p>

              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Panels</p>
              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sortedPanels.map(panel => {
                  const ps = panelStates[panel.id];
                  const hasImage = !!ps?.imageUrl;
                  const isLoading = ps?.status === 'loading';
                  const isError = ps?.status === 'error';
                  const shotLabel = panel.shotType ? stripBold(panel.shotType).replace(/_/g, ' ') : '';
                  return (
                    <div key={panel.id} style={{ height: 36, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 6, cursor: 'default' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden', flex: 1 }}>
                        {/* Status icon */}
                        {hasImage
                          ? <span style={{ fontSize: 11, color: '#16A34A', flexShrink: 0, lineHeight: 1 }}>✓</span>
                          : isLoading
                            ? <span style={{ width: 12, height: 12, border: '2px solid #93C5FD', borderTopColor: '#2563EB', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.9s linear infinite', flexShrink: 0 }} />
                            : isError
                              ? <span style={{ fontSize: 11, color: '#DC2626', flexShrink: 0, lineHeight: 1 }}>✕</span>
                              : <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid #D1D5DB', display: 'inline-block', flexShrink: 0 }} />
                        }
                        <span style={{ fontSize: 12, color: hasImage ? '#374151' : isLoading ? '#2563EB' : '#6B7280', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 'calc(100% - 32px)' }}>
                          P{panel.panelNumber}{shotLabel ? ` · ${shotLabel}` : ''}
                        </span>
                        {isLoading && <span style={{ fontSize: 10, color: '#93C5FD', flexShrink: 0 }}>gen...</span>}
                      </div>
                      {/* ↺ only after generation or on error */}
                      {(hasImage || isError) && (
                        <button type="button" onClick={() => onRegeneratePanel(panel)} title="Regenerate"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isError ? '#DC2626' : '#9CA3AF', fontSize: 14, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = isError ? '#B91C1C' : '#2563EB')}
                          onMouseLeave={e => (e.currentTarget.style.color = isError ? '#DC2626' : '#9CA3AF')}>
                          ↺
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 6px' }}>Dialogue Status</p>
              <span style={{ fontSize: 12, color: '#6B7280' }}>
                {totalOnPage === 0 ? 'No panels on this page' : `${panelsWithDialogueOnPage}/${totalOnPage} panels have dialogue`}
              </span>
              <div style={{ width: '100%', height: 4, borderRadius: 2, background: '#E5E7EB', margin: '6px 0 8px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: totalOnPage > 0 ? `${panelsWithDialogueOnPage / totalOnPage * 100}%` : '0%', background: '#22C55E', borderRadius: 2 }} />
              </div>
              <button type="button" onClick={onAutoImportDialogue}
                style={{ width: '100%', height: 32, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 6, fontSize: 12, fontWeight: 500, color: '#166534', cursor: 'pointer' }}>
                ⚡ Auto-import dialogue
              </button>
            </>
          )}

          {/* ── SCRIPT PANEL ── */}
          {activeDrawer === 'script' && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Page {currentPage} Script</p>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, overflowY: 'auto' }}>
                {sortedPanels.map((panel, idx) => (
                  <div key={panel.id} style={{ paddingBottom: idx < panels.length - 1 ? 10 : 0, marginBottom: idx < panels.length - 1 ? 10 : 0, borderBottom: idx < panels.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                      Panel {panel.panelNumber} — {panel.shotType?.replace(/_/g, ' ') ?? 'Scene'}
                    </p>
                    {panel.aiImagePrompt && (
                      <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, margin: '0 0 4px' }}>{stripBold(panel.aiImagePrompt)}</p>
                    )}
                    {panel.dialogueSfx && panel.dialogueSfx !== 'No dialogue/SFX provided.' && (
                      <p style={{ fontSize: 10, color: '#9CA3AF', lineHeight: 1.4, fontStyle: 'italic', margin: 0 }}>💬 {stripBold(panel.dialogueSfx)}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Bottom action bar (fixed, matches Step 3 style) ───────────────────────────
function BottomActionBar({
  totalPanels, donePanels, currentPage, donePanelsOnPage, totalOnPage, isGenerating,
  onBack, onGenerateAll, onExport,
}: {
  totalPanels: number; donePanels: number; currentPage: number;
  donePanelsOnPage: number; totalOnPage: number; isGenerating: boolean;
  onBack: () => void; onGenerateAll: () => void; onExport: () => void;
}) {
  const allDone = donePanels === totalPanels && totalPanels > 0;
  const subtitle = allDone
    ? `✓ All ${totalPanels} panels generated`
    : `Page ${currentPage}: ${donePanelsOnPage}/${totalOnPage}  ·  Total: ${donePanels}/${totalPanels} panels`;
  return (
    <div className="fixed bottom-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{ left: 'var(--studio-sidebar-width)' }}>
      <div className="px-10 py-4 max-w-6xl mx-auto flex items-center justify-between gap-4">
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Previous Step
        </button>
        <span className={`text-sm font-medium ${allDone ? 'text-emerald-600' : 'text-gray-400'}`}>{subtitle}</span>
        <div className="flex items-center gap-3">
          {allDone ? (
            <button type="button" onClick={onExport}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:scale-105 transition-transform">
              Next Step: Export →
            </button>
          ) : isGenerating ? (
            <button type="button" disabled
              className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white cursor-not-allowed"
              style={{ background: '#2563EB', opacity: 0.75 }}>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating…
            </button>
          ) : (
            <button type="button" onClick={onGenerateAll}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white hover:scale-105 transition-transform"
              style={{ background: '#2563EB' }}>
              ⚡ Generate All Pages
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Step4CanvasEditor() {
  const {
    step4, step4PanelsByPage,
    handleApprove, handleStartPanelGeneration, handleStartFullGeneration,
    handleRegenerateSinglePanel,
    setActiveStep, projectId,
    comicPageMode, setComicPageMode,
    pageLayoutNames, setRawPanelDimensions,
  } = useComicGeneration();

  // ── Local state ──────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState<number>(() => step4PanelsByPage[0]?.[0] ?? 1);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);

  const [pagePolygonLayout, setPagePolygonLayout] = useState<Record<number, string>>({});
  const [pageSceneType, setPageSceneType] = useState<Record<number, string>>({});
  const [confirmedLayouts, setConfirmedLayouts] = useState<Record<number, ConfirmLayoutResponse>>({});
  const [layoutSuggestions, setLayoutSuggestions] = useState<Record<number, SuggestLayoutResponse>>({});
  const [suggestionLoading, setSuggestionLoading] = useState<Record<number, boolean>>({});
  const [confirmingLayout, setConfirmingLayout] = useState<Record<number, boolean>>({});

  const [panelBubbles, setPanelBubbles] = useState<Record<string, PanelBubbles>>({});
  const bubblesLoadedRef = useRef(false);

  const [dialogueBannerDismissed, setDialogueBannerDismissed] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<null | 'layout' | 'generation' | 'script'>(null);
  const [zoom, setZoom] = useState(1.0);

  // ── Derived ───────────────────────────────────────────────────────────────
  const panelsForPage = useMemo(
    () => step4PanelsByPage.find(([n]) => n === currentPage)?.[1] ?? [],
    [step4PanelsByPage, currentPage]
  );
  const confirmedForPage = confirmedLayouts[currentPage] ?? null;
  const selectedLayout = pagePolygonLayout[currentPage] ?? pageLayoutNames[currentPage] ?? '';
  const panelStates = step4.data?.panelStates ?? {};
  const totalPanels = step4.data?.panels.length ?? 0;
  const donePanels = useMemo(() => Object.values(panelStates).filter(s => s.imageUrl != null).length, [panelStates]);
  const isGenerating = useMemo(() => Object.values(panelStates).some(s => s.status === 'loading'), [panelStates]);
  const totalBubbles = useMemo(() => Object.values(panelBubbles).reduce((sum, arr) => sum + (arr?.length ?? 0), 0), [panelBubbles]);
  const totalOnPage = panelsForPage.length;
  const donePanelsOnPage = panelsForPage.filter(p => panelStates[p.id]?.imageUrl != null).length;

  // ── Load bubbles ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || bubblesLoadedRef.current) return;
    bubblesLoadedRef.current = true;
    bubblesApi.getForComic(projectId).then(res => {
      const map: Record<string, PanelBubbles> = {};
      for (const doc of res.data) map[doc.panelId] = doc.bubbles as PanelBubbles;
      if (Object.keys(map).length > 0) setPanelBubbles(prev => ({ ...map, ...prev }));
    }).catch(() => {});
  }, [projectId]);

  // ── Auto-confirm saved layout names on mount ──────────────────────────────
  const hasAutoConfirmedRef = useRef(false);
  useEffect(() => {
    if (hasAutoConfirmedRef.current || !step4PanelsByPage.length) return;
    hasAutoConfirmedRef.current = true;
    for (const [pageNum, panels] of step4PanelsByPage) {
      const savedLayout = pageLayoutNames[pageNum];
      if (savedLayout && !confirmedLayouts[pageNum]) {
        handleConfirmLayout(pageNum, savedLayout, panels);
      } else if (!savedLayout && !pagePolygonLayout[pageNum]) {
        // Default to grid_2x2 so wireframe shows immediately on mount
        setPagePolygonLayout(prev => ({ ...prev, [pageNum]: 'grid_2x2' }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step4PanelsByPage.length]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleConfirmLayout = useCallback(async (pageNumber: number, layoutName: string, panels: Step4Panel[]) => {
    if (!layoutName || layoutName === 'auto') return;
    setConfirmingLayout(prev => ({ ...prev, [pageNumber]: true }));
    try {
      const res = await comicLayoutApi.confirm({ panel_count: panels.length, layout_name: layoutName, page_width: PAGE_W, page_height: PAGE_H });
      setConfirmedLayouts(prev => ({ ...prev, [pageNumber]: res.data }));
      const sorted = [...panels].sort((a, b) => a.panelNumber - b.panelNumber);
      const dimMap: Record<string, { width: number; height: number }> = {};
      res.data.panels.forEach((slot: { sd_width: number; sd_height: number }, idx: number) => {
        const p = sorted[idx];
        if (p) dimMap[p.id] = { width: slot.sd_width, height: slot.sd_height };
      });
      setRawPanelDimensions(pageNumber, dimMap);
    } catch (e) {
      console.error('[handleConfirmLayout]', e);
    } finally {
      setConfirmingLayout(prev => ({ ...prev, [pageNumber]: false }));
    }
  }, [setRawPanelDimensions]);

  const handleSelectLayout = useCallback(async (layoutName: string) => {
    setPagePolygonLayout(prev => ({ ...prev, [currentPage]: layoutName }));
    await handleConfirmLayout(currentPage, layoutName, panelsForPage);
  }, [currentPage, panelsForPage, handleConfirmLayout]);

  const handleGetSuggestion = useCallback(async (pageNumber: number, panels: Step4Panel[]) => {
    setSuggestionLoading(prev => ({ ...prev, [pageNumber]: true }));
    try {
      const sceneType = pageSceneType[pageNumber] ?? 'default';
      const res = await comicLayoutApi.suggest({
        panel_count: panels.length,
        scene_type: sceneType,
        panels: panels.map(p => ({ shot_type: p.shotType ?? '', dialogue_sfx: p.dialogueSfx ?? '', ai_image_prompt: p.aiImagePrompt ?? '' })),
      });
      setLayoutSuggestions(prev => ({ ...prev, [pageNumber]: res.data }));
    } catch (e) {
      console.error('[handleGetSuggestion]', e);
    } finally {
      setSuggestionLoading(prev => ({ ...prev, [pageNumber]: false }));
    }
  }, [pageSceneType]);

  const handleAutoImportDialogue = useCallback(() => {
    const bubbles: Record<string, PanelBubbles> = {};
    for (const [, panels] of step4PanelsByPage) {
      for (const p of panels) {
        const text = stripBold(p.dialogueSfx ?? '');
        if (text && text !== 'No dialogue/SFX provided.') {
          const isSfx = /^<.+>$/.test(text.trim());
          const isThought = text.startsWith('*');
          const bubbleType: BubbleType = isSfx ? 'sfx' : isThought ? 'thought' : 'speech';
          bubbles[p.id] = [{
            id: genId(), dialogue: text, bubbleType,
            tailDir: bubbleType === 'sfx' ? 'none' : 'down-left',
            bubblePosition: { x: 0.5, y: 0.3 },
            bubbleSize: { w: isSfx ? 180 : 160, h: isSfx ? 90 : 80 },
            fontSize: isSfx ? 24 : isThought ? 12 : 13,
            rotation: 0, zIndex: 0, opacity: 1,
          } as SingleBubble];
        }
      }
    }
    setPanelBubbles(prev => ({ ...prev, ...bubbles }));
  }, [step4PanelsByPage]);

  const saveBubbles = useCallback((panelId: string, bubbles: PanelBubbles) => {
    setPanelBubbles(prev => ({ ...prev, [panelId]: bubbles }));
    if (projectId) bubblesApi.upsert(panelId, projectId, bubbles as BubbleDataPayload[]).catch(() => {});
  }, [projectId]);

  const handleGenerateAllOnPage = useCallback(() => {
    const pending = panelsForPage.filter(p => !panelStates[p.id]?.imageUrl);
    for (const p of pending) handleRegenerateSinglePanel(p);
  }, [panelsForPage, panelStates, handleRegenerateSinglePanel]);

  const handleChangePage = useCallback((n: number) => {
    setCurrentPage(n);
    setSelectedPanelId(null);
    setSelectedBubbleId(null);
  }, []);

  const toggleDrawer = useCallback((panel: 'layout' | 'generation' | 'script') => {
    setActiveDrawer(prev => prev === panel ? null : panel);
  }, []);

  return (
    <>
      {/* Canvas editor card — normal flow inside the page frame */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
        style={{ height: 'calc(100vh - 460px)', minHeight: 500 }}>

        <PageTabNav
          pages={step4PanelsByPage}
          currentPage={currentPage}
          panelStates={panelStates as Record<string, { status: string; imageUrl: string | null }>}
          onChangePage={handleChangePage}
          zoom={zoom}
          onZoomChange={setZoom}
        />

        {/* Dialogue auto-import banner */}
        {donePanels > 0 && !dialogueBannerDismissed && totalBubbles === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 16px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#1E40AF' }}>💬 Your script has dialogue — add speech bubbles now?</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { handleAutoImportDialogue(); setDialogueBannerDismissed(true); }}
                style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: '#2563EB', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                ⚡ Auto-add
              </button>
              <button type="button" onClick={() => setDialogueBannerDismissed(true)}
                style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #BFDBFE', background: '#fff', color: '#6B7280', fontSize: 11, cursor: 'pointer' }}>
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Editor area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <CenterCanvas
            panels={panelsForPage}
            confirmedLayout={confirmedForPage}
            isConfirming={confirmingLayout[currentPage] ?? false}
            selectedLayoutName={selectedLayout}
            panelStates={panelStates as Record<string, { status: string; imageUrl: string | null }>}
            panelBubbles={panelBubbles}
            selectedPanelId={selectedPanelId}
            selectedBubbleId={selectedBubbleId}
            zoom={zoom}
            onZoomChange={setZoom}
            onClickBackground={() => { setSelectedPanelId(null); setSelectedBubbleId(null); }}
            onSelectPanel={id => { setSelectedPanelId(id); setSelectedBubbleId(null); }}
            onGeneratePanel={handleRegenerateSinglePanel}
            onSelectBubble={(panelId, bubbleId) => { setSelectedPanelId(panelId); setSelectedBubbleId(bubbleId); }}
          />

          <DetailDrawer
            activeDrawer={activeDrawer}
            onClose={() => setActiveDrawer(null)}
            selectedLayout={selectedLayout}
            onSelectLayout={handleSelectLayout}
            comicPageMode={comicPageMode}
            setComicPageMode={setComicPageMode}
            layoutSuggestion={layoutSuggestions[currentPage] ?? null}
            isSuggLoading={suggestionLoading[currentPage] ?? false}
            onGetSuggestion={() => handleGetSuggestion(currentPage, panelsForPage)}
            currentPage={currentPage}
            panels={panelsForPage}
            panelStates={panelStates as Record<string, { status: string; imageUrl: string | null }>}
            isGenerating={isGenerating}
            onGenerateCurrentPage={handleGenerateAllOnPage}
            onRegeneratePanel={handleRegenerateSinglePanel}
            panelBubbles={panelBubbles}
            onAutoImportDialogue={handleAutoImportDialogue}
          />

          <SlimBelt activeDrawer={activeDrawer} onToggleDrawer={toggleDrawer} />
        </div>
      </div>

      <BottomActionBar
        totalPanels={totalPanels}
        donePanels={donePanels}
        currentPage={currentPage}
        donePanelsOnPage={donePanelsOnPage}
        totalOnPage={totalOnPage}
        isGenerating={isGenerating}
        onBack={() => setActiveStep(3)}
        onGenerateAll={comicPageMode === 'page' ? handleStartFullGeneration : handleStartPanelGeneration}
        onExport={() => handleApprove(4)}
      />
    </>
  );
}
