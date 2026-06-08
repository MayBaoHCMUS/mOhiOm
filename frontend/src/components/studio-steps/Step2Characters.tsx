'use client';

import React, { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { ImageGenSettings } from '@/context/ComicGenerationContext';
import CharacterModePanel, { DEFAULT_SETTINGS } from '@/components/studio-steps/CharacterModePanel';
import CharacterLibraryModal from '@/components/CharacterLibraryModal';
import Markdown from '@/components/Markdown';

type State = 1 | 2 | 3 | 4 | 5;

// ── Parse design markdown into per-character sections ─────────────────────────
function parseCharacterSections(md: string): { name: string; lines: string[] }[] {
  const sections: { name: string; lines: string[] }[] = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const line of md.split('\n')) {
    if (/^#{2,3}\s/.test(line) && line.toLowerCase().includes('character')) {
      if (current) sections.push(current);
      current = { name: line.replace(/^#+\s*/, '').trim(), lines: [] };
    } else if (/^###\s/.test(line) && current) {
      if (current.lines.length) sections.push(current);
      current = { name: line.replace(/^#+\s*/, '').trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current && current.lines.length) sections.push(current);
  return sections;
}

// ── State badge ───────────────────────────────────────────────────────────────
function StateBadge({ state }: { state: State }) {
  if (state === 1) return null;
  if (state === 2) {
    return (
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        Generating…
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
  { value: '1:1',  label: 'Square 1:1',                              w: 18, h: 18 },
  { value: '2:3',  label: 'Portrait 2:3 — Recommended for characters', w: 12, h: 18 },
  { value: '3:4',  label: 'Portrait 3:4',                             w: 14, h: 18 },
  { value: '16:9', label: 'Landscape 16:9',                           w: 20, h: 11 },
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

// ── Structured section parser ─────────────────────────────────────────────────
interface ParsedDesign {
  subtitle?: string;
  personality?: string;
  physical?: string;
  visualHook?: string;
  expressions?: string[];
  stagePrompt?: string;
  hasStructure: boolean;
}

function parseStructuredSections(lines: string[]): ParsedDesign {
  const result: ParsedDesign = { hasStructure: false };
  let currentKey = '';
  const buckets: Record<string, string[]> = {};

  for (const line of lines) {
    const t = line.trim();
    const mdH    = t.match(/^#{2,4}\s+(.+)$/);
    const boldH  = t.match(/^\*\*([^*]+?)\*?\*:?\s*$/);
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
    if (/personalit/.test(k))               { result.personality = content; result.hasStructure = true; }
    else if (/physical|appearance|look/.test(k)) { result.physical = content; result.hasStructure = true; }
    else if (/visual|hook|distinct/.test(k)) { result.visualHook = content; result.hasStructure = true; }
    else if (/expression/.test(k)) {
      result.expressions = content
        .split(/[,\[\]\n]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 1 && e.length < 40);
      if (result.expressions.length) result.hasStructure = true;
    } else if (/stage|prompt|image/.test(k)) {
      result.stagePrompt = content;
    }
  }

  return result;
}

// ── Design sheet card (structured + markdown fallback) ────────────────────────
function DesignSheetCard({
  index,
  name,
  lines,
}: {
  index: number;
  name: string;
  lines: string[];
}) {
  const [open, setOpen]         = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const parsed = parseStructuredSections(lines);

  const header = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full flex items-center justify-between px-5 py-4 text-left"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[11px] font-bold text-on-surface-variant/40 flex-shrink-0">#{index + 1}</span>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-on-surface truncate">{name}</p>
          {parsed.subtitle && (
            <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">{parsed.subtitle}</p>
          )}
        </div>
      </div>
      <span
        className="material-symbols-outlined text-lg text-on-surface-variant transition-transform flex-shrink-0"
        style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
      >
        expand_more
      </span>
    </button>
  );

  if (!parsed.hasStructure) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
        {header}
        {open && (
          <div className="px-5 pb-5">
            <Markdown className="[&>*:last-child]:mb-0">{lines.join('\n')}</Markdown>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
      {header}

      {open && (
        <div className="border-t border-outline-variant/10">
          {/* 2-column: personality + physical left, visual hook right */}
          {(parsed.personality || parsed.physical || parsed.visualHook) && (
            <div
              className={`grid divide-x divide-outline-variant/10 ${
                parsed.visualHook ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              <div className="p-4 space-y-4">
                {parsed.personality && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                      Personality
                    </p>
                    <p className="text-xs text-on-surface leading-relaxed whitespace-pre-line">
                      {parsed.personality}
                    </p>
                  </div>
                )}
                {parsed.physical && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                      Physical Appearance
                    </p>
                    <p className="text-xs text-on-surface leading-relaxed whitespace-pre-line">
                      {parsed.physical}
                    </p>
                  </div>
                )}
              </div>
              {parsed.visualHook && (
                <div className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Visual Hook
                  </p>
                  <p className="text-xs text-on-surface leading-relaxed whitespace-pre-line">
                    {parsed.visualHook}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Expressions */}
          {parsed.expressions && parsed.expressions.length > 0 && (
            <div className="px-4 py-3 border-t border-outline-variant/10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex-shrink-0">
                  Expressions:
                </span>
                {parsed.expressions.map((exp, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/10"
                  >
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stage prompt — collapsed */}
          {parsed.stagePrompt && (
            <div className="px-4 py-3 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setShowPrompt((v) => !v)}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant w-full text-left hover:text-on-surface transition-colors"
              >
                Stage Prompt
                <span
                  className="material-symbols-outlined text-sm transition-transform"
                  style={{ transform: showPrompt ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>
              {showPrompt && (
                <p className="text-xs text-on-surface-variant mt-2 leading-relaxed font-mono bg-surface-container rounded-xl px-3 py-2.5">
                  {parsed.stagePrompt}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Prompt queue panel ────────────────────────────────────────────────────────
function PromptQueuePanel({
  characters,
  approvedCharIds,
}: {
  characters: { characterId: string; name: string; status: string }[];
  approvedCharIds: Set<string>;
}) {
  const approvedCount = approvedCharIds.size;
  const total = characters.length;

  if (total === 0) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4 text-center">
        <p className="text-xs text-on-surface-variant">
          Prompts appear here after designs are generated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Prompt Queue</p>
        <span className="text-[11px] text-on-surface-variant tabular-nums">{total} generated</span>
      </div>

      {characters.map((char, i) => {
        const isApproved = approvedCharIds.has(char.characterId);
        const isLoading  = char.status === 'loading';
        const isError    = char.status === 'error';

        return (
          <div
            key={char.characterId}
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-surface-container transition-colors"
          >
            {isApproved ? (
              <span
                className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            ) : isLoading ? (
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
            ) : isError ? (
              <span className="material-symbols-outlined text-sm text-red-500 flex-shrink-0">error</span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full border-2 border-on-surface/20 flex-shrink-0" />
            )}
            <span className="text-xs text-on-surface-variant flex-1 truncate">
              #{i + 1} {char.name}
            </span>
            <span
              className={`text-[10px] font-bold flex-shrink-0 ${
                isApproved ? 'text-emerald-600'
                : isLoading ? 'text-blue-600'
                : isError   ? 'text-red-500'
                : 'text-on-surface-variant/40'
              }`}
            >
              {isApproved ? 'Approved' : isLoading ? 'Generating' : isError ? 'Error' : 'Pending'}
            </span>
          </div>
        );
      })}

      <div className="pt-3 mt-1 border-t border-outline-variant/10">
        <p className="text-[11px] text-on-surface-variant mb-1.5 tabular-nums">
          {approvedCount} / {total} characters approved
        </p>
        <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${total > 0 ? Math.round((approvedCount / total) * 100) : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Character review card (Reference Images tab) ──────────────────────────────
function CharacterReviewCard({
  character,
  settings,
  aspectRatio,
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
    candidates: { id: string; imageUrl: string; createdAt: string }[];
    selectedCandidateId: string | null;
  };
  settings: ImageGenSettings;
  aspectRatio: string;
  isApproved: boolean;
  isAnyGenerating: boolean;
  onRegenerate: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onUpdateSettings: (s: ImageGenSettings) => void;
  onAspectRatioChange: (r: string) => void;
  onApprove: () => void;
  onRevoke: () => void;
}) {
  const isLoading = character.status === 'loading';
  const isFailed  = character.status === 'error';
  const hasImages = character.candidates.length > 0;

  return (
    <div
      className={`rounded-3xl border overflow-hidden transition-colors ${
        isApproved
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-outline-variant/10 bg-surface-container-lowest'
      }`}
    >
      {/* ── Image area ── */}
      <div className="min-h-[200px] bg-surface-container">
        {hasImages ? (
          <div className="grid grid-cols-2 gap-3 p-4">
            {character.candidates.map((candidate) => {
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
                      alt={`${character.name} candidate`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div
                    className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 ${
                      sel ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {sel && (
                      <span
                        className="material-symbols-outlined text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                    )}
                    {sel ? 'Selected' : 'Select'}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            {isLoading ? (
              <span className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Generating images…
              </span>
            ) : (
              <span className="text-sm text-on-surface-variant">
                No images yet — click Generate to start.
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="p-4 space-y-4 border-t border-outline-variant/10">

        {/* Aspect ratio */}
        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
            Aspect Ratio
          </p>
          <AspectRatioSelector
            value={aspectRatio}
            onChange={onAspectRatioChange}
            disabled={isAnyGenerating}
          />
        </div>

        {/* Mode panel */}
        <CharacterModePanel
          disabled={isAnyGenerating}
          value={settings}
          onChange={onUpdateSettings}
        />

        {/* Error message */}
        {character.error && (
          <p className="text-xs text-red-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">error</span>
            {character.error}
          </p>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Generating…
            </div>
          ) : isFailed ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-red-500">
                <span className="material-symbols-outlined text-sm">error</span>
                Failed
              </span>
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">replay</span>
                Retry
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onRegenerate}
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
                  className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 rounded-2xl text-xs font-bold bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 transition-colors"
                >
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  Approved · Revoke
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={isAnyGenerating || !character.selectedCandidateId}
                  className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 rounded-2xl text-xs font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  Approve
                </button>
              )}
            </>
          )}
        </div>
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

  const [charSettings, setCharSettings]     = useState<Record<string, ImageGenSettings>>({});
  const [aspectRatioMap, setAspectRatioMap] = useState<Record<string, string>>({});
  const [approvedCharIds, setApprovedCharIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab]           = useState<'designs' | 'references'>('designs');
  const [isLibraryOpen, setIsLibraryOpen]   = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const { leftPct, containerRef, onDividerMouseDown } = useSplitPanel();

  const getCharSettings   = (id: string): ImageGenSettings => charSettings[id] ?? DEFAULT_SETTINGS;
  const updateCharSettings = (id: string, s: ImageGenSettings) =>
    setCharSettings((prev) => ({ ...prev, [id]: s }));
  const getAspectRatio    = (id: string): string => aspectRatioMap[id] ?? '2:3';
  const updateAspectRatio = (id: string, r: string) =>
    setAspectRatioMap((prev) => ({ ...prev, [id]: r }));

  const approveChar = (id: string) =>
    setApprovedCharIds((prev) => new Set([...prev, id]));
  const revokeChar  = (id: string) =>
    setApprovedCharIds((prev) => { const n = new Set(prev); n.delete(id); return n; });

  const cooldown      = getCooldownSeconds(2);
  const isGenerating  = step2.isLoading;
  const canGenerate   = !isGenerating && cooldown === 0;
  const displayText   = step2.streamingText ?? step2.data?.designMarkdown ?? null;
  const charSections  = step2.data ? parseCharacterSections(step2.data.designMarkdown) : [];
  const characters    = step2ImageReview.data?.characters ?? [];
  const isImageGenerating = !!step2ImageReview.data?.isGenerating;

  const existingCharacterIds = new Set(characters.map((c) => c.characterId));

  let state: State = 1;
  if (isGenerating)                                              state = 2;
  else if (step2.isApproved && !step2.regeneratedAfterApproval) state = 4;
  else if (step2.data && step2.regeneratedAfterApproval)        state = 5;
  else if (step2.data)                                          state = 3;

  const approvedCount   = approvedCharIds.size;
  // no-characters means image review was skipped — treat as fully approved
  const allCharsApproved = characters.length === 0 || approvedCount === characters.length;
  const pendingCount    = characters.filter((c) => !approvedCharIds.has(c.characterId)).length;

  const handleConfirmRegen = useCallback(() => {
    setShowRegenConfirm(false);
    setApprovedCharIds(new Set());
    handleGenerate(2);
  }, [handleGenerate]);

  const handleApproveAndContinue = useCallback(() => {
    // Already fully approved or image review already done → just navigate
    if (state === 4 || step2ImageReview.isApproved) { setActiveStep(3); return; }
    // Approve design sheet first (does NOT unlock step3 by itself)
    if (!step2.isApproved) handleApprove(2);
    // Approve character references — this unlocks step3 and calls setActiveStep(3) internally
    // If no image data, the context handles skip + unlock automatically
    handleApproveCharacterReferences();
  }, [state, step2.isApproved, step2ImageReview.isApproved, handleApprove, handleApproveCharacterReferences, setActiveStep]);

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
        <StateBadge state={state} />
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
            {state >= 3 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            )}
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
          {/* Streaming live preview */}
          {state === 2 && step2.streamingText && (
            <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Live design stream
              </p>
              <Markdown className="[&>*:last-child]:mb-0">{step2.streamingText}</Markdown>
            </div>
          )}

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

          {/* Designs + sidebar */}
          {(state === 3 || state === 4 || state === 5) && step2.data && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
              {/* Left — character sections */}
              <div className="space-y-3">
                {charSections.length > 0 ? (
                  charSections.map((sec, i) => (
                    <DesignSheetCard
                      key={`${sec.name}-${i}`}
                      index={i}
                      name={sec.name}
                      lines={sec.lines}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
                    <Markdown className="[&>*:last-child]:mb-0">{displayText ?? ''}</Markdown>
                  </div>
                )}
              </div>

              {/* Right — prompt queue */}
              <div>
                <PromptQueuePanel
                  characters={
                    characters.length > 0
                      ? characters
                      : charSections.map((s, i) => ({
                          characterId: String(i),
                          name: s.name,
                          status: 'idle',
                        }))
                  }
                  approvedCharIds={approvedCharIds}
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
              onClick={() => handleGenerateCharacterReferences(charSettings)}
              disabled={step2ImageReview.locked || isImageGenerating || !step2.data}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                step2ImageReview.locked || isImageGenerating || !step2.data
                  ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
                  : step2ImageReview.data
                    ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                    : 'bg-primary text-on-primary hover:opacity-90'
              }`}
            >
              <span
                className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
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
              <span className="material-symbols-outlined text-4xl text-outline-variant mb-3 block">
                lock
              </span>
              <p className="font-semibold text-on-surface text-sm">
                Approve the design sheet first to unlock reference images
              </p>
            </div>
          )}

          {/* Per-character split layout */}
          {!step2ImageReview.locked && characters.length > 0 && (
            <div ref={containerRef} className="space-y-10">
              {characters.map((character, idx) => {
                const matchedSection = charSections.find(
                  (s) =>
                    s.name.toLowerCase().includes(character.name.toLowerCase()) ||
                    character.name
                      .toLowerCase()
                      .includes(s.name.toLowerCase().split(/\s+/)[0])
                );

                const descriptionPanel = matchedSection ? (
                  <DesignSheetCard
                    index={idx}
                    name={matchedSection.name}
                    lines={matchedSection.lines}
                  />
                ) : (
                  <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 space-y-2">
                    <p className="text-xs text-on-surface-variant/60 italic">
                      {step2.data
                        ? 'No design sheet matched for this character.'
                        : 'Generate design sheet to see description here.'}
                    </p>
                    {character.prompt && (
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {character.prompt}
                      </p>
                    )}
                  </div>
                );

                return (
                  <div key={character.characterId}>
                    {idx > 0 && <div className="h-px bg-outline-variant/10 mb-10" />}

                    {/* Character header */}
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-[11px] font-bold text-on-surface-variant/40">#{idx + 1}</span>
                      <h3 className="font-bold text-on-surface">{character.name}</h3>
                      {approvedCharIds.has(character.characterId) && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <span
                            className="material-symbols-outlined text-xs"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                          Approved
                        </span>
                      )}
                    </div>

                    {/* Mobile: stack vertically */}
                    <div className="md:hidden space-y-4">
                      {descriptionPanel}
                      <CharacterReviewCard
                        character={character}
                        settings={getCharSettings(character.characterId)}
                        aspectRatio={getAspectRatio(character.characterId)}
                        isApproved={approvedCharIds.has(character.characterId)}
                        isAnyGenerating={isImageGenerating}
                        onRegenerate={() => { revokeChar(character.characterId); handleRegenerateCharacterImage(character.characterId, getCharSettings(character.characterId)); }}
                        onSelectCandidate={(id) => handleSelectCharacterCandidate(character.characterId, id)}
                        onUpdateSettings={(s) => updateCharSettings(character.characterId, s)}
                        onAspectRatioChange={(r) => updateAspectRatio(character.characterId, r)}
                        onApprove={() => approveChar(character.characterId)}
                        onRevoke={() => revokeChar(character.characterId)}
                      />
                    </div>

                    {/* Desktop: draggable split */}
                    <div className="hidden md:flex items-start">
                      {/* Left — description (sticky) */}
                      <div
                        className="sticky top-28 flex-shrink-0"
                        style={{ width: `${leftPct}%` }}
                      >
                        {descriptionPanel}
                      </div>

                      {/* Drag handle */}
                      <div
                        onMouseDown={onDividerMouseDown}
                        title="Drag to resize panels"
                        className="w-1 self-stretch mx-3 rounded-full bg-outline-variant/20 hover:bg-primary/40 cursor-col-resize flex-shrink-0 transition-colors"
                      />

                      {/* Right — image card */}
                      <div className="flex-1 min-w-0">
                        <CharacterReviewCard
                          character={character}
                          settings={getCharSettings(character.characterId)}
                          aspectRatio={getAspectRatio(character.characterId)}
                          isApproved={approvedCharIds.has(character.characterId)}
                          isAnyGenerating={isImageGenerating}
                          onRegenerate={() => { revokeChar(character.characterId); handleRegenerateCharacterImage(character.characterId, getCharSettings(character.characterId)); }}
                          onSelectCandidate={(id) => handleSelectCharacterCandidate(character.characterId, id)}
                          onUpdateSettings={(s) => updateCharSettings(character.characterId, s)}
                          onAspectRatioChange={(r) => updateAspectRatio(character.characterId, r)}
                          onApprove={() => approveChar(character.characterId)}
                          onRevoke={() => revokeChar(character.characterId)}
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
        <div className="px-10 py-4 max-w-6xl mx-auto">
          {isGenerating ? (
            <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
              Generating designs… please wait
            </div>
          ) : state === 1 ? (
            /* Idle — Previous (left) + Generate (right) */
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
                <span
                  className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  style
                </span>
                {cooldown > 0 ? `Retry in ${cooldown}s` : 'Generate Designs'}
              </button>
            </div>
          ) : (
            /* Post-generate — Previous (left) | Regenerate + Approve (right) */
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
                  onClick={handleApproveAndContinue}
                  disabled={state !== 4 && !step2ImageReview.isApproved && !allCharsApproved}
                  title={
                    state !== 4 && !step2ImageReview.isApproved && !allCharsApproved
                      ? `Approve all ${characters.length} characters to continue`
                      : undefined
                  }
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all flex-shrink-0 ${
                    state === 4 || step2ImageReview.isApproved
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : allCharsApproved
                        ? 'bg-gray-900 text-white hover:opacity-90'
                        : 'bg-gray-900/30 text-white/70 cursor-not-allowed'
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  {state === 4 || step2ImageReview.isApproved
                    ? 'Approved · Continue →'
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
                  This will replace all current designs and remove any per-character
                  approvals. This cannot be undone.
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
