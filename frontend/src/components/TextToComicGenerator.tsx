'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  ChevronRight,
  Edit3,
  HelpCircle,
  LayoutTemplate,
  Layers,
  MousePointer2,
  Plus,
  Search,
  Zap,
} from 'lucide-react';
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

type CharacterImageStatus = 'idle' | 'loading' | 'success' | 'error';

interface CharacterImageCandidate {
  id: string;
  imageUrl: string;
  createdAt: string;
}

interface CharacterImageItem {
  characterId: string;
  name: string;
  prompt: string;
  status: CharacterImageStatus;
  error: string | null;
  candidates: CharacterImageCandidate[];
  selectedCandidateId: string | null;
}

interface CharacterImageReviewResult {
  characters: CharacterImageItem[];
  isGenerating: boolean;
}

interface Step3Result {
  scriptMarkdown: string;
  structuredJson: Record<string, unknown> | null;
}

type PanelImageStatus = 'idle' | 'loading' | 'success' | 'error';

interface Step4Panel {
  id: string;
  pageNumber: number;
  panelNumber: number;
  contextLabel: string;
  dialogueSfx: string;
  aiImagePrompt: string;
}

interface Step4PanelState {
  status: PanelImageStatus;
  imageUrl: string | null;
  error: string | null;
}

interface Step4Result {
  panels: Step4Panel[];
  panelStates: Record<string, Step4PanelState>;
  isGenerating: boolean;
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

const emptyStepState = <T,>(locked: boolean): StepState<T> => ({
  data: null,
  isLoading: false,
  isApproved: false,
  locked,
  error: null,
  lastUpdated: null,
});

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const fetchImageFromAI = async (imagePrompt: string): Promise<string> => {
  try {
    const response = await geminiApi.generatePanelImage({
      image_prompt: imagePrompt,
      width: 720,
      height: 960,
    });

    const imageUrl = response.data.image_data_url || response.data.image_url;
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Backend did not return a valid image payload.');
    }

    return imageUrl;
  } catch (error) {
    const apiError = toApiError(error);
    const retryHint =
      apiError.status === 429 && typeof apiError.retryAfterSeconds === 'number'
        ? ` Retry in ${Math.ceil(apiError.retryAfterSeconds)}s.`
        : '';
    throw new Error(`${apiError.message}${retryHint}`.trim());
  }
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

