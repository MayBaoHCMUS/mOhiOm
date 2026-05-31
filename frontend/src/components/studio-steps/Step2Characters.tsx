'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { ImageGenSettings } from '@/context/ComicGenerationContext';
import CharacterModePanel, { DEFAULT_SETTINGS } from '@/components/studio-steps/CharacterModePanel';
import CharacterLibraryModal from '@/components/CharacterLibraryModal';

export default function Step2Characters() {
  const {
    step2,
    step2ImageReview,
    handleGenerate,
    handleApprove,
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

  const cooldownSeconds = getCooldownSeconds(2);
  const isGenerateDisabled = step2.isLoading || cooldownSeconds > 0;
  const prompts = getStep2PromptList();

  const displayText = step2.streamingText ?? step2.data?.designMarkdown ?? null;

  const statusLabel = step2.isApproved
    ? 'Approved'
    : step2.isLoading
      ? step2.streamingText ? 'Streaming…' : 'Processing…'
      : step2.data
        ? 'Ready for review'
        : 'Not generated';

  return (
    <section className="bg-white text-gray-900 rounded-3xl p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Character designs</h2>
          <p className="mt-2 text-gray-600">Generate design sheets, then approve references for final rendering.</p>
        </div>
        <div className="flex items-center gap-3">
          {step2.isLoading && step2.streamingText && (
            <span className="flex items-center gap-1.5 text-sm text-blue-600">
              <span className="animate-pulse">●</span>
              Streaming
            </span>
          )}
          <div className="text-sm text-gray-600">Status: {statusLabel}</div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => handleGenerate(2)}
          disabled={isGenerateDisabled}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            isGenerateDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:scale-105'
          }`}
        >
          {step2.isLoading
            ? 'Generating…'
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : step2.data
                ? 'Regenerate designs'
                : 'Generate designs'}
        </button>
        <button
          type="button"
          onClick={() => handleApprove(2)}
          disabled={!step2.data || step2.isApproved}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            !step2.data || step2.isApproved
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-100 text-gray-900 hover:scale-105'
          }`}
        >
          {step2.isApproved ? 'Approved' : 'Approve design sheet'}
        </button>
        {step2.error && (
          <button
            type="button"
            onClick={() => handleRetry(2)}
            className="px-6 py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-900 hover:scale-105 transition-transform"
          >
            Retry
          </button>
        )}
        {step2.error && <span className="text-sm text-red-600">{step2.error}</span>}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6">
        <div className="rounded-3xl bg-gray-100 p-6">
          <h3 className="text-lg font-semibold">Design sheet output</h3>
          {displayText ? (
            <pre className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
              {displayText}
              {step2.isLoading && step2.streamingText && (
                <span className="inline-block w-[2px] h-[1em] ml-px bg-gray-500 animate-pulse align-text-bottom" />
              )}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-gray-500">Generate Step 2 to view the character design sheet.</p>
          )}
        </div>
        <div className="rounded-3xl bg-gray-100 p-6">
          <h3 className="text-lg font-semibold">Prompt queue</h3>
          {prompts.length ? (
            <ul className="mt-4 space-y-3 text-sm text-gray-700">
              {prompts.map((prompt, index) => (
                <li key={`${prompt}-${index}`} className="rounded-2xl bg-white px-4 py-3">
                  {prompt}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-500">Character prompts will appear here after generation.</p>
          )}
        </div>
      </div>

      {/* ── Reference image review ────────────────────────────────────────── */}
      <div className="mt-8 rounded-3xl bg-gray-100 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Reference image review</h3>
            <p className="mt-2 text-sm text-gray-600">
              Generate image candidates, select one per character, then approve to unlock Step 3.
            </p>
          </div>
          <div className="text-sm text-gray-600">
            {step2ImageReview.locked
              ? 'Locked until Step 2 approved'
              : step2ImageReview.isApproved
                ? 'Approved'
                : 'In review'}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => handleGenerateCharacterReferences(charSettings)}
            disabled={step2ImageReview.locked || step2ImageReview.isLoading || !step2.data}
            className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
              step2ImageReview.locked || step2ImageReview.isLoading || !step2.data
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-900 text-white hover:scale-105'
            }`}
          >
            {step2ImageReview.isLoading ? 'Generating images…' : 'Generate references'}
          </button>
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            disabled={step2ImageReview.isLoading}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
              step2ImageReview.isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-900 hover:scale-105'
            }`}
          >
            <span className="material-symbols-outlined text-base">library_books</span>
            From Library
          </button>
          <button
            type="button"
            onClick={handleApproveCharacterReferences}
            disabled={step2ImageReview.locked || !step2ImageReview.data || step2ImageReview.isApproved}
            className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
              step2ImageReview.locked || !step2ImageReview.data || step2ImageReview.isApproved
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-900 hover:scale-105'
            }`}
          >
            {step2ImageReview.isApproved ? 'Approved' : 'Approve references'}
          </button>
          <button
            type="button"
            onClick={handleRetryCharacterReferences}
            disabled={step2ImageReview.locked}
            className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
              step2ImageReview.locked
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-900 hover:scale-105'
            }`}
          >
            Reset review
          </button>
          {step2ImageReview.error && <span className="text-sm text-red-600">{step2ImageReview.error}</span>}
        </div>

        {/* Library-sourced characters notice */}
        {!step2ImageReview.locked && !step2.data && step2ImageReview.data?.characters?.length ? (
          <p className="mt-4 text-sm text-blue-600 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">info</span>
            Showing characters imported from your library. Generate designs to add AI-extracted characters.
          </p>
        ) : null}

        {step2ImageReview.data?.characters?.length ? (
          <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {step2ImageReview.data.characters.map((character) => (
              <div key={character.characterId} className="rounded-3xl bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm uppercase tracking-[0.2em] text-gray-500">{character.name}</p>
                    <p className="mt-2 text-sm text-gray-600">{character.prompt}</p>
                    <CharacterModePanel
                      disabled={!!step2ImageReview.data?.isGenerating}
                      value={getCharSettings(character.characterId)}
                      onChange={(s) => updateCharSettings(character.characterId, s)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRegenerateCharacterImage(character.characterId, getCharSettings(character.characterId))}
                    disabled={step2ImageReview.data?.isGenerating}
                    className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-semibold transition-transform ${
                      step2ImageReview.data?.isGenerating
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-900 hover:scale-105'
                    }`}
                  >
                    {character.status === 'loading' ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </div>
                {character.error && <p className="mt-3 text-sm text-red-600">{character.error}</p>}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {character.candidates.length ? (
                    character.candidates.map((candidate) => {
                      const isSelected = candidate.id === character.selectedCandidateId;
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => handleSelectCharacterCandidate(character.characterId, candidate.id)}
                          className={`rounded-2xl p-3 text-left transition-transform ${
                            isSelected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:scale-[1.02]'
                          }`}
                        >
                          <div className="w-full overflow-hidden rounded-2xl bg-white">
                            <Image
                              src={candidate.imageUrl}
                              alt={`${character.name} candidate`}
                              width={320}
                              height={420}
                              className="h-auto w-full object-cover"
                              unoptimized
                            />
                          </div>
                          <p className="mt-3 text-xs">{isSelected ? 'Selected' : 'Select candidate'}</p>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl bg-gray-100 px-4 py-6 text-sm text-gray-500">
                      No images generated yet.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-gray-500">
            Generate Step 2 and click &quot;Generate references&quot; to review images, or click &quot;From Library&quot; to use saved characters.
          </p>
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
