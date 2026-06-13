'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { Step4Panel, Step4PanelState, PanelVersion } from '@/context/ComicGenerationContext';
import ProjectsDrawer from '@/components/ProjectsDrawer';
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

// ── Header badge for panel card ───────────────────────────────────────────────
function PanelHeaderBadge({ status }: { status: string }) {
  if (status === 'loading') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />⟳ Generating
    </span>
  );
  if (status === 'error') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-500 text-[10px] font-bold">
      ✗ Error
    </span>
  );
  if (status === 'success') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold">
      ✓ Done
    </span>
  );
  return null;
}

// ── Panel image area — 5 visual states ───────────────────────────────────────
function PanelImageArea({
  status,
  imageUrl,
  error,
  queuePosition,
  label,
  onRegenerate,
}: {
  status: string;
  imageUrl: string | null;
  error: string | null;
  queuePosition: number;
  label: string;
  onRegenerate: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const [greenFlash, setGreenFlash] = useState(false);
  const [appeared, setAppeared] = useState(false);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    if (status === 'loading') {
      if (!startedAtRef.current) startedAtRef.current = Date.now();
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current!) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
    startedAtRef.current = null;
    setElapsed(0);
  }, [status]);

  useEffect(() => {
    if (prevStatusRef.current !== 'success' && status === 'success') {
      setGreenFlash(true);
      setAppeared(true);
      const t = setTimeout(() => setGreenFlash(false), 600);
      return () => clearTimeout(t);
    }
    prevStatusRef.current = status;
  }, [status]);

  const estRemaining = Math.max(0, 45 - elapsed);
  const isNearFront = queuePosition <= 1;

  /* STATE 4 — Success */
  if (status === 'success' && imageUrl) {
    return (
      <div className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-colors duration-500 ${greenFlash ? 'border-[#22C55E]' : 'border-transparent'} ${appeared ? 'animate-panel-appear' : ''}`}>
        <Image src={imageUrl} alt={label} fill className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-4 gap-2">
          <button type="button" className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-sm hover:bg-white/30 transition-colors">
            🔍 View full
          </button>
          <button type="button" onClick={onRegenerate} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-sm hover:bg-white/30 transition-colors">
            ↺ Redraw
          </button>
          <button type="button" className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/80 text-white text-xs font-semibold backdrop-blur-sm hover:bg-emerald-600/80 transition-colors">
            ✓
          </button>
        </div>
      </div>
    );
  }

  /* STATE 5 — Error */
  if (status === 'error') {
    return (
      <div className="rounded-lg aspect-video border-2 border-dashed border-[#FCA5A5] bg-[#FEF2F2] flex flex-col items-center justify-center gap-2">
        <span className="text-[#EF4444] text-2xl">⚠</span>
        <p className="text-xs text-[#EF4444] font-medium">Image generation failed</p>
        {error && <p className="text-[10px] text-red-400 max-w-[80%] text-center truncate">{error}</p>}
        <button type="button" onClick={onRegenerate}
          className="mt-1 flex items-center gap-1 px-3 py-1 rounded-full border border-[#EF4444] text-[#EF4444] text-xs font-semibold hover:bg-red-50 transition-colors">
          ↺ Retry
        </button>
      </div>
    );
  }

  /* STATE 3 — Actively generating */
  if (status === 'loading') {
    const pct = Math.min(100, Math.round((elapsed / 45) * 100));
    return (
      <div className="rounded-lg aspect-video border-2 bg-[#EEF2FF] animate-border-pulse flex flex-col items-center justify-center gap-2 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        <span className="w-8 h-8 border-[3px] border-[#4F46E5]/30 border-t-[#4F46E5] rounded-full animate-spin" />
        <p className="text-xs text-[#4F46E5] font-semibold">Generating...</p>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-[#4F46E5]/20 overflow-hidden">
            <div className="h-full rounded-full bg-[#4F46E5] transition-[width] duration-1000"
              style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-[#6366F1]">~{estRemaining}s remaining</span>
        </div>
      </div>
    );
  }

  /* STATE 2 — Skeleton (near front of queue) */
  if (isNearFront) {
    return (
      <div className="rounded-lg aspect-video overflow-hidden">
        <div className="w-full h-full animate-shimmer"
          style={{ background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)', backgroundSize: '200% 100%' }} />
      </div>
    );
  }

  /* STATE 1 — Queued */
  return (
    <div className="rounded-lg aspect-video border-2 border-dashed border-[#CBD5E1] bg-[#F1F5F9] flex flex-col items-center justify-center gap-1">
      <span className="w-5 h-5 rounded-full border-2 border-[#94A3B8] flex-shrink-0" />
      <p className="text-xs text-[#94A3B8] font-medium">Panel queued</p>
      <p className="text-[10px] text-[#94A3B8]">#{queuePosition + 1} in queue</p>
    </div>
  );
}

// ── Progress stats bar ────────────────────────────────────────────────────────
function StatsBar({ total, success, loading: load, error }: { total: number; success: number; loading: number; error: number }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Pages', value: total, color: 'text-on-surface' },
        { label: 'Done', value: success, color: 'text-emerald-500' },
        { label: 'Generating', value: load, color: 'text-blue-500' },
        { label: 'Errors', value: error, color: 'text-red-500' },
      ].map((s) => (
        <div key={s.label} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4 text-center">
          <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
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

// ── Collapsible export panel ──────────────────────────────────────────────────
function ExportPanel({
  jsonCopied,
  jsonDownloaded,
  lastDownloadedJsonFile,
  projectSnapshot,
  cloudSaveStatus,
  cloudSaveError,
  copyProjectJson,
  downloadProjectJson,
  saveToCloud,
  onOpenProjects,
}: {
  jsonCopied: boolean;
  jsonDownloaded: boolean;
  lastDownloadedJsonFile: string | null;
  projectSnapshot: unknown;
  cloudSaveStatus: string;
  cloudSaveError: string | null;
  copyProjectJson: () => void;
  downloadProjectJson: () => void;
  saveToCloud: () => void;
  onOpenProjects: () => void;
}) {
  const [jsonOpen, setJsonOpen] = useState(false);
  return (
    <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-4">
      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Project Export</p>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveToCloud}
          disabled={cloudSaveStatus === 'saving'}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            cloudSaveStatus === 'saving'
              ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
              : cloudSaveStatus === 'saved'
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-primary text-on-primary hover:opacity-90'
          }`}
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            {cloudSaveStatus === 'saved' ? 'cloud_done' : 'cloud_upload'}
          </span>
          {cloudSaveStatus === 'saving' ? 'Saving…' : cloudSaveStatus === 'saved' ? 'Saved!' : 'Save to Cloud'}
        </button>
        <button
          type="button"
          onClick={onOpenProjects}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-sm">folder_open</span>
          My Projects
        </button>
        <button
          type="button"
          onClick={downloadProjectJson}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-sm">{jsonDownloaded ? 'check' : 'download'}</span>
          {jsonDownloaded ? 'Downloaded' : 'Download JSON'}
        </button>
        <button
          type="button"
          onClick={copyProjectJson}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-sm">{jsonCopied ? 'check' : 'content_copy'}</span>
          {jsonCopied ? 'Copied!' : 'Copy JSON'}
        </button>
      </div>

      {lastDownloadedJsonFile && (
        <p className="text-xs text-on-surface-variant">Last file: {lastDownloadedJsonFile}</p>
      )}
      {cloudSaveError && cloudSaveStatus === 'error' && (
        <p className="text-xs text-red-500">{cloudSaveError}</p>
      )}

      {/* Collapsible JSON preview */}
      <button
        type="button"
        onClick={() => setJsonOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left py-2 border-t border-outline-variant/10"
      >
        <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">data_object</span>
          Project JSON preview
        </span>
        <span
          className="material-symbols-outlined text-sm text-on-surface-variant transition-transform"
          style={{ transform: jsonOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>
      {jsonOpen && (
        <pre className="max-h-[280px] overflow-auto rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4 text-xs text-on-surface-variant font-mono leading-relaxed">
          {JSON.stringify(projectSnapshot, null, 2)}
        </pre>
      )}
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

// ── Confetti canvas overlay ───────────────────────────────────────────────────
function ConfettiCanvas({ active, onDone }: { active: boolean; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#4F46E5', '#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#06B6D4'];
    type P = { x: number; y: number; vx: number; vy: number; color: string; w: number; h: number; rot: number; rv: number };
    const particles: P[] = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 5,
      vy: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 10 + 6,
      h: Math.random() * 5 + 3,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.15,
    }));

    const start = Date.now();
    const dur = 1800;
    let raf: number;
    function draw() {
      const elapsed = Date.now() - start;
      if (elapsed >= dur) { ctx.clearRect(0, 0, canvas.width, canvas.height); onDone(); return; }
      const alpha = elapsed < 1200 ? 1 : 1 - (elapsed - 1200) / 600;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.rv;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, onDone]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="fixed inset-0 z-[70] pointer-events-none" />;
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

// ── Export options modal ──────────────────────────────────────────────────────
function ExportModal({
  panelCount, pageCount, chapterCount,
  onClose, onDownloadJson, onSaveCloud, cloudSaveStatus, onMarkComplete,
  onExportZip, onExportPdf, hasImages, exportStatus,
}: {
  panelCount: number; pageCount: number; chapterCount: number;
  onClose: () => void;
  onDownloadJson: () => void;
  onSaveCloud: () => void;
  cloudSaveStatus: string;
  onMarkComplete: () => void;
  onExportZip: (includeMetadata: boolean) => void;
  onExportPdf: (includeMetadata: boolean) => void;
  hasImages: boolean;
  exportStatus: 'idle' | 'exporting' | 'error';
}) {
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const isExporting = exportStatus === 'exporting';

  const opts: { icon: string; label: string; desc: string; disabled: boolean; action: (() => void) | null; saved?: boolean }[] = [
    {
      icon: '🖼', label: 'PDF Comic', desc: 'Full comic, print-ready',
      disabled: !hasImages || isExporting,
      action: () => { onExportPdf(includeMetadata); onClose(); },
    },
    {
      icon: '📱', label: 'Image Pack', desc: 'All pages as PNG ZIP',
      disabled: !hasImages || isExporting,
      action: () => { onExportZip(includeMetadata); onClose(); },
    },
    { icon: '☁', label: 'Save to Cloud', desc: 'Save to My Projects', disabled: false, action: onSaveCloud, saved: cloudSaveStatus === 'saved' },
    { icon: '{ }', label: 'Export JSON', desc: 'Script + metadata', disabled: false, action: onDownloadJson },
  ];

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full space-y-6 animate-slide-down">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">📦 Export Comic</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {panelCount} panels · {pageCount} pages · {chapterCount} chapters
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-sm text-gray-600">close</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {opts.map((o) => (
            <button key={o.label} type="button"
              onClick={o.action ?? undefined}
              disabled={o.disabled || !o.action}
              className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                o.disabled
                  ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                  : o.saved
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer'
              }`}>
              <span className="text-2xl">{o.icon}</span>
              <p className="text-sm font-bold text-gray-900 mt-2">{o.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{o.desc}</p>
              {o.saved && <span className="absolute top-2 right-2 text-emerald-500 text-sm">✓</span>}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeMetadata}
            onChange={(e) => setIncludeMetadata(e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-600"
          />
          <span className="text-sm text-gray-700">Include panel script (dialogue, shot types, prompts)</span>
        </label>

        <div className="pt-2 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Close
          </button>
          <button type="button" onClick={() => { onMarkComplete(); onClose(); }}
            className="flex-1 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-bold hover:opacity-90 transition-opacity">
            ✓ Mark Complete
          </button>
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
    jsonCopied,
    jsonDownloaded,
    lastDownloadedJsonFile,
    projectSnapshot,
    handleGenerate,
    handleApprove,
    handleRevokeApproval,
    handleRetry,
    handleStartFullGeneration,
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
    cloudSaveError,
    artStyle,
    getCooldownSeconds,
    setActiveStep,
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
  const [errorFilter, setErrorFilter] = useState(false);
  const [showConfetti] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  // Pulse "Export" button when image generation just completed
  const prevImgGenRef = useRef(false);
  const [exportPulse, setExportPulse] = useState(false);
  useEffect(() => {
    const justDone = prevImgGenRef.current && !isImageGenerating &&
      step4Stats.total > 0 && step4Stats.success === step4Stats.total;
    if (justDone) {
      setExportPulse(true);
      setTimeout(() => setExportPulse(false), 1000);
    }
    prevImgGenRef.current = isImageGenerating;
  }, [isImageGenerating, step4Stats]);

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

  // All panels flat for grid/list views
  const allPanels = step4PanelsByPage.flatMap(([, panels]) => panels);


  // Map panel id → page number for regenerate calls
  const panelPageMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [pageNumber, panels] of step4PanelsByPage) {
      for (const p of panels) map[p.id] = pageNumber;
    }
    return map;
  }, [step4PanelsByPage]);

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

  // Auto-clear errorFilter when no errors remain
  useEffect(() => {
    if (step4Stats.error === 0) setErrorFilter(false);
  }, [step4Stats.error]);

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

  // Finish button state machine
  const finishBtnState = (() => {
    if (isImageGenerating) return 'in-progress' as const;
    if (step4Stats.total > 0 && step4Stats.error === 0 && step4Stats.success === step4Stats.total) return 'all-complete' as const;
    if (step4Stats.total > 0 && step4Stats.error > 0) return 'has-errors' as const;
    return 'not-started' as const;
  })();

  const barPct = step4Stats.total > 0 ? Math.round((step4Stats.success / step4Stats.total) * 100) : 0;
  const barColor = finishBtnState === 'all-complete' ? '#22C55E' : finishBtnState === 'has-errors' ? '#F59E0B' : '#4F46E5';

  const retryErrorPages = () => {
    if (!step4.data?.pageStates) return;
    const errorPages = Object.entries(step4.data.pageStates as Record<string, { status: string }>)
      .filter(([, v]) => v.status === 'error')
      .map(([k]) => Number(k.replace('page-', '')));
    errorPages.forEach((pn) => handleRegeneratePage(pn));
    setShowFinishErrorModal(false);
  };

  return (
    <section className="text-on-surface space-y-6 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Image Generation</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Generate panel images and export the final project package
          </p>
        </div>
        <StateBadge state={state} />
      </div>


      {/* ── Generation Dashboard ── */}
      {(() => {
        const pct = step4Stats.total > 0 ? Math.round((step4Stats.success / step4Stats.total) * 100) : 0;
        const waiting = Math.max(0, step4Stats.total - step4Stats.success - step4Stats.loading - step4Stats.error);
        const isAllImgDone = step4Stats.total > 0 && step4Stats.success + step4Stats.error >= step4Stats.total && !isImageGenerating;
        const panelCount = allPanels.length || step4Stats.total;
        const estMin = Math.max(1, Math.ceil(panelCount * 10 / 60));

        /* ── COMPLETE ── */
        if (isAllImgDone && step4Stats.success > 0) {
          const hasErrors = step4Stats.error > 0;
          const chapterCount = (step3.data as {chapters?: unknown[]})?.chapters?.length ?? 1;
          if (hasErrors) {
            return (
              <div className="rounded-[12px] border border-amber-200 p-6 space-y-4 animate-slide-down"
                style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF9F0)' }}>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-amber-700">⚠ Completed with {step4Stats.error} error{step4Stats.error !== 1 ? 's' : ''}</span>
                  <span className="text-amber-600 tabular-nums">{Math.round((step4Stats.success / step4Stats.total) * 100)}%</span>
                </div>
                <SegmentedProgressBar total={step4Stats.total} success={step4Stats.success} error={step4Stats.error} loading={0} height={12} />
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-emerald-600 font-semibold">✓ {step4Stats.success}/{step4Stats.total} complete</span>
                  <span className="text-sm text-amber-500 font-semibold">⚠ {step4Stats.error} error{step4Stats.error !== 1 ? 's' : ''}</span>
                  <button type="button" onClick={retryErrorPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors">
                    ↺ Retry {step4Stats.error} failed page{step4Stats.error !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div className="rounded-[12px] border border-[#BBF7D0] p-6 space-y-5 animate-slide-down"
              style={{ background: 'linear-gradient(135deg, #EEF2FF, #F0FDF4)' }}>
              <div className="text-center space-y-1">
                <p className="text-2xl font-bold text-gray-900">🎉 Your comic is ready to export!</p>
                <p className="text-sm text-gray-500">
                  {step4Stats.total} pages · {chapterCount} chapter{chapterCount !== 1 ? 's' : ''} · {step4PanelsByPage.length} page{step4PanelsByPage.length !== 1 ? 's' : ''} generated
                </p>
              </div>
              <SegmentedProgressBar total={step4Stats.total} success={step4Stats.success} error={0} loading={0} height={8} />
              <div className="flex gap-3 justify-center">
                <button type="button" onClick={() => setShowPreview(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                  👁 Preview Comic
                </button>
                <button type="button" onClick={() => setShowExportModal(true)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:brightness-110
                    ${exportPulse ? 'animate-[pulse_0.4s_ease-in-out_2] scale-105' : ''}`}
                  style={{ background: 'linear-gradient(135deg,#059669,#10B981)', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}
                >
                  ⬇ Export &amp; Finish →
                </button>
              </div>
            </div>
          );
        }

        /* ── GENERATING IMAGES ── */
        if (isImageGenerating && !isPaused) {
          return (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Generation Progress</p>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-sm font-semibold mb-2">
                  <span className="text-on-surface-variant">
                    {step4Stats.error > 0
                      ? <span>✓ {step4Stats.success} · <span className="text-amber-500">⚠ {step4Stats.error} error{step4Stats.error !== 1 ? 's' : ''}</span> · {step4Stats.loading} processing</span>
                      : <>Processing {step4Stats.loading > 0 ? `${step4Stats.loading} panel${step4Stats.loading !== 1 ? 's' : ''}` : '…'}</>
                    }
                  </span>
                  <span className="text-on-surface tabular-nums font-bold">{pct}%</span>
                </div>
                <SegmentedProgressBar
                  total={step4Stats.total}
                  success={step4Stats.success}
                  error={step4Stats.error}
                  loading={step4Stats.loading}
                  height={12}
                />
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-5 text-sm font-semibold">
                {step4Stats.loading > 0 && (
                  <span className="flex items-center gap-1.5 text-[#3B82F6]">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse flex-shrink-0" />
                    Processing: {step4Stats.loading}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-[#22C55E]">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Done: {step4Stats.success}
                </span>
                {step4Stats.error > 0 && (
                  <span className="flex items-center gap-1.5 text-[#EF4444]">
                    <span className="material-symbols-outlined text-sm">error</span>
                    Errors: {step4Stats.error}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-[#9CA3AF]">
                  <span className="w-2 h-2 rounded-full border-2 border-[#9CA3AF] flex-shrink-0" />
                  Waiting: {waiting}
                </span>
              </div>

              {/* Currently drawing */}
              {currentlyDrawing && (
                <p className="text-sm italic text-[#6B7280]">Drawing: {currentlyDrawing}…</p>
              )}

              {/* Pause / Cancel */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPaused(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">pause</span>
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => handleRetry(4)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  Cancel
                </button>
              </div>
            </div>
          );
        }

        /* ── PAUSED ── */
        if (isPaused) {
          return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 space-y-4">
              <div className="flex items-center justify-between text-sm font-semibold mb-1">
                <span className="text-amber-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pause_circle</span>
                  Paused — {step4Stats.success}/{step4Stats.total} completed
                </span>
                <span className="text-amber-600 tabular-nums">{pct}%</span>
              </div>
              <div className="h-3 rounded-full bg-amber-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPaused(false)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  Resume Generation
                </button>
                <button
                  type="button"
                  onClick={() => { setIsPaused(false); handleRetry(4); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  Cancel
                </button>
              </div>
            </div>
          );
        }

        /* ── PANELS BUILT — ready to start image gen ── */
        if (state >= 3 && !isGenerating) {
          return (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 flex flex-col items-center text-center gap-5">
              <div>
                <p className="text-lg font-bold text-on-surface">
                  ✦ Panels ready — generate your images
                </p>
                <p className="text-sm text-on-surface-variant mt-1">
                  {panelCount} panels · Est. ~{estMin} min
                </p>
              </div>
              {step4.error && <p className="text-sm text-red-500">{step4.error}</p>}
              <button
                type="button"
                onClick={handleStartFullGeneration}
                disabled={isImageGenerating}
                style={{ boxShadow: '0 4px 20px rgba(79,70,229,0.4)' }}
                className="w-full h-[52px] rounded-full text-base font-bold text-white
                  bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]
                  hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚡ Generate All Images
              </button>
            </div>
          );
        }

        /* ── BUILDING PANELS ── */
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

        /* ── DEFAULT (state 1 — no panels yet) ── */
        return (
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 flex flex-col items-center text-center gap-5">
            <div>
              <p className="text-lg font-bold text-on-surface">✦ Ready to generate your comic</p>
              <p className="text-sm text-on-surface-variant mt-1">
                {panelCount > 0 ? `${panelCount} panels · Est. ~${estMin} min` : !step3.data ? 'Complete Step 3 first to generate the panel script.' : 'Build panels from script to begin.'}
              </p>
            </div>
            {step4.error && <p className="text-sm text-red-500">{step4.error}</p>}
            <button
              type="button"
              onClick={() => handleGenerate(4)}
              disabled={!canBuildPanels}
              style={{ boxShadow: canBuildPanels ? '0 4px 20px rgba(79,70,229,0.4)' : undefined }}
              className="w-full h-[52px] rounded-full text-base font-bold text-white
                bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]
                hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ⚡ Generate All Panels
            </button>
          </div>
        );
      })()}

      {/* ── Progress + Export ── */}
      {(state === 2 || state === 3 || state === 4 || state === 5) && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          {/* Left — stats */}
          <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-4">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Generation Progress</p>
            <StatsBar
              total={step4Stats.total}
              success={step4Stats.success}
              loading={step4Stats.loading}
              error={step4Stats.error}
            />
            {step4Stats.total > 0 && (
              <SegmentedProgressBar total={step4Stats.total} success={step4Stats.success} error={step4Stats.error} loading={step4Stats.loading} height={8} />
            )}
          </div>

          {/* Right — export */}
          <ExportPanel
            jsonCopied={jsonCopied}
            jsonDownloaded={jsonDownloaded}
            lastDownloadedJsonFile={lastDownloadedJsonFile}
            projectSnapshot={projectSnapshot}
            cloudSaveStatus={cloudSaveStatus}
            cloudSaveError={cloudSaveError}
            copyProjectJson={copyProjectJson}
            downloadProjectJson={downloadProjectJson}
            saveToCloud={saveToCloud}
            onOpenProjects={() => setIsDrawerOpen(true)}
          />
        </div>
      )}

      {/* ── Page view ── */}
      {(state === 3 || state === 4 || state === 5) && step4PanelsByPage.length > 0 && (() => {
        const displayPages = errorFilter
          ? step4PanelsByPage.filter(([pn]) => step4.data?.pageStates?.[`page-${pn}`]?.status === 'error')
          : step4PanelsByPage;
        return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-on-surface">
              {step4PanelsByPage.length} page{step4PanelsByPage.length !== 1 ? 's' : ''} · {allPanels.length} panel{allPanels.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-3">
              {step4Stats.error > 0 && (
                <button
                  type="button"
                  onClick={() => setErrorFilter((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    errorFilter
                      ? 'bg-amber-500 text-white'
                      : 'border border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100'
                  }`}
                >
                  ⚠ {errorFilter ? 'Show all' : `Show ${step4Stats.error} error${step4Stats.error !== 1 ? 's' : ''}`}
                </button>
              )}
              {step4Stats.error > 0 && !errorFilter && (
                <button type="button" onClick={retryErrorPages}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                  ↺ Retry {step4Stats.error} failed page{step4Stats.error !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
              {displayPages.map(([pageNumber, panels]) => {
                const pageState = step4.data?.pageStates?.[`page-${pageNumber}`];
                const pageStatus = pageState?.status ?? 'idle';
                return (
                  <div key={`page-${pageNumber}`} className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-on-surface">Page {pageNumber}</h3>
                        <PanelStatusDot status={pageStatus} />
                        <span className="text-xs text-on-surface-variant">
                          {pageStatus === 'loading' ? 'Generating…' : pageStatus === 'success' ? 'Done' : pageStatus === 'comparing' ? 'Comparing…' : pageStatus === 'error' ? 'Error' : 'Pending'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const pState = step4.data?.pageStates?.[`page-${pageNumber}`];
                          setRegenModal({
                            pageNumber,
                            contextLabel: `Page ${pageNumber}`,
                            currentImageUrl: pState?.imageUrl ?? null,
                            prevFeedback: pState?.pendingFeedback ?? '',
                          });
                        }}
                        disabled={!step4.data || pageStatus === 'loading'}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          !step4.data || pageStatus === 'loading'
                            ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
                            : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {pageStatus === 'loading' ? 'hourglass_empty' : pageStatus === 'error' ? 'replay' : 'refresh'}
                        </span>
                        {pageStatus === 'loading' ? 'Generating…' : pageStatus === 'error' ? 'Retry page' : 'Regenerate'}
                      </button>
                    </div>

                    {/* Full-page image / comparison view */}
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
                        onTryAgain={() => setRegenModal({
                          pageNumber,
                          contextLabel: `Page ${pageNumber}`,
                          currentImageUrl: pageState?.pendingUrl ?? pageState?.imageUrl ?? null,
                          prevFeedback: pageState?.pendingFeedback ?? '',
                        })}
                      />
                    ) : pageState?.imageUrl ? (
                      <div className="overflow-hidden rounded-2xl bg-surface-container">
                        <Image
                          src={pageState.imageUrl}
                          alt={`Page ${pageNumber} comic render`}
                          width={720}
                          height={960}
                          className="h-auto w-full object-cover"
                          unoptimized
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
                          <span className="text-sm text-on-surface-variant">
                            No image yet — click &ldquo;↺ Regenerate&rdquo; above.
                          </span>
                        )}
                      </div>
                    )}

                    {/* Panel script cards */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {panels.map((panel) => (
                        <PanelScriptCard key={panel.id} panel={panel} artStyle={artStyle} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
        );
      })()}

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

      {/* confetti disabled */}
      {showConfetti && null}

      {/* ── Preview modal ── */}
      {showPreview && (() => {
        const pages = Object.entries((step4.data?.pageStates ?? {}) as Record<string, { status: string; imageUrl: string | null }>)
          .filter(([, v]) => !!v.imageUrl)
          .map(([k, v]) => ({ pageNumber: Number(k.replace('page-', '')), imageUrl: v.imageUrl! }))
          .sort((a, b) => a.pageNumber - b.pageNumber);
        return <PreviewModal pages={pages} onClose={() => setShowPreview(false)} />;
      })()}

      {/* ── Export modal ── */}
      {showExportModal && (
        <ExportModal
          panelCount={allPanels.length}
          pageCount={step4PanelsByPage.length}
          chapterCount={(step3.data as { chapters?: unknown[] })?.chapters?.length ?? 1}
          onClose={() => setShowExportModal(false)}
          onDownloadJson={downloadProjectJson}
          onSaveCloud={saveToCloud}
          cloudSaveStatus={cloudSaveStatus}
          onMarkComplete={() => handleApprove(4)}
          onExportZip={exportZip}
          onExportPdf={exportPdf}
          hasImages={Object.values(step4.data?.pageStates ?? {}).some((s) => s.status === 'success' && s.imageUrl)}
          exportStatus={exportStatus}
        />
      )}

      {/* ── Toast stack (top-right, z-60) ── */}
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
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Dismiss
                  </button>
                  {toast.panelId !== '__export__' && (
                    <button type="button"
                      onClick={() => { handleRegeneratePage(toast.pageNumber); dismissToast(toast.id); }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                      Retry now
                    </button>
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

      {/* ── Error confirmation modal ── */}
      {showFinishErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFinishErrorModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <p className="text-base font-bold text-on-surface">
              {step4Stats.error} page{step4Stats.error !== 1 ? 's' : ''} failed to generate.
            </p>
            <p className="text-sm text-on-surface-variant">You can retry the failed pages or continue without them.</p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={retryErrorPages}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ↺ Retry failed pages
              </button>
              <button
                type="button"
                onClick={() => { setShowFinishErrorModal(false); handleApprove(4); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Continue anyway →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div
        className="fixed bottom-0 right-0 z-40 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ left: 'var(--studio-sidebar-width)' }}
      >
        {/* 4px progress line at very top of bar */}
        <div className="h-[3px] bg-gray-100 overflow-hidden">
          {step4Stats.total > 0 && (
            <div
              className="h-full rounded-r-full transition-all duration-500"
              style={{ width: `${barPct}%`, background: barColor }}
            />
          )}
        </div>

        <div className="border-t border-gray-200 px-10 py-4 max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Left: ← Edit Script */}
          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span className="hidden sm:inline">Edit Script</span>
          </button>

          {/* Center: progress */}
          <div className="flex-1 min-w-0 hidden sm:flex flex-col items-center justify-center gap-2">
            {isGenerating && (
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />
                <span className="text-sm text-gray-500">Building panels…</span>
              </div>
            )}
            {!isGenerating && step4Stats.total > 0 && (
              <div className="w-full max-w-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-emerald-600">✓ {step4Stats.success}/{step4Stats.total} complete</span>
                    {step4Stats.error > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-amber-500">⚠ {step4Stats.error} error{step4Stats.error !== 1 ? 's' : ''}</span>
                        <button type="button" onClick={retryErrorPages}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-bold hover:bg-amber-100 transition-colors">
                          ↺ Retry
                        </button>
                      </>
                    )}
                  </div>
                  <span className={`text-xs tabular-nums font-bold ${
                    finishBtnState === 'all-complete' ? 'text-emerald-600' :
                    finishBtnState === 'has-errors' ? 'text-amber-500' : 'text-gray-400'
                  }`}>{barPct}%</span>
                </div>
                <SegmentedProgressBar total={step4Stats.total} success={step4Stats.success} error={step4Stats.error} loading={step4Stats.loading} height={6} />
              </div>
            )}
          </div>

          {/* Right: secondary + finish button */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Rebuild secondary */}
            {(state === 3 || state === 4 || state === 5) && !isGenerating && (
              <button
                type="button"
                onClick={() => handleGenerate(4)}
                disabled={!canBuildPanels}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                {cooldown > 0 ? `${cooldown}s` : 'Rebuild'}
              </button>
            )}

            {/* Build Panels from Script (state 1/2 only) */}
            {(state === 1 || state === 2) && (
              <button
                type="button"
                onClick={() => { if (!isGenerating) handleGenerate(4); }}
                disabled={!canBuildPanels}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
                  !canBuildPanels || isGenerating
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:opacity-90'
                }`}
              >
                {isGenerating ? (
                  <><span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />Building…</>
                ) : (
                  <><span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>build</span>Build Panels from Script</>
                )}
              </button>
            )}

            {/* Revoke (wizard state 4 = approved) */}
            {state === 4 && (
              <button
                type="button"
                onClick={() => handleRevokeApproval(4)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-on-surface-variant hover:text-on-surface border border-outline-variant/20 hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-sm">undo</span>
                Revoke
              </button>
            )}

            {/* ── FINISH BUTTON STATE MACHINE ── */}
            {(state === 3 || state === 5) && (() => {
              /* STATE 1 — not started */
              if (finishBtnState === 'not-started') {
                return (
                  <div className="relative group">
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold cursor-not-allowed opacity-60"
                      style={{ background: '#E5E7EB', color: '#9CA3AF' }}
                    >
                      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                      Mark Complete
                    </button>
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50 pointer-events-none w-64">
                      <div className="bg-gray-900 text-white rounded-xl px-3 py-2 text-xs leading-relaxed shadow-xl">
                        Generate images before marking complete.<br />
                        {step4Stats.total > 0 ? `${step4Stats.total} page${step4Stats.total !== 1 ? 's' : ''} not yet generated.` : 'No panels built yet.'}
                      </div>
                      <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 ml-auto mr-5 -mt-1.5" />
                    </div>
                  </div>
                );
              }

              /* STATE 2 — in progress */
              if (finishBtnState === 'in-progress') {
                const ringR = 6, ringC = 2 * Math.PI * ringR;
                return (
                  <div className="relative group">
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold cursor-not-allowed opacity-60"
                      style={{ background: '#E5E7EB', color: '#9CA3AF' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" className="flex-shrink-0">
                        <circle cx="8" cy="8" r={ringR} fill="none" stroke="#D1D5DB" strokeWidth="2" />
                        <circle cx="8" cy="8" r={ringR} fill="none" stroke="#6B7280" strokeWidth="2"
                          strokeDasharray={`${(barPct / 100) * ringC} ${ringC}`}
                          strokeLinecap="round"
                          transform="rotate(-90 8 8)" />
                      </svg>
                      {barPct}% · Mark Complete
                    </button>
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50 pointer-events-none w-64">
                      <div className="bg-gray-900 text-white rounded-xl px-3 py-2 text-xs leading-relaxed shadow-xl">
                        Generating images… {step4Stats.success}/{step4Stats.total} complete.<br />
                        Please wait for generation to finish.
                      </div>
                      <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 ml-auto mr-5 -mt-1.5" />
                    </div>
                  </div>
                );
              }

              /* STATE 3 — has errors */
              if (finishBtnState === 'has-errors') {
                return (
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => setShowFinishErrorModal(true)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold border transition-colors hover:brightness-95"
                      style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' }}
                    >
                      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                      Mark Complete
                    </button>
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50 pointer-events-none w-64">
                      <div className="bg-gray-900 text-white rounded-xl px-3 py-2 text-xs leading-relaxed shadow-xl">
                        ⚠ {step4Stats.error} page{step4Stats.error !== 1 ? 's' : ''} failed to generate.<br />
                        You can continue or retry the failed pages.
                      </div>
                      <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 ml-auto mr-5 -mt-1.5" />
                    </div>
                  </div>
                );
              }

              /* STATE 4 — all complete */
              return (
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all
                    ${exportPulse ? 'animate-[pulse_0.4s_ease-in-out_2] scale-[1.05]' : ''}`}
                  style={{ background: '#22C55E', boxShadow: '0 4px 16px rgba(34,197,94,0.4)' }}
                >
                  ✓ Finish &amp; Export →
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}