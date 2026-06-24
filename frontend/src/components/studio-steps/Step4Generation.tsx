'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { Step4Panel, PanelVersion } from '@/context/ComicGenerationContext';
import { bubblesApi, comicLayoutApi } from '@/services/api';
import type { BubbleDataPayload } from '@/services/api';
import DialogueEditor, { type PanelBubbles, type SingleBubble, type BubbleType } from '@/components/studio-steps/DialogueEditor';
import Markdown from '@/components/Markdown';

type State = 1 | 2 | 3 | 4 | 5;

// ── State badge ──────────────────────────────────────────────────────────────
function StateBadge({ state }: { state: State }) {
  if (state === 1) return null;
  if (state === 2) {
    return (
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        Building panels…
      </div>
    );
  }
  if (state === 3) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pending</span>
        Pending review
      </div>
    );
  }
  if (state === 4) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        Completed
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
      Rebuilt — re-review needed
    </div>
  );
}

// ── Panel status dot ─────────────────────────────────────────────────────────
function PanelStatusDot({ status }: { status: string }) {
  if (status === 'success') return <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />;
  if (status === 'loading') return <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />;
  if (status === 'error') return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-outline-variant flex-shrink-0" />;
}




// ── Segmented progress bar: green=done, amber=errors, shimmer=loading ────────
function SegmentedProgressBar({ total, success, error, loading, height = 12 }: {
  total: number; success: number; error: number; loading: number; height?: number;
}) {
  if (total === 0) return <div className="rounded-full bg-[#E5E7EB]" style={{ height }} />;
  const sPct = (success / total) * 100;
  const ePct = (error / total) * 100;
  const lPct = (loading / total) * 100;
  return (
    <div className="rounded-full bg-[#E5E7EB] overflow-hidden relative" style={{ height }}>
      {loading > 0 && (
        <div className="absolute top-0 h-full animate-shimmer"
          style={{ left: `${sPct + ePct}%`, width: `${lPct}%`,
            background: 'linear-gradient(90deg,#C7D2FE 25%,#A5B4FC 50%,#C7D2FE 75%)',
            backgroundSize: '200% 100%' }} />
      )}
      {error > 0 && (
        <div className="absolute top-0 h-full transition-all duration-500 bg-amber-400"
          style={{ left: `${sPct}%`, width: `${ePct}%` }} />
      )}
      <div className="absolute top-0 left-0 h-full rounded-l-full transition-all duration-500 bg-emerald-500"
        style={{ width: `${sPct}%` }} />
    </div>
  );
}



// Strip leading/trailing markdown bold markers the LLM sometimes wraps field values in
function stripBold(s: string) {
  return s.replace(/^\*{1,3}\s*/, '').replace(/\s*\*{1,3}$/, '').trim();
}

function genBubbleId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Prompt display: dims the shared art-style prefix, highlights unique content ──
function PromptDisplay({ prompt, artStyle }: { prompt: string; artStyle: string }) {
  const style = artStyle.trim().replace(/\.$/, '');
  const lower = prompt.toLowerCase();
  const styleLen = style.toLowerCase().length;
  if (style && lower.startsWith(style.toLowerCase())) {
    // advance past the style prefix and any trailing punctuation/comma/space
    let end = styleLen;
    while (end < prompt.length && /[,.\s]/.test(prompt[end])) end++;
    const prefix = prompt.slice(0, end);
    const rest = prompt.slice(end);
    return (
      <p className="text-[11px] leading-relaxed font-mono">
        <span className="text-outline-variant">{prefix}{rest ? ',' : ''}</span>
        {rest && <span className="text-on-surface-variant"> {rest}</span>}
      </p>
    );
  }
  return <p className="text-[11px] text-on-surface-variant leading-relaxed font-mono">{prompt}</p>;
}

// ── Compact script card for page view (no image area) ────────────────────────
// ── Regenerate feedback modal ─────────────────────────────────────────────────
const REGEN_CHIPS = [
  { label: '🌙 Night time', text: 'night time setting' },
  { label: '😠 More intense', text: 'more intense emotion' },
  { label: '📷 Wide shot', text: 'wide establishing shot' },
  { label: '👤 Full body', text: 'show full body' },
  { label: '🌟 More detail', text: 'more detailed artwork' },
  { label: '🎨 Darker', text: 'darker mood and colors' },
];

