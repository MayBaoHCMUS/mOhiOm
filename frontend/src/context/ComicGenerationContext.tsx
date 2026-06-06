'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  geminiApi,
  analyzeStoryStructuredStream,
  characterDesignsStructuredStream,
  panelScriptStructuredStream,
  projectsApi,
  toApiError,
} from '@/services/api';
import type { FullProjectSave, CloudProjectListItem, CharacterSummary } from '@/services/api';

export type StepKey = 1 | 2 | 3 | 4;
export type WizardStepKey = 0 | StepKey;

export type ImageGenMode = 1 | 2 | 3 | 4;

export interface ImageGenSettings {
  mode: ImageGenMode;
  referenceImageBase64: string;
  controlImageBase64: string;
  ipAdapterScale: number;
  controlnetScale: number;
}

export interface StepState<T> {
  data: T | null;
  isLoading: boolean;
  isApproved: boolean;
  locked: boolean;
  error: string | null;
  lastUpdated: string | null;
  /** Live markdown text streamed token-by-token while isLoading=true (step 1 only). */
  streamingText?: string | null;
}

export interface Step1Result {
  characterBreakdown: string[];
  analysisMarkdown: string;
  structuredJson: Record<string, unknown> | null;
}

export interface Step2Result {
  designMarkdown: string;
  structuredJson: Record<string, unknown> | null;
  aiPrompts: string[];
}

export type CharacterImageStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CharacterImageCandidate {
  id: string;
  imageUrl: string;
  createdAt: string;
}

export interface CharacterImageItem {
  characterId: string;
  name: string;
  prompt: string;
  status: CharacterImageStatus;
  error: string | null;
  candidates: CharacterImageCandidate[];
  selectedCandidateId: string | null;
}

export interface CharacterImageReviewResult {
  characters: CharacterImageItem[];
  isGenerating: boolean;
}

export interface Step3Result {
  scriptMarkdown: string;
  structuredJson: Record<string, unknown> | null;
}

export type PanelImageStatus = 'idle' | 'loading' | 'success' | 'error';

export interface Step4Panel {
  id: string;
  pageNumber: number;
  panelNumber: number;
  contextLabel: string;
  dialogueSfx: string;
  aiImagePrompt: string;
}

export interface Step4PanelState {
  status: PanelImageStatus;
  imageUrl: string | null;
  error: string | null;
}

export interface Step4Result {
  panels: Step4Panel[];
  panelStates: Record<string, Step4PanelState>;
  pageStates: Record<string, Step4PanelState>;
  isGenerating: boolean;
}

export interface SetupValidationState {
  isValid: boolean;
  errorCount: number;
  requiredComplete: number;
  requiredTotal: number;
}

type StepData = Step1Result | Step2Result | Step3Result | Step4Result;

interface ApprovedCacheEntry {
  key: string;
  data: StepData;
}

interface Step2CharacterDesign {
  ai_image_prompt_ready?: string;
  name?: string;
}

interface Step2StructuredJson {
  steps?: {
    step_2_design?: {
      data?: {
        main_characters_designs?: Record<string, Step2CharacterDesign>;
      };
    };
    step_2_image_review?: Record<string, unknown>;
  };
}

interface Step1StructuredJson {
  steps?: {
    step_1_analysis?: Record<string, unknown>;
  };
}

interface Step3StructuredJson {
  steps?: {
    step_3_script?: Record<string, unknown>;
  };
}

interface ApiSnapshot {
  project_id?: string;
  user_inputs?: {
    user_customizations?: Record<string, unknown>;
  };
  steps?: Record<string, unknown>;
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Recursively replace base64 data URLs (data:image/…) with a short placeholder
 * so the project snapshot stays within the localStorage 5 MB quota.
 */
const stripBase64 = (obj: unknown): unknown => {
  if (typeof obj === 'string') {
    return obj.startsWith('data:') ? '[image_stripped_for_storage]' : obj;
  }
  if (Array.isArray(obj)) return obj.map(stripBase64);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, stripBase64(v)])
    );
  }
  return obj;
};

const emptyStepState = <T,>(locked: boolean): StepState<T> => ({
  data: null,
  isLoading: false,
  isApproved: false,
  locked,
  error: null,
  lastUpdated: null,
  streamingText: null,
});

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const fetchImageFromAI = async (
  imagePrompt: string,
  localImageApiUrl?: string,
  settings?: ImageGenSettings
): Promise<string> => {
  if (localImageApiUrl) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120000);

    const mode = settings?.mode ?? 1;
    const requestBody: Record<string, unknown> = {
      url: localImageApiUrl,
      prompt: imagePrompt,
      negative_prompt: 'lowres, bad anatomy',
    };
    if ((mode === 2 || mode === 4) && settings?.referenceImageBase64) {
      requestBody.reference_image_base64 = settings.referenceImageBase64;
      requestBody.ip_adapter_scale = settings.ipAdapterScale ?? 0.7;
    }
    if ((mode === 3 || mode === 4) && settings?.controlImageBase64) {
      requestBody.control_image_base64 = settings.controlImageBase64;
      requestBody.controlnet_scale = settings.controlnetScale ?? 0.8;
    }

    console.group('[fetchImageFromAI] Image generation request');
    console.log('Proxy URL   :', '/api/image-proxy');
    console.log('Target URL  :', localImageApiUrl);
    console.log('Mode        :', mode);
    console.log('Request body:', requestBody);

    try {
      const response = await fetch('/api/image-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      console.log('HTTP status :', response.status, response.statusText);

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const serverDetail = errData?.details?.detail ?? errData?.details ?? errData?.error ?? null;
        const detailMsg = typeof serverDetail === 'string' ? serverDetail : JSON.stringify(serverDetail);
        console.error('Error body  :', errData);
        console.groupEnd();
        throw new Error(serverDetail ? `Image API error: ${detailMsg}` : `Image API error (${response.status})`);
      }

      const result = (await response.json()) as { status?: string; image_base64?: string; message?: string };
      console.log('Response    :', {
        status: result.status,
        message: result.message,
        image_base64: result.image_base64
          ? `[base64, ${result.image_base64.length} chars]`
          : undefined,
      });
      console.groupEnd();

      if (result.status !== 'success' || !result.image_base64) {
        throw new Error(result.message || 'Local image API did not return an image.');
      }

      if (result.image_base64.startsWith('data:')) {
        return result.image_base64;
      }

      return `data:image/png;base64,${result.image_base64}`;
    } catch (err) {
      if (!(err instanceof Error && err.message.startsWith('Local image API error'))) {
        console.error('[fetchImageFromAI] Unexpected error:', err);
        console.groupEnd();
      }
      throw err;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  console.warn('[fetchImageFromAI] No localImageApiUrl provided — cannot generate image.');
  throw new Error('Image API URL is not set. Please provide one in Step 1 before generating images.');
};

const parseStep3PanelsFromMarkdown = (markdown: string): Step4Panel[] => {
  const normalized = (markdown || '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) {
    return [];
  }

  type WorkingPanel = {
    pageNumber: number;
    panelNumber: number;
    body: string;
  };

  const workingPanels: WorkingPanel[] = [];
  const lines = normalized.split('\n');
  const pageRegex = /^\s*(?:[-*]\s*)?(?:\*{0,2})?Page\s+(\d+)(?:\s+of\s+Chapter\s+\d+)?(?:\*{0,2})?\s*:?.*$/i;
  const panelRegex = /^\s*(?:[-*]\s*)?(?:\*{0,2})?Panel\s+(\d+)(?:\*{0,2})?\s*:?.*$/i;

  let currentPage = 1;
  let activePanel: WorkingPanel | null = null;

  const flushPanel = () => {
    if (activePanel) {
      workingPanels.push(activePanel);
    }
    activePanel = null;
  };

  for (const line of lines) {
    const pageMatch = line.match(pageRegex);
    if (pageMatch) {
      currentPage = Number(pageMatch[1]) || currentPage;
      flushPanel();
      continue;
    }

    const panelMatch = line.match(panelRegex);
    if (panelMatch) {
      flushPanel();
      activePanel = {
        pageNumber: currentPage,
        panelNumber: Number(panelMatch[1]) || 1,
        body: '',
      };
      continue;
    }

    if (activePanel) {
      activePanel.body += `${line}\n`;
    }
  }
  flushPanel();

  const dialogueRegex =
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?Dialogue(?:\s*\/\s*SFX)?(?:\s*\/\s*Thoughts)?(?:\*{0,2})?\s*:\s*([\s\S]*?)(?=\n\s*(?:[-*]\s*)?(?:\*{0,2})?(?:AI\s*Image\s*Prompt|Panel\s+\d+|Page\s+\d+|Chapter\s+End\s+Notes|Special\s+Pages|Final\s+Script\s+Summary)\b|$)/i;
  const promptRegex =
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?AI\s*Image\s*Prompt(?:\*{0,2})?\s*:\s*([\s\S]*?)(?=\n\s*(?:[-*]\s*)?(?:\*{0,2})?(?:Panel\s+\d+|Page\s+\d+|Chapter\s+End\s+Notes|Special\s+Pages|Final\s+Script\s+Summary)\b|$)/i;

  const parsed = workingPanels
    .map((panel) => {
      const body = panel.body.trim();
      const dialogueSfx = (body.match(dialogueRegex)?.[1] || '').trim();
      const aiImagePrompt = (body.match(promptRegex)?.[1] || '').trim();
      if (!aiImagePrompt) {
        return null;
      }

      const id = `p${panel.pageNumber}-n${panel.panelNumber}`;
      return {
        id,
        pageNumber: panel.pageNumber,
        panelNumber: panel.panelNumber,
        contextLabel: `Page ${panel.pageNumber}, Panel ${panel.panelNumber}`,
        dialogueSfx: dialogueSfx || 'No dialogue/SFX provided.',
        aiImagePrompt,
      } satisfies Step4Panel;
    })
    .filter((item): item is Step4Panel => item !== null);

  if (parsed.length === 0) {
    const promptOnlyRegex =
      /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?AI\s*Image\s*Prompt(?:\*{0,2})?\s*:\s*([\s\S]*?)(?=\n\s*(?:[-*]\s*)?(?:\*{0,2})?(?:AI\s*Image\s*Prompt|Panel\s+\d+|Page\s+\d+|Chapter\s+End\s+Notes|Special\s+Pages|Final\s+Script\s+Summary)\b|$)/gi;
    const prompts = [...normalized.matchAll(promptOnlyRegex)].map((match) => (match[1] || '').trim()).filter(Boolean);
    return prompts.map((prompt, idx) => ({
      id: `p1-n${idx + 1}`,
      pageNumber: 1,
      panelNumber: idx + 1,
      contextLabel: `Page 1, Panel ${idx + 1}`,
      dialogueSfx: 'No dialogue/SFX provided.',
      aiImagePrompt: prompt,
    }));
  }

  return parsed.sort((a, b) => a.pageNumber - b.pageNumber || a.panelNumber - b.panelNumber);
};

