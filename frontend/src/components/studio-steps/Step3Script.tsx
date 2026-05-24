'use client';

import React from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';

export default function Step3Script() {
  const {
    step3,
    handleGenerate,
    handleApprove,
    handleRetry,
    getCooldownSeconds,
  } = useComicGeneration();

  const cooldownSeconds = getCooldownSeconds(3);
  const isGenerateDisabled = step3.isLoading || cooldownSeconds > 0;
  const statusLabel = step3.isApproved
    ? 'Approved'
    : step3.isLoading
      ? 'Processing'
      : step3.data
        ? 'Ready for review'
        : 'Not generated';

  return (
    <section className="bg-white text-gray-900 rounded-3xl p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Panel script</h2>
          <p className="mt-2 text-gray-600">Review the full page-by-page, panel-by-panel script.</p>
        </div>
        <div className="text-sm text-gray-600">Status: {statusLabel}</div>
      </div>

      <div className="mt-6 rounded-3xl bg-gray-100 p-6">
        <h3 className="text-lg font-semibold">Script output</h3>
        {step3.data?.scriptMarkdown ? (
          <pre className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{step3.data.scriptMarkdown}</pre>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Generate Step 3 to see the full script.</p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => handleGenerate(3)}
          disabled={isGenerateDisabled}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            isGenerateDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:scale-105'
          }`}
        >
          {step3.isLoading
            ? 'Generating...'
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : step3.data
                ? 'Regenerate script'
                : 'Generate script'}
        </button>
        <button
          type="button"
          onClick={() => handleApprove(3)}
          disabled={!step3.data || step3.isApproved}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            !step3.data || step3.isApproved
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-100 text-gray-900 hover:scale-105'
          }`}
        >
          {step3.isApproved ? 'Approved' : 'Approve script'}
        </button>
        {step3.error ? (
          <button
            type="button"
            onClick={() => handleRetry(3)}
            className="px-6 py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-900 hover:scale-105 transition-transform"
          >
            Retry
          </button>
        ) : null}
        {step3.error ? <span className="text-sm text-red-600">{step3.error}</span> : null}
      </div>
    </section>
  );
}