function RegenerateModal({
  pageNumber: _pn, // eslint-disable-line @typescript-eslint/no-unused-vars
  contextLabel,
  currentImageUrl,
  prevFeedback,
  onClose,
  onRegenerate,
}: {
  pageNumber: number;
  contextLabel: string;
  currentImageUrl: string | null;
  prevFeedback: string;
  onClose: () => void;
  onRegenerate: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState(prevFeedback);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const appendChip = (text: string) => {
    setFeedback((prev) => {
      const t = prev.trim();
      return t ? `${t}, ${text}` : text;
    });
    textareaRef.current?.focus();
  };

  const submit = (withFeedback: boolean) => {
    onRegenerate(withFeedback ? feedback.trim() : '');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-[520px] bg-surface rounded-2xl shadow-2xl overflow-hidden animate-panel-appear">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <div>
            <h3 className="text-base font-bold text-on-surface">Regenerate {contextLabel}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Current image preview */}
          {currentImageUrl ? (
            <div className="rounded-xl overflow-hidden border border-outline-variant/20 relative" style={{ height: 200 }}>
              <Image src={currentImageUrl} alt="Current version" fill className="object-cover" unoptimized />
              <div className="absolute bottom-0 inset-x-0 bg-black/40 backdrop-blur-sm py-1.5 px-3">
                <p className="text-[11px] text-white font-medium">{contextLabel} — current version</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-surface-container-low border border-outline-variant/20 py-6 text-center">
              <p className="text-sm text-on-surface-variant">No image yet — provide guidance below or regenerate from scratch</p>
            </div>
          )}

          {/* Feedback textarea */}
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
              What would you like to change?
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value.slice(0, 200))}
                placeholder="e.g. make the character look angrier, change to night time, show full body"
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface placeholder-outline outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed"
                style={{ minHeight: 80, maxHeight: 160 }}
                rows={3}
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-outline select-none">{feedback.length}/200</span>
            </div>
            <p className="text-[11px] text-outline mt-1.5">Describe what to change, not what to keep</p>
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-2">
            {REGEN_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => appendChip(chip.text)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/20 bg-surface-container-low">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => submit(false)}
              title="Re-run the original prompt without any new instructions"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-sm">replay</span>
              Regenerate without changes
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={!feedback.trim()}
              title="Regenerate using your feedback above as guidance"
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${feedback.trim() ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-surface-container text-outline cursor-not-allowed opacity-50'}`}
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Version comparison view ───────────────────────────────────────────────────
function ComparisonView({
  pageNumber,
  prevImageUrl,
  newImageUrl,
  feedback,
  versions,
  onAccept,
  onReject,
  onTryAgain,
}: {
  pageNumber: number;
  prevImageUrl: string | null;
  newImageUrl: string;
  feedback: string;
  versions: PanelVersion[];
  onAccept: () => void;
  onReject: () => void;
  onTryAgain: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-primary/40 overflow-hidden bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary uppercase tracking-wide">Compare versions — Page {pageNumber}</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">New ready</span>
        </div>
      </div>

      {/* Side-by-side */}
      <div className="grid grid-cols-2 divide-x divide-outline-variant/20">
        <div className="p-4 space-y-3">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
            V{versions.length || 1} — Previous
          </p>
          <div className="rounded-xl overflow-hidden relative bg-surface-container-low" style={{ height: 180 }}>
            {prevImageUrl ? (
              <Image src={prevImageUrl} alt="Previous" fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-xs text-outline">No previous version</p>
              </div>
            )}
          </div>
          <button type="button" onClick={onReject} className="w-full py-2 rounded-xl text-xs font-bold border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container transition-colors">
            Keep previous
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
            V{(versions.length || 1) + 1} — New
          </p>
          <div className="rounded-xl overflow-hidden relative" style={{ height: 180 }}>
            <Image src={newImageUrl} alt="New version" fill className="object-cover" unoptimized />
          </div>
          {feedback && <p className="text-[11px] text-outline italic">Feedback: &ldquo;{feedback}&rdquo;</p>}
          <button type="button" onClick={onAccept} className="w-full py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity">
            ✓ Use this version
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low border-t border-outline-variant/20">
        <p className="text-[11px] text-outline">Not satisfied?</p>
        <button type="button" onClick={onTryAgain} className="text-xs font-semibold text-primary hover:opacity-80 transition-opacity">
          ↺ Try again with new feedback
        </button>
      </div>

      {/* Version strip (3+ versions) */}
      {versions.length >= 2 && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap border-t border-outline-variant/10 pt-3">
          <p className="text-[10px] text-outline mr-1">History:</p>
          {versions.map((v, i) => (
            <div key={i} className="w-9 h-9 rounded-lg overflow-hidden border-2 border-outline-variant/30 flex-shrink-0 relative">
              <Image src={v.imageUrl} alt={`V${i + 1}`} fill className="object-cover" unoptimized />
            </div>
          ))}
          <div className="w-9 h-9 rounded-lg overflow-hidden border-2 border-primary flex-shrink-0 relative">
            <Image src={newImageUrl} alt={`V${versions.length + 1}`} fill className="object-cover" unoptimized />
          </div>
        </div>
      )}
    </div>
  );
}

function PanelScriptCard({ panel, artStyle }: { panel: Step4Panel; artStyle: string }) {
  const [open, setOpen] = useState(false);
  const shotType = panel.shotType ? stripBold(panel.shotType) : null;
  const dialogue = panel.dialogueSfx ? stripBold(panel.dialogueSfx) : '';
  const prompt = stripBold(panel.aiImagePrompt);
  return (
    <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-container transition-colors"
      >
        <span className="text-[11px] font-bold text-on-surface truncate flex-1">{panel.contextLabel}</span>
        {shotType && (
          <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold text-on-surface-variant uppercase tracking-wide flex-shrink-0">
            {shotType}
          </span>
        )}
        <span
          className="material-symbols-outlined text-sm text-on-surface-variant transition-transform flex-shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-outline-variant/10 pt-2.5">
          {dialogue && dialogue !== 'No dialogue/SFX provided.' && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Dialogue / SFX</p>
              <Markdown className="[&_p]:text-[12px] [&_p]:text-on-surface [&_p]:leading-relaxed [&_p]:mb-1 [&_p]:last:mb-0">{dialogue}</Markdown>
            </div>
          )}
          {prompt && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Image Prompt</p>
              <PromptDisplay prompt={prompt} artStyle={artStyle} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Preview slideshow modal ───────────────────────────────────────────────────
function PreviewModal({ pages, onClose }: {
  pages: { pageNumber: number; imageUrl: string }[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(pages.length - 1, i + 1));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pages.length, onClose]);

  const page = pages[idx];
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90">
      <button type="button" onClick={onClose}
        className="absolute top-5 right-5 text-white/60 hover:text-white transition-colors z-10">
        <span className="material-symbols-outlined text-3xl">close</span>
      </button>
      <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
        className="absolute left-5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white disabled:opacity-20 transition-colors">
        <span className="material-symbols-outlined text-5xl">chevron_left</span>
      </button>
      <div className="flex flex-col items-center gap-3 px-20 py-6 w-full h-full justify-center">
        {page && (
          <Image src={page.imageUrl} alt={`Page ${page.pageNumber}`}
            width={800} height={1100}
            className="max-h-[90vh] w-auto rounded-xl shadow-2xl object-contain"
            unoptimized />
        )}
        <p className="text-white/50 text-sm">{idx + 1} / {pages.length}</p>
      </div>
      <button type="button" onClick={() => setIdx((i) => Math.min(pages.length - 1, i + 1))} disabled={idx === pages.length - 1}
        className="absolute right-5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white disabled:opacity-20 transition-colors">
        <span className="material-symbols-outlined text-5xl">chevron_right</span>
      </button>
    </div>
  );
}

// ── Generation progress bar ───────────────────────────────────────────────────
function GenerationProgressBar({
  total, done, generating, errors, pending, unit = 'panel',
}: {
  total: number; done: number; generating: number; errors: number; pending: number; unit?: 'panel' | 'page';
}) {
  const allDone = total > 0 && pending === 0 && errors === 0 && done === total;
  const prevAllDoneRef = useRef(false);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (allDone && !prevAllDoneRef.current) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 400);
      prevAllDoneRef.current = true;
      return () => clearTimeout(t);
    }
    if (!allDone) prevAllDoneRef.current = false;
  }, [allDone]);

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const greenW = total > 0 ? (done / total) * 100 : 0;
  const yellowW = total > 0 ? (generating / total) * 100 : 0;
  const redW = total > 0 ? (errors / total) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Bar row */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 overflow-hidden"
          style={{ height: 8, borderRadius: 4, background: '#E5E7EB' }}
        >
          {/* Segments: no gap, inline-flex */}
          <div className="flex h-full" style={{ borderRadius: 4, overflow: 'hidden' }}>
            {greenW > 0 && (
              <div
                className="h-full transition-[width] duration-500"
                style={{
                  width: `${greenW}%`,
                  background: '#22C55E',
                  boxShadow: celebrating ? '0 0 10px #22C55E' : undefined,
                  transition: celebrating ? 'box-shadow 0.15s ease-in-out, width 0.5s' : 'width 0.5s',
                }}
              />
            )}
            {yellowW > 0 && (
              <div
                className="h-full animate-pulse"
                style={{ width: `${yellowW}%`, background: '#F59E0B' }}
              />
            )}
            {redW > 0 && (
              <div
                className="h-full transition-[width] duration-500"
                style={{ width: `${redW}%`, background: '#EF4444' }}
              />
            )}
          </div>
        </div>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: allDone ? '#22C55E' : '#111827', minWidth: 36, textAlign: 'right' }}
        >
          {pct}%
        </span>
      </div>

      {/* Label row */}
      <p className={`text-xs ${celebrating ? 'animate-[pulse_0.3s_ease-in-out_1]' : ''}`}>
        {allDone ? (
          <span className="font-semibold" style={{ color: '#22C55E' }}>
            ✓ All {total} {unit}s generated!
          </span>
        ) : (
          <>
            <span style={{ color: '#22C55E', fontWeight: 600 }}>{done} generated</span>
            <span style={{ color: '#9CA3AF' }}> · {pending} pending</span>
            {errors > 0 && <span style={{ color: '#EF4444' }}> · {errors} errors</span>}
            {generating > 0 && <span style={{ color: '#F59E0B' }}> · {generating} running</span>}
          </>
        )}
      </p>
    </div>
  );
}// ── Layout template constants (mirrors backend LAYOUT_TEMPLATES) ──────────────

const TEMPLATES_BY_COUNT: Record<number, string[]> = {
  1: ['full_bleed'],
  2: ['diagonal_split_2'],
  3: ['three_panels_row', 'one_large_two_small', 'two_small_one_large', 'diagonal_3_panels', 'cinematic_strips'],
  4: ['grid_2x2', 'action_dynamic_4', 'splash_top', 'splash_bottom', 'asymmetric_4', 'vertical_flow'],
  5: ['manga_classic_5'],
  6: ['cinematic_strips'],
};

const LAYOUT_DISPLAY_NAMES_MAP: Record<string, string> = {
  full_bleed: 'Full Bleed', diagonal_split_2: 'Diagonal Split',
  one_large_two_small: 'Feature Left', two_small_one_large: 'Feature Right',
  three_panels_row: 'Three Row', diagonal_3_panels: 'Diagonal 3',
  cinematic_strips: 'Cinematic', grid_2x2: '2×2 Grid',
  action_dynamic_4: 'Action ✕', splash_top: 'Splash Top',
  splash_bottom: 'Splash Bottom', asymmetric_4: 'Asymmetric',
  vertical_flow: 'Flow', manga_classic_5: 'Classic 5',
};

// SVG panel rects for each template (48×64 viewport)
const LAYOUT_SVGS: Record<string, React.ReactNode> = {
  full_bleed:        <rect x="2" y="2" width="44" height="60" rx="1" fill="currentColor"/>,
  diagonal_split_2:  <><polygon points="2,2 32,2 24,62 2,62" fill="currentColor"/><polygon points="34,2 46,2 46,62 26,62" fill="currentColor"/></>,
  one_large_two_small: <><rect x="2" y="2" width="26" height="60" rx="1" fill="currentColor"/><rect x="31" y="2" width="15" height="28" rx="1" fill="currentColor"/><rect x="31" y="33" width="15" height="29" rx="1" fill="currentColor"/></>,
  two_small_one_large: <><rect x="2" y="2" width="15" height="28" rx="1" fill="currentColor"/><rect x="2" y="33" width="15" height="29" rx="1" fill="currentColor"/><rect x="20" y="2" width="26" height="60" rx="1" fill="currentColor"/></>,
  three_panels_row:  <><rect x="2" y="2" width="12" height="60" rx="1" fill="currentColor"/><rect x="17" y="2" width="14" height="60" rx="1" fill="currentColor"/><rect x="34" y="2" width="12" height="60" rx="1" fill="currentColor"/></>,
  diagonal_3_panels: <><rect x="2" y="2" width="44" height="24" rx="1" fill="currentColor"/><polygon points="2,28 22,28 17,62 2,62" fill="currentColor"/><polygon points="24,28 46,28 46,62 19,62" fill="currentColor"/></>,
  cinematic_strips:  <><rect x="2" y="2" width="44" height="17" rx="1" fill="currentColor"/><rect x="2" y="23" width="44" height="17" rx="1" fill="currentColor"/><rect x="2" y="44" width="44" height="18" rx="1" fill="currentColor"/></>,
  grid_2x2:          <><rect x="2" y="2" width="20" height="28" rx="1" fill="currentColor"/><rect x="26" y="2" width="20" height="28" rx="1" fill="currentColor"/><rect x="2" y="34" width="20" height="28" rx="1" fill="currentColor"/><rect x="26" y="34" width="20" height="28" rx="1" fill="currentColor"/></>,
  action_dynamic_4:  <><polygon points="2,2 21,2 18,30 2,30" fill="currentColor"/><polygon points="27,2 46,2 46,30 29,30" fill="currentColor"/><polygon points="2,33 18,33 21,62 2,62" fill="currentColor"/><polygon points="29,33 46,33 46,62 27,62" fill="currentColor"/></>,
  splash_top:        <><rect x="2" y="2" width="44" height="34" rx="1" fill="currentColor"/><rect x="2" y="39" width="12" height="23" rx="1" fill="currentColor"/><rect x="18" y="39" width="12" height="23" rx="1" fill="currentColor"/><rect x="34" y="39" width="12" height="23" rx="1" fill="currentColor"/></>,
  splash_bottom:     <><rect x="2" y="2" width="12" height="23" rx="1" fill="currentColor"/><rect x="18" y="2" width="12" height="23" rx="1" fill="currentColor"/><rect x="34" y="2" width="12" height="23" rx="1" fill="currentColor"/><rect x="2" y="28" width="44" height="34" rx="1" fill="currentColor"/></>,
  asymmetric_4:      <><rect x="2" y="2" width="25" height="36" rx="1" fill="currentColor"/><rect x="30" y="2" width="16" height="16" rx="1" fill="currentColor"/><rect x="30" y="21" width="16" height="17" rx="1" fill="currentColor"/><rect x="2" y="41" width="44" height="21" rx="1" fill="currentColor"/></>,
  vertical_flow:     <><rect x="2" y="2" width="13" height="28" rx="1" fill="currentColor"/><rect x="18" y="2" width="28" height="28" rx="1" fill="currentColor"/><rect x="2" y="34" width="24" height="28" rx="1" fill="currentColor"/><rect x="29" y="34" width="17" height="28" rx="1" fill="currentColor"/></>,
  manga_classic_5:   <><rect x="2" y="2" width="27" height="22" rx="1" fill="currentColor"/><rect x="32" y="2" width="14" height="22" rx="1" fill="currentColor"/><rect x="2" y="27" width="15" height="16" rx="1" fill="currentColor"/><rect x="20" y="27" width="26" height="16" rx="1" fill="currentColor"/><rect x="2" y="46" width="44" height="16" rx="1" fill="currentColor"/></>,
};