const buildComicPagePrompt = (
  panels: Step4Panel[],
  artStyle: string,
  mangaGenre: string,
  characterRefs: Array<{ name: string; prompt: string }>
): string => {
  const parts: string[] = [
    `Comic book page with ${panels.length} panel layout. ${artStyle}. ${mangaGenre}.`,
  ];
  if (characterRefs.length > 0) {
    parts.push(`Characters: ${characterRefs.map(c => `${c.name} — ${c.prompt}`).join('; ')}.`);
  }
  panels.forEach((panel, i) => {
    parts.push(`Panel ${i + 1}: ${panel.aiImagePrompt}`);
  });
  parts.push('Professional comic book artwork, panel borders, clear sequential storytelling.');
  return parts.join('\n');
};

export interface ComicGenerationContextValue {
  projectId: string;
  storyFile: File | null;
  storyText: string;
  mainCharacters: string;
  numChapters: string;
  targetPages: string;
  mangaGenre: string;
  artStyle: string;
  maxPanelsPerPage: string;
  specialRequests: string;
  localImageApiUrl: string;
  imageGenMode: ImageGenMode;
  referenceImageBase64: string;
  controlImageBase64: string;
  ipAdapterScale: number;
  controlnetScale: number;
  useStreaming: boolean;
  step1: StepState<Step1Result>;
  step2: StepState<Step2Result>;
  step2ImageReview: StepState<CharacterImageReviewResult>;
  step3: StepState<Step3Result>;
  step4: StepState<Step4Result>;
  activeStep: WizardStepKey;
  globalError: string | null;
  jsonCopied: boolean;
  jsonDownloaded: boolean;
  lastDownloadedJsonFile: string | null;
  stepMap: Record<StepKey, StepState<unknown>>;
  step4PanelsByPage: Array<[number, Step4Panel[]]>;
  step4Stats: { total: number; success: number; loading: number; error: number };
  projectSnapshot: Record<string, unknown>;
  setupValidation: SetupValidationState | null;
  setupSubmitAttempted: boolean;
  streamingText: string;
  setProjectId: (value: string) => void;
  setStoryFile: (value: File | null) => void;
  setStoryText: (value: string) => void;
  setMainCharacters: (value: string) => void;
  setNumChapters: (value: string) => void;
  setTargetPages: (value: string) => void;
  setMangaGenre: (value: string) => void;
  setArtStyle: (value: string) => void;
  setMaxPanelsPerPage: (value: string) => void;
  setSpecialRequests: (value: string) => void;
  setLocalImageApiUrl: (value: string) => void;
  setImageGenMode: (value: ImageGenMode) => void;
  setReferenceImageBase64: (value: string) => void;
  setControlImageBase64: (value: string) => void;
  setIpAdapterScale: (value: number) => void;
  setControlnetScale: (value: number) => void;
  setUseStreaming: (value: boolean) => void;
  setActiveStep: (value: WizardStepKey) => void;
  setSetupValidation: (value: SetupValidationState) => void;
  setSetupSubmitAttempted: (value: boolean) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGenerate: (step: StepKey) => Promise<void>;
  handleApprove: (step: StepKey) => void;
  handleRetry: (step: StepKey) => void;
  handleGenerateCharacterReferences: (settingsMap?: Record<string, ImageGenSettings>) => Promise<void>;
  handleRegenerateCharacterImage: (characterId: string, settings?: ImageGenSettings) => Promise<void>;
  handleSelectCharacterCandidate: (characterId: string, candidateId: string) => void;
  handleApproveCharacterReferences: () => void;
  handleRetryCharacterReferences: () => void;
  handleStartFullGeneration: () => Promise<void>;
  handleRegeneratePage: (pageNumber: number) => Promise<void>;
  copyProjectJson: () => Promise<void>;
  downloadProjectJson: () => void;
  getStep2PromptList: () => string[];
  getSelectedCharacterReferences: () => Array<{
    character_id: string;
    name: string;
    image_url: string;
    prompt: string;
  }>;
  getCooldownSeconds: (step: StepKey) => number;
  loadMockStepData: (step: StepKey) => void;
  loadMockCharacterReview: () => void;
  loadMockPipeline: () => void;
  loadProjectJson: (json: Record<string, unknown>) => { success: boolean; error?: string };
  cloudSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  cloudSaveError: string | null;
  saveToCloud: () => Promise<void>;
  loadFromCloud: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  listCloudProjects: () => Promise<CloudProjectListItem[]>;
  injectLibraryCharacters: (chars: CharacterSummary[]) => void;
  fromStorySetup: boolean;
  setFromStorySetup: (v: boolean) => void;
  fieldsAutoFilledFromAnalysis: boolean;
  storySetupAnalysisResult: {
    sceneBeats: number;
    chars: string[];
    tone: string[];
    panels: number;
  } | null;
}

const ComicGenerationContext = createContext<ComicGenerationContextValue | null>(null);

