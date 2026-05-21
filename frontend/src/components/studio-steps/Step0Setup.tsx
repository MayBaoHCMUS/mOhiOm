'use client';

import React from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';

export default function Step0Setup() {
  const {
    projectId,
    storyFile,
    storyText,
    mainCharacters,
    numChapters,
    targetPages,
    mangaGenre,
    artStyle,
    maxPanelsPerPage,
    specialRequests,
    step1,
    globalError,
    setProjectId,
    setStoryText,
    setMainCharacters,
    setNumChapters,
    setTargetPages,
    setMangaGenre,
    setArtStyle,
    setMaxPanelsPerPage,
    setSpecialRequests,
    handleFileUpload,
    handleGenerate,
    getCooldownSeconds,
    loadMockPipeline,
  } = useComicGeneration();

  const cooldownSeconds = getCooldownSeconds(1);
  const isGenerateDisabled = step1.isLoading || cooldownSeconds > 0;
  const statusLabel = step1.isApproved
    ? 'Approved'
    : step1.isLoading
      ? 'Generating'
      : step1.data
        ? 'Ready'
        : 'Not generated';

  const inputBase = 'mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none';
  const labelBase = 'text-xs uppercase tracking-[0.2em] text-gray-500';

  return (
    <section className="bg-white text-gray-900 rounded-3xl p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Project setup</h2>
          <p className="mt-2 text-gray-600">Feed the story, define goals, and kick off analysis.</p>
        </div>
        <div className="text-sm text-gray-600">Analysis status: {statusLabel}</div>
      </div>

      {globalError ? (
        <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{globalError}</div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-gray-100 p-6">
          <h3 className="text-lg font-semibold">Story input</h3>
          <div className="mt-5">
            <label className={labelBase}>Project ID</label>
            <input
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className={inputBase}
              placeholder="manga_project_001"
            />
          </div>
          <div className="mt-5">
            <label className={labelBase}>Story file</label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".txt,.md"
                onChange={handleFileUpload}
                className="rounded-2xl bg-white px-4 py-2 text-sm text-gray-700"
              />
              <span className="text-sm text-gray-600">
                {storyFile ? `Loaded: ${storyFile.name}` : 'Optional: upload .txt or .md'}
              </span>
            </div>
          </div>
          <div className="mt-5">
            <label className={labelBase}>Story text</label>
            <textarea
              value={storyText}
              onChange={(event) => setStoryText(event.target.value)}
              rows={10}
              className={`${inputBase} min-h-[220px]`}
              placeholder="Paste or write the story here."
            />
          </div>
        </div>

        <div className="rounded-3xl bg-gray-100 p-6">
          <h3 className="text-lg font-semibold">Creative targets</h3>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelBase}>Main characters</label>
              <input
                value={mainCharacters}
                onChange={(event) => setMainCharacters(event.target.value)}
                className={inputBase}
                placeholder="5"
              />
            </div>
            <div>
              <label className={labelBase}>Chapters</label>
              <input
                value={numChapters}
                onChange={(event) => setNumChapters(event.target.value)}
                className={inputBase}
                placeholder="4"
              />
            </div>
            <div>
              <label className={labelBase}>Target pages</label>
              <input
                value={targetPages}
                onChange={(event) => setTargetPages(event.target.value)}
                className={inputBase}
                placeholder="100"
              />
            </div>
            <div>
              <label className={labelBase}>Max panels / page</label>
              <input
                value={maxPanelsPerPage}
                onChange={(event) => setMaxPanelsPerPage(event.target.value)}
                className={inputBase}
                placeholder="6"
              />
            </div>
          </div>
          <div className="mt-5">
            <label className={labelBase}>Genre + tone</label>
            <input
              value={mangaGenre}
              onChange={(event) => setMangaGenre(event.target.value)}
              className={inputBase}
              placeholder="Fantasy/Adventure, Epic tone"
            />
          </div>
          <div className="mt-5">
            <label className={labelBase}>Art style reference</label>
            <input
              value={artStyle}
              onChange={(event) => setArtStyle(event.target.value)}
              className={inputBase}
              placeholder="Japanese manga style, detailed"
            />
          </div>
          <div className="mt-5">
            <label className={labelBase}>Special requests</label>
            <textarea
              value={specialRequests}
              onChange={(event) => setSpecialRequests(event.target.value)}
              rows={4}
              className={inputBase}
              placeholder="None"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => handleGenerate(1)}
          disabled={isGenerateDisabled}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            isGenerateDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:scale-105'
          }`}
        >
          {step1.isLoading
            ? 'Analyzing...'
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : step1.data
                ? 'Regenerate analysis'
                : 'Generate analysis'}
        </button>
        <button
          type="button"
          onClick={loadMockPipeline}
          className="px-6 py-3 rounded-2xl text-sm font-semibold transition-transform bg-gray-100 text-gray-900 hover:scale-105"
        >
          Load full mock pipeline
        </button>
        {step1.error ? <span className="text-sm text-red-600">{step1.error}</span> : null}
      </div>
    </section>
  );
}
