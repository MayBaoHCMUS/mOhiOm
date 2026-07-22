'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  textGenApi,
  comicLayoutApi,
  analyzeStoryStructuredStream,
  characterDesignsStructuredStream,
  panelScriptStructuredStream,
  projectsApi,
  settingsApi,
  imageGenApi,
  toApiError,
} from '@/services/api';
import type { FullProjectSave, CloudProjectListItem, CharacterSummary, ProjectImageEntry, ImageGenMode as ImageGenBackendMode } from '@/services/api';
import { exportAsZip, exportAsPdf, exportAsEpub } from '@/lib/export';
import { recomposePages, DEFAULT_BORDER_CONFIG } from '@/lib/borderComposer';
import type { BorderConfig } from '@/lib/borderComposer';
import { compositePanelToBlob } from '@/lib/bubbles/exportComposite';
import { trackEvent } from '@/lib/analytics';
import {
  getImageApiUrl, setImageApiUrl,
  getMultiCharacterApiUrl, setMultiCharacterApiUrl,
  getEnableMultiCharacterMode, setEnableMultiCharacterMode as persistEnableMultiCharacterMode,
} from '@/lib/imageApiUrl';
import { DEFAULT_IMAGE_STYLE, IMAGE_STYLE_PREF_KEY } from '@/lib/imageStyles';
import type { ExportPage } from '@/lib/export';
import type { SingleBubble } from '@/components/studio-steps/DialogueEditor';
import { getPanelBoxAspectRatio } from '@/components/studio-steps/DialogueEditor';
import { useNotifications } from '@/context/NotificationContext';
import type { CharacterReference } from '@/lib/characterReference';
import { findCharacterReference, pickCharacterReference, findAllCharacterMatches } from '@/lib/characterReference';

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
  seed?: number;
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
  characterNames?: string[];
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
 * so the project snapshot stays within the localStorage 5 MB quota. Images are
 * R2 URLs after generation, so this is normally a no-op — kept as a safety net
 * in case a base64 string ever ends up in the snapshot (e.g. a mock/dev path).
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

// Some upstream failures (proxy/CDN outages) surface a raw error page body in
// the message (e.g. "...Body preview: <!DOCTYPE html>..."). Strip that before
// it reaches the UI — it's debug info, not something a user should ever see.
function friendlyErrorMessage(raw: string | null | undefined): string {
  if (!raw) return 'Something went wrong. Please try again.';
  const htmlIdx = raw.search(/<!DOCTYPE|<html/i);
  const trimmed = (htmlIdx !== -1 ? raw.slice(0, htmlIdx) : raw)
    .replace(/\s*Body preview:\s*$/i, '')
    .trim();
  const base = trimmed || 'Request failed. Please try again.';
  return base.length > 180 ? `${base.slice(0, 177)}…` : base;
}

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
  settings?: ImageGenSettings,
  backendMode: ImageGenBackendMode = 'builtin'
): Promise<string> => {
  if (backendMode === 'byok') {
    try {
      const resp = await imageGenApi.generate({
        prompt: imagePrompt,
        negative_prompt: PANEL_NEGATIVE_PROMPT,
        width: settings?.width,
        height: settings?.height,
      });
      return resp.data.image_url;
    } catch (err) {
      throw new Error(toApiError(err).message);
    }
  }

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
      ip_adapter_scale: settings?.ipAdapterScale ?? 0.6,
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
    if (settings?.seed !== undefined)   requestBody.seed   = settings.seed;

    console.group('[fetchImageFromAI] Image generation request');
    console.log('Proxy URL   :', '/api/image-proxy');
    console.log('Target URL  :', localImageApiUrl);
    console.log('Mode        :', mode);
    const loggedRequestBody = { ...requestBody };
    if (typeof loggedRequestBody.reference_image_b64 === 'string') {
      loggedRequestBody.reference_image_b64 = `<base64, length: ${loggedRequestBody.reference_image_b64.length}>`;
    }
    if (typeof loggedRequestBody.control_image_b64 === 'string') {
      loggedRequestBody.control_image_b64 = `<base64, length: ${loggedRequestBody.control_image_b64.length}>`;
    }
    console.log('Request body:', loggedRequestBody);

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
        let detailMsg = typeof serverDetail === 'string' ? serverDetail : JSON.stringify(serverDetail);
        if (detailMsg.length > 200) {
          detailMsg = `${detailMsg.slice(0, 200)}…`;
        }
        console.error('Error body  :', errData);
        console.groupEnd();
        throw new Error(serverDetail ? `Image API error: ${detailMsg}` : `Image API error (${response.status})`);
      }

      const result = (await response.json()) as { status?: string; image_url?: string; message?: string };
      console.log('Response    :', { status: result.status, message: result.message, image_url: result.image_url });
      console.groupEnd();

      if (result.status !== 'success' || !result.image_url) {
        throw new Error(result.message || 'Local image API did not return an image.');
      }

      return result.image_url;
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

