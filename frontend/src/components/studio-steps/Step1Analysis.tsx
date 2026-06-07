'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import Markdown from '@/components/Markdown';

// ── Section definitions ────────────────────────────────────────────────────────

const SECTION_DEFS = [
  { id: 1 as const, marker: '## 1. Character Breakdown',       title: '1. Character Breakdown' },
  { id: 2 as const, marker: '## 2. Plot & Arc Analysis',       title: '2. Plot & Arc Analysis' },
  { id: 3 as const, marker: '## 3. Chapter Division',           title: '3. Chapter Division' },
  { id: 4 as const, marker: '## 4. Scene-by-Scene Breakdown',   title: '4. Scene-by-Scene Breakdown' },
  { id: 5 as const, marker: '## 5. Global Manga Layout Rules',  title: '5. Global Manga Layout Rules' },
  { id: 6 as const, marker: '## 6. Final Statistics Summary',   title: '6. Final Statistics Summary' },
];

type SectionId = 1 | 2 | 3 | 4 | 5 | 6;
type SectionStatus = 'skeleton' | 'active' | 'complete';

interface ParsedSection {
  id: SectionId;
  title: string;
  content: string;
  status: SectionStatus;
}

// Parse stream text into 6 known sections in real time.
function parseStreamSections(text: string): ParsedSection[] {
  return SECTION_DEFS.map((def, i) => {
    const startIdx = text.indexOf(def.marker);
    if (startIdx === -1) {
      return { id: def.id, title: def.title, content: '', status: 'skeleton' };
    }
    const nextDef = SECTION_DEFS[i + 1];
    const nextIdx = nextDef ? text.indexOf(nextDef.marker) : -1;
    if (nextIdx !== -1) {
      return {
        id: def.id,
        title: def.title,
        content: text.slice(startIdx + def.marker.length, nextIdx).trim(),
        status: 'complete',
      };
    }
    return {
      id: def.id,
      title: def.title,
      content: text.slice(startIdx + def.marker.length).trim(),
      status: 'active',
    };
  });
}

