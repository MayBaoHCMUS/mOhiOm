import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import ErrorMessage from '@/components/story-setup/ErrorMessage';
import FileUploadZone from '@/components/story-setup/FileUploadZone';
import FormField from '@/components/story-setup/FormField';
import EnhancedTextarea from '@/components/story-setup/EnhancedTextarea';
import NumberInput from '@/components/story-setup/NumberInput';
import PresetButtons from '@/components/story-setup/PresetButtons';
import Tooltip from '@/components/story-setup/Tooltip';
import ProjectsDrawer from '@/components/ProjectsDrawer';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useDraftRecovery } from '@/hooks/useDraftRecovery';
import type { FieldConfig, FormData } from '@/components/story-setup/types';

const PROJECT_ID_HELP = 'Unique identifier for your comic project';
const GENRE_HELP = 'e.g., Fantasy/Adventure, Epic tone';
const ART_STYLE_HELP = "e.g., Japanese manga style, detailed, black and white";

const projectIdPattern = /^[A-Za-z0-9_-]+$/;

const validateProjectId = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Project ID must be at least 3 characters (letters, numbers, -, _ only)';
  if (raw.length < 3) return 'Project ID must be at least 3 characters (letters, numbers, -, _ only)';
  if (!projectIdPattern.test(raw)) return 'Project ID must be at least 3 characters (letters, numbers, -, _ only)';
  return undefined;
};

const validateRange = (value: unknown, min: number, max: number, message: string) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return message;
  if (num < min || num > max) return message;
  return undefined;
};