// Panel bounding boxes in 48×64 coordinate space — mirrors LAYOUT_SVGS positions (polygons use bbox)
const LAYOUT_PANEL_RECTS: Record<string, Array<{ x: number; y: number; w: number; h: number }>> = {
  full_bleed:        [{ x:2,  y:2,  w:44, h:60 }],
  diagonal_split_2:  [{ x:2,  y:2,  w:30, h:60 }, { x:26, y:2,  w:20, h:60 }],
  one_large_two_small: [{ x:2,  y:2,  w:26, h:60 }, { x:31, y:2,  w:15, h:28 }, { x:31, y:33, w:15, h:29 }],
  two_small_one_large: [{ x:2,  y:2,  w:15, h:28 }, { x:2,  y:33, w:15, h:29 }, { x:20, y:2,  w:26, h:60 }],
  three_panels_row:  [{ x:2,  y:2,  w:12, h:60 }, { x:17, y:2,  w:14, h:60 }, { x:34, y:2,  w:12, h:60 }],
  diagonal_3_panels: [{ x:2,  y:2,  w:44, h:24 }, { x:2,  y:28, w:20, h:34 }, { x:19, y:28, w:27, h:34 }],
  cinematic_strips:  [{ x:2,  y:2,  w:44, h:17 }, { x:2,  y:23, w:44, h:17 }, { x:2,  y:44, w:44, h:18 }],
  grid_2x2:          [{ x:2,  y:2,  w:20, h:28 }, { x:26, y:2,  w:20, h:28 }, { x:2,  y:34, w:20, h:28 }, { x:26, y:34, w:20, h:28 }],
  action_dynamic_4:  [{ x:2,  y:2,  w:19, h:28 }, { x:27, y:2,  w:19, h:28 }, { x:2,  y:33, w:19, h:29 }, { x:27, y:33, w:19, h:29 }],
  splash_top:        [{ x:2,  y:2,  w:44, h:34 }, { x:2,  y:39, w:12, h:23 }, { x:18, y:39, w:12, h:23 }, { x:34, y:39, w:12, h:23 }],
  splash_bottom:     [{ x:2,  y:2,  w:12, h:23 }, { x:18, y:2,  w:12, h:23 }, { x:34, y:2,  w:12, h:23 }, { x:2,  y:28, w:44, h:34 }],
  asymmetric_4:      [{ x:2,  y:2,  w:25, h:36 }, { x:30, y:2,  w:16, h:16 }, { x:30, y:21, w:16, h:17 }, { x:2,  y:41, w:44, h:21 }],
  vertical_flow:     [{ x:2,  y:2,  w:13, h:28 }, { x:18, y:2,  w:28, h:28 }, { x:2,  y:34, w:24, h:28 }, { x:29, y:34, w:17, h:28 }],
  manga_classic_5:   [{ x:2,  y:2,  w:27, h:22 }, { x:32, y:2,  w:14, h:22 }, { x:2,  y:27, w:15, h:16 }, { x:20, y:27, w:26, h:16 }, { x:2,  y:46, w:44, h:16 }],
};

