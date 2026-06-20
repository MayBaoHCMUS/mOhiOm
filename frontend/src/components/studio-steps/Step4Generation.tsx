'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { Step4Panel, Step4PanelState, PanelVersion } from '@/context/ComicGenerationContext';
import { apiClient, geminiApi, bubblesApi } from '@/services/api';
import type { BubbleDataPayload } from '@/services/api';
import { exportWithDialogueAsZip } from '@/lib/bubbles/exportComposite';
import type { CompositePanel } from '@/lib/bubbles/exportComposite';
import ProjectsDrawer from '@/components/ProjectsDrawer';
import Markdown from '@/components/Markdown';
import DialogueEditor, { type BubbleType, type SingleBubble, type PanelBubbles } from '@/components/studio-steps/DialogueEditor';

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
  pageNumber,
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

// ── Emoji reaction bar ────────────────────────────────────────────────────────
type Reaction = 'love' | 'good' | 'neutral' | 'bad';

const REACTIONS: { value: Reaction; emoji: string; label: string }[] = [
  { value: 'love',    emoji: '😍', label: 'Love it!' },
  { value: 'good',    emoji: '👍', label: 'Good' },
  { value: 'neutral', emoji: '😐', label: 'Okay' },
  { value: 'bad',     emoji: '👎', label: 'Poor' },
];

