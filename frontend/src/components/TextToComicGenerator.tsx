'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geminiApi, toApiError } from '@/services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type StepKey = 1 | 2 | 3 | 4;

interface StepState<T> {
  data: T | null;
  isLoading: boolean;
  isApproved: boolean;
  locked: boolean;
  error: string | null;
  lastUpdated: string | null;
}

interface Step1Result {
  characterBreakdown: string[];
  analysisMarkdown: string;
  structuredJson: Record<string, unknown> | null;
}

interface Step2Result {
  designMarkdown: string;
  structuredJson: Record<string, unknown> | null;
  aiPrompts: string[];
}

interface Step3Result {
  scriptMarkdown: string;
  structuredJson: Record<string, unknown> | null;
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
  lastUpdated: null,
});

export default function TextToComicGenerator() {
  // Input and configuration
  const [projectId, setProjectId] = useState('three_little_pigs_manga_001');
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyText, setStoryText] = useState('');
  const [mainCharacters, setMainCharacters] = useState('5');
  const [numChapters, setNumChapters] = useState('4');
  const [targetPages, setTargetPages] = useState('100');
  const [mangaGenre, setMangaGenre] = useState('Fantasy/Adventure, Epic tone');
  const [artStyle, setArtStyle] = useState('Japanese manga style, detailed');
  const [maxPanelsPerPage, setMaxPanelsPerPage] = useState('6');
  const [specialRequests, setSpecialRequests] = useState('None');

  // Per-step state
  const [step1, setStep1] = useState<StepState<Step1Result>>(emptyStepState(false));
  const [step2, setStep2] = useState<StepState<Step2Result>>(emptyStepState(true));
  const [step3, setStep3] = useState<StepState<Step3Result>>(emptyStepState(true));
  const [step4, setStep4] = useState<StepState<Step4Result>>(emptyStepState(true));
  const [activeStep, setActiveStep] = useState<StepKey>(1);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [jsonDownloaded, setJsonDownloaded] = useState(false);
  const [lastDownloadedJsonFile, setLastDownloadedJsonFile] = useState<string | null>(null);
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
      .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, limit);

  const getStep1StructuredJson = (): Record<string, unknown> => {
    if (step1.data?.structuredJson) {
      return step1.data.structuredJson;
    }

    return {
      project_id: projectId,
      project_status: 'in_progress',
      user_inputs: {
        story_content: storyText,
        genre: mangaGenre,
        tone: mangaGenre,
        art_style_reference: artStyle,
        max_panels_per_page: Number(maxPanelsPerPage) || 6,
        user_customizations: { special_requests: specialRequests },
      },
      steps: {
        step_1_analysis: {
          status: step1.isApproved ? 'approved' : 'review_pending',
          last_updated: step1.lastUpdated,
          data: {
            analysis_markdown: step1.data?.analysisMarkdown || '',
          },
        },
      },
    };
  };

  const getStep2PromptList = (): string[] => {
    const steps = (step2.data?.structuredJson as any)?.steps;
    const mainDesigns = steps?.step_2_design?.data?.main_characters_designs;
    if (!mainDesigns || typeof mainDesigns !== 'object') {
      return step2.data?.aiPrompts || [];
    }

    return Object.values(mainDesigns)
      .map((entry: any) => entry?.ai_image_prompt_ready)
      .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0);
  };

  const getStep2StructuredJson = (): Record<string, unknown> => {
    if (step2.data?.structuredJson) {
      return step2.data.structuredJson;
    }

    const step1Json = getStep1StructuredJson();
    return {
      ...step1Json,
      steps: {
        ...((step1Json.steps as Record<string, unknown> | undefined) || {}),
        step_2_design: {
          status: step2.isApproved ? 'approved' : step2.isLoading ? 'processing' : 'review_pending',
          last_updated: step2.lastUpdated,
          data: {
            design_markdown: step2.data?.designMarkdown || '',
          },
        },
      },
    };
  };

  const buildStepPayload = async (step: StepKey): Promise<Step1Result | Step2Result | Step3Result | Step4Result> => {
    if (!storyText.trim()) {
      throw new Error('Please provide story text before generating.');
    }

    if (step === 1) {
      const resp = await geminiApi.analyzeStoryStructured({
        project_id: projectId,
        story_text: storyText,
        num_chapters: Number(numChapters) || 3,
        desired_main_characters: Number(mainCharacters) || 5,
        target_total_pages: (targetPages || 'auto').trim() || 'auto',
        genre_tone: mangaGenre || 'Shonen action',
        art_style_reference: artStyle || 'classic black-and-white weekly shonen',
        max_panels_per_page: Number(maxPanelsPerPage) || 6,
        special_requests: specialRequests || 'None',
      });
      const analysis: string = resp.data.analysis || '';
      const breakdown = parseLines(analysis, Math.max(Number(mainCharacters) || 5, 3));
      return {
        characterBreakdown: breakdown.length ? breakdown : ['Character arcs pending parsing.'],
        analysisMarkdown: analysis,
        structuredJson: (resp.data.structured_json as Record<string, unknown>) || null,
      } satisfies Step1Result;
    }

    if (step === 2) {
      const resp = await geminiApi.generateCharacterDesignsStructured({
        project_id: projectId,
        step1_json: getStep1StructuredJson(),
        desired_main_characters: Number(mainCharacters) || 5,
        genre_tone: mangaGenre || 'Shonen action',
        art_style_reference: artStyle || 'classic black-and-white weekly shonen',
        special_requests: specialRequests || 'None',
      });

      const designMarkdown: string = resp.data.design_markdown || '';
      const structuredJson = (resp.data.structured_json as Record<string, unknown>) || null;
      const mainDesigns = ((structuredJson as any)?.steps?.step_2_design?.data?.main_characters_designs || {}) as Record<
        string,
        { ai_image_prompt_ready?: string }
      >;
      const aiPrompts = Object.values(mainDesigns)
        .map((entry) => entry?.ai_image_prompt_ready)
        .filter((prompt): prompt is string => typeof prompt === 'string' && prompt.trim().length > 0);

      return {
        designMarkdown,
        structuredJson,
        aiPrompts,
      } satisfies Step2Result;
    }

    if (step === 3) {
      const step1Json = getStep1StructuredJson();
      const step2Json = getStep2StructuredJson();
      const resp = await geminiApi.generatePanelScriptStructured({
        project_id: projectId,
        step1_json: step1Json,
        step2_json: step2Json,
        num_chapters: Number(numChapters) || 3,
        target_total_pages: (targetPages || 'auto').trim() || 'auto',
        genre_tone: mangaGenre || 'Shonen action',
        art_style_reference: artStyle || 'classic black-and-white weekly shonen',
        max_panels_per_page: Number(maxPanelsPerPage) || 6,
        special_requests: specialRequests || 'None',
      });

      return {
        scriptMarkdown: resp.data.script_markdown || '',
        structuredJson: (resp.data.structured_json as Record<string, unknown>) || null,
      } satisfies Step3Result;
    }

    const step3Context = step3.data?.scriptMarkdown || 'story';
    const prompt = `Provide ${Math.min(8, Number(targetPages) || 8)} concise image prompts for key panels. Style: ${artStyle}. Use context: ${
      parseLines(step3Context, 6).join(' | ') || 'story'
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
      specialRequests,
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

  const step1JsonStatus = () => {
    if (!step1.data) return 'pending';
    if (step1.isApproved) return 'approved';
    if (step1.isLoading) return 'processing';
    return 'review_pending';
  };

  const projectSnapshot = useMemo(() => {
    const fallbackSnapshot = {
      project_id: projectId || 'manga_project_001',
      project_status: step4.isApproved ? 'completed' : 'in_progress',
      user_inputs: {
        story_content: storyText,
        genre: mangaGenre,
        tone: mangaGenre,
        art_style_reference: artStyle,
        max_panels_per_page: Number(maxPanelsPerPage) || 6,
        user_customizations: {
          special_requests: specialRequests,
        },
      },
      steps: step1.data
        ? {
            step_1_analysis: {
              status: step1JsonStatus(),
              last_updated: step1.lastUpdated,
              data: {
                analysis_markdown: step1.data.analysisMarkdown,
                character_breakdown: step1.data.characterBreakdown,
              },
            },
          }
        : {},
    };

    if (!step1.data?.structuredJson && !step2.data?.structuredJson && !step3.data?.structuredJson) {
      return fallbackSnapshot;
    }

    const apiSnapshot =
      (step3.data?.structuredJson as Record<string, unknown>) ||
      (step2.data?.structuredJson as Record<string, unknown>) ||
      (step1.data?.structuredJson as Record<string, unknown>);
    const apiSteps =
      (apiSnapshot.steps as Record<string, unknown> | undefined) ||
      ({} as Record<string, unknown>);
    const apiStep1 =
      (apiSteps.step_1_analysis as Record<string, unknown> | undefined) ||
      ({} as Record<string, unknown>);

    const apiStep2 =
      (apiSteps.step_2_design as Record<string, unknown> | undefined) ||
      ({} as Record<string, unknown>);
    const apiStep3 =
      (apiSteps.step_3_script as Record<string, unknown> | undefined) ||
      ({} as Record<string, unknown>);

    return {
      ...apiSnapshot,
      project_id: projectId || String(apiSnapshot.project_id || 'manga_project_001'),
      project_status: step4.isApproved ? 'completed' : 'in_progress',
      user_inputs: {
        ...(apiSnapshot.user_inputs as Record<string, unknown> | undefined),
        story_content: storyText,
        genre: mangaGenre,
        tone: mangaGenre,
        art_style_reference: artStyle,
        max_panels_per_page: Number(maxPanelsPerPage) || 6,
        user_customizations: {
          ...(((apiSnapshot.user_inputs as any)?.user_customizations as Record<string, unknown>) || {}),
          special_requests: specialRequests,
        },
      },
      steps: {
        ...apiSteps,
        step_1_analysis: {
          ...apiStep1,
          status: step1JsonStatus(),
          last_updated: step1.lastUpdated,
        },
        ...(step2.data
          ? {
              step_2_design: {
                ...apiStep2,
                status: step2.isApproved ? 'approved' : step2.isLoading ? 'processing' : 'review_pending',
                last_updated: step2.lastUpdated,
                data: {
                  ...((apiStep2.data as Record<string, unknown> | undefined) || {}),
                  design_markdown: step2.data.designMarkdown,
                },
              },
            }
          : {}),
        ...(step3.data
          ? {
              step_3_script: {
                ...apiStep3,
                status: step3.isApproved ? 'approved' : step3.isLoading ? 'processing' : 'review_pending',
                last_updated: step3.lastUpdated,
                data: {
                  ...((apiStep3.data as Record<string, unknown> | undefined) || {}),
                  script_markdown: step3.data.scriptMarkdown,
                },
              },
            }
          : {}),
      },
    };
  }, [
    projectId,
    storyText,
    mangaGenre,
    artStyle,
    maxPanelsPerPage,
    specialRequests,
    step1.data,
    step1.isApproved,
    step1.isLoading,
    step1.lastUpdated,
    step2.data,
    step2.isApproved,
    step2.isLoading,
    step2.lastUpdated,
    step3.data,
    step3.isApproved,
    step3.isLoading,
    step3.lastUpdated,
    step4.isApproved,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      `mohiom-project-${projectSnapshot.project_id}`,
      JSON.stringify(projectSnapshot, null, 2)
    );
  }, [projectSnapshot]);

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
      setStepState(step, (prev) => ({
        ...prev,
        data,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
      }));
      setActiveStep(step);
    } catch (err: unknown) {
      const apiError = toApiError(err);
      const retryAfterSeconds = apiError.retryAfterSeconds;
      if (apiError.status === 429 && typeof retryAfterSeconds === 'number') {
        setCooldownUntil((prev) => ({
          ...prev,
          [step]: Date.now() + retryAfterSeconds * 1000,
        }));
      }

      const retryHint =
        apiError.status === 429 && typeof retryAfterSeconds === 'number'
          ? ` Retry in ${Math.ceil(retryAfterSeconds)}s.`
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

    setStepState(step, (prev) => ({
      ...prev,
      isApproved: true,
      locked: true,
      lastUpdated: new Date().toISOString(),
    }));
    const nextStep = (step + 1) as StepKey;
    if (nextStep <= 4) {
      setStepState(nextStep, (prev) => ({ ...prev, locked: false }));
      setActiveStep(nextStep);
    }
  };

  const handleRetry = (step: StepKey) => {
    setStepState(step, (prev) => ({
      ...prev,
      data: null,
      isApproved: false,
      error: null,
      lastUpdated: null,
    }));
    handleGenerate(step);
  };

  const copyProjectJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(projectSnapshot, null, 2));
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 1500);
    } catch {
      setGlobalError('Failed to copy JSON to clipboard.');
    }
  };

  const downloadProjectJson = () => {
    try {
      const safeProjectId = (projectSnapshot.project_id || 'manga_project_001')
        .toString()
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      const now = new Date();
      const y = now.getFullYear().toString();
      const m = (now.getMonth() + 1).toString().padStart(2, '0');
      const d = now.getDate().toString().padStart(2, '0');
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      const versionSuffix = `_${y}${m}${d}_${hh}${mm}`;
      const fileName = `${safeProjectId || 'manga_project_001'}${versionSuffix}.json`;
      const jsonContent = JSON.stringify(projectSnapshot, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      setJsonDownloaded(true);
      setLastDownloadedJsonFile(fileName);
      window.setTimeout(() => setJsonDownloaded(false), 1500);
    } catch {
      setGlobalError('Failed to download JSON file.');
    }
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
      <div className={`min-w-0 rounded-2xl border ${locked ? 'border-slate-800 bg-slate-900/60' : 'border-slate-700 bg-slate-900'} shadow-lg p-6 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${statusBadge(step)}`}>
              {state.isApproved ? '✓' : step}
            </div>
            <div>
              <p className="text-sm text-gray-400">Step {step}</p>
              <h3 className="text-xl font-semibold text-white">{title}</h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
          <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-gray-200 [overflow-wrap:anywhere]">
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
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
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
              <label className="block text-xs text-gray-400 mb-1">Project ID</label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

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

            <div>
              <label className="block text-xs text-gray-400 mb-1">Special Requests</label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="e.g. include 3 splash pages, every chapter ends on a cliffhanger"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white h-20 resize-none"
              />
            </div>

            {globalError && (
              <div className="rounded-lg border border-red-500 bg-red-900/40 px-3 py-2 text-sm text-red-100">
                {globalError}
              </div>
            )}

            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-gray-400">Saved Project JSON (current workflow snapshot)</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadProjectJson}
                    className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-700 text-white hover:bg-blue-600"
                  >
                    {jsonDownloaded ? 'Downloaded' : 'Download JSON'}
                  </button>
                  <button
                    onClick={copyProjectJson}
                    className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-700 text-white hover:bg-slate-600"
                  >
                    {jsonCopied ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
              </div>
              <pre className="text-[11px] leading-5 text-gray-200 whitespace-pre-wrap max-h-64 overflow-auto">
                {JSON.stringify(projectSnapshot, null, 2)}
              </pre>
              {lastDownloadedJsonFile && (
                <p className="text-[11px] text-green-300">
                  Last downloaded: <span className="font-semibold">{lastDownloadedJsonFile}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Steps */}
        <div className="min-w-0 p-8 space-y-6">
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
                  <h4 className="text-sm font-semibold text-gray-100 mb-2">Step 1 API Markdown Response</h4>
                  <div className="max-w-full overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                    <div className="prose prose-invert max-w-none text-sm leading-6 [overflow-wrap:anywhere]">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <div className="w-full overflow-x-auto">
                              <table className="w-full min-w-[560px] table-auto border-collapse text-sm">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-slate-800/80">{children}</thead>,
                          tbody: ({ children }) => <tbody>{children}</tbody>,
                          tr: ({ children }) => <tr className="border-b border-slate-700">{children}</tr>,
                          th: ({ children }) => (
                            <th className="border border-slate-700 px-3 py-2 text-left font-semibold text-gray-100 align-top">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-slate-700 px-3 py-2 text-gray-200 align-top [overflow-wrap:anywhere]">
                              {children}
                            </td>
                          ),
                          pre: ({ children }) => (
                            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{children}</pre>
                          ),
                          code: ({ children }) => <code className="[overflow-wrap:anywhere]">{children}</code>,
                        }}
                      >
                        {step1.data.analysisMarkdown}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </StepCard>

          <StepCard
            step={2}
            title="Character Designs"
            context={
              step1.data ? (
                <div className="text-sm text-gray-200 space-y-1 min-w-0">
                  <p>Chapters: {numChapters} • Genre: {mangaGenre}</p>
                  <p className="[overflow-wrap:anywhere]">Characters: {step1.data.characterBreakdown.slice(0, 3).join('; ')}...</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Approve Step 1 to pass context.</p>
              )
            }
          >
            {step2.data && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-100 mb-2">Step 2 API Markdown Response</h4>
                  <div className="max-w-full overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                    <div className="prose prose-invert max-w-none text-sm leading-6 [overflow-wrap:anywhere]">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <div className="w-full overflow-x-auto">
                              <table className="w-full min-w-[560px] table-auto border-collapse text-sm">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-slate-800/80">{children}</thead>,
                          tbody: ({ children }) => <tbody>{children}</tbody>,
                          tr: ({ children }) => <tr className="border-b border-slate-700">{children}</tr>,
                          th: ({ children }) => (
                            <th className="border border-slate-700 px-3 py-2 text-left font-semibold text-gray-100 align-top">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-slate-700 px-3 py-2 text-gray-200 align-top [overflow-wrap:anywhere]">
                              {children}
                            </td>
                          ),
                          pre: ({ children }) => (
                            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{children}</pre>
                          ),
                          code: ({ children }) => <code className="[overflow-wrap:anywhere]">{children}</code>,
                        }}
                      >
                        {step2.data.designMarkdown}
                      </ReactMarkdown>
                    </div>
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
                <div className="text-sm text-gray-200 space-y-1 min-w-0">
                  <p className="[overflow-wrap:anywhere]">Main prompts: {getStep2PromptList().slice(0, 2).join(' | ') || 'Using Step 2 design context'}...</p>
                  <p>Art style: {artStyle}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Approve Step 2 to pass design context.</p>
              )
            }
          >
            {step3.data && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-100 mb-2">Step 3 API Markdown Response</h4>
                  <div className="max-w-full overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                    <div className="prose prose-invert max-w-none text-sm leading-6 [overflow-wrap:anywhere]">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <div className="w-full overflow-x-auto">
                              <table className="w-full min-w-[560px] table-auto border-collapse text-sm">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-slate-800/80">{children}</thead>,
                          tbody: ({ children }) => <tbody>{children}</tbody>,
                          tr: ({ children }) => <tr className="border-b border-slate-700">{children}</tr>,
                          th: ({ children }) => (
                            <th className="border border-slate-700 px-3 py-2 text-left font-semibold text-gray-100 align-top">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-slate-700 px-3 py-2 text-gray-200 align-top [overflow-wrap:anywhere]">
                              {children}
                            </td>
                          ),
                          pre: ({ children }) => (
                            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{children}</pre>
                          ),
                          code: ({ children }) => <code className="[overflow-wrap:anywhere]">{children}</code>,
                        }}
                      >
                        {step3.data.scriptMarkdown}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </StepCard>

          <StepCard
            step={4}
            title="Image Generation Simulation"
            context={
              step3.data ? (
                <p className="text-sm text-gray-200">Using panel prompts from approved Step 3 script markdown.</p>
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