// Fallback: parse by any ## headings when AI doesn't use expected markers.
function parseFallbackSections(md: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;
  for (const line of md.split('\n')) {
    if (/^#{1,3}\s/.test(line) && !/^####/.test(line)) {
      if (current && current.body.trim()) sections.push(current);
      current = { heading: line.replace(/^#+\s*/, '').trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current && current.body.trim()) sections.push(current);
  return sections;
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────────

function SkeletonLines({ count = 4 }: { count?: number }) {
  const widths = [88, 72, 84, 60, 78];
  return (
    <div className="space-y-2.5 motion-safe:animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-on-surface/[0.08]"
          style={{ width: `${widths[i % widths.length]}%` }}
        />
      ))}
    </div>
  );
}

// ── Section accordion ─────────────────────────────────────────────────────────

interface SectionAccordionProps {
  section: ParsedSection;
  isOpen: boolean;
  onToggle: () => void;
}

const SectionAccordion = React.forwardRef<HTMLDivElement, SectionAccordionProps>(
  ({ section, isOpen, onToggle }, ref) => {
    const { status, title, content } = section;
    const isSkeleton = status === 'skeleton';
    const isActive   = status === 'active';

    return (
      <div ref={ref} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between px-5 py-4 text-left gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isSkeleton && (
              <span className="w-2 h-2 rounded-full bg-on-surface/15 flex-shrink-0 motion-safe:animate-pulse" />
            )}
            {isActive && (
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 motion-safe:animate-pulse" />
            )}
            {status === 'complete' && (
              <span
                className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            )}
            <span className={`font-semibold text-sm truncate ${isSkeleton ? 'text-on-surface-variant/50' : 'text-on-surface'}`}>
              {title}
            </span>
          </div>
          <span
            className="material-symbols-outlined text-lg text-on-surface-variant transition-transform flex-shrink-0"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            expand_more
          </span>
        </button>

        {isOpen && (
          <div className="px-5 pb-5">
            {isSkeleton ? (
              <SkeletonLines />
            ) : content ? (
              <>
                <Markdown className="[&>*:last-child]:mb-0">{content}</Markdown>
                {isActive && (
                  <div className="flex items-center gap-1 mt-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 motion-safe:animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 motion-safe:animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 motion-safe:animate-bounce" style={{ animationDelay: '240ms' }} />
                  </div>
                )}
              </>
            ) : isActive ? (
              <SkeletonLines count={3} />
            ) : null}
          </div>
        )}
      </div>
    );
  }
);
SectionAccordion.displayName = 'SectionAccordion';

// ── Right navigation panel ────────────────────────────────────────────────────

function RightNavPanel({
  sections,
  isStreaming,
  progressCount,
  activeSectionTitle,
  chars,
  stats,
  approvedAt,
  onScrollTo,
  state,
}: {
  sections: ParsedSection[];
  isStreaming: boolean;
  progressCount: number;
  activeSectionTitle?: string;
  chars: string[];
  stats: { label: string; value: string }[];
  approvedAt: string | null;
  onScrollTo: (id: SectionId) => void;
  state: State;
}) {
  const SectionList = (
    <div>
      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
        Sections
      </p>
      <div className="space-y-0.5">
        {sections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => onScrollTo(sec.id)}
            className="w-full flex items-center gap-2.5 text-left py-1.5 px-2 rounded-xl hover:bg-surface-container transition-colors"
          >
            {sec.status === 'skeleton' && (
              <span className="w-2.5 h-2.5 rounded-full bg-on-surface/15 flex-shrink-0 motion-safe:animate-pulse" />
            )}
            {sec.status === 'active' && (
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 motion-safe:animate-pulse" />
            )}
            {sec.status === 'complete' && (
              <span
                className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            )}
            <span className={`text-xs truncate ${
              sec.status === 'skeleton' ? 'text-on-surface-variant/40' :
              sec.status === 'active'   ? 'text-blue-600 font-semibold' :
                                          'text-on-surface-variant'
            }`}>
              {sec.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  if (isStreaming) {
    return (
      <div className="space-y-5">
        {progressCount > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Progress</p>
              <span className="text-xs text-on-surface-variant">{progressCount} / 6</span>
            </div>
            <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.round((progressCount / 6) * 100)}%` }}
              />
            </div>
            {activeSectionTitle && (
              <p className="text-[11px] text-on-surface-variant mt-1.5 truncate">
                Analyzing: {activeSectionTitle}
              </p>
            )}
          </div>
        )}
        {SectionList}
      </div>
    );
  }

  // Post-stream: rich data panel
  return (
    <div className="space-y-5">
      {chars.length > 0 && (
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
            Characters
          </p>
          <div className="space-y-2">
            {chars.map((c, i) => (
              <div key={`${c}-${i}`} className="flex items-start gap-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface leading-snug truncate">
                    {c.split(/[-–:]/)[0].trim()}
                  </p>
                  {c.split(/[-–:]/).slice(1).join(' ').trim() && (
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-snug line-clamp-2">
                      {c.split(/[-–:]/).slice(1).join(' ').trim()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.length > 0 && (
        <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
            Quick Stats
          </p>
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-extrabold text-on-surface">{s.value}</p>
                <p className="text-xs text-on-surface-variant">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {state === 4 && approvedAt && (
        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/15 p-4 text-center">
          <span className="material-symbols-outlined text-2xl text-emerald-500 mb-1 block" style={{ fontVariationSettings: "'FILL' 1" }}>
            task_alt
          </span>
          <p className="text-xs text-emerald-600 font-semibold">Approved</p>
          <p className="text-[10px] text-emerald-500/70 mt-0.5">
            {new Date(approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      {SectionList}
    </div>
  );
}

// ── State badge ───────────────────────────────────────────────────────────────

type State = 1 | 2 | 3 | 4 | 5;

function StateBadge({
  state,
  streamProgress,
}: {
  state: State;
  streamProgress?: { current: number; total: number } | null;
}) {
  if (state === 1) return null;

  if (state === 2) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 motion-safe:animate-pulse" />
          Analyzing your story…
        </div>
        {streamProgress && streamProgress.current > 0 && (
          <div className="flex items-center gap-2 min-w-[160px]">
            <div className="flex-1 h-1 rounded-full bg-on-surface/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.round((streamProgress.current / streamProgress.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-on-surface-variant flex-shrink-0 tabular-nums">
              {streamProgress.current} / {streamProgress.total}
            </span>
          </div>
        )}
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
        Approved
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
      Regenerated — re-approval needed
    </div>
  );
}

// ── Stats extractor ───────────────────────────────────────────────────────────

function extractStats(structuredJson: Record<string, unknown> | null): { label: string; value: string }[] {
  if (!structuredJson) return [];
  const stats: { label: string; value: string }[] = [];
  try {
    const steps = structuredJson.steps as Record<string, unknown> | undefined;
    const s1 = (steps?.step1 ?? structuredJson.step_1_analysis) as Record<string, unknown> | undefined;
    const data = (s1?.data ?? s1?.api_data) as Record<string, unknown> | undefined;
    const json = (data?.structured_json ?? data) as Record<string, unknown> | undefined;
    if (json) {
      const chapters = json.chapters as unknown[] | undefined;
      if (chapters?.length) stats.push({ label: 'Chapters', value: String(chapters.length) });
      const totalPanels = json.total_panels ?? json.estimated_panels;
      if (totalPanels != null) stats.push({ label: 'Est. panels', value: String(totalPanels) });
    }
  } catch { /* ignore */ }
  return stats;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Step1Analysis() {
  const {
    step1,
    handleGenerate,
    handleApprove,
    handleRevokeApproval,
    handleRetry,
    getCooldownSeconds,
  } = useComicGeneration();

  const cooldown    = getCooldownSeconds(1);
  const isGenerating = step1.isLoading;
  const canGenerate = !isGenerating && cooldown === 0;

  let state: State = 1;
  if (isGenerating)                                          state = 2;
  else if (step1.isApproved && !step1.regeneratedAfterApproval) state = 4;
  else if (step1.data && step1.regeneratedAfterApproval)     state = 5;
  else if (step1.data)                                       state = 3;

  // ── Open/closed accordion state (user-controlled + auto-open on active section) ──
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1]));
  const prevActiveRef  = useRef<number | null>(null);
  const wasLoadingRef  = useRef(false);

  // Reset when a new generation starts
  useEffect(() => {
    if (isGenerating && !wasLoadingRef.current) {
      setOpenSections(new Set([1]));
      prevActiveRef.current = null;
    }
    wasLoadingRef.current = isGenerating;
  }, [isGenerating]);

  // ── Section parsing (derived from live streamingText or final markdown) ──
  const streamText = isGenerating
    ? (step1.streamingText ?? '')
    : (step1.data?.analysisMarkdown ?? '');

  const parsedSections = useMemo<ParsedSection[]>(() => {
    // State 1 (idle): all skeleton
    if (state === 1) {
      return SECTION_DEFS.map(def => ({ id: def.id, title: def.title, content: '', status: 'skeleton' as const }));
    }

    const result = parseStreamSections(streamText);

    // Fallback: AI didn't use expected markers — put all content in section 1
    if (!isGenerating && step1.data && !result.some(s => s.content !== '')) {
      return result.map((s, i) => ({
        ...s,
        content: i === 0 ? step1.data!.analysisMarkdown : '',
        status: 'complete' as const,
      }));
    }

    return result;
  }, [streamText, state, isGenerating, step1.data]);

  // Auto-open the section the stream is currently writing into
  useEffect(() => {
    const active = parsedSections.find(s => s.status === 'active');
    if (active && active.id !== prevActiveRef.current) {
      prevActiveRef.current = active.id;
      setOpenSections(prev => new Set([...prev, active.id]));
    }
  }, [parsedSections]);

  // ── Section DOM refs for scroll-to ──
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollTo = (id: SectionId) => {
    sectionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const toggleSection = (id: number) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // ── Progress counters ──
  const completedCount    = parsedSections.filter(s => s.status === 'complete').length;
  const activeSectionObj  = parsedSections.find(s => s.status === 'active');
  const progressCount     = completedCount + (activeSectionObj ? 1 : 0);

  // ── Right panel data ──
  const chars = step1.data?.characterBreakdown ?? [];
  const stats = extractStats(step1.data?.structuredJson ?? null);

  return (
    <section className="text-on-surface space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Story Analysis</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Narrative insights, character arcs, and structural breakdown
          </p>
        </div>
        <StateBadge
          state={state}
          streamProgress={isGenerating ? { current: progressCount, total: 6 } : null}
        />
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => handleGenerate(1)}
          disabled={!canGenerate}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
            !canGenerate
              ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
              : state >= 3
                ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                : 'bg-primary text-on-primary hover:opacity-90'
          }`}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isGenerating ? 'hourglass_empty' : state >= 3 ? 'refresh' : 'auto_awesome'}
          </span>
          {isGenerating
            ? 'Generating…'
            : cooldown > 0
              ? `Retry in ${cooldown}s`
              : state >= 3
                ? 'Regenerate'
                : 'Generate Analysis'}
        </button>

        {(state === 3 || state === 5) && (
          <button
            type="button"
            onClick={() => handleApprove(1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Approve
          </button>
        )}

        {state === 4 && (
          <button
            type="button"
            onClick={() => handleRevokeApproval(1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base">undo</span>
            Revoke Approval
          </button>
        )}

        {step1.error && (
          <button
            type="button"
            onClick={() => handleRetry(1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
          >
            <span className="material-symbols-outlined text-base">replay</span>
            Retry
          </button>
        )}
        {step1.error && <span className="text-sm text-red-500">{step1.error}</span>}
      </div>

      {/* ── Empty state (state 1) ── */}
      {state === 1 && (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-outline-variant" style={{ fontVariationSettings: "'FILL' 1" }}>
            auto_stories
          </span>
          <div className="text-center">
            <p className="font-semibold text-on-surface">No analysis yet</p>
            <p className="text-sm text-on-surface-variant mt-1">
              Click &ldquo;Generate Analysis&rdquo; to extract narrative structure and characters.
            </p>
          </div>
        </div>
      )}

      {/* ── Main content grid (states 2, 3, 4, 5) ── */}
      {state !== 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

          {/* Left — 6 accordion sections (stable DOM, content-only updates) */}
          <div className="space-y-3">
            {parsedSections.map(sec => (
              <SectionAccordion
                key={sec.id}
                ref={el => {
                  if (el) sectionRefs.current.set(sec.id, el);
                  else sectionRefs.current.delete(sec.id);
                }}
                section={sec}
                isOpen={openSections.has(sec.id)}
                onToggle={() => toggleSection(sec.id)}
              />
            ))}
          </div>

          {/* Right — live navigation + data panel */}
          <RightNavPanel
            sections={parsedSections}
            isStreaming={isGenerating}
            progressCount={progressCount}
            activeSectionTitle={activeSectionObj?.title}
            chars={chars}
            stats={stats}
            approvedAt={step1.approvedAt}
            onScrollTo={scrollTo}
            state={state}
          />
        </div>
      )}
    </section>
  );
}