function LayoutPickerPanel({
  panelCount,
  selectedLayout,
  onSelect,
  suggestion,
  isSuggLoading,
  onGetSuggestion,
}: {
  panelCount: number;
  selectedLayout: string;
  onSelect: (name: string) => void;
  suggestion: { suggested: string; reason: string } | null;
  isSuggLoading: boolean;
  onGetSuggestion: () => void;
}) {
  const options = TEMPLATES_BY_COUNT[panelCount] ?? [];

  return (
    <div className="space-y-3">
      {/* AI Suggest button */}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={onGetSuggestion} disabled={isSuggLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors disabled:opacity-50">
          {isSuggLoading
            ? <><span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />Thinking…</>
            : '✨ AI Suggest Layout'}
        </button>
        {suggestion && (
          <span className="text-xs text-on-surface-variant">
            → <span className="font-semibold text-on-surface">{LAYOUT_DISPLAY_NAMES_MAP[suggestion.suggested] ?? suggestion.suggested}</span>
          </span>
        )}
      </div>
      {suggestion?.reason && (
        <p className="text-[11px] text-on-surface-variant bg-surface-container px-3 py-2 rounded-xl leading-relaxed">
          💡 {suggestion.reason}
        </p>
      )}

      {/* Template card grid */}
      {options.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {options.map((name) => {
            const isSelected = selectedLayout === name;
            const isSuggested = suggestion?.suggested === name && !isSelected;
            return (
              <button key={name} type="button" onClick={() => onSelect(name)}
                className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : isSuggested
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-outline-variant/20 hover:border-primary/30 hover:bg-surface-container-low'
                }`}>
                {isSelected && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold leading-none">✓</span>
                  </span>
                )}
                {isSuggested && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary/40 flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold leading-none">✨</span>
                  </span>
                )}
                <svg viewBox="0 0 48 64" className="w-8 h-[42px]" fill="none" xmlns="http://www.w3.org/2000/svg"
                  style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-outline-variant)' }}>
                  {LAYOUT_SVGS[name] ?? <rect x="2" y="2" width="44" height="60" rx="1" fill="currentColor"/>}
                </svg>
                <span className="text-[10px] font-semibold text-on-surface-variant leading-tight text-center line-clamp-1">
                  {LAYOUT_DISPLAY_NAMES_MAP[name] ?? name}
                </span>
                <span className="text-[9px] text-outline">{panelCount}p</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}



// ── Canvas studio: zoom constants ─────────────────────────────────────────────
const LAYOUT_BASE_PAGE_W = 600;
const LAYOUT_BASE_PAGE_H = 800;
const LAYOUT_ZOOM_PRESETS = [0.5, 0.75, 1.0];
function clampLayoutZoom(v: number) { return Math.max(0.25, Math.min(2.0, v)); }
function computeLayoutFitZoom(viewW: number, viewH: number): number {
  const scaleW = (viewW - 96) / LAYOUT_BASE_PAGE_W;
  const scaleH = (viewH - 96) / LAYOUT_BASE_PAGE_H;
  return Math.min(scaleW, scaleH, 1.0);
}

// ── Canvas studio: page canvas showing panel slots ────────────────────────────
function LayoutPageCanvas({
  panels,
  panelStates,
  layoutName,
  onGeneratePanel,
}: {
  panels: Step4Panel[];
  panelStates: Record<string, { status: string; imageUrl: string | null; error: string | null } | null>;
  layoutName: string;
  onGeneratePanel: (panel: Step4Panel) => void;
}) {
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const spaceDownRef = useRef(false);
  const panStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); spaceDownRef.current = true; }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceDownRef.current = false; panStartRef.current = null; }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => clampLayoutZoom(parseFloat((z + delta).toFixed(2))));
  }, []);

  const rects = LAYOUT_PANEL_RECTS[layoutName] ?? [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Canvas viewport */}
      <div ref={canvasAreaRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#E8E8E8', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24 }}
        onWheel={onWheel}
        onMouseDown={(e) => {
          if (!spaceDownRef.current) return;
          e.preventDefault();
          panStartRef.current = { mx: e.clientX, my: e.clientY, ox: panOffset.x, oy: panOffset.y };
        }}
        onMouseMove={(e) => {
          if (!panStartRef.current) return;
          setPanOffset({ x: panStartRef.current.ox + e.clientX - panStartRef.current.mx, y: panStartRef.current.oy + e.clientY - panStartRef.current.my });
        }}
        onMouseUp={() => { panStartRef.current = null; }}
      >
        <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: 'top center', flexShrink: 0 }}>
          <div style={{ position: 'relative', width: LAYOUT_BASE_PAGE_W, height: LAYOUT_BASE_PAGE_H, background: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
            {panels.map((panel, idx) => {
              const rect = rects[idx];
              if (!rect) return null;
              const ps = panelStates[panel.id] ?? null;
              const imageUrl = ps?.imageUrl ?? null;
              const isLoading = ps?.status === 'loading';
              const isError = ps?.status === 'error';
              const left   = `${(rect.x / 48) * 100}%`;
              const top    = `${(rect.y / 64) * 100}%`;
              const width  = `${(rect.w / 48) * 100}%`;
              const height = `${(rect.h / 64) * 100}%`;
              return (
                <div key={panel.id} style={{ position: 'absolute', left, top, width, height, border: '2px solid #ddd', overflow: 'hidden', boxSizing: 'border-box' }}>
                  {imageUrl ? (
                    <div className="relative w-full h-full group">
                      <img src={imageUrl} alt={`Panel ${panel.panelNumber}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none group-hover:pointer-events-auto">
                        <button type="button" onClick={() => onGeneratePanel(panel)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold backdrop-blur-sm">
                          ↺ Regen
                        </button>
                      </div>
                    </div>
                  ) : isLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ background: '#F3F4F6' }}>
                      <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <span style={{ fontSize: 9, color: '#6B7280' }}>Generating…</span>
                    </div>
                  ) : isError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer" style={{ background: '#FEF2F2' }} onClick={() => onGeneratePanel(panel)}>
                      <span style={{ fontSize: 14 }}>⚠</span>
                      <span style={{ fontSize: 9, color: '#EF4444', fontWeight: 700 }}>Retry</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors hover:bg-primary/5" style={{ background: '#F9FAFB' }} onClick={() => onGeneratePanel(panel)}>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>P{panel.panelNumber}</span>
                      <span className="text-primary font-bold" style={{ fontSize: 9, opacity: 0.6 }}>⚡ Generate</span>
                    </div>
                  )}
                  <span style={{ position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, lineHeight: 1.4, pointerEvents: 'none' }}>
                    P{panel.panelNumber}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zoom bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '6px 16px', borderTop: '1px solid var(--color-outline)', flexShrink: 0, background: 'var(--color-surface-container-lowest)' }}>
        <button type="button" onClick={() => setZoom(z => clampLayoutZoom(parseFloat((z - 0.1).toFixed(2))))}
          style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--color-outline)', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          −
        </button>
        {LAYOUT_ZOOM_PRESETS.map(z => (
          <button key={z} type="button" onClick={() => setZoom(z)}
            style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: zoom === z ? 700 : 400, border: `1px solid ${zoom === z ? 'var(--color-primary)' : 'var(--color-outline)'}`, background: zoom === z ? 'rgba(0,88,190,0.08)' : 'none', color: zoom === z ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', cursor: 'pointer' }}>
            {Math.round(z * 100)}%
          </button>
        ))}
        <button type="button" onClick={() => setZoom(z => clampLayoutZoom(parseFloat((z + 0.1).toFixed(2))))}
          style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--color-outline)', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          +
        </button>
        <button type="button" onClick={() => {
          if (!canvasAreaRef.current) return;
          const r = canvasAreaRef.current.getBoundingClientRect();
          setZoom(computeLayoutFitZoom(r.width, r.height));
          setPanOffset({ x: 0, y: 0 });
        }} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, border: '1px solid var(--color-outline)', background: 'none', color: 'var(--color-on-surface-variant)', cursor: 'pointer' }}>
          ⊡ Fit
        </button>
        <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', minWidth: 32 }}>
          {Math.round(zoom * 100)}%
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', marginLeft: 8 }}>
          Ctrl+scroll to zoom · Space+drag to pan
        </span>
      </div>
    </div>
  );
}