// Separate from fetchImageFromAI on purpose — OmniGen2 (multi-character
// backend) has its own endpoint contract, its own proxy route, and is
// notably slower (larger model, possibly cpu_offload), so it needs a much
// longer timeout than the single-character path above.
const fetchMultiCharacterImageFromAI = async (
  scenePrompt: string,
  multiCharApiUrl: string,
  settings: {
    storyId: string;
    characterNames: string[];
    style: string;
    width?: number;
    height?: number;
    imageGuidanceScale?: number;
    textGuidanceScale?: number;
    numInferenceSteps?: number;
    seed?: number;
  }
): Promise<string> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 180000);

  const requestBody = {
    url: multiCharApiUrl,
    story_id: settings.storyId,
    scene_prompt: scenePrompt,
    negative_prompt: 'blurry, low quality, deformed, extra limbs, bad anatomy, watermark, text',
    character_names: settings.characterNames.map((n) => n.toLowerCase()),
    style: settings.style,
    width: settings.width,
    height: settings.height,
    image_guidance_scale: settings.imageGuidanceScale ?? 2.8,
    text_guidance_scale: settings.textGuidanceScale ?? 5.0,
    num_inference_steps: settings.numInferenceSteps ?? 30,
    seed: settings.seed,
  };

  console.group('[fetchMultiCharacterImageFromAI] OmniGen2 generation request');
  console.log('Request body:', requestBody);

  try {
    const response = await fetch('/api/image-proxy/multi-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    console.log('HTTP status:', response.status);
    console.groupEnd();

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      const detail = errData?.details?.detail ?? errData?.error ?? `HTTP ${response.status}`;
      throw new Error(`Multi-character image API error: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }

    const result = (await response.json()) as { status?: string; image_url?: string; message?: string };
    if (result.status !== 'success' || !result.image_url) {
      throw new Error(result.message || 'Multi-character image API did not return an image.');
    }
    return result.image_url;
  } catch (err) {
    console.groupEnd();
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
};

/**
 * Fetch an image URL (typically an R2 URL) and convert it to a base64 data
 * URL. Used at boundaries that still need raw image bytes (e.g. sending a
 * reference image to the Kaggle IP-adapter server) now that images are
 * stored as URLs rather than base64.
 */
const fetchImageAsBase64 = async (url: string): Promise<string> => {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
  const charactersRegex =
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*{0,2})?characters(?:\*{0,2})?\s*:\s*([^\n]+)/i;

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
      const characterNames = (body.match(charactersRegex)?.[1] || '')
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name && !/^none$/i.test(name));

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
      if (characterNames.length) p.characterNames = characterNames;
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
 * We keep: art_style + everything from the first shot_type onward. The
 * dropped {character_tags} segment is why callers re-attach the character's
 * ai_image_prompt_ready via withCharacterAppearance() below — otherwise
 * appearance consistency depends entirely on the IP-Adapter reference image.
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

// A fresh seed per call so panels sharing the same reference image, style, and
// (after prompt cleaning) near-identical text don't collapse into duplicate
// output from the underlying diffusion backend.
const randomImageSeed = (): number => Math.floor(Math.random() * 2_147_483_647);

const buildComicPagePrompt = (
  panels: Step4Panel[],
  artStyle: string,
  mangaGenre: string,
  _characterRefs: Array<{ name: string; prompt: string }>,
  includeSfx = false
): string => {
  // Per-panel character appearance tags are stripped here (see buildCleanPanelPrompt);
  // callers re-attach one page-level appearance anchor via withCharacterAppearance().
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

// Re-attaches the matched character's full ai_image_prompt_ready (physical
// appearance) to a scene prompt that had its character tags stripped out.
// This is a second, text-based anchor for appearance consistency alongside
// the IP-Adapter reference image — needed because a missing/stale reference
// (e.g. server restarted, RAM store empty) otherwise leaves nothing anchoring
// the character's look at all.
const withCharacterAppearance = (scenePrompt: string, characterPrompt?: string): string =>
  characterPrompt ? `${characterPrompt}. ${scenePrompt}` : scenePrompt;

export type { CharacterReference };

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
  multiCharacterApiUrl: string;
  setMultiCharacterApiUrl: (url: string) => void;
  enableMultiCharacterMode: boolean;
  setEnableMultiCharacterMode: (v: boolean) => void;
  imageGenMode: ImageGenMode;
  imageGenBackendMode: ImageGenBackendMode;
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
  panelAutoRetryInfo: { round: number; totalRounds: number; remaining: number } | null;
  cancelPanelAutoRetry: () => void;
  handleRegenerateSinglePanel: (panel: Step4Panel, characterNamesOverride?: string[]) => Promise<void>;
  handleRegeneratePage: (pageNumber: number) => Promise<void>;
  handleRegenerateWithFeedback: (pageNumber: number, feedback: string) => Promise<void>;
  acceptPanelRegen: (pageNumber: number) => Promise<void>;
  rejectPanelRegen: (pageNumber: number) => void;
  copyProjectJson: () => Promise<void>;
  downloadProjectJson: () => void;
  exportZip: (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => Promise<void>;
  exportPdf: (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => Promise<void>;
  exportPrintPdf: (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => Promise<void>;
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
  lastSavedAt: string | null;
  saveToCloud: () => Promise<void>;
  loadFromCloud: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  clearProjectFromUrl: () => void;
  listCloudProjects: () => Promise<CloudProjectListItem[]>;
  injectLibraryCharacters: (chars: CharacterSummary[]) => void;
  addCandidateFromImage: (characterId: string, imageDataUrl: string) => void;
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

export function ComicGenerationProvider({
  children,
  initialProjectId,
}: {
  children: React.ReactNode;
  initialProjectId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { addNotification } = useNotifications();
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
  const [multiCharacterApiUrl, setMultiCharacterApiUrlState] = useState('');
  const [enableMultiCharacterMode, setEnableMultiCharacterMode] = useState(false);
  const [imageGenBackendMode, setImageGenBackendMode] = useState<ImageGenBackendMode>('builtin');
  const [panelAutoRetryInfo, setPanelAutoRetryInfo] = useState<{ round: number; totalRounds: number; remaining: number } | null>(null);
  const panelAutoRetryCancelRef = useRef(false);
  // Caches image_url -> raw base64 conversions for the duration of the provider's
  // lifetime, so a batch of panels sharing the same character reference only
  // fetches + converts that reference image once instead of once per panel.
  const referenceImageB64CacheRef = useRef<Map<string, string>>(new Map());
  const [imageGenMode, setImageGenMode] = useState<ImageGenMode>(1);
  const [imageGenStyle, setImageGenStyle] = useState<string>(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem(IMAGE_STYLE_PREF_KEY) || DEFAULT_IMAGE_STYLE
      : DEFAULT_IMAGE_STYLE
  );
  const [referenceImageBase64, setReferenceImageBase64] = useState('');
  const [controlImageBase64, setControlImageBase64] = useState('');
  const [ipAdapterScale, setIpAdapterScale] = useState(0.6);
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
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
  // Long-running generation handlers span many renders (batches + inter-batch sleeps),
  // so their closures see a stale `step4` unless they read the freshest value through
  // this ref instead — see collectImagesToSave().
  const step4Ref = useRef(step4);
  useEffect(() => {
    step4Ref.current = step4;
  }, [step4]);
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

  // Auto-load the project named by the ?project= URL param (set by dashboard/character-manager).
  const initialLoadRanRef = useRef(false);
  useEffect(() => {
    if (initialLoadRanRef.current) return;
    initialLoadRanRef.current = true;
    if (!initialProjectId) return;
    loadFromCloud(initialProjectId).catch(() => { /* silently ignore if project was deleted */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ?project=<id> in the URL in sync, but only when a project is explicitly opened via
  // loadFromCloud — not for incidental projectId changes (typing a new ID, the Story Setup
  // pre-fill restore below, etc.). Uses the current pathname rather than a hardcoded route since
  // this provider is shared by both the pipeline (/studio) and the standalone editor (/studio/editor).
  const lastSyncedProjectIdRef = useRef<string | null>(initialProjectId ?? null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

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
    const stored = getImageApiUrl();
    if (stored) {
      setLocalImageApiUrl(stored);
    }
  }, []);

  useEffect(() => {
    setImageApiUrl(localImageApiUrl);
  }, [localImageApiUrl]);

  useEffect(() => {
    const stored = getMultiCharacterApiUrl();
    if (stored) setMultiCharacterApiUrlState(stored);
  }, []);

  useEffect(() => {
    setMultiCharacterApiUrl(multiCharacterApiUrl);
  }, [multiCharacterApiUrl]);

  useEffect(() => {
    setEnableMultiCharacterMode(getEnableMultiCharacterMode());
  }, []);

  useEffect(() => {
    persistEnableMultiCharacterMode(enableMultiCharacterMode);
  }, [enableMultiCharacterMode]);

  useEffect(() => {
    settingsApi.getImageGenConfig()
      .then((r) => setImageGenBackendMode(r.data.mode))
      .catch(() => setImageGenBackendMode('builtin'));
  }, []);

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
    imageUrl: string
  ): Promise<void> => {
    if (!localImageApiUrl) return;
    // imageUrl is a real R2 URL after generation (not a data: URI), so fetch
    // and convert it to base64 before sending to the Kaggle IP-adapter server.
    // Retried for the same reason as resolveReferenceImageBase64 — a transient
    // network/CORS/CDN-propagation blip shouldn't permanently drop the character's
    // reference image from the server's RAM store.
    const dataUri = imageUrl.startsWith('data:')
      ? imageUrl
      : await withRetry(() => fetchImageAsBase64(imageUrl), 3, 2000).catch(() => '');
    const b64 = dataUri.startsWith('data:') ? dataUri.split(',')[1] ?? '' : dataUri;
    if (!b64) {
      console.error(
        '[saveCharacterToServer] Failed to fetch/convert character reference image after retries — ' +
        'server RAM store will NOT be updated for this character',
        { characterName, imageUrl }
      );
      return;
    }
    trackEvent({
      type:          'character_save',
      story_id:      projectId || 'unknown',
      style:         imageGenStyle || 'manga',
      duration_ms:   0,
      has_character: true,
    });
    // Awaited (not fire-and-forget) so callers that need the server's RAM
    // store to actually be populated before proceeding — e.g.
    // resyncCharacterReferencesToServer — can rely on this resolving only
    // after the save request completes. Callers that don't care (e.g. Step 2
    // approval) simply don't await it, preserving the old non-blocking feel.
    await fetch('/api/image-proxy/characters', {
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

  // Resolves a character reference (image_url or already-base64 data URI) to raw
  // base64 for the `/generate-page` payload, caching per URL so a batch of panels
  // sharing one character only fetches + converts that reference image once.
  // A conversion failure here silently strips reference_image_b64 from the
  // outgoing request (no IP-Adapter conditioning at all), so it's retried and
  // logged loudly rather than swallowed — only an empty/undefined refUrl
  // (nothing to convert in the first place) is the quiet, expected path.
  const resolveReferenceImageBase64 = useCallback(async (refUrl: string | undefined): Promise<string> => {
    if (!refUrl) return '';
    if (refUrl.startsWith('data:')) {
      return refUrl.split(',')[1] ?? '';
    }
    const cache = referenceImageB64CacheRef.current;
    const cached = cache.get(refUrl);
    if (cached !== undefined) return cached;

    try {
      const dataUri = await withRetry(() => fetchImageAsBase64(refUrl), 3, 2000);
      const b64 = dataUri.split(',')[1] ?? '';
      if (!b64) {
        console.warn(
          '[resolveReferenceImageBase64] fetchImageAsBase64 resolved but produced empty base64 payload',
          { refUrl }
        );
        return '';
      }
      cache.set(refUrl, b64);
      return b64;
    } catch (error) {
      console.error(
        '[resolveReferenceImageBase64] Failed to fetch/convert reference image after retries — ' +
        'panel will be generated WITHOUT a reference image (no IP-Adapter conditioning)',
        { refUrl, error }
      );
      return '';
    }
  }, []);

  // Re-pushes every selected character's reference image to the server's RAM
  // store right before a generation batch starts, so panel/page generation
  // has a fresh reference even if the server restarted since Step 2 was approved.
  const resyncCharacterReferencesToServer = useCallback(async (): Promise<void> => {
    if (!localImageApiUrl) return;
    const refs = getSelectedCharacterReferences();
    await Promise.all(
      refs.map((ref) => saveCharacterToServer(ref.name, ref.image_url))
    );
  }, [localImageApiUrl, getSelectedCharacterReferences, saveCharacterToServer]);

  // OmniGen2's RAM character store is separate from SD1.5/SDXL's server, so
  // the same reference image needs saving to both if a story mixes
  // single-character and multi-character panels.
  const saveCharacterToMultiCharacterServer = useCallback(async (
    characterName: string,
    imageUrl: string
  ): Promise<void> => {
    if (!multiCharacterApiUrl) return;
    const dataUri = imageUrl.startsWith('data:')
      ? imageUrl
      : await withRetry(() => fetchImageAsBase64(imageUrl), 3, 2000).catch((err) => {
          console.warn(
            '[saveCharacterToMultiCharacterServer] Failed to fetch/convert reference image — ' +
            'Omni will 400 on any generation referencing this character until this succeeds',
            { characterName, imageUrl, error: err }
          );
          return '';
        });
    const b64 = dataUri.startsWith('data:') ? dataUri.split(',')[1] ?? '' : dataUri;
    if (!b64) return;
    const res = await fetch('/api/image-proxy/multi-character/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: multiCharacterApiUrl,
        story_id: projectId,
        character_name: characterName.toLowerCase(),
        reference_image_b64: b64,
      }),
    }).catch((err) => {
      console.warn('[saveCharacterToMultiCharacterServer] Failed to reach Omni /characters/save', { characterName, error: err });
      return null;
    });
    if (res && !res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn('[saveCharacterToMultiCharacterServer] Omni rejected character reference save', { characterName, status: res.status, detail });
    }
  }, [multiCharacterApiUrl, projectId]);

  const resyncCharacterReferencesToMultiCharacterServer = useCallback(async (): Promise<void> => {
    if (!enableMultiCharacterMode || !multiCharacterApiUrl) return;
    const refs = getSelectedCharacterReferences();
    await Promise.all(
      refs.map((ref) => saveCharacterToMultiCharacterServer(ref.name, ref.image_url))
    );
  }, [enableMultiCharacterMode, multiCharacterApiUrl, getSelectedCharacterReferences, saveCharacterToMultiCharacterServer]);

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

          textGenApi.analyzeStoryStructuredStream(
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
        const resp = await textGenApi.analyzeStoryStructured({
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

          textGenApi.generateCharacterDesignsStructuredStream(
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
        const resp = await textGenApi.generateCharacterDesignsStructured(step2Params);

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

          textGenApi.generatePanelScriptStructuredStream(
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
        const resp = await textGenApi.generatePanelScriptStructured({
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
              addNotification({
                title: 'Story analysis ready',
                message: 'AI analysis generated successfully.',
                variant: 'success',
                projectId,
              });
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
              const cleanMessage = friendlyErrorMessage(message);
              setStep1((prev) => ({
                ...prev,
                isLoading: false,
                streamingText: null,
                error: cleanMessage,
              }));
              addNotification({
                title: 'Story analysis failed',
                message: cleanMessage,
                variant: 'error',
                projectId,
              });
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
              addNotification({
                title: 'Character designs ready',
                message: 'AI design sheets generated successfully.',
                variant: 'success',
                projectId,
              });
              resolve();
            },
            onError(message, statusCode) {
              if (statusCode === 429) {
                const match = message.match(/(\d+(?:\.\d+)?)\s*s/);
                setCooldownUntil((prev) => ({ ...prev, 2: Date.now() + (match ? parseFloat(match[1]) : 30) * 1000 }));
              }
              const cleanMessage = friendlyErrorMessage(message);
              setStep2((prev) => ({ ...prev, isLoading: false, streamingText: null, error: cleanMessage }));
              addNotification({
                title: 'Character design generation failed',
                message: cleanMessage,
                variant: 'error',
                projectId,
              });
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
              addNotification({
                title: 'Panel script ready',
                message: 'AI panel script generated successfully.',
                variant: 'success',
                projectId,
              });
              resolve();
            },
            onError(message, statusCode) {
              if (statusCode === 429) {
                const match = message.match(/(\d+(?:\.\d+)?)\s*s/);
                setCooldownUntil((prev) => ({ ...prev, 3: Date.now() + (match ? parseFloat(match[1]) : 30) * 1000 }));
              }
              const cleanMessage = friendlyErrorMessage(message);
              setStep3((prev) => ({ ...prev, isLoading: false, streamingText: null, error: cleanMessage }));
              addNotification({
                title: 'Panel script generation failed',
                message: cleanMessage,
                variant: 'error',
                projectId,
              });
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

    // Characters are generated one at a time (not via Promise.all) because the
    // external Kaggle-tunnel image server chokes under concurrent load — same
    // reason panel generation batches/delays its requests (see generatePanelImages).
    const charResults: Record<string, 'success' | 'error'> = {};
    for (let i = 0; i < characters.length; i++) {
      const character = characters[i];

      setStep2ImageReview((prev) => {
        if (!prev.data) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            characters: prev.data.characters.map((c) =>
              c.characterId === character.characterId ? { ...c, status: 'loading', error: null } : c
            ),
          },
        };
      });

      try {
        // Omni branch — engages for every character when the model is set to
        // Omni. character_names is [] since this character has no reference
        // image yet (it's being created for the first time) — pure text-to-image.
        if (enableMultiCharacterMode && multiCharacterApiUrl) {
          try {
            const multiGenStart = performance.now();
            const multiImageUrl = await withRetry(
              () => fetchMultiCharacterImageFromAI(character.prompt, multiCharacterApiUrl, {
                storyId: projectId, characterNames: [], style: imageGenStyle, seed: randomImageSeed(),
              }),
              2,
              8000
            );
            trackEvent({
              type: 'character_save', story_id: projectId || 'unknown', style: imageGenStyle || 'manga',
              duration_ms: Math.round(performance.now() - multiGenStart), has_character: true,
            });
            const multiCandidateId = `${character.characterId}-${Date.now()}`;
            setStep2ImageReview((prev) => {
              if (!prev.data) return prev;
              return {
                ...prev,
                data: {
                  ...prev.data,
                  characters: prev.data.characters.map((c) =>
                    c.characterId === character.characterId
                      ? {
                          ...c,
                          status: 'success',
                          error: null,
                          candidates: [{ id: multiCandidateId, imageUrl: multiImageUrl, createdAt: new Date().toISOString() }],
                          selectedCandidateId: multiCandidateId,
                        }
                      : c
                  ),
                },
              };
            });
            charResults[character.characterId] = 'success';
            if (i < characters.length - 1) await sleep(10000);
            continue;
          } catch (multiError) {
            addNotification({
              title: 'Omni generation failed',
              message: `${character.name} fell back to SD1.5/SDXL.`,
              variant: 'partial',
              projectId,
            });
            console.warn(
              '[handleGenerateCharacterReferences] Omni generation failed, falling back to single-reference flow',
              { characterId: character.characterId, error: multiError }
            );
          }
        }
        // ── End Omni branch — everything below is the existing, unchanged
        // single-reference flow. ──
        const charSettings = settingsMap?.[character.characterId] ?? { mode: imageGenMode, referenceImageBase64, controlImageBase64, ipAdapterScale, controlnetScale, storyId: projectId, style: imageGenStyle };
        const imageUrl = await withRetry(
          () => fetchImageFromAI(character.prompt, localImageApiUrl || undefined, charSettings, imageGenBackendMode),
          3,
          3000
        );
        const candidateId = `${character.characterId}-${Date.now()}`;

        setStep2ImageReview((prev) => {
          if (!prev.data) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              characters: prev.data.characters.map((c) =>
                c.characterId === character.characterId
                  ? {
                      ...c,
                      status: 'success',
                      error: null,
                      candidates: [
                        {
                          id: candidateId,
                          imageUrl,
                          createdAt: new Date().toISOString(),
                        },
                      ],
                      selectedCandidateId: candidateId,
                    }
                  : c
              ),
            },
          };
        });
        charResults[character.characterId] = 'success';
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate image.';
        setStep2ImageReview((prev) => {
          if (!prev.data) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              characters: prev.data.characters.map((c) =>
                c.characterId === character.characterId ? { ...c, status: 'error', error: message } : c
              ),
            },
          };
        });
        charResults[character.characterId] = 'error';
      }

      if (i < characters.length - 1) {
        await sleep(10000);
      }
    }

    const charTotal = characters.length;
    const charSucceeded = Object.values(charResults).filter((r) => r === 'success').length;
    addNotification({
      title: 'Character images ready',
      message:
        charSucceeded === charTotal
          ? `All ${charTotal} character image${charTotal === 1 ? '' : 's'} generated.`
          : `${charSucceeded}/${charTotal} character images generated, ${charTotal - charSucceeded} failed.`,
      variant: charSucceeded === charTotal ? 'success' : charSucceeded > 0 ? 'partial' : 'error',
      projectId,
    });

    setStep2ImageReview((prev) => ({
      ...prev,
      isLoading: false,
      lastUpdated: new Date().toISOString(),
      data: prev.data ? { ...prev.data, isGenerating: false } : prev.data,
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

      // Omni branch — engages when the model is set to Omni. character_names
      // is [] (same rationale as handleGenerateCharacterReferences).
      if (enableMultiCharacterMode && multiCharacterApiUrl) {
        try {
          const multiGenStart = performance.now();
          const multiImageUrl = await withRetry(
            () => fetchMultiCharacterImageFromAI(prompt, multiCharacterApiUrl, {
              storyId: projectId, characterNames: [], style: imageGenStyle, seed: randomImageSeed(),
            }),
            2,
            8000
          );
          trackEvent({
            type: 'character_save', story_id: projectId || 'unknown', style: imageGenStyle || 'manga',
            duration_ms: Math.round(performance.now() - multiGenStart), has_character: true,
          });
          const multiCandidateId = `${target.characterId}-${Date.now()}`;
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
                        candidates: [...character.candidates, { id: multiCandidateId, imageUrl: multiImageUrl, createdAt: new Date().toISOString() }],
                        selectedCandidateId: multiCandidateId,
                      }
                    : character
                ),
              },
            };
          });
          addNotification({ title: 'Character image regenerated', message: target.name, variant: 'success', projectId });
          return;
        } catch (multiError) {
          addNotification({
            title: 'Omni generation failed',
            message: `${target.name} fell back to SD1.5/SDXL.`,
            variant: 'partial',
            projectId,
          });
          console.warn(
            '[handleRegenerateCharacterImage] Omni generation failed, falling back to single-reference flow',
            { characterId, error: multiError }
          );
        }
      }
      // ── End Omni branch — everything below is the existing, unchanged
      // single-reference flow. ──
      const imageUrl = await fetchImageFromAI(prompt, localImageApiUrl || undefined, effectiveSettings, imageGenBackendMode);
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
      addNotification({
        title: 'Character image regenerated',
        message: target.name,
        variant: 'success',
        projectId,
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
      addNotification({
        title: 'Character regeneration failed',
        message: target.name,
        variant: 'error',
        projectId,
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
    const _style = imageGenStyle?.toLowerCase().includes('webtoon') ? 'webtoon' : 'manga';
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
    options?: { batchSize?: number; delayMs?: number; characterNamesOverride?: string[] },
    shouldCancel?: () => boolean
  ): Promise<Record<string, { status: PanelImageStatus; imageUrl: string | null; error: string | null }>> => {
    const batchSize = Math.max(1, options?.batchSize ?? 1);
    const delayMs = Math.max(0, options?.delayMs ?? 10000);
    // When the user manually picks the characters for a single-panel regen, use
    // that list verbatim (and skip prompt-substring matching) instead of the
    // auto-detected panel.characterNames. Applies to every panel in this call —
    // only single-panel regen passes it, so scope is correct.
    const characterNamesOverride = options?.characterNamesOverride;
    const characterRefs = getSelectedCharacterReferences();
    const allResults: Record<string, { status: PanelImageStatus; imageUrl: string | null; error: string | null }> = {};

    for (let i = 0; i < panelsArray.length; i += batchSize) {
      if (shouldCancel?.()) break;
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
            // ── Omni branch — engages for EVERY panel when the model is set to
            // Omni (enableMultiCharacterMode + multiCharacterApiUrl), regardless
            // of character count (0, 1, or N — the server now supports all).
            // Any failure here falls through to the single-character flow below.
            if (enableMultiCharacterMode && multiCharacterApiUrl) {
              const matched = characterNamesOverride
                ? findAllCharacterMatches(characterRefs, characterNamesOverride, undefined)
                : findAllCharacterMatches(characterRefs, panel.characterNames, panel.aiImagePrompt);
              try {
                const multiCleanPrompt = buildCleanPanelPrompt(panel.aiImagePrompt, artStyle);
                let scenePromptWithSfx = multiCleanPrompt;
                if (sfxMode === 'auto') {
                  const sfx = panel.dialogueSfx?.trim();
                  if (sfx && !/^(none|no dialogue\/sfx provided\.?)$/i.test(sfx)) {
                    scenePromptWithSfx += `. Dialogue: ${sfx}`;
                  }
                }
                const multiPanelDimensions = pagePanelDimensions[panel.pageNumber]?.[panel.id];
                const multiGenStart = performance.now();
                const multiImageUrl = await withRetry(
                  () => fetchMultiCharacterImageFromAI(scenePromptWithSfx, multiCharacterApiUrl, {
                    storyId: projectId,
                    characterNames: matched.map((c) => c.name),
                    style: imageGenStyle,
                    width: multiPanelDimensions?.width,
                    height: multiPanelDimensions?.height,
                    seed: randomImageSeed(),
                  }),
                  2, // fewer retries — each attempt costs much more time than a normal generation
                  8000
                );
                trackEvent({
                  type: 'panel', story_id: projectId || 'unknown', style: imageGenStyle || 'manga',
                  duration_ms: Math.round(performance.now() - multiGenStart), has_character: matched.length > 0, ip_scale: 0,
                });
                return { id: panel.id, status: 'success' as const, imageUrl: multiImageUrl, error: null };
              } catch (multiError) {
                addNotification({
                  title: 'Omni generation failed',
                  message: `Panel ${panel.pageNumber}-${panel.panelNumber} fell back to SD1.5/SDXL.`,
                  variant: 'partial',
                  projectId,
                });
                console.warn(
                  '[generatePanelImages] Omni generation failed, falling back to single-reference flow',
                  { panelId: panel.id, error: multiError }
                );
              }
            }
            // ── End Omni branch — everything below is the existing,
            // unchanged single-character flow. ──
            let cleanPrompt = buildCleanPanelPrompt(panel.aiImagePrompt, artStyle);
            if (sfxMode === 'auto') {
              const sfx = panel.dialogueSfx?.trim();
              if (sfx && !/^(none|no dialogue\/sfx provided\.?)$/i.test(sfx)) {
                cleanPrompt += `. Dialogue: ${sfx}`;
              }
            }
            const panelDimensions = pagePanelDimensions[panel.pageNumber]?.[panel.id];
            // With a manual override, use findCharacterReference (no fallback to
            // characterRefs[0]) so an empty selection means "no reference" and a
            // ticked name is used verbatim — instead of pickCharacterReference,
            // which always defaults to the first character.
            const matchedChar = characterNamesOverride
              ? findCharacterReference(characterRefs, characterNamesOverride, undefined)
              : pickCharacterReference(characterRefs, panel.characterNames, panel.aiImagePrompt);
            const intendedRefSource = matchedChar?.image_url ?? referenceImageBase64;
            const refB64 = await resolveReferenceImageBase64(intendedRefSource);
            if (!refB64 && intendedRefSource) {
              addNotification({
                title: 'Reference image failed to load',
                message: `Panel ${panel.pageNumber}-${panel.panelNumber}${matchedChar ? ` (${matchedChar.name})` : ''} will generate without a character reference image.`,
                variant: 'partial',
                projectId,
              });
            }
            const finalPrompt = withCharacterAppearance(cleanPrompt, matchedChar?.prompt);
            const effectiveSettings: ImageGenSettings = {
              mode: imageGenMode,
              referenceImageBase64: refB64,
              controlImageBase64,
              ipAdapterScale,
              controlnetScale,
              characterName: matchedChar?.name?.toLowerCase() || undefined,
              storyId: projectId,
              style: imageGenStyle,
              width: panelDimensions?.width,
              height: panelDimensions?.height,
              seed: randomImageSeed(),
            };
            const genStart = performance.now();
            const imageUrl = await withRetry(
              () => fetchImageFromAI(finalPrompt, localImageApiUrl || undefined, effectiveSettings, imageGenBackendMode),
              3,
              3000
            );
            trackEvent({
              type:          'panel',
              story_id:      projectId || 'unknown',
              style:         imageGenStyle || 'manga',
              duration_ms:   Math.round(performance.now() - genStart),
              has_character: !!matchedChar,
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

      results.forEach((result) => {
        allResults[result.id] = { status: result.status, imageUrl: result.imageUrl, error: result.error };
      });

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

    return allResults;
  };

  const generatePageImages = async (
    pageEntries: Array<[number, Step4Panel[]]>,
    options?: { batchSize?: number; delayMs?: number }
  ): Promise<Record<string, { status: 'success' | 'error'; imageUrl: string | null; error: string | null }>> => {
    const batchSize = Math.max(1, options?.batchSize ?? 1);
    const delayMs = Math.max(0, options?.delayMs ?? 10000);
    const characterRefs = getSelectedCharacterReferences();
    const allResults: Record<string, { status: 'success' | 'error'; imageUrl: string | null; error: string | null }> = {};

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
            const rawPrompt = buildComicPagePrompt(
              panels,
              artStyle,
              mangaGenre,
              characterRefs.map((c) => ({ name: c.name, prompt: c.prompt })),
              sfxMode === 'auto'
            );

            // Omni branch — engages for every page when the model is set to
            // Omni, regardless of how many characters appear across its panels
            // (0, 1, or N). Falls through to the single-reference flow below on failure.
            if (enableMultiCharacterMode && multiCharacterApiUrl) {
              const pageMatched = new Map<string, CharacterReference>();
              for (const panel of panels) {
                for (const c of findAllCharacterMatches(characterRefs, panel.characterNames, panel.aiImagePrompt)) {
                  pageMatched.set(c.character_id, c);
                }
              }
              try {
                const multiGenStart = performance.now();
                const multiImageUrl = await withRetry(
                  () => fetchMultiCharacterImageFromAI(rawPrompt, multiCharacterApiUrl, {
                    storyId: projectId,
                    characterNames: Array.from(pageMatched.values()).map((c) => c.name),
                    style: imageGenStyle,
                    seed: randomImageSeed(),
                  }),
                  2,
                  8000
                );
                trackEvent({
                  type: 'panel', story_id: projectId || 'unknown', style: imageGenStyle || 'manga',
                  duration_ms: Math.round(performance.now() - multiGenStart), has_character: pageMatched.size > 0, ip_scale: 0,
                });
                return { pageId, status: 'success' as const, imageUrl: multiImageUrl, error: null };
              } catch (multiError) {
                addNotification({
                  title: 'Omni generation failed',
                  message: `Page ${pageNumber} fell back to SD1.5/SDXL.`,
                  variant: 'partial',
                  projectId,
                });
                console.warn(
                  '[generatePageImages] Omni generation failed, falling back to single-reference flow',
                  { pageNumber, error: multiError }
                );
              }
            }
            // ── End Omni branch — everything below is the existing,
            // unchanged single-reference flow. ──

            // A page combines several panels into one image with a single reference
            // slot — use the first panel on the page that actually names a character
            // (via the `characters:` field or, failing that, a name found directly
            // in that panel's raw prompt), rather than stopping at the first panel
            // checked regardless of whether it named anyone.
            let matchedChar: CharacterReference | undefined;
            for (const panel of panels) {
              matchedChar = findCharacterReference(characterRefs, panel.characterNames, panel.aiImagePrompt);
              if (matchedChar) break;
            }
            matchedChar ??= characterRefs[0];
            const prompt = withCharacterAppearance(rawPrompt, matchedChar?.prompt);
            const intendedRefSource = matchedChar?.image_url ?? referenceImageBase64;
            const refB64 = await resolveReferenceImageBase64(intendedRefSource);
            if (!refB64 && intendedRefSource) {
              addNotification({
                title: 'Reference image failed to load',
                message: `Page ${pageNumber}${matchedChar ? ` (${matchedChar.name})` : ''} will generate without a character reference image.`,
                variant: 'partial',
                projectId,
              });
            }
            const effectiveSettings: ImageGenSettings = {
              mode: imageGenMode,
              referenceImageBase64: refB64,
              controlImageBase64,
              ipAdapterScale,
              controlnetScale,
              characterName: matchedChar?.name?.toLowerCase() || undefined,
              storyId: projectId,
              style: imageGenStyle,
              seed: randomImageSeed(),
            };
            const imageUrl = await withRetry(
              () => fetchImageFromAI(prompt, localImageApiUrl || undefined, effectiveSettings, imageGenBackendMode),
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

      results.forEach((r) => {
        allResults[r.pageId] = { status: r.status, imageUrl: r.imageUrl, error: r.error };
      });

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

    return allResults;
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
      await resyncCharacterReferencesToServer();
      await resyncCharacterReferencesToMultiCharacterServer();
      const results = await generatePageImages(targets, { batchSize: 1, delayMs: 10000 });
      const pageTotal = Object.keys(results).length;
      const pageSucceeded = Object.values(results).filter((r) => r.status === 'success').length;
      addNotification({
        title: 'Page generation complete',
        message:
          pageSucceeded === pageTotal
            ? `All ${pageTotal} page${pageTotal === 1 ? '' : 's'} generated.`
            : `${pageSucceeded}/${pageTotal} pages generated, ${pageTotal - pageSucceeded} failed.`,
        variant: pageSucceeded === pageTotal ? 'success' : pageSucceeded > 0 ? 'partial' : 'error',
        projectId,
      });
      if (pageSucceeded > 0) {
        await saveToCloud();
      }
    } finally {
      setStep4((prev) => {
        if (!prev.data) return prev;
        return { ...prev, data: { ...prev.data, isGenerating: false } };
      });
    }
  };

  // Panels most often fail because the external Kaggle-tunnel image server
  // chokes under concurrent load, not because a given panel is unfixable —
  // so auto-retry rounds progressively back off (smaller batches, longer
  // waits) rather than repeating the same load pattern that likely caused
  // the failures. All rounds generate one panel per request.
  const PANEL_AUTO_RETRY_ROUNDS: { batchSize: number; delayMs: number }[] = [
    { batchSize: 1, delayMs: 10000 },
    { batchSize: 1, delayMs: 15000 },
    { batchSize: 1, delayMs: 20000 },
    { batchSize: 1, delayMs: 30000 },
    { batchSize: 1, delayMs: 45000 },
  ];

  const cancelPanelAutoRetry = useCallback(() => {
    panelAutoRetryCancelRef.current = true;
  }, []);

  const handleStartPanelGeneration = async () => {
    if (!step4.data || step4.data.isGenerating) return;

    let pending = step4.data.panels.filter((p) => {
      const state = step4.data?.panelStates?.[p.id];
      return !state || state.status === 'idle' || state.status === 'error';
    });
    if (!pending.length) return;
    const panelTotal = pending.length;

    panelAutoRetryCancelRef.current = false;
    setStep4((prev) => {
      if (!prev.data) return prev;
      return { ...prev, data: { ...prev.data, isGenerating: true }, error: null };
    });
    try {
      await resyncCharacterReferencesToServer();
      await resyncCharacterReferencesToMultiCharacterServer();
      let round = 0;
      while (pending.length && round < PANEL_AUTO_RETRY_ROUNDS.length && !panelAutoRetryCancelRef.current) {
        const settings = PANEL_AUTO_RETRY_ROUNDS[round];
        if (round > 0) {
          setPanelAutoRetryInfo({ round: round + 1, totalRounds: PANEL_AUTO_RETRY_ROUNDS.length, remaining: pending.length });
          await sleep(settings.delayMs);
          if (panelAutoRetryCancelRef.current) break;
        }
        const results = await generatePanelImages(pending, settings, () => panelAutoRetryCancelRef.current);
        pending = pending.filter((p) => results[p.id]?.status === 'error');
        round += 1;
      }
      const panelFailed = pending.length;
      const panelSucceeded = panelTotal - panelFailed;
      if (!panelAutoRetryCancelRef.current) {
        addNotification({
          title: 'Panel generation complete',
          message:
            panelFailed === 0
              ? `All ${panelTotal} panel${panelTotal === 1 ? '' : 's'} generated.`
              : `${panelSucceeded}/${panelTotal} panels generated, ${panelFailed} failed after retries.`,
          variant: panelFailed === 0 ? 'success' : panelSucceeded > 0 ? 'partial' : 'error',
          projectId,
        });
      }
      // Save whatever succeeded even if the run was cancelled partway through,
      // so a stopped batch doesn't leave newly generated panels un-persisted.
      if (panelSucceeded > 0) {
        await saveToCloud();
      }
    } finally {
      setPanelAutoRetryInfo(null);
      setStep4((prev) => {
        if (!prev.data) return prev;
        return { ...prev, data: { ...prev.data, isGenerating: false } };
      });
    }
  };

  const handleRegenerateSinglePanel = async (panel: Step4Panel, characterNamesOverride?: string[]) => {
    if (!step4.data) return;
    // Unlike handleStartPanelGeneration, this can be the first Omni call of the
    // session (e.g. regenerating one panel without ever running a full batch) —
    // resync first so Omni's RAM store actually has the referenced character(s).
    await resyncCharacterReferencesToMultiCharacterServer();
    const results = await generatePanelImages([panel], { batchSize: 1, delayMs: 0, characterNamesOverride });
    const outcome = results[panel.id];
    addNotification({
      title: outcome?.status === 'success' ? 'Panel regenerated' : 'Panel regeneration failed',
      message: `Page ${panel.pageNumber}, panel ${panel.panelNumber}`,
      variant: outcome?.status === 'success' ? 'success' : 'error',
      projectId,
    });
    if (outcome?.status === 'success') {
      await saveToCloud();
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
      // Same reasoning as handleRegenerateSinglePanel — this can be the first
      // Omni call of the session, so resync first.
      await resyncCharacterReferencesToMultiCharacterServer();
      const results = await generatePageImages([[pageNumber, panels]], { batchSize: 1, delayMs: 0 });
      const outcome = results[`page-${pageNumber}`];
      addNotification({
        title: outcome?.status === 'success' ? 'Page regenerated' : 'Page regeneration failed',
        message: `Page ${pageNumber}`,
        variant: outcome?.status === 'success' ? 'success' : 'error',
        projectId,
      });
      if (outcome?.status === 'success') {
        await saveToCloud();
      }
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
      let prompt = buildComicPagePrompt(
        panels, artStyle, mangaGenre,
        characterRefs.map((c) => ({ name: c.name, prompt: c.prompt })),
        sfxMode === 'auto'
      );
      if (feedback.trim()) {
        prompt += `\nUser revision request: ${feedback.trim()}`;
      }

      // Omni branch — same policy as generatePageImages: engages for every
      // page when the model is set to Omni, regardless of character count.
      if (enableMultiCharacterMode && multiCharacterApiUrl) {
        const pageMatched = new Map<string, CharacterReference>();
        for (const panel of panels) {
          for (const c of findAllCharacterMatches(characterRefs, panel.characterNames, panel.aiImagePrompt)) {
            pageMatched.set(c.character_id, c);
          }
        }
        try {
          const multiGenStart = performance.now();
          const multiImageUrl = await withRetry(
            () => fetchMultiCharacterImageFromAI(prompt, multiCharacterApiUrl, {
              storyId: projectId,
              characterNames: Array.from(pageMatched.values()).map((c) => c.name),
              style: imageGenStyle,
              seed: randomImageSeed(),
            }),
            2,
            8000
          );
          trackEvent({
            type: 'panel', story_id: projectId || 'unknown', style: imageGenStyle || 'manga',
            duration_ms: Math.round(performance.now() - multiGenStart), has_character: pageMatched.size > 0, ip_scale: 0,
          });
          setStep4((prev) => {
            if (!prev.data) return prev;
            const prevState = prev.data.pageStates[pageId];
            return {
              ...prev,
              data: {
                ...prev.data,
                pageStates: {
                  ...prev.data.pageStates,
                  [pageId]: { ...(prevState ?? {}), status: 'comparing', pendingUrl: multiImageUrl, error: null },
                },
              },
              lastUpdated: new Date().toISOString(),
            };
          });
          addNotification({
            title: 'Page regenerated with feedback',
            message: `Page ${pageNumber} — review the updated version.`,
            variant: 'success',
            projectId,
          });
          return;
        } catch (multiError) {
          addNotification({
            title: 'Omni generation failed',
            message: `Page ${pageNumber} fell back to SD1.5/SDXL.`,
            variant: 'partial',
            projectId,
          });
          console.warn(
            '[handleRegenerateWithFeedback] Omni generation failed, falling back to single-reference flow',
            { pageNumber, error: multiError }
          );
        }
      }
      // Same policy as generatePageImages: use the first panel on the page that
      // actually names a character (via `characters:` or a name found directly
      // in that panel's raw prompt), rather than always the first selected character.
      let matchedChar: CharacterReference | undefined;
      for (const panel of panels) {
        matchedChar = findCharacterReference(characterRefs, panel.characterNames, panel.aiImagePrompt);
        if (matchedChar) break;
      }
      matchedChar ??= characterRefs[0];
      prompt = withCharacterAppearance(prompt, matchedChar?.prompt);
      const intendedRefSource = matchedChar?.image_url ?? referenceImageBase64;
      const refB64 = await resolveReferenceImageBase64(intendedRefSource);
      if (!refB64 && intendedRefSource) {
        addNotification({
          title: 'Reference image failed to load',
          message: `Page ${pageNumber}${matchedChar ? ` (${matchedChar.name})` : ''} will generate without a character reference image.`,
          variant: 'partial',
          projectId,
        });
      }
      const effectiveSettings: ImageGenSettings = {
        mode: imageGenMode,
        referenceImageBase64: refB64,
        controlImageBase64,
        ipAdapterScale,
        controlnetScale,
        characterName: matchedChar?.name?.toLowerCase() || undefined,
        storyId: projectId,
        style: imageGenStyle,
        seed: randomImageSeed(),
      };
      const newImageUrl = await fetchImageFromAI(prompt, localImageApiUrl || undefined, effectiveSettings, imageGenBackendMode);
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
      addNotification({
        title: 'Page regenerated with feedback',
        message: `Page ${pageNumber} — review the updated version.`,
        variant: 'success',
        projectId,
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
      addNotification({
        title: 'Feedback regeneration failed',
        message: `Page ${pageNumber}: ${message}`,
        variant: 'error',
        projectId,
      });
    }
  };

  const acceptPanelRegen = async (pageNumber: number) => {
    const pageId = `page-${pageNumber}`;
    let acceptedUrl: string | null = null;
    setStep4((prev) => {
      if (!prev.data) return prev;
      const prevState = prev.data.pageStates[pageId];
      if (!prevState?.pendingUrl) return prev;
      acceptedUrl = prevState.pendingUrl;
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
    // step4Ref (and therefore collectImagesToSave) won't see this page as 'success'
    // until the next render's effect runs, so pass the just-accepted URL straight
    // through as an override rather than waiting for it to catch up.
    if (acceptedUrl) {
      await saveToCloud([{ image_key: `page:${pageId}`, image_url: acceptedUrl }]);
    }
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download JSON file.';
      setGlobalError('Failed to download JSON file.');
      addNotification({ title: 'Download failed', message, variant: 'error', projectId });
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

      // Use the layout the user chose in the editor; fall back to a sensible default by count
      const layoutName = pageLayoutNames[pageNumber] ?? LAYOUT_FALLBACKS[rawImgs.length] ?? 'single';

      // Composite bubbles onto each panel image when panelBubbles are provided — crop to
      // the same aspect ratio the editor's object-fit:cover view uses, so bubble positions
      // (recorded against that cropped view) land in the same place here.
      const imgs: string[] = await Promise.all(rawImgs.map(async ({ id, url }, idx) => {
        const bubbles = panelBubbles?.[id];
        if (bubbles?.length) {
          try {
            const targetAspectRatio = getPanelBoxAspectRatio(layoutName, idx);
            const blob = await compositePanelToBlob(url, bubbles, targetAspectRatio);
            return URL.createObjectURL(blob);
          } catch { /* fallback to raw image */ }
        }
        return url;
      }));

      allPanelImages.push(imgs);
      allLayouts.push(layoutName);
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
    } catch (error) {
      setExportStatus('error');
      addNotification({
        title: 'Image Pack export failed',
        message: error instanceof Error ? error.message : 'Something went wrong while exporting.',
        variant: 'error',
        projectId,
      });
    }
  }, [step4.data, projectId, imageGenStyle, addNotification]);

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
    } catch (error) {
      setExportStatus('error');
      addNotification({
        title: 'PDF export failed',
        message: error instanceof Error ? error.message : 'Something went wrong while exporting.',
        variant: 'error',
        projectId,
      });
    }
  }, [step4.data, projectId, imageGenStyle, addNotification]);

  const exportPrintPdf = useCallback(async (includeMetadata: boolean, panelBubbles?: Record<string, SingleBubble[]>) => {
    if (!step4.data) return;
    setExportStatus('exporting');
    try {
      const pages = await buildExportPages(step4.data, panelBubbles);
      await exportAsPdf(pages, { includeMetadata, projectId: projectId || 'comic', printReady: true });
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
    } catch (error) {
      setExportStatus('error');
      addNotification({
        title: 'Print-ready PDF export failed',
        message: error instanceof Error ? error.message : 'Something went wrong while exporting.',
        variant: 'error',
        projectId,
      });
    }
  }, [step4.data, projectId, imageGenStyle, addNotification]);

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
    } catch (error) {
      setExportStatus('error');
      addNotification({
        title: 'EPUB export failed',
        message: error instanceof Error ? error.message : 'Something went wrong while exporting.',
        variant: 'error',
        projectId,
      });
    }
  }, [step4.data, projectId, imageGenStyle, addNotification]);

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
    for (const { image_key, image_url } of images) {
      if (image_key.startsWith('panel:')) panelUpdates[image_key.slice(6)] = image_url;
      else if (image_key.startsWith('page:')) pageUpdates[image_key.slice(5)] = image_url;
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
      // Deliberately NOT restoring local_image_api_url from the project here — the
      // image API URL is a global, ephemeral setting (the Kaggle tunnel address,
      // which changes often) owned by the Settings page. Restoring it from an old
      // project would overwrite the current, correct URL with a stale one via the
      // two-way sync effect below, breaking generation until manually re-entered.
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
    // Read through the ref, not the `step4` closure: callers that run after a long
    // generation batch (many renders + inter-batch sleeps) would otherwise see the
    // stale step4 snapshot from when their handler started, not the freshly
    // generated images.
    const step4Data = step4Ref.current.data;
    if (!step4Data) return [];
    const entries: ProjectImageEntry[] = [];
    // Save only the images that match the active generation mode so the Dialogue tab,
    // the cloud save, and the editor all reflect exactly the same images.
    if (comicPageMode === 'page') {
      for (const [key, state] of Object.entries(step4Data.pageStates)) {
        if (state.status === 'success' && state.imageUrl) {
          entries.push({ image_key: `page:${key}`, image_url: state.imageUrl });
        }
      }
    } else {
      for (const [key, state] of Object.entries(step4Data.panelStates)) {
        if (state.status === 'success' && state.imageUrl) {
          entries.push({ image_key: `panel:${key}`, image_url: state.imageUrl });
        }
      }
    }
    return entries;
  };

  // Merges by image_key so a caller that just accepted/regenerated a single
  // page or panel synchronously can pass its fresh URL in without waiting for
  // step4Ref to catch up (it only updates on the next render's effect).
  const mergeImageEntries = (base: ProjectImageEntry[], overrides: ProjectImageEntry[]): ProjectImageEntry[] => {
    const byKey = new Map(base.map((entry) => [entry.image_key, entry]));
    overrides.forEach((entry) => byKey.set(entry.image_key, entry));
    return Array.from(byKey.values());
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

  const saveToCloud = async (imageOverrides?: ProjectImageEntry[]) => {
    setCloudSaveStatus('saving');
    setCloudSaveError(null);
    try {
      const fullSave = buildFullSave();
      const baseImages = collectImagesToSave();
      const images = imageOverrides?.length ? mergeImageEntries(baseImages, imageOverrides) : baseImages;
      await projectsApi.save(fullSave);
      if (images.length > 0) {
        await projectsApi.saveImages(projectId, images);
      }
      setCloudSaveStatus('saved');
      setLastSavedAt(fullSave.saved_at);
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
      if (result.success) {
        applyLoadedImages(imagesRes.data.images);
        setLastSavedAt(projectRes.data.saved_at ?? null);
        if (lastSyncedProjectIdRef.current !== cloudProjectId) {
          lastSyncedProjectIdRef.current = cloudProjectId;
          router.replace(`${pathnameRef.current}?project=${encodeURIComponent(cloudProjectId)}`, { scroll: false });
        }
      }
      return result;
    } catch (err) {
      return { success: false, error: toApiError(err).message };
    }
  };

  // Clears ?project=<id> from the URL (e.g. "All Projects" back button) and resets the sync
  // guard so re-opening the same project afterwards still updates the URL.
  const clearProjectFromUrl = () => {
    lastSyncedProjectIdRef.current = null;
    router.replace(pathnameRef.current, { scroll: false });
  };

  const listCloudProjects = async (): Promise<CloudProjectListItem[]> => {
    const response = await projectsApi.list();
    return response.data;
  };

  const addCandidateFromImage = (characterId: string, imageDataUrl: string) => {
    const candidateId = crypto.randomUUID();
    setStep2ImageReview((prev) => {
      if (!prev.data) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          characters: prev.data.characters.map((c) => {
            if (c.characterId !== characterId) return c;
            const newCandidate: CharacterImageCandidate = {
              id: candidateId,
              imageUrl: imageDataUrl,
              createdAt: new Date().toISOString(),
            };
            return {
              ...c,
              status: 'success' as CharacterImageStatus,
              candidates: [...c.candidates, newCandidate],
              selectedCandidateId: candidateId,
            };
          }),
        },
      };
    });
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
    multiCharacterApiUrl,
    setMultiCharacterApiUrl: setMultiCharacterApiUrlState,
    enableMultiCharacterMode,
    setEnableMultiCharacterMode,
    imageGenMode,
    imageGenBackendMode,
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
    panelAutoRetryInfo,
    cancelPanelAutoRetry,
    handleRegenerateSinglePanel,
    handleRegeneratePage,
    handleRegenerateWithFeedback,
    acceptPanelRegen,
    rejectPanelRegen,
    copyProjectJson,
    downloadProjectJson,
    exportZip,
    exportPdf,
    exportPrintPdf,
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
    lastSavedAt,
    saveToCloud,
    loadFromCloud,
    clearProjectFromUrl,
    listCloudProjects,
    injectLibraryCharacters,
    addCandidateFromImage,
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

// For shared components (e.g. StudioTopBar) that render on routes both inside
// and outside the ComicGenerationProvider — returns null instead of throwing.
export function useComicGenerationOptional(): ComicGenerationContextValue | null {
  return useContext(ComicGenerationContext);
}