function EmojiReactionBar({
  pageId,
  panels,
  comicId,
  reaction,
  onReaction,
  onError,
}: {
  pageId: string;
  panels: Step4Panel[];
  comicId: string;
  reaction: Reaction | null;
  onReaction: (pageId: string, r: Reaction) => void;
  onError: () => void;
}) {
  const regenCount = panels.reduce((n, p) => {
    return n; // panel version tracking happens at page level
  }, 0);
  const wasRegenerated = panels.some(() => false); // filled from pageState versions
  const selected = REACTIONS.find((r) => r.value === reaction);

  const handleClick = async (r: Reaction) => {
    onReaction(pageId, r);
    try {
      await apiClient.post('/ratings/panel', {
        panel_id: pageId,
        comic_id: comicId,
        reaction: r,
        panel_version: 1,
        was_regenerated: wasRegenerated,
        regen_count: regenCount,
      });
    } catch {
      onError();
    }
  };

  return (
    <div className="px-4 py-3 border-t border-outline-variant/10 flex items-center gap-3">
      {selected ? (
        <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
          <span className="text-base">{selected.emoji}</span>
          <span className="font-medium">{selected.label}</span>
        </span>
      ) : (
        <span className="text-xs text-on-surface-variant">Rate this panel:</span>
      )}
      <div className="flex items-center gap-2 ml-auto">
        {REACTIONS.map((r) => {
          const isSelected = reaction === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => handleClick(r.value)}
              title={r.label}
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-base transition-all duration-100 ${
                isSelected
                  ? 'bg-[#EEF2FF] border border-primary scale-100'
                  : 'bg-transparent border border-transparent hover:bg-gray-100 hover:scale-[1.15]'
              }`}
              style={{ opacity: isSelected ? 1 : 0.7 }}
            >
              {r.emoji}
            </button>
          );
        })}
      </div>
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
}

// ── Individual panel card (panel-by-panel mode) ───────────────────────────────
type PanelReaction = 'love' | 'good' | 'neutral' | 'bad';

function PanelCard({
  panel,
  state,
  reaction,
  approved,
  onGenerate,
  onReaction,
  onApprove,
}: {
  panel: Step4Panel;
  state: { status: string; imageUrl: string | null; error: string | null } | null;
  reaction: PanelReaction | null;
  approved: boolean;
  onGenerate: () => void;
  onReaction: (r: PanelReaction) => void;
  onApprove: () => void;
}) {
  const status = state?.status ?? 'idle';
  const imageUrl = state?.imageUrl ?? null;
  const hasImage = !!imageUrl;
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const shotLabel = (panel.shotType ?? 'panel').toUpperCase();
  const PANEL_REACTIONS: { value: PanelReaction; emoji: string; label: string }[] = [
    { value: 'love', emoji: '😍', label: 'Love' },
    { value: 'good', emoji: '👍', label: 'Good' },
    { value: 'neutral', emoji: '😐', label: 'Okay' },
    { value: 'bad', emoji: '👎', label: 'Poor' },
  ];

  return (
    <>
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low overflow-hidden flex flex-col" style={{ height: 280 }}>

      {/* ── Image area — flex:1 fills remaining height after 90px footer ── */}
      <div className="relative flex-1 overflow-hidden bg-surface-container group">
        {hasImage ? (
          <>
            <img src={imageUrl!} alt={`Panel ${panel.panelNumber}`} className="w-full h-full object-cover" />
            {/* Hover overlay: "View full" lightbox trigger */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-center justify-center pointer-events-none group-hover:pointer-events-auto">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold backdrop-blur-sm hover:bg-black/80"
              >
                🔍 View full
              </button>
            </div>
            {/* Status badge */}
            <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/90 text-white">
              <span className="material-symbols-outlined text-[10px]">check</span>
              Generated
            </span>
            {approved && (
              <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/90 text-white">
                <span className="material-symbols-outlined text-[10px]">thumb_up</span>
                Approved
              </span>
            )}
          </>
        ) : isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-on-surface-variant">
            <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs">Generating…</span>
          </div>
        ) : isError ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="material-symbols-outlined text-2xl text-red-400">error</span>
            <p className="text-xs text-red-400 font-semibold">Generation failed</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="material-symbols-outlined text-2xl opacity-20">crop_original</span>
            <p className="text-xs text-on-surface-variant">Not generated yet</p>
          </div>
        )}
      </div>

      {/* ── Footer — 3 rows, always exactly 90px ── */}
      <div className="flex-none flex flex-col justify-between px-3 py-2" style={{ height: 90 }}>

        {/* Row 1 — Metadata */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-on-surface flex items-center gap-1">
            Pg.{panel.pageNumber} · Panel {panel.panelNumber}
            {approved && <span className="text-primary text-[10px]">✓</span>}
          </span>
          <span className="text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">{shotLabel}</span>
        </div>

        {/* Row 2 — Feedback / status */}
        <div className="flex items-center min-h-0">
          {hasImage ? (
            approved && reaction ? (
              <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                You rated:
                <span className="text-base leading-none ml-0.5">
                  {PANEL_REACTIONS.find((r) => r.value === reaction)?.emoji}
                </span>
              </span>
            ) : (
              <div className="flex items-center gap-1">
                {PANEL_REACTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    title={r.label}
                    onClick={() => onReaction(r.value)}
                    className={`text-base leading-none transition-transform hover:scale-125 ${
                      reaction === r.value
                        ? 'scale-110 ring-1 ring-primary/40 rounded-full'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            )
          ) : isLoading ? (
            <span className="text-[10px] text-on-surface-variant/60 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-primary/40 border-t-primary animate-spin" />
              Generating…
            </span>
          ) : isError ? (
            <span className="text-[10px] text-red-400 font-medium">⚠ Generation failed</span>
          ) : (
            <span className="text-[10px] text-on-surface-variant">○ Not generated yet</span>
          )}
        </div>

        {/* Row 3 — Actions */}
        <div className="flex items-center justify-between gap-2">
          {hasImage ? (
            <>
              <button
                type="button"
                onClick={onGenerate}
                disabled={isLoading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-outline-variant/20 bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[11px]">refresh</span>
                {approved ? 'Regen (revokes)' : 'Regen'}
              </button>
              <button
                type="button"
                onClick={onApprove}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap ${
                  approved
                    ? 'bg-primary text-on-primary'
                    : 'border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15'
                }`}
              >
                <span className="material-symbols-outlined text-[11px]">{approved ? 'check_circle' : 'check'}</span>
                {approved ? 'Approved' : 'Approve'}
              </button>
            </>
          ) : isError ? (
            <>
              <button
                type="button"
                onClick={onGenerate}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[11px]">refresh</span>
                Retry
              </button>
              {state?.error && (
                <span className="text-[10px] text-red-400 truncate text-right" title={state.error}>
                  {state.error}
                </span>
              )}
            </>
          ) : !isLoading ? (
            <button
              type="button"
              onClick={onGenerate}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[11px]">bolt</span>
              Generate this panel
            </button>
          ) : null}
        </div>

      </div>
    </div>

    {/* ── Lightbox: full uncropped image ── */}
    {lightboxOpen && imageUrl && (
      <div
        className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
        onClick={() => setLightboxOpen(false)}
      >
        <button
          type="button"
          onClick={() => setLightboxOpen(false)}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-white text-xl">close</span>
        </button>
        <img
          src={imageUrl}
          alt={`Panel ${panel.panelNumber} full view`}
          className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm whitespace-nowrap">
          Pg.{panel.pageNumber} · Panel {panel.panelNumber} · {shotLabel}
        </p>
      </div>
    )}
    </>
  );
}

// ── Layout template constants (mirrors backend LAYOUT_TEMPLATES) ──────────────

const TEMPLATES_BY_COUNT: Record<number, string[]> = {
  1: ['splash'],
  2: ['stacked', 'side_by_side'],
  3: ['three_rows', 'top_wide', 'bottom_wide'],
  4: ['grid_2x2', 'top_wide_3', 'bottom_wide_3', 'four_rows'],
  5: ['wide_2x2', '2x2_wide'],
  6: ['grid_3x2', 'grid_2x3'],
};

const LAYOUT_DISPLAY_NAMES_MAP: Record<string, string> = {
  splash: 'Full Splash', stacked: 'Stacked', side_by_side: 'Side by Side',
  three_rows: 'Three Rows', top_wide: 'Wide Top', bottom_wide: 'Wide Bottom',
  grid_2x2: '2×2 Grid', top_wide_3: 'Wide + Three', bottom_wide_3: 'Three + Wide',
  four_rows: 'Four Rows', wide_2x2: 'Wide + 2×2', '2x2_wide': '2×2 + Wide',
  grid_3x2: '3-Col Grid', grid_2x3: '2-Col Grid',
};

// Row-of-indices for each template (needed for compose-page explicit layout)
const LAYOUT_ROW_STRUCTURES: Record<string, number[][]> = {
  splash: [[0]], stacked: [[0],[1]], side_by_side: [[0,1]],
  three_rows: [[0],[1],[2]], top_wide: [[0],[1,2]], bottom_wide: [[0,1],[2]],
  grid_2x2: [[0,1],[2,3]], top_wide_3: [[0],[1,2,3]], bottom_wide_3: [[0,1,2],[3]],
  four_rows: [[0],[1],[2],[3]], wide_2x2: [[0],[1,2],[3,4]], '2x2_wide': [[0,1],[2,3],[4]],
  grid_3x2: [[0,1,2],[3,4,5]], grid_2x3: [[0,1],[2,3],[4,5]],
};

// SVG panel rects for each template (48×64 viewport)
const LAYOUT_SVGS: Record<string, React.ReactNode> = {
  splash:        <rect x="2" y="2" width="44" height="60" rx="1" fill="currentColor"/>,
  stacked:       <><rect x="2" y="2"  width="44" height="28" rx="1" fill="currentColor"/><rect x="2" y="34" width="44" height="28" rx="1" fill="currentColor"/></>,
  side_by_side:  <><rect x="2"  y="2" width="20" height="60" rx="1" fill="currentColor"/><rect x="26" y="2" width="20" height="60" rx="1" fill="currentColor"/></>,
  three_rows:    <><rect x="2" y="2"  width="44" height="17" rx="1" fill="currentColor"/><rect x="2" y="23" width="44" height="17" rx="1" fill="currentColor"/><rect x="2" y="44" width="44" height="18" rx="1" fill="currentColor"/></>,
  top_wide:      <><rect x="2" y="2"  width="44" height="28" rx="1" fill="currentColor"/><rect x="2" y="34" width="20" height="28" rx="1" fill="currentColor"/><rect x="26" y="34" width="20" height="28" rx="1" fill="currentColor"/></>,
  bottom_wide:   <><rect x="2" y="2"  width="20" height="28" rx="1" fill="currentColor"/><rect x="26" y="2" width="20" height="28" rx="1" fill="currentColor"/><rect x="2" y="34" width="44" height="28" rx="1" fill="currentColor"/></>,
  grid_2x2:      <><rect x="2"  y="2"  width="20" height="28" rx="1" fill="currentColor"/><rect x="26" y="2"  width="20" height="28" rx="1" fill="currentColor"/><rect x="2"  y="34" width="20" height="28" rx="1" fill="currentColor"/><rect x="26" y="34" width="20" height="28" rx="1" fill="currentColor"/></>,
  top_wide_3:    <><rect x="2" y="2"  width="44" height="28" rx="1" fill="currentColor"/><rect x="2" y="34" width="12" height="28" rx="1" fill="currentColor"/><rect x="18" y="34" width="12" height="28" rx="1" fill="currentColor"/><rect x="34" y="34" width="12" height="28" rx="1" fill="currentColor"/></>,
  bottom_wide_3: <><rect x="2" y="2"  width="12" height="28" rx="1" fill="currentColor"/><rect x="18" y="2"  width="12" height="28" rx="1" fill="currentColor"/><rect x="34" y="2"  width="12" height="28" rx="1" fill="currentColor"/><rect x="2" y="34" width="44" height="28" rx="1" fill="currentColor"/></>,
  four_rows:     <><rect x="2" y="2"  width="44" height="12" rx="1" fill="currentColor"/><rect x="2" y="18" width="44" height="12" rx="1" fill="currentColor"/><rect x="2" y="34" width="44" height="12" rx="1" fill="currentColor"/><rect x="2" y="50" width="44" height="12" rx="1" fill="currentColor"/></>,
  wide_2x2:      <><rect x="2" y="2"  width="44" height="17" rx="1" fill="currentColor"/><rect x="2" y="23" width="20" height="17" rx="1" fill="currentColor"/><rect x="26" y="23" width="20" height="17" rx="1" fill="currentColor"/><rect x="2" y="44" width="20" height="18" rx="1" fill="currentColor"/><rect x="26" y="44" width="20" height="18" rx="1" fill="currentColor"/></>,
  '2x2_wide':    <><rect x="2" y="2"  width="20" height="17" rx="1" fill="currentColor"/><rect x="26" y="2"  width="20" height="17" rx="1" fill="currentColor"/><rect x="2" y="23" width="20" height="17" rx="1" fill="currentColor"/><rect x="26" y="23" width="20" height="17" rx="1" fill="currentColor"/><rect x="2" y="44" width="44" height="18" rx="1" fill="currentColor"/></>,
  grid_3x2:      <><rect x="2"  y="2"  width="12" height="28" rx="1" fill="currentColor"/><rect x="18" y="2"  width="12" height="28" rx="1" fill="currentColor"/><rect x="34" y="2"  width="12" height="28" rx="1" fill="currentColor"/><rect x="2"  y="34" width="12" height="28" rx="1" fill="currentColor"/><rect x="18" y="34" width="12" height="28" rx="1" fill="currentColor"/><rect x="34" y="34" width="12" height="28" rx="1" fill="currentColor"/></>,
  grid_2x3:      <><rect x="2"  y="2"  width="20" height="17" rx="1" fill="currentColor"/><rect x="26" y="2"  width="20" height="17" rx="1" fill="currentColor"/><rect x="2"  y="23" width="20" height="17" rx="1" fill="currentColor"/><rect x="26" y="23" width="20" height="17" rx="1" fill="currentColor"/><rect x="2"  y="44" width="20" height="18" rx="1" fill="currentColor"/><rect x="26" y="44" width="20" height="18" rx="1" fill="currentColor"/></>,
};

function LayoutTemplatePicker({
  panelCount,
  selectedLayout,
  onSelect,
}: {
  panelCount: number;
  selectedLayout: string;
  onSelect: (name: string) => void;
}) {
  const options = TEMPLATES_BY_COUNT[panelCount] ?? [];
  if (options.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mr-1">Layout</span>
      {options.map((name) => (
        <button
          key={name}
          type="button"
          title={LAYOUT_DISPLAY_NAMES_MAP[name] ?? name}
          onClick={() => onSelect(name)}
          className={`w-8 h-[42px] rounded-lg border-2 flex items-center justify-center transition-all ${
            selectedLayout === name
              ? 'border-primary text-primary bg-primary/10'
              : 'border-outline-variant/30 text-on-surface-variant/40 hover:border-primary/40 hover:text-primary/60'
          }`}
        >
          <svg viewBox="0 0 48 64" className="w-5 h-[27px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            {LAYOUT_SVGS[name] ?? <rect x="2" y="2" width="44" height="60" rx="1" fill="currentColor"/>}
          </svg>
        </button>
      ))}
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
    jsonCopied,
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
    copyProjectJson,
    downloadProjectJson,
    exportZip,
    exportPdf,
    exportStatus,
    saveToCloud,
    cloudSaveStatus,
    artStyle,
    mangaGenre,
    projectId,
    getCooldownSeconds,
    setActiveStep,
    sfxMode,
    setSfxMode,
    pageLayoutNames,
    pagePanelDimensions,
    setPageLayout,
  } = useComicGeneration();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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

  // ── Rating state ──────────────────────────────────────────────────────────
  const [panelReactions, setPanelReactions] = useState<Record<string, Reaction>>({});
  const [comicRating, setComicRating] = useState<{ stars: number; positive: string; negative: string } | null>(null);
  const sessionStartRef = useRef(Date.now());

  // ── Generation mode ───────────────────────────────────────────────────────
  type ComicPageMode = 'page' | 'panel';
  const [comicPageMode, setComicPageMode] = useState<ComicPageMode>('page');
  const [approvedPanelIds, setApprovedPanelIds] = useState<Set<string>>(new Set());
  const [panelItemReactions, setPanelItemReactions] = useState<Record<string, PanelReaction>>({});

  // ── Tab navigation ────────────────────────────────────────────────────────
  type Step4Tab = 'generate' | 'layout' | 'dialogue' | 'export';
  const [activeStep4Tab, setActiveStep4Tab] = useState<Step4Tab>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('mohiom-step4-tab') as Step4Tab) ?? 'generate';
    }
    return 'generate';
  });
  const [panelBubbles, setPanelBubbles] = useState<Record<string, PanelBubbles>>({});
  const bubblesLoadedRef = useRef(false);
  const [composingAll, setComposingAll] = useState(false);
  const [showCompletionNudge, setShowCompletionNudge] = useState(false);
  const prevAllImgDoneRef = useRef(false);
  // Export tab inline state
  const [exportStars, setExportStars] = useState(0);
  const [exportHovered, setExportHovered] = useState(0);
  const [exportPositive, setExportPositive] = useState('');
  const [exportNegative, setExportNegative] = useState('');
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [exportingDialogue, setExportingDialogue] = useState(false);
  const [dialogueExportProgress, setDialogueExportProgress] = useState<{ done: number; total: number } | null>(null);

  // ── Compose state ─────────────────────────────────────────────────────────
  type ComposeStatus = 'idle' | 'composing' | 'done' | 'error';
  const [composeStates, setComposeStates] = useState<Record<number, { status: ComposeStatus; imageUrl: string | null; layoutName?: string; error: string | null }>>({});

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

  const handleComposePage = useCallback(async (pageNumber: number, panels: Step4Panel[]) => {
    const style = artStyle.toLowerCase().includes('webtoon') ? 'webtoon' : 'manga';
    setComposeStates((prev) => ({ ...prev, [pageNumber]: { status: 'composing', imageUrl: null, error: null } }));

    try {
      // Path A: individual panel images exist — compose directly, no split needed
      const panelImages = panels.map((p) => ({
        panel: p,
        imageUrl: step4.data?.panelStates?.[p.id]?.imageUrl ?? null,
      }));
      const allPanelsHaveImages = panelImages.every((pi) => pi.imageUrl);

      if (allPanelsHaveImages) {
        const chosenLayoutName = pageLayoutNames[pageNumber];
        const chosenLayout = chosenLayoutName ? LAYOUT_ROW_STRUCTURES[chosenLayoutName] : undefined;
        const res = await geminiApi.composePage({
          panels: panelImages.map((pi) => ({
            panel_number: pi.panel.panelNumber,
            page_number: pageNumber,
            shot_type: pi.panel.shotType ?? 'medium shot',
            image_data_url: pi.imageUrl!,
            dialogue: pi.panel.dialogueSfx && pi.panel.dialogueSfx !== 'No dialogue/SFX provided.'
              ? pi.panel.dialogueSfx
              : undefined,
          })),
          style,
          layout: chosenLayout,
          use_smart_layout: !chosenLayout,
        });
        setComposeStates((prev) => ({
          ...prev,
          [pageNumber]: {
            status: 'done',
            imageUrl: `data:image/png;base64,${res.data.page_base64}`,
            layoutName: res.data.layout_name,
            error: null,
          },
        }));
        return;
      }

      // Path B: only a full-page image exists — split it then re-compose
      const pageImageUrl = step4.data?.pageStates?.[`page-${pageNumber}`]?.imageUrl;
      if (!pageImageUrl) {
        setComposeStates((prev) => ({ ...prev, [pageNumber]: { status: 'error', imageUrl: null, error: 'Generate panels or a page image first before using Auto Layout.' } }));
        return;
      }

      const res = await geminiApi.autoLayout({
        page_image_data_url: pageImageUrl,
        panels: panels.map((p) => ({
          panel_number: p.panelNumber,
          shot_type: p.shotType ?? 'medium shot',
        })),
        style,
      });
      setComposeStates((prev) => ({
        ...prev,
        [pageNumber]: {
          status: 'done',
          imageUrl: `data:image/png;base64,${res.data.page_base64}`,
          error: null,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auto layout failed';
      setComposeStates((prev) => ({ ...prev, [pageNumber]: { status: 'error', imageUrl: null, error: msg } }));
    }
  }, [step4.data?.panelStates, step4.data?.pageStates, artStyle, pageLayoutNames]);

  const handleComposeAllPages = useCallback(async () => {
    setComposingAll(true);
    for (const [pageNumber, panels] of step4PanelsByPage) {
      await handleComposePage(pageNumber, panels);
    }
    setComposingAll(false);
  }, [step4PanelsByPage, handleComposePage]);

  const handleApproveAllOnPage = useCallback((pageNumber: number) => {
    const panels = step4PanelsByPage.find(([n]) => n === pageNumber)?.[1] ?? [];
    setApprovedPanelIds((prev) => {
      const next = new Set(prev);
      panels.forEach((p) => next.add(p.id));
      return next;
    });
  }, [step4PanelsByPage]);

  function genBubbleId(): string {
    if (typeof window !== 'undefined' && 'randomUUID' in window.crypto) {
      return window.crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

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

  // Auto-initialize layout selection for each page when panels first become available.
  // Also re-fetches dimensions for pages whose layout was restored from a saved project
  // (pageLayoutNames set, but pagePanelDimensions not yet computed).
  const hasInitializedLayoutsRef = useRef(false);
  useEffect(() => {
    if (!step4.data?.panels.length || hasInitializedLayoutsRef.current) return;
    hasInitializedLayoutsRef.current = true;
    for (const [pageNumber, panels] of step4PanelsByPage) {
      if (!pagePanelDimensions[pageNumber]) {
        // Use saved layout name if available; otherwise pick the first template as default
        const layout = pageLayoutNames[pageNumber] ?? TEMPLATES_BY_COUNT[panels.length]?.[0] ?? 'stacked';
        setPageLayout(pageNumber, layout, panels);
      }
    }
  }, [step4.data?.panels.length, step4PanelsByPage, pageLayoutNames, pagePanelDimensions, setPageLayout]);

  // Reset layout init flag when step4 panels are rebuilt
  useEffect(() => {
    if (!step4.data?.panels.length) {
      hasInitializedLayoutsRef.current = false;
    }
  }, [step4.data?.panels.length]);

  // Load saved ratings on mount
  useEffect(() => {
    if (!projectId) return;
    apiClient.get(`/ratings/panels/${projectId}`).then((res) => {
      const map: Record<string, Reaction> = {};
      for (const r of (res.data.ratings ?? [])) map[r.panel_id] = r.reaction;
      setPanelReactions(map);
    }).catch(() => {});
    apiClient.get(`/ratings/comic/${projectId}`).then((res) => {
      const r = res.data.rating;
      if (r) setComicRating({ stars: r.stars ?? 0, positive: r.comment_positive ?? '', negative: r.comment_negative ?? '' });
    }).catch(() => {});
  }, [projectId]);

  // Load saved bubble data from MongoDB on first dialogue-tab visit
  useEffect(() => {
    if (!projectId || bubblesLoadedRef.current) return;
    bubblesLoadedRef.current = true;
    bubblesApi.getForComic(projectId).then((res) => {
      const map: Record<string, PanelBubbles> = {};
      for (const doc of res.data) {
        map[doc.panelId] = doc.bubbles as PanelBubbles;
      }
      if (Object.keys(map).length > 0) {
        setPanelBubbles((prev) => ({ ...map, ...prev }));
      }
    }).catch(() => {});
  }, [projectId]);

  const addRatingErrorToast = useCallback(() => {
    const id = `rating-err-${Date.now()}`;
    setToasts((prev) => [...prev, { id, label: "Couldn't save rating", pageNumber: 0, panelId: '' }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const handleRatingSubmit = useCallback(async (stars: number, positive: string, negative: string) => {
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const reactionSummary = REACTIONS.reduce((acc, r) => {
      acc[r.value] = Object.values(panelReactions).filter((v) => v === r.value).length;
      return acc;
    }, {} as Record<string, number>);
    const panelsRegenerated = Object.values(step4.data?.pageStates ?? {}).filter(
      (s) => (s as Step4PanelState).versions && (s as Step4PanelState).versions.length > 0
    ).length;
    const totalRegenCount = Object.values(step4.data?.pageStates ?? {}).reduce(
      (n, s) => n + ((s as Step4PanelState).versions?.length ?? 0), 0
    );
    setComicRating({ stars, positive, negative });
    try {
      await apiClient.post('/ratings/comic', {
        comic_id: projectId,
        stars,
        skipped: false,
        comment_positive: positive,
        comment_negative: negative,
        total_panels: step4.data?.panels?.length ?? 0,
        panels_regenerated: panelsRegenerated,
        total_regen_count: totalRegenCount,
        art_style: artStyle,
        genre: mangaGenre,
        total_session_time_seconds: elapsed,
        panel_reactions_summary: reactionSummary,
        step_completion_times: {},
      });
    } catch { /* fire-and-forget */ }
  }, [panelReactions, step4.data, projectId, artStyle, mangaGenre]);

  const handleExportWithDialogue = useCallback(async () => {
    const panels: CompositePanel[] = [];
    for (const [pageNum, pagePanels] of step4PanelsByPage) {
      for (const panel of pagePanels) {
        const state = (step4.data?.panelStates ?? {})[panel.id];
        if (!state?.imageUrl) continue;
        panels.push({
          label: `page-${pageNum}-panel-${panel.panelNumber}`,
          imageUrl: state.imageUrl,
          bubbles: panelBubbles[panel.id] ?? [],
        });
      }
    }
    if (panels.length === 0) return;
    setExportingDialogue(true);
    setDialogueExportProgress({ done: 0, total: panels.length });
    try {
      await exportWithDialogueAsZip(panels, projectId, (done, total) => {
        setDialogueExportProgress({ done, total });
      });
    } finally {
      setExportingDialogue(false);
      setDialogueExportProgress(null);
    }
  }, [step4PanelsByPage, step4.data, panelBubbles, projectId]);

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

  // Export error toast
  useEffect(() => {
    if (exportStatus !== 'error') return;
    const id = `export-error-${Date.now()}`;
    setToasts((t) => [...t.slice(-3), { id, label: 'Export', pageNumber: 0, panelId: '__export__' }]);
    toastTimeoutsRef.current[id] = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      delete toastTimeoutsRef.current[id];
    }, 6000);
  }, [exportStatus]);

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

  // Finish button state machine — use panel stats in panel mode
  const activeStatsForBtn = comicPageMode === 'panel'
    ? { total: panelStats.total, success: panelStats.done, error: panelStats.errors }
    : { total: step4Stats.total, success: step4Stats.success, error: step4Stats.error };

  const finishBtnState = (() => {
    if (isImageGenerating) return 'in-progress' as const;
    if (activeStatsForBtn.total > 0 && activeStatsForBtn.error === 0 && activeStatsForBtn.success === activeStatsForBtn.total) return 'all-complete' as const;
    if (activeStatsForBtn.total > 0 && activeStatsForBtn.error > 0) return 'has-errors' as const;
    return 'not-started' as const;
  })();


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
    sessionStorage.setItem('mohiom-step4-tab', activeStep4Tab);
  }, [activeStep4Tab]);

  // If user switches to Full Page mode while on Layout tab, kick back to Generate
  useEffect(() => {
    if (comicPageMode === 'page' && activeStep4Tab === 'layout') {
      setActiveStep4Tab('generate');
    }
  }, [comicPageMode, activeStep4Tab]);

  // Panel mode always uses clean images — force it on so panel images stay clean for Dialogue tab
  useEffect(() => {
    if (comicPageMode === 'panel') setSfxMode('manual');
  }, [comicPageMode, setSfxMode]);

  // Sync export rating fields when comicRating loads
  useEffect(() => {
    if (comicRating) {
      setExportStars(comicRating.stars);
      setExportPositive(comicRating.positive);
      setExportNegative(comicRating.negative);
    }
  }, [comicRating]);

  // Completion nudge
  useEffect(() => {
    const isAllDone = activeStats.total > 0 && activeStats.success === activeStats.total && activeStats.error === 0 && !isImageGenerating;
    if (isAllDone && !prevAllImgDoneRef.current) setShowCompletionNudge(true);
    prevAllImgDoneRef.current = isAllDone;
  }, [activeStats, isImageGenerating]);

  // Tab helpers
  const isTabLocked = useCallback((tab: Step4Tab) => {
    if (tab === 'generate') return false;
    if (tab === 'layout') {
      if (comicPageMode === 'page') return true; // layout is embedded in full-page images
      return activeStats.success === 0;
    }
    if (tab === 'dialogue') {
      if (activeStats.success === 0) return true;
      // Full Page mode: dialogue overlay only makes sense on clean images
      if (comicPageMode === 'page') return sfxMode !== 'manual';
      return false;
    }
    if (tab === 'export') return activeStats.success < activeStats.total;
    return false;
  }, [activeStats.success, activeStats.total, comicPageMode, sfxMode]);

  const handleTabChange = useCallback((tab: Step4Tab) => {
    if (isTabLocked(tab)) return;
    setActiveStep4Tab(tab);
    setShowCompletionNudge(false);
  }, [isTabLocked]);

  const pagesComposed = Object.values(composeStates).filter((cs) => cs.status === 'done').length;
  const panelsWithDialogue = allPanels.filter((p) => {
    const bs = panelBubbles[p.id] ?? [];
    return bs.length > 0 && bs.some((b) => {
      const t = b.dialogue?.trim() ?? '';
      return t !== '' && t.toUpperCase() !== 'NONE';
    });
  }).length;

  return (
    <section className="text-on-surface pb-20">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-1 pt-1 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Image Generation</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Generate panel images and export the final project package
          </p>
        </div>
        <StateBadge state={state} />
      </div>

      {/* ── Tab Bar ── */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex items-center gap-8">
          {(
            [
              { id: 'generate' as Step4Tab, label: '⚡ Generate' },
              { id: 'layout' as Step4Tab, label: '⊞ Layout' },
              { id: 'dialogue' as Step4Tab, label: '💬 Dialogue' },
              { id: 'export' as Step4Tab, label: '⬇ Export' },
            ] as const
          ).filter((tab) => !(tab.id === 'layout' && comicPageMode === 'page'))
           .map((tab) => {
            const locked = isTabLocked(tab.id);
            const active = activeStep4Tab === tab.id;

            let badgeText: string | null = null;
            let badgeVariant: 'complete' | 'progress' | 'gray' = 'progress';
            if (!locked) {
              if (tab.id === 'generate' && activeStats.total > 0) {
                if (activeStats.success === activeStats.total) {
                  badgeText = `${activeStats.total} ✓`; badgeVariant = 'complete';
                } else if (activeStats.success === 0) {
                  badgeText = `0/${activeStats.total}`; badgeVariant = 'gray';
                } else {
                  badgeText = `${activeStats.success}/${activeStats.total}`; badgeVariant = 'progress';
                }
              } else if (tab.id === 'layout') {
                if (step4PanelsByPage.length > 0 && pagesComposed === step4PanelsByPage.length) {
                  badgeText = `${pagesComposed} ✓`; badgeVariant = 'complete';
                } else {
                  badgeText = `${pagesComposed}/${step4PanelsByPage.length}`; badgeVariant = 'progress';
                }
              } else if (tab.id === 'dialogue') {
                if (panelsWithDialogue > 0) {
                  badgeText = `${panelsWithDialogue}/${allPanels.length}`; badgeVariant = 'progress';
                } else {
                  badgeText = 'Optional'; badgeVariant = 'gray';
                }
              } else if (tab.id === 'export') {
                badgeText = 'Ready →'; badgeVariant = 'complete';
              }
            }

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                disabled={locked}
                title={
                  locked
                    ? tab.id === 'dialogue' && comicPageMode === 'page' && activeStats.success > 0
                      ? 'Enable "Clean images" to add speech bubbles'
                      : 'Complete image generation to unlock'
                    : undefined
                }
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

      {/* ═══════════ TAB 1 — GENERATE ═══════════ */}
      {activeStep4Tab === 'generate' && (
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
                  {comicPageMode === 'page' && (
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
                        <p className="text-xs text-[#6B7280] mt-0.5">
                          Required for the Dialogue tab — add speech bubbles over the generated page
                        </p>
                      </div>
                    </label>
                  )}
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
                <p className="text-sm font-semibold text-emerald-700">
                  ✓ All {activeStats.total} {comicPageMode === 'panel' ? 'panels' : 'pages'} generated!
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {comicPageMode === 'panel'
                    ? 'Next: Arrange your comic page layout'
                    : sfxMode === 'manual'
                      ? 'Clean images ready — add speech bubbles in Dialogue'
                      : 'Ready to export, or enable Clean images to add speech bubbles'}
                </p>
              </div>
              <button type="button"
                onClick={() => handleTabChange(
                  comicPageMode === 'panel' ? 'layout' :
                  sfxMode === 'manual' ? 'dialogue' : 'export'
                )}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap">
                {comicPageMode === 'panel' ? 'Go to Layout →' :
                 sfxMode === 'manual' ? 'Go to Dialogue →' : 'Go to Export →'}
              </button>
            </div>
          )}

          {/* Panel mode: per-page panel grids */}
          {comicPageMode === 'panel' && (state === 3 || state === 4 || state === 5) && step4PanelsByPage.length > 0 && (
            <div className="space-y-4">
              {step4PanelsByPage.map(([pageNumber, panels]) => {
                const chosenLayout = pageLayoutNames[pageNumber] ?? TEMPLATES_BY_COUNT[panels.length]?.[0] ?? 'stacked';
                const hasDimensions = !!pagePanelDimensions[pageNumber];
                return (
                <div key={`page-${pageNumber}`} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Page {pageNumber}</p>
                    <div className="flex items-center gap-2">
                      <LayoutTemplatePicker
                        panelCount={panels.length}
                        selectedLayout={chosenLayout}
                        onSelect={(name) => setPageLayout(pageNumber, name, panels)}
                      />
                      {chosenLayout && !hasDimensions && (
                        <span className="text-[10px] text-on-surface-variant animate-pulse">setting…</span>
                      )}
                      {hasDimensions && (
                        <span className="text-[10px] text-emerald-600 font-semibold">✓ sizes set</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {panels.map((panel, idx) => {
                      const isLastOdd = panels.length % 2 === 1 && idx === panels.length - 1;
                      const card = (
                        <PanelCard
                          panel={panel}
                          state={step4.data?.panelStates?.[panel.id] ?? null}
                          reaction={panelItemReactions[panel.id] ?? null}
                          approved={approvedPanelIds.has(panel.id)}
                          onGenerate={() => handleRegenerateSinglePanel(panel)}
                          onReaction={(r) => setPanelItemReactions((prev) => ({ ...prev, [panel.id]: r }))}
                          onApprove={() => setApprovedPanelIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(panel.id)) { next.delete(panel.id); } else { next.add(panel.id); }
                            return next;
                          })}
                        />
                      );
                      return isLastOdd ? (
                        <div key={panel.id} style={{ gridColumn: 'span 2', maxWidth: '50%', margin: '0 auto', width: '100%' }}>{card}</div>
                      ) : (
                        <React.Fragment key={panel.id}>{card}</React.Fragment>
                      );
                    })}
                  </div>
                </div>
                );
              })}
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
                        <EmojiReactionBar
                          pageId={`page-${pageNumber}`}
                          panels={panels}
                          comicId={projectId}
                          reaction={panelReactions[`page-${pageNumber}`] ?? null}
                          onReaction={(id, r) => setPanelReactions((prev) => ({ ...prev, [id]: r }))}
                          onError={addRatingErrorToast}
                        />
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
      )}

      {/* ═══════════ TAB 2 — LAYOUT ═══════════ */}
      {activeStep4Tab === 'layout' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <button type="button" onClick={handleComposeAllPages}
              disabled={composingAll || step4PanelsByPage.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50">
              {composingAll ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Composing…</>
              ) : '✨ AI Layout All Pages'}
            </button>
            <span className="text-xs text-on-surface-variant font-medium">
              {pagesComposed}/{step4PanelsByPage.length} pages arranged
            </span>
          </div>

          {step4PanelsByPage.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-8 text-center">
              <p className="text-sm text-on-surface-variant">Generate panels first to arrange layouts.</p>
            </div>
          ) : (
            step4PanelsByPage.map(([pageNumber, panels]) => {
              const cs = composeStates[pageNumber];
              const approvedCount = panels.filter((p) => approvedPanelIds.has(p.id)).length;
              return (
                <div key={`layout-page-${pageNumber}`} className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-on-surface">Page {pageNumber}</h3>
                      <span className="text-xs text-on-surface-variant">· {panels.length} panels · {approvedCount}/{panels.length} approved</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => handleApproveAllOnPage(pageNumber)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors">
                        ✓ Approve All
                      </button>
                      <button type="button" onClick={() => handleComposePage(pageNumber, panels)}
                        disabled={cs?.status === 'composing'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                        {cs?.status === 'composing' ? (
                          <><span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />Composing…</>
                        ) : cs?.status === 'done' ? '↺ Re-layout' : '✨ AI Layout'}
                      </button>
                    </div>
                  </div>

                  {cs?.status === 'done' && cs.imageUrl && (
                    <div className="rounded-2xl overflow-hidden border border-primary/20 relative">
                      {cs.layoutName && (
                        <div className="absolute top-2 left-2 z-10">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-primary/90 text-white">AI: {cs.layoutName}</span>
                        </div>
                      )}
                      <img src={cs.imageUrl} alt={`Page ${pageNumber} layout`} className="w-full h-auto" />
                      <div className="flex justify-end p-2 bg-surface-container-low">
                        <a href={cs.imageUrl} download={`page-${pageNumber}-layout.png`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                          <span className="material-symbols-outlined text-sm">download</span>Download
                        </a>
                      </div>
                    </div>
                  )}
                  {cs?.status === 'error' && <p className="text-xs text-red-500 px-1">{cs.error}</p>}

                  <div className="flex items-start gap-3 flex-wrap">
                    {panels.map((panel) => {
                      const imageUrl = step4.data?.panelStates?.[panel.id]?.imageUrl ?? null;
                      const isApproved = approvedPanelIds.has(panel.id);
                      return (
                        <div key={panel.id} className="flex flex-col items-center gap-1.5 w-[80px]">
                          <div className="w-20 h-20 rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container">
                            {imageUrl ? (
                              <img src={imageUrl} alt={`P${panel.panelNumber}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-xl opacity-20">crop_original</span>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-on-surface-variant font-medium">P.{panel.panelNumber}</span>
                          <button type="button"
                            onClick={() => setApprovedPanelIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(panel.id)) { next.delete(panel.id); } else { next.add(panel.id); }
                              return next;
                            })}
                            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                              isApproved ? 'bg-primary text-on-primary' : 'border border-primary/30 text-primary hover:bg-primary/10'
                            }`}>
                            {isApproved ? '✓ OK' : '○ OK'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {pagesComposed === step4PanelsByPage.length && step4PanelsByPage.length > 0 && (
            <div className="rounded-xl border border-[#86EFAC] px-5 py-4 flex items-center justify-between gap-4"
              style={{ background: '#F0FDF4' }}>
              <p className="text-sm font-semibold text-emerald-700">✓ All pages arranged!</p>
              <button type="button" onClick={() => handleTabChange('dialogue')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap">
                Go to Dialogue →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB 3 — DIALOGUE ═══════════ */}
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
          onExport={() => handleTabChange('export')}
          onAutoImport={autoImportDialogue}
        />
      )}

      {/* ═══════════ TAB 4 — EXPORT ═══════════ */}
      {activeStep4Tab === 'export' && (
        <div className="space-y-8">

          {/* Rating section */}
          <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-5">
            <div className="text-center">
              <p className="text-lg font-bold text-on-surface">🎉 Rate Your Experience</p>
              <p className="text-sm text-on-surface-variant mt-1">Optional — export whenever you&apos;re ready</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button"
                  onClick={() => setExportStars(n)}
                  onMouseEnter={() => setExportHovered(n)}
                  onMouseLeave={() => setExportHovered(0)}
                  className="transition-transform hover:scale-110">
                  <svg width="32" height="32" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                      fill={n <= (exportHovered || exportStars) ? '#F59E0B' : '#E5E7EB'}
                      stroke={n <= (exportHovered || exportStars) ? '#F59E0B' : '#D1D5DB'} strokeWidth="1" />
                  </svg>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">What worked well? <span className="font-normal text-outline">(optional)</span></label>
                <textarea value={exportPositive} onChange={(e) => setExportPositive(e.target.value)}
                  placeholder="e.g. The art style came out great…" rows={2}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder-outline outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">What could be better? <span className="font-normal text-outline">(optional)</span></label>
                <textarea value={exportNegative} onChange={(e) => setExportNegative(e.target.value)}
                  placeholder="e.g. Panel composition felt off…" rows={2}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder-outline outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>
            <button type="button"
              onClick={() => handleRatingSubmit(exportStars, exportPositive, exportNegative)}
              disabled={exportStars === 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                exportStars > 0 ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-surface-container text-outline cursor-not-allowed opacity-50'
              }`}>
              {comicRating ? '✓ Update Rating' : 'Submit Rating'}
            </button>
          </div>

          {/* Export options */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Download</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => exportPdf(includeMetadata)}
                disabled={!Object.values(step4.data?.pageStates ?? {}).some((s) => s.status === 'success' && s.imageUrl) || exportStatus === 'exporting'}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  !Object.values(step4.data?.pageStates ?? {}).some((s) => s.status === 'success' && s.imageUrl) || exportStatus === 'exporting'
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                }`}>
                <span className="text-2xl">📄</span>
                <p className="text-sm font-bold text-gray-900 mt-2">PDF Comic</p>
                <p className="text-xs text-gray-400 mt-0.5">Full comic, print-ready</p>
              </button>
              <button type="button"
                onClick={() => exportZip(includeMetadata)}
                disabled={!Object.values(step4.data?.pageStates ?? {}).some((s) => s.status === 'success' && s.imageUrl) || exportStatus === 'exporting'}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  !Object.values(step4.data?.pageStates ?? {}).some((s) => s.status === 'success' && s.imageUrl) || exportStatus === 'exporting'
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                }`}>
                <span className="text-2xl">🖼</span>
                <p className="text-sm font-bold text-gray-900 mt-2">Image Pack</p>
                <p className="text-xs text-gray-400 mt-0.5">All pages as PNG ZIP</p>
              </button>
              <label className="col-span-2 flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={includeMetadata} onChange={(e) => setIncludeMetadata(e.target.checked)} className="w-4 h-4 rounded accent-indigo-600" />
                <span className="text-sm text-gray-700">Include panel script (dialogue, shot types, prompts)</span>
              </label>

              {/* Export with Dialogue */}
              {(() => {
                const hasPanelsWithImages = step4PanelsByPage.some(([, panels]) =>
                  panels.some(p => !!(step4.data?.panelStates ?? {})[p.id]?.imageUrl)
                );
                const hasBubbles = Object.values(panelBubbles).some(bs =>
                  bs.some(b => b.bubbleType !== 'none' && (b.dialogue?.trim() ?? '') !== '' && b.dialogue?.toUpperCase().trim() !== 'NONE')
                );
                const disabled = !hasPanelsWithImages || exportingDialogue;
                return (
                  <button
                    type="button"
                    onClick={handleExportWithDialogue}
                    disabled={disabled}
                    className={`col-span-2 flex items-start gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                      disabled
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer'
                    }`}
                  >
                    <span className="text-2xl mt-0.5">💬</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">Export with Dialogue</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {exportingDialogue && dialogueExportProgress
                          ? `Compositing panel ${dialogueExportProgress.done} / ${dialogueExportProgress.total}…`
                          : hasBubbles
                          ? 'Panels + speech bubbles composited as PNG ZIP'
                          : 'Panels as PNG ZIP (add bubbles in Dialogue tab)'}
                      </p>
                    </div>
                    {exportingDialogue && (
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mt-0.5 flex-none" />
                    )}
                  </button>
                );
              })()}
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant pt-2">Save &amp; Share</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={saveToCloud}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-colors ${
                  cloudSaveStatus === 'saved' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                {cloudSaveStatus === 'saved' ? '✓ Saved to Cloud' : '☁ Save to Cloud'}
              </button>
              <button type="button" onClick={() => setIsDrawerOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors">
                👤 My Projects
              </button>
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant pt-2">Developer</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={downloadProjectJson}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors">
                {'{ }'} Download JSON
              </button>
              <button type="button" onClick={copyProjectJson}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors">
                {jsonCopied ? '✓ Copied!' : '📋 Copy JSON'}
              </button>
            </div>
          </div>

          {/* Preview strip */}
          {(() => {
            const composedPages = Object.entries(composeStates)
              .filter(([, cs]) => cs.status === 'done' && cs.imageUrl)
              .map(([n, cs]) => ({ pageNumber: Number(n), imageUrl: cs.imageUrl! }))
              .sort((a, b) => a.pageNumber - b.pageNumber);
            const rawPages = Object.entries((step4.data?.pageStates ?? {}) as Record<string, { status: string; imageUrl: string | null }>)
              .filter(([, v]) => !!v.imageUrl)
              .map(([k, v]) => ({ pageNumber: Number(k.replace('page-', '')), imageUrl: v.imageUrl! }))
              .sort((a, b) => a.pageNumber - b.pageNumber);
            const previewPages = composedPages.length > 0 ? composedPages : rawPages;
            if (previewPages.length === 0) return null;
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Preview</p>
                  <button type="button" onClick={() => setShowPreview(true)}
                    className="text-xs font-semibold text-primary hover:opacity-80 transition-opacity">👁 Full preview →</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {previewPages.map((p) => (
                    <button key={p.pageNumber} type="button" onClick={() => setShowPreview(true)}
                      className="flex-shrink-0 w-24 rounded-lg overflow-hidden border border-outline-variant/20 hover:border-primary/40 transition-colors">
                      <img src={p.imageUrl} alt={`Page ${p.pageNumber}`} className="w-full h-auto" />
                      <p className="text-[10px] text-center py-1 text-on-surface-variant">Pg.{p.pageNumber}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Mark complete */}
          <div className="border-t border-outline-variant/20 pt-4">
            <button type="button" onClick={() => handleApprove(4)}
              className="w-full py-3 rounded-2xl text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity">
              ✓ Mark Complete &amp; Finish
            </button>
          </div>
        </div>
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

      <ProjectsDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

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
              if (activeStep4Tab === 'generate') setActiveStep(3);
              else if (activeStep4Tab === 'layout') handleTabChange('generate');
              else if (activeStep4Tab === 'dialogue') handleTabChange(comicPageMode === 'page' ? 'generate' : 'layout');
              else handleTabChange('dialogue');
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span className="hidden sm:inline">
              {activeStep4Tab === 'generate' ? 'Edit Script' :
               activeStep4Tab === 'layout' ? 'Generate' :
               activeStep4Tab === 'dialogue' ? (comicPageMode === 'page' ? 'Generate' : 'Layout') : 'Dialogue'}
            </span>
          </button>

          <button type="button"
            onClick={() => {
              if (activeStep4Tab === 'generate') handleTabChange(comicPageMode === 'page' ? 'dialogue' : 'layout');
              else if (activeStep4Tab === 'layout') handleTabChange('dialogue');
              else if (activeStep4Tab === 'dialogue') handleTabChange('export');
              else handleApprove(4);
            }}
            disabled={
              (activeStep4Tab === 'generate' && isTabLocked(comicPageMode === 'page' ? 'dialogue' : 'layout')) ||
              (activeStep4Tab === 'export' && finishBtnState !== 'all-complete')
            }
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all flex-shrink-0 ${
              activeStep4Tab === 'export'
                ? finishBtnState === 'all-complete'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isTabLocked(
                    activeStep4Tab === 'generate' ? 'layout' :
                    activeStep4Tab === 'layout' ? 'dialogue' : 'export'
                  )
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-on-primary hover:opacity-90'
            }`}>
            {activeStep4Tab === 'export' ? '✓ Finish & Export' :
             activeStep4Tab === 'generate' ? (comicPageMode === 'panel' ? 'Go to Layout →' : 'Go to Dialogue →') :
             activeStep4Tab === 'layout' ? 'Go to Dialogue →' : 'Go to Export →'}
          </button>
        </div>
      </div>
    </section>
  );
}