  // Fallback for non-standard markdown where panel headers are missing.
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
  const [step2ImageReview, setStep2ImageReview] = useState<StepState<CharacterImageReviewResult>>(
    emptyStepState<CharacterImageReviewResult>(true)
  );
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
          status: 'idle',
          error: null,
          candidates: [],
          selectedCandidateId: null,
        } satisfies CharacterImageItem;
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
          status: 'idle',
          error: null,
          candidates: [],
          selectedCandidateId: null,
        } satisfies CharacterImageItem;
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

    const step3Markdown = step3.data?.scriptMarkdown || '';
    const panels = parseStep3PanelsFromMarkdown(step3Markdown);
    if (!panels.length) {
      throw new Error('No AI Image Prompt blocks found in Step 3 output. Please regenerate Step 3 with panel prompts.');
    }

    const panelStates: Record<string, Step4PanelState> = {};
    panels.forEach((panel) => {
      panelStates[panel.id] = {
        status: 'idle',
        imageUrl: null,
        error: null,
      };
    });

    return {
      panels,
      panelStates,
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

    if (step === 2) {
      setStep2ImageReview(emptyStepState<CharacterImageReviewResult>(true));
      setStep3((prev) => ({ ...prev, locked: true, isApproved: false }));
      setStep4((prev) => ({ ...prev, locked: true, isApproved: false }));
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

  const handleGenerateCharacterReferences = async () => {
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
          const imageUrl = await fetchImageFromAI(character.prompt);
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

  const handleRegenerateCharacterImage = async (characterId: string) => {
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
      const imageUrl = await fetchImageFromAI(target.prompt);
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
            character.characterId === characterId
              ? { ...character, selectedCandidateId: candidateId }
              : character
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
            const imageUrl = await fetchImageFromAI(panel.aiImagePrompt);
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

  const handleStartFullGeneration = async () => {
    if (!step4.data || step4.data.isGenerating) return;

    const targets = step4.data.panels.filter((panel) => {
      const state = step4.data?.panelStates[panel.id];
      return state?.status === 'idle' || state?.status === 'error';
    });

    if (!targets.length) return;

    setStep4((prev) => {
      if (!prev.data) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          isGenerating: true,
        },
        error: null,
      };
    });

    try {
      await generatePanelImages(targets, { batchSize: 2, delayMs: 10000 });
    } finally {
      setStep4((prev) => {
        if (!prev.data) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            isGenerating: false,
          },
        };
      });
    }
  };

  const handleRegeneratePanel = async (panelId: string) => {
    if (!step4.data || step4.data.isGenerating) return;
    const panel = step4.data.panels.find((entry) => entry.id === panelId);
    if (!panel) return;

    setStep4((prev) => {
      if (!prev.data) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          isGenerating: true,
        },
        error: null,
      };
    });

    try {
      await generatePanelImages([panel], { batchSize: 1, delayMs: 0 });
    } finally {
      setStep4((prev) => {
        if (!prev.data) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            isGenerating: false,
          },
        };
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
    const states = step4.data?.panelStates || {};
    const list = Object.values(states);
    return {
      total: step4.data?.panels.length || 0,
      success: list.filter((entry) => entry.status === 'success').length,
      loading: list.filter((entry) => entry.status === 'loading').length,
      error: list.filter((entry) => entry.status === 'error').length,
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

  const getStepTone = (state: StepState<unknown>) => {
    if (state.isApproved) {
      return {
        badge: 'bg-primary text-on-primary',
        card: 'border-primary/20 bg-surface-container-lowest',
      };
    }
    if (state.isLoading) {
      return {
        badge: 'bg-primary-container text-on-primary',
        card: 'border-primary/20 bg-surface-container-lowest',
      };
    }
    if (state.locked) {
      return {
        badge: 'bg-surface-container-high text-on-surface-variant/70',
        card: 'border-outline-variant/30 bg-surface-container-low/70',
      };
    }
    if (state.data) {
      return {
        badge: 'bg-primary/10 text-primary',
        card: 'border-primary/10 bg-surface-container-lowest',
      };
    }
    return {
      badge: 'bg-surface-container-high text-on-surface-variant',
      card: 'border-outline-variant/30 bg-surface-container-lowest',
    };
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

    const tone = getStepTone(state);

    return (
      <div
        className={`min-w-0 rounded-[2rem] border p-8 premium-shadow transition-all ${tone.card} ${
          locked ? 'opacity-70' : 'opacity-100'
        } ${activeStep === step ? 'ring-2 ring-primary/20' : ''}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${tone.badge}`}>
              {state.isApproved ? '✓' : step}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant/70">Step {step}</p>
              <h3 className="text-xl font-bold tracking-tight text-on-surface">{title}</h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => handleGenerate(step)}
              disabled={locked || state.isLoading || isCooldown}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                locked || isCooldown
                  ? 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:scale-[0.98]'
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
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all"
              >
                Retry Step {step}
              </button>
            )}
            {!state.locked && !state.isApproved && state.data && (
              <button
                onClick={() => handleApprove(step)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-primary-container text-on-primary hover:scale-[0.98] transition-all"
              >
                Approve & Next
              </button>
            )}
          </div>
        </div>

        {context && (
          <div className="mt-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-sm text-on-surface [overflow-wrap:anywhere]">
            <p className="font-semibold text-on-surface mb-2">Context from previous step</p>
            {context}
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 min-h-[160px]">
          {state.error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
              {state.error}
            </div>
          )}
          {!state.data && !state.isLoading && (
            <p className="text-on-surface-variant text-sm">No output yet. Generate this step to proceed.</p>
          )}
          {state.isLoading && (
            <div className="flex items-center gap-3 text-primary text-sm font-semibold">
              <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Generating...
            </div>
          )}
          {state.data && children}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low/50 border-r border-outline-variant/30 flex flex-col p-4 z-[60]">
        <div className="mb-8 px-2 pt-4">
          <h1 className="text-xl font-bold tracking-tight text-on-surface">ComicGen AI</h1>
          <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/60 mt-1">Creative Hub</p>
        </div>

        <nav className="flex-1 space-y-1">
          {[{ label: 'Story Lab' }, { label: 'Characters' }, { label: 'Storyboard' }, { label: 'Exports' }].map(
            (item) => (
              <button
                key={item.label}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-primary/50" />
                <span className="font-semibold text-sm">{item.label}</span>
              </button>
            )
          )}
        </nav>

        <div className="mt-auto pt-6 space-y-4">
          <button className="w-full bg-primary-container text-on-primary py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20">
            Upgrade to Pro
          </button>
          <div className="flex items-center gap-3 px-2 py-4 border-t border-outline-variant/30">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-sm font-bold">
              AI
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate">Studio Session</span>
              <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-tight">Active</span>
            </div>
          </div>
        </div>
      </aside>

      <header className="fixed top-0 right-0 left-64 h-16 z-50 glass-nav flex items-center justify-between px-8 w-full shadow-sm">
        <div className="flex-1 max-w-xl">
          <div className="relative flex items-center group">
            <Search size={18} className="absolute left-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search projects, characters, panels..."
              className="w-full pl-12 pr-4 py-2 bg-surface-container-low border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-on-surface-variant">
            <button className="hover:text-on-surface transition-colors">
              <Bell size={20} />
            </button>
            <button className="hover:text-on-surface transition-colors">
              <HelpCircle size={20} />
            </button>
          </div>

          <button className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-md transition-all flex items-center gap-2">
            <Plus size={16} />
            Create New Comic
          </button>
        </div>
      </header>

      <main className="ml-64 pt-20 min-h-screen pb-28">
        <div className="px-10 py-10 max-w-7xl mx-auto">
          <header className="mb-10">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">Text-to-Comic Studio</h2>
            <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
              Orchestrate the 4-step Gemini pipeline, approve each stage, and generate panel-ready visuals.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <section className="lg:col-span-6">
              <div className="bg-surface-container-lowest rounded-[2rem] p-10 premium-shadow border border-outline-variant/30">
                <div className="flex items-center gap-3 mb-8">
                  <Edit3 size={24} className="text-primary" />
                  <h3 className="text-2xl font-bold tracking-tight">Narrative Input</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Project ID</label>
                    <input
                      type="text"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="mt-2 w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Upload Story</label>
                    <input
                      type="file"
                      accept=".txt,.md,.pdf"
                      onChange={handleFileUpload}
                      className="mt-2 w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    {storyFile && (
                      <p className="mt-2 text-xs text-primary">Loaded {storyFile.name}</p>
                    )}
                  </div>

                  <div className="relative">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Story Text</label>
                    <textarea
                      value={storyText}
                      onChange={(e) => setStoryText(e.target.value)}
                      placeholder="Paste your narrative text or script here (up to 5000 words)..."
                      className="mt-2 w-full h-72 bg-surface-container-low border-none rounded-2xl p-6 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all resize-none text-base leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Main Characters</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={mainCharacters}
                        onChange={(e) => setMainCharacters(e.target.value)}
                        className="mt-2 w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Chapters</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={numChapters}
                        onChange={(e) => setNumChapters(e.target.value)}
                        className="mt-2 w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Target Pages</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={targetPages}
                        onChange={(e) => setTargetPages(e.target.value)}
                        className="mt-2 w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Max Panels / Page</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={maxPanelsPerPage}
                        onChange={(e) => setMaxPanelsPerPage(e.target.value)}
                        className="mt-2 w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Genre & Tone</label>
                    <input
                      type="text"
                      value={mangaGenre}
                      onChange={(e) => setMangaGenre(e.target.value)}
                      className="mt-2 w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Art Style</label>
                    <input
                      type="text"
                      value={artStyle}
                      onChange={(e) => setArtStyle(e.target.value)}
                      className="mt-2 w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Special Requests</label>
                    <textarea
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      placeholder="e.g. include 3 splash pages, every chapter ends on a cliffhanger"
                      className="mt-2 w-full bg-surface-container-low border-none rounded-2xl p-6 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all resize-none text-sm leading-relaxed"
                    />
                  </div>

                  {globalError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {globalError}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-[2rem] border border-outline-variant/30 bg-surface-container-lowest p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/70">
                    Saved Project JSON (current workflow snapshot)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={downloadProjectJson}
                      className="px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-primary text-on-primary"
                    >
                      {jsonDownloaded ? 'Downloaded' : 'Download JSON'}
                    </button>
                    <button
                      onClick={copyProjectJson}
                      className="px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-surface-container-high text-on-surface"
                    >
                      {jsonCopied ? 'Copied' : 'Copy JSON'}
                    </button>
                  </div>
                </div>
                <pre className="mt-3 text-[11px] leading-5 text-on-surface-variant whitespace-pre-wrap max-h-64 overflow-auto">
                  {JSON.stringify(projectSnapshot, null, 2)}
                </pre>
                {lastDownloadedJsonFile && (
                  <p className="text-[11px] text-primary mt-2">
                    Last downloaded: <span className="font-semibold">{lastDownloadedJsonFile}</span>
                  </p>
                )}
              </div>
            </section>

            <aside className="lg:col-span-6 space-y-6">
              <StepCard step={1} title="AI Story Analysis">
                {step1.data && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface mb-2">Step 1 API Markdown Response</h4>
                      <div className="max-w-full overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
                        <div className="prose max-w-none text-sm leading-6 [overflow-wrap:anywhere]">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({ children }) => (
                                <div className="w-full overflow-x-auto">
                                  <table className="w-full min-w-[560px] table-auto border-collapse text-sm">{children}</table>
                                </div>
                              ),
                              thead: ({ children }) => <thead className="bg-surface-container-low">{children}</thead>,
                              tbody: ({ children }) => <tbody>{children}</tbody>,
                              tr: ({ children }) => <tr className="border-b border-outline-variant/40">{children}</tr>,
                              th: ({ children }) => (
                                <th className="border border-outline-variant/40 px-3 py-2 text-left font-semibold text-on-surface align-top">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="border border-outline-variant/40 px-3 py-2 text-on-surface-variant align-top [overflow-wrap:anywhere]">
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

              <div className="p-6 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white shadow-xl shadow-primary/20 flex gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm mb-1">Pro Tip</p>
                  <p className="text-xs opacity-80 leading-relaxed">
                    Describe characters clearly for stronger character sheets and better prompt quality downstream.
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-12 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold tracking-tight">Production Pipeline</h3>
                <p className="text-on-surface-variant text-sm">Approve each step to unlock the next stage.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[1, 2, 3, 4].map((step) => (
                  <button
                    key={step}
                    onClick={() => setActiveStep(step as StepKey)}
                    disabled={stepMap[step as StepKey].locked}
                    className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition ${
                      stepMap[step as StepKey].locked
                        ? 'border-outline-variant/40 text-on-surface-variant/40 cursor-not-allowed'
                        : activeStep === step
                          ? 'border-primary text-primary bg-primary/10'
                          : 'border-outline-variant/60 text-on-surface-variant hover:border-primary/60 hover:text-primary'
                    }`}
                  >
                    Step {step}
                  </button>
                ))}
              </div>
            </div>

            <StepCard
              step={2}
              title="Character Designs"
              context={
                step1.data ? (
                  <div className="text-sm text-on-surface space-y-1 min-w-0">
                    <p>Chapters: {numChapters} • Genre: {mangaGenre}</p>
                    <p className="[overflow-wrap:anywhere]">Characters: {step1.data.characterBreakdown.slice(0, 3).join('; ')}...</p>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">Approve Step 1 to pass context.</p>
                )
              }
            >
              {step2.data && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-on-surface mb-2">Step 2 API Markdown Response</h4>
                    <div className="max-w-full overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
                      <div className="prose max-w-none text-sm leading-6 [overflow-wrap:anywhere]">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children }) => (
                              <div className="w-full overflow-x-auto">
                                <table className="w-full min-w-[560px] table-auto border-collapse text-sm">{children}</table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-surface-container-low">{children}</thead>,
                            tbody: ({ children }) => <tbody>{children}</tbody>,
                            tr: ({ children }) => <tr className="border-b border-outline-variant/40">{children}</tr>,
                            th: ({ children }) => (
                              <th className="border border-outline-variant/40 px-3 py-2 text-left font-semibold text-on-surface align-top">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-outline-variant/40 px-3 py-2 text-on-surface-variant align-top [overflow-wrap:anywhere]">
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

            <div
              className={`min-w-0 rounded-[2rem] border p-8 premium-shadow transition-all ${
                step2ImageReview.locked
                  ? 'border-outline-variant/30 bg-surface-container-low/70 opacity-70'
                  : 'border-primary/10 bg-surface-container-lowest'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
                      step2ImageReview.isApproved
                        ? 'bg-primary text-on-primary'
                        : step2ImageReview.isLoading
                          ? 'bg-primary-container text-on-primary'
                          : step2ImageReview.locked
                            ? 'bg-surface-container-high text-on-surface-variant/70'
                            : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {step2ImageReview.isApproved ? '✓' : '2.5'}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant/70">Step 2.5</p>
                    <h3 className="text-xl font-bold tracking-tight text-on-surface">Character Reference Images</h3>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={handleGenerateCharacterReferences}
                    disabled={step2ImageReview.locked || step2ImageReview.isLoading}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                      step2ImageReview.locked || step2ImageReview.isLoading
                        ? 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
                        : 'bg-primary text-on-primary hover:scale-[0.98]'
                    }`}
                  >
                    {step2ImageReview.isLoading ? 'Generating...' : 'Generate Character Images'}
                  </button>
                  {!step2ImageReview.isApproved && step2ImageReview.data && (
                    <button
                      onClick={handleRetryCharacterReferences}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all"
                    >
                      Retry Step 2.5
                    </button>
                  )}
                  {!step2ImageReview.locked && !step2ImageReview.isApproved && step2ImageReview.data && (
                    <button
                      onClick={handleApproveCharacterReferences}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-primary-container text-on-primary hover:scale-[0.98] transition-all"
                    >
                      Approve & Unlock Step 3
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-sm text-on-surface">
                <p className="font-semibold text-on-surface mb-1">Context from Step 2</p>
                <p className="text-on-surface-variant">
                  Generate images from each character&apos;s AI image prompt, regenerate until satisfied, and select the final reference image.
                  Step 3 and Step 4 will use these selected references.
                </p>
              </div>

              <div className="mt-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 min-h-[160px]">
                {step2ImageReview.error && (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
                    {step2ImageReview.error}
                  </div>
                )}

                {!step2ImageReview.data && !step2ImageReview.isLoading && (
                  <p className="text-on-surface-variant text-sm">Approve Step 2, then generate character reference images.</p>
                )}

                {step2ImageReview.data && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {step2ImageReview.data.characters.map((character) => {
                      const selected =
                        character.candidates.find((candidate) => candidate.id === character.selectedCandidateId) || null;

                      return (
                        <div key={character.characterId} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest overflow-hidden">
                          <div className="border-b border-outline-variant/30 p-3">
                            <p className="text-sm font-semibold text-primary">{character.name}</p>
                            <p className="text-[11px] text-on-surface-variant [overflow-wrap:anywhere]">{character.characterId}</p>
                          </div>

                          <div className="aspect-[3/4] bg-surface-container-high flex items-center justify-center">
                            {selected ? (
                              <img src={selected.imageUrl} alt={character.name} className="w-full h-full object-cover" />
                            ) : character.status === 'loading' ? (
                              <div className="flex flex-col items-center gap-2 text-primary text-sm">
                                <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                Generating...
                              </div>
                            ) : character.status === 'error' ? (
                              <p className="px-4 text-center text-sm text-red-600">{character.error || 'Failed to generate image.'}</p>
                            ) : (
                              <p className="text-sm text-on-surface-variant">No image selected yet</p>
                            )}
                          </div>

                          <div className="p-4 space-y-2">
                            <button
                              onClick={() => handleRegenerateCharacterImage(character.characterId)}
                              disabled={step2ImageReview.data?.isGenerating}
                              className={`w-full px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition ${
                                step2ImageReview.data?.isGenerating
                                  ? 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
                                  : 'bg-primary text-on-primary hover:scale-[0.98]'
                              }`}
                            >
                              Regenerate Image
                            </button>

                            {character.candidates.length > 1 && (
                              <div className="space-y-1">
                                <p className="text-[11px] text-on-surface-variant">Generated versions</p>
                                <div className="flex flex-wrap gap-2">
                                  {character.candidates.map((candidate, idx) => (
                                    <button
                                      key={candidate.id}
                                      onClick={() => handleSelectCharacterCandidate(character.characterId, candidate.id)}
                                      className={`px-2 py-1 rounded-md text-[11px] font-semibold ${
                                        character.selectedCandidateId === candidate.id
                                          ? 'bg-primary text-on-primary'
                                          : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                                      }`}
                                    >
                                      v{idx + 1}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <details>
                              <summary className="cursor-pointer text-[11px] text-on-surface-variant">Image prompt</summary>
                              <p className="mt-1 text-[11px] text-on-surface whitespace-pre-wrap [overflow-wrap:anywhere]">
                                {character.prompt}
                              </p>
                            </details>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <StepCard
              step={3}
              title="Panel-by-Panel Script"
              context={
                step2.data ? (
                  <div className="text-sm text-on-surface space-y-1 min-w-0">
                    <p className="[overflow-wrap:anywhere]">Main prompts: {getStep2PromptList().slice(0, 2).join(' | ') || 'Using Step 2 design context'}...</p>
                    <p>Selected character references: {getSelectedCharacterReferences().length}</p>
                    <p>Art style: {artStyle}</p>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">Approve Step 2 to pass design context.</p>
                )
              }
            >
              {step3.data && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-on-surface mb-2">Step 3 API Markdown Response</h4>
                    <div className="max-w-full overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
                      <div className="prose max-w-none text-sm leading-6 [overflow-wrap:anywhere]">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children }) => (
                              <div className="w-full overflow-x-auto">
                                <table className="w-full min-w-[560px] table-auto border-collapse text-sm">{children}</table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-surface-container-low">{children}</thead>,
                            tbody: ({ children }) => <tbody>{children}</tbody>,
                            tr: ({ children }) => <tr className="border-b border-outline-variant/40">{children}</tr>,
                            th: ({ children }) => (
                              <th className="border border-outline-variant/40 px-3 py-2 text-left font-semibold text-on-surface align-top">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-outline-variant/40 px-3 py-2 text-on-surface-variant align-top [overflow-wrap:anywhere]">
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
              title="Image Generation & Display"
              context={
                step3.data ? (
                  <p className="text-sm text-on-surface">Parse Step 3 markdown into page/panel prompts, then generate images in a rate-limited queue.</p>
                ) : (
                  <p className="text-sm text-on-surface-variant">Approve Step 3 to parse panel prompts for image generation.</p>
                )
              }
            >
              {step4.data && (() => {
                const step4Data = step4.data;
                return (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
                      <div className="text-xs text-on-surface-variant">
                        <p>
                          Panels: <span className="font-semibold text-on-surface">{step4Stats.total}</span> · Success:{' '}
                          <span className="font-semibold text-primary">{step4Stats.success}</span> · Loading:{' '}
                          <span className="font-semibold text-primary-container">{step4Stats.loading}</span> · Error:{' '}
                          <span className="font-semibold text-red-600">{step4Stats.error}</span>
                        </p>
                        <p className="text-on-surface-variant mt-1">Batch mode: 2 images/call cycle with 10s delay between batches.</p>
                      </div>
                      <button
                        onClick={handleStartFullGeneration}
                        disabled={step4Data.isGenerating || step4Stats.total === 0}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition ${
                          step4Data.isGenerating || step4Stats.total === 0
                            ? 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
                            : 'bg-primary text-on-primary hover:scale-[0.98]'
                        }`}
                      >
                        {step4Data.isGenerating ? 'Generating...' : 'Start Full Generation'}
                      </button>
                    </div>

                    {step4Stats.total === 0 && (
                      <p className="text-sm text-amber-600">
                        No panel prompts were parsed from Step 3 markdown. Regenerate Step 3 with explicit “AI Image Prompt:” lines.
                      </p>
                    )}

                    {step4PanelsByPage.map(([pageNumber, panels]) => (
                      <div key={pageNumber} className="space-y-3">
                        <h4 className="text-sm font-semibold text-primary">Page {pageNumber}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                          {panels.map((panel) => {
                            const state = step4Data.panelStates[panel.id];

                            return (
                              <div key={panel.id} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest overflow-hidden">
                                <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 px-3 py-2">
                                  <p className="text-xs font-semibold text-primary">{panel.contextLabel}</p>
                                  <button
                                    onClick={() => handleRegeneratePanel(panel.id)}
                                    disabled={step4Data.isGenerating || state?.status === 'loading'}
                                    className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-widest transition ${
                                      step4Data.isGenerating || state?.status === 'loading'
                                        ? 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
                                      : 'bg-primary text-on-primary hover:scale-[0.98]'
                                    }`}
                                  >
                                    Regenerate
                                  </button>
                                </div>

                                <div className="aspect-[3/4] bg-surface-container-high flex items-center justify-center">
                                  {state?.status === 'success' && state.imageUrl ? (
                                    <img
                                      src={state.imageUrl}
                                      alt={panel.aiImagePrompt}
                                      className="w-full h-full object-cover"
                                      onError={() => {
                                        setStep4((prev) => {
                                          if (!prev.data) return prev;
                                          return {
                                            ...prev,
                                            data: {
                                              ...prev.data,
                                              panelStates: {
                                                ...prev.data.panelStates,
                                                [panel.id]: {
                                                  status: 'error',
                                                  imageUrl: null,
                                                  error: 'Image URL could not be loaded in browser. Try Regenerate.',
                                                },
                                              },
                                            },
                                          };
                                        });
                                      }}
                                    />
                                  ) : state?.status === 'loading' ? (
                                    <div className="flex flex-col items-center gap-2 text-primary text-sm">
                                      <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                      Generating...
                                    </div>
                                  ) : state?.status === 'error' ? (
                                    <div className="px-4 text-center">
                                      <p className="text-sm font-semibold text-red-600">Generation failed</p>
                                      <p className="text-xs text-red-500 mt-1 [overflow-wrap:anywhere]">{state.error}</p>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-on-surface-variant">Idle</p>
                                  )}
                                </div>

                                <div className="p-4 space-y-2 text-xs text-on-surface">
                                  <div>
                                    <p className="font-semibold text-on-surface">Dialogue/SFX</p>
                                    <p className="text-on-surface-variant whitespace-pre-wrap [overflow-wrap:anywhere]">
                                      {panel.dialogueSfx}
                                    </p>
                                  </div>
                                  <details>
                                    <summary className="cursor-pointer text-on-surface-variant">AI Image Prompt</summary>
                                    <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{panel.aiImagePrompt}</p>
                                  </details>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </StepCard>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-64 right-0 h-20 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/40 px-10 flex items-center justify-between z-[40]">
        <div className="flex gap-10">
          {[
            { step: 1, label: 'Story', icon: Edit3 },
            { step: 2, label: 'Analysis', icon: LayoutTemplate },
            { step: 3, label: 'Script', icon: Layers },
            { step: 4, label: 'Export', icon: MousePointer2 },
          ].map(({ step, label, icon: Icon }) => {
            const state = stepMap[step as StepKey];
            const isActive = activeStep === step;
            const disabled = state.locked;
            return (
              <button
                key={step}
                onClick={() => !disabled && setActiveStep(step as StepKey)}
                className={`flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-widest transition ${
                  disabled
                    ? 'text-on-surface-variant/40 cursor-not-allowed'
                    : isActive
                      ? 'text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <button className="bg-surface-container-high text-on-surface-variant/50 px-8 py-3 rounded-xl flex items-center gap-2 cursor-not-allowed">
          Next Step Locked
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
