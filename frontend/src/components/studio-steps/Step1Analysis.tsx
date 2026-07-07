'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import Markdown from '@/components/Markdown';
import ShapeLoader from '@/components/ShapeLoader';
import { useAutoScrollStreamingPref } from '@/hooks/useAutoScrollStreamingPref';
import { useScrollIntentDetector } from '@/hooks/useScrollIntentDetector';

// ── Section definitions ────────────────────────────────────────────────────────

// coreMarker = the number + name without any heading prefix.
// The AI may prepend ##, #, ###, ** or nothing — findMarker handles all variants.
const SECTION_DEFS = [
  { id: 1 as const, coreMarker: '1. Character Breakdown',       title: '1. Character Breakdown' },
  { id: 2 as const, coreMarker: '2. Plot & Arc Analysis',       title: '2. Plot & Arc Analysis' },
  { id: 3 as const, coreMarker: '3. Chapter Division',           title: '3. Chapter Division' },
  { id: 4 as const, coreMarker: '4. Scene-by-Scene Breakdown',   title: '4. Scene-by-Scene Breakdown' },
  { id: 5 as const, coreMarker: '5. Global Manga Layout Rules',  title: '5. Global Manga Layout Rules' },
  { id: 6 as const, coreMarker: '6. Final Statistics Summary',   title: '6. Final Statistics Summary' },
];

type SectionId = 1 | 2 | 3 | 4 | 5 | 6;
type SectionStatus = 'skeleton' | 'active' | 'complete';

interface ParsedSection {
  id: SectionId;
  title: string;
  content: string;
  status: SectionStatus;
}

// Locate a section header regardless of heading prefix (##, #, **, or bare).
// Returns { start: index of heading line, contentStart: index of first char after the line }.
function findMarker(text: string, coreMarker: string): { start: number; contentStart: number } {
  for (const prefix of ['## ', '### ', '# ', '#### ', '**', '']) {
    const full = prefix + coreMarker;
    let lineStart = -1;

    const nlIdx = text.indexOf('\n' + full);
    if (nlIdx !== -1) {
      lineStart = nlIdx + 1;
    } else if (text.startsWith(full)) {
      lineStart = 0;
    }

    if (lineStart !== -1) {
      const nlAfter = text.indexOf('\n', lineStart);
      return {
        start: lineStart,
        contentStart: nlAfter === -1 ? text.length : nlAfter,
      };
    }
  }
  return { start: -1, contentStart: -1 };
}

// Parse stream text into 6 known sections in real time.
function parseStreamSections(text: string): ParsedSection[] {
  return SECTION_DEFS.map((def, i) => {
    const { start, contentStart } = findMarker(text, def.coreMarker);
    if (start === -1) {
      return { id: def.id, title: def.title, content: '', status: 'skeleton' };
    }
    const nextDef = SECTION_DEFS[i + 1];
    const { start: nextStart } = nextDef ? findMarker(text, nextDef.coreMarker) : { start: -1 };
    if (nextStart !== -1) {
      return {
        id: def.id,
        title: def.title,
        content: text.slice(contentStart, nextStart).trim(),
        status: 'complete',
      };
    }
    return {
      id: def.id,
      title: def.title,
      content: text.slice(contentStart).trim(),
      status: 'active',
    };
  });
}

// Strip trailing loading artifacts that AI responses sometimes append.
function cleanContent(raw: string): string {
  return raw
    .replace(/[\s\n]*[•·•·]{2,}[\s\n]*$/, '')
    .trimEnd();
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
  displayContent: string;
  isOpen: boolean;
  onToggle: () => void;
  isEdited: boolean;
  isEditing: boolean;
  editBuffer: string;
  onEditStart: () => void;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  isStreaming: boolean;
  isReviewed: boolean;
}

