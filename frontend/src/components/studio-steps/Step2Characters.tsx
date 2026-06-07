'use client';

import React, { useState } from 'react';
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
function StateBadge({ state, label }: { state: State; label?: string }) {
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
        {label ?? 'Approved'}
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
      {label ?? 'Pending review'}
    </div>
  );
}

// ── Design sheet character card ───────────────────────────────────────────────
function DesignSheetCard({ name, lines }: { name: string; lines: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
          </div>
          <span className="font-semibold text-sm text-on-surface">{name}</span>
        </div>
        <span
          className="material-symbols-outlined text-lg text-on-surface-variant transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <Markdown className="[&>*:last-child]:mb-0">{lines.join('\n')}</Markdown>
        </div>
      )}
    </div>
  );
}

// ── Prompt queue item ─────────────────────────────────────────────────────────
function PromptQueueItem({
  prompt,
  index,
  status,
}: {
  prompt: string;
  index: number;
  status: string;
}) {
  const dotColor =
    status === 'success' ? 'bg-emerald-500'
    : status === 'loading' ? 'bg-blue-500 animate-pulse'
    : status === 'error' ? 'bg-red-500'
    : 'bg-outline-variant';

  const statusLabel =
    status === 'success' ? 'Done'
    : status === 'loading' ? 'Generating'
    : status === 'error' ? 'Error'
    : 'Queued';

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 px-4 py-3">
      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">{statusLabel}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
          Prompt {index + 1}
        </p>
        <p className="text-xs text-on-surface-variant leading-relaxed">{prompt}</p>
      </div>
    </div>
  );
}