export function ComicGenerationProvider({ children }: { children: React.ReactNode }) {
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
  const [localImageApiUrl, setLocalImageApiUrl] = useState('');
  const [imageGenMode, setImageGenMode] = useState<ImageGenMode>(1);
  const [referenceImageBase64, setReferenceImageBase64] = useState('');
  const [controlImageBase64, setControlImageBase64] = useState('');
  const [ipAdapterScale, setIpAdapterScale] = useState(0.7);
  const [controlnetScale, setControlnetScale] = useState(0.8);
  const [useStreaming, setUseStreaming] = useState(true);
  const [setupValidation, setSetupValidation] = useState<SetupValidationState | null>(null);
  const [setupSubmitAttempted, setSetupSubmitAttempted] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [cloudSaveStatus, setCloudSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cloudSaveError, setCloudSaveError] = useState<string | null>(null);
  const [fromStorySetup, setFromStorySetup] = useState(false);
  const [fieldsAutoFilledFromAnalysis, setFieldsAutoFilledFromAnalysis] = useState(false);
  const [storySetupAnalysisResult, setStorySetupAnalysisResult] = useState<{
    sceneBeats: number;
    chars: string[];
    tone: string[];
    panels: number;
  } | null>(null);

  const [step1, setStep1] = useState<StepState<Step1Result>>(emptyStepState(false));
  const [step2, setStep2] = useState<StepState<Step2Result>>(emptyStepState(true));
  const [step2ImageReview, setStep2ImageReview] = useState<StepState<CharacterImageReviewResult>>(
    emptyStepState<CharacterImageReviewResult>(true)
  );
  const [step3, setStep3] = useState<StepState<Step3Result>>(emptyStepState(true));
  const [step4, setStep4] = useState<StepState<Step4Result>>(emptyStepState(true));
  const [activeStep, setActiveStep] = useState<WizardStepKey>(0);
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

  // Auto-load a project queued from the dashboard via localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pending = window.localStorage.getItem('mohiom-pending-load');
    if (!pending) return;
    window.localStorage.removeItem('mohiom-pending-load');
    projectsApi.load(pending).then((res) => {
      restoreFromFullSave(res.data as unknown as Record<string, unknown>);
    }).catch(() => { /* silently ignore if project was deleted */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill fields from story-setup page when user clicks "Next" there.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('mohiom-story-setup');
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (saved.storyText) setStoryText(String(saved.storyText));
      if (saved.genre)     setMangaGenre(String(saved.genre));
      if (saved.projectId) setProjectId(String(saved.projectId));
      setFromStorySetup(true);

      // Explicit production targets from Advanced Setup take priority over analysis-derived values.
      const hasExplicitTargets = saved.mainCharacters || saved.numChapters || saved.targetPages || saved.maxPanelsPerPage;
      if (hasExplicitTargets) {
        if (saved.mainCharacters)  setMainCharacters(String(saved.mainCharacters));
        if (saved.numChapters)     setNumChapters(String(saved.numChapters));
        if (saved.targetPages)     setTargetPages(String(saved.targetPages));
        if (saved.maxPanelsPerPage) setMaxPanelsPerPage(String(saved.maxPanelsPerPage));
      }

      // Auto-fill creative targets from Story Setup AI analysis (if analysis was run there
      // and user did not set explicit targets in Advanced Setup).
      if (saved.analysisResult && typeof saved.analysisResult === 'object') {
        const ar = saved.analysisResult as Record<string, unknown>;
        const chars    = Array.isArray(ar.chars)  ? (ar.chars  as string[]) : [];
        const beats    = typeof ar.sceneBeats === 'number' ? ar.sceneBeats : 0;
        const panels   = typeof ar.panels    === 'number' ? ar.panels    : 0;
        const tone     = Array.isArray(ar.tone)   ? (ar.tone   as string[]) : [];

        if (!hasExplicitTargets) {
          if (chars.length > 0)  setMainCharacters(String(chars.length));
          if (beats > 0)         setNumChapters(String(Math.max(1, Math.min(50, Math.ceil(beats / 4)))));
          if (panels > 0)        setTargetPages(String(Math.max(10, Math.min(500, Math.round(panels / 5)))));
          setMaxPanelsPerPage('5');
        }

        setStorySetupAnalysisResult({ sceneBeats: beats, chars, tone, panels });
        setFieldsAutoFilledFromAnalysis(true);
      }
    } catch { /* malformed — silently ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem('mohiom-image-api-url');
    if (stored) {
      setLocalImageApiUrl(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localImageApiUrl.trim()) {
      window.sessionStorage.removeItem('mohiom-image-api-url');
      return;
    }
    window.sessionStorage.setItem('mohiom-image-api-url', localImageApiUrl.trim());
  }, [localImageApiUrl]);

  const stepMap: Record<StepKey, StepState<unknown>> = useMemo(
    () => ({ 1: step1, 2: step2, 3: step3, 4: step4 }),
    [step1, step2, step3, step4]
  );

  const extractStep2Characters = (): CharacterImageItem[] => {
    const structured = (step2.data?.structuredJson as Step2StructuredJson | null) || null;
    const mainDesigns = structured?.steps?.step_2_design?.data?.main_characters_designs || {};

    const fromStructured = Object.entries(mainDesigns)
      .map(([characterId, raw], index) => {
        const prompt = typeof raw?.ai_image_prompt_ready === 'string' ? raw.ai_image_prompt_ready.trim() : '';
        if (!prompt) return null;

        const name = (typeof raw?.name === 'string' && raw.name.trim()) || `Character ${index + 1}`;

        return {
          characterId,
          name,
          prompt,
          status: 'idle' as CharacterImageStatus,
          error: null,
          candidates: [],
          selectedCandidateId: null,
        } as CharacterImageItem;
      })
      .filter((entry): entry is CharacterImageItem => entry !== null);

    if (fromStructured.length > 0) {
      return fromStructured;
    }

    const markdown = step2.data?.designMarkdown || '';
    const normalized = markdown.replace(/\r\n?/g, '\n');
    const characterBlocks = [
      ...normalized.matchAll(
        /^###\s+Character\s+\d+\s*:\s*(.+?)\s*$([\s\S]*?)(?=^###\s+Character\s+\d+\s*:|^##\s+\d+\.|$)/gim
      ),
    ];

    const fallbackCharacters = characterBlocks
      .map((match, index) => {
        const name = (match[1] || '').trim();
        const body = match[2] || '';
        const promptMatch = body.match(
          /AI\s*Image\s*Prompt\s*Ready\s*:\s*([\s\S]*?)(?=\n\s*\*\s*\*|\n\s*###|\n\s*##|$)/i
        );
        const prompt = (promptMatch?.[1] || '').trim();
        if (!name || !prompt) return null;

        const characterId =
          name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || `character_${index + 1}`;

        return {
          characterId,
          name,
          prompt,
          status: 'idle' as CharacterImageStatus,
          error: null,
          candidates: [],
          selectedCandidateId: null,
        } as CharacterImageItem;
      })
      .filter((entry): entry is CharacterImageItem => entry !== null);

    return fallbackCharacters;
  };

  const getSelectedCharacterReferences = useCallback((): Array<{
    character_id: string;
    name: string;
    image_url: string;
    prompt: string;
  }> => {
    if (!step2ImageReview.data) return [];

    return step2ImageReview.data.characters
      .map((character) => {
        const selected = character.candidates.find((candidate) => candidate.id === character.selectedCandidateId);
        if (!selected) return null;

        return {
          character_id: character.characterId,
          name: character.name,
          image_url: selected.imageUrl,
          prompt: character.prompt,
        };
      })
      .filter(
        (
          entry
        ): entry is {
          character_id: string;
          name: string;
          image_url: string;
          prompt: string;
        } => entry !== null
      );
  }, [step2ImageReview.data]);

  const setStepState = (step: StepKey, updater: (prev: StepState<unknown>) => StepState<unknown>) => {
    if (step === 1) setStep1((prev) => updater(prev as StepState<unknown>) as StepState<Step1Result>);
    if (step === 2) setStep2((prev) => updater(prev as StepState<unknown>) as StepState<Step2Result>);
    if (step === 3) setStep3((prev) => updater(prev as StepState<unknown>) as StepState<Step3Result>);
    if (step === 4) setStep4((prev) => updater(prev as StepState<unknown>) as StepState<Step4Result>);
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
    const structured = (step2.data?.structuredJson as Step2StructuredJson | null) || null;
    const mainDesigns = structured?.steps?.step_2_design?.data?.main_characters_designs;
    if (!mainDesigns || typeof mainDesigns !== 'object') {
      return step2.data?.aiPrompts || [];
    }

    return Object.values(mainDesigns)
      .map((entry) => entry?.ai_image_prompt_ready)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  };

  const getStep2StructuredJson = (): Record<string, unknown> => {
    const selectedReferences = getSelectedCharacterReferences();

    if (step2.data?.structuredJson) {
      const cloned = JSON.parse(JSON.stringify(step2.data.structuredJson)) as Record<string, unknown>;
      const steps = toRecord(cloned.steps);
      const step2Design = toRecord(steps.step_2_design);
      const step2Data = toRecord(step2Design.data);
      const mainDesigns = toRecord(step2Data.main_characters_designs);

      selectedReferences.forEach((reference) => {
        const existing = toRecord(mainDesigns[reference.character_id]);
        mainDesigns[reference.character_id] = {
          ...existing,
          selected_reference_image_url: reference.image_url,
          selected_reference_prompt: reference.prompt,
        };
      });

      step2Data.main_characters_designs = mainDesigns;
      step2Data.selected_character_references = selectedReferences;
      step2Design.data = step2Data;
      steps.step_2_design = step2Design;
      cloned.steps = steps;
      return cloned;
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
            selected_character_references: selectedReferences,
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
      if (useStreaming) {
        return new Promise((resolve, reject) => {
          setStreamingText('');
          let analysisMarkdown = '';

          geminiApi.analyzeStoryStructuredStream(
            {
              project_id: projectId,
              story_text: storyText,
              num_chapters: Number(numChapters) || 3,
              desired_main_characters: Number(mainCharacters) || 5,
              target_total_pages: (targetPages || 'auto').trim() || 'auto',
              genre_tone: mangaGenre || 'Shonen action',
              art_style_reference: artStyle || 'classic black-and-white weekly shonen',
              max_panels_per_page: Number(maxPanelsPerPage) || 6,
              special_requests: specialRequests || 'None',
            },
            (chunk) => {
              analysisMarkdown += chunk;
              setStreamingText(analysisMarkdown);
            },
            (structuredJson) => {
              const breakdown = parseLines(analysisMarkdown, Math.max(Number(mainCharacters) || 5, 3));
              resolve({
                characterBreakdown: breakdown.length ? breakdown : ['Character arcs pending parsing.'],
                analysisMarkdown,
                structuredJson: structuredJson || null,
              } satisfies Step1Result);
            },
            (error) => {
              reject(new Error(error));
            }
          );
        });
      } else {
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
    }

    if (step === 2) {
      if (useStreaming) {
        return new Promise((resolve, reject) => {
          setStreamingText('');
          let designMarkdown = '';

          geminiApi.generateCharacterDesignsStructuredStream(
            {
              project_id: projectId,
              step1_json: getStep1StructuredJson(),
              desired_main_characters: Number(mainCharacters) || 5,
              genre_tone: mangaGenre || 'Shonen action',
              art_style_reference: artStyle || 'classic black-and-white weekly shonen',
              special_requests: specialRequests || 'None',
            },
            (chunk) => {
              designMarkdown += chunk;
              setStreamingText(designMarkdown);
            },
            (structuredJson) => {
              const structured = structuredJson as Step2StructuredJson | null;
              const mainDesigns = structured?.steps?.step_2_design?.data?.main_characters_designs || {};
              const aiPrompts = Object.values(mainDesigns)
                .map((entry) => entry?.ai_image_prompt_ready)
                .filter((prompt): prompt is string => typeof prompt === 'string' && prompt.trim().length > 0);

              resolve({
                designMarkdown,
                structuredJson,
                aiPrompts,
              } satisfies Step2Result);
            },
            (error) => {
              reject(new Error(error));
            }
          );
        });
      } else {
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
        const structured = structuredJson as Step2StructuredJson | null;
        const mainDesigns = structured?.steps?.step_2_design?.data?.main_characters_designs || {};
        const aiPrompts = Object.values(mainDesigns)
          .map((entry) => entry?.ai_image_prompt_ready)
          .filter((prompt): prompt is string => typeof prompt === 'string' && prompt.trim().length > 0);

        return {
          designMarkdown,
          structuredJson,
          aiPrompts,
        } satisfies Step2Result;
      }
    }

    if (step === 3) {
      const step1Json = getStep1StructuredJson();
      const step2Json = getStep2StructuredJson();

      if (useStreaming) {
        return new Promise((resolve, reject) => {
          setStreamingText('');
          let scriptMarkdown = '';

          geminiApi.generatePanelScriptStructuredStream(
            {
              project_id: projectId,
              step1_json: step1Json,
              step2_json: step2Json,
              num_chapters: Number(numChapters) || 3,
              target_total_pages: (targetPages || 'auto').trim() || 'auto',
              genre_tone: mangaGenre || 'Shonen action',
              art_style_reference: artStyle || 'classic black-and-white weekly shonen',
              max_panels_per_page: Number(maxPanelsPerPage) || 6,
              special_requests: specialRequests || 'None',
            },
            (chunk) => {
              scriptMarkdown += chunk;
              setStreamingText(scriptMarkdown);
            },
            (structuredJson) => {
              resolve({
                scriptMarkdown,
                structuredJson: structuredJson || null,
              } satisfies Step3Result);
            },
            (error) => {
              reject(new Error(error));
            }
          );
        });
      } else {
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
    }

    const step3Markdown = step3.data?.scriptMarkdown || '';
    const panels = parseStep3PanelsFromMarkdown(step3Markdown);
    if (!panels.length) {
      throw new Error('No AI Image Prompt blocks found in Step 3 output. Please regenerate Step 3 with panel prompts.');
    }

    const panelStates: Record<string, Step4PanelState> = {};
    panels.forEach((panel) => {
      panelStates[panel.id] = { status: 'idle', imageUrl: null, error: null };
    });

    const pageNumbers = [...new Set(panels.map((p) => p.pageNumber))];
    const pageStates: Record<string, Step4PanelState> = {};
    pageNumbers.forEach((pageNumber) => {
      pageStates[`page-${pageNumber}`] = { status: 'idle', imageUrl: null, error: null };
    });

    return {
      panels,
      panelStates,
      pageStates,
      isGenerating: false,
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

  const step1JsonStatus = useCallback(() => {
    if (!step1.data) return 'pending';
    if (step1.isApproved) return 'approved';
    if (step1.isLoading) return 'processing';
    return 'review_pending';
  }, [step1.data, step1.isApproved, step1.isLoading]);

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
      ((step3.data?.structuredJson as Step3StructuredJson | null) ||
        (step2.data?.structuredJson as Step2StructuredJson | null) ||
        (step1.data?.structuredJson as Step1StructuredJson | null) ||
        {}) as ApiSnapshot;
    const apiSteps = toRecord(apiSnapshot.steps);
    const apiStep1 = toRecord(apiSteps.step_1_analysis);

    const apiStep2 = toRecord(apiSteps.step_2_design);
    const apiStep2ImageReview = toRecord(apiSteps.step_2_image_review);
    const apiStep3 = toRecord(apiSteps.step_3_script);
    const apiUserInputs = toRecord(apiSnapshot.user_inputs);
    const apiUserCustomizations = toRecord(apiUserInputs.user_customizations);

    return {
      ...apiSnapshot,
      project_id: projectId || String(apiSnapshot.project_id || 'manga_project_001'),
      project_status: step4.isApproved ? 'completed' : 'in_progress',
      user_inputs: {
        ...apiUserInputs,
        story_content: storyText,
        genre: mangaGenre,
        tone: mangaGenre,
        art_style_reference: artStyle,
        max_panels_per_page: Number(maxPanelsPerPage) || 6,
        user_customizations: {
          ...apiUserCustomizations,
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
                  ...toRecord(apiStep2.data),
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
                  ...toRecord(apiStep3.data),
                  script_markdown: step3.data.scriptMarkdown,
                },
              },
            }
          : {}),
        ...(step2ImageReview.data
          ? {
              step_2_image_review: {
                ...apiStep2ImageReview,
                status: step2ImageReview.isApproved
                  ? 'approved'
                  : step2ImageReview.isLoading
                    ? 'processing'
                    : 'review_pending',
                last_updated: step2ImageReview.lastUpdated,
                data: {
                  selected_character_references: getSelectedCharacterReferences(),
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
    step1.lastUpdated,
    step2.data,
    step2.isApproved,
    step2.isLoading,
    step2.lastUpdated,
    step2ImageReview.data,
    step2ImageReview.isApproved,
    step2ImageReview.isLoading,
    step2ImageReview.lastUpdated,
    step3.data,
    step3.isApproved,
    step3.isLoading,
    step3.lastUpdated,
    step4.isApproved,
    getSelectedCharacterReferences,
    step1JsonStatus,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Strip base64 image data before saving — images can be 300 KB–1 MB each
      // and will quickly exceed the 5 MB localStorage quota.
      const stripped = stripBase64(projectSnapshot);
      window.localStorage.setItem(
        `mohiom-project-${projectSnapshot.project_id}`,
        JSON.stringify(stripped, null, 2)
      );
    } catch (err) {
      // QuotaExceededError or SecurityError — log and continue; don't crash the app.
      console.warn('[localStorage] Could not save project snapshot:', err);
    }
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
      setStepState(step, (prev) => ({ ...prev, data: cached.data, error: null, streamingText: null }));
      setActiveStep(step);
      return;
    }

    if (step === 2) {
      setStep2ImageReview(emptyStepState<CharacterImageReviewResult>(true));
      setStep3((prev) => ({ ...prev, locked: true, isApproved: false }));
      setStep4((prev) => ({ ...prev, locked: true, isApproved: false }));
    }

    setGlobalError(null);
    setStepState(step, (prev) => ({ ...prev, isLoading: true, error: null, streamingText: null }));

    // ── Step 1: stream analysis tokens so the user sees text in real-time ──
    if (step === 1) {
      await new Promise<void>((resolve) => {
        analyzeStoryStructuredStream(
          {
            project_id: projectId,
            story_text: storyText,
            num_chapters: Number(numChapters) || 3,
            desired_main_characters: Number(mainCharacters) || 5,
            target_total_pages: (targetPages || 'auto').trim() || 'auto',
            genre_tone: mangaGenre || 'Shonen action',
            art_style_reference: artStyle || 'classic black-and-white weekly shonen',
            max_panels_per_page: Number(maxPanelsPerPage) || 6,
            special_requests: specialRequests || 'None',
          },
          {
            onToken(token) {
              setStep1((prev) => ({
                ...prev,
                streamingText: (prev.streamingText ?? '') + token,
              }));
            },
            onDone(result) {
              const analysis = result.analysis || '';
              const breakdown = analysis
                .split(/\r?\n+/)
                .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
                .filter(Boolean)
                .slice(0, Math.max(Number(mainCharacters) || 5, 3));
              setStep1({
                data: {
                  characterBreakdown: breakdown.length ? breakdown : ['Character arcs pending parsing.'],
                  analysisMarkdown: analysis,
                  structuredJson: (result.structured_json as Record<string, unknown>) || null,
                },
                isLoading: false,
                isApproved: false,
                locked: false,
                error: null,
                lastUpdated: new Date().toISOString(),
                streamingText: null,
              });
              setActiveStep(1);
              resolve();
            },
            onError(message, statusCode) {
              if (statusCode === 429) {
                // Estimate a cooldown from the message if possible
                const match = message.match(/(\d+(?:\.\d+)?)\s*s/);
                const retryAfterSeconds = match ? parseFloat(match[1]) : 30;
                setCooldownUntil((prev) => ({
                  ...prev,
                  1: Date.now() + retryAfterSeconds * 1000,
                }));
              }
              setStep1((prev) => ({
                ...prev,
                isLoading: false,
                streamingText: null,
                error: message,
              }));
              resolve();
            },
          },
        );
      });
      return;
    }

    // ── Step 2: stream character design sheet ────────────────────────────────
    if (step === 2) {
      await new Promise<void>((resolve) => {
        characterDesignsStructuredStream(
          {
            project_id: projectId,
            step1_json: getStep1StructuredJson(),
            desired_main_characters: Number(mainCharacters) || 5,
            genre_tone: mangaGenre || 'Shonen action',
            art_style_reference: artStyle || 'classic black-and-white weekly shonen',
            special_requests: specialRequests || 'None',
          },
          {
            onToken(token) {
              setStep2((prev) => ({ ...prev, streamingText: (prev.streamingText ?? '') + token }));
            },
            onDone(result) {
              const designMarkdown = result.design_markdown || '';
              const structuredJson = (result.structured_json as Record<string, unknown>) || null;
              const structured = structuredJson as { steps?: { step_2_design?: { data?: { main_characters_designs?: Record<string, { ai_image_prompt_ready?: string }> } } } } | null;
              const mainDesigns = structured?.steps?.step_2_design?.data?.main_characters_designs || {};
              const aiPrompts = Object.values(mainDesigns)
                .map((e) => e?.ai_image_prompt_ready)
                .filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
              setStep2({
                data: { designMarkdown, structuredJson, aiPrompts },
                isLoading: false, isApproved: false, locked: false,
                error: null, lastUpdated: new Date().toISOString(), streamingText: null,
              });
              setStep2ImageReview((prev) => ({ ...prev, locked: false }));
              setActiveStep(2);
              resolve();
            },
            onError(message, statusCode) {
              if (statusCode === 429) {
                const match = message.match(/(\d+(?:\.\d+)?)\s*s/);
                setCooldownUntil((prev) => ({ ...prev, 2: Date.now() + (match ? parseFloat(match[1]) : 30) * 1000 }));
              }
              setStep2((prev) => ({ ...prev, isLoading: false, streamingText: null, error: message }));
              resolve();
            },
          },
        );
      });
      return;
    }

    // ── Step 3: stream panel script ───────────────────────────────────────────
    if (step === 3) {
      await new Promise<void>((resolve) => {
        panelScriptStructuredStream(
          {
            project_id: projectId,
            step1_json: getStep1StructuredJson(),
            step2_json: getStep2StructuredJson(),
            num_chapters: Number(numChapters) || 3,
            target_total_pages: (targetPages || 'auto').trim() || 'auto',
            genre_tone: mangaGenre || 'Shonen action',
            art_style_reference: artStyle || 'classic black-and-white weekly shonen',
            max_panels_per_page: Number(maxPanelsPerPage) || 6,
            special_requests: specialRequests || 'None',
          },
          {
            onToken(token) {
              setStep3((prev) => ({ ...prev, streamingText: (prev.streamingText ?? '') + token }));
            },
            onDone(result) {
              setStep3({
                data: {
                  scriptMarkdown: result.script_markdown || '',
                  structuredJson: (result.structured_json as Record<string, unknown>) || null,
                },
                isLoading: false, isApproved: false, locked: false,
                error: null, lastUpdated: new Date().toISOString(), streamingText: null,
              });
              setStep4((prev) => ({ ...prev, locked: false }));
              setActiveStep(3);
              resolve();
            },
            onError(message, statusCode) {
              if (statusCode === 429) {
                const match = message.match(/(\d+(?:\.\d+)?)\s*s/);
                setCooldownUntil((prev) => ({ ...prev, 3: Date.now() + (match ? parseFloat(match[1]) : 30) * 1000 }));
              }
              setStep3((prev) => ({ ...prev, isLoading: false, streamingText: null, error: message }));
              resolve();
            },
          },
        );
      });
      return;
    }

    // ── Step 4: build panel list from step 3 markdown (no LLM call) ──────────
    try {
      const data = await buildStepPayload(step);
      setStepState(step, (prev) => ({
        ...prev, data, isLoading: false, lastUpdated: new Date().toISOString(), streamingText: null,
      }));
      setActiveStep(step);
    } catch (err: unknown) {
      const apiError = toApiError(err);
      const retryAfterSeconds = apiError.retryAfterSeconds;
      if (apiError.status === 429 && typeof retryAfterSeconds === 'number') {
        setCooldownUntil((prev) => ({ ...prev, [step]: Date.now() + retryAfterSeconds * 1000 }));
      }
      const retryHint = apiError.status === 429 && typeof retryAfterSeconds === 'number'
        ? ` Retry in ${Math.ceil(retryAfterSeconds)}s.` : '';
      setStepState(step, (prev) => ({
        ...prev, isLoading: false, streamingText: null,
        error: `${apiError.message}${retryHint}`.trim(),
      }));
    }
  };

  const handleApprove = (step: StepKey) => {
    const cacheKey = getStepCacheKey(step);
    const data = stepMap[step].data;
    if (data) {
      approvedCacheRef.current[step] = { key: cacheKey, data: data as StepData };
    }

    setStepState(step, (prev) => ({
      ...prev,
      isApproved: true,
      locked: true,
      lastUpdated: new Date().toISOString(),
    }));

    if (step === 2) {
      setStep2ImageReview((prev) => ({ ...prev, locked: false }));
      return;
    }

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

  const handleGenerateCharacterReferences = async (settingsMap?: Record<string, ImageGenSettings>) => {
    if (step2ImageReview.locked || step2ImageReview.isLoading || !step2.data) return;

    const characters = extractStep2Characters();
    if (!characters.length) {
      setStep2ImageReview((prev) => ({
        ...prev,
        error: 'No character prompts found in Step 2 structured JSON.',
      }));
      return;
    }

    setStep2ImageReview((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      data: {
        characters,
        isGenerating: true,
      },
    }));

    const generatedCharacters = await Promise.all(
      characters.map(async (character) => {
        try {
          const charSettings = settingsMap?.[character.characterId] ?? { mode: imageGenMode, referenceImageBase64, controlImageBase64, ipAdapterScale, controlnetScale };
          const imageUrl = await fetchImageFromAI(character.prompt, localImageApiUrl || undefined, charSettings);
          const candidateId = `${character.characterId}-${Date.now()}`;
          return {
            ...character,
            status: 'success' as const,
            candidates: [
              {
                id: candidateId,
                imageUrl,
                createdAt: new Date().toISOString(),
              },
            ],
            selectedCandidateId: candidateId,
          };
        } catch (error) {
          return {
            ...character,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Failed to generate image.',
          };
        }
      })
    );

    setStep2ImageReview((prev) => ({
      ...prev,
      isLoading: false,
      lastUpdated: new Date().toISOString(),
      data: {
        characters: generatedCharacters,
        isGenerating: false,
      },
    }));
  };

  const handleRegenerateCharacterImage = async (characterId: string, settings?: ImageGenSettings) => {
    if (!step2ImageReview.data || step2ImageReview.data.isGenerating) return;
    const target = step2ImageReview.data.characters.find((character) => character.characterId === characterId);
    if (!target) return;

    setStep2ImageReview((prev) => {
      if (!prev.data) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          isGenerating: true,
          characters: prev.data.characters.map((character) =>
            character.characterId === characterId
              ? { ...character, status: 'loading', error: null }
              : character
          ),
        },
      };
    });

    try {
      const effectiveSettings = settings ?? { mode: imageGenMode, referenceImageBase64, controlImageBase64, ipAdapterScale, controlnetScale };
      const imageUrl = await fetchImageFromAI(target.prompt, localImageApiUrl || undefined, effectiveSettings);
      const candidateId = `${target.characterId}-${Date.now()}`;

      setStep2ImageReview((prev) => {
        if (!prev.data) return prev;
        return {
          ...prev,
          lastUpdated: new Date().toISOString(),
          data: {
            ...prev.data,
            isGenerating: false,
            characters: prev.data.characters.map((character) =>
              character.characterId === characterId
                ? {
                    ...character,
                    status: 'success',
                    error: null,
                    candidates: [
                      ...character.candidates,
                      {
                        id: candidateId,
                        imageUrl,
                        createdAt: new Date().toISOString(),
                      },
                    ],
                    selectedCandidateId: candidateId,
                  }
                : character
            ),
          },
        };
      });
    } catch (error) {
      setStep2ImageReview((prev) => {
        if (!prev.data) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            isGenerating: false,
            characters: prev.data.characters.map((character) =>
              character.characterId === characterId
                ? {
                    ...character,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Failed to regenerate image.',
                  }
                : character
            ),
          },
        };
      });
    }
  };

  const handleSelectCharacterCandidate = (characterId: string, candidateId: string) => {
    setStep2ImageReview((prev) => {
      if (!prev.data) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          characters: prev.data.characters.map((character) =>
            character.characterId === characterId ? { ...character, selectedCandidateId: candidateId } : character
          ),
        },
      };
    });
  };

  const handleApproveCharacterReferences = () => {
    if (!step2ImageReview.data) return;
    const missing = step2ImageReview.data.characters.filter((character) => !character.selectedCandidateId);
    if (missing.length) {
      setStep2ImageReview((prev) => ({
        ...prev,
        error: 'Please select one final image for every character before approving.',
      }));
      return;
    }

    setStep2ImageReview((prev) => ({
      ...prev,
      isApproved: true,
      locked: true,
      error: null,
      lastUpdated: new Date().toISOString(),
    }));
    setStep3((prev) => ({ ...prev, locked: false }));
    setActiveStep(3);
  };

  const handleRetryCharacterReferences = () => {
    setStep2ImageReview((prev) => ({
      ...prev,
      data: null,
      isApproved: false,
      isLoading: false,
      error: null,
      lastUpdated: null,
    }));
    setStep3((prev) => ({ ...prev, locked: true }));
  };

  const generatePanelImages = async (
    panelsArray: Step4Panel[],
    options?: { batchSize?: number; delayMs?: number }
  ) => {
    const batchSize = Math.max(1, options?.batchSize ?? 2);
    const delayMs = Math.max(0, options?.delayMs ?? 10000);

    for (let i = 0; i < panelsArray.length; i += batchSize) {
      const batch = panelsArray.slice(i, i + batchSize);

      setStep4((prev) => {
        if (!prev.data) return prev;
        const nextStates = { ...prev.data.panelStates };
        batch.forEach((panel) => {
          const prevState = nextStates[panel.id];
          nextStates[panel.id] = {
            status: 'loading',
            imageUrl: prevState?.imageUrl || null,
            error: null,
          };
        });
        return {
          ...prev,
          data: {
            ...prev.data,
            panelStates: nextStates,
          },
        };
      });

      const results = await Promise.all(
        batch.map(async (panel) => {
          try {
            const imageUrl = await fetchImageFromAI(panel.aiImagePrompt, localImageApiUrl || undefined, { mode: imageGenMode, referenceImageBase64, controlImageBase64, ipAdapterScale, controlnetScale });
            return {
              id: panel.id,
              status: 'success' as const,
              imageUrl,
              error: null,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Image generation failed.';
            return {
              id: panel.id,
              status: 'error' as const,
              imageUrl: null,
              error: message,
            };
          }
        })
      );

      setStep4((prev) => {
        if (!prev.data) return prev;
        const nextStates = { ...prev.data.panelStates };
        results.forEach((result) => {
          nextStates[result.id] = {
            status: result.status,
            imageUrl: result.imageUrl,
            error: result.error,
          };
        });
        return {
          ...prev,
          data: {
            ...prev.data,
            panelStates: nextStates,
          },
          lastUpdated: new Date().toISOString(),
        };
      });

      const hasMore = i + batchSize < panelsArray.length;
      if (hasMore) {
        await sleep(delayMs);
      }
    }
  };

  const generatePageImages = async (
    pageEntries: Array<[number, Step4Panel[]]>,
    options?: { batchSize?: number; delayMs?: number }
  ) => {
    const batchSize = Math.max(1, options?.batchSize ?? 1);
    const delayMs = Math.max(0, options?.delayMs ?? 10000);
    const characterRefs = getSelectedCharacterReferences();
    const firstRefImageUrl = characterRefs.find((c) => c.image_url)?.image_url || '';
    const refBase64 =
      firstRefImageUrl.startsWith('data:image/') && firstRefImageUrl.includes(',')
        ? firstRefImageUrl.split(',')[1] || ''
        : '';

    for (let i = 0; i < pageEntries.length; i += batchSize) {
      const batch = pageEntries.slice(i, i + batchSize);

      setStep4((prev) => {
        if (!prev.data) return prev;
        const nextPageStates = { ...prev.data.pageStates };
        batch.forEach(([pageNumber]) => {
          const pageId = `page-${pageNumber}`;
          nextPageStates[pageId] = {
            status: 'loading',
            imageUrl: prev.data!.pageStates[pageId]?.imageUrl ?? null,
            error: null,
          };
        });
        return { ...prev, data: { ...prev.data, pageStates: nextPageStates } };
      });

      const results = await Promise.all(
        batch.map(async ([pageNumber, panels]) => {
          const pageId = `page-${pageNumber}`;
          try {
            const prompt = buildComicPagePrompt(
              panels,
              artStyle,
              mangaGenre,
              characterRefs.map((c) => ({ name: c.name, prompt: c.prompt }))
            );
            const effectiveSettings: ImageGenSettings = {
              mode: refBase64 ? 2 : imageGenMode,
              referenceImageBase64: refBase64 || referenceImageBase64,
              controlImageBase64,
              ipAdapterScale,
              controlnetScale,
            };
            const imageUrl = await fetchImageFromAI(prompt, localImageApiUrl || undefined, effectiveSettings);
            return { pageId, status: 'success' as const, imageUrl, error: null };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Image generation failed.';
            return { pageId, status: 'error' as const, imageUrl: null, error: message };
          }
        })
      );

      setStep4((prev) => {
        if (!prev.data) return prev;
        const nextPageStates = { ...prev.data.pageStates };
        results.forEach((r) => {
          nextPageStates[r.pageId] = { status: r.status, imageUrl: r.imageUrl, error: r.error };
        });
        return {
          ...prev,
          data: { ...prev.data, pageStates: nextPageStates },
          lastUpdated: new Date().toISOString(),
        };
      });

      if (i + batchSize < pageEntries.length) await sleep(delayMs);
    }
  };

  const handleStartFullGeneration = async () => {
    if (!step4.data || step4.data.isGenerating) return;

    const pageMap = new Map<number, Step4Panel[]>();
    step4.data.panels.forEach((panel) => {
      const existing = pageMap.get(panel.pageNumber) || [];
      existing.push(panel);
      pageMap.set(panel.pageNumber, existing);
    });

    const targets = Array.from(pageMap.entries()).filter(([pageNumber]) => {
      const state = step4.data?.pageStates?.[`page-${pageNumber}`];
      return !state || state.status === 'idle' || state.status === 'error';
    });

    if (!targets.length) return;

    setStep4((prev) => {
      if (!prev.data) return prev;
      return { ...prev, data: { ...prev.data, isGenerating: true }, error: null };
    });

    try {
      await generatePageImages(targets, { batchSize: 1, delayMs: 10000 });
    } finally {
      setStep4((prev) => {
        if (!prev.data) return prev;
        return { ...prev, data: { ...prev.data, isGenerating: false } };
      });
    }
  };

  const handleRegeneratePage = async (pageNumber: number) => {
    if (!step4.data || step4.data.isGenerating) return;
    const panels = step4.data.panels
      .filter((p) => p.pageNumber === pageNumber)
      .sort((a, b) => a.panelNumber - b.panelNumber);
    if (!panels.length) return;

    setStep4((prev) => {
      if (!prev.data) return prev;
      return { ...prev, data: { ...prev.data, isGenerating: true }, error: null };
    });

    try {
      await generatePageImages([[pageNumber, panels]], { batchSize: 1, delayMs: 0 });
    } finally {
      setStep4((prev) => {
        if (!prev.data) return prev;
        return { ...prev, data: { ...prev.data, isGenerating: false } };
      });
    }
  };

  const step4PanelsByPage = useMemo(() => {
    if (!step4.data) return [] as Array<[number, Step4Panel[]]>;
    const pageMap = new Map<number, Step4Panel[]>();

    step4.data.panels.forEach((panel) => {
      const existing = pageMap.get(panel.pageNumber) || [];
      existing.push(panel);
      pageMap.set(panel.pageNumber, existing);
    });

    return Array.from(pageMap.entries())
      .map(([pageNumber, panels]) => [
        pageNumber,
        panels.sort((a, b) => a.panelNumber - b.panelNumber),
      ] as [number, Step4Panel[]])
      .sort((a, b) => a[0] - b[0]);
  }, [step4.data]);

  const step4Stats = useMemo(() => {
    const pageStates = step4.data?.pageStates || {};
    const list = Object.values(pageStates);
    return {
      total: list.length,
      success: list.filter((e) => e.status === 'success').length,
      loading: list.filter((e) => e.status === 'loading').length,
      error: list.filter((e) => e.status === 'error').length,
    };
  }, [step4.data]);

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

  const mockImageUrl = (label: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="100%" height="100%" fill="#f3f4f6"/><rect x="40" y="40" width="640" height="880" fill="#111827"/><text x="50%" y="50%" font-family="Arial" font-size="32" fill="#f3f4f6" text-anchor="middle">${label}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const loadMockStepData = (step: StepKey) => {
    const nowIso = new Date().toISOString();
    setGlobalError(null);

    if (step === 1) {
      setStep1({
        data: {
          characterBreakdown: ['Hana - determined heroine', 'Ryo - cautious mentor', 'Kira - rival turned ally'],
          analysisMarkdown:
            '## Story Summary\nA rising hero faces early trials, meets a rival, and unites for the final chapter.\n\n## Themes\n- Courage vs fear\n- Found family\n- Legacy and choice',
          structuredJson: null,
        },
        isLoading: false,
        isApproved: false,
        locked: false,
        error: null,
        lastUpdated: nowIso,
      });
      setStep2((prev) => ({ ...prev, locked: false }));
      setActiveStep(1);
      return;
    }

    if (step === 2) {
      setStep2({
        data: {
          designMarkdown:
            '### Character 1: Hana\n- Outfit: layered travel cloak\n- Palette: midnight blue + white\n- AI Image Prompt Ready: heroine, cloak, confident stance\n\n### Character 2: Ryo\n- Outfit: sage robes\n- Palette: muted greens\n- AI Image Prompt Ready: mentor, staff, calm aura',
          structuredJson: null,
          aiPrompts: ['heroine, cloak, confident stance', 'mentor, staff, calm aura'],
        },
        isLoading: false,
        isApproved: false,
        locked: false,
        error: null,
        lastUpdated: nowIso,
      });
      setStep2ImageReview((prev) => ({ ...prev, locked: false }));
      setStep3((prev) => ({ ...prev, locked: false }));
      setActiveStep(2);
      return;
    }

    if (step === 3) {
      setStep3({
        data: {
          scriptMarkdown:
            'Page 1\nPanel 1: Hana stands at the city gate.\nDialogue/SFX: "I will find the truth."\nAI Image Prompt: heroine at city gate, dramatic light\n\nPanel 2: Ryo watches from the shadows.\nDialogue/SFX: Whispered wind\nAI Image Prompt: mentor in shadows, moody alley',
          structuredJson: null,
        },
        isLoading: false,
        isApproved: false,
        locked: false,
        error: null,
        lastUpdated: nowIso,
      });
      setStep4((prev) => ({ ...prev, locked: false }));
      setActiveStep(3);
      return;
    }

    const panels: Step4Panel[] = [
      {
        id: 'p1-n1',
        pageNumber: 1,
        panelNumber: 1,
        contextLabel: 'Page 1, Panel 1',
        dialogueSfx: '"I will find the truth."',
        aiImagePrompt: 'heroine at city gate, dramatic light',
      },
      {
        id: 'p1-n2',
        pageNumber: 1,
        panelNumber: 2,
        contextLabel: 'Page 1, Panel 2',
        dialogueSfx: 'Whispered wind',
        aiImagePrompt: 'mentor in shadows, moody alley',
      },
      {
        id: 'p2-n1',
        pageNumber: 2,
        panelNumber: 1,
        contextLabel: 'Page 2, Panel 1',
        dialogueSfx: 'A challenge appears.',
        aiImagePrompt: 'rival enters, dynamic pose, street scene',
      },
    ];

    const panelStates: Record<string, Step4PanelState> = {
      'p1-n1': { status: 'success', imageUrl: mockImageUrl('Panel 1'), error: null },
      'p1-n2': { status: 'idle', imageUrl: null, error: null },
      'p2-n1': { status: 'error', imageUrl: null, error: 'Mock: generation failed.' },
    };

    const pageStates: Record<string, Step4PanelState> = {
      'page-1': { status: 'success', imageUrl: mockImageUrl('Page 1'), error: null },
      'page-2': { status: 'error', imageUrl: null, error: 'Mock: generation failed.' },
    };

    setStep4({
      data: {
        panels,
        panelStates,
        pageStates,
        isGenerating: false,
      },
      isLoading: false,
      isApproved: false,
      locked: false,
      error: null,
      lastUpdated: nowIso,
    });
    setActiveStep(4);
  };

  const loadMockCharacterReview = () => {
    const nowIso = new Date().toISOString();
    const characters: CharacterImageItem[] = [
      {
        characterId: 'hana',
        name: 'Hana',
        prompt: 'heroine, cloak, confident stance',
        status: 'success',
        error: null,
        candidates: [
          { id: 'hana-1', imageUrl: mockImageUrl('Hana A'), createdAt: nowIso },
          { id: 'hana-2', imageUrl: mockImageUrl('Hana B'), createdAt: nowIso },
        ],
        selectedCandidateId: 'hana-1',
      },
      {
        characterId: 'ryo',
        name: 'Ryo',
        prompt: 'mentor, staff, calm aura',
        status: 'success',
        error: null,
        candidates: [{ id: 'ryo-1', imageUrl: mockImageUrl('Ryo'), createdAt: nowIso }],
        selectedCandidateId: 'ryo-1',
      },
    ];

    setStep2ImageReview({
      data: { characters, isGenerating: false },
      isLoading: false,
      isApproved: false,
      locked: false,
      error: null,
      lastUpdated: nowIso,
    });
  };

  const loadMockPipeline = () => {
    loadMockStepData(1);
    loadMockStepData(2);
    loadMockCharacterReview();
    loadMockStepData(3);
    loadMockStepData(4);
    setActiveStep(0);
  };

  // Restore from full-save format (produced by buildFullSave / cloud save).
  const restoreFromFullSave = (json: Record<string, unknown>): { success: boolean; error?: string } => {
    try {
      const nowIso = new Date().toISOString();
      const userInputs = toRecord(json.user_inputs);
      const imageGenSettings = toRecord(json.image_gen_settings);
      const steps = toRecord(json.steps);
      const s1 = toRecord(steps.step1);
      const s2 = toRecord(steps.step2);
      const s2ir = toRecord(steps.step2ImageReview);
      const s3 = toRecord(steps.step3);
      const s4 = toRecord(steps.step4);
      const s3Data = toRecord(s3.data);
      const scriptMarkdown = String(s3Data.scriptMarkdown || '');
      if (!scriptMarkdown) {
        return { success: false, error: 'No script data in saved project — cannot build panel list.' };
      }

      if (json.project_id) setProjectId(String(json.project_id));
      if (userInputs.story_content) setStoryText(String(userInputs.story_content));
      if (userInputs.genre) setMangaGenre(String(userInputs.genre));
      if (userInputs.art_style_reference) setArtStyle(String(userInputs.art_style_reference));
      if (userInputs.max_panels_per_page) setMaxPanelsPerPage(String(userInputs.max_panels_per_page));
      if (userInputs.special_requests) setSpecialRequests(String(userInputs.special_requests));
      if (userInputs.num_chapters) setNumChapters(String(userInputs.num_chapters));
      if (userInputs.target_pages) setTargetPages(String(userInputs.target_pages));
      if (userInputs.main_characters) setMainCharacters(String(userInputs.main_characters));
      if (userInputs.local_image_api_url) setLocalImageApiUrl(String(userInputs.local_image_api_url));
      if (imageGenSettings.mode) setImageGenMode(Number(imageGenSettings.mode) as ImageGenMode);
      if (imageGenSettings.ip_adapter_scale != null) setIpAdapterScale(Number(imageGenSettings.ip_adapter_scale));
      if (imageGenSettings.controlnet_scale != null) setControlnetScale(Number(imageGenSettings.controlnet_scale));

      const s1Data = toRecord(s1.data);
      setStep1({
        data: s1.data ? {
          analysisMarkdown: String(s1Data.analysisMarkdown || ''),
          characterBreakdown: Array.isArray(s1Data.characterBreakdown) ? (s1Data.characterBreakdown as unknown[]).map(String) : [],
          structuredJson: (s1Data.structuredJson as Record<string, unknown> | null) ?? null,
        } : null,
        isLoading: false,
        isApproved: Boolean(s1.isApproved),
        locked: false,
        error: null,
        lastUpdated: String(s1.lastUpdated || nowIso),
      });

      const s2Data = toRecord(s2.data);
      setStep2({
        data: s2.data ? {
          designMarkdown: String(s2Data.designMarkdown || ''),
          structuredJson: (s2Data.structuredJson as Record<string, unknown> | null) ?? null,
          aiPrompts: Array.isArray(s2Data.aiPrompts) ? (s2Data.aiPrompts as unknown[]).map(String) : [],
        } : null,
        isLoading: false,
        isApproved: Boolean(s2.isApproved),
        locked: false,
        error: null,
        lastUpdated: String(s2.lastUpdated || nowIso),
      });

      const s2irData = toRecord(s2ir.data);
      const savedChars = Array.isArray(s2irData.characters) ? s2irData.characters as Array<Record<string, unknown>> : [];
      const restoredChars: CharacterImageItem[] = savedChars.map((char) => {
        const selectedId = char.selectedCandidateId ? String(char.selectedCandidateId) : null;
        const selectedUrl = char.selectedImageUrl ? String(char.selectedImageUrl) : null;
        const resolvedId = selectedId ?? `${String(char.characterId)}-restored`;
        return {
          characterId: String(char.characterId || ''),
          name: String(char.name || ''),
          prompt: String(char.prompt || ''),
          status: selectedUrl ? ('success' as const) : ('idle' as const),
          error: null,
          candidates: selectedUrl ? [{ id: resolvedId, imageUrl: selectedUrl, createdAt: nowIso }] : [],
          selectedCandidateId: selectedUrl ? resolvedId : null,
        };
      });

      setStep2ImageReview({
        data: s2ir.data ? { characters: restoredChars, isGenerating: false } : null,
        isLoading: false,
        isApproved: Boolean(s2ir.isApproved),
        locked: false,
        error: null,
        lastUpdated: String(s2ir.lastUpdated || nowIso),
      });

      setStep3({
        data: {
          scriptMarkdown,
          structuredJson: (s3Data.structuredJson as Record<string, unknown> | null) ?? null,
        },
        isLoading: false,
        isApproved: Boolean(s3.isApproved),
        locked: false,
        error: null,
        lastUpdated: String(s3.lastUpdated || nowIso),
      });

      const s4Data = toRecord(s4.data);
      const panels = Array.isArray(s4Data.panels) ? (s4Data.panels as Step4Panel[]) : [];
      setStep4({
        data: panels.length > 0 ? { panels, panelStates: {}, pageStates: {}, isGenerating: false } : null,
        isLoading: false,
        isApproved: Boolean(s4.isApproved),
        locked: false,
        error: null,
        lastUpdated: String(s4.lastUpdated || nowIso),
      });

      setActiveStep(4);
      setGlobalError(null);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to restore project.' };
    }
  };

  const loadProjectJson = (json: Record<string, unknown>): { success: boolean; error?: string } => {
    // Full-save format uses camelCase step keys (step1, step2, step3 …)
    const steps = toRecord(json.steps);
    if (steps.step1 || steps.step2 || steps.step3) {
      return restoreFromFullSave(json);
    }

    // Legacy export format (projectSnapshot — snake_case step keys)
    try {
      const nowIso = new Date().toISOString();
      const userInputs = toRecord(json.user_inputs);
      const userCustomizations = toRecord(userInputs.user_customizations);
      const step1ApiData = toRecord(steps.step_1_analysis);
      const step1ApiDataData = toRecord(step1ApiData.data);
      const step2ApiData = toRecord(steps.step_2_design);
      const step2ApiDataData = toRecord(step2ApiData.data);
      const step3ApiData = toRecord(steps.step_3_script);
      const step3ApiDataData = toRecord(step3ApiData.data);

      const scriptMarkdown = String(step3ApiDataData.script_markdown || '');
      if (!scriptMarkdown) {
        return { success: false, error: 'JSON missing step_3_script.data.script_markdown — cannot build panel list.' };
      }

      if (json.project_id) setProjectId(String(json.project_id));
      if (userInputs.story_content) setStoryText(String(userInputs.story_content));
      if (userInputs.genre) setMangaGenre(String(userInputs.genre));
      if (userInputs.art_style_reference) setArtStyle(String(userInputs.art_style_reference));
      if (userInputs.max_panels_per_page) setMaxPanelsPerPage(String(userInputs.max_panels_per_page));
      if (userCustomizations.special_requests) setSpecialRequests(String(userCustomizations.special_requests));

      const analysisMarkdown = String(step1ApiDataData.analysis_markdown || '');
      const characterBreakdown = Array.isArray(step1ApiDataData.character_breakdown)
        ? (step1ApiDataData.character_breakdown as unknown[]).map(String)
        : [];

      setStep1({
        data: { analysisMarkdown, characterBreakdown, structuredJson: json },
        isLoading: false,
        isApproved: step1ApiData.status === 'approved',
        locked: false,
        error: null,
        lastUpdated: String(step1ApiData.last_updated || nowIso),
      });
      setStep2({
        data: { designMarkdown: String(step2ApiDataData.design_markdown || ''), structuredJson: json, aiPrompts: [] },
        isLoading: false,
        isApproved: step2ApiData.status === 'approved',
        locked: false,
        error: null,
        lastUpdated: String(step2ApiData.last_updated || nowIso),
      });
      setStep3({
        data: { scriptMarkdown, structuredJson: json },
        isLoading: false,
        isApproved: step3ApiData.status === 'approved',
        locked: false,
        error: null,
        lastUpdated: String(step3ApiData.last_updated || nowIso),
      });
      setStep4((prev) => ({ ...prev, data: null, locked: false, error: null }));
      setActiveStep(4);
      setGlobalError(null);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to load project JSON.' };
    }
  };

  const buildFullSave = (): FullProjectSave => {
    const nowIso = new Date().toISOString();
    const step2irData = step2ImageReview.data
      ? {
          characters: step2ImageReview.data.characters.map((char) => {
            const selected = char.candidates.find((c) => c.id === char.selectedCandidateId);
            return {
              characterId: char.characterId,
              name: char.name,
              prompt: char.prompt,
              selectedCandidateId: char.selectedCandidateId,
              selectedImageUrl: selected?.imageUrl ?? null,
            };
          }),
          isGenerating: false,
        }
      : null;

    const step4SaveData = step4.data
      ? { panels: step4.data.panels, panelStates: {}, pageStates: {}, isGenerating: false }
      : null;

    return {
      project_id: projectId,
      saved_at: nowIso,
      user_inputs: {
        story_content: storyText,
        genre: mangaGenre,
        art_style_reference: artStyle,
        max_panels_per_page: Number(maxPanelsPerPage) || 6,
        special_requests: specialRequests,
        num_chapters: numChapters,
        target_pages: targetPages,
        main_characters: mainCharacters,
        local_image_api_url: localImageApiUrl,
      },
      image_gen_settings: {
        mode: imageGenMode,
        ip_adapter_scale: ipAdapterScale,
        controlnet_scale: controlnetScale,
      },
      steps: {
        step1: { data: step1.data, isApproved: step1.isApproved, lastUpdated: step1.lastUpdated },
        step2: { data: step2.data, isApproved: step2.isApproved, lastUpdated: step2.lastUpdated },
        step2ImageReview: { data: step2irData, isApproved: step2ImageReview.isApproved, lastUpdated: step2ImageReview.lastUpdated },
        step3: { data: step3.data, isApproved: step3.isApproved, lastUpdated: step3.lastUpdated },
        step4: { data: step4SaveData, isApproved: step4.isApproved, lastUpdated: step4.lastUpdated },
      },
    };
  };

  const saveToCloud = async () => {
    setCloudSaveStatus('saving');
    setCloudSaveError(null);
    try {
      await projectsApi.save(buildFullSave());
      setCloudSaveStatus('saved');
      window.setTimeout(() => setCloudSaveStatus('idle'), 2000);
    } catch (err) {
      setCloudSaveStatus('error');
      setCloudSaveError(toApiError(err).message);
    }
  };

  const loadFromCloud = async (cloudProjectId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await projectsApi.load(cloudProjectId);
      return restoreFromFullSave(response.data as unknown as Record<string, unknown>);
    } catch (err) {
      return { success: false, error: toApiError(err).message };
    }
  };

  const listCloudProjects = async (): Promise<CloudProjectListItem[]> => {
    const response = await projectsApi.list();
    return response.data;
  };

  const injectLibraryCharacters = (chars: CharacterSummary[]) => {
    const nowIso = new Date().toISOString();
    setStep2ImageReview((prev) => {
      const existingIds = new Set((prev.data?.characters ?? []).map((c) => c.characterId));
      const incoming: CharacterImageItem[] = chars
        .filter((c) => !existingIds.has(c.character_id))
        .map((c) => {
          const candidateId = `${c.character_id}-lib`;
          return {
            characterId: c.character_id,
            name: c.name,
            prompt: c.prompt ?? '',
            status: (c.selected_image_url ? 'success' : 'idle') as CharacterImageStatus,
            error: null,
            candidates: c.selected_image_url
              ? [{ id: candidateId, imageUrl: c.selected_image_url, createdAt: nowIso }]
              : [],
            selectedCandidateId: c.selected_image_url ? candidateId : null,
          };
        });
      return {
        ...prev,
        data: {
          characters: [...(prev.data?.characters ?? []), ...incoming],
          isGenerating: false,
        },
        locked: false,
        error: null,
        lastUpdated: nowIso,
      };
    });
  };

  const value: ComicGenerationContextValue = {
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
    localImageApiUrl,
    imageGenMode,
    referenceImageBase64,
    controlImageBase64,
    ipAdapterScale,
    controlnetScale,
    useStreaming,
    step1,
    step2,
    step2ImageReview,
    step3,
    step4,
    activeStep,
    globalError,
    jsonCopied,
    jsonDownloaded,
    lastDownloadedJsonFile,
    stepMap,
    step4PanelsByPage,
    step4Stats,
    projectSnapshot,
    setupValidation,
    setupSubmitAttempted,
    streamingText,
    setProjectId,
    setStoryFile,
    setStoryText,
    setMainCharacters,
    setNumChapters,
    setTargetPages,
    setMangaGenre,
    setArtStyle,
    setMaxPanelsPerPage,
    setSpecialRequests,
    setLocalImageApiUrl,
    setImageGenMode,
    setReferenceImageBase64,
    setControlImageBase64,
    setIpAdapterScale,
    setControlnetScale,
    setUseStreaming,
    setActiveStep,
    setSetupValidation,
    setSetupSubmitAttempted,
    handleFileUpload,
    handleGenerate,
    handleApprove,
    handleRetry,
    handleGenerateCharacterReferences,
    handleRegenerateCharacterImage,
    handleSelectCharacterCandidate,
    handleApproveCharacterReferences,
    handleRetryCharacterReferences,
    handleStartFullGeneration,
    handleRegeneratePage,
    copyProjectJson,
    downloadProjectJson,
    getStep2PromptList,
    getSelectedCharacterReferences,
    getCooldownSeconds,
    loadMockStepData,
    loadMockCharacterReview,
    loadMockPipeline,
    loadProjectJson,
    cloudSaveStatus,
    cloudSaveError,
    saveToCloud,
    loadFromCloud,
    listCloudProjects,
    injectLibraryCharacters,
    fromStorySetup,
    setFromStorySetup,
    fieldsAutoFilledFromAnalysis,
    storySetupAnalysisResult,
  };

  return <ComicGenerationContext.Provider value={value}>{children}</ComicGenerationContext.Provider>;
}

export function useComicGeneration(): ComicGenerationContextValue {
  const context = useContext(ComicGenerationContext);
  if (!context) {
    throw new Error('useComicGeneration must be used within a ComicGenerationProvider.');
  }
  return context;
}

