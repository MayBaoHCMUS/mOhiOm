import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import ProjectsDrawer from '@/components/ProjectsDrawer';
import { useStoryLibrary } from '@/hooks/useStoryLibrary';
import type { SavedStory } from '@/hooks/useStoryLibrary';
import { useBackendHealth, type BackendHealth } from '@/hooks/useBackendHealth';
import { getImageApiUrl } from '@/lib/imageApiUrl';
import { IMAGE_STYLES } from '@/lib/imageStyles';

// ── Validators ────────────────────────────────────────────────────────────────

const projectIdPattern = /^[A-Za-z0-9_-]+$/;

function validateProjectId(v: string) {
  const s = v.trim();
  if (!s || s.length < 3 || !projectIdPattern.test(s)) return false;
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wordCount(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

// ── Image Style Picker ────────────────────────────────────────────────────────

function ImageStylePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = IMAGE_STYLES.find((s) => s.value === value) ?? IMAGE_STYLES[0];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Image Style</label>

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`
          w-full flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm
          border transition-all duration-150 text-left
          ${open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0 shadow-sm relative bg-gray-100">
          <Image src={selected.icon} alt="" fill sizes="28px" className="object-cover" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm leading-tight">{selected.label}</p>
          <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate">{selected.sub}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          {IMAGE_STYLES.map((style) => {
            const isActive = style.value === value;
            return (
              <button
                key={style.value}
                type="button"
                onClick={() => { onChange(style.value); setOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                  ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}
                `}
              >
                <span className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-sm relative bg-gray-100">
                  <Image src={style.icon} alt="" fill sizes="32px" className="object-cover" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm leading-tight ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                    {style.label}
                  </p>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{style.sub}</p>
                </div>
                {isActive && (
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-600">Controls the LoRA + trigger words on the image server.</p>
    </div>
  );
}

// ── Image generation model picker ─────────────────────────────────────────────

const IMAGE_MODEL_OPTIONS = [
  { value: 'default' as const, icon: 'bolt', label: 'SD1.5 / SDXL', sub: 'Default image generation model' },
  { value: 'omni' as const, icon: 'auto_awesome', label: 'Omni (all generation)', sub: 'Used for every image in this project — characters, panels, pages' },
];

// Small colored status dot + label for a backend's health.
function HealthPill({ status }: { status: BackendHealth }) {
  if (status === 'unconfigured') return null;
  const map: Record<Exclude<BackendHealth, 'unconfigured'>, { dot: string; label: string; text: string }> = {
    up:       { dot: 'bg-emerald-500', label: 'Online',    text: 'text-emerald-600' },
    down:     { dot: 'bg-red-500',     label: 'Offline',   text: 'text-red-600' },
    checking: { dot: 'bg-gray-300',    label: 'Checking…', text: 'text-gray-400' },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${status === 'checking' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  );
}

function ImageModelPicker({
  value,
  onChange,
  disabled,
  omniConfigured,
  defaultHealth,
  omniHealth,
  onRecheck,
}: {
  value: 'default' | 'omni';
  onChange: (v: 'default' | 'omni') => void;
  disabled?: boolean;
  omniConfigured: boolean;
  defaultHealth: BackendHealth;
  omniHealth: BackendHealth;
  onRecheck: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const healthFor = (v: 'default' | 'omni'): BackendHealth => (v === 'omni' ? omniHealth : defaultHealth);
  const options = IMAGE_MODEL_OPTIONS.map((o) =>
    o.value === 'omni' && !omniConfigured
      ? { ...o, sub: 'Set the Omni URL in Settings first' }
      : o
  );
  const selected = options.find((o) => o.value === value) ?? options[0];
  const selectedOffline = healthFor(value) === 'down';

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Image Generation Model</label>
        <Link href="/settings" className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:underline">
          Edit in Settings
        </Link>
      </div>

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen((o) => { if (!o) onRecheck(); return !o; }); } }}
        className={`
          w-full flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm
          border transition-all duration-150 text-left
          ${open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0 shadow-sm bg-gray-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-gray-500" style={{ fontSize: 16 }}>{selected.icon}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800 text-sm leading-tight">{selected.label}</p>
            <HealthPill status={healthFor(value)} />
          </div>
          <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate">{selected.sub}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {selectedOffline && (
        <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
          This model&apos;s server is offline — pick another or check Settings.
        </p>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          {options.map((option) => {
            const isActive = option.value === value;
            const health = healthFor(option.value);
            const isOffline = health === 'down';
            return (
              <button
                key={option.value}
                type="button"
                disabled={isOffline}
                onClick={() => { if (isOffline) return; onChange(option.value); setOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                  ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-sm bg-gray-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-500" style={{ fontSize: 18 }}>{option.icon}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold text-sm leading-tight ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {option.label}
                    </p>
                    <HealthPill status={health} />
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{option.sub}</p>
                </div>
                {isActive && !isOffline && (
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-600">This project follows whatever model is configured in Settings — no per-project override. Changes there apply immediately.</p>
    </div>
  );
}

// ── Story Library modal ───────────────────────────────────────────────────────

function StoryPickerModal({ onSelect, onClose }: {
  onSelect: (s: SavedStory) => void;
  onClose: () => void;
}) {
  const { stories } = useStoryLibrary();
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20">
          <h2 className="text-lg font-bold">Switch story</h2>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40">auto_stories</span>
            <p className="text-on-surface-variant font-medium">No saved stories</p>
            <Link href="/studio/story-setup" onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-on-primary hover:opacity-90">
              Go to Story Setup
            </Link>
          </div>
        ) : (
          <div className="overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stories.map((s) => (
              <div key={s.id} className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/10">
                <p className="font-bold text-on-surface text-sm truncate">{s.title || 'Untitled'}</p>
                {s.genre && <p className="text-xs text-on-surface-variant mt-0.5 truncate">{s.genre}</p>}
                <p className="text-xs text-on-surface-variant/60 mt-1">
                  {new Date(s.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <button type="button" onClick={() => onSelect(s)}
                  className="mt-3 w-full px-3 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:opacity-90">
                  Select
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Step1() {
  const {
    projectId,
    mainCharacters,
    numChapters,
    targetPages,
    maxPanelsPerPage,
    mangaGenre,
    artStyle,
    specialRequests,
    localImageApiUrl,
    imageGenBackendMode,
    enableMultiCharacterMode,
    setEnableMultiCharacterMode,
    multiCharacterApiUrl,
    step1,
    globalError,
    setProjectId,
    setStoryText,
    setMangaGenre,
    setMainCharacters,
    setNumChapters,
    setTargetPages,
    setMaxPanelsPerPage,
    setArtStyle,
    setSpecialRequests,
    imageGenStyle,
    setImageGenStyle,
    getCooldownSeconds,
    loadProjectJson,
    fromStorySetup,
    setFromStorySetup,
    setSetupValidation,
  } = useComicGeneration();

  // ── Image-backend health (so a dead server's model can't be picked) ──────────
  const sdHealth = useBackendHealth(getImageApiUrl());
  const omniHealth = useBackendHealth(multiCharacterApiUrl);

  // ── Banner metadata ──────────────────────────────────────────────────────────
  const [importedTitle, setImportedTitle] = useState('');
  const [importedWordCount, setImportedWordCount] = useState(0);
  const [importedAdapted, setImportedAdapted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('mohiom-story-setup');
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (saved.storyTitle) setImportedTitle(String(saved.storyTitle));
      if (saved.adaptedFromOriginal) setImportedAdapted(Boolean(saved.adaptedFromOriginal));
      const wc = typeof saved.adaptedWordCount === 'number'
        ? saved.adaptedWordCount
        : wordCount(String(saved.storyText ?? ''));
      setImportedWordCount(wc);
    } catch { /* ignore */ }
  }, [fromStorySetup]);

  // ── Local state ──────────────────────────────────────────────────────────────
  const [importError, setImportError]   = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen]  = useState(false);

  // Switch story flow
  const [switchModalOpen,   setSwitchModalOpen]   = useState(false);
  const [switchConfirmStory, setSwitchConfirmStory] = useState<SavedStory | null>(null);

  // Remove confirm
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  // Art style tag selection
  const [selectedArtTags, setSelectedArtTags] = useState<string[]>([]);

  // Reset selected tags when genre changes (suggestions change)
  useEffect(() => {
    setSelectedArtTags([]);
  }, [mangaGenre]);

  const handleAddArtTag = (tag: string) => {
    setSelectedArtTags((prev) => [...prev, tag]);
    setArtStyle(artStyle.trim() ? `${artStyle.trim()}, ${tag}` : tag);
  };
  const handleRemoveArtTag = (tag: string) => {
    setSelectedArtTags((prev) => prev.filter((t) => t !== tag));
    setArtStyle(artStyle.split(', ').filter((t) => t.trim() !== tag).join(', '));
  };

  // Validation
  const [projectIdTouched, setProjectIdTouched] = useState(false);
  const [artStyleTouched,  setArtStyleTouched]  = useState(false);

  const projectIdValid = validateProjectId(projectId);
  const artStyleValid  = artStyle.trim().length >= 5;
  const storyValid     = fromStorySetup;

  // 3 required: story + project ID + art style
  const validCount = [storyValid, projectIdValid, artStyleValid].filter(Boolean).length;
  const canGenerate = validCount === 3;

  // Sync required-field completion to shared wizard validation (drives the sticky Next Step button)
  useEffect(() => {
    setSetupValidation({ isValid: canGenerate, errorCount: 3 - validCount, requiredComplete: validCount, requiredTotal: 3 });
  }, [canGenerate, validCount, setSetupValidation]);

  // Art-style suggestions from genre
  const genreLower = mangaGenre.toLowerCase();
  const artSuggestions = genreLower.includes('fantasy')
    ? ['Hand-drawn fantasy ink', 'Ethereal watercolor manga', 'European graphic novel']
    : genreLower.includes('sci-fi') || genreLower.includes('cyber')
      ? ['Clean line sci-fi noir', 'Retro-futuristic manga', 'Neon cyberpunk']
      : genreLower.includes('slice') || genreLower.includes('warm')
        ? ['Soft watercolor', 'Warm indie comic', 'Studio Ghibli-inspired']
        : [];

  // JSON import
  const importInputRef = useRef<HTMLInputElement>(null);
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
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

  // Switch story handlers
  const handleSwitchSelect = (story: SavedStory) => {
    setSwitchModalOpen(false);
    setSwitchConfirmStory(story);
  };
  const handleSwitchConfirm = () => {
    const story = switchConfirmStory;
    if (!story) return;
    // Update localStorage and context
    const adapted = story.adaptedStory !== null;
    const effectiveText = story.adaptedStory ?? story.storyText;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mohiom-story-setup', JSON.stringify({
        storyText: effectiveText,
        storyTitle: story.title,
        genre: story.genre,
        projectId: story.projectId,
        adaptedFromOriginal: adapted,
        adaptedWordCount: adapted ? wordCount(story.adaptedStory ?? '') : null,
        analysisResult: story.analysisResult ?? null,
      }));
    }
    setStoryText(effectiveText);
    setMangaGenre(story.genre);
    setProjectId(story.projectId);
    if (story.analysisResult) {
      const { chars, sceneBeats: beats, panels } = story.analysisResult;
      if (chars.length > 0) setMainCharacters(String(chars.length));
      if (beats > 0) setNumChapters(String(Math.max(1, Math.min(50, Math.ceil(beats / 4)))));
      if (panels > 0) setTargetPages(String(Math.max(10, Math.min(500, Math.round(panels / 5)))));
      setMaxPanelsPerPage('5');
    }
    setFromStorySetup(true);
    setImportedTitle(story.title);
    setImportedWordCount(wordCount(effectiveText));
    setImportedAdapted(adapted);
    setSwitchConfirmStory(null);
  };

  // Remove & start over
  const handleRemoveConfirm = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('mohiom-story-setup');
    }
    setFromStorySetup(false);
    setStoryText('');
    setMangaGenre('');
    setImportedTitle('');
    setImportedWordCount(0);
    setRemoveConfirmOpen(false);
  };

  const cooldownSeconds = getCooldownSeconds(1);
  const isGenerating = step1.isLoading || cooldownSeconds > 0;

  // ── Estimate values ──────────────────────────────────────────────────────────
  const estPanels = (Number(targetPages) || 0) * (Number(maxPanelsPerPage) || 0) * 0.7;

  // ── No story state ───────────────────────────────────────────────────────────
  if (!fromStorySetup) {
    return (
      <section className="bg-white text-gray-900 rounded-3xl p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-semibold">Project configuration</h2>
            <p className="mt-2 text-gray-600">Set up your project identity and visual execution.</p>
          </div>
          <div className="text-sm text-gray-500">Step 1 of 5</div>
        </div>

        <div className="max-w-lg mx-auto text-center py-8">
          <div className="bg-amber-50 border border-amber-200 rounded-3xl px-8 py-10 mb-6">
            <span className="material-symbols-outlined text-5xl text-amber-400 mb-4 block">edit_note</span>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No story found</h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Create and validate your story in Story Setup before starting production.
            </p>
            <Link
              href="/studio/story-setup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-on-primary text-sm font-bold hover:opacity-90 shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
              Go to Story Setup
            </Link>
            <div className="flex items-center gap-3 mt-6 text-xs text-gray-400">
              <div className="flex-1 h-px bg-gray-200" />
              <span>or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
              <button type="button" onClick={() => setIsDrawerOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
                <span className="material-symbols-outlined text-base">folder_open</span>
                Open existing project
              </button>
              <button type="button" onClick={() => importInputRef.current?.click()}
                data-tour="step0-import-json"
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
                <span className="material-symbols-outlined text-base">upload</span>
                Import JSON
              </button>
              <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportJson} />
            </div>
            {importError && <p className="text-sm text-red-600 mt-4">{importError}</p>}
            {importSuccess && <p className="text-sm text-emerald-600 mt-4">Project imported successfully!</p>}
          </div>
        </div>

        <ProjectsDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </section>
    );
  }

  const imageModelReadOnlyInfo =
    imageGenBackendMode === 'byok'
      ? { icon: 'vpn_key', title: 'Bring your own API key', sub: 'Text-prompt only — no reference/consistency features' }
      : { icon: 'error_outline', title: 'Not configured', sub: 'Set an Image API URL in Settings' };

  // ── Story imported state ─────────────────────────────────────────────────────
  return (
    <section className="bg-white text-gray-900 rounded-3xl p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Project configuration</h2>
          <p className="mt-2 text-gray-600">Set up your project identity and visual execution.</p>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setIsDrawerOpen(true)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
            <span className="material-symbols-outlined text-sm">folder_open</span>
            My Projects
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}
            data-tour="step0-import-json"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
            <span className="material-symbols-outlined text-sm">upload</span>
            Import JSON
          </button>
          <span className="text-sm text-gray-500">Step 1 of 5</span>
        </div>
      </div>

      {globalError && (
        <div className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{globalError}</div>
      )}
      {importError && (
        <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</div>
      )}

      {/* Import banner */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
        <div className="flex items-start gap-3 mb-3">
          <span className="material-symbols-outlined text-blue-600 text-xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>download_done</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-blue-900 text-sm">Story imported from Story Setup</p>
            <p className="text-xs text-blue-700 mt-1 truncate">
              {importedTitle ? `"${importedTitle}"` : 'Untitled'}
              {mangaGenre ? ` · ${mangaGenre}` : ''}
              {importedWordCount > 0 && ` · ${importedWordCount.toLocaleString()} words`}
              {importedAdapted && (
                <span className="ml-1 text-emerald-700 font-medium">(AI-adapted)</span>
              )}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-blue-600">
              {Number(mainCharacters) > 0 && <span>{mainCharacters} chars</span>}
              {Number(numChapters) > 0 && <span>· {numChapters} chapters</span>}
              {Number(targetPages) > 0 && <span>· {targetPages} pages</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/studio/story-setup"
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 rounded-xl px-3 py-1.5"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Edit in Story Setup ↗
          </Link>
          <button type="button" onClick={() => setSwitchModalOpen(true)}
            data-tour="step0-switch-story"
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 rounded-xl px-3 py-1.5">
            <span className="material-symbols-outlined text-sm">swap_horiz</span>
            Switch story
          </button>
          <button type="button" onClick={() => setRemoveConfirmOpen(true)}
            className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 bg-white border border-red-200 rounded-xl px-3 py-1.5">
            <span className="material-symbols-outlined text-sm">close</span>
            Remove &amp; start over
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">{validCount} of 3 required fields complete</span>
          {canGenerate && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Ready
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${canGenerate ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.round((validCount / 3) * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex gap-4 text-xs">
          {[
            { label: 'Story imported', ok: storyValid },
            { label: 'Project ID', ok: projectIdValid },
            { label: 'Art Style', ok: artStyleValid },
          ].map(({ label, ok }) => (
            <span key={label} className={`flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: ok ? "'FILL' 1" : "'FILL' 0" }}>
                {ok ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Form grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">

        {/* Left — Project Identity */}
        <div className="flex-1 rounded-3xl bg-gray-100 p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">badge</span>
            <h3 className="text-lg font-semibold">Project identity</h3>
          </div>

          {/* Project ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500" htmlFor="pipeline-project-id">
              Project ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="pipeline-project-id"
                data-tour="step0-project-id"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                onBlur={() => setProjectIdTouched(true)}
                className={`w-full rounded-2xl bg-white px-4 py-3 text-sm font-mono focus:outline-none border ${
                  projectIdTouched && !projectIdValid
                    ? 'border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                    : projectIdValid
                      ? 'border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                }`}
                placeholder="the_dark_001"
                disabled={isGenerating}
              />
              {projectIdTouched && !projectIdValid && (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-red-500 text-sm">error</span>
              )}
              {projectIdValid && (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 text-sm">check_circle</span>
              )}
            </div>
            {projectIdTouched && !projectIdValid && (
              <p className="text-xs text-red-600">Min 3 characters · letters, numbers, - and _ only</p>
            )}
            <p className="text-xs text-gray-600">Used in file names and URLs.</p>
          </div>

          {/* Tags (optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500" htmlFor="pipeline-tags">Tags</label>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-500 rounded-full px-2 py-0.5">Optional</span>
            </div>
            <input
              id="pipeline-tags"
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm focus:outline-none border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="fantasy, dark, manga"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-600">Comma-separated tags for organizing projects.</p>
          </div>

          {/* Summary (optional) */}
          <div className="flex flex-col gap-1.5 flex-grow">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500" htmlFor="pipeline-summary">Summary / Overview</label>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-500 rounded-full px-2 py-0.5">Optional</span>
            </div>
            <textarea
              id="pipeline-summary"
              className="flex-grow w-full rounded-2xl bg-white px-4 py-3 text-sm focus:outline-none border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none min-h-[72px]"
              placeholder="A brief description for your project list…"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-600">A brief description for your project list.</p>
          </div>
        </div>

        {/* Right — Visual Execution + Content Guardrails */}
        <div className="flex-1 rounded-3xl bg-gray-100 p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">palette</span>
            <h3 className="text-lg font-semibold">Visual execution</h3>
          </div>

          {/* Art Style Reference */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500" htmlFor="pipeline-art-style">
              Art Style Reference <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="pipeline-art-style"
                data-tour="step0-art-style"
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                onBlur={() => setArtStyleTouched(true)}
                className={`w-full rounded-2xl bg-white px-4 py-3 text-sm focus:outline-none border ${
                  artStyleTouched && !artStyleValid
                    ? 'border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                    : artStyleValid
                      ? 'border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                }`}
                placeholder="Japanese manga style, detailed, black and white"
                disabled={isGenerating}
              />
              {artStyleTouched && !artStyleValid && (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-red-500 text-sm">error</span>
              )}
              {artStyleValid && (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 text-sm">check_circle</span>
              )}
            </div>
            {artStyleTouched && !artStyleValid && (
              <p className="text-xs text-red-600">Please describe the art style (at least 5 characters)</p>
            )}
            {(artSuggestions.length > 0 || selectedArtTags.length > 0) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedArtTags.map((tag) => (
                  <button
                    key={`sel-${tag}`}
                    type="button"
                    onClick={() => handleRemoveArtTag(tag)}
                    className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900 flex items-center gap-1 hover:bg-blue-200"
                  >
                    {tag}
                    <span className="text-blue-500 text-sm leading-none">×</span>
                  </button>
                ))}
                {artSuggestions.filter((s) => !selectedArtTags.includes(s)).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleAddArtTag(s)}
                    className="rounded-full bg-white border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-500 flex items-center gap-1 hover:bg-gray-50"
                  >
                    <span className="text-gray-400 text-sm leading-none">+</span>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600">Include medium, style, and color preference.</p>
          </div>

          {/* Image Generation Model */}
          {imageGenBackendMode === 'byok' || !localImageApiUrl ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Image Generation Model</label>
                <Link href="/settings" className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:underline">
                  Edit in Settings
                </Link>
              </div>
              <div className="w-full flex items-center gap-3 rounded-2xl bg-white px-4 py-3 border border-gray-300">
                <span className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0 shadow-sm bg-gray-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-500" style={{ fontSize: 16 }}>{imageModelReadOnlyInfo.icon}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm leading-tight">{imageModelReadOnlyInfo.title}</p>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate">{imageModelReadOnlyInfo.sub}</p>
                </div>
              </div>
              <p className="text-xs text-gray-600">This project follows whatever model is configured in Settings — no per-project override.</p>
            </div>
          ) : (
            <ImageModelPicker
              value={enableMultiCharacterMode ? 'omni' : 'default'}
              onChange={(v) => setEnableMultiCharacterMode(v === 'omni')}
              omniConfigured={!!multiCharacterApiUrl}
              defaultHealth={sdHealth.status}
              omniHealth={omniHealth.status}
              onRecheck={() => { sdHealth.recheck(); omniHealth.recheck(); }}
            />
          )}

          {/* Image Style */}
          <ImageStylePicker value={imageGenStyle} onChange={setImageGenStyle} disabled={isGenerating} />

          {/* Content Guardrails */}
          <div className="pt-2 border-t border-gray-200 flex flex-col gap-4 flex-grow">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-500 text-base">security</span>
              <h4 className="text-sm font-semibold text-gray-700">Content guardrails</h4>
            </div>
            <div className="flex flex-col gap-1.5 flex-grow">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500" htmlFor="pipeline-special">Special Requests</label>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-500 rounded-full px-2 py-0.5">Optional</span>
              </div>
              <textarea
                id="pipeline-special"
                data-tour="step0-special-requests"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="flex-grow w-full rounded-2xl bg-white px-4 py-3 text-sm focus:outline-none border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none min-h-[72px]"
                placeholder="e.g. No gore, soft lighting, keep scenes family-friendly"
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-600">Optional requests for style, pacing, or content restrictions.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Output Estimate — read-only from Story Setup */}
      <div className="mt-6 px-1">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Output estimate · from Story Setup</p>
          <Link href="/studio/story-setup" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
            Edit targets ↗
          </Link>
        </div>
        <div className="flex items-center">
          {[
            { val: targetPages || '—', label: 'Pages' },
            { val: numChapters || '—', label: 'Chapters' },
            { val: estPanels > 0 ? `~${Math.round(estPanels)}` : '—', label: 'Est. panels' },
            { val: mainCharacters || '—', label: 'Characters' },
          ].map(({ val, label }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className="w-px h-10 bg-gray-200 flex-shrink-0 mx-4" />}
              <div className="flex-1 text-center select-none">
                <p className="text-[30px] font-semibold text-gray-900 leading-tight">{val}</p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            </React.Fragment>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-gray-400 leading-snug">
          * Estimates are based on your Advanced Setup targets. Actual output depends on story length and AI generation results.
        </p>
      </div>

      <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportJson} />

      {/* Switch story modal */}
      {switchModalOpen && (
        <StoryPickerModal
          onSelect={handleSwitchSelect}
          onClose={() => setSwitchModalOpen(false)}
        />
      )}

      {/* Switch story confirm */}
      {switchConfirmStory && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
            <p className="font-bold text-on-surface">Switch to &ldquo;{switchConfirmStory.title}&rdquo;?</p>
            <p className="text-sm text-on-surface-variant">Current import will be replaced.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSwitchConfirmStory(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest">
                Cancel
              </button>
              <button type="button" onClick={handleSwitchConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-on-primary hover:opacity-90">
                Switch story
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirm */}
      {removeConfirmOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
            <p className="font-bold text-on-surface">Remove imported story?</p>
            <p className="text-sm text-on-surface-variant">
              You&rsquo;ll need to go back to Story Setup to add a new one.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setRemoveConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest">
                Cancel
              </button>
              <button type="button" onClick={handleRemoveConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-error text-on-error hover:opacity-90">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <ProjectsDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </section>
  );
}