// ── Character review card ─────────────────────────────────────────────────────
function CharacterReviewCard({
  character,
  settings,
  isAnyGenerating,
  onRegenerate,
  onSelectCandidate,
  onUpdateSettings,
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
  isAnyGenerating: boolean;
  onRegenerate: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onUpdateSettings: (s: ImageGenSettings) => void;
}) {
  const isSelected = !!character.selectedCandidateId;
  const isLoading = character.status === 'loading';

  return (
    <div className={`rounded-3xl border p-5 space-y-4 transition-colors ${
      isSelected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-outline-variant/10 bg-surface-container-lowest'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            </div>
            <p className="font-bold text-sm text-on-surface">{character.name}</p>
            {isSelected && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Selection confirmed
              </span>
            )}
            {isLoading && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Generating
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant leading-snug pl-9">{character.prompt}</p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isAnyGenerating}
          className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full text-xs font-bold transition-all ${
            isAnyGenerating
              ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
              : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
          }`}
        >
          <span className="material-symbols-outlined text-sm">{isLoading ? 'hourglass_empty' : 'refresh'}</span>
          {isLoading ? 'Generating…' : 'Regenerate'}
        </button>
      </div>

      {/* Mode settings */}
      <CharacterModePanel
        disabled={isAnyGenerating}
        value={settings}
        onChange={onUpdateSettings}
      />

      {character.error && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">error</span>
          {character.error}
        </p>
      )}

      {/* Candidate images */}
      {character.candidates.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
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
                <div className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 ${sel ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                  {sel && <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                  {sel ? 'Selected' : 'Select'}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-container py-8 text-center">
          {isLoading ? (
            <span className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
              <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Generating images…
            </span>
          ) : (
            <span className="text-sm text-on-surface-variant">No images yet — click Regenerate to generate.</span>
          )}
        </div>
      )}
    </div>
  );
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
    getStep2PromptList,
    getCooldownSeconds,
    injectLibraryCharacters,
  } = useComicGeneration();

  const [charSettings, setCharSettings] = useState<Record<string, ImageGenSettings>>({});
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const existingCharacterIds = new Set(
    step2ImageReview.data?.characters.map((c) => c.characterId) ?? []
  );

  const getCharSettings = (characterId: string): ImageGenSettings =>
    charSettings[characterId] ?? DEFAULT_SETTINGS;

  const updateCharSettings = (characterId: string, settings: ImageGenSettings) =>
    setCharSettings((prev) => ({ ...prev, [characterId]: settings }));

  const cooldown = getCooldownSeconds(2);
  const isGenerating = step2.isLoading;
  const canGenerate = !isGenerating && cooldown === 0;
  const prompts = getStep2PromptList();

  const displayText = step2.streamingText ?? step2.data?.designMarkdown ?? null;
  const charSections = step2.data ? parseCharacterSections(step2.data.designMarkdown) : [];

  // Step2 state
  let state: State = 1;
  if (isGenerating) {
    state = 2;
  } else if (step2.isApproved && !step2.regeneratedAfterApproval) {
    state = 4;
  } else if (step2.data && step2.regeneratedAfterApproval) {
    state = 5;
  } else if (step2.data) {
    state = 3;
  }

  const isImageGenerating = !!step2ImageReview.data?.isGenerating;

  // All characters must have a selection for image review approval
  const allCharsSelected = (step2ImageReview.data?.characters ?? []).every(
    (c) => c.selectedCandidateId !== null
  );
  const canApproveImageReview =
    !step2ImageReview.locked &&
    !!step2ImageReview.data &&
    !step2ImageReview.isApproved &&
    allCharsSelected &&
    !isImageGenerating;

  // Step2ImageReview state indicator
  const imageReviewStatusLabel = step2ImageReview.locked
    ? 'Locked — approve design sheet first'
    : step2ImageReview.isApproved
      ? 'Approved'
      : !allCharsSelected
        ? 'Select one candidate per character'
        : 'Ready to approve';

  return (
    <section className="text-on-surface space-y-6">

      {/* ══ SECTION A: Design Sheet ══════════════════════════════════════════════ */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-on-surface">Character Designs</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              AI-generated design sheets for each character
            </p>
          </div>
          <StateBadge state={state} />
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => handleGenerate(2)}
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
              {isGenerating ? 'hourglass_empty' : state >= 3 ? 'refresh' : 'style'}
            </span>
            {isGenerating
              ? 'Generating…'
              : cooldown > 0
                ? `Retry in ${cooldown}s`
                : state >= 3
                  ? 'Regenerate designs'
                  : 'Generate designs'}
          </button>

          {(state === 3 || state === 5) && (
            <button
              type="button"
              onClick={() => handleApprove(2)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Approve design sheet
            </button>
          )}

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

        {/* Streaming */}
        {state === 2 && step2.streamingText && (
          <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 mb-6">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Live design stream
            </p>
            <Markdown className="[&>*:last-child]:mb-0">{step2.streamingText}</Markdown>
          </div>
        )}

        {/* Empty */}
        {state === 1 && (
          <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4 mb-6">
            <span className="material-symbols-outlined text-5xl text-outline-variant" style={{ fontVariationSettings: "'FILL' 1" }}>
              style
            </span>
            <div className="text-center">
              <p className="font-semibold text-on-surface">No design sheet yet</p>
              <p className="text-sm text-on-surface-variant mt-1">Generate Step 1 first, then click &ldquo;Generate designs&rdquo;.</p>
            </div>
          </div>
        )}

        {/* Content — 2 column */}
        {(state === 3 || state === 4 || state === 5) && step2.data && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
            {/* Left — character sections */}
            <div className="space-y-3">
              {charSections.length > 0 ? (
                charSections.map((sec, i) => (
                  <DesignSheetCard key={`${sec.name}-${i}`} name={sec.name} lines={sec.lines} />
                ))
              ) : (
                <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
                  <Markdown className="[&>*:last-child]:mb-0">{displayText ?? ''}</Markdown>
                </div>
              )}
            </div>

            {/* Right — prompt queue */}
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                Prompt Queue
              </p>
              {prompts.length > 0 ? (
                <div className="space-y-2">
                  {prompts.map((prompt, i) => {
                    const character = step2ImageReview.data?.characters[i];
                    const status = character?.status ?? 'idle';
                    return (
                      <PromptQueueItem
                        key={`${prompt}-${i}`}
                        prompt={prompt}
                        index={i}
                        status={status}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4 text-center">
                  <p className="text-xs text-on-surface-variant">
                    Prompts appear here after designs are generated.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ SECTION B: Reference image review ═══════════════════════════════════ */}
      <div className={`rounded-3xl border p-6 space-y-5 transition-colors ${
        step2ImageReview.locked
          ? 'border-outline-variant/10 bg-surface-container opacity-60 pointer-events-none select-none'
          : 'border-outline-variant/10 bg-surface-container-low'
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              Reference Image Review
              {step2ImageReview.locked && (
                <span className="material-symbols-outlined text-base text-on-surface-variant">lock</span>
              )}
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Generate reference images, select one candidate per character, then approve to unlock Step 3.
            </p>
          </div>
          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            step2ImageReview.isApproved
              ? 'bg-emerald-500/10 text-emerald-600'
              : step2ImageReview.locked
                ? 'bg-surface-container text-on-surface-variant'
                : allCharsSelected
                  ? 'bg-blue-500/10 text-blue-600'
                  : 'bg-amber-500/10 text-amber-600'
          }`}>
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              {step2ImageReview.isApproved ? 'check_circle' : step2ImageReview.locked ? 'lock' : allCharsSelected ? 'done_all' : 'pending'}
            </span>
            {imageReviewStatusLabel}
          </div>
        </div>

        {/* Image review actions */}
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
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isImageGenerating ? 'hourglass_empty' : step2ImageReview.data ? 'refresh' : 'image'}
            </span>
            {isImageGenerating ? 'Generating…' : step2ImageReview.data ? 'Regenerate all' : 'Generate references'}
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
            onClick={handleApproveCharacterReferences}
            disabled={!canApproveImageReview}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              !canApproveImageReview
                ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
                : 'bg-primary text-on-primary hover:opacity-90'
            }`}
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            {step2ImageReview.isApproved ? 'Approved' : 'Approve references'}
          </button>

          <button
            type="button"
            onClick={handleRetryCharacterReferences}
            disabled={step2ImageReview.locked}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base">restart_alt</span>
            Reset
          </button>

          {step2ImageReview.error && (
            <span className="text-sm text-red-500">{step2ImageReview.error}</span>
          )}
        </div>

        {/* Library-sourced notice */}
        {!step2ImageReview.locked && !step2.data && step2ImageReview.data?.characters?.length ? (
          <p className="text-sm text-blue-600 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">info</span>
            Showing characters from your library. Generate designs to add AI-extracted characters.
          </p>
        ) : null}

        {/* Characters grid */}
        {step2ImageReview.data?.characters?.length ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {step2ImageReview.data.characters.map((character) => (
              <CharacterReviewCard
                key={character.characterId}
                character={character}
                settings={getCharSettings(character.characterId)}
                isAnyGenerating={isImageGenerating}
                onRegenerate={() =>
                  handleRegenerateCharacterImage(character.characterId, getCharSettings(character.characterId))
                }
                onSelectCandidate={(id) => handleSelectCharacterCandidate(character.characterId, id)}
                onUpdateSettings={(s) => updateCharSettings(character.characterId, s)}
              />
            ))}
          </div>
        ) : (
          !step2ImageReview.locked && (
            <div className="rounded-2xl border-2 border-dashed border-outline-variant/20 py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-outline-variant mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>
                image_search
              </span>
              <p className="font-semibold text-on-surface text-sm">No reference images yet</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Click &ldquo;Generate references&rdquo; or import from library.
              </p>
            </div>
          )
        )}
      </div>

      <CharacterLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        existingIds={existingCharacterIds}
        onConfirm={injectLibraryCharacters}
      />
    </section>
  );
}