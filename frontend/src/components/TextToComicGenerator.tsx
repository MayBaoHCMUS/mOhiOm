'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geminiApi, toApiError } from '@/services/api';

type StepKey = 1 | 2 | 3 | 4;

interface StepState<T> {
  data: T | null;
  isLoading: boolean;
  isApproved: boolean;
  locked: boolean;
  error: string | null;
}

interface Step1Result {
  characterBreakdown: string[];
  plotAnalysis: string;
  sceneBreakdown: string;
}

interface Character {
  name: string;
  description: string;
  imagePrompt: string;
}

interface Step2Result {
  globalGuidelines: string;
  mainCharacters: Character[];
  supportingCharacters: Character[];
}

interface PanelScript {
  pageNumber: number;
  layoutSummary: string;
  panels: {
    panelNumber: number;
    description: string;
    dialogue: string;
    imagePrompt: string;
  }[];
}

interface Step3Result {
  totalPages: number;
  scripts: PanelScript[];
}

interface Step4Result {
  images: {
    id: string;
    pageNumber: number;
    panelNumber: number;
    prompt: string;
    imageUrl: string;
  }[];
}

type StepData = Step1Result | Step2Result | Step3Result | Step4Result;

interface ApprovedCacheEntry {
  key: string;
  data: StepData;
}

const emptyStepState = <T,>(locked: boolean): StepState<T> => ({
  data: null,
  isLoading: false,
  isApproved: false,
  locked,
  error: null,
});