const SectionAccordion = React.forwardRef<HTMLDivElement, SectionAccordionProps>(
  (
    {
      section, displayContent, isOpen, onToggle,
      isEdited, isEditing, editBuffer,
      onEditStart, onEditChange, onEditSave, onEditCancel,
      isStreaming, isReviewed,
    },
    ref,
  ) => {
    const { status, title } = section;
    const isSkeleton = status === 'skeleton';
    const isActive   = status === 'active';
    const taRef = useRef<HTMLTextAreaElement>(null);

    const insertMarkdown = (before: string, after: string) => {
      const ta = taRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const sel   = editBuffer.slice(start, end);
      const newVal = editBuffer.slice(0, start) + before + sel + after + editBuffer.slice(end);
      onEditChange(newVal);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + before.length, start + before.length + sel.length);
      });
    };

    const showEditBtn = isOpen && !isStreaming && !isSkeleton;

    return (
      <div
        ref={ref}
        className="t-acc rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden"
        data-open={isOpen ? 'true' : 'false'}
        style={{ scrollMarginTop: 96, scrollMarginBottom: 120 }}
      >
        {/* Header — use div+role to avoid nested <button> elements */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
          className="w-full flex items-center justify-between px-5 py-4 text-left gap-3 cursor-pointer select-none group/header"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isSkeleton && (
              <span className="w-2 h-2 rounded-full bg-on-surface/15 flex-shrink-0 motion-safe:animate-pulse" />
            )}
            {isActive && (
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 motion-safe:animate-pulse" />
            )}
            {/* Matches SectionDot in the right-rail preview: checked while streaming
                (completion so far), but after the stream ends it only checks once the
                user has actually opened the section — not merely because it generated. */}
            {status === 'complete' && (
              isStreaming || isReviewed ? (
                <span
                  className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-400 flex-shrink-0" />
              )
            )}
            <span className={`font-semibold text-sm truncate ${isSkeleton ? 'text-on-surface-variant/50' : 'text-on-surface'}`}>
              {title}
            </span>
            {isEdited && (
              <span
                className="material-symbols-outlined text-sm text-amber-400 flex-shrink-0"
                title="Manually edited"
              >
                edit
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Edit button: invisible by default, visible on header hover (or while editing) */}
            {showEditBtn && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (!isEditing) onEditStart(); }}
                title="Edit this section"
                className={`flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface px-2 py-1 rounded-lg hover:bg-surface-container transition-all ${
                  isEditing
                    ? 'opacity-100'
                    : 'opacity-0 group-hover/header:opacity-100'
                }`}
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
            )}
            <span
              className="material-symbols-outlined text-lg text-on-surface-variant transition-transform"
              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              expand_more
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="t-acc-panel">
          <div className="t-acc-panel-inner">
            <div className="px-5 pb-5">
              {isEditing ? (
                <div className="space-y-2">
                  {/* Edit toolbar */}
                  <div className="flex items-center gap-1 pb-2 border-b border-outline-variant/10">
                    <button
                      type="button"
                      onClick={() => insertMarkdown('**', '**')}
                      className="px-2 py-1 text-xs font-bold rounded hover:bg-surface-container transition-colors"
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('*', '*')}
                      className="px-2 py-1 text-xs italic rounded hover:bg-surface-container transition-colors"
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('\n- ', '')}
                      className="px-2 py-1 text-xs rounded hover:bg-surface-container transition-colors"
                      title="Bullet list"
                    >
                      • List
                    </button>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={onEditCancel}
                      className="px-3 py-1.5 text-xs rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onEditSave}
                      className="px-3 py-1.5 text-xs rounded-xl bg-gray-900 text-white hover:opacity-90 font-semibold transition-opacity"
                    >
                      Save changes
                    </button>
                  </div>

                  {section.id === 6 && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                      <span className="material-symbols-outlined text-sm">lock</span>
                      Numerical statistics in this section feed into later pipeline steps. Adjust targets in Story Setup instead.
                    </div>
                  )}

                  <textarea
                    ref={taRef}
                    value={editBuffer}
                    onChange={(e) => onEditChange(e.target.value)}
                    className="w-full min-h-[220px] rounded-xl bg-surface-container px-4 py-3 text-sm font-mono focus:outline-none border border-outline-variant/20 focus:border-primary/40 resize-y leading-relaxed"
                  />
                </div>
              ) : isSkeleton ? (
                <SkeletonLines />
              ) : displayContent ? (
                <Markdown className="[&>*:last-child]:mb-0">{displayContent}</Markdown>
              ) : isActive ? (
                <SkeletonLines count={3} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
SectionAccordion.displayName = 'SectionAccordion';

// ── Character card helpers ────────────────────────────────────────────────────

interface CharCard {
  name: string;
  role: string;
  visualHook?: string;
  isMain: boolean;
}

// Primary source: extract from structuredJson (has full name/role/visual_hook).
// Path: structuredJson.steps.step_1_analysis.data.analysis.{main_characters,supporting_characters}
function extractCharactersFromJson(json: Record<string, unknown> | null): CharCard[] {
  if (!json) return [];
  try {
    const steps = json.steps as Record<string, unknown> | undefined;
    const s1    = steps?.step_1_analysis as Record<string, unknown> | undefined;
    const data  = s1?.data as Record<string, unknown> | undefined;
    const analysis = data?.analysis as Record<string, unknown> | undefined;
    if (!analysis) return [];

    const cards: CharCard[] = [];

    const mainChars = analysis.main_characters as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(mainChars)) {
      for (const c of mainChars) {
        const name = String(c.name ?? '').trim();
        const role = String(c.role ?? '').trim();
        const hook = String(c.visual_hook ?? '').trim();
        if (name) cards.push({ name, role, visualHook: hook || undefined, isMain: true });
      }
    }

    const suppChars = analysis.supporting_characters as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(suppChars)) {
      for (const c of suppChars) {
        const name = String(c.name ?? '').trim();
        const role = String(c.role ?? '').trim();
        if (name) cards.push({ name, role, isMain: false });
      }
    }

    return cards;
  } catch {
    return [];
  }
}

