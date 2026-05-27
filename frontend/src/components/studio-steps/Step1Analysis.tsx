'use client';

import React from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';

export default function Step1Analysis() {
  const {
    step1,
    handleGenerate,
    handleApprove,
    handleRetry,
    getCooldownSeconds,
    loadMockStepData,
  } = useComicGeneration();

  const cooldownSeconds = getCooldownSeconds(1);
  const isGenerateDisabled = step1.isLoading || cooldownSeconds > 0;

  const statusLabel = step1.isApproved
    ? 'Approved'
    : step1.isLoading
      ? step1.streamingText
        ? 'Streaming…'
        : 'Processing…'
      : step1.data
        ? 'Ready for review'
        : 'Not generated';

  // Show streaming text while the request is in-flight; fall back to the
  // finished result once the stream completes.
  const displayText = step1.streamingText ?? step1.data?.analysisMarkdown ?? null;

  return (
    <section className="bg-white text-gray-900 rounded-3xl p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Story analysis</h2>
          <p className="mt-2 text-gray-600">Review narrative insights and character breakdowns.</p>
        </div>
        <div className="flex items-center gap-3">
          {step1.isLoading && step1.streamingText && (
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
          onClick={() => handleGenerate(1)}
          disabled={isGenerateDisabled}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            isGenerateDisabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:scale-105'
          }`}
        >
          {step1.isLoading
            ? 'Generating…'
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : step1.data
                ? 'Regenerate analysis'
                : 'Generate analysis'}
        </button>
        <button
          type="button"
          onClick={() => loadMockStepData(1)}
          className="px-6 py-3 rounded-2xl text-sm font-semibold transition-transform bg-gray-100 text-gray-900 hover:scale-105"
        >
          Load mock analysis
        </button>
        <button
          type="button"
          onClick={() => handleApprove(1)}
          disabled={!step1.data || step1.isApproved}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            !step1.data || step1.isApproved
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-100 text-gray-900 hover:scale-105'
          }`}
        >
          {step1.isApproved ? 'Approved' : 'Approve analysis'}
        </button>
        {step1.error && (
          <button
            type="button"
            onClick={() => handleRetry(1)}
            className="px-6 py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-900 hover:scale-105 transition-transform"
          >
            Retry
          </button>
        )}
        {step1.error && <span className="text-sm text-red-600">{step1.error}</span>}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="rounded-3xl bg-gray-100 p-6">
          <h3 className="text-lg font-semibold">Analysis output</h3>
          {displayText ? (
            <pre className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
              {displayText}
              {/* blinking cursor while streaming */}
              {step1.isLoading && step1.streamingText && (
                <span className="inline-block w-[2px] h-[1em] ml-px bg-gray-500 animate-pulse align-text-bottom" />
              )}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              Generate the analysis to see the full breakdown here.
            </p>
          )}
        </div>

        <div className="rounded-3xl bg-gray-100 p-6">
          <h3 className="text-lg font-semibold">Character focus</h3>
          {step1.data?.characterBreakdown?.length ? (
            <ul className="mt-4 space-y-3 text-sm text-gray-700">
              {step1.data.characterBreakdown.map((entry, index) => (
                <li key={`${entry}-${index}`} className="rounded-2xl bg-white px-4 py-3">
                  {entry}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              No character breakdown yet. Generate Step 1 first.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