export default function Step1() {
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
    localImageApiUrl,
    step1,
    globalError,
    setProjectId,
    setStoryText,
    setStoryFile,
    setMainCharacters,
    setNumChapters,
    setTargetPages,
    setMangaGenre,
    setArtStyle,
    setMaxPanelsPerPage,
    setSpecialRequests,
    setLocalImageApiUrl,
    handleGenerate,
    getCooldownSeconds,
    setupValidation,
    setSetupValidation,
    setupSubmitAttempted,
    setSetupSubmitAttempted,
    loadProjectJson,
    fromStorySetup,
    fieldsAutoFilledFromAnalysis,
    storySetupAnalysisResult,
  } = useComicGeneration();

  const [storyInputError, setStoryInputError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [aiSuggestCard, setAiSuggestCard] = useState<{ chars: string[]; beats: number; tone: string[] } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  const { draft, restoreDraft, discardDraft } = useDraftRecovery('story-text-draft', storyText);

  // Metadata from Story Setup import (read from localStorage when fromStorySetup is true)
  const [importedTitle, setImportedTitle] = useState('');
  const [importedAdapted, setImportedAdapted] = useState(false);
  const [importedWordCount, setImportedWordCount] = useState<number | null>(null);

  useEffect(() => {
    if (!fromStorySetup) return;
    try {
      const raw = window.localStorage.getItem('mohiom-story-setup');
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (saved.storyTitle) setImportedTitle(String(saved.storyTitle));
      if (saved.adaptedFromOriginal) setImportedAdapted(Boolean(saved.adaptedFromOriginal));
      if (typeof saved.adaptedWordCount === 'number') setImportedWordCount(saved.adaptedWordCount);
    } catch { /* ignore */ }
  }, [fromStorySetup]);

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const result = loadProjectJson(parsed);
        if (result.success) {
          setImportSuccess(true);
          window.setTimeout(() => setImportSuccess(false), 2000);
        } else {
          setImportError(result.error ?? 'Import failed.');
        }
      } catch {
        setImportError('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const cooldownSeconds = getCooldownSeconds(1);
  const isGenerating = step1.isLoading || cooldownSeconds > 0;
  const isFormDisabled = step1.isLoading;

  const formData: FormData = {
    projectId,
    mainCharacters: Number(mainCharacters),
    chapters: Number(numChapters),
    targetPages: Number(targetPages),
    maxPanelsPerPage: Number(maxPanelsPerPage),
    genreTone: mangaGenre,
    artStyleReference: artStyle,
    storyFile: storyFile || undefined,
    storyText,
  };

  const fieldConfigs: FieldConfig[] = useMemo(
    () => [
      {
        name: 'projectId',
        label: 'Project ID',
        type: 'text',
        required: true,
        validation: validateProjectId,
        helperText: PROJECT_ID_HELP,
        tooltip: 'This will be used in file names and URLs',
      },
      {
        name: 'mainCharacters',
        label: 'Main characters',
        type: 'number',
        required: true,
        validation: (value) => validateRange(value, 1, 10, 'Please enter a number between 1 and 10'),
        helperText: 'How many main characters are in your story?',
        tooltip: 'Focus on protagonists that drive the core plot.',
      },
      {
        name: 'chapters',
        label: 'Chapters',
        type: 'number',
        required: true,
        validation: (value) => validateRange(value, 1, 50, 'Please enter a number between 1 and 50'),
        helperText: 'Number of chapters to organize your story',
        tooltip: 'Use chapters to pace major story beats.',
      },
      {
        name: 'targetPages',
        label: 'Target pages',
        type: 'number',
        required: true,
        validation: (value) => validateRange(value, 1, 1000, 'Please enter a number between 1 and 1000'),
        helperText: 'Total pages you want to generate',
        tooltip: 'Higher page counts take longer to render.',
      },
      {
        name: 'maxPanelsPerPage',
        label: 'Max panels per page',
        type: 'number',
        required: true,
        validation: (value) => validateRange(value, 3, 12, 'Please enter a number between 3 and 12'),
        helperText: 'Maximum panels per page (recommended: 4-6)',
        tooltip: 'Lower values create larger panels and clearer action beats.',
      },
      {
        name: 'genreTone',
        label: 'Genre + tone',
        type: 'text',
        required: true,
        validation: (value) => {
          const raw = String(value || '').trim();
          if (raw.length < 3) return 'Please describe the genre and tone';
          return undefined;
        },
        helperText: GENRE_HELP,
        tooltip: "Short, punchy descriptor works best (e.g., Fantasy/Adventure, Epic tone).",
      },
      {
        name: 'artStyleReference',
        label: 'Art style reference',
        type: 'text',
        required: true,
        validation: (value) => {
          const raw = String(value || '').trim();
          if (raw.length < 5) return "Please describe the art style (e.g., 'Japanese manga style, detailed')";
          return undefined;
        },
        helperText: ART_STYLE_HELP,
        tooltip:
          'Be specific! Include medium (digital/traditional), style (manga/western comic/realistic), and color preference',
      },
    ],
    []
  );

  const {
    errors,
    touched,
    errorCount,
    requiredTotal,
    requiredComplete,
    isValid,
    validateAll,
    handleBlur,
    handleChange,
  } = useFormValidation<FormData>(formData, fieldConfigs);

  useEffect(() => {
    const nextValidation = {
      isValid,
      errorCount,
      requiredComplete,
      requiredTotal,
    };
    if (
      !setupValidation ||
      setupValidation.isValid !== nextValidation.isValid ||
      setupValidation.errorCount !== nextValidation.errorCount ||
      setupValidation.requiredComplete !== nextValidation.requiredComplete
    ) {
      setSetupValidation(nextValidation);
    }
  }, [errorCount, isValid, requiredComplete, requiredTotal, setSetupValidation, setupValidation]);

  useEffect(() => {
    if (setupSubmitAttempted && errorCount === 0 && !storyInputError) {
      setSetupSubmitAttempted(false);
    }
  }, [errorCount, setSetupSubmitAttempted, setupSubmitAttempted, storyInputError]);

  const handleGenerateClick = async () => {
    const validationErrors = validateAll();
    const hasErrors = Object.values(validationErrors).some(Boolean);
    if (hasErrors) {
      setSetupSubmitAttempted(true);
      return;
    }

    if (!storyText.trim()) {
      setStoryInputError('Please provide story text before generating.');
      setSetupSubmitAttempted(true);
      return;
    }

    setStoryInputError(null);
    await handleGenerate(1);
  };

  const statusLabel = step1.isApproved
    ? 'Approved'
    : step1.isLoading
      ? 'Generating'
      : step1.data
        ? 'Ready'
        : 'Not generated';

  const projectIdError = touched.projectId ? errors.projectId : undefined;
  const projectIdSuccess = touched.projectId && !errors.projectId && projectId.trim().length >= 3;

  const genreError = touched.genreTone ? errors.genreTone : undefined;
  const genreSuccess = touched.genreTone && !errors.genreTone && mangaGenre.trim().length >= 3;

  const artStyleError = touched.artStyleReference ? errors.artStyleReference : undefined;
  const artStyleSuccess = touched.artStyleReference && !errors.artStyleReference && artStyle.trim().length >= 5;

  const mainCharactersError = touched.mainCharacters ? errors.mainCharacters : undefined;
  const chaptersError = touched.chapters ? errors.chapters : undefined;
  const targetPagesError = touched.targetPages ? errors.targetPages : undefined;
  const maxPanelsError = touched.maxPanelsPerPage ? errors.maxPanelsPerPage : undefined;

  const targetPagesValue = Number(targetPages);
  const targetPagesWarning = Number.isFinite(targetPagesValue) && targetPagesValue > 500
    ? 'Large page count may take longer to generate'
    : undefined;

  const genreLower = mangaGenre.toLowerCase();
  const artStyleSuggestions = genreLower.includes('fantasy')
    ? ['Hand-drawn fantasy ink', 'European graphic novel style', 'Ethereal watercolor manga']
    : genreLower.includes('sci-fi')
      ? ['Clean line sci-fi noir', 'Retro-futuristic manga', 'Neon cyberpunk']
      : [];

  const suggestedChapters = Number.isFinite(targetPagesValue) && targetPagesValue >= 300
    ? Math.min(50, Math.max(Number(numChapters) || 1, Math.ceil(targetPagesValue / 50)))
    : null;

  const totalRequired = 8;
  const validRequiredCount = useMemo(() => {
    let count = 0;
    if (!validateProjectId(projectId)) count++;
    if (!validateRange(Number(mainCharacters), 1, 10, 'x')) count++;
    if (!validateRange(Number(numChapters), 1, 50, 'x')) count++;
    if (!validateRange(Number(targetPages), 1, 1000, 'x')) count++;
    if (!validateRange(Number(maxPanelsPerPage), 3, 12, 'x')) count++;
    if (mangaGenre.trim().length >= 3) count++;
    if (artStyle.trim().length >= 5) count++;
    if (fromStorySetup ? storyText.trim().length > 0 : storyText.trim().length >= 100) count++;
    return count;
  }, [projectId, mainCharacters, numChapters, targetPages, maxPanelsPerPage, mangaGenre, artStyle, storyText, fromStorySetup]);

  const handleAiSuggestAll = useCallback(() => {
    if (!step1.data?.structuredJson) return;
    try {
      const json = typeof step1.data.structuredJson === 'string'
        ? JSON.parse(step1.data.structuredJson as string)
        : step1.data.structuredJson as Record<string, unknown>;
      const stepsObj = json as { steps?: { step_1_analysis?: Record<string, unknown> } };
      const analysis = stepsObj?.steps?.step_1_analysis;
      if (!analysis) return;
      const chars = Array.isArray(analysis.detected_characters) ? (analysis.detected_characters as string[]) : [];
      const beats = typeof analysis.scene_beats === 'number' ? analysis.scene_beats : 0;
      const tone = Array.isArray(analysis.tone_tags) ? (analysis.tone_tags as string[]) : [];
      if (chars.length > 0) { setMainCharacters(String(chars.length)); handleChange('mainCharacters', chars.length); }
      if (beats > 0) { const ch = Math.max(1, Math.min(50, Math.ceil(beats / 4))); setNumChapters(String(ch)); handleChange('chapters', ch); }
      setMaxPanelsPerPage('5'); handleChange('maxPanelsPerPage', 5);
      setAiSuggestCard({ chars, beats, tone });
    } catch { /* ignore parse errors */ }
  }, [step1.data, setMainCharacters, setNumChapters, setMaxPanelsPerPage, handleChange]);

  const textInputClass = (hasError?: boolean, hasSuccess?: boolean) => {
    if (hasError) return 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200';
    if (hasSuccess) return 'border-emerald-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200';
    return 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
  };

  return (
    <section className="bg-white text-gray-900 rounded-3xl p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Project setup</h2>
          <p className="mt-2 text-gray-600">Feed the story, define goals, and kick off analysis.</p>
        </div>
        <div className="text-sm text-gray-600">Analysis status: {statusLabel}</div>
      </div>

      {/* Import banner — shown when story was sent from Story Setup */}
      {fromStorySetup && (
        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 text-xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>download_done</span>
              <div>
                <p className="font-semibold text-blue-900 text-sm">Story imported from Story Setup</p>
                <p className="text-xs text-blue-700 mt-1">
                  {importedTitle ? `"${importedTitle}"` : 'Untitled'}{mangaGenre ? ` · ${mangaGenre}` : ''}
                  {importedAdapted && importedWordCount ? (
                    <span className="ml-2 text-emerald-700 font-medium">
                      · {importedWordCount.toLocaleString()} words (AI-adapted)
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <Link
              href="/studio/story-setup"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 whitespace-nowrap"
            >
              Edit in Story Setup
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </Link>
          </div>
        </div>
      )}

      {/* Discovery banner — shown when NOT imported from Story Setup */}
      {!fromStorySetup && (
        <div className="mt-5 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
            <div>
              <p className="text-sm font-semibold text-on-surface">Craft your story with AI first</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Story Setup helps you develop your narrative, get AI adaptation, and auto-fill these targets.</p>
            </div>
          </div>
          <Link
            href="/studio/story-setup"
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:opacity-90 whitespace-nowrap"
          >
            Open Story Setup →
          </Link>
        </div>
      )}

      {globalError ? (
        <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{globalError}</div>
      ) : null}

      {/* Draft recovery banner — moved above the form */}
      {isMounted && draft && !fromStorySetup ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">Saved draft found from {new Date(draft.savedAt).toLocaleString()}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => { const r = restoreDraft(); if (r !== null) setStoryText(r); }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:opacity-90"
            >
              Restore draft
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}

      {/* Field counter with progress bar */}
      <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">
            {validRequiredCount} of {totalRequired} required fields complete
          </span>
          {validRequiredCount === totalRequired && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Ready
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${validRequiredCount === totalRequired ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.round((validRequiredCount / totalRequired) * 100)}%` }}
          />
        </div>
      </div>

      {setupSubmitAttempted && errorCount > 0 ? (
        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          Please fix {errorCount} errors
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-gray-100 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">edit_note</span>
            <h3 className="text-lg font-semibold">Story input</h3>
          </div>

          <FormField
            id="project-id"
            label="Project ID"
            required
            tooltip="This will be used in file names and URLs"
            helperText={PROJECT_ID_HELP}
            error={projectIdError}
            success={projectIdSuccess}
          >
            <div className="relative">
              <input
                id="project-id"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  handleChange('projectId', event.target.value);
                }}
                onBlur={() => handleBlur('projectId')}
                className={`mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none border ${
                  textInputClass(Boolean(projectIdError), projectIdSuccess)
                }`}
                placeholder="manga_project_001"
                aria-invalid={Boolean(projectIdError)}
                aria-describedby="project-id-help project-id-error"
                disabled={isFormDisabled}
              />
              {projectIdError ? (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-red-500">error</span>
              ) : projectIdSuccess ? (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">check_circle</span>
              ) : null}
            </div>
          </FormField>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Story file</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Optional</span>
                <Tooltip content="Upload a .txt or .md file to auto-fill the story text." />
              </div>
            </div>
            <FileUploadZone
              file={storyFile}
              storyText={storyText}
              onFileReady={(file, content) => {
                setStoryFile(file);
                setStoryText(content);
                setStoryInputError(null);
              }}
              onFileCleared={() => setStoryFile(null)}
              disabled={isFormDisabled}
            />
          </div>

          {fromStorySetup ? (
            <div className="mt-2 rounded-2xl border border-blue-100 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
                <span className="material-symbols-outlined text-sm text-blue-500">lock</span>
                <span className="text-xs font-medium text-blue-700 flex-1">Read-only — imported from Story Setup</span>
              </div>
              <div className="px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[120px] max-h-[300px] overflow-y-auto bg-gray-50">
                {storyText || <span className="text-gray-400 italic">No story text imported.</span>}
              </div>
              <div className="px-3 py-2 bg-blue-50/60 border-t border-blue-100">
                <Link
                  href="/studio/story-setup"
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 w-fit"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Edit this in Story Setup to keep projects in sync
                </Link>
              </div>
            </div>
          ) : (
            <>
              <EnhancedTextarea
                id="story-text"
                label="Story Text"
                value={storyText}
                onChange={(value) => {
                  setStoryText(value);
                  if (storyInputError) setStoryInputError(null);
                }}
                minLength={100}
                maxLength={10000}
                placeholder={`Paste or write your story here...\n\nExample:\nIn a world where magic is forbidden, a young scholar named Elena\ndiscovers an ancient spellbook in her university's restricted section.\nAs she begins to unlock its secrets, she realizes that someone is\nhunting those with magical abilities...\n\nTip: Include character names, key plot points, and tone/atmosphere.`}
                autosave
                autoExpand
                saveKey="story-text-draft"
                helperText="Paste or write the story here. Minimum 100 characters."
                tooltip="Longer story inputs help the AI extract more detailed panels and character beats."
                hideDraftBanner
              />
              {storyInputError ? <ErrorMessage id="story-text-error" message={storyInputError} /> : null}
            </>
          )}
        </div>

        <div className="rounded-3xl bg-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">auto_awesome</span>
              <h3 className="text-lg font-semibold">Creative targets</h3>
            </div>
            {step1.data && (
              <button
                type="button"
                onClick={handleAiSuggestAll}
                disabled={isFormDisabled}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">psychology</span>
                AI Suggest All
              </button>
            )}
          </div>

          {fieldsAutoFilledFromAnalysis && storySetupAnalysisResult && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 flex items-start gap-2">
              <span className="material-symbols-outlined text-sm mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>auto_fix_high</span>
              <span>Targets auto-filled from Story Setup analysis · {storySetupAnalysisResult.chars.length} character{storySetupAnalysisResult.chars.length !== 1 ? 's' : ''} detected, {storySetupAnalysisResult.sceneBeats} scene beat{storySetupAnalysisResult.sceneBeats !== 1 ? 's' : ''}</span>
            </div>
          )}

          {aiSuggestCard && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-blue-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">psychology</span>
                  AI reasoning
                </p>
                <button type="button" onClick={() => setAiSuggestCard(null)} className="text-blue-500 hover:text-blue-700">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <ul className="text-xs text-blue-700 space-y-1">
                {aiSuggestCard.chars.length > 0 && (
                  <li>· <strong>{aiSuggestCard.chars.length} character{aiSuggestCard.chars.length !== 1 ? 's' : ''}</strong> detected: {aiSuggestCard.chars.slice(0, 4).join(', ')}{aiSuggestCard.chars.length > 4 ? '…' : ''}</li>
                )}
                {aiSuggestCard.beats > 0 && (
                  <li>· <strong>{aiSuggestCard.beats} scene beats</strong> → {Math.max(1, Math.min(50, Math.ceil(aiSuggestCard.beats / 4)))} chapters (÷4)</li>
                )}
                {aiSuggestCard.tone.length > 0 && (
                  <li>· Tone: {aiSuggestCard.tone.join(', ')}</li>
                )}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberInput
              id="main-characters"
              label="Main characters"
              value={mainCharacters}
              onChange={(value) => {
                setMainCharacters(value);
                handleChange('mainCharacters', value);
              }}
              onBlur={() => handleBlur('mainCharacters')}
              min={1}
              max={10}
              required
              helperText="How many main characters are in your story?"
              tooltip="Focus on protagonists that drive the core plot."
              error={mainCharactersError}
              success={Boolean(touched.mainCharacters && !mainCharactersError)}
              disabled={isFormDisabled}
            />
            <NumberInput
              id="chapters"
              label="Chapters"
              value={numChapters}
              onChange={(value) => {
                setNumChapters(value);
                handleChange('chapters', value);
              }}
              onBlur={() => handleBlur('chapters')}
              min={1}
              max={50}
              required
              helperText="Number of chapters to organize your story"
              tooltip="Use chapters to pace major story beats."
              error={chaptersError}
              success={Boolean(touched.chapters && !chaptersError)}
              disabled={isFormDisabled}
            />
            <div className="sm:col-span-2">
              <NumberInput
                id="target-pages"
                label="Target pages"
                value={targetPages}
                onChange={(value) => {
                  setTargetPages(value);
                  handleChange('targetPages', value);
                }}
                onBlur={() => handleBlur('targetPages')}
                min={1}
                max={1000}
                required
                helperText="Total pages you want to generate"
                tooltip="Higher page counts take longer to render."
                error={targetPagesError}
                success={Boolean(touched.targetPages && !targetPagesError)}
                disabled={isFormDisabled}
              />
              {targetPagesWarning ? (
                <p className="mt-2 text-xs text-amber-600">{targetPagesWarning}</p>
              ) : null}
              <PresetButtons
                presets={[
                  { label: 'Quick Comic: 20', value: 20 },
                  { label: 'Short Story: 50', value: 50 },
                  { label: 'Full Book: 200', value: 200 },
                ]}
                onSelect={(value) => {
                  setTargetPages(String(value));
                  handleChange('targetPages', value);
                }}
              />
            </div>
            <NumberInput
              id="max-panels"
              label="Max panels / page"
              value={maxPanelsPerPage}
              onChange={(value) => {
                setMaxPanelsPerPage(value);
                handleChange('maxPanelsPerPage', value);
              }}
              onBlur={() => handleBlur('maxPanelsPerPage')}
              min={3}
              max={12}
              required
              helperText="Maximum panels per page (recommended: 4-6)"
              tooltip="Lower values create larger panels and clearer action beats."
              error={maxPanelsError}
              success={Boolean(touched.maxPanelsPerPage && !maxPanelsError)}
              disabled={isFormDisabled}
            />
          </div>

          <FormField
            id="genre-tone"
            label="Genre + tone"
            required
            helperText={GENRE_HELP}
            tooltip="Short, punchy descriptor works best (e.g., Fantasy/Adventure, Epic tone)."
            error={genreError}
            success={genreSuccess}
          >
            <div className="relative">
              <input
                id="genre-tone"
                value={mangaGenre}
                onChange={(event) => {
                  setMangaGenre(event.target.value);
                  handleChange('genreTone', event.target.value);
                }}
                onBlur={() => handleBlur('genreTone')}
                className={`mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none border ${
                  textInputClass(Boolean(genreError), genreSuccess)
                }`}
                placeholder="Fantasy/Adventure, Epic tone"
                aria-invalid={Boolean(genreError)}
                aria-describedby="genre-tone-help genre-tone-error"
                disabled={isFormDisabled}
              />
              {genreError ? (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-red-500">error</span>
              ) : genreSuccess ? (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">check_circle</span>
              ) : null}
            </div>
          </FormField>

          {artStyleSuggestions.length > 0 ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              <p className="font-semibold">Suggested art styles</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {artStyleSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setArtStyle(suggestion)}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {suggestedChapters ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              <p className="font-semibold">Suggestion</p>
              <p>Consider using {suggestedChapters} chapters for a {targetPagesValue}-page project.</p>
              <button
                type="button"
                onClick={() => setNumChapters(String(suggestedChapters))}
                className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700"
              >
                Apply suggestion
              </button>
            </div>
          ) : null}

          <FormField
            id="art-style"
            label="Art style reference"
            required
            helperText={ART_STYLE_HELP}
            tooltip="Be specific! Include medium (digital/traditional), style (manga/western comic/realistic), and color preference"
            error={artStyleError}
            success={artStyleSuccess}
          >
            <div className="relative">
              <input
                id="art-style"
                value={artStyle}
                onChange={(event) => {
                  setArtStyle(event.target.value);
                  handleChange('artStyleReference', event.target.value);
                }}
                onBlur={() => handleBlur('artStyleReference')}
                className={`mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none border ${
                  textInputClass(Boolean(artStyleError), artStyleSuccess)
                }`}
                placeholder="Japanese manga style, detailed"
                aria-invalid={Boolean(artStyleError)}
                aria-describedby="art-style-help art-style-error"
                disabled={isFormDisabled}
              />
              {artStyleError ? (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-red-500">error</span>
              ) : artStyleSuccess ? (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">check_circle</span>
              ) : null}
            </div>
          </FormField>

          <FormField
            id="image-api-url"
            label="Image API URL"
            optionalTag
            helperText="Local image generation endpoint (e.g., https://.../generate). Required for image generation."
            tooltip="Stored for this browser session only. The app will POST prompts to this URL."
          >
            <input
              id="image-api-url"
              value={localImageApiUrl}
              onChange={(event) => setLocalImageApiUrl(event.target.value)}
              className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="https://your-tunnel.loca.lt/generate"
              disabled={isFormDisabled}
            />
          </FormField>

          <FormField
            id="special-requests"
            label="Special requests"
            optionalTag
            helperText="Optional requests for style, pacing, or content constraints"
            tooltip="Add any must-haves or avoidances (e.g., 'no gore', 'soft lighting')."
          >
            <textarea
              id="special-requests"
              value={specialRequests}
              onChange={(event) => setSpecialRequests(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="None"
              disabled={isFormDisabled}
            />
          </FormField>
        </div>
      </div>

      {/* Live output summary */}
      <div className="mt-6 rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Output estimate</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{targetPages || '—'}</p>
            <p className="text-xs text-gray-500 mt-1">pages</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{numChapters || '—'}</p>
            <p className="text-xs text-gray-500 mt-1">chapters</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {targetPages && maxPanelsPerPage
                ? Math.round(Number(targetPages) * Number(maxPanelsPerPage) * 0.7)
                : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">est. panels</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{mainCharacters || '—'}</p>
            <p className="text-xs text-gray-500 mt-1">characters</p>
          </div>
        </div>
      </div>

      {/* Bottom actions — secondary left, primary right */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={isGenerating}
            className={`px-5 py-2.5 rounded-2xl text-sm font-semibold transition-transform ${
              isGenerating ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-900 hover:scale-105'
            }`}
          >
            {importSuccess ? 'Imported!' : 'Import JSON'}
          </button>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-900 hover:scale-105 transition-transform"
          >
            My Projects
          </button>
          {step1.error ? <span className="text-sm text-red-600">{step1.error}</span> : null}
          {importError ? <span className="text-sm text-red-600">{importError}</span> : null}
        </div>
        <button
          type="button"
          onClick={handleGenerateClick}
          disabled={isGenerating || !isValid}
          title={!isValid ? 'Please fix errors before continuing' : undefined}
          className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
            isGenerating || !isValid ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:scale-105'
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
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportJson}
      />

      <ProjectsDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </section>
  );
}
