'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { ImageGenSettings } from '@/context/ComicGenerationContext';
import CharacterModePanel, { DEFAULT_SETTINGS } from '@/components/studio-steps/CharacterModePanel';
import CharacterLibraryModal from '@/components/CharacterLibraryModal';
import Markdown from '@/components/Markdown';

// ── Design section definitions ────────────────────────────────────────────────

const DESIGN_SECTION_DEFS = [
  { id: 1 as const, coreMarker: '1. Global Design Guidelines',             title: '1. Global Design Guidelines' },
  { id: 2 as const, coreMarker: '2. Main Character Design Sheets',         title: '2. Main Character Design Sheets' },
  { id: 3 as const, coreMarker: '3. Supporting Character Design Sheets',   title: '3. Supporting Character Design Sheets' },
  { id: 4 as const, coreMarker: '4. Interaction & Relationship Notes',     title: '4. Interaction & Relationship Notes' },
  { id: 5 as const, coreMarker: '5. Final Design Summary',                 title: '5. Final Design Summary' },
];

const TOTAL_SECTIONS = DESIGN_SECTION_DEFS.length;

type DesignSectionId = 1 | 2 | 3 | 4 | 5;
type SectionStatus   = 'skeleton' | 'active' | 'complete';

interface ParsedSection {
  id:      DesignSectionId;
  title:   string;
  content: string;
  status:  SectionStatus;
}

// Locate a section header regardless of heading prefix (##, #, **, or bare).
function findMarker(text: string, coreMarker: string): { start: number; contentStart: number } {
  for (const prefix of ['## ', '### ', '# ', '#### ', '**', '']) {
    const full = prefix + coreMarker;
    let lineStart = -1;
    const nlIdx = text.indexOf('\n' + full);
    if (nlIdx !== -1) { lineStart = nlIdx + 1; }
    else if (text.startsWith(full)) { lineStart = 0; }
    if (lineStart !== -1) {
      const nlAfter = text.indexOf('\n', lineStart);
      return { start: lineStart, contentStart: nlAfter === -1 ? text.length : nlAfter };
    }
  }
  return { start: -1, contentStart: -1 };
}

function parseDesignSections(text: string): ParsedSection[] {
  return DESIGN_SECTION_DEFS.map((def, i) => {
    const { start, contentStart } = findMarker(text, def.coreMarker);
    if (start === -1) return { id: def.id, title: def.title, content: '', status: 'skeleton' as const };
    const nextDef = DESIGN_SECTION_DEFS[i + 1];
    const { start: nextStart } = nextDef ? findMarker(text, nextDef.coreMarker) : { start: -1 };
    if (nextStart !== -1) {
      return { id: def.id, title: def.title, content: text.slice(contentStart, nextStart).trim(), status: 'complete' as const };
    }
    return { id: def.id, title: def.title, content: text.slice(contentStart).trim(), status: 'active' as const };
  });
}

function cleanContent(raw: string): string {
  return raw.replace(/[\s\n]*[•·•·]{2,}[\s\n]*$/, '').trimEnd();
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
          Designing characters…
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
  if (state === 4) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        Approved
      </div>
    );
  }
  if (state === 5) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
        Regenerated — re-approval needed
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pending</span>
      Pending review
    </div>
  );
}

// ── Aspect ratio selector ─────────────────────────────────────────────────────

const ASPECT_RATIOS: { value: string; label: string; w: number; h: number }[] = [
  { value: '1:1',  label: 'Square 1:1',                               w: 18, h: 18 },
  { value: '2:3',  label: 'Portrait 2:3 — Recommended for characters', w: 12, h: 18 },
  { value: '3:4',  label: 'Portrait 3:4',                              w: 14, h: 18 },
  { value: '16:9', label: 'Landscape 16:9',                            w: 20, h: 11 },
];

function AspectRatioSelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-end gap-3">
      {ASPECT_RATIOS.map((r) => {
        const selected = value === r.value;
        return (
          <button
            key={r.value}
            type="button"
            title={r.label}
            onClick={() => onChange(r.value)}
            disabled={disabled}
            className={`flex flex-col items-center gap-1.5 transition-all ${
              disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <div
              style={{ width: r.w, height: r.h }}
              className={`rounded-sm border-[1.5px] transition-colors ${
                selected
                  ? 'border-gray-900 bg-gray-900/10'
                  : 'border-gray-300 bg-white hover:border-gray-500'
              }`}
            />
            <span
              className={`text-[9px] font-semibold leading-none transition-colors ${
                selected ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {r.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Structured section parser (kept for CharacterDesignSummary) ───────────────

interface ParsedDesign {
  role?: string;
  subtitle?: string;
  personality?: string;
  physical?: string;
  outfit?: string;
  visualHook?: string;
  expressions?: string[];
  stagePrompt?: string;
  palette?: string;
  hasStructure: boolean;
}

function parseStructuredSections(lines: string[]): ParsedDesign {
  const result: ParsedDesign = { hasStructure: false };
  let currentKey = '';
  const buckets: Record<string, string[]> = {};

  for (const line of lines) {
    const t = line.trim();
    const mdH   = t.match(/^#{2,4}\s+(.+)$/);
    const boldH = t.match(/^\*\*([^*]+?)\*?\*:?\s*$/);
    const header = mdH?.[1]?.trim() ?? boldH?.[1]?.trim();

    if (header) {
      currentKey = header.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      if (!buckets[currentKey]) buckets[currentKey] = [];
    } else if (currentKey) {
      if (t) buckets[currentKey].push(t);
    } else if (t && !result.subtitle && !t.startsWith('#')) {
      const cleaned = t.replace(/\*\*/g, '').replace(/^(role|type|archetype)[:\s]*/i, '').trim();
      if (cleaned.length > 2 && cleaned.length < 100) result.subtitle = cleaned;
    }
  }

  for (const [k, vals] of Object.entries(buckets)) {
    const content = vals.join('\n').trim().replace(/\*\*/g, '');
    if (!content) continue;
    if (/\bname\b.*\brole\b|\brole\b.*\bname\b|\barchetype\b/.test(k)) {
      result.role = content;
      if (!result.subtitle) {
        const first = content.split('\n')[0].replace(/^is\s+/i, '').trim();
        if (first.length < 120) result.subtitle = first;
      }
      result.hasStructure = true;
    } else if (/personalit/.test(k)) { result.personality = content; result.hasStructure = true; }
    else if (/physical|appearance|look/.test(k)) { result.physical = content; result.hasStructure = true; }
    else if (/outfit|accessor|wear/.test(k)) { result.outfit = content; result.hasStructure = true; }
    else if (/visual|hook|distinct/.test(k)) { result.visualHook = content; result.hasStructure = true; }
    else if (/expression/.test(k)) {
      result.expressions = content
        .split(/[,\[\]\n]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 1 && e.length < 40);
      if (result.expressions.length) result.hasStructure = true;
    } else if (/palette|colou?r/.test(k)) {
      result.palette = content; result.hasStructure = true;
    } else if (/stage|prompt|image/.test(k)) {
      result.stagePrompt = content;
    }
  }

  return result;
}

// ── Per-character section extractor (kept for CharacterDesignSummary) ─────────

function extractCharacterSection(markdown: string, characterName: string): string[] {
  const lines = markdown.split('\n');
  const nameLower = characterName.toLowerCase().trim();

  const cleanHeader = (t: string) =>
    t.toLowerCase().replace(/[*_`]/g, '').replace(/^\d+[\.\)]\s*/, '').replace(/[():\-]/g, ' ').replace(/\s+/g, ' ').trim();

  const scoreHeader = (raw: string): number => {
    const text    = raw.toLowerCase();
    const cleaned = cleanHeader(raw);
    if (text.includes(nameLower) || cleaned.includes(nameLower)) return 10;
    const sigWords = nameLower.split(/\s+/).filter((w) => w.length >= 4);
    if (sigWords.length > 0 && sigWords.every((w) => cleaned.includes(w))) return 7;
    const firstSig = nameLower.split(/\s+/).find((w) => w.length >= 5);
    if (firstSig && cleaned.includes(firstSig)) return 3;
    return 0;
  };

  type HeaderEntry = { lineIdx: number; depth: number; raw: string };
  const headers: HeaderEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+(.+)$/);
    if (m) headers.push({ lineIdx: i, depth: m[1].length, raw: m[2] });
  }

  let bestScore = 0;
  let bestEntry: HeaderEntry | null = null;
  for (const h of headers) {
    const s = scoreHeader(h.raw);
    if (s > bestScore) { bestScore = s; bestEntry = h; }
  }
  if (bestScore === 0 || !bestEntry) return [];

  const result: string[] = [];
  for (let i = bestEntry.lineIdx; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+/);
    if (m && i > bestEntry.lineIdx && m[1].length <= bestEntry.depth) break;
    result.push(lines[i]);
  }
  return result;
}

// ── Compact character design summary (Reference Images tab) ───────────────────

function CharacterDesignSummary({
  designMarkdown,
  characterName,
  fallbackPrompt,
}: {
  designMarkdown: string | null;
  characterName: string;
  fallbackPrompt?: string;
}) {
  const [showFull, setShowFull] = useState(false);

  if (!designMarkdown) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4">
        {fallbackPrompt ? (
          <p className="text-xs text-on-surface-variant leading-relaxed">{fallbackPrompt}</p>
        ) : (
          <p className="text-xs text-on-surface-variant/60 italic">No design sheet available.</p>
        )}
      </div>
    );
  }

  const lines  = extractCharacterSection(designMarkdown, characterName);
  const parsed = parseStructuredSections(lines);
  const traits = parsed.personality
    ? parsed.personality.split(/[,•\n]+/).slice(0, 3).map((t) => t.trim()).filter(Boolean).join(' · ')
    : undefined;
  const hasData = parsed.subtitle || parsed.visualHook || traits || parsed.palette || parsed.physical;

  if (!hasData && lines.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4">
        {fallbackPrompt ? (
          <p className="text-xs text-on-surface-variant leading-relaxed">{fallbackPrompt}</p>
        ) : (
          <p className="text-xs text-on-surface-variant/60 italic">No design data found.</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
      <div className="p-4 space-y-3">
        {parsed.subtitle && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Role</p>
            <p className="text-xs text-on-surface leading-snug">{parsed.subtitle}</p>
          </div>
        )}
        {(parsed.visualHook || parsed.physical) && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Visual Hook</p>
            <p className="text-xs text-on-surface leading-snug">{parsed.visualHook ?? parsed.physical}</p>
          </div>
        )}
        {traits && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Key Traits</p>
            <p className="text-xs text-on-surface leading-snug">{traits}</p>
          </div>
        )}
        {parsed.palette && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Palette</p>
            <p className="text-xs text-on-surface leading-snug">{parsed.palette}</p>
          </div>
        )}
        {!hasData && lines.length > 0 && (
          <Markdown className="text-xs [&>*:last-child]:mb-0">{lines.join('\n')}</Markdown>
        )}
      </div>
      {lines.length > 0 && hasData && (
        <div className="border-t border-outline-variant/10">
          <button
            type="button"
            onClick={() => setShowFull((v) => !v)}
            className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span
              className="material-symbols-outlined text-sm transition-transform"
              style={{ transform: showFull ? 'rotate(180deg)' : 'none' }}
            >
              expand_more
            </span>
            {showFull ? 'Hide full design sheet' : 'View full design sheet'}
          </button>
          {showFull && (
            <div className="px-4 pb-4 border-t border-outline-variant/10">
              <Markdown className="text-xs [&>*:last-child]:mb-0">{lines.join('\n')}</Markdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  section:     ParsedSection;
  isOpen:      boolean;
  onToggle:    () => void;
  isStreaming: boolean;
}

const SectionAccordion = React.forwardRef<HTMLDivElement, SectionAccordionProps>(
  ({ section, isOpen, onToggle, isStreaming }, ref) => {
    const { status, title, content } = section;
    const isSkeleton = status === 'skeleton';
    const isActive   = status === 'active';
    const displayContent = cleanContent(content);

    return (
      <div ref={ref} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
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
        </div>

        {isOpen && (
          <div className="px-5 pb-5 border-t border-outline-variant/10">
            {isSkeleton ? (
              <div className="pt-4"><SkeletonLines /></div>
            ) : displayContent ? (
              <div className="pt-4">
                <Markdown className="[&>*:last-child]:mb-0">{displayContent}</Markdown>
              </div>
            ) : isActive ? (
              <div className="pt-4"><SkeletonLines count={3} /></div>
            ) : null}
          </div>
        )}
      </div>
    );
  },
);
SectionAccordion.displayName = 'SectionAccordion';

// ── Design sheets right panel ─────────────────────────────────────────────────

function DesignSheetsRightPanel({
  sections,
  isStreaming,
  progressCount,
  activeSectionTitle,
  approvedAt,
  onScrollTo,
  state,
  reviewedSections,
  onSwitchToReferences,
}: {
  sections:             ParsedSection[];
  isStreaming:          boolean;
  progressCount:        number;
  activeSectionTitle?:  string;
  approvedAt:           string | null;
  onScrollTo:           (id: DesignSectionId) => void;
  state:                State;
  reviewedSections:     Set<number>;
  onSwitchToReferences: () => void;
}) {
  const reviewedCount = sections.filter((s) => reviewedSections.has(s.id)).length;

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
    return <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-400 flex-shrink-0" />;
  };

  return (
    <div className="space-y-5">
      {/* Progress bar during streaming */}
      {isStreaming && progressCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Progress</p>
            <span className="text-xs text-on-surface-variant">{progressCount} / {TOTAL_SECTIONS}</span>
          </div>
          <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.round((progressCount / TOTAL_SECTIONS) * 100)}%` }}
            />
          </div>
          {activeSectionTitle && (
            <p className="text-[11px] text-on-surface-variant mt-1.5 truncate">
              Designing: {activeSectionTitle}
            </p>
          )}
        </div>
      )}

      {/* Reference Images shortcut */}
      <button
        type="button"
        onClick={onSwitchToReferences}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
      >
        <span className="material-symbols-outlined text-sm">image</span>
        View in Reference Images
      </button>

      {/* Section list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Sections</p>
          {!isStreaming && (
            <span className="text-[11px] text-on-surface-variant tabular-nums">
              {reviewedCount} / {TOTAL_SECTIONS} reviewed{reviewedCount === TOTAL_SECTIONS ? ' ✅' : ''}
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

      {/* Approved badge */}
      {state === 4 && approvedAt && (
        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/15 p-4 text-center">
          <span
            className="material-symbols-outlined text-2xl text-emerald-500 mb-1 block"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            task_alt
          </span>
          <p className="text-xs text-emerald-600 font-semibold">Approved</p>
          <p className="text-[10px] text-emerald-500/70 mt-0.5">
            {new Date(approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Candidate type + CharacterReviewCard (Reference Images tab) ───────────────

type Candidate = { id: string; imageUrl: string; createdAt: string };

function CharacterReviewCard({
  character,
  settings,
  aspectRatio,
  versions,
  activeVersion,
  onVersionChange,
  isApproved,
  isAnyGenerating,
  onRegenerate,
  onSelectCandidate,
  onUpdateSettings,
  onAspectRatioChange,
  onApprove,
  onRevoke,
}: {
  character: {
    characterId: string;
    name: string;
    prompt: string;
    status: string;
    error: string | null;
    candidates: Candidate[];
    selectedCandidateId: string | null;
  };
  settings: ImageGenSettings;
  aspectRatio: string;
  versions: Candidate[][];
  activeVersion: number;
  onVersionChange: (v: number) => void;
  isApproved: boolean;
  isAnyGenerating: boolean;
  onRegenerate: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onUpdateSettings: (s: ImageGenSettings) => void;
  onAspectRatioChange: (r: string) => void;
  onApprove: () => void;
  onRevoke: () => void;
}) {
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const isLoading = character.status === 'loading';
  const isFailed  = character.status === 'error';

  const activeCandidates   = versions[activeVersion] ?? [];
  const selectedVersionIdx = versions.findIndex((v) => v.some((c) => c.id === character.selectedCandidateId));
  const selectedCandidate  = character.candidates.find((c) => c.id === character.selectedCandidateId) ?? null;
  const showSelectedBanner = selectedCandidate && selectedVersionIdx >= 0 && selectedVersionIdx !== activeVersion;

  const handleRegenerate = () => {
    if (isApproved) { setShowRegenConfirm(true); } else { onRegenerate(); }
  };

  return (
    <div
      className={`rounded-3xl border overflow-hidden transition-colors ${
        isApproved
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-outline-variant/10 bg-surface-container-lowest'
      }`}
    >
      <div className="bg-surface-container">
        {versions.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
            {versions.map((vCandidates, vIdx) => {
              const hasSelection = vCandidates.some((c) => c.id === character.selectedCandidateId);
              return (
                <button
                  key={vIdx}
                  type="button"
                  onClick={() => onVersionChange(vIdx)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                    activeVersion === vIdx
                      ? 'bg-gray-900 text-white'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  V{vIdx + 1}
                  {hasSelection && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="min-h-[200px]">
          {activeCandidates.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 p-4">
              {activeCandidates.map((candidate) => {
                const sel = candidate.id === character.selectedCandidateId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => onSelectCandidate(candidate.id)}
                    className={`rounded-2xl overflow-hidden text-left transition-all ${
                      sel
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="relative aspect-[3/4] bg-surface-container">
                      <Image
                        src={candidate.imageUrl}
                        alt={`${character.name} V${activeVersion + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {sel && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md z-10">
                          <span
                            className="material-symbols-outlined text-white"
                            style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}
                          >
                            check
                          </span>
                        </div>
                      )}
                    </div>
                    <div
                      className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 ${
                        sel ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {sel && (
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                          check_circle
                        </span>
                      )}
                      {sel ? 'Selected' : 'Select'}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Generating images…
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-on-surface-variant">No images yet — click Generate.</span>
            </div>
          )}
        </div>

        {showSelectedBanner && selectedCandidate && (
          <div className="mx-4 mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
            <div className="relative w-10 h-12 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-primary">
              <Image src={selectedCandidate.imageUrl} alt="selected" fill className="object-cover" unoptimized />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">Selected image</p>
              <p className="text-xs font-semibold text-on-surface">
                V{selectedVersionIdx + 1} · img {(versions[selectedVersionIdx]?.findIndex((c) => c.id === character.selectedCandidateId) ?? 0) + 1}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onVersionChange(selectedVersionIdx)}
              className="text-xs font-semibold text-primary hover:underline flex-shrink-0"
            >
              View →
            </button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4 border-t border-outline-variant/10">
        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
            Aspect Ratio
          </p>
          <AspectRatioSelector value={aspectRatio} onChange={onAspectRatioChange} disabled={isAnyGenerating} />
        </div>

        <CharacterModePanel disabled={isAnyGenerating} value={settings} onChange={onUpdateSettings} />

        {character.error && (
          <p className="text-xs text-red-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">error</span>
            {character.error}
          </p>
        )}

        <div className="pt-2 border-t border-gray-100">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant py-1">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Generating…
            </div>
          ) : isFailed ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-red-500">
                <span className="material-symbols-outlined text-sm">error</span>
                Failed
              </span>
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">replay</span>Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isAnyGenerating}
                className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 rounded-2xl text-xs font-bold border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Regenerate
              </button>
              {isApproved ? (
                <button
                  type="button"
                  onClick={onRevoke}
                  className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 rounded-2xl text-xs font-bold border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">undo</span>
                  Unapprove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={isAnyGenerating || !character.selectedCandidateId}
                  className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 rounded-2xl text-xs font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Approve
                </button>
              )}
            </div>
          )}
        </div>

        {showRegenConfirm && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs font-semibold text-amber-900 mb-2.5">
              Regenerating will remove approval. Continue?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowRegenConfirm(false); onRegenerate(); }}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity"
              >
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable split panel ─────────────────────────────────────────────────────

function useSplitPanel(defaultPct = 40, min = 30, max = 50) {
  const [leftPct, setLeftPct] = useState(defaultPct);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging     = useRef(false);

  const onDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pct  = ((ev.clientX - rect.left) / rect.width) * 100;
        setLeftPct(Math.min(max, Math.max(min, pct)));
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [min, max],
  );

  return { leftPct, containerRef, onDividerMouseDown };
}

function computeVersions(candidates: Candidate[], boundaries: number[]): Candidate[][] {
  const bounds = boundaries.length > 0 ? boundaries : [0];
  const versions: Candidate[][] = [];
  for (let i = 0; i < bounds.length; i++) {
    const start = bounds[i];
    const end   = i + 1 < bounds.length ? bounds[i + 1] : candidates.length;
    versions.push(candidates.slice(start, end));
  }
  return versions.filter((v) => v.length > 0);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Step2Characters() {
  const {
    step2,
    step2ImageReview,
    handleGenerate,
    handleApprove,
    handleRevokeApproval,
    handleRetry,
    handleGenerateCharacterReferences,
    handleRegenerateCharacterImage,
    handleSelectCharacterCandidate,
    handleApproveCharacterReferences,
    handleRetryCharacterReferences,
    getCooldownSeconds,
    injectLibraryCharacters,
    setActiveStep,
  } = useComicGeneration();

  // ── Reference Images tab state ────────────────────────────────────────────
  const [charSettings, setCharSettings]         = useState<Record<string, ImageGenSettings>>({});
  const [aspectRatioMap, setAspectRatioMap]     = useState<Record<string, string>>({});
  const [approvedCharIds, setApprovedCharIds]   = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab]               = useState<'designs' | 'references'>('designs');
  const [isLibraryOpen, setIsLibraryOpen]       = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showRegenAllConfirm, setShowRegenAllConfirm] = useState(false);
  const [versionBoundaries, setVersionBoundaries]    = useState<Record<string, number[]>>({});
  const [activeVersionTabs, setActiveVersionTabs]    = useState<Record<string, number>>({});
  const { leftPct, containerRef, onDividerMouseDown } = useSplitPanel();

  // ── Design Sheets accordion state ─────────────────────────────────────────
  const [openSections, setOpenSections]           = useState<Set<number>>(new Set([1]));
  const [reviewedSections, setReviewedSections]   = useState<Set<number>>(new Set());
  const [showReviewWarning, setShowReviewWarning] = useState(false);
  const prevActiveRef = useRef<number | null>(null);
  const wasLoadingRef = useRef(false);
  const prevStateRef  = useRef<State>(1);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getCharSettings    = (id: string): ImageGenSettings => charSettings[id] ?? DEFAULT_SETTINGS;
  const updateCharSettings = (id: string, s: ImageGenSettings) =>
    setCharSettings((prev) => ({ ...prev, [id]: s }));
  const getAspectRatio     = (id: string): string => aspectRatioMap[id] ?? '2:3';
  const updateAspectRatio  = (id: string, r: string) =>
    setAspectRatioMap((prev) => ({ ...prev, [id]: r }));

  const approveChar = (id: string) =>
    setApprovedCharIds((prev) => new Set([...prev, id]));
  const revokeChar  = (id: string) =>
    setApprovedCharIds((prev) => { const n = new Set(prev); n.delete(id); return n; });

  const cooldown    = getCooldownSeconds(2);
  const isGenerating  = step2.isLoading;
  const canGenerate   = !isGenerating && cooldown === 0;

  const characters        = (step2ImageReview.data?.characters ?? []).filter(
    (c) => !/^\d+[\.\)]\s/.test(c.name.trim()),
  );
  const isImageGenerating = !!step2ImageReview.data?.isGenerating;
  const existingCharacterIds = new Set(characters.map((c) => c.characterId));

  let state: State = 1;
  if (isGenerating)                                              state = 2;
  else if (step2.isApproved && !step2.regeneratedAfterApproval) state = 4;
  else if (step2.data && step2.regeneratedAfterApproval)        state = 5;
  else if (step2.data)                                          state = 3;

  const approvedCount    = approvedCharIds.size;
  const allCharsApproved = characters.length === 0 || approvedCount === characters.length;
  const pendingCount     = characters.filter((c) => !approvedCharIds.has(c.characterId)).length;

  // ── Section parsing ───────────────────────────────────────────────────────
  const streamText = isGenerating
    ? (step2.streamingText ?? '')
    : (step2.data?.designMarkdown ?? '');

  const parsedSections = useMemo<ParsedSection[]>(() => {
    if (state === 1) {
      return DESIGN_SECTION_DEFS.map((def) => ({
        id: def.id, title: def.title, content: '', status: 'skeleton' as const,
      }));
    }
    const result = parseDesignSections(streamText);
    // Fallback: if no section markers found in the final markdown, show everything in section 1
    if (!isGenerating && step2.data && !result.some((s) => s.content !== '')) {
      return result.map((s, i) => ({
        ...s,
        content: i === 0 ? step2.data!.designMarkdown : '',
        status: 'complete' as const,
      }));
    }
    return result;
  }, [streamText, state, isGenerating]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreviewedSections = useMemo(
    () => parsedSections.filter((s) => s.status === 'complete' && !reviewedSections.has(s.id)),
    [parsedSections, reviewedSections],
  );

  // Dismiss review warning once everything is reviewed
  useEffect(() => {
    if (showReviewWarning && unreviewedSections.length === 0) setShowReviewWarning(false);
  }, [showReviewWarning, unreviewedSections.length]);

  // Reset accordion open state when generation starts
  useEffect(() => {
    if (isGenerating && !wasLoadingRef.current) {
      setOpenSections(new Set([1]));
      prevActiveRef.current = null;
    }
    wasLoadingRef.current = isGenerating;
  }, [isGenerating]);

  // When stream completes (2→3): reset review tracking, collapse to section 1
  useEffect(() => {
    if (state >= 3 && prevStateRef.current === 2) {
      setReviewedSections(new Set());
      setOpenSections(new Set([1]));
    }
    prevStateRef.current = state;
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open the section currently being streamed (does NOT count as reviewed)
  useEffect(() => {
    const active = parsedSections.find((s) => s.status === 'active');
    if (active && active.id !== prevActiveRef.current) {
      prevActiveRef.current = active.id;
      setOpenSections((prev) => new Set([...prev, active.id]));
    }
  }, [parsedSections]);

  // ── Section refs for scroll-to ────────────────────────────────────────────
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollTo = (id: DesignSectionId) => {
    sectionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const toggleSection = (id: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Only user-triggered expands count as reviewed
        setReviewedSections((r) => new Set([...r, id]));
      }
      return next;
    });
  };

  // ── Progress counters ─────────────────────────────────────────────────────
  const completedCount   = parsedSections.filter((s) => s.status === 'complete').length;
  const activeSectionObj = parsedSections.find((s) => s.status === 'active');
  const progressCount    = completedCount + (activeSectionObj ? 1 : 0);

  // ── Version boundaries init ───────────────────────────────────────────────
  useEffect(() => {
    setVersionBoundaries((prev) => {
      const updated = { ...prev };
      let changed = false;
      for (const char of characters) {
        if (updated[char.characterId] === undefined) { updated[char.characterId] = [0]; changed = true; }
      }
      return changed ? updated : prev;
    });
    setActiveVersionTabs((prev) => {
      const updated = { ...prev };
      let changed = false;
      for (const char of characters) {
        if (updated[char.characterId] === undefined) { updated[char.characterId] = 0; changed = true; }
      }
      return changed ? updated : prev;
    });
  }, [characters]);

  // Pre-populate approvedCharIds on reload
  useEffect(() => {
    if (step2ImageReview.isApproved && characters.length > 0) {
      setApprovedCharIds(
        new Set(characters.filter((c) => c.selectedCandidateId).map((c) => c.characterId)),
      );
    }
  }, [step2ImageReview.isApproved, characters]);

  const handleCharacterVersionedRegenerate = useCallback(
    (charId: string, settings: ImageGenSettings) => {
      const char = characters.find((c) => c.characterId === charId);
      if (!char) return;
      const currentCount = char.candidates.length;
      revokeChar(charId);
      setVersionBoundaries((prev) => {
        const existing = prev[charId] ?? [0];
        const newBoundaries = [...existing, currentCount];
        const newVersionIdx = newBoundaries.length - 1;
        setActiveVersionTabs((prevTabs) => ({ ...prevTabs, [charId]: newVersionIdx }));
        return { ...prev, [charId]: newBoundaries };
      });
      handleRegenerateCharacterImage(charId, settings);
    },
    [characters, revokeChar, handleRegenerateCharacterImage],
  );

  const handleConfirmRegen = useCallback(() => {
    setShowRegenConfirm(false);
    setApprovedCharIds(new Set());
    handleGenerate(2);
  }, [handleGenerate]);

  const handleApproveAndContinue = useCallback(() => {
    if (state === 4 || step2ImageReview.isApproved) { setActiveStep(3); return; }
    if (!step2.isApproved) handleApprove(2);
    handleApproveCharacterReferences();
  }, [state, step2.isApproved, step2ImageReview.isApproved, handleApprove, handleApproveCharacterReferences, setActiveStep]);

  const handleDesignApproveClick = useCallback(() => {
    if (state === 4) { setActiveStep(3); return; }
    if (unreviewedSections.length > 0) { setShowReviewWarning(true); return; }
    handleApprove(2);
  }, [state, unreviewedSections, handleApprove, setActiveStep]);

  const handleForceApprove = useCallback(() => {
    setShowReviewWarning(false);
    handleApprove(2);
  }, [handleApprove]);

  const scrollToFirstUnreviewed = useCallback(() => {
    const first = unreviewedSections[0];
    if (!first) return;
    scrollTo(first.id as DesignSectionId);
    setOpenSections((prev) => new Set([...prev, first.id]));
    setReviewedSections((prev) => new Set([...prev, first.id]));
    setShowReviewWarning(false);
  }, [unreviewedSections]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <section className="text-on-surface space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Character Designs</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            AI-generated design sheets and reference images for each character
          </p>
        </div>
        <StateBadge
          state={state}
          streamProgress={isGenerating ? { current: progressCount, total: TOTAL_SECTIONS } : null}
        />
      </div>

      {/* Revoke / error */}
      {(state === 4 || step2.error) && (
        <div className="flex flex-wrap items-center gap-3">
          {state === 4 && (
            <button
              type="button"
              onClick={() => handleRevokeApproval(2)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-base">undo</span>
              Revoke approval
            </button>
          )}
          {step2.error && (
            <button
              type="button"
              onClick={() => handleRetry(2)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
            >
              <span className="material-symbols-outlined text-base">replay</span>
              Retry
            </button>
          )}
          {step2.error && <span className="text-sm text-red-500">{step2.error}</span>}
        </div>
      )}

      {/* ── Tab navigation (only after generation starts) ── */}
      {state >= 2 && (
        <div className="flex gap-1 border-b border-outline-variant/10">
          <button
            type="button"
            onClick={() => setActiveTab('designs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'designs'
                ? 'border-gray-900 text-on-surface'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">description</span>
            Design Sheets
            {state >= 3 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('references')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'references'
                ? 'border-gray-900 text-on-surface'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">image</span>
            Reference Images
            {pendingCount > 0 ? (
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 flex-shrink-0 leading-none">
                ⚠️ {pendingCount}
              </span>
            ) : characters.length > 0 ? (
              <span
                className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            ) : null}
          </button>
        </div>
      )}

      {/* ══ TAB 1: Design Sheets ══════════════════════════════════════════════ */}
      {(activeTab === 'designs' || state < 2) && (
        <>
          {/* Empty state */}
          {state === 1 && (
            <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4">
              <span
                className="material-symbols-outlined text-5xl text-outline-variant"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                style
              </span>
              <div className="text-center">
                <p className="font-semibold text-on-surface">No design sheet yet</p>
                <p className="text-sm text-on-surface-variant mt-1">
                  Complete Step 1 analysis first, then generate designs.
                </p>
              </div>
            </div>
          )}

          {/* Main content grid — states 2–5 */}
          {state !== 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 lg:items-start">

              {/* Left — 5 accordion sections */}
              <div className="space-y-3 max-w-[750px]">
                {parsedSections.map((sec) => (
                  <SectionAccordion
                    key={sec.id}
                    ref={(el) => {
                      if (el) sectionRefs.current.set(sec.id, el);
                      else sectionRefs.current.delete(sec.id);
                    }}
                    section={sec}
                    isOpen={openSections.has(sec.id)}
                    onToggle={() => toggleSection(sec.id)}
                    isStreaming={isGenerating}
                  />
                ))}
              </div>

              {/* Right — sticky navigation panel */}
              <div className="lg:sticky lg:top-28 overflow-y-auto max-h-[calc(100vh-10rem)] thin-scrollbar">
                <DesignSheetsRightPanel
                  sections={parsedSections}
                  isStreaming={isGenerating}
                  progressCount={progressCount}
                  activeSectionTitle={activeSectionObj?.title}
                  approvedAt={step2.approvedAt}
                  onScrollTo={scrollTo}
                  state={state}
                  reviewedSections={reviewedSections}
                  onSwitchToReferences={() => setActiveTab('references')}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ TAB 2: Reference Images ═══════════════════════════════════════════ */}
      {activeTab === 'references' && state >= 2 && (
        <div className="space-y-6">

          {/* Image action bar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (step2ImageReview.data) { setShowRegenAllConfirm(true); }
                else { handleGenerateCharacterReferences(charSettings); }
              }}
              disabled={step2ImageReview.locked || isImageGenerating || !step2.data}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                step2ImageReview.locked || isImageGenerating || !step2.data
                  ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
                  : step2ImageReview.data
                    ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                    : 'bg-primary text-on-primary hover:opacity-90'
              }`}
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isImageGenerating ? 'hourglass_empty' : step2ImageReview.data ? 'refresh' : 'image'}
              </span>
              {isImageGenerating
                ? 'Generating…'
                : step2ImageReview.data
                  ? 'Regenerate all'
                  : 'Generate references'}
            </button>

            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              disabled={isImageGenerating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-base">library_books</span>
              From Library
            </button>

            <button
              type="button"
              onClick={handleRetryCharacterReferences}
              disabled={step2ImageReview.locked}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Reset
            </button>

            {step2ImageReview.error && (
              <span className="text-sm text-red-500">{step2ImageReview.error}</span>
            )}
          </div>

          {/* Library notice */}
          {!step2ImageReview.locked && !step2.data && characters.length > 0 && (
            <p className="text-sm text-blue-600 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">info</span>
              Showing characters from your library. Generate designs to add AI-extracted characters.
            </p>
          )}

          {/* Locked */}
          {step2ImageReview.locked && (
            <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-12 text-center opacity-60">
              <span className="material-symbols-outlined text-4xl text-outline-variant mb-3 block">lock</span>
              <p className="font-semibold text-on-surface text-sm">
                Approve the design sheet first to unlock reference images
              </p>
            </div>
          )}

          {/* Regenerate all confirmation */}
          {showRegenAllConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
                <h3 className="font-bold text-on-surface text-lg">Regenerate all images?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  This will regenerate reference images for all characters and clear all approvals.
                  Previous versions will not be recoverable.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRegenAllConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-bold border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegenAllConfirm(false);
                      setApprovedCharIds(new Set());
                      setVersionBoundaries({});
                      setActiveVersionTabs({});
                      handleGenerateCharacterReferences(charSettings);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity"
                  >
                    Regenerate all
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Per-character split layout */}
          {!step2ImageReview.locked && characters.length > 0 && (
            <div ref={containerRef} className="space-y-0">
              {characters.map((character, idx) => {
                const charId    = character.characterId;
                const versions  = computeVersions(character.candidates, versionBoundaries[charId] ?? [0]);
                const activeVer = activeVersionTabs[charId] ?? Math.max(0, versions.length - 1);

                return (
                  <div key={charId}>
                    {idx > 0 && <div className="h-px bg-gray-200 my-6" />}

                    <div className="sticky top-0 z-10 -mx-1 px-1 bg-white/95 backdrop-blur-sm flex items-center gap-2.5 py-3 mb-4">
                      <span className="text-[11px] font-bold text-on-surface-variant/40 flex-shrink-0">#{idx + 1}</span>
                      <h3 className="font-bold text-on-surface flex-shrink-0 mr-0.5">{character.name}</h3>
                      {approvedCharIds.has(charId) ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          Approved
                        </span>
                      ) : character.status === 'error' ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                          <span className="material-symbols-outlined text-xs">warning</span>
                          Has issues
                        </span>
                      ) : null}
                    </div>

                    {/* Mobile: stack vertically */}
                    <div className="md:hidden space-y-4">
                      <CharacterDesignSummary
                        characterName={character.name}
                        designMarkdown={step2.data?.designMarkdown ?? null}
                        fallbackPrompt={character.prompt}
                      />
                      <CharacterReviewCard
                        character={character}
                        settings={getCharSettings(charId)}
                        aspectRatio={getAspectRatio(charId)}
                        versions={versions}
                        activeVersion={activeVer}
                        onVersionChange={(v) => setActiveVersionTabs((prev) => ({ ...prev, [charId]: v }))}
                        isApproved={approvedCharIds.has(charId)}
                        isAnyGenerating={isImageGenerating}
                        onRegenerate={() => handleCharacterVersionedRegenerate(charId, getCharSettings(charId))}
                        onSelectCandidate={(id) => handleSelectCharacterCandidate(charId, id)}
                        onUpdateSettings={(s) => updateCharSettings(charId, s)}
                        onAspectRatioChange={(r) => updateAspectRatio(charId, r)}
                        onApprove={() => approveChar(charId)}
                        onRevoke={() => revokeChar(charId)}
                      />
                    </div>

                    {/* Desktop: draggable split */}
                    <div className="hidden md:flex items-start">
                      <div className="sticky top-28 flex-shrink-0" style={{ width: `${leftPct}%` }}>
                        <CharacterDesignSummary
                          characterName={character.name}
                          designMarkdown={step2.data?.designMarkdown ?? null}
                          fallbackPrompt={character.prompt}
                        />
                      </div>
                      <div
                        onMouseDown={onDividerMouseDown}
                        title="Drag to resize panels"
                        className="w-1 self-stretch mx-3 rounded-full bg-outline-variant/20 hover:bg-primary/40 cursor-col-resize flex-shrink-0 transition-colors"
                      />
                      <div className="flex-1 min-w-0">
                        <CharacterReviewCard
                          character={character}
                          settings={getCharSettings(charId)}
                          aspectRatio={getAspectRatio(charId)}
                          versions={versions}
                          activeVersion={activeVer}
                          onVersionChange={(v) => setActiveVersionTabs((prev) => ({ ...prev, [charId]: v }))}
                          isApproved={approvedCharIds.has(charId)}
                          isAnyGenerating={isImageGenerating}
                          onRegenerate={() => handleCharacterVersionedRegenerate(charId, getCharSettings(charId))}
                          onSelectCandidate={(id) => handleSelectCharacterCandidate(charId, id)}
                          onUpdateSettings={(s) => updateCharSettings(charId, s)}
                          onAspectRatioChange={(r) => updateAspectRatio(charId, r)}
                          onApprove={() => approveChar(charId)}
                          onRevoke={() => revokeChar(charId)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty references */}
          {!step2ImageReview.locked && characters.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-outline-variant/20 py-12 text-center">
              <span
                className="material-symbols-outlined text-4xl text-outline-variant mb-3 block"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                image_search
              </span>
              <p className="font-semibold text-on-surface text-sm">No reference images yet</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Click &ldquo;Generate references&rdquo; or import from library.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Sticky bottom action bar ── */}
      <div
        className="fixed bottom-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ left: 'var(--studio-sidebar-width)' }}
      >
        {/* Review warning — Design Sheets tab only */}
        {showReviewWarning && unreviewedSections.length > 0 && activeTab === 'designs' && (
          <div className="px-10 py-3 max-w-6xl mx-auto border-b border-gray-100">
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">warning</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  You&apos;ve reviewed {reviewedSections.size} / {TOTAL_SECTIONS} sections
                </p>
                <p className="text-xs text-amber-700 mt-0.5 truncate">
                  Unreviewed: {unreviewedSections.map((s) => s.title).join(', ')}
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
            <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
              Generating designs… please wait
            </div>
          ) : state === 1 ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Previous Step
              </button>
              <button
                type="button"
                onClick={() => handleGenerate(2)}
                disabled={!canGenerate}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-gray-900 text-white hover:opacity-90 disabled:opacity-40 transition-all"
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>style</span>
                {cooldown > 0 ? `Retry in ${cooldown}s` : 'Generate Designs'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Previous Step
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowRegenConfirm(true)}
                  disabled={!canGenerate}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  {cooldown > 0 ? `Retry in ${cooldown}s` : 'Regenerate'}
                </button>

                <button
                  type="button"
                  onClick={activeTab === 'designs' ? handleDesignApproveClick : handleApproveAndContinue}
                  disabled={activeTab === 'references' && state !== 4 && !step2ImageReview.isApproved && !allCharsApproved}
                  title={
                    activeTab === 'references' && state !== 4 && !step2ImageReview.isApproved && !allCharsApproved
                      ? `Approve all ${characters.length} characters to continue`
                      : undefined
                  }
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all flex-shrink-0 ${
                    state === 4 || step2ImageReview.isApproved
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : activeTab === 'designs' || allCharsApproved
                        ? 'bg-gray-900 text-white hover:opacity-90'
                        : 'bg-gray-900/30 text-white/70 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  {state === 4 || step2ImageReview.isApproved
                    ? 'Approved · Continue →'
                    : activeTab === 'designs'
                      ? 'Approve & Continue →'
                      : allCharsApproved && characters.length > 0
                        ? 'Approve & Continue →'
                        : characters.length === 0
                          ? 'Approve & Continue →'
                          : `${approvedCount} / ${characters.length} approved`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Regenerate confirm modal ── */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span
                  className="material-symbols-outlined text-amber-600"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  refresh
                </span>
              </div>
              <div>
                <p className="font-bold text-gray-900">Regenerate designs?</p>
                <p className="text-sm text-gray-500 mt-1">
                  This will replace all current designs and remove any per-character approvals. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegen}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      <CharacterLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        existingIds={existingCharacterIds}
        onConfirm={injectLibraryCharacters}
      />
    </section>
  );
}
