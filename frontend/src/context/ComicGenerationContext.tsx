'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  geminiApi,
  comicLayoutApi,
  analyzeStoryStructuredStream,
  characterDesignsStructuredStream,
  panelScriptStructuredStream,
  projectsApi,
  toApiError,
} from '@/services/api';
import type { FullProjectSave, CloudProjectListItem, CharacterSummary, ProjectImageEntry } from '@/services/api';
import { exportAsZip, exportAsPdf, exportAsEpub } from '@/lib/export';
import { recomposePages, DEFAULT_BORDER_CONFIG } from '@/lib/borderComposer';
import type { BorderConfig } from '@/lib/borderComposer';
import { compositePanelToBlob } from '@/lib/bubbles/exportComposite';
import { trackEvent } from '@/lib/analytics';
import type { ExportPage } from '@/lib/export';
import type { SingleBubble } from '@/components/studio-steps/DialogueEditor';

export type StepKey = 1 | 2 | 3 | 4 | 5;
export type WizardStepKey = 0 | StepKey;

export interface Step5Result {
  exportedAt: string | null;
}

export type ImageGenMode = 1 | 2 | 3 | 4;

export interface ImageGenSettings {
  mode: ImageGenMode;
  referenceImageBase64: string;
  controlImageBase64: string;
  ipAdapterScale: number;
  controlnetScale: number;
  characterName?: string;
  storyId?: string;
  style?: string;
  width?: number;
  height?: number;
}

