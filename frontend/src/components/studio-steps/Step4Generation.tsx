'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import ImageGenModePanel from '@/components/studio-steps/ImageGenModePanel';
import ProjectsDrawer from '@/components/ProjectsDrawer';

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
    handleRegeneratePage,
    copyProjectJson,
    downloadProjectJson,
    saveToCloud,
    cloudSaveStatus,
    cloudSaveError,
    getCooldownSeconds,
  } = useComicGeneration();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

      <div className="mt-6">
        <ImageGenModePanel disabled={step4.isLoading || !!step4.data?.isGenerating} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
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
            <div className="rounded-2xl bg-white px-4 py-3">Total pages: {step4Stats.total}</div>
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
              onClick={saveToCloud}
              disabled={cloudSaveStatus === 'saving'}
              className={`px-5 py-2 rounded-2xl text-xs font-semibold transition-transform ${
                cloudSaveStatus === 'saving'
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : cloudSaveStatus === 'saved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-900 text-white hover:scale-105'
              }`}
            >
              {cloudSaveStatus === 'saving' ? 'Saving…' : cloudSaveStatus === 'saved' ? 'Saved!' : 'Save to Cloud'}
            </button>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="px-5 py-2 rounded-2xl text-xs font-semibold bg-gray-100 text-gray-900 hover:scale-105 transition-transform"
            >
              My Projects
            </button>
            <button
              type="button"
              onClick={copyProjectJson}
              className="px-5 py-2 rounded-2xl text-xs font-semibold bg-gray-100 text-gray-900 hover:scale-105 transition-transform"
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
            {cloudSaveError && cloudSaveStatus === 'error' ? (
              <span className="text-xs text-red-600">{cloudSaveError}</span>
            ) : null}
          </div>
          <pre className="mt-4 max-h-[240px] overflow-auto rounded-2xl bg-white p-4 text-xs text-gray-700">
            {JSON.stringify(projectSnapshot, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-8">
        {step4PanelsByPage.length ? (
          <div className="space-y-8">
            {step4PanelsByPage.map(([pageNumber, panels]) => {
              const pageState = step4.data?.pageStates?.[`page-${pageNumber}`];
              const pageStatus = pageState?.status || 'idle';
              return (
                <section key={`page-${pageNumber}`} className="rounded-3xl bg-gray-100 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">Page {pageNumber}</h3>
                    <button
                      type="button"
                      onClick={() => handleRegeneratePage(pageNumber)}
                      disabled={!step4.data || step4.data.isGenerating}
                      className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-transform ${
                        !step4.data || step4.data.isGenerating
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-900 text-white hover:scale-105'
                      }`}
                    >
                      {pageStatus === 'loading'
                        ? 'Generating page...'
                        : pageStatus === 'error'
                          ? 'Retry page'
                          : pageStatus === 'success'
                            ? 'Regenerate page'
                            : 'Generate page'}
                    </button>
                  </div>

                  {/* Full-page comic image */}
                  <div className="mt-4">
                    {pageState?.error ? <p className="mb-3 text-sm text-red-600">{pageState.error}</p> : null}
                    {pageState?.imageUrl ? (
                      <div className="overflow-hidden rounded-2xl bg-gray-200">
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
                      <div className="rounded-2xl bg-gray-200 px-4 py-10 text-center text-sm text-gray-500">
                        {pageStatus === 'loading' ? 'Generating comic page image...' : 'No image yet — click "Generate page" above.'}
                      </div>
                    )}
                  </div>

                  {/* Panel-by-panel script details */}
                  <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {panels.map((panel) => (
                      <div key={panel.id} className="rounded-2xl bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{panel.contextLabel}</p>
                        <p className="mt-1 text-sm text-gray-600">{panel.dialogueSfx}</p>
                        <div className="mt-3 rounded-xl bg-gray-100 p-3 text-xs text-gray-600">
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Panel prompt</p>
                          <p className="mt-1 whitespace-pre-wrap">{panel.aiImagePrompt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <p className="mt-6 text-sm text-gray-500">No panels yet. Build panels from Step 3 first.</p>
        )}
      </div>

      <ProjectsDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </section>
  );
}