// Fallback: parse from the old characterBreakdown string array.
function parseCharCardsFromStrings(chars: string[]): CharCard[] {
  return chars
    .filter(c => c && c !== 'Character arcs pending parsing.')
    .map(c => {
      const name = c.split(/[-–:]/)[0].trim();
      const role = c.split(/[-–:]/).slice(1).join(' ').trim();
      const isMain = /protagonist|antagonist|main character|co-protagonist/i.test(role);
      return { name, role, isMain };
    })
    .filter(c => c.name.length > 1);
}

function CharCardSkeleton() {
  return (
    <div className="rounded-2xl border border-outline-variant/10 px-3 py-2.5 motion-safe:animate-pulse space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-on-surface/10 flex-shrink-0" />
        <div className="h-3 rounded-full bg-on-surface/10 w-3/4" />
      </div>
      <div className="h-2.5 rounded-full bg-on-surface/[0.06] w-full" />
    </div>
  );
}

function CharCardItem({ card }: { card: CharCard }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetail = !!(card.role || card.visualHook);

  return (
    <div
      className={`t-acc rounded-2xl border overflow-hidden ${
        card.isMain
          ? 'bg-emerald-50/60 border-emerald-200/60'
          : 'bg-amber-50/40 border-amber-200/40'
      }`}
      data-open={isOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => hasDetail && setIsOpen(v => !v)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${card.isMain ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        <span className="text-xs font-semibold text-on-surface flex-1 min-w-0 truncate">{card.name}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none ${
          card.isMain ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {card.isMain ? 'Main' : 'Support'}
        </span>
        {hasDetail && (
          <span
            className="material-symbols-outlined text-sm text-on-surface-variant flex-shrink-0 transition-transform"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            expand_more
          </span>
        )}
      </button>

      {hasDetail && (
        <div className="t-acc-panel">
          <div className="t-acc-panel-inner">
            <div className={`px-3 pb-3 pt-1 space-y-1 border-t ${card.isMain ? 'border-emerald-200/40' : 'border-amber-200/40'}`}>
              {card.role && (
                <p className="text-xs text-on-surface-variant leading-snug">{card.role}</p>
              )}
              {card.visualHook && (
                <p className="text-[11px] text-on-surface-variant/60 leading-snug italic">{card.visualHook}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Right navigation panel ────────────────────────────────────────────────────

function RightNavPanel({
  sections,
  isStreaming,
  progressCount,
  activeSectionTitle,
  charCards,
  section1Status,
  totalDetected,
  stats,
  approvedAt,
  onScrollTo,
  state,
  reviewedSections,
}: {
  sections: ParsedSection[];
  isStreaming: boolean;
  progressCount: number;
  activeSectionTitle?: string;
  charCards: CharCard[];
  section1Status: SectionStatus;
  totalDetected: number;
  stats: { label: string; value: string }[];
  approvedAt: string | null;
  onScrollTo: (id: SectionId) => void;
  state: State;
  reviewedSections: Set<number>;
}) {
  const [showAllChars, setShowAllChars] = useState(false);
  const VISIBLE_CHARS = 3;

  const mainCount    = charCards.filter(c => c.isMain).length;
  const visibleCards = charCards.slice(0, VISIBLE_CHARS);
  const hiddenCards  = charCards.slice(VISIBLE_CHARS);
  const displayTotal = totalDetected > 0 ? totalDetected : charCards.length;
  const reviewedCount = sections.filter(s => reviewedSections.has(s.id)).length;

  // Section dot: during stream → blue/gray by stream status; after → reviewed/unreviewed
  const SectionDot = ({ sec }: { sec: ParsedSection }) => {
    if (isStreaming) {
      if (sec.status === 'active') {
        return <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 motion-safe:animate-pulse" />;
      }
      if (sec.status === 'complete') {
        return (
          <span
            className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
        );
      }
      return <span className="w-2.5 h-2.5 rounded-full bg-on-surface/15 flex-shrink-0 motion-safe:animate-pulse" />;
    }
    // After stream
    if (reviewedSections.has(sec.id)) {
      return (
        <span
          className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
      );
    }
    return (
      <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-400 flex-shrink-0" />
    );
  };

  const SectionList = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          Sections
        </p>
        {!isStreaming && (
          <span className="text-[11px] text-on-surface-variant tabular-nums">
            {reviewedCount} / 6 reviewed{reviewedCount === 6 ? ' ✅' : ''}
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {sections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => onScrollTo(sec.id)}
            className="w-full flex items-center gap-2.5 text-left py-1.5 px-2 rounded-xl hover:bg-surface-container transition-colors"
          >
            <SectionDot sec={sec} />
            <span className={`text-xs truncate ${
              isStreaming && sec.status === 'active' ? 'text-blue-600 font-semibold' :
              sec.status === 'skeleton'              ? 'text-on-surface-variant/40' :
                                                       'text-on-surface-variant'
            }`}>
              {sec.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Progress bar during streaming ── */}
      {isStreaming && progressCount > 0 && (
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

      {/* ── Character cards ── */}
      <div>
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
          Characters
        </p>

        {/* Skeleton while section 1 is still loading */}
        {(section1Status === 'skeleton' || (isStreaming && section1Status !== 'complete')) && charCards.length === 0 ? (
          <div className="space-y-2">
            <CharCardSkeleton />
            <CharCardSkeleton />
            <CharCardSkeleton />
          </div>
        ) : charCards.length > 0 ? (
          <>
            {/* Summary line */}
            <p className="text-[11px] text-on-surface-variant mb-2 tabular-nums">
              {displayTotal} detected
              {mainCount > 0 && <> · <span className="text-emerald-600 font-semibold">{mainCount} main</span></>}
              {hiddenCards.length > 0 && !showAllChars && <> · {hiddenCards.length} supporting</>}
            </p>

            <div className="space-y-2">
              {visibleCards.map((card, i) => (
                <CharCardItem key={`${card.name}-${i}`} card={card} />
              ))}
            </div>

            {hiddenCards.length > 0 && (
              <>
                {showAllChars && (
                  <div className="space-y-2 mt-2">
                    {hiddenCards.map((card, i) => (
                      <CharCardItem key={`${card.name}-${VISIBLE_CHARS + i}`} card={card} />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowAllChars(v => !v)}
                  className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface mt-2 transition-colors"
                >
                  {showAllChars ? (
                    <>
                      <span className="material-symbols-outlined text-sm">expand_less</span>
                      Show less
                    </>
                  ) : (
                    <>
                      + {hiddenCards.length} supporting
                      <span className="material-symbols-outlined text-sm">expand_more</span>
                    </>
                  )}
                </button>
              </>
            )}
          </>
        ) : null}
      </div>

      {/* ── Quick stats ── */}
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

      {/* ── Approved badge ── */}
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

function StateBadge({ state }: { state: State }) {
  if (state === 1) return null;

  // Text label + progress bar are intentionally omitted here — the Progress
  // panel further down the page already shows section count and active title.
  if (state === 2) {
    return <ShapeLoader scale={0.4} />;
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
    setActiveStep,
  } = useComicGeneration();
  const { autoScroll, setAutoScroll } = useAutoScrollStreamingPref();

  const cooldown     = getCooldownSeconds(1);
  const isGenerating = step1.isLoading;
  const canGenerate  = !isGenerating && cooldown === 0;
  const [scrollConflict, dismissScrollConflict] = useScrollIntentDetector(isGenerating && autoScroll);

  let state: State = 1;
  if (isGenerating)                                               state = 2;
  else if (step1.isApproved && !step1.regeneratedAfterApproval)  state = 4;
  else if (step1.data && step1.regeneratedAfterApproval)         state = 5;
  else if (step1.data)                                           state = 3;

  // ── Accordion open state ──────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1]));
  const prevActiveRef = useRef<number | null>(null);
  const wasLoadingRef = useRef(false);
  const prevStateRef  = useRef<State>(1);

  // ── Review tracking ───────────────────────────────────────────────────────
  const [reviewedSections, setReviewedSections] = useState<Set<number>>(new Set());

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editedContent, setEditedContent]         = useState<Map<number, string>>(new Map());
  const [editingSection, setEditingSection]       = useState<number | null>(null);
  const [editBuffer, setEditBuffer]               = useState('');
  const [showEditedWarning, setShowEditedWarning] = useState(false);
  const editedCount = editedContent.size;

  // ── Dialog / warning state ────────────────────────────────────────────────
  const [showRegenConfirm, setShowRegenConfirm]   = useState(false);
  const [showReviewWarning, setShowReviewWarning] = useState(false);

  // Reset when a new generation starts
  useEffect(() => {
    if (isGenerating && !wasLoadingRef.current) {
      setOpenSections(new Set([1]));
      prevActiveRef.current = null;
    }
    wasLoadingRef.current = isGenerating;
  }, [isGenerating]);

  // When stream completes (state 2→3): reset review tracking (stream auto-opens
  // don't count), then collapse every section.
  useEffect(() => {
    if (state >= 3 && prevStateRef.current === 2) {
      setReviewedSections(new Set());
      setOpenSections(new Set());
    }
    prevStateRef.current = state;
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Section parsing ───────────────────────────────────────────────────────
  const streamText = isGenerating
    ? (step1.streamingText ?? '')
    : (step1.data?.analysisMarkdown ?? '');

  const parsedSections = useMemo<ParsedSection[]>(() => {
    if (state === 1) {
      return SECTION_DEFS.map(def => ({ id: def.id, title: def.title, content: '', status: 'skeleton' as const }));
    }
    const result = parseStreamSections(streamText);
    if (!isGenerating && step1.data && !result.some(s => s.content !== '')) {
      return result.map((s, i) => ({
        ...s,
        content: i === 0 ? step1.data!.analysisMarkdown : '',
        status: 'complete' as const,
      }));
    }
    return result;
  }, [streamText, state, isGenerating, step1.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sections the user hasn't opened yet (for review warning)
  const unreviewedSections = useMemo(
    () => parsedSections.filter(s => s.status === 'complete' && !reviewedSections.has(s.id)),
    [parsedSections, reviewedSections],
  );

  useEffect(() => {
    if (showReviewWarning && unreviewedSections.length === 0) {
      setShowReviewWarning(false);
    }
  }, [showReviewWarning, unreviewedSections.length]);

  // Auto-open the section the stream is currently writing into — replacing (not
  // adding to) the open set, so only one section is ever expanded at a time.
  // Do NOT mark as reviewed — only user-triggered expands count.
  useEffect(() => {
    const active = parsedSections.find(s => s.status === 'active');
    if (active && active.id !== prevActiveRef.current) {
      prevActiveRef.current = active.id;
      setOpenSections(new Set([active.id]));
    }
  }, [parsedSections]);

  // ── Section DOM refs ──────────────────────────────────────────────────────
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollTo = (id: SectionId) => {
    sectionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Follow the streaming section down the page as its text grows, when the user
  // has the "auto-scroll while generating" preference on (default: on). Centered
  // (rather than 'nearest') so the growing text lands away from the fixed top bar
  // and the sticky bottom action bar, instead of hiding right behind either one.
  useEffect(() => {
    if (!isGenerating || !autoScroll) return;
    const active = parsedSections.find(s => s.status === 'active');
    if (active) sectionRefs.current.get(active.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [parsedSections, isGenerating, autoScroll]); // eslint-disable-line react-hooks/exhaustive-deps

  // Accordion: opening a section closes whichever one was open before it.
  const toggleSection = (id: number) => {
    setOpenSections(prev => {
      if (prev.has(id)) {
        return new Set();
      }
      setReviewedSections(r => new Set([...r, id]));
      return new Set([id]);
    });
  };

  // ── Progress counters ─────────────────────────────────────────────────────
  const completedCount   = parsedSections.filter(s => s.status === 'complete').length;
  const activeSectionObj = parsedSections.find(s => s.status === 'active');
  const progressCount    = completedCount + (activeSectionObj ? 1 : 0);

  // ── Right panel data ──────────────────────────────────────────────────────
  const charCards = useMemo(() => {
    // Prefer structured JSON — contains full name/role/visual_hook from the AI
    if (step1.data?.structuredJson) {
      const fromJson = extractCharactersFromJson(step1.data.structuredJson);
      if (fromJson.length > 0) return fromJson;
    }
    // Fallback to the characterBreakdown string array
    return parseCharCardsFromStrings(step1.data?.characterBreakdown ?? []);
  }, [step1.data?.structuredJson, step1.data?.characterBreakdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Total character count from structured JSON (may be higher than charCards.length if JSON was truncated)
  const totalDetected = useMemo(() => {
    try {
      const steps = step1.data?.structuredJson?.steps as Record<string, unknown> | undefined;
      const s1    = steps?.step_1_analysis as Record<string, unknown> | undefined;
      const data  = s1?.data as Record<string, unknown> | undefined;
      const n     = (data?.analysis as Record<string, unknown> | undefined)?.total_characters_detected;
      if (typeof n === 'number' && n > 0) return n;
    } catch { /* ignore */ }
    return charCards.length;
  }, [step1.data?.structuredJson, charCards.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const stats        = extractStats(step1.data?.structuredJson ?? null);
  const section1Status = parsedSections[0]?.status ?? 'skeleton';

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const handleEditStart = useCallback((id: number) => {
    const current = editedContent.get(id) ?? parsedSections.find(s => s.id === id)?.content ?? '';
    setEditingSection(id);
    setEditBuffer(current);
  }, [editedContent, parsedSections]);

  const handleEditSave = useCallback(() => {
    if (editingSection === null) return;
    setEditedContent(prev => {
      const next = new Map(prev);
      next.set(editingSection, editBuffer);
      return next;
    });
    if (editedCount === 0) setShowEditedWarning(true);
    setEditingSection(null);
    setEditBuffer('');
  }, [editingSection, editBuffer, editedCount]);

  const handleEditCancel = useCallback(() => {
    setEditingSection(null);
    setEditBuffer('');
  }, []);

  // ── Regenerate handlers ───────────────────────────────────────────────────
  const handleRegenClick = useCallback(() => {
    setEditingSection(null);
    setEditBuffer('');
    setShowRegenConfirm(true);
  }, []);

  const handleConfirmRegen = useCallback(() => {
    setShowRegenConfirm(false);
    setEditedContent(new Map());
    setReviewedSections(new Set());
    setShowReviewWarning(false);
    setShowEditedWarning(false);
    handleGenerate(1);
  }, [handleGenerate]);

  // ── Approve & Continue handlers ───────────────────────────────────────────
  const handleApproveAndContinue = useCallback(() => {
    if (state === 4) {
      setActiveStep(2);
      return;
    }
    if (unreviewedSections.length > 0) {
      setShowReviewWarning(true);
      return;
    }
    handleApprove(1); // also calls setActiveStep(2) internally
  }, [state, unreviewedSections, handleApprove, setActiveStep]);

  const handleForceApprove = useCallback(() => {
    setShowReviewWarning(false);
    handleApprove(1);
  }, [handleApprove]);

  const scrollToFirstUnreviewed = useCallback(() => {
    const first = unreviewedSections[0];
    if (!first) return;
    scrollTo(first.id);
    setOpenSections(prev => new Set([...prev, first.id]));
    setReviewedSections(prev => new Set([...prev, first.id]));
    setShowReviewWarning(false);
  }, [unreviewedSections]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Display content helper (strips trailing AI artifacts) ────────────────
  const getDisplayContent = (sec: ParsedSection): string => {
    const raw = editedContent.get(sec.id) ?? sec.content;
    return cleanContent(raw);
  };

  // ─────────────────────────────────────────────────────────────────────────
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
        <StateBadge state={state} />
      </div>

      {/* ── Top action bar — Revoke Approval + error/retry only ── */}
      {(state === 4 || step1.error) && (
        <div className="flex flex-wrap items-center gap-3">
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
          {step1.error && <span className="text-sm text-red-500 line-clamp-2">{step1.error}</span>}
        </div>
      )}

      {/* ── One-time edit warning banner ── */}
      {showEditedWarning && (
        <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-base mt-0.5">warning</span>
            <p className="text-sm text-amber-800">
              Manual edits may affect AI generation in later steps. Regenerating will overwrite your edits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowEditedWarning(false)}
            className="text-amber-500 hover:text-amber-700 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* ── Empty state (state 1) ── */}
      {state === 1 && (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-outline-variant" style={{ fontVariationSettings: "'FILL' 1" }}>
            auto_stories
          </span>
          <div className="text-center">
            <p className="font-semibold text-on-surface">No analysis yet</p>
            <p className="text-sm text-on-surface-variant mt-1">
              Use the button below to generate story analysis.
            </p>
          </div>
        </div>
      )}

      {/* ── Main content grid (states 2–5) ── */}
      {state !== 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 lg:items-start">

          {/* Left — 6 accordion sections */}
          <div className="space-y-3 max-w-[750px]">
            {parsedSections.map(sec => (
              <SectionAccordion
                key={sec.id}
                ref={el => {
                  if (el) sectionRefs.current.set(sec.id, el);
                  else sectionRefs.current.delete(sec.id);
                }}
                section={sec}
                displayContent={getDisplayContent(sec)}
                isOpen={openSections.has(sec.id)}
                onToggle={() => toggleSection(sec.id)}
                isEdited={editedContent.has(sec.id)}
                isEditing={editingSection === sec.id}
                editBuffer={editingSection === sec.id ? editBuffer : ''}
                onEditStart={() => handleEditStart(sec.id)}
                onEditChange={setEditBuffer}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
                isStreaming={isGenerating}
                isReviewed={reviewedSections.has(sec.id)}
              />
            ))}
          </div>

          {/* Right — sticky navigation + character cards + section nav */}
          <div className="lg:sticky lg:top-28 overflow-y-auto max-h-[calc(100vh-10rem)] thin-scrollbar">
            <RightNavPanel
              sections={parsedSections}
              isStreaming={isGenerating}
              progressCount={progressCount}
              activeSectionTitle={activeSectionObj?.title}
              charCards={charCards}
              section1Status={section1Status}
              totalDetected={totalDetected}
              stats={stats}
              approvedAt={step1.approvedAt}
              onScrollTo={scrollTo}
              state={state}
              reviewedSections={reviewedSections}
            />
          </div>
        </div>
      )}

      {/* ── Sticky bottom action bar ── */}
      <div
        className="fixed bottom-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ left: 'var(--studio-sidebar-width)' }}
      >
        {/* Review warning — inline, above button row */}
        {showReviewWarning && unreviewedSections.length > 0 && (
          <div className="px-10 py-3 max-w-6xl mx-auto border-b border-gray-100">
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">warning</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  You&apos;ve reviewed {reviewedSections.size} / 6 sections
                </p>
                <p className="text-xs text-amber-700 mt-0.5 truncate">
                  Unreviewed: {unreviewedSections.map(s => s.title).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={scrollToFirstUnreviewed}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2 whitespace-nowrap"
                >
                  Review sections ↑
                </button>
                <button
                  type="button"
                  onClick={handleForceApprove}
                  className="text-xs font-semibold text-white bg-gray-900 rounded-lg px-3 py-1.5 hover:opacity-90 whitespace-nowrap"
                >
                  Approve anyway →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Button row */}
        <div className="px-10 py-4 max-w-6xl mx-auto">
          {isGenerating ? (
            // Streaming — centered status, no nav actions
            <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
              Generating analysis… please wait
            </div>
          ) : state === 1 ? (
            // Idle — Previous Step (left) + Generate Analysis (right)
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveStep(0)}
                className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Previous Step
              </button>
              <button
                type="button"
                onClick={() => handleGenerate(1)}
                disabled={!canGenerate}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition-all"
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
                {cooldown > 0 ? `Retry in ${cooldown}s` : 'Generate Analysis'}
              </button>
            </div>
          ) : (
            // Post-stream — Previous Step (left) | Regenerate + Approve grouped (right)
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveStep(0)}
                className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Previous Step
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRegenClick}
                  disabled={!canGenerate}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  {cooldown > 0 ? `Retry in ${cooldown}s` : 'Regenerate'}
                </button>

                <button
                  type="button"
                  onClick={handleApproveAndContinue}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all flex-shrink-0 bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  <span
                    className="material-symbols-outlined text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  {state === 4 ? 'Approved · Continue →' : 'Approve & Continue →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Regenerate confirmation modal ── */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-[360px] w-full p-6 flex flex-col gap-4 border-l-4 border-red-600"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-red-600" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-[17px]">Regenerate analysis?</p>
                <p className="text-sm text-gray-500 mt-1">
                  This will replace all current analysis
                  {editedCount > 0
                    ? ` and remove your ${editedCount} manual edit${editedCount > 1 ? 's' : ''}`
                    : ''
                  }. This <span className="font-semibold text-red-600">cannot be undone</span>.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                aria-label="Cancel regenerate"
                className="flex-1 h-12 rounded-xl text-sm font-semibold bg-transparent border-[1.5px] border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 focus-visible:outline-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegen}
                aria-label="Confirm regenerate analysis"
                className="flex-1 h-12 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 focus-visible:outline-offset-2"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scroll-conflict toast ── */}
      {scrollConflict && (
        <div className="fixed top-6 right-6 z-[60] pointer-events-none">
          <div className="pointer-events-auto flex items-start gap-3 bg-white border border-gray-200 rounded-2xl shadow-xl px-4 py-3 w-[300px] animate-panel-appear">
            <span className="text-amber-500 text-lg mt-0.5 flex-shrink-0">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Auto-scroll is following the text</p>
              <p className="text-xs text-gray-500 mt-0.5">Manual scrolling may fight it while analysis is generating.</p>
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={dismissScrollConflict}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Keep auto-scroll
                </button>
                <button
                  type="button"
                  onClick={() => { setAutoScroll(false); dismissScrollConflict(); }}
                  className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                >
                  Turn off auto-scroll
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissScrollConflict}
              aria-label="Dismiss"
              className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors mt-0.5"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}