export interface StepState<T> {
  data: T | null;
  isLoading: boolean;
  isApproved: boolean;
  /** True when content was re-generated after an earlier approval (STATE 5). */
  regeneratedAfterApproval: boolean;
  locked: boolean;
  error: string | null;
  lastUpdated: string | null;
  /** ISO timestamp set when the step was approved. */
  approvedAt: string | null;
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

export type PanelImageStatus = 'idle' | 'loading' | 'success' | 'error' | 'comparing';

export interface PanelVersion {
  imageUrl: string;
  feedback: string;
}

export interface Step4Panel {
  id: string;
  pageNumber: number;
  panelNumber: number;
  contextLabel: string;
  dialogueSfx: string;
  aiImagePrompt: string;
  shotType?: string;
  aspectRatio?: string;
  negativePrompt?: string;
}

export interface Step4PanelState {
  status: PanelImageStatus;
  imageUrl: string | null;
  error: string | null;
  versions: PanelVersion[];
  pendingUrl: string | null;
  pendingFeedback: string;
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
  regeneratedAfterApproval: false,
  locked,
  error: null,
  lastUpdated: null,
  approvedAt: null,
  streamingText: null,
});

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, maxAttempts: number, retryDelayMs: number): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await fn() }
    catch (e) {
      lastErr = e
      if (attempt < maxAttempts - 1) await sleep(retryDelayMs)
    }
  }
  throw lastErr
}

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
      scene_prompt: imagePrompt,
      negative_prompt: PANEL_NEGATIVE_PROMPT,
      story_id: settings?.storyId ?? 'default',
      style: settings?.style ?? 'manga',
      ip_adapter_scale: settings?.ipAdapterScale ?? 0.7,
    };
    if (settings?.characterName) {
      requestBody.character_name = settings.characterName;
    }
    if (settings?.referenceImageBase64) {
      requestBody.reference_image_b64 = settings.referenceImageBase64;
    }
    if ((mode === 3 || mode === 4) && settings?.controlImageBase64) {
      requestBody.control_image_b64 = settings.controlImageBase64;
      requestBody.controlnet_scale = settings.controlnetScale ?? 0.8;
    }
    if (settings?.width !== undefined)  requestBody.width  = settings.width;
    if (settings?.height !== undefined) requestBody.height = settings.height;

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
  const pageRegex = /^\s*(?:#+\s*)?(?:[-*]\s*)?(?:\*{0,2})?Page\s+(\d+)(?:\s+of\s+Chapter\s+\d+)?(?:\*{0,2})?\s*:?.*$/i;
  const panelRegex = /^\s*(?:#+\s*)?(?:[-*]\s*)?(?:\*{0,2})?Panel\s+(\d+)(?:\*{0,2})?\s*:?.*$/i;

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
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?(?:Dialogue(?:\s*\/\s*SFX)?(?:\s*\/\s*Thoughts)?|dialogue_sfx)(?:\*{0,2})?\s*:\s*([\s\S]*?)(?=\n\s*(?:[-*]\s*)?(?:\*{0,2})?(?:AI\s*Image\s*Prompt|ai_image_prompt|Panel\s+\d+|Page\s+\d+|Chapter\s+End\s+Notes|Special\s+Pages|Final\s+Script\s+Summary)\b|$)/i;
  const promptRegex =
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?(?:AI\s*Image\s*Prompt|ai_image_prompt)(?:\*{0,2})?\s*:\s*([\s\S]*?)(?=\n\s*(?:[-*]\s*)?(?:\*{0,2})?(?:negative_prompt|Panel\s+\d+|Page\s+\d+|Chapter\s+End\s+Notes|Special\s+Pages|Final\s+Script\s+Summary)\b|$)/i;
  const shotTypeRegex =
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?shot_type(?:\*{0,2})?\s*:\s*([^\n]+)/i;
  const aspectRatioRegex =
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?aspect_ratio(?:\*{0,2})?\s*:\s*([^\n]+)/i;
  const negativePromptRegex =
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?negative_prompt(?:\*{0,2})?\s*:\s*([^\n]+)/i;

  const parsed = workingPanels
    .map((panel) => {
      const body = panel.body.trim();
      const dialogueSfx = (body.match(dialogueRegex)?.[1] || '').trim();
      const aiImagePrompt = (body.match(promptRegex)?.[1] || '').trim();
      if (!aiImagePrompt) {
        return null;
      }

      const shotType = (body.match(shotTypeRegex)?.[1] || '').trim() || undefined;
      const aspectRatio = (body.match(aspectRatioRegex)?.[1] || '').trim() || undefined;
      const negativePrompt = (body.match(negativePromptRegex)?.[1] || '').trim() || undefined;

      const id = `p${panel.pageNumber}-n${panel.panelNumber}`;
      const p: Step4Panel = {
        id,
        pageNumber: panel.pageNumber,
        panelNumber: panel.panelNumber,
        contextLabel: `Page ${panel.pageNumber}, Panel ${panel.panelNumber}`,
        dialogueSfx: dialogueSfx || 'No dialogue/SFX provided.',
        aiImagePrompt,
      };
      if (shotType) p.shotType = shotType;
      if (aspectRatio) p.aspectRatio = aspectRatio;
      if (negativePrompt) p.negativePrompt = negativePrompt;
      return p;
    })
    .filter((item): item is Step4Panel => item !== null);

  if (parsed.length === 0) {
    const promptOnlyRegex =
      /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?AI\s*Image\s*Prompt(?:\*{0,2})?\s*:\s*([\s\S]*?)(?=\n\s*(?:[-*]\s*)?(?:\*{0,2})?(?:AI\s*Image\s*Prompt|Panel\s+\d+|Page\s+\d+|Chapter\s+End\s+Notes|Special\s+Pages|Final\s+Script\s+Summary)\b|$)/gi;
    const prompts = [...normalized.matchAll(promptOnlyRegex)].map((match) => (match[1] || '').trim()).filter(Boolean);
    return prompts.map((prompt, idx): Step4Panel => ({
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

// Keywords that cause SD to generate character sheets instead of scene panels
const PANEL_STRIP_KEYWORDS = [
  'character sheet', 'turnaround', 'character design', 'full body',
  'reference sheet', 'character turnaround', 'multiple views',
  'front view', 'side view', 'back view',
  'panel 1', 'panel 2', 'panel 3', 'panel 4',
  'panel 5', 'panel 6', 'panel 7', 'panel 8',
];

// Valid shot_type values from Step 3 RULE 5 — marks where scene description begins
const SHOT_TYPE_MARKERS = [
  'extreme close-up', 'close-up', 'close up', 'medium shot', 'medium-wide',
  'medium wide', 'wide shot', 'establishing shot', 'establishing',
  'overhead', 'low angle', 'dutch angle', 'over-the-shoulder', 'two-shot',
  'two shot', 'full shot', 'insert', 'splash',
];

/**
 * Strip character visual tags from an ai_image_prompt.
 * Format is: "{art_style}, {character_tags}, {shot_type}, {action}, {mood}"
 * We keep: art_style + everything from the first shot_type onward.
 * Character appearance comes from IP-Adapter reference image instead.
 */
const buildCleanPanelPrompt = (aiImagePrompt: string, artStyle: string): string => {
  let cleaned = aiImagePrompt;

  // Strip panel-number and character-sheet keywords
  for (const kw of PANEL_STRIP_KEYWORDS) {
    cleaned = cleaned.replace(new RegExp(kw, 'gi'), '');
  }

  // Find the first shot_type marker — everything from there is scene description
  const lower = cleaned.toLowerCase();
  let shotIdx = -1;
  for (const marker of SHOT_TYPE_MARKERS) {
    const idx = lower.indexOf(marker);
    if (idx !== -1 && (shotIdx === -1 || idx < shotIdx)) {
      shotIdx = idx;
    }
  }

  const stylePrefix = artStyle.trim().toLowerCase();
  if (shotIdx > 0) {
    // Keep art style + scene description (shot_type → end), drop character visual tags
    const sceneDescription = cleaned.slice(shotIdx).trim().replace(/^,\s*/, '');
    return `${stylePrefix}, ${sceneDescription}`;
  }

  // No shot_type found — strip keywords and collapse whitespace
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return `${stylePrefix}, ${cleaned}`;
};

const PANEL_NEGATIVE_PROMPT =
  'multiple panels, split screen, panel border in image, character sheet, turnaround, ' +
  'reference sheet, text in image, watermark, signature, ' +
  'lowres, bad anatomy, worst quality, blurry, deformed';

const buildComicPagePrompt = (
  panels: Step4Panel[],
  artStyle: string,
  mangaGenre: string,
  _characterRefs: Array<{ name: string; prompt: string }>,
  includeSfx = false
): string => {
  // Character appearance is handled by IP-Adapter reference image — not embedded in text prompt
  const parts: string[] = [
    `Comic book page, ${panels.length} panels, ${artStyle}, ${mangaGenre}.`,
  ];
  panels.forEach((panel, i) => {
    const cleanPrompt = buildCleanPanelPrompt(panel.aiImagePrompt, artStyle);
    let line = `Panel ${i + 1}: ${cleanPrompt}`;
    if (includeSfx) {
      const sfx = panel.dialogueSfx?.trim();
      if (sfx && !/^(none|no dialogue\/sfx provided\.?)$/i.test(sfx)) {
        line += `. Dialogue: ${sfx}`;
      }
    }
    parts.push(line);
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
  imageGenStyle: string;
  referenceImageBase64: string;
  controlImageBase64: string;
  ipAdapterScale: number;
  controlnetScale: number;
  useStreaming: boolean;
  sfxMode: 'auto' | 'manual';
  setSfxMode: (v: 'auto' | 'manual') => void;
  comicPageMode: 'page' | 'panel' | null;
  setComicPageMode: (mode: 'page' | 'panel') => void;
  resetComicPageMode: () => void;
  step1: StepState<Step1Result>;
  step2: StepState<Step2Result>;
  step2ImageReview: StepState<CharacterImageReviewResult>;
  step3: StepState<Step3Result>;
  step4: StepState<Step4Result>;
  step5: StepState<Step5Result>;
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
  setImageGenStyle: (value: string) => void;
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
  handleRevokeApproval: (step: StepKey) => void;
  handleRetry: (step: StepKey) => void;
  handleGenerateCharacterReferences: (settingsMap?: Record<string, ImageGenSettings>) => Promise<void>;
  handleRegenerateCharacterImage: (characterId: string, settings?: ImageGenSettings, feedback?: string) => Promise<void>;
  handleSelectCharacterCandidate: (characterId: string, candidateId: string) => void;
  handleApproveCharacterReferences: () => void;
  handleRetryCharacterReferences: () => void;
  pageLayoutNames: Record<number, string>;
  pagePanelDimensions: Record<number, Record<string, { width: number; height: number }>>;
  setPageLayout: (pageNumber: number, layoutName: string, panelsOnPage: Step4Panel[]) => Promise<void>;
  setRawPanelDimensions: (pageNumber: number, dimMap: Record<string, { width: number; height: number }>) => void;
  handleStartFullGeneration: () => Promise<void>;
  handleStartPanelGeneration: () => Promise<void>;
  handleRegenerateSinglePanel: (panel: Step4Panel) => Promise<void>;
  handleRegeneratePage: (pageNumber: number) => Promise<void>;
  handleRegenerateWithFeedback: (pageNumber: number, feedback: string) => Promise<void>;
  acceptPanelRegen: (pageNumber: number) => void;
  rejectPanelRegen: (pageNumber: number) => void;
  copyProjectJson: () => Promise<void>;
  downloadProjectJson: () => void;
  exportZip: (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => Promise<void>;
  exportPdf: (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => Promise<void>;
  exportEpub: (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => Promise<void>;
  exportStatus: 'idle' | 'exporting' | 'error';
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
  borderConfig: BorderConfig;
  setBorderConfig: React.Dispatch<React.SetStateAction<BorderConfig>>;
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
  const [imageGenStyle, setImageGenStyle] = useState<string>('manga');
  const [referenceImageBase64, setReferenceImageBase64] = useState('');
  const [controlImageBase64, setControlImageBase64] = useState('');
  const [ipAdapterScale, setIpAdapterScale] = useState(0.7);
  const [controlnetScale, setControlnetScale] = useState(0.8);
  const [useStreaming, setUseStreaming] = useState(true);
  const [sfxMode, setSfxMode] = useState<'auto' | 'manual'>('auto');
  const [comicPageMode, setComicPageModeState] = useState<'page' | 'panel' | null>(null);
  const setComicPageMode = (mode: 'page' | 'panel') => setComicPageModeState(mode);
  const resetComicPageMode = () => setComicPageModeState(null);
  const [pageLayoutNames, setPageLayoutNames] = useState<Record<number, string>>({});
  const [pagePanelDimensions, setPagePanelDimensions] = useState<
    Record<number, Record<string, { width: number; height: number }>>
  >({});
  const [setupValidation, setSetupValidation] = useState<SetupValidationState | null>(null);
  const [setupSubmitAttempted, setSetupSubmitAttempted] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [borderConfig, setBorderConfig] = useState<BorderConfig>(DEFAULT_BORDER_CONFIG);
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
  const [step5, setStep5] = useState<StepState<Step5Result>>(emptyStepState(true));
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
    5: 0,
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
    Promise.all([
      projectsApi.load(pending),
      projectsApi.loadImages(pending).catch(() => ({ data: { images: [] as ProjectImageEntry[] } })),
    ]).then(([projectRes, imagesRes]) => {
      const result = restoreFromFullSave(projectRes.data as unknown as Record<string, unknown>);
      if (result.success) applyLoadedImages(imagesRes.data.images);
    }).catch(() => { /* silently ignore if project was deleted */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Import JSON queued from dashboard via localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('mohiom-import-json');
    if (!raw) return;
    window.localStorage.removeItem('mohiom-import-json');
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      loadProjectJson(parsed);
    } catch { /* ignore malformed JSON */ }
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
    () => ({ 1: step1, 2: step2, 3: step3, 4: step4, 5: step5 }),
    [step1, step2, step3, step4, step5]
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

  const saveCharacterToServer = useCallback(async (
    characterName: string,
    imageDataUri: string
  ): Promise<void> => {
    if (!localImageApiUrl) return;
    const b64 = imageDataUri.startsWith('data:')
      ? imageDataUri.split(',')[1] ?? ''
      : imageDataUri;
    if (!b64) return;
    trackEvent({
      type:          'character_save',
      story_id:      projectId || 'unknown',
      style:         imageGenStyle || 'manga',
      duration_ms:   0,
      has_character: true,
    });
    fetch('/api/image-proxy/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: localImageApiUrl,
        story_id: projectId,
        character_name: characterName.toLowerCase(),
        reference_image_b64: b64,
      }),
    }).catch(() => {});
  }, [localImageApiUrl, projectId, imageGenStyle]);

  const setStepState = (step: StepKey, updater: (prev: StepState<unknown>) => StepState<unknown>) => {
    if (step === 1) setStep1((prev) => updater(prev as StepState<unknown>) as StepState<Step1Result>);
    if (step === 2) setStep2((prev) => updater(prev as StepState<unknown>) as StepState<Step2Result>);
    if (step === 3) setStep3((prev) => updater(prev as StepState<unknown>) as StepState<Step3Result>);
    if (step === 4) setStep4((prev) => updater(prev as StepState<unknown>) as StepState<Step4Result>);
    if (step === 5) setStep5((prev) => updater(prev as StepState<unknown>) as StepState<Step5Result>);
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
      const step2Params = {
        project_id: projectId,
        step1_json: getStep1StructuredJson(),
        desired_main_characters: Number(mainCharacters) || 5,
        genre_tone: mangaGenre || 'Shonen action',
        art_style_reference: artStyle || 'classic black-and-white weekly shonen',
        special_requests: specialRequests || 'None',
      };
      console.group('%c[Step 2] Character Designs — prompt inputs', 'color:#6366f1;font-weight:bold');
      console.log('desired_main_characters:', step2Params.desired_main_characters);
      console.log('genre_tone:', step2Params.genre_tone);
      console.log('art_style_reference:', step2Params.art_style_reference);
      console.log('special_requests:', step2Params.special_requests);
      console.log('step1_json (context fed to prompt):', step2Params.step1_json);
      console.log(
        '%cBackend prompt template (services.py generate_step2_character_design_markdown):\n\n' +
        'You are a professional manga adaptation studio AI. Your only job right now is Step 2: Character Designs.\n\n' +
        'REFERENCE FROM STEP 1 (structured JSON): <step1_json above>\n\n' +
        'USER CUSTOMIZATION INPUTS:\n' +
        `  Desired main characters: ${step2Params.desired_main_characters}\n` +
        `  Genre & tone: ${step2Params.genre_tone}\n` +
        `  Art style: ${step2Params.art_style_reference}\n` +
        `  Special requests: ${step2Params.special_requests}\n\n` +
        'OUTPUT ORDER:\n' +
        '  1. Global Design Guidelines\n' +
        '  2. Main Character Design Sheets\n' +
        '     (Name & Role, Personality & Backstory, Physical Appearance,\n' +
        '      Outfit & Accessories, Expressions & Poses, Visual Design Hook, AI Image Prompt Ready)\n' +
        '  3. Supporting Character Design Sheets\n' +
        '  4. Interaction & Relationship Notes\n' +
        '  5. Final Design Summary (boxed table)',
        'color:#94a3b8'
      );
      console.groupEnd();

      if (useStreaming) {
        return new Promise((resolve, reject) => {
          setStreamingText('');
          let designMarkdown = '';

          geminiApi.generateCharacterDesignsStructuredStream(
            step2Params,
            (chunk) => {
              designMarkdown += chunk;
              setStreamingText(designMarkdown);
            },
            (structuredJson) => {
              console.group('%c[Step 2] Response received', 'color:#10b981;font-weight:bold');
              console.log('%cFull design markdown:', 'color:#10b981', designMarkdown);
              console.log('Structured JSON:', structuredJson);
              console.groupEnd();

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
        const resp = await geminiApi.generateCharacterDesignsStructured(step2Params);

        const designMarkdown: string = resp.data.design_markdown || '';
        const structuredJson = (resp.data.structured_json as Record<string, unknown>) || null;

        console.group('%c[Step 2] Response received', 'color:#10b981;font-weight:bold');
        console.log('%cFull design markdown:', 'color:#10b981', designMarkdown);
        console.log('Structured JSON:', structuredJson);
        console.groupEnd();

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
      panelStates[panel.id] = { status: 'idle', imageUrl: null, error: null, versions: [], pendingUrl: null, pendingFeedback: '' };
    });

    const pageNumbers = [...new Set(panels.map((p) => p.pageNumber))];
    const pageStates: Record<string, Step4PanelState> = {};
    pageNumbers.forEach((pageNumber) => {
      pageStates[`page-${pageNumber}`] = { status: 'idle', imageUrl: null, error: null, versions: [], pendingUrl: null, pendingFeedback: '' };
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
        ...(step4.data
          ? {
              step_4_generation: {
                status: step4.isApproved ? 'approved' : 'review_pending',
                last_updated: step4.lastUpdated,
                data: {
                  panels: step4.data.panels,
                  page_images: Object.fromEntries(
                    Object.entries(step4.data.pageStates || {}).map(([pageId, state]) => [
                      pageId,
                      { image_url: state.imageUrl, status: state.status },
                    ])
                  ),
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
    step4.data,
    step4.isApproved,
    step4.lastUpdated,
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
      setStep5((prev) => ({ ...prev, locked: true, isApproved: false }));
    }
    if (step === 3) {
      setStep4((prev) => ({ ...prev, locked: true, isApproved: false }));
      setStep5((prev) => ({ ...prev, locked: true, isApproved: false }));
      setComicPageModeState(null);
    }

    const wasApproved = stepMap[step].isApproved;
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
                regeneratedAfterApproval: wasApproved,
                locked: false,
                error: null,
                lastUpdated: new Date().toISOString(),
                approvedAt: null,
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
                isLoading: false, isApproved: false, regeneratedAfterApproval: wasApproved,
                locked: false, error: null, lastUpdated: new Date().toISOString(),
                approvedAt: null, streamingText: null,
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
                isLoading: false, isApproved: false, regeneratedAfterApproval: wasApproved,
                locked: false, error: null, lastUpdated: new Date().toISOString(),
                approvedAt: null, streamingText: null,
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
    if (step === 4) {
      setPageLayoutNames({});
      setPagePanelDimensions({});
    }
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

    const now = new Date().toISOString();
    setStepState(step, (prev) => ({
      ...prev,
      isApproved: true,
      regeneratedAfterApproval: false,
      locked: true,
      lastUpdated: now,
      approvedAt: now,
    }));

    if (step === 2) {
      setStep2ImageReview((prev) => ({ ...prev, locked: false }));
      return;
    }

    const nextStep = (step + 1) as StepKey;
    if (nextStep <= 5) {
      setStepState(nextStep, (prev) => ({ ...prev, locked: false }));
      setActiveStep(nextStep as WizardStepKey);
    }
  };

  const handleRevokeApproval = (step: StepKey) => {
    setStepState(step, (prev) => ({
      ...prev,
      isApproved: false,
      regeneratedAfterApproval: false,
      approvedAt: null,
    }));
    if (step === 4) {
      setStep5((prev) => ({ ...prev, locked: true, isApproved: false }));
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
          const charSettings = settingsMap?.[character.characterId] ?? { mode: imageGenMode, referenceImageBase64, controlImageBase64, ipAdapterScale, controlnetScale, storyId: projectId, style: imageGenStyle };
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

  const handleRegenerateCharacterImage = async (characterId: string, settings?: ImageGenSettings, feedback?: string) => {
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
      const effectiveSettings = settings ?? { mode: imageGenMode, referenceImageBase64, controlImageBase64, ipAdapterScale, controlnetScale, storyId: projectId, style: imageGenStyle };
      const prompt = feedback?.trim() ? `${target.prompt}\nUser revision request: ${feedback.trim()}` : target.prompt;
      const imageUrl = await fetchImageFromAI(prompt, localImageApiUrl || undefined, effectiveSettings);
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
    if (!step2ImageReview.data || step2ImageReview.data.characters.length === 0) {
      setStep3((prev) => ({ ...prev, locked: false }));
      setActiveStep(3);
      return;
    }
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

    if (localImageApiUrl && step2ImageReview.data) {
      step2ImageReview.data.characters.forEach((char) => {
        const sel = char.candidates.find((c) => c.id === char.selectedCandidateId);
        if (sel?.imageUrl) saveCharacterToServer(char.name, sel.imageUrl);
      });
    }
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

  const setPageLayout = async (
    pageNumber: number,
    layoutName: string,
    panelsOnPage: Step4Panel[],
  ): Promise<void> => {
    const style = imageGenStyle?.toLowerCase().includes('webtoon') ? 'webtoon' : 'manga';
    setPageLayoutNames((prev) => ({ ...prev, [pageNumber]: layoutName }));

    try {
      const sorted = [...panelsOnPage].sort((a, b) => a.panelNumber - b.panelNumber);
      const res = await comicLayoutApi.confirm({
        panel_count: sorted.length,
        layout_name: layoutName,
      });
      const dimMap: Record<string, { width: number; height: number }> = {};
      for (let i = 0; i < sorted.length; i++) {
        const cp = res.data.panels[i];
        if (cp && sorted[i]) dimMap[sorted[i].id] = { width: cp.sd_width, height: cp.sd_height };
      }
      setPagePanelDimensions((prev) => ({ ...prev, [pageNumber]: dimMap }));
      setPageLayoutNames((prev) => ({ ...prev, [pageNumber]: res.data.layout_name }));
    } catch {
      console.warn(`[setPageLayout] Failed to fetch dimensions for page ${pageNumber}`);
    }
  };

  const generatePanelImages = async (
    panelsArray: Step4Panel[],
    options?: { batchSize?: number; delayMs?: number }
  ) => {
    const batchSize = Math.max(1, options?.batchSize ?? 2);
    const delayMs = Math.max(0, options?.delayMs ?? 10000);
    const characterRefs = getSelectedCharacterReferences();
    const firstCharName = characterRefs[0]?.name?.toLowerCase() || '';

    for (let i = 0; i < panelsArray.length; i += batchSize) {
      const batch = panelsArray.slice(i, i + batchSize);

      setStep4((prev) => {
        if (!prev.data) return prev;
        const nextStates = { ...prev.data.panelStates };
        const nextPageStates = { ...prev.data.pageStates };
        batch.forEach((panel) => {
          const prevState = nextStates[panel.id];
          nextStates[panel.id] = {
            ...(prevState ?? {}),
            status: 'loading',
            imageUrl: null,
            error: null,
            versions: prevState?.versions ?? [],
            pendingUrl: null,
            pendingFeedback: '',
          };
          // Clear the full-page composite for this page so it doesn't overlay panel images
          const pageKey = `page-${panel.pageNumber}`;
          if (nextPageStates[pageKey]) {
            nextPageStates[pageKey] = { ...nextPageStates[pageKey], imageUrl: null };
          }
        });
        return {
          ...prev,
          data: {
            ...prev.data,
            panelStates: nextStates,
            pageStates: nextPageStates,
          },
        };
      });

      const results = await Promise.all(
        batch.map(async (panel) => {
          try {
            let cleanPrompt = buildCleanPanelPrompt(panel.aiImagePrompt, artStyle);
            if (sfxMode === 'auto') {
              const sfx = panel.dialogueSfx?.trim();
              if (sfx && !/^(none|no dialogue\/sfx provided\.?)$/i.test(sfx)) {
                cleanPrompt += `. Dialogue: ${sfx}`;
              }
            }
            const panelDimensions = pagePanelDimensions[panel.pageNumber]?.[panel.id];
            const effectiveSettings: ImageGenSettings = {
              mode: imageGenMode,
              referenceImageBase64: characterRefs[0]?.image_url ?? referenceImageBase64,
              controlImageBase64,
              ipAdapterScale,
              controlnetScale,
              characterName: firstCharName || undefined,
              storyId: projectId,
              style: imageGenStyle,
              width: panelDimensions?.width,
              height: panelDimensions?.height,
            };
            const imageUrl = await withRetry(
              () => fetchImageFromAI(cleanPrompt, localImageApiUrl || undefined, effectiveSettings),
              3,
              3000
            );
            trackEvent({
              type:          'panel',
              story_id:      projectId || 'unknown',
              style:         imageGenStyle || 'manga',
              duration_ms:   0,
              has_character: !!firstCharName,
              ip_scale:      ipAdapterScale,
            });
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
            ...(prev.data!.panelStates[result.id] ?? {}),
            status: result.status,
            imageUrl: result.imageUrl,
            error: result.error,
            pendingUrl: null,
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
    const firstCharName = characterRefs[0]?.name?.toLowerCase() || '';

    for (let i = 0; i < pageEntries.length; i += batchSize) {
      const batch = pageEntries.slice(i, i + batchSize);

      setStep4((prev) => {
        if (!prev.data) return prev;
        const nextPageStates = { ...prev.data.pageStates };
        const nextPanelStates = { ...prev.data.panelStates };
        batch.forEach(([pageNumber]) => {
          const pageId = `page-${pageNumber}`;
          nextPageStates[pageId] = {
            status: 'loading',
            imageUrl: null,
            error: null,
            versions: prev.data!.pageStates[pageId]?.versions ?? [],
            pendingUrl: null,
            pendingFeedback: '',
          };
          // Clear individual panel images for this page so they don't show under the new full-page composite
          Object.keys(nextPanelStates).forEach((panelId) => {
            if (prev.data!.panels.find(p => p.id === panelId && p.pageNumber === pageNumber)) {
              nextPanelStates[panelId] = { ...nextPanelStates[panelId], imageUrl: null };
            }
          });
        });
        return { ...prev, data: { ...prev.data, pageStates: nextPageStates, panelStates: nextPanelStates } };
      });

      const results = await Promise.all(
        batch.map(async ([pageNumber, panels]) => {
          const pageId = `page-${pageNumber}`;
          try {
            const prompt = buildComicPagePrompt(
              panels,
              artStyle,
              mangaGenre,
              characterRefs.map((c) => ({ name: c.name, prompt: c.prompt })),
              sfxMode === 'auto'
            );
            const effectiveSettings: ImageGenSettings = {
              mode: imageGenMode,
              referenceImageBase64: characterRefs[0]?.image_url ?? referenceImageBase64,
              controlImageBase64,
              ipAdapterScale,
              controlnetScale,
              characterName: firstCharName || undefined,
              storyId: projectId,
              style: imageGenStyle,
            };
            const imageUrl = await withRetry(
              () => fetchImageFromAI(prompt, localImageApiUrl || undefined, effectiveSettings),
              3,
              3000
            );
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
          nextPageStates[r.pageId] = { ...(prev.data!.pageStates[r.pageId] ?? {}), status: r.status, imageUrl: r.imageUrl, error: r.error, pendingUrl: null };
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

  const handleStartPanelGeneration = async () => {
    if (!step4.data || step4.data.isGenerating) return;

    const pending = step4.data.panels.filter((p) => {
      const state = step4.data?.panelStates?.[p.id];
      return !state || state.status === 'idle' || state.status === 'error';
    });
    if (!pending.length) return;

    setStep4((prev) => {
      if (!prev.data) return prev;
      return { ...prev, data: { ...prev.data, isGenerating: true }, error: null };
    });
    try {
      await generatePanelImages(pending, { batchSize: 2, delayMs: 10000 });
    } finally {
      setStep4((prev) => {
        if (!prev.data) return prev;
        return { ...prev, data: { ...prev.data, isGenerating: false } };
      });
    }
  };

  const handleRegenerateSinglePanel = async (panel: Step4Panel) => {
    if (!step4.data) return;
    await generatePanelImages([panel], { batchSize: 1, delayMs: 0 });
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

  const handleRegenerateWithFeedback = async (pageNumber: number, feedback: string) => {
    if (!step4.data) return;
    const panels = step4.data.panels
      .filter((p) => p.pageNumber === pageNumber)
      .sort((a, b) => a.panelNumber - b.panelNumber);
    if (!panels.length) return;

    const pageId = `page-${pageNumber}`;
    const currentState = step4.data.pageStates[pageId];
    const currentImageUrl = currentState?.imageUrl ?? null;

    // Save current image to version history, set page to loading, and clear stale panel images
    setStep4((prev) => {
      if (!prev.data) return prev;
      const prevState = prev.data.pageStates[pageId];
      const existingVersions = prevState?.versions ?? [];
      const newVersions = currentImageUrl
        ? [...existingVersions, { imageUrl: currentImageUrl, feedback: prevState?.pendingFeedback ?? '' }].slice(-4)
        : existingVersions;
      const nextPanelStates = { ...prev.data.panelStates };
      Object.keys(nextPanelStates).forEach((panelId) => {
        if (prev.data!.panels.find(p => p.id === panelId && p.pageNumber === pageNumber)) {
          nextPanelStates[panelId] = { ...nextPanelStates[panelId], imageUrl: null };
        }
      });
      return {
        ...prev,
        data: {
          ...prev.data,
          panelStates: nextPanelStates,
          pageStates: {
            ...prev.data.pageStates,
            [pageId]: {
              ...(prevState ?? {}),
              status: 'loading',
              error: null,
              versions: newVersions,
              pendingUrl: null,
              pendingFeedback: feedback,
            },
          },
        },
        error: null,
      };
    });

    try {
      const characterRefs = getSelectedCharacterReferences();
      const firstCharName = characterRefs[0]?.name?.toLowerCase() || '';
      let prompt = buildComicPagePrompt(
        panels, artStyle, mangaGenre,
        characterRefs.map((c) => ({ name: c.name, prompt: c.prompt })),
        sfxMode === 'auto'
      );
      if (feedback.trim()) {
        prompt += `\nUser revision request: ${feedback.trim()}`;
      }
      const effectiveSettings: ImageGenSettings = {
        mode: imageGenMode,
        referenceImageBase64: characterRefs[0]?.image_url ?? referenceImageBase64,
        controlImageBase64,
        ipAdapterScale,
        controlnetScale,
        characterName: firstCharName || undefined,
        storyId: projectId,
        style: imageGenStyle,
      };
      const newImageUrl = await fetchImageFromAI(prompt, localImageApiUrl || undefined, effectiveSettings);
      setStep4((prev) => {
        if (!prev.data) return prev;
        const prevState = prev.data.pageStates[pageId];
        return {
          ...prev,
          data: {
            ...prev.data,
            pageStates: {
              ...prev.data.pageStates,
              [pageId]: { ...(prevState ?? {}), status: 'comparing', pendingUrl: newImageUrl, error: null },
            },
          },
          lastUpdated: new Date().toISOString(),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image generation failed.';
      setStep4((prev) => {
        if (!prev.data) return prev;
        const prevState = prev.data.pageStates[pageId];
        return {
          ...prev,
          data: {
            ...prev.data,
            pageStates: {
              ...prev.data.pageStates,
              [pageId]: {
                ...(prevState ?? {}),
                status: currentImageUrl ? 'success' : 'error',
                error: message,
                pendingUrl: null,
              },
            },
          },
        };
      });
    }
  };

  const acceptPanelRegen = (pageNumber: number) => {
    const pageId = `page-${pageNumber}`;
    setStep4((prev) => {
      if (!prev.data) return prev;
      const prevState = prev.data.pageStates[pageId];
      if (!prevState?.pendingUrl) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          pageStates: {
            ...prev.data.pageStates,
            [pageId]: { ...prevState, status: 'success', imageUrl: prevState.pendingUrl, pendingUrl: null },
          },
        },
      };
    });
  };

  const rejectPanelRegen = (pageNumber: number) => {
    const pageId = `page-${pageNumber}`;
    setStep4((prev) => {
      if (!prev.data) return prev;
      const prevState = prev.data.pageStates[pageId];
      return {
        ...prev,
        data: {
          ...prev.data,
          pageStates: {
            ...prev.data.pageStates,
            [pageId]: { ...prevState, status: prevState?.imageUrl ? 'success' : 'idle', pendingUrl: null, error: null },
          },
        },
      };
    });
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
      success: list.filter((e) => e.status === 'success' || e.status === 'comparing').length,
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

  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'error'>('idle');

  async function buildExportPages(
    data: {
      panels: Step4Panel[];
      pageStates: Record<string, Step4PanelState>;
      panelStates: Record<string, Step4PanelState>;
    },
    panelBubbles?: Record<string, SingleBubble[]>,
  ): Promise<ExportPage[]> {
    const byPage = new Map<number, Step4Panel[]>();
    for (const panel of data.panels) {
      const arr = byPage.get(panel.pageNumber) ?? [];
      arr.push(panel);
      byPage.set(panel.pageNumber, arr);
    }

    const sortedByPage = Array.from(byPage.entries()).sort(([a], [b]) => a - b);

    // Full-page mode: page images already composited (generated in "Full Page" mode)
    const hasPageImages = sortedByPage.some(([pageNumber]) => {
      const s = data.pageStates[`page-${pageNumber}`];
      return s?.status === 'success' && s.imageUrl;
    });

    if (hasPageImages) {
      const pages: ExportPage[] = [];
      for (const [pageNumber, panels] of sortedByPage) {
        const state = data.pageStates[`page-${pageNumber}`];
        if (!state || state.status !== 'success' || !state.imageUrl) continue;
        pages.push({
          pageNumber,
          imageUrl: state.imageUrl,
          panels: panels.map((pan) => ({
            panelNumber: pan.panelNumber,
            contextLabel: pan.contextLabel,
            shotType: pan.shotType,
            dialogueSfx: pan.dialogueSfx,
            aiImagePrompt: pan.aiImagePrompt,
          })),
        });
      }
      return pages;
    }

    // Panel-by-panel mode: compose individual panel images into full pages on the fly.
    const LAYOUT_FALLBACKS: Record<number, string> = {
      1: 'single', 2: 'horizontal_duo', 3: 'three_panels_row',
      4: 'grid_2x2', 5: 'splash_top', 6: 'grid_2x3',
    };
    const allPanelImages: string[][] = [];
    const allLayouts: string[] = [];
    const pageNumbers: number[] = [];

    for (const [pageNumber, panelList] of sortedByPage) {
      const sorted = [...panelList].sort((a, b) => a.panelNumber - b.panelNumber);
      const rawImgs = sorted.map(p => {
        const url = data.panelStates[p.id]?.imageUrl;
        return url ? { id: p.id, url } : null;
      }).filter(Boolean) as Array<{ id: string; url: string }>;
      if (!rawImgs.length) continue;

      // Composite bubbles onto each panel image when panelBubbles are provided
      const imgs: string[] = await Promise.all(rawImgs.map(async ({ id, url }) => {
        const bubbles = panelBubbles?.[id];
        if (bubbles?.length) {
          try {
            const blob = await compositePanelToBlob(url, bubbles);
            return URL.createObjectURL(blob);
          } catch { /* fallback to raw image */ }
        }
        return url;
      }));

      allPanelImages.push(imgs);
      // Use the layout the user chose in the editor; fall back to a sensible default by count
      allLayouts.push(pageLayoutNames[pageNumber] ?? LAYOUT_FALLBACKS[imgs.length] ?? 'single');
      pageNumbers.push(pageNumber);
    }

    if (!allPanelImages.length) return [];

    // Collect any object URLs we created for composited panels so we can revoke them after
    const blobUrls = allPanelImages.flat().filter(u => u.startsWith('blob:'));
    const b64Pages = await recomposePages(allPanelImages, allLayouts, DEFAULT_BORDER_CONFIG);
    blobUrls.forEach(u => URL.revokeObjectURL(u));

    return b64Pages.map((b64, i) => ({
      pageNumber: pageNumbers[i],
      imageUrl: `data:image/png;base64,${b64}`,
      panels: (byPage.get(pageNumbers[i]) ?? []).map((pan) => ({
        panelNumber: pan.panelNumber,
        contextLabel: pan.contextLabel,
        shotType: pan.shotType,
        dialogueSfx: pan.dialogueSfx,
        aiImagePrompt: pan.aiImagePrompt,
      })),
    }));
  }

  const exportZip = useCallback(async (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => {
    if (!step4.data) return;
    setExportStatus('exporting');
    try {
      const pages = await buildExportPages(step4.data, panelBubbles);
      await exportAsZip(pages, { includeMetadata, projectId: projectId || 'comic' });
      trackEvent({
        type:          'export',
        story_id:      projectId || 'unknown',
        style:         imageGenStyle || 'manga',
        duration_ms:   0,
        has_character: false,
        export_format: 'zip',
        page_count:    pages.length,
      });
      setExportStatus('idle');
    } catch {
      setExportStatus('error');
    }
  }, [step4.data, projectId, imageGenStyle]);

  const exportPdf = useCallback(async (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => {
    if (!step4.data) return;
    setExportStatus('exporting');
    try {
      const pages = await buildExportPages(step4.data, panelBubbles);
      await exportAsPdf(pages, { includeMetadata, projectId: projectId || 'comic' });
      trackEvent({
        type:          'export',
        story_id:      projectId || 'unknown',
        style:         imageGenStyle || 'manga',
        duration_ms:   0,
        has_character: false,
        export_format: 'pdf',
        page_count:    pages.length,
      });
      setExportStatus('idle');
    } catch {
      setExportStatus('error');
    }
  }, [step4.data, projectId, imageGenStyle]);

  const exportEpub = useCallback(async (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => {
    if (!step4.data) return;
    setExportStatus('exporting');
    try {
      const pages = await buildExportPages(step4.data, panelBubbles);
      await exportAsEpub(pages, { includeMetadata, projectId: projectId || 'comic' });
      trackEvent({
        type:          'export',
        story_id:      projectId || 'unknown',
        style:         imageGenStyle || 'manga',
        duration_ms:   0,
        has_character: false,
        export_format: 'epub',
        page_count:    pages.length,
      });
      setExportStatus('idle');
    } catch {
      setExportStatus('error');
    }
  }, [step4.data, projectId, imageGenStyle]);

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
        regeneratedAfterApproval: false,
        approvedAt: null,
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
        regeneratedAfterApproval: false,
        approvedAt: null,
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
        regeneratedAfterApproval: false,
        approvedAt: null,
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

    const emptyV = { versions: [] as PanelVersion[], pendingUrl: null, pendingFeedback: '' };
    const panelStates: Record<string, Step4PanelState> = {
      'p1-n1': { status: 'success', imageUrl: mockImageUrl('Panel 1'), error: null, ...emptyV },
      'p1-n2': { status: 'idle', imageUrl: null, error: null, ...emptyV },
      'p2-n1': { status: 'error', imageUrl: null, error: 'Mock: generation failed.', ...emptyV },
    };

    const pageStates: Record<string, Step4PanelState> = {
      'page-1': { status: 'success', imageUrl: mockImageUrl('Page 1'), error: null, ...emptyV },
      'page-2': { status: 'error', imageUrl: null, error: 'Mock: generation failed.', ...emptyV },
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
      regeneratedAfterApproval: false,
      approvedAt: null,
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
      regeneratedAfterApproval: false,
      approvedAt: null,
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

  const applyLoadedImages = (images: ProjectImageEntry[]) => {
    if (!images.length) return;
    const panelUpdates: Record<string, string> = {};
    const pageUpdates: Record<string, string> = {};
    for (const { image_key, image_data } of images) {
      if (image_key.startsWith('panel:')) panelUpdates[image_key.slice(6)] = image_data;
      else if (image_key.startsWith('page:')) pageUpdates[image_key.slice(5)] = image_data;
    }
    const blank: Step4PanelState = { status: 'idle', imageUrl: null, error: null, versions: [], pendingUrl: null, pendingFeedback: '' };
    setStep4((prev) => {
      if (!prev.data) return prev;
      const nextPanel = { ...prev.data.panelStates };
      for (const [k, url] of Object.entries(panelUpdates)) {
        nextPanel[k] = { ...(nextPanel[k] ?? blank), status: 'success', imageUrl: url };
      }
      const nextPage = { ...prev.data.pageStates };
      for (const [k, url] of Object.entries(pageUpdates)) {
        nextPage[k] = { ...(nextPage[k] ?? blank), status: 'success', imageUrl: url };
      }
      return { ...prev, data: { ...prev.data, panelStates: nextPanel, pageStates: nextPage } };
    });
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
      if (imageGenSettings.page_layout_names && typeof imageGenSettings.page_layout_names === 'object') {
        // JSON keys are always strings — convert back to number keys
        const restored: Record<number, string> = {};
        for (const [k, v] of Object.entries(imageGenSettings.page_layout_names as Record<string, unknown>)) {
          const pageNum = Number(k);
          if (!isNaN(pageNum) && typeof v === 'string') restored[pageNum] = v;
        }
        setPageLayoutNames(restored);
      }
      if (imageGenSettings.border_config && typeof imageGenSettings.border_config === 'object') {
        const bc = imageGenSettings.border_config as Record<string, unknown>;
        setBorderConfig(prev => ({
          ...prev,
          ...(typeof bc.borderColor === 'string'  ? { borderColor: bc.borderColor }  : {}),
          ...(typeof bc.borderWidth === 'number'   ? { borderWidth: bc.borderWidth }  : {}),
          ...(typeof bc.gutterColor === 'string'   ? { gutterColor: bc.gutterColor }  : {}),
          ...(typeof bc.gutterWidth === 'number'   ? { gutterWidth: bc.gutterWidth }  : {}),
          ...(typeof bc.pageMargin  === 'number'   ? { pageMargin:  bc.pageMargin  }  : {}),
          ...(typeof bc.pageBg      === 'string'   ? { pageBg:      bc.pageBg      }  : {}),
        }));
      }

      const s1Data = toRecord(s1.data);
      setStep1({
        data: s1.data ? {
          analysisMarkdown: String(s1Data.analysisMarkdown || ''),
          characterBreakdown: Array.isArray(s1Data.characterBreakdown) ? (s1Data.characterBreakdown as unknown[]).map(String) : [],
          structuredJson: (s1Data.structuredJson as Record<string, unknown> | null) ?? null,
        } : null,
        isLoading: false,
        isApproved: Boolean(s1.isApproved),
        regeneratedAfterApproval: false,
        locked: false,
        error: null,
        lastUpdated: String(s1.lastUpdated || nowIso),
        approvedAt: s1.isApproved ? String(s1.lastUpdated || nowIso) : null,
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
        regeneratedAfterApproval: false,
        locked: false,
        error: null,
        lastUpdated: String(s2.lastUpdated || nowIso),
        approvedAt: s2.isApproved ? String(s2.lastUpdated || nowIso) : null,
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
        regeneratedAfterApproval: false,
        locked: false,
        error: null,
        lastUpdated: String(s2ir.lastUpdated || nowIso),
        approvedAt: s2ir.isApproved ? String(s2ir.lastUpdated || nowIso) : null,
      });

      setStep3({
        data: {
          scriptMarkdown,
          structuredJson: (s3Data.structuredJson as Record<string, unknown> | null) ?? null,
        },
        isLoading: false,
        isApproved: Boolean(s3.isApproved),
        regeneratedAfterApproval: false,
        locked: false,
        error: null,
        lastUpdated: String(s3.lastUpdated || nowIso),
        approvedAt: s3.isApproved ? String(s3.lastUpdated || nowIso) : null,
      });

      const s4Data = toRecord(s4.data);
      const panels = Array.isArray(s4Data.panels) ? (s4Data.panels as Step4Panel[]) : [];
      setStep4({
        data: panels.length > 0 ? { panels, panelStates: {}, pageStates: {}, isGenerating: false } : null,
        isLoading: false,
        isApproved: Boolean(s4.isApproved),
        regeneratedAfterApproval: false,
        locked: false,
        error: null,
        lastUpdated: String(s4.lastUpdated || nowIso),
        approvedAt: s4.isApproved ? String(s4.lastUpdated || nowIso) : null,
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
        regeneratedAfterApproval: false,
        approvedAt: null,
        locked: false,
        error: null,
        lastUpdated: String(step1ApiData.last_updated || nowIso),
      });
      setStep2({
        data: { designMarkdown: String(step2ApiDataData.design_markdown || ''), structuredJson: json, aiPrompts: [] },
        isLoading: false,
        isApproved: step2ApiData.status === 'approved',
        regeneratedAfterApproval: false,
        approvedAt: null,
        locked: false,
        error: null,
        lastUpdated: String(step2ApiData.last_updated || nowIso),
      });
      setStep3({
        data: { scriptMarkdown, structuredJson: json },
        isLoading: false,
        isApproved: step3ApiData.status === 'approved',
        regeneratedAfterApproval: false,
        approvedAt: null,
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

  const collectImagesToSave = (): ProjectImageEntry[] => {
    if (!step4.data) return [];
    const entries: ProjectImageEntry[] = [];
    // Save only the images that match the active generation mode so the Dialogue tab,
    // the cloud save, and the editor all reflect exactly the same images.
    if (comicPageMode === 'page') {
      for (const [key, state] of Object.entries(step4.data.pageStates)) {
        if (state.status === 'success' && state.imageUrl) {
          entries.push({ image_key: `page:${key}`, image_data: state.imageUrl });
        }
      }
    } else {
      for (const [key, state] of Object.entries(step4.data.panelStates)) {
        if (state.status === 'success' && state.imageUrl) {
          entries.push({ image_key: `panel:${key}`, image_data: state.imageUrl });
        }
      }
    }
    return entries;
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
        page_layout_names: pageLayoutNames,
        border_config: borderConfig,
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
      const fullSave = buildFullSave();
      const images = collectImagesToSave();
      await projectsApi.save(fullSave);
      if (images.length > 0) {
        await projectsApi.saveImages(projectId, images);
      }
      setCloudSaveStatus('saved');
      window.setTimeout(() => setCloudSaveStatus('idle'), 2000);
    } catch (err) {
      setCloudSaveStatus('error');
      setCloudSaveError(toApiError(err).message);
    }
  };

  const loadFromCloud = async (cloudProjectId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const [projectRes, imagesRes] = await Promise.all([
        projectsApi.load(cloudProjectId),
        projectsApi.loadImages(cloudProjectId).catch(() => ({ data: { images: [] as ProjectImageEntry[] } })),
      ]);
      const result = restoreFromFullSave(projectRes.data as unknown as Record<string, unknown>);
      if (result.success) applyLoadedImages(imagesRes.data.images);
      return result;
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
    imageGenStyle,
    referenceImageBase64,
    controlImageBase64,
    ipAdapterScale,
    controlnetScale,
    useStreaming,
    sfxMode,
    setSfxMode,
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
    setImageGenStyle,
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
    handleRevokeApproval,
    handleRetry,
    handleGenerateCharacterReferences,
    handleRegenerateCharacterImage,
    handleSelectCharacterCandidate,
    handleApproveCharacterReferences,
    handleRetryCharacterReferences,
    comicPageMode,
    setComicPageMode,
    resetComicPageMode,
    step5,
    pageLayoutNames,
    pagePanelDimensions,
    setPageLayout,
    setRawPanelDimensions: (pageNumber, dimMap) =>
      setPagePanelDimensions((prev) => ({ ...prev, [pageNumber]: dimMap })),
    handleStartFullGeneration,
    handleStartPanelGeneration,
    handleRegenerateSinglePanel,
    handleRegeneratePage,
    handleRegenerateWithFeedback,
    acceptPanelRegen,
    rejectPanelRegen,
    copyProjectJson,
    downloadProjectJson,
    exportZip,
    exportPdf,
    exportEpub,
    exportStatus,
    getStep2PromptList,
    getSelectedCharacterReferences,
    getCooldownSeconds,
    loadMockStepData,
    loadMockCharacterReview,
    loadMockPipeline,
    loadProjectJson,
    borderConfig,
    setBorderConfig,
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