export default function TextToComicGenerator() {
  // Input and configuration
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyText, setStoryText] = useState('');
  const [mainCharacters, setMainCharacters] = useState('5');
  const [numChapters, setNumChapters] = useState('4');
  const [targetPages, setTargetPages] = useState('100');
  const [mangaGenre, setMangaGenre] = useState('Fantasy/Adventure, Epic tone');
  const [artStyle, setArtStyle] = useState('Japanese manga style, detailed');
  const [maxPanelsPerPage, setMaxPanelsPerPage] = useState('6');

  // Per-step state
  const [step1, setStep1] = useState<StepState<Step1Result>>(emptyStepState(false));
  const [step2, setStep2] = useState<StepState<Step2Result>>(emptyStepState(true));
  const [step3, setStep3] = useState<StepState<Step3Result>>(emptyStepState(true));
  const [step4, setStep4] = useState<StepState<Step4Result>>(emptyStepState(true));
  const [activeStep, setActiveStep] = useState<StepKey>(1);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<Record<StepKey, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  });
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const approvedCacheRef = useRef<Partial<Record<StepKey, ApprovedCacheEntry>>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stepMap: Record<StepKey, StepState<any>> = useMemo(
    () => ({ 1: step1, 2: step2, 3: step3, 4: step4 }),
    [step1, step2, step3, step4]
  );

  const setStepState = (step: StepKey, updater: (prev: StepState<any>) => StepState<any>) => {
    if (step === 1) setStep1((prev) => updater(prev));
    if (step === 2) setStep2((prev) => updater(prev));
    if (step === 3) setStep3((prev) => updater(prev));
    if (step === 4) setStep4((prev) => updater(prev));
  };

  const parseLines = (text: string, limit: number) =>
    text
      .split(/\r?\n+/)
      .map((line) => line.replace(/^[-*\d\.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, limit);

  const buildStepPayload = async (step: StepKey): Promise<Step1Result | Step2Result | Step3Result | Step4Result> => {
    if (!storyText.trim()) {
      throw new Error('Please provide story text before generating.');
    }

    if (step === 1) {
      const resp = await geminiApi.analyzeStory(storyText, Number(numChapters) || 3);
      const analysis: string = resp.data.analysis || resp.data.generated_text || '';
      const breakdown = parseLines(analysis, Math.max(Number(mainCharacters) || 5, 3));
      return {
        characterBreakdown: breakdown.length ? breakdown : ['Character arcs pending parsing.'],
        plotAnalysis: analysis,
        sceneBreakdown: analysis,
      } satisfies Step1Result;
    }

    if (step === 2) {
      const context = step1.data?.plotAnalysis || storyText;
      const prompt = `You are preparing manga character designs. Use the prior analysis:
${context}

Output global design rules, main character sheets, and supporting cast prompts. Keep concise bullets.`;
      const resp = await geminiApi.generateText(prompt);
      const content: string = resp.data.generated_text || resp.data.analysis || '';
      const lines = parseLines(content, 8);
      const toCharacter = (label: string, text: string, idx: number): Character => ({
        name: `${label} ${idx + 1}`,
        description: text.slice(0, 160) || `Design notes for ${label} ${idx + 1}`,
        imagePrompt: text.slice(0, 140) || `${artStyle} portrait`,
      });
      return {
        globalGuidelines: content.slice(0, 500) || 'Awaiting guidelines',
        mainCharacters: lines.slice(0, 4).map((l, i) => toCharacter('Main', l, i)),
        supportingCharacters: lines.slice(4, 8).map((l, i) => toCharacter('Supporting', l, i)),
      } satisfies Step2Result;
    }

    if (step === 3) {
      const designPrompts = step2.data?.mainCharacters.map((c) => c.imagePrompt).join(' | ') || artStyle;
      const sceneDescription = `Create panel-by-panel script. Style: ${artStyle}. Prompts: ${designPrompts}. Chapters: ${numChapters}.`;
      const resp = await geminiApi.generatePanelScript(sceneDescription);
      const script: string = resp.data.panel_script || resp.data.generated_text || '';
      const pages = Math.min(Number(targetPages) || 30, 12);
      const lines = parseLines(script, 12);
      const scripts: PanelScript[] = Array.from({ length: Math.min(3, pages) }, (_, pageIdx) => ({
        pageNumber: pageIdx + 1,
        layoutSummary: 'Adapted from Gemini panel guidance.',
        panels: lines.slice(pageIdx * 3, pageIdx * 3 + 3).map((line, panelIdx) => ({
          panelNumber: panelIdx + 1,
          description: line || script.slice(0, 120),
          dialogue: '',
          imagePrompt: `${artStyle} panel ${panelIdx + 1}`,
        })),
      }));
      return { totalPages: pages, scripts } satisfies Step3Result;
    }

    const prompt = `Provide ${Math.min(8, Number(targetPages) || 8)} concise image prompts for key panels. Style: ${artStyle}. Use context: ${
      step3.data?.scripts.map((s) => `Page ${s.pageNumber}`).join(', ') || 'story'
    }.`;
    const resp = await geminiApi.generateText(prompt);
    const text: string = resp.data.generated_text || resp.data.analysis || '';
    const prompts = parseLines(text, 8);
    return {
      images: prompts.map((p, i) => ({
        id: `img-${i}`,
        pageNumber: Math.floor(i / 2) + 1,
        panelNumber: (i % 2) + 1,
        prompt: p || `Panel ${i + 1}`,
        imageUrl: `https://via.placeholder.com/360x480?text=Prompt+${i + 1}`,
      })),
    } satisfies Step4Result;
  };

  const getStepCacheKey = (step: StepKey): string => {
    const baseInputs = {
      storyText: storyText.trim(),
      mainCharacters,
      numChapters,
      targetPages,
      mangaGenre,
      artStyle,
      maxPanelsPerPage,
    };

    if (step === 1) {
      return JSON.stringify({ step, baseInputs });
    }

    if (step === 2) {
      return JSON.stringify({ step, baseInputs, step1: step1.data });
    }

    if (step === 3) {
      return JSON.stringify({ step, baseInputs, step2: step2.data });
    }

    return JSON.stringify({ step, baseInputs, step3: step3.data });
  };

  const getCooldownSeconds = (step: StepKey): number => {
    const remainingMs = cooldownUntil[step] - nowMs;
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  };

  const handleGenerate = async (step: StepKey) => {
    if (stepMap[step].locked) return;
    const cooldownSeconds = getCooldownSeconds(step);
    if (cooldownSeconds > 0) {
      setStepState(step, (prev) => ({
        ...prev,
        error: `Rate limited. Retry in ${cooldownSeconds}s.`,
      }));
      return;
    }

    const cacheKey = getStepCacheKey(step);
    const cached = approvedCacheRef.current[step];
    if (cached && cached.key === cacheKey) {
      setStepState(step, (prev) => ({ ...prev, data: cached.data, error: null }));
      setActiveStep(step);
      return;
    }

    setGlobalError(null);
    setStepState(step, (prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await buildStepPayload(step);
      setStepState(step, (prev) => ({ ...prev, data, isLoading: false }));
      setActiveStep(step);
    } catch (err: unknown) {
      const apiError = toApiError(err);
      if (apiError.status === 429 && apiError.retryAfterSeconds) {
        setCooldownUntil((prev) => ({
          ...prev,
          [step]: Date.now() + apiError.retryAfterSeconds * 1000,
        }));
      }

      const retryHint =
        apiError.status === 429 && apiError.retryAfterSeconds
          ? ` Retry in ${Math.ceil(apiError.retryAfterSeconds)}s.`
          : '';

      setStepState(step, (prev) => ({
        ...prev,
        isLoading: false,
        error: `${apiError.message}${retryHint}`.trim(),
      }));
    }
  };

  const handleApprove = (step: StepKey) => {
    const cacheKey = getStepCacheKey(step);
    const data = stepMap[step].data;
    if (data) {
      approvedCacheRef.current[step] = { key: cacheKey, data };
    }

    setStepState(step, (prev) => ({ ...prev, isApproved: true, locked: true }));
    const nextStep = (step + 1) as StepKey;
    if (nextStep <= 4) {
      setStepState(nextStep, (prev) => ({ ...prev, locked: false }));
      setActiveStep(nextStep);
    }
  };

  const handleRetry = (step: StepKey) => {
    setStepState(step, (prev) => ({ ...prev, data: null, isApproved: false, error: null }));
    handleGenerate(step);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoryFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setStoryText(content || '');
    };
    reader.readAsText(file);
  };

  const statusBadge = (step: StepKey) => {
    const s = stepMap[step];
    if (s.isApproved) return 'bg-green-500 text-white';
    if (s.isLoading) return 'bg-blue-500 text-white';
    if (s.locked) return 'bg-slate-600 text-gray-200';
    if (s.data) return 'bg-amber-500 text-slate-900';
    return 'bg-slate-700 text-gray-300';
  };

  const StepCard = ({
    step,
    title,
    children,
    context,
  }: {
    step: StepKey;
    title: string;
    children: React.ReactNode;
    context?: React.ReactNode;
  }) => {
    const state = stepMap[step];
    const locked = state.locked;
    const cooldownSeconds = getCooldownSeconds(step);
    const isCooldown = cooldownSeconds > 0;

    return (
      <div className={`rounded-2xl border ${locked ? 'border-slate-800 bg-slate-900/60' : 'border-slate-700 bg-slate-900'} shadow-lg p-6 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${statusBadge(step)}`}>
              {state.isApproved ? '✓' : step}
            </div>
            <div>
              <p className="text-sm text-gray-400">Step {step}</p>
              <h3 className="text-xl font-semibold text-white">{title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerate(step)}
              disabled={locked || state.isLoading || isCooldown}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                locked || isCooldown
                  ? 'bg-slate-800 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {state.isLoading
                ? 'Generating...'
                : isCooldown
                  ? `Retry in ${cooldownSeconds}s`
                  : `Generate Step ${step}`}
            </button>
            {!state.isApproved && state.data && (
              <button
                onClick={() => handleRetry(step)}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-slate-700 text-white hover:bg-slate-600"
              >
                Retry Step {step}
              </button>
            )}
            {!state.locked && !state.isApproved && state.data && (
              <button
                onClick={() => handleApprove(step)}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700"
              >
                Approve & Next
              </button>
            )}
          </div>
        </div>

        {context && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-gray-200">
            <p className="font-semibold text-gray-100 mb-2">Context from previous step</p>
            {context}
          </div>
        )}

        <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 min-h-[160px]">
          {state.error && (
            <div className="mb-3 rounded-md bg-red-900/40 border border-red-600 px-3 py-2 text-red-200 text-sm">
              {state.error}
            </div>
          )}
          {!state.data && !state.isLoading && (
            <p className="text-gray-400 text-sm">No output yet. Generate this step to proceed.</p>
          )}
          {state.isLoading && (
            <div className="flex items-center gap-3 text-blue-200 text-sm">
              <span className="animate-spin">⏳</span>
              Generating...
            </div>
          )}
          {state.data && children}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr]">
        {/* LEFT: Inputs */}
        <div className="border-r border-slate-800 bg-slate-900/80 p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <span className="text-4xl">🎨</span>
              Text-to-Comic Generator
            </h1>
            <p className="text-sm text-gray-400 mt-1">Sequential review & approval workflow</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Upload Story</label>
              <input
                type="file"
                accept=".txt,.md,.pdf"
                onChange={handleFileUpload}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
              {storyFile && <p className="mt-1 text-xs text-green-400">Loaded {storyFile.name}</p>}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Story Text</label>
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="Paste your story here..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white h-28 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Main Characters</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={mainCharacters}
                  onChange={(e) => setMainCharacters(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Chapters</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numChapters}
                  onChange={(e) => setNumChapters(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Target Pages</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={targetPages}
                  onChange={(e) => setTargetPages(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Max Panels / Page</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={maxPanelsPerPage}
                  onChange={(e) => setMaxPanelsPerPage(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Genre & Tone</label>
              <input
                type="text"
                value={mangaGenre}
                onChange={(e) => setMangaGenre(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Art Style</label>
              <input
                type="text"
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

            {globalError && (
              <div className="rounded-lg border border-red-500 bg-red-900/40 px-3 py-2 text-sm text-red-100">
                {globalError}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Steps */}
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-3 text-sm text-gray-400">
            {[1, 2, 3, 4].map((step) => (
              <button
                key={step}
                onClick={() => setActiveStep(step as StepKey)}
                disabled={stepMap[step as StepKey].locked}
                className={`px-3 py-1 rounded-full border text-xs transition ${
                  stepMap[step as StepKey].locked
                    ? 'border-slate-800 text-slate-600'
                    : activeStep === step
                      ? 'border-blue-500 text-blue-200'
                      : 'border-slate-600 text-gray-300 hover:border-blue-400 hover:text-blue-200'
                }`}
              >
                Step {step}
              </button>
            ))}
          </div>

          <StepCard
            step={1}
            title="Analysis & Planning"
          >
            {step1.data && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-100 mb-2">Character Breakdown</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-200">
                    {step1.data.characterBreakdown.map((c, i) => (
                      <div key={i} className="rounded-lg bg-slate-700/60 px-3 py-2">{c}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-100 mb-2">Plot Analysis</h4>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{step1.data.plotAnalysis}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-100 mb-2">Scene Breakdown</h4>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{step1.data.sceneBreakdown}</p>
                </div>
              </div>
            )}
          </StepCard>

          <StepCard
            step={2}
            title="Character Designs"
            context={
              step1.data ? (
                <div className="text-sm text-gray-200 space-y-1">
                  <p>Chapters: {numChapters} • Genre: {mangaGenre}</p>
                  <p>Characters: {step1.data.characterBreakdown.slice(0, 3).join('; ')}...</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Approve Step 1 to pass context.</p>
              )
            }
          >
            {step2.data && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-100 mb-2">Global Guidelines</h4>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{step2.data.globalGuidelines}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {step2.data.mainCharacters.map((c, idx) => (
                    <div key={idx} className="rounded-xl bg-slate-700/50 border border-slate-700 p-3">
                      <p className="text-blue-300 font-semibold">{c.name}</p>
                      <p className="text-sm text-gray-200 mt-1">{c.description}</p>
                      <p className="text-xs text-gray-400 mt-2">Prompt: {c.imagePrompt}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-100 mb-2">Supporting Cast</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-200">
                    {step2.data.supportingCharacters.map((c, idx) => (
                      <div key={idx} className="rounded-lg bg-slate-700/40 px-3 py-2">
                        {c.name}: {c.imagePrompt}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </StepCard>

          <StepCard
            step={3}
            title="Panel-by-Panel Script"
            context={
              step2.data ? (
                <div className="text-sm text-gray-200 space-y-1">
                  <p>Main prompts: {step2.data.mainCharacters.slice(0, 2).map((c) => c.imagePrompt).join(' | ')}...</p>
                  <p>Art style: {artStyle}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Approve Step 2 to pass design context.</p>
              )
            }
          >
            {step3.data && (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm text-gray-200">
                  <span className="rounded-lg bg-slate-700/50 px-3 py-2">Pages: {step3.data.totalPages}</span>
                  <span className="rounded-lg bg-slate-700/50 px-3 py-2">Panels/page ≤ {maxPanelsPerPage}</span>
                </div>
                <div className="space-y-3">
                  {step3.data.scripts.map((script) => (
                    <div key={script.pageNumber} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-2">
                      <div className="flex justify-between text-sm text-blue-200 font-semibold">
                        <span>Page {script.pageNumber}</span>
                        <span>{script.layoutSummary}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {script.panels.map((panel) => (
                          <div key={panel.panelNumber} className="rounded-lg bg-slate-700/40 p-3 text-sm text-gray-200">
                            <p className="font-semibold text-blue-300">Panel {panel.panelNumber}</p>
                            <p>{panel.description}</p>
                            <p className="text-xs text-gray-400 mt-1">Prompt: {panel.imagePrompt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </StepCard>

          <StepCard
            step={4}
            title="Image Generation Simulation"
            context={
              step3.data ? (
                <p className="text-sm text-gray-200">Using panel prompts from Step 3 ({step3.data.scripts.length} pages sampled).</p>
              ) : (
                <p className="text-sm text-gray-400">Approve Step 3 to simulate images.</p>
              )
            }
          >
            {step4.data && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {step4.data.images.map((img) => (
                  <div key={img.id} className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden group">
                    <div className="aspect-[3/4] bg-slate-700 flex items-center justify-center">
                      <img
                        src={img.imageUrl}
                        alt={img.prompt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="p-3 text-xs text-gray-200 space-y-1">
                      <p className="font-semibold text-blue-300">Page {img.pageNumber} · Panel {img.panelNumber}</p>
                      <p className="text-gray-400">{img.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </StepCard>
        </div>
      </div>
    </div>
  );
}