// ── Canvas studio: right sidebar ──────────────────────────────────────────────
function LayoutStudioSidebar({
  pageNumber,
  totalPages,
  panels,
  panelStates,
  panelStats,
  isImageGenerating,
  isPaused,
  comicPageMode,
  onSetPageMode,
  onGenerateAll,
  onPause,
  onResume,
  sfxMode,
  onSetSfxMode,
  layoutName,
  onSelectLayout,
  suggestion,
  isSuggLoading,
  onGetSuggestion,
  artStyle,
}: {
  pageNumber: number;
  totalPages: number;
  panels: Step4Panel[];
  panelStates: Record<string, { status: string; imageUrl: string | null; error: string | null } | null>;
  panelStats: { total: number; done: number; generating: number; errors: number; pending: number };
  isImageGenerating: boolean;
  isPaused: boolean;
  comicPageMode: 'page' | 'panel';
  onSetPageMode: (m: 'page' | 'panel') => void;
  onGenerateAll: () => void;
  onPause: () => void;
  onResume: () => void;
  sfxMode: 'auto' | 'manual';
  onSetSfxMode: (m: 'auto' | 'manual') => void;
  layoutName: string;
  onSelectLayout: (name: string) => void;
  suggestion: { suggested: string; reason: string } | null;
  isSuggLoading: boolean;
  onGetSuggestion: () => void;
  artStyle: string;
}) {
  const options = TEMPLATES_BY_COUNT[panels.length] ?? [];
  const isAllDone = panelStats.total > 0 && panelStats.done >= panelStats.total && !isImageGenerating;
  const donePct = panelStats.total > 0 ? Math.round((panelStats.done / panelStats.total) * 100) : 0;

  return (
    <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid #E5E7EB', background: '#FFFFFF', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── LAYOUT TEMPLATE ── (mirrors "DRAG TO ADD BUBBLE" section) */}
        <div style={{ padding: '16px 12px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#374151', textTransform: 'uppercase', margin: 0 }}>
              Layout Template
            </p>
            <button type="button" onClick={onGetSuggestion} disabled={isSuggLoading}
              style={{ fontSize: 11, color: '#4F46E5', fontWeight: 600, background: 'none', border: 'none', cursor: isSuggLoading ? 'default' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, opacity: isSuggLoading ? 0.5 : 1 }}>
              {isSuggLoading
                ? <><span className="w-3 h-3 border border-gray-300 border-t-indigo-600 rounded-full animate-spin" />Thinking…</>
                : '✨ AI Suggest'}
            </button>
          </div>
          {suggestion?.reason && (
            <p style={{ fontSize: 11, color: '#6B7280', background: '#F3F4F6', borderRadius: 8, padding: '6px 10px', marginBottom: 10, lineHeight: 1.5 }}>
              💡 {suggestion.reason}
            </p>
          )}
          {/* Template cards — same visual style as bubble type buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {options.map((name) => {
              const isSelected = layoutName === name;
              const isSugg = suggestion?.suggested === name && !isSelected;
              return (
                <button key={name} type="button" onClick={() => onSelectLayout(name)}
                  style={{
                    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 3, padding: '8px 4px 6px', borderRadius: 10,
                    border: `2px solid ${isSelected ? '#4F46E5' : isSugg ? 'rgba(79,70,229,0.4)' : '#E5E7EB'}`,
                    background: isSelected ? '#EEF2FF' : isSugg ? 'rgba(79,70,229,0.04)' : '#F9FAFB',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}>
                  {isSelected && (
                    <span style={{ position: 'absolute', top: 3, right: 3, width: 12, height: 12, borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined text-white" style={{ fontSize: 8 }}>check</span>
                    </span>
                  )}
                  <svg viewBox="0 0 48 64" style={{ width: 28, height: 37, color: isSelected ? '#4F46E5' : '#9CA3AF' }} fill="none">
                    {LAYOUT_SVGS[name] ?? <rect x="2" y="2" width="44" height="60" rx="1" fill="currentColor"/>}
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: 600, color: isSelected ? '#4F46E5' : '#6B7280', lineHeight: 1.2, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {LAYOUT_DISPLAY_NAMES_MAP[name] ?? name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: 1, background: '#E5E7EB' }} />

        {/* ── Generate action button ── (mirrors "Auto-import from script") */}
        <div style={{ padding: '12px 12px' }}>
          {isAllDone ? (
            <div style={{ borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '10px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#065F46', margin: 0 }}>✓ All {panelStats.total} panels generated!</p>
            </div>
          ) : isImageGenerating && !isPaused ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Generating panels…</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', fontVariantNumeric: 'tabular-nums' }}>{donePct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#E5E7EB', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#22C55E', width: `${donePct}%`, transition: 'width 0.5s', borderRadius: 2 }} />
                </div>
                <p style={{ fontSize: 10, color: '#6B7280', marginTop: 6, marginBottom: 0 }}>{panelStats.done}/{panelStats.total} panels done</p>
              </div>
              <button type="button" onClick={onPause}
                style={{ width: '100%', height: 44, borderRadius: 10, border: '1.5px solid #4F46E5', background: 'transparent', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>pause</span>
                Pause Generation
              </button>
            </div>
          ) : isPaused ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#92400E', margin: 0 }}>Paused — {panelStats.done}/{panelStats.total} done</p>
              </div>
              <button type="button" onClick={onResume}
                style={{ width: '100%', height: 44, borderRadius: 10, border: '1.5px solid #4F46E5', background: 'transparent', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
                Resume Generation
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {panelStats.done > 0 && (
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
                  <span style={{ color: '#22C55E', fontWeight: 600 }}>{panelStats.done}/{panelStats.total}</span> panels already generated
                </p>
              )}
              <button type="button" onClick={onGenerateAll}
                style={{ width: '100%', height: 44, borderRadius: 10, border: '1.5px solid #4F46E5', background: 'transparent', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
                {panelStats.done === 0 ? 'Generate All Panels' : 'Regen Remaining'}
              </button>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ flexShrink: 0, marginTop: 1 }}>
                  <input type="checkbox" checked={sfxMode === 'manual'} onChange={(e) => onSetSfxMode(e.target.checked ? 'manual' : 'auto')} className="sr-only" />
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${sfxMode === 'manual' ? '#4F46E5' : '#D1D5DB'}`, background: sfxMode === 'manual' ? '#4F46E5' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sfxMode === 'manual' && <span className="material-symbols-outlined text-white" style={{ fontSize: 10 }}>check</span>}
                  </div>
                </div>
                <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, margin: 0 }}>Clean images (no embedded text)</p>
              </label>
              {/* Mode toggle — compact link */}
              <button type="button" onClick={() => onSetPageMode(comicPageMode === 'panel' ? 'page' : 'panel')}
                style={{ fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                Switch to {comicPageMode === 'panel' ? 'Full Page' : 'Panel by Panel'} mode →
              </button>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: '#E5E7EB' }} />

        {/* ── PAGE SUMMARY ── (mirrors page summary section in DialogueEditor) */}
        <div style={{ padding: '12px 12px 16px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#374151', textTransform: 'uppercase', marginBottom: 10 }}>
            Page Summary
            <span style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
              {pageNumber}/{totalPages}
            </span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {panels.map((panel) => {
              const ps = panelStates[panel.id] ?? null;
              const hasImage = !!ps?.imageUrl;
              const isLoading = ps?.status === 'loading';
              const isError = ps?.status === 'error';
              return (
                <div key={panel.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ marginTop: 10, flexShrink: 0 }} className={`w-2 h-2 rounded-full ${
                    hasImage ? 'bg-emerald-500' : isLoading ? 'bg-amber-400 animate-pulse' : isError ? 'bg-red-400' : 'bg-gray-300'
                  }`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <PanelScriptCard panel={panel} artStyle={artStyle} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Step4Generation() {
  const {
    step4,
    step3,
    step4PanelsByPage,
    step4Stats,
    handleGenerate,
    handleApprove,
    handleRetry,
    handleStartFullGeneration,
    handleStartPanelGeneration,
    handleRegenerateSinglePanel,
    handleRegeneratePage,
    handleRegenerateWithFeedback,
    acceptPanelRegen,
    rejectPanelRegen,
    artStyle,
    projectId,
    getCooldownSeconds,
    setActiveStep,
    sfxMode,
    setSfxMode,
    pageLayoutNames,
    pagePanelDimensions,
    setPageLayout,
  } = useComicGeneration();

  const [isPaused, setIsPaused] = useState(false);
  const [showFinishErrorModal, setShowFinishErrorModal] = useState(false);
  const [regenModal, setRegenModal] = useState<{
    pageNumber: number;
    contextLabel: string;
    currentImageUrl: string | null;
    prevFeedback: string;
  } | null>(null);
  const [toasts, setToasts] = useState<{ id: string; label: string; pageNumber: number; panelId: string }[]>([]);
  const [showConfetti] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // ── Generation mode ───────────────────────────────────────────────────────
  type ComicPageMode = 'page' | 'panel';
  const [comicPageMode, setComicPageMode] = useState<ComicPageMode>('page');

  // ── Bubble dialogue state ─────────────────────────────────────────────────
  const [panelBubbles, setPanelBubbles] = useState<Record<string, PanelBubbles>>({});
  const bubblesLoadedRef = useRef(false);

  // ── Layout suggestion state ───────────────────────────────────────────────
  const [layoutSuggestions, setLayoutSuggestions] = useState<Record<number, { suggested: string; reason: string } | null>>({});
  const [layoutSuggestLoading, setLayoutSuggestLoading] = useState<Record<number, boolean>>({});

  // ── Canvas studio page navigation ─────────────────────────────────────────
  const [studioPage, setStudioPage] = useState(1);

  // ── Tab navigation ────────────────────────────────────────────────────────
  type Step4Tab = 'layout' | 'dialogue';
  const [activeStep4Tab, setActiveStep4Tab] = useState<Step4Tab>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('mohiom-step4-tab-v2') as Step4Tab | null;
      return saved === 'dialogue' ? 'dialogue' : 'layout';
    }
    return 'layout';
  });
  const [showCompletionNudge, setShowCompletionNudge] = useState(false);
  const prevAllImgDoneRef = useRef(false);


  // ── Panel-level stats (panel mode) ────────────────────────────────────────
  const panelStats = useMemo(() => {
    const allPanels = step4.data?.panels ?? [];
    const states = step4.data?.panelStates ?? {};
    return {
      total: allPanels.length,
      done: allPanels.filter((p) => states[p.id]?.imageUrl != null).length,
      generating: allPanels.filter((p) => states[p.id]?.status === 'loading').length,
      errors: allPanels.filter((p) => states[p.id]?.status === 'error').length,
      pending: allPanels.filter((p) => !states[p.id] || states[p.id]?.status === 'idle').length,
    };
  }, [step4.data]);

  const autoImportDialogue = useCallback(() => {
    const bubbles: Record<string, PanelBubbles> = {};
    for (const [, panels] of step4PanelsByPage) {
      for (const p of panels) {
        const text = stripBold(p.dialogueSfx ?? '');
        if (text && text !== 'No dialogue/SFX provided.') {
          const isSfx = /^<.+>$/.test(text.trim());
          const isThought = text.startsWith('*');
          const bubbleType: BubbleType = isSfx ? 'sfx' : isThought ? 'thought' : 'speech';
          const tailDir = bubbleType === 'sfx' ? 'none' as const : 'down-left' as const;
          const sfxRotation = isSfx ? Math.round((Math.random() * 20 - 10)) : 0;
          const defaultFontSize = isSfx ? 24 : isThought ? 12 : 13;
          const newBubble: SingleBubble = {
            id: genBubbleId(),
            dialogue: text, bubbleType, tailDir,
            bubblePosition: { x: 0.5, y: 0.3 },
            bubbleSize: { w: isSfx ? 180 : 160, h: isSfx ? 90 : 80 },
            fontSize: defaultFontSize,
            rotation: sfxRotation,
            opacity: 1,
            zIndex: 0,
          };
          bubbles[p.id] = [newBubble];
        }
      }
    }
    setPanelBubbles((prev) => ({ ...prev, ...bubbles }));
  }, [step4PanelsByPage]);

  const handleSuggestLayout = useCallback(async (pageNumber: number, panels: Step4Panel[]) => {
    setLayoutSuggestLoading((prev) => ({ ...prev, [pageNumber]: true }));
    try {
      const res = await comicLayoutApi.suggest({
        panel_count: panels.length,
        panels: panels.map((p) => ({ shot_type: p.shotType ?? undefined })),
      });
      setLayoutSuggestions((prev) => ({ ...prev, [pageNumber]: { suggested: res.data.suggested, reason: res.data.reason } }));
      const knownTemplates = TEMPLATES_BY_COUNT[panels.length] ?? [];
      if (knownTemplates.includes(res.data.suggested)) {
        setPageLayout(pageNumber, res.data.suggested, panels);
      }
    } catch {
      // silently fail
    } finally {
      setLayoutSuggestLoading((prev) => ({ ...prev, [pageNumber]: false }));
    }
  }, [setPageLayout]);

  // Auto-initialize layout selection for each page when panels first become available
  const hasInitializedLayoutsRef = useRef(false);
  useEffect(() => {
    if (!step4.data?.panels.length || hasInitializedLayoutsRef.current) return;
    hasInitializedLayoutsRef.current = true;
    for (const [pageNumber, panels] of step4PanelsByPage) {
      if (!pageLayoutNames[pageNumber]) {
        const defaultLayout = TEMPLATES_BY_COUNT[panels.length]?.[0] ?? 'grid_2x2';
        setPageLayout(pageNumber, defaultLayout, panels);
      }
    }
  }, [step4.data?.panels.length, step4PanelsByPage, pageLayoutNames, setPageLayout]);

  // Reset layout init flag when step4 panels are rebuilt
  useEffect(() => {
    if (!step4.data?.panels.length) {
      hasInitializedLayoutsRef.current = false;
    }
  }, [step4.data?.panels.length]);


  const cooldown = getCooldownSeconds(4);
  const isGenerating = step4.isLoading;
  const canBuildPanels = !isGenerating && cooldown === 0 && !!step3.data;
  const isImageGenerating = !!step4.data?.isGenerating;

  // "Currently drawing" label: first page in loading state
  const currentlyDrawing = (() => {
    if (!step4.data?.pageStates) return null;
    const entry = Object.entries(step4.data.pageStates as Record<string, { status: string }>)
      .find(([, v]) => v.status === 'loading');
    if (!entry) return null;
    return entry[0].replace('page-', 'Page ');
  })();

  // Derive state
  let state: State = 1;
  if (isGenerating) {
    state = 2;
  } else if (step4.isApproved && !step4.regeneratedAfterApproval) {
    state = 4;
  } else if (step4.data && step4.regeneratedAfterApproval) {
    state = 5;
  } else if (step4.data) {
    state = 3;
  }

  // Auto-start image generation after panels finish building
  const wasBuildingRef = useRef(false);
  useEffect(() => {
    if (state === 2) { wasBuildingRef.current = true; return; }
    if (state === 3 && wasBuildingRef.current) {
      wasBuildingRef.current = false;
      handleStartFullGeneration();
    }
  }, [state, handleStartFullGeneration]);

  // All panels flat for grid/list views
  const allPanels = step4PanelsByPage.flatMap(([, panels]) => panels);


  // Panel info map (label + pageNumber) for toasts
  const panelInfoMap = useMemo(() => {
    const map: Record<string, { label: string; pageNumber: number }> = {};
    for (const [pageNumber, panels] of step4PanelsByPage) {
      for (const p of panels) map[p.id] = { label: p.contextLabel, pageNumber };
    }
    return map;
  }, [step4PanelsByPage]);
  const panelInfoMapRef = useRef(panelInfoMap);
  panelInfoMapRef.current = panelInfoMap;

  // Detect new panel errors → fire toasts
  const prevPanelStatesRef = useRef<Record<string, string>>({});
  const toastTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!step4.data?.panelStates) return;
    const current = step4.data.panelStates as Record<string, { status: string }>;
    const prev = prevPanelStatesRef.current;
    for (const [panelId, ps] of Object.entries(current)) {
      if (prev[panelId] !== 'error' && ps.status === 'error') {
        const info = panelInfoMapRef.current[panelId];
        const toastId = `${panelId}-${Date.now()}`;
        setToasts((t) => [...t.slice(-3), { id: toastId, label: info?.label ?? 'Panel', pageNumber: info?.pageNumber ?? 0, panelId }]);
        toastTimeoutsRef.current[toastId] = setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== toastId));
          delete toastTimeoutsRef.current[toastId];
        }, 6000);
      }
    }
    prevPanelStatesRef.current = Object.fromEntries(Object.entries(current).map(([k, v]) => [k, v.status]));
  }, [step4.data?.panelStates]);

  // Clear toast timers on unmount
  useEffect(() => {
    const ref = toastTimeoutsRef.current;
    return () => { Object.values(ref).forEach(clearTimeout); };
  }, []);

  // Load saved bubbles from MongoDB on mount
  useEffect(() => {
    if (!projectId || bubblesLoadedRef.current) return;
    bubblesLoadedRef.current = true;
    bubblesApi.getForComic(projectId).then((res) => {
      const map: Record<string, PanelBubbles> = {};
      for (const doc of res.data) map[doc.panelId] = doc.bubbles as PanelBubbles;
      if (Object.keys(map).length > 0) setPanelBubbles((prev) => ({ ...map, ...prev }));
    }).catch(() => {});
  }, [projectId]);

  const dismissToast = (id: string) => {
    clearTimeout(toastTimeoutsRef.current[id]);
    delete toastTimeoutsRef.current[id];
    setToasts((t) => t.filter((x) => x.id !== id));
  };

  // Active stats — switches source based on mode (panel or page)
  const activeStats = useMemo(() =>
    comicPageMode === 'panel'
      ? { total: panelStats.total, success: panelStats.done, loading: panelStats.generating, error: panelStats.errors }
      : { total: step4Stats.total, success: step4Stats.success, loading: step4Stats.loading, error: step4Stats.error },
  [comicPageMode, panelStats, step4Stats]);

  const retryErrorPages = () => {
    if (!step4.data?.pageStates) return;
    const errorPages = Object.entries(step4.data.pageStates as Record<string, { status: string }>)
      .filter(([, v]) => v.status === 'error')
      .map(([k]) => Number(k.replace('page-', '')));
    errorPages.forEach((pn) => handleRegeneratePage(pn));
    setShowFinishErrorModal(false);
  };

  // Tab persistence
  useEffect(() => {
    sessionStorage.setItem('mohiom-step4-tab-v2', activeStep4Tab);
  }, [activeStep4Tab]);

  // Completion nudge
  useEffect(() => {
    const isAllDone = activeStats.total > 0 && activeStats.success === activeStats.total && activeStats.error === 0 && !isImageGenerating;
    if (isAllDone && !prevAllImgDoneRef.current) setShowCompletionNudge(true);
    prevAllImgDoneRef.current = isAllDone;
  }, [activeStats, isImageGenerating]);

  // Tab helpers
  const isTabLocked = useCallback((tab: Step4Tab) => {
    if (tab === 'layout') return false;
    if (tab === 'dialogue') return activeStats.success === 0;
    return false;
  }, [activeStats.success]);

  const handleTabChange = useCallback((tab: Step4Tab) => {
    if (isTabLocked(tab)) return;
    setActiveStep4Tab(tab);
    setShowCompletionNudge(false);
  }, [isTabLocked]);

  const panelsWithDialogue = allPanels.filter((p) =>
    (panelBubbles[p.id]?.length ?? 0) > 0
  ).length;

  return (
    <section className="text-on-surface pb-20">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-1 pt-1 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Image Generation</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Pick a layout, generate panels, and add dialogue
          </p>
        </div>
        <StateBadge state={state} />
      </div>

      {/* ── Tab Bar ── */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex items-center gap-8">
          {(
            [
              { id: 'layout' as Step4Tab, label: '⚡ Layout & Generate' },
              { id: 'dialogue' as Step4Tab, label: '💬 Dialogue' },
            ] as const
          ).map((tab) => {
            const locked = isTabLocked(tab.id);
            const active = activeStep4Tab === tab.id;

            let badgeText: string | null = null;
            let badgeVariant: 'complete' | 'progress' | 'gray' = 'progress';
            if (!locked) {
              if (tab.id === 'layout' && activeStats.total > 0) {
                if (activeStats.success === activeStats.total) {
                  badgeText = `${activeStats.total} ✓`; badgeVariant = 'complete';
                } else if (activeStats.success === 0) {
                  badgeText = `0/${activeStats.total}`; badgeVariant = 'gray';
                } else {
                  badgeText = `${activeStats.success}/${activeStats.total}`; badgeVariant = 'progress';
                }
              } else if (tab.id === 'dialogue') {
                if (panelsWithDialogue > 0) {
                  badgeText = `${panelsWithDialogue}/${allPanels.length}`; badgeVariant = 'progress';
                } else {
                  badgeText = 'Optional'; badgeVariant = 'gray';
                }
              }
            }

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                disabled={locked}
                title={locked ? 'Generate at least one image to unlock' : undefined}
                className={[
                  'flex items-center gap-2 pb-3 pt-1 -mb-px border-b-[3px] transition-colors whitespace-nowrap text-[13px]',
                  active
                    ? 'border-primary text-gray-900 font-semibold'
                    : locked
                    ? 'border-transparent text-gray-400 font-normal cursor-not-allowed'
                    : 'border-transparent text-gray-700 font-medium hover:text-gray-900 hover:border-gray-300',
                ].join(' ')}
              >
                <span>{tab.label}</span>
                {locked ? (
                  <span className="text-gray-400 text-[11px]">🔒</span>
                ) : badgeText ? (
                  <span className={[
                    'inline-flex items-center text-[11px] font-semibold px-2 leading-[18px] rounded-full',
                    badgeVariant === 'complete' ? 'bg-indigo-100 text-indigo-700' :
                    badgeVariant === 'progress' ? 'bg-indigo-50 text-indigo-500' :
                    'bg-gray-100 text-gray-500',
                  ].join(' ')}>
                    {badgeText}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════ TAB 1 — LAYOUT & GENERATE ═══════════ */}
      {activeStep4Tab === 'layout' && (
        comicPageMode === 'panel' && (state === 3 || state === 4 || state === 5) && step4PanelsByPage.length > 0 ? (
          /* ── PANEL CANVAS STUDIO ── */
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 560 }}>
            {/* Page navigation bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #E5E7EB', background: '#F8F9FA', flexShrink: 0 }}>
              <button type="button"
                onClick={() => setStudioPage((p) => Math.max(1, p - 1))}
                disabled={studioPage <= 1}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: studioPage > 1 ? 'pointer' : 'default', fontSize: 14, fontWeight: 500, color: studioPage > 1 ? '#374151' : '#C9CCD0', padding: '4px 8px' }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>‹</span> Prev
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {step4PanelsByPage.map(([pn]) => (
                    <button key={pn} type="button" onClick={() => setStudioPage(pn)}
                      style={{ width: pn === studioPage ? 12 : 8, height: pn === studioPage ? 12 : 8, borderRadius: '50%', border: 'none', background: pn === studioPage ? '#2563EB' : '#D1D5DB', cursor: 'pointer', padding: 0, transition: 'all 0.15s' }} />
                  ))}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
                  Page {studioPage} of {step4PanelsByPage.length}
                </span>
              </div>
              <button type="button"
                onClick={() => setStudioPage((p) => Math.min(step4PanelsByPage.length, p + 1))}
                disabled={studioPage >= step4PanelsByPage.length}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: studioPage < step4PanelsByPage.length ? 'pointer' : 'default', fontSize: 14, fontWeight: 500, color: studioPage < step4PanelsByPage.length ? '#374151' : '#C9CCD0', padding: '4px 8px' }}>
                Next <span style={{ fontSize: 16, lineHeight: 1 }}>›</span>
              </button>
            </div>
            {/* Canvas + Sidebar */}
            {(() => {
              const currentPageEntry = step4PanelsByPage.find(([n]) => n === studioPage) ?? step4PanelsByPage[0];
              const currentPageNum = currentPageEntry?.[0] ?? 1;
              const currentPagePanels = currentPageEntry?.[1] ?? [];
              const currentLayoutName = pageLayoutNames[currentPageNum] ?? TEMPLATES_BY_COUNT[currentPagePanels.length]?.[0] ?? 'grid_2x2';
              return (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                  <LayoutPageCanvas
                    panels={currentPagePanels}
                    panelStates={step4.data?.panelStates ?? {}}
                    layoutName={currentLayoutName}
                    onGeneratePanel={(panel) => handleRegenerateSinglePanel(panel)}
                  />
                  <LayoutStudioSidebar
                    pageNumber={currentPageNum}
                    totalPages={step4PanelsByPage.length}
                    panels={currentPagePanels}
                    panelStates={step4.data?.panelStates ?? {}}
                    panelStats={panelStats}
                    isImageGenerating={isImageGenerating}
                    isPaused={isPaused}
                    comicPageMode={comicPageMode}
                    onSetPageMode={setComicPageMode}
                    onGenerateAll={handleStartPanelGeneration}
                    onPause={() => setIsPaused(true)}
                    onResume={() => setIsPaused(false)}
                    sfxMode={sfxMode}
                    onSetSfxMode={setSfxMode}
                    layoutName={currentLayoutName}
                    onSelectLayout={(name) => setPageLayout(currentPageNum, name, currentPagePanels)}
                    suggestion={layoutSuggestions[currentPageNum] ?? null}
                    isSuggLoading={layoutSuggestLoading[currentPageNum] ?? false}
                    onGetSuggestion={() => handleSuggestLayout(currentPageNum, currentPagePanels)}
                    artStyle={artStyle}
                  />
                </div>
              );
            })()}
          </div>
        ) : (
        <div className="space-y-6">

          {/* Generation Dashboard */}
          {(() => {
            const waiting = Math.max(0, activeStats.total - activeStats.success - activeStats.loading - activeStats.error);
            const isAllImgDone = activeStats.total > 0 && activeStats.success + activeStats.error >= activeStats.total && !isImageGenerating;
            const panelCount = allPanels.length || activeStats.total;
            const estMin = Math.max(1, Math.ceil(panelCount * 10 / 60));

            /* COMPLETE */
            if (isAllImgDone && activeStats.success > 0) {
              const hasErrors = activeStats.error > 0;
              const chapterCount = (step3.data as { chapters?: unknown[] })?.chapters?.length ?? 1;
              if (hasErrors) {
                return (
                  <div className="rounded-[12px] border border-amber-200 p-6 space-y-4 animate-slide-down"
                    style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF9F0)' }}>
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className="text-amber-700">⚠ Completed with {activeStats.error} error{activeStats.error !== 1 ? 's' : ''}</span>
                      <span className="text-amber-600 tabular-nums">{Math.round((activeStats.success / activeStats.total) * 100)}%</span>
                    </div>
                    <SegmentedProgressBar total={activeStats.total} success={activeStats.success} error={activeStats.error} loading={0} height={12} />
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-emerald-600 font-semibold">✓ {activeStats.success}/{activeStats.total} complete</span>
                      <span className="text-sm text-amber-500 font-semibold">⚠ {activeStats.error} error{activeStats.error !== 1 ? 's' : ''}</span>
                      <button type="button" onClick={retryErrorPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors">
                        ↺ Retry {activeStats.error} failed
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="rounded-[12px] border border-[#BBF7D0] p-6 space-y-5 animate-slide-down"
                  style={{ background: 'linear-gradient(135deg, #EEF2FF, #F0FDF4)' }}>
                  <div className="text-center space-y-1">
                    <p className="text-2xl font-bold text-gray-900">🎉 All panels generated!</p>
                    <p className="text-sm text-gray-500">
                      {step4Stats.total} pages · {chapterCount} chapter{chapterCount !== 1 ? 's' : ''} · {step4PanelsByPage.length} page{step4PanelsByPage.length !== 1 ? 's' : ''} ready
                    </p>
                  </div>
                  <SegmentedProgressBar total={activeStats.total} success={activeStats.success} error={0} loading={0} height={8} />
                </div>
              );
            }

            /* GENERATING */
            if (isImageGenerating && !isPaused) {
              return (
                <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Generating Images</p>
                    {currentlyDrawing && <span className="text-xs italic text-[#6B7280]">Drawing: {currentlyDrawing}…</span>}
                  </div>
                  <GenerationProgressBar total={activeStats.total} done={activeStats.success} generating={activeStats.loading} errors={activeStats.error} pending={waiting} unit={comicPageMode === 'panel' ? 'panel' : 'page'} />
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setIsPaused(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                      <span className="material-symbols-outlined text-sm">pause</span>Pause
                    </button>
                    <button type="button" onClick={() => handleRetry(4)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>Cancel
                    </button>
                  </div>
                </div>
              );
            }

            /* PAUSED */
            if (isPaused) {
              return (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 space-y-4">
                  <p className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pause_circle</span>
                    Paused — {activeStats.success}/{activeStats.total} completed
                  </p>
                  <GenerationProgressBar total={activeStats.total} done={activeStats.success} generating={0} errors={activeStats.error} pending={waiting} unit={comicPageMode === 'panel' ? 'panel' : 'page'} />
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setIsPaused(false)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity">
                      <span className="material-symbols-outlined text-sm">play_arrow</span>Resume Generation
                    </button>
                    <button type="button" onClick={() => { setIsPaused(false); handleRetry(4); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>Cancel
                    </button>
                  </div>
                </div>
              );
            }

            /* READY TO START */
            if (state >= 3 && !isGenerating) {
              return (
                <div className="rounded-2xl border border-outline-variant/10 bg-white p-5 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-on-surface">Generation Mode</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{panelCount} panels · Est. ~{estMin} min</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { mode: 'page' as ComicPageMode, icon: 'auto_awesome_mosaic', title: 'Full Page', desc1: 'One image per page', desc2: 'Faster · Less precise' },
                      { mode: 'panel' as ComicPageMode, icon: 'dashboard', title: 'Panel by Panel', desc1: 'One image per panel', desc2: 'Slower · More precise' },
                    ] as const).map(({ mode, icon, title, desc1, desc2 }) => {
                      const active = comicPageMode === mode;
                      return (
                        <button key={mode} type="button" onClick={() => setComicPageMode(mode)}
                          style={{ height: 108, border: `2px solid ${active ? '#4F46E5' : '#E5E7EB'}`, background: active ? '#EEF2FF' : '#FFFFFF' }}
                          className="relative rounded-xl p-3 text-left transition-all hover:border-[#4F46E5]/50 focus:outline-none">
                          <span className="material-symbols-outlined" style={{ fontSize: 24, color: active ? '#4F46E5' : '#6B7280', display: 'block', marginBottom: 6 }}>{icon}</span>
                          <p style={{ fontSize: 14, fontWeight: 700, color: active ? '#4F46E5' : '#111827', lineHeight: 1.2 }}>{title}</p>
                          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4, marginTop: 2 }}>{desc1}</p>
                          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>{desc2}</p>
                          {active && (
                            <span className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#4F46E5' }}>
                              <span className="material-symbols-outlined text-white" style={{ fontSize: 12 }}>check</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer select-none group">
                    <div className="flex-none mt-0.5">
                      <input type="checkbox" checked={sfxMode === 'manual'} onChange={(e) => setSfxMode(e.target.checked ? 'manual' : 'auto')} className="sr-only" />
                      <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                        style={{ borderColor: sfxMode === 'manual' ? '#4F46E5' : '#D1D5DB', background: sfxMode === 'manual' ? '#4F46E5' : '#FFFFFF' }}>
                        {sfxMode === 'manual' && <span className="material-symbols-outlined text-white" style={{ fontSize: 11 }}>check</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-on-surface leading-snug">Clean images (no dialogue/SFX text embedded)</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">Add text manually in Comic Editor after export</p>
                    </div>
                  </label>
                  {step4.error && <p className="text-sm text-red-500">{step4.error}</p>}
                  <button type="button"
                    onClick={comicPageMode === 'page' ? handleStartFullGeneration : handleStartPanelGeneration}
                    disabled={isImageGenerating}
                    style={{ boxShadow: '0 4px 20px rgba(79,70,229,0.4)' }}
                    className="w-full h-[52px] rounded-full text-base font-bold text-white bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    ⚡ {comicPageMode === 'page' ? 'Generate All Pages' : 'Generate All Panels'}
                  </button>
                </div>
              );
            }

            /* BUILDING */
            if (isGenerating) {
              return (
                <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 flex items-center gap-4">
                  <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Building panel structure…</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">Parsing the script and preparing panels</p>
                  </div>
                </div>
              );
            }

            /* DEFAULT */
            return (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 flex flex-col items-center text-center gap-5">
                <div>
                  <p className="text-lg font-bold text-on-surface">✦ Ready to generate your comic</p>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {panelCount > 0 ? `${panelCount} panels · Est. ~${estMin} min` : !step3.data ? 'Complete Step 3 first to generate the panel script.' : 'Build panels from script to begin.'}
                  </p>
                </div>
                {step4.error && <p className="text-sm text-red-500">{step4.error}</p>}
                <button type="button" onClick={() => handleGenerate(4)} disabled={!canBuildPanels}
                  style={{ boxShadow: canBuildPanels ? '0 4px 20px rgba(79,70,229,0.4)' : undefined }}
                  className="w-full h-[52px] rounded-full text-base font-bold text-white bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  ⚡ Generate All Images
                </button>
              </div>
            );
          })()}

          {/* Completion nudge */}
          {showCompletionNudge && (
            <div className="rounded-xl border border-[#86EFAC] px-5 py-4 flex items-center justify-between gap-4"
              style={{ background: '#F0FDF4' }}>
              <div>
                <p className="text-sm font-semibold text-emerald-700">✓ All {activeStats.total} panels generated!</p>
                <p className="text-xs text-emerald-600 mt-0.5">Next: Add dialogue to your panels</p>
              </div>
              <button type="button" onClick={() => handleTabChange('dialogue')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap">
                Go to Dialogue →
              </button>
            </div>
          )}

          {/* Page mode: per-page images */}
          {comicPageMode === 'page' && (state === 3 || state === 4 || state === 5) && step4PanelsByPage.length > 0 && (
            <div className="space-y-6">
              {step4PanelsByPage.map(([pageNumber, panels]) => {
                const pageState = step4.data?.pageStates?.[`page-${pageNumber}`];
                const pageStatus = pageState?.status ?? 'idle';
                return (
                  <div key={`page-${pageNumber}`} className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-on-surface">Page {pageNumber}</h3>
                        <PanelStatusDot status={pageStatus} />
                        <span className="text-xs text-on-surface-variant">
                          {pageStatus === 'loading' ? 'Generating…' : pageStatus === 'success' ? 'Done' : pageStatus === 'error' ? 'Error' : 'Pending'}
                        </span>
                      </div>
                      <button type="button"
                        onClick={() => {
                          const pState = step4.data?.pageStates?.[`page-${pageNumber}`];
                          setRegenModal({ pageNumber, contextLabel: `Page ${pageNumber}`, currentImageUrl: pState?.imageUrl ?? null, prevFeedback: pState?.pendingFeedback ?? '' });
                        }}
                        disabled={!step4.data || pageStatus === 'loading'}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          !step4.data || pageStatus === 'loading'
                            ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
                            : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                        }`}>
                        <span className="material-symbols-outlined text-sm">{pageStatus === 'loading' ? 'hourglass_empty' : pageStatus === 'error' ? 'replay' : 'refresh'}</span>
                        {pageStatus === 'loading' ? 'Generating…' : pageStatus === 'error' ? 'Retry page' : 'Regenerate'}
                      </button>
                    </div>
                    {pageState?.error && <p className="text-sm text-red-500">{pageState.error}</p>}
                    {pageStatus === 'comparing' && pageState?.pendingUrl ? (
                      <ComparisonView
                        pageNumber={pageNumber}
                        prevImageUrl={pageState.imageUrl ?? null}
                        newImageUrl={pageState.pendingUrl}
                        feedback={pageState.pendingFeedback ?? ''}
                        versions={pageState.versions ?? []}
                        onAccept={() => acceptPanelRegen(pageNumber)}
                        onReject={() => rejectPanelRegen(pageNumber)}
                        onTryAgain={() => setRegenModal({ pageNumber, contextLabel: `Page ${pageNumber}`, currentImageUrl: pageState?.pendingUrl ?? pageState?.imageUrl ?? null, prevFeedback: pageState?.pendingFeedback ?? '' })}
                      />
                    ) : pageState?.imageUrl ? (
                      <div className="rounded-2xl bg-surface-container overflow-hidden border border-outline-variant/10">
                        <Image src={pageState.imageUrl} alt={`Page ${pageNumber} comic render`} width={720} height={960} className="h-auto w-full object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-surface-container py-12 text-center">
                        {pageStatus === 'loading' ? (
                          <span className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
                            <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            Generating comic page…
                          </span>
                        ) : (
                          <span className="text-sm text-on-surface-variant">No image yet — click &ldquo;↺ Regenerate&rdquo; above.</span>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {panels.map((panel) => <PanelScriptCard key={panel.id} panel={panel} artStyle={artStyle} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )
      )}

      {/* ═══════════ TAB 2 — DIALOGUE ═══════════ */}
      {activeStep4Tab === 'dialogue' && (
        <DialogueEditor
          panelsByPage={step4PanelsByPage}
          panelStates={step4.data?.panelStates ?? {}}
          panelBubbles={panelBubbles}
          pageLayoutNames={pageLayoutNames}
          onSaveBubbles={(panelId, bubbles) => {
            setPanelBubbles((prev) => ({ ...prev, [panelId]: bubbles }));
            if (projectId) {
              bubblesApi.upsert(panelId, projectId, bubbles as BubbleDataPayload[]).catch(() => {});
            }
          }}
          onExport={() => { handleApprove(4); setActiveStep(5); }}
          onAutoImport={autoImportDialogue}
        />
      )}

      {/* ── Always-on modals ── */}
      {regenModal && (
        <RegenerateModal
          pageNumber={regenModal.pageNumber}
          contextLabel={regenModal.contextLabel}
          currentImageUrl={regenModal.currentImageUrl}
          prevFeedback={regenModal.prevFeedback}
          onClose={() => setRegenModal(null)}
          onRegenerate={(feedback) => handleRegenerateWithFeedback(regenModal.pageNumber, feedback)}
        />
      )}

      {showConfetti && null}

      {showPreview && (() => {
        const pages = Object.entries((step4.data?.pageStates ?? {}) as Record<string, { status: string; imageUrl: string | null }>)
          .filter(([, v]) => !!v.imageUrl)
          .map(([k, v]) => ({ pageNumber: Number(k.replace('page-', '')), imageUrl: v.imageUrl! }))
          .sort((a, b) => a.pageNumber - b.pageNumber);
        return <PreviewModal pages={pages} onClose={() => setShowPreview(false)} />;
      })()}

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div className="fixed top-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div key={toast.id}
              className="pointer-events-auto flex items-start gap-3 bg-white border border-gray-200 rounded-2xl shadow-xl px-4 py-3 w-[300px] animate-panel-appear">
              <span className="text-amber-500 text-lg mt-0.5 flex-shrink-0">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{toast.label} failed</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <button type="button" onClick={() => dismissToast(toast.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Dismiss</button>
                  {toast.panelId !== '__export__' && (
                    <button type="button"
                      onClick={() => { handleRegeneratePage(toast.pageNumber); dismissToast(toast.id); }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">Retry now</button>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => dismissToast(toast.id)}
                className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors mt-0.5">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error confirmation modal */}
      {showFinishErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFinishErrorModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <p className="text-base font-bold text-on-surface">
              {step4Stats.error} page{step4Stats.error !== 1 ? 's' : ''} failed to generate.
            </p>
            <p className="text-sm text-on-surface-variant">You can retry the failed pages or continue without them.</p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={retryErrorPages}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                ↺ Retry failed pages
              </button>
              <button type="button" onClick={() => { setShowFinishErrorModal(false); handleApprove(4); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-bold hover:opacity-90 transition-opacity">
                Continue anyway →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Simple bottom bar ── */}
      <div className="fixed bottom-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ left: 'var(--studio-sidebar-width)' }}>
        <div className="px-10 max-w-6xl mx-auto flex items-center justify-between gap-4" style={{ height: 56 }}>
          <button type="button"
            onClick={() => {
              if (activeStep4Tab === 'layout') setActiveStep(3);
              else handleTabChange('layout');
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span className="hidden sm:inline">
              {activeStep4Tab === 'layout' ? 'Edit Script' : 'Layout & Generate'}
            </span>
          </button>

          <button type="button"
            onClick={() => {
              if (activeStep4Tab === 'layout') handleTabChange('dialogue');
              else { handleApprove(4); setActiveStep(5); }
            }}
            disabled={activeStep4Tab === 'layout' && isTabLocked('dialogue')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all flex-shrink-0 ${
              activeStep4Tab === 'dialogue'
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : isTabLocked('dialogue')
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-on-primary hover:opacity-90'
            }`}>
            {activeStep4Tab === 'layout' ? 'Go to Dialogue →' : 'Continue to Export →'}
          </button>
        </div>
      </div>
    </section>
  );
}
