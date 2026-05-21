'use client';

import React from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';

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
    handleRetry,
    handleStartFullGeneration,
    handleRegeneratePanel,
    copyProjectJson,
    downloadProjectJson,
    getCooldownSeconds,
    loadMockStepData,
  } = useComicGeneration();

  const cooldownSeconds = getCooldownSeconds(4);
  const isGenerateDisabled = step4.isLoading || cooldownSeconds > 0;

  return (
    <section className="bg-white text-gray-900 rounded-3xl p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Image generation</h2>
          <p className="mt-2 text-gray-600">Create panel images and export the final project package.</p>
        </div>
        <div className="text-sm text-gray-600">Status: {step4.isApproved ? 'Completed' : step4.data ? 'Ready' : 'Not generated'}</div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => handleGenerate(4)}
          disabled={isGenerateDisabled || !step3.data}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            isGenerateDisabled || !step3.data
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:scale-105'
          }`}
        >
          {step4.isLoading
            ? 'Preparing panels...'
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : step4.data
                ? 'Rebuild panel list'
                : 'Build panels from script'}
        </button>
        <button
          type="button"
          onClick={() => loadMockStepData(4)}
          className="px-6 py-3 rounded-2xl text-sm font-semibold transition-transform bg-gray-100 text-gray-900 hover:scale-105"
        >
          Load mock panels
        </button>
        <button
          type="button"
          onClick={handleStartFullGeneration}
          disabled={!step4.data || step4.data.isGenerating}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            !step4.data || step4.data.isGenerating
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:scale-105'
          }`}
        >
          {step4.data?.isGenerating ? 'Generating images...' : 'Generate all images'}
        </button>
        <button
          type="button"
          onClick={() => handleApprove(4)}
          disabled={!step4.data || step4.isApproved}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            !step4.data || step4.isApproved
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-100 text-gray-900 hover:scale-105'
          }`}
        >
          {step4.isApproved ? 'Completed' : 'Mark complete'}
        </button>
        {step4.error ? (
          <button
            type="button"
            onClick={() => handleRetry(4)}
            className="px-6 py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-900 hover:scale-105 transition-transform"
          >
            Retry
          </button>
        ) : null}
        {step4.error ? <span className="text-sm text-red-600">{step4.error}</span> : null}
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_700px] gap-6">
        <div className="rounded-3xl bg-gray-100 p-6">
          <h3 className="text-lg font-semibold">Generation progress</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm text-gray-700 max-w-[360px]">
            <div className="rounded-2xl bg-white px-4 py-3">Total panels: {step4Stats.total}</div>
            <div className="rounded-2xl bg-white px-4 py-3">Success: {step4Stats.success}</div>
            <div className="rounded-2xl bg-white px-4 py-3">Loading: {step4Stats.loading}</div>
            <div className="rounded-2xl bg-white px-4 py-3">Errors: {step4Stats.error}</div>
          </div>
          {!step4.data ? (
            <p className="mt-4 text-sm text-gray-500">Generate Step 4 to build the panel list.</p>
          ) : null}
        </div>
        <div className="rounded-3xl bg-gray-100 p-6">
          <h3 className="text-lg font-semibold">Project export</h3>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyProjectJson}
              className="px-5 py-2 rounded-2xl text-xs font-semibold bg-gray-900 text-white hover:scale-105 transition-transform"
            >
              {jsonCopied ? 'Copied' : 'Copy JSON'}
            </button>
            <button
              type="button"
              onClick={downloadProjectJson}
              className="px-5 py-2 rounded-2xl text-xs font-semibold bg-gray-100 text-gray-900 hover:scale-105 transition-transform"
            >
              {jsonDownloaded ? 'Downloaded' : 'Download JSON'}
            </button>
            {lastDownloadedJsonFile ? (
              <span className="text-xs text-gray-500">Last file: {lastDownloadedJsonFile}</span>
            ) : null}
          </div>
          <pre className="mt-4 max-h-[240px] overflow-auto rounded-2xl bg-white p-4 text-xs text-gray-700">
            {JSON.stringify(projectSnapshot, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-8">
        {step4PanelsByPage.length ? (
          <div className="space-y-6">
            {step4PanelsByPage.map(([pageNumber, panels]) => (
              <section key={`page-${pageNumber}`} className="rounded-3xl bg-gray-100 p-6">
                <h3 className="text-lg font-semibold">Page {pageNumber}</h3>
                <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {panels.map((panel) => {
                    const panelState = step4.data?.panelStates[panel.id];
                    const status = panelState?.status || 'idle';
                    return (
                      <div key={panel.id} className="rounded-3xl bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{panel.contextLabel}</p>
                            <p className="mt-2 text-sm text-gray-600">{panel.dialogueSfx}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRegeneratePanel(panel.id)}
                            disabled={!step4.data || step4.data.isGenerating}
                            className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-transform ${
                              !step4.data || step4.data.isGenerating
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-900 hover:scale-105'
                            }`}
                          >
                            {status === 'loading' ? 'Generating...' : status === 'error' ? 'Regenerate' : 'Generate'}
                          </button>
                        </div>
                        <div className="mt-4 rounded-2xl bg-gray-100 p-4 text-sm text-gray-700">
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">AI image prompt</p>
                          <p className="mt-2 whitespace-pre-wrap">{panel.aiImagePrompt}</p>
                        </div>
                        {panelState?.error ? <p className="mt-3 text-sm text-red-600">{panelState.error}</p> : null}
                        {panelState?.imageUrl ? (
                          <div className="mt-4 overflow-hidden rounded-2xl bg-gray-100">
                            <Image
                              src={panelState.imageUrl}
                              alt={`${panel.contextLabel} render`}
                              width={720}
                              height={960}
                              className="h-auto w-full object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl bg-gray-100 px-4 py-6 text-sm text-gray-500">
                            {status === 'loading' ? 'Generating image...' : 'No image yet.'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-gray-500">No panels yet. Build panels from Step 3 first.</p>
        )}
      </div>
    </section>
  );
}
