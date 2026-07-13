'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { analyzeStoryLightweightStream, adaptStoryStream } from '@/services/api';
import type { AdaptStoryResult } from '@/services/api';
import { useStoryLibrary } from '@/hooks/useStoryLibrary';
import type { SavedStory } from '@/hooks/useStoryLibrary';

// ─── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_STORY = `In a world where magic is forbidden, a young scholar named Elena discovers an ancient spellbook hidden in her university's restricted archive. Drawn to its glowing script, she traces a single rune — and the room ignites with a light only she can see.

Master Kael, her stern mentor, warns her that the Inquisition burns those who awaken. But Elena cannot stop. Each night she returns to the archive, unlocking spells that whisper of a war the empire buried centuries ago.

When the Inquisitor arrives at the university gates, Elena must choose: surrender the book, or run into the wilds and become the very thing the empire fears most.`;

const GENRE_CHIPS = [
  { label: 'Fantasy / Adventure · Epic',   tooltip: 'Broad world-building with high-stakes conflict and magical elements' },
  { label: 'Sci-fi / Cyberpunk · Gritty',  tooltip: 'Near-future technology, dystopian themes and urban decay' },
  { label: 'Slice of life · Warm',          tooltip: 'Everyday moments with emotional warmth and relatable characters' },
  { label: 'Mystery / Noir · Tense',        tooltip: 'Dark atmosphere, unreliable narrators and investigative tension' },
  { label: 'Romance · Tender',              tooltip: 'Emotional vulnerability, intimate moments and heartfelt connections' },
];

const DIRECTION_CHIPS = [
  'Add a new character',
  'Add a subplot',
  'Change the genre',
  'Change the ending',
  'Make it darker',
  'Add comic relief',
];

const PRO_TIPS: Record<'foundation' | 'narrative' | 'creative', { tip: string }> = {
  foundation: {
    tip: 'A clear genre sets the visual tone early. "Fantasy / Dark" tells the AI to use shadowy palettes and dramatic angles.',
  },
  narrative: {
    tip: 'Name and describe characters clearly — distinctive looks, age, and demeanor give the AI far better character sheets in the next step.',
  },
  creative: {
    tip: 'Give the AI specific, actionable direction. "Add a rival named Kira who is cold and calculating" works better than just "add conflict".',
  },
};

const WORD_LIMIT = 5000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function detectCharacters(text: string): string[] {
  const STOPWORDS = new Set([
    'The','When','But','Each','Master','She','Her','His','They','There',
    'This','That','These','Those','What','Who','How','Why','And','For',
    'Not','Are','Was','Has','Had','Did','Does','Been','With','From','Into',
    'Upon','Once','Then','Here','More','Only','Very','Just','After','Before',
  ]);
  const matches = text.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
  return [...new Set(matches)].filter((w) => !STOPWORDS.has(w)).slice(0, 3);
}

const ACTION_VERBS_RE = /\b(is|are|was|were|has|have|had|goes|went|comes|came|sees|saw|finds|found|tells|told|says|said|walks|runs|stands|looks|turns|falls|rises|meets|leaves|enters|arrives|discovers|tries|begins|starts|fights|saves|escapes|follows|hears|feels|knows|thinks|wants|takes|gives|makes|gets|shows|speaks|calls|asks|reveals|confronts|faces|overcomes|decides|returns|grows|changes|learns|loses|wins)\b/i;

function isValidBeat(desc: string): boolean {
  if (!desc.trim() || /^beat\s+\d+$/i.test(desc.trim())) return false;
  if (/a\s+\w+(\s+\w+)?\s+story\s+by\b/i.test(desc)) return false;
  const words = desc.trim().split(/\s+/);
  if (words.length <= 3 && words.every((w) => /^[A-Z][a-z]*\.?$/.test(w))) return false;
  if (words.length < 5 && !ACTION_VERBS_RE.test(desc)) return false;
  return true;
}

function truncateBeat(desc: string, max = 60): string {
  return desc.length > max ? desc.slice(0, max) + '…' : desc;
}

// ─── Tooltip chip ─────────────────────────────────────────────────────────────

function GenreChip({ label, tooltip, active, onClick }: {
  label: string; tooltip: string; active: boolean; onClick: () => void;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-all ${
          active
            ? 'bg-primary text-on-primary shadow-sm shadow-primary/20'
            : 'text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high'
        }`}
      >
        {label}
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 hidden group-hover:block pointer-events-none min-w-[180px]">
        <div className="bg-surface-container-highest text-on-surface text-[11px] font-medium rounded-xl px-3 py-2 shadow-xl text-center leading-snug">
          {tooltip}
        </div>
        <div className="w-2.5 h-2.5 bg-surface-container-highest rotate-45 mx-auto -mt-1.5" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StorySetupPage() {
  const router = useRouter();
  const { save: saveStory, stories: savedStories } = useStoryLibrary();

  // Form inputs (story-only — art/structure fields moved to Pipeline Step 1)
  const [storyTitle, setStoryTitle] = useState('');
  const [projectId,  setProjectId]  = useState('');
  const [genre,      setGenre]      = useState('');
  const [storyText,  setStoryText]  = useState('');

  // Story adaptation
  const [creativeDirection, setCreativeDirection] = useState('');
  const [adaptState, setAdaptState] = useState<'idle' | 'thinking' | 'done' | 'error'>('idle');
  const [thinkingText, setThinkingText] = useState('');
  const [adaptedStory, setAdaptedStory] = useState<string | null>(null);
  const [changesSummary, setChangesSummary] = useState<string[]>([]);
  const [changesExpanded, setChangesExpanded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const adaptAbortRef = useRef<AbortController | null>(null);

  // Analysis
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [analysisResult, setAnalysisResult] = useState<{
    sceneBeats: number; chars: string[]; tone: string[]; panels: number;
  } | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [beatsExpanded, setBeatsExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Creative direction — collapsible, collapsed by default
  const [creativeOpen, setCreativeOpen] = useState(false);

  // Advanced Setup (production targets) — expanded by default
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [advancedMainChars,  setAdvancedMainChars]  = useState('3');
  const [advancedNumChapters, setAdvancedNumChapters] = useState('4');
  const [advancedTargetPages, setAdvancedTargetPages] = useState('20');
  const [advancedMaxPanels,  setAdvancedMaxPanels]  = useState('5');

  // Auto-expand Advanced Setup on capacity mismatch after analysis
  useEffect(() => {
    if (!analysisResult) return;
    const charMismatch = analysisResult.chars.length > parseInt(advancedMainChars, 10);
    const pagesMismatch = analysisResult.panels > parseInt(advancedTargetPages, 10) * parseInt(advancedMaxPanels, 10) * 0.7;
    if (charMismatch || pagesMismatch) setAdvancedOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResult]);

  // Mode: Quick Start (minimal) | Full Setup (all fields) | Load Story — Full Setup by default
  const [mode, setMode] = useState<'quick' | 'full'>('full');
  const autoAnalysisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active section for contextual pro tip
  const [activeSection, setActiveSection] = useState<'foundation' | 'narrative' | 'creative'>('foundation');

  // More menu (save / load / etc.)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; action?: { label: string; href: string } } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load story modal
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [loadConfirm, setLoadConfirm] = useState<SavedStory | null>(null);

  // Autosave
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Character overrides for low-confidence cards (Fix 4, 7)
  const [charOverrides, setCharOverrides] = useState<Record<string, 'keep' | 'removed'>>({});
  // Session-only Quick Start notice dismiss (Fix 5)
  const [quickNoticeDismissed, setQuickNoticeDismissed] = useState(false);
  // Expanded beat rows (Fix 8)
  const [expandedBeats, setExpandedBeats] = useState<Set<string>>(new Set());

  const flashSave = useCallback(() => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState('saved'), 900);
  }, []);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // Load story when navigated from Story Drafts page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const loadRaw = window.localStorage.getItem('mohiom-story-setup-load');
      if (!loadRaw) return;
      window.localStorage.removeItem('mohiom-story-setup-load');
      const { storyId } = JSON.parse(loadRaw) as { storyId: string };
      const libraryRaw = window.localStorage.getItem('mohiom-story-library');
      if (!libraryRaw) return;
      const library = JSON.parse(libraryRaw) as SavedStory[];
      const story = library.find((s) => s.id === storyId);
      if (story) handleLoadStory(story);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click-outside to close more menu
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [toast]);

  // Quick Start: auto-trigger analysis after 1.5s of no typing when essentials met
  useEffect(() => {
    if (mode !== 'quick') return;
    if (analysisState === 'loading' || analysisState === 'done') return;
    if (!storyTitle.trim() || storyText.trim().length < 80) return;
    if (autoAnalysisTimer.current) clearTimeout(autoAnalysisTimer.current);
    autoAnalysisTimer.current = setTimeout(() => {
      runAnalysis();
    }, 1500);
    return () => { if (autoAnalysisTimer.current) clearTimeout(autoAnalysisTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storyTitle, storyText, analysisState]);

  // Quick Start essentials: title + narrative only (genre not required)
  // Full Setup essentials: title + genre + narrative
  const essentialChecks =
    mode === 'quick'
      ? [storyTitle.trim() !== '', storyText.trim().length >= 80]
      : [storyTitle.trim() !== '', genre.trim() !== '', storyText.trim().length >= 80];
  const essentialsTotal = mode === 'quick' ? 2 : 3;
  const essentials = essentialChecks.filter(Boolean).length;
  const canProceed = essentials === essentialsTotal;

  // File upload
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setStoryText(ev.target?.result as string); flashSave(); };
    reader.readAsText(f);
  };

  // Sample fill
  const fillSample = () => {
    setStoryText(SAMPLE_STORY);
    setStoryTitle('The Last Ember');
    setProjectId('last_ember_001');
    setGenre('Fantasy / Adventure · Epic');
    flashSave();
  };

  // AI analysis — lightweight endpoint focused on characters/beats/tone
  const runAnalysis = useCallback(() => {
    if (!canProceed || analysisState === 'loading') return;
    abortRef.current?.abort();
    setAnalysisState('loading');
    setStreamingText('');
    setBeatsExpanded(false);

    const ctrl = analyzeStoryLightweightStream(
      {
        story_text: storyText,
        genre_tone: genre || 'Adventure',
      },
      {
        onToken: (tok) => setStreamingText((p) => p + tok),
        onDone: (res) => {
          setAnalysisResult({
            sceneBeats: res.scene_beats,
            chars: res.detected_characters.slice(0, 5),
            tone: res.tone_tags.slice(0, 4),
            panels: res.estimated_panels,
          });
          setAnalysisState('done');
        },
        onError: () => {
          setAnalysisResult({
            sceneBeats: Math.max(4, Math.round(wordCount(storyText) / 15)),
            chars: detectCharacters(storyText),
            tone: ['Adventure'],
            panels: 100,
          });
          setAnalysisState('done');
        },
      },
    );
    abortRef.current = ctrl;
  }, [canProceed, analysisState, storyText, genre]);

  const runAdaptation = useCallback(() => {
    const sourceStory = (adaptedStory && !showOriginal ? adaptedStory : storyText).trim();
    if (!sourceStory || !creativeDirection.trim() || adaptState === 'thinking') return;
    adaptAbortRef.current?.abort();
    setAdaptState('thinking');
    setThinkingText('');

    const ctrl = adaptStoryStream(
      {
        original_story: sourceStory,
        creative_direction: creativeDirection,
        genre_tone: genre || 'Adventure',
        art_style_reference: 'manga',
        special_requests: 'None',
      },
      {
        onThinking: (tok) => setThinkingText((p) => p + tok),
        onDone: (result: AdaptStoryResult) => {
          setAdaptedStory(result.adapted_story);
          setChangesSummary(result.changes_summary);
          setChangesExpanded(true);
          setShowOriginal(false);
          setAdaptState('done');
          flashSave();
        },
        onError: () => setAdaptState('error'),
      },
    );
    adaptAbortRef.current = ctrl;
  }, [adaptedStory, showOriginal, storyText, creativeDirection, adaptState, genre, flashSave]);

  const handleSaveStory = useCallback(() => {
    const saved = saveStory({
      title: storyTitle || 'Untitled Story',
      projectId,
      storyText,
      adaptedStory,
      genre,
      creativeDirection,
      analysisResult,
    });
    setMoreMenuOpen(false);
    setToast({ message: `"${saved.title}" saved to Story Drafts`, action: { label: 'View →', href: '/studio/my-stories' } });
  }, [saveStory, storyTitle, projectId, storyText, adaptedStory, genre, creativeDirection, analysisResult]);

  const handleLoadStory = useCallback((story: SavedStory) => {
    setStoryTitle(story.title);
    setProjectId(story.projectId);
    setGenre(story.genre);
    setStoryText(story.storyText);
    setAdaptedStory(story.adaptedStory);
    setCreativeDirection(story.creativeDirection);
    if (story.analysisResult) {
      setAnalysisResult(story.analysisResult);
      setAnalysisState('done');
    }
    setShowOriginal(false);
    setLoadConfirm(null);
    setLoadModalOpen(false);
    flashSave();
  }, [flashSave]);

  const handleExportJson = useCallback(() => {
    const effectiveStory = (adaptedStory && !showOriginal) ? adaptedStory : storyText;
    const data = {
      storyTitle, projectId, genre,
      storyText: effectiveStory,
      adaptedFromOriginal: adaptedStory !== null && !showOriginal,
      creativeDirection,
      analysisResult: analysisResult ?? null,
      mainCharacters: advancedMainChars,
      numChapters: advancedNumChapters,
      targetPages: advancedTargetPages,
      maxPanelsPerPage: advancedMaxPanels,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectId || 'story'}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMoreMenuOpen(false);
  }, [storyTitle, projectId, genre, storyText, adaptedStory, showOriginal, creativeDirection, analysisResult, advancedMainChars, advancedNumChapters, advancedTargetPages, advancedMaxPanels]);

  const handleNext = () => {
    const effectiveStory = (adaptedStory && !showOriginal) ? adaptedStory : storyText;
    if (typeof window !== 'undefined') {
      const adapted = adaptedStory !== null && !showOriginal;
      localStorage.setItem('mohiom-story-setup', JSON.stringify({
        storyText: effectiveStory,
        storyTitle,
        genre,
        projectId,
        adaptedFromOriginal: adapted,
        adaptedWordCount: adapted ? wordCount(adaptedStory ?? '') : null,
        analysisResult: analysisResult ?? null,
        // Explicit production targets from Advanced Setup (take priority over analysis-derived values)
        mainCharacters: advancedMainChars,
        numChapters: advancedNumChapters,
        targetPages: advancedTargetPages,
        maxPanelsPerPage: advancedMaxPanels,
      }));
    }
    router.push('/studio');
  };

  // Word count display
  const originalWords = wordCount(storyText);
  const adaptedWords  = adaptedStory ? wordCount(adaptedStory) : null;
  const displayWords  = (adaptedStory !== null && !showOriginal && adaptedWords !== null) ? adaptedWords : originalWords;
  const wordProgress  = Math.min((displayWords / WORD_LIMIT) * 100, 100);
  const wordBarColor  = wordProgress >= 100 ? 'bg-red-500' : wordProgress >= 80 ? 'bg-amber-400' : 'bg-emerald-500';

  // Live metadata for STATE 2
  const detectedChars = storyText.trim().length > 30 ? detectCharacters(storyText) : [];

  // 5-state AI panel
  const panelState: 'empty' | 'filling' | 'ready' | 'running' | 'done' =
    analysisState === 'loading' ? 'running' :
    analysisState === 'done'    ? 'done'    :
    canProceed                  ? 'ready'   :
    (storyTitle.trim() || genre.trim() || storyText.trim().length > 0) ? 'filling' :
    'empty';

  const missingEssentials = [
    !storyTitle.trim() && 'Title',
    mode === 'full' && !genre.trim() && 'Genre',
    storyText.trim().length < 80 && 'Narrative',
  ].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="pt-24 pb-32 px-8 max-w-[1400px] mx-auto ml-[var(--studio-sidebar-width)]">

        {/* ── Page header ── */}
        <header className="mb-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tighter text-on-surface">Create Your Story</h1>
              <p className="text-on-surface-variant mt-1">
                Design your story here. When ready, send it to the pipeline to generate your comic.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-save indicator */}
              <div className="flex items-center gap-2 text-sm text-on-surface-variant bg-surface-container-lowest border border-outline-variant/40 rounded-full px-4 py-2">
                <span className={`material-symbols-outlined text-base ${saveState === 'saved' ? 'text-emerald-500' : 'animate-spin text-on-surface-variant'}`}>
                  {saveState === 'saved' ? 'cloud_done' : 'cloud_sync'}
                </span>
                <span>{saveState === 'saved' ? 'Auto-saved' : 'Saving…'}</span>
              </div>

              {/* Manage story menu */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen((v) => !v)}
                  className="flex items-center gap-1 text-sm font-semibold text-on-surface-variant bg-surface-container-lowest border border-outline-variant/40 rounded-full px-4 py-2 hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-base">menu_book</span>
                  Manage story
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>
                {moreMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-lg z-50 overflow-hidden">
                    <button type="button" onClick={handleSaveStory}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low transition-colors text-left">
                      <span className="material-symbols-outlined text-base text-primary">bookmark</span>
                      Save as new story
                    </button>
                    <button type="button" onClick={() => { setMoreMenuOpen(false); setLoadModalOpen(true); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low transition-colors text-left">
                      <span className="material-symbols-outlined text-base text-on-surface-variant">folder_open</span>
                      Load story…
                    </button>
                    <button type="button" onClick={handleExportJson}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low transition-colors text-left">
                      <span className="material-symbols-outlined text-base text-on-surface-variant">download</span>
                      Export as JSON
                    </button>
                    <div className="border-t border-outline-variant/20" />
                    <button type="button"
                      onClick={() => {
                        // Duplicate: save current state as a new story with "(copy)" suffix
                        const saved = saveStory({
                          title: (storyTitle || 'Untitled Story') + ' (copy)',
                          projectId,
                          storyText,
                          adaptedStory,
                          genre,
                          creativeDirection,
                          analysisResult,
                        });
                        setMoreMenuOpen(false);
                        setToast({ message: `Duplicated as "${saved.title}"`, action: { label: 'View →', href: '/studio/my-stories' } });
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low transition-colors text-left">
                      <span className="material-symbols-outlined text-base text-on-surface-variant">content_copy</span>
                      Duplicate story
                    </button>
                    <button type="button"
                      onClick={() => {
                        if (confirm('Reset the form? All unsaved changes will be lost.')) {
                          setStoryTitle(''); setProjectId(''); setGenre(''); setStoryText('');
                          setAdaptedStory(null); setCreativeDirection(''); setAnalysisState('idle');
                          setAnalysisResult(null); setMoreMenuOpen(false);
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors text-left border-t border-outline-variant/20">
                      <span className="material-symbols-outlined text-base">delete</span>
                      Delete draft
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="mt-6 flex items-center gap-1 bg-surface-container-low rounded-2xl p-1 w-fit">
            {([
              { key: 'quick', label: 'Quick Start', icon: 'bolt',       desc: 'Title + narrative only' },
              { key: 'full',  label: 'Full Setup',  icon: 'tune',       desc: 'All fields + creative direction' },
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  if (key === 'full' && analysisState === 'done') {
                    // Keep analysis result, just expand mode
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  mode === key
                    ? 'bg-surface-container-lowest shadow-sm text-on-surface'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">{icon}</span>
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLoadModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest transition-all"
            >
              <span className="material-symbols-outlined text-base">folder_open</span>
              Load Story
            </button>
          </div>

          {/* Quick Start notice — directly below mode tabs (Fix 5) */}
          {mode === 'quick' && !quickNoticeDismissed && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blue-50 border-l-4 border-blue-400 px-4 py-3">
              <span className="material-symbols-outlined text-blue-500 text-base flex-shrink-0">info</span>
              <p className="text-sm text-blue-800 flex-1">
                Quick Start hides Creative Direction and Advanced Setup.{' '}
                <button type="button" onClick={() => setMode('full')} className="font-semibold text-blue-600 hover:underline">
                  Switch to Full Setup →
                </button>
              </p>
              <button type="button" onClick={() => setQuickNoticeDismissed(true)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}

          {/* Progress bar — essentials */}
          <div className="mt-4 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container transition-all duration-500"
                  style={{ width: `${(essentials / essentialsTotal) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-on-surface whitespace-nowrap">{essentials}/{essentialsTotal} essentials</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-on-surface-variant">
              {(mode === 'quick'
                ? ['Title', 'Narrative'] as const
                : ['Title', 'Genre', 'Narrative'] as const
              ).map((label, i) => (
                <span key={label} className={`flex items-center gap-1 transition-colors ${essentialChecks[i] ? 'text-emerald-600' : ''}`}>
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: essentialChecks[i] ? "'FILL' 1" : "'FILL' 0" }}>
                    {essentialChecks[i] ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  {label}
                </span>
              ))}
              {mode === 'quick' && (
                <span className="text-on-surface-variant/50 italic">Analysis auto-runs</span>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ═══════════ FORM COLUMN ═══════════ */}
          <section className="lg:col-span-8 space-y-6">

            {/* 1. Story foundation */}
            <div
              className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,88,190,0.05)] border border-outline-variant/10"
              onFocus={() => setActiveSection('foundation')}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary text-2xl">title</span>
                <h2 className="text-xl font-bold tracking-tight">Story foundation</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`space-y-2 ${mode === 'full' ? '' : 'md:col-span-2'}`}>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="storyTitle">Story title</label>
                  <input
                    id="storyTitle" value={storyTitle} placeholder="The Last Ember"
                    onChange={(e) => { setStoryTitle(e.target.value); flashSave(); }}
                    className="field"
                  />
                  <p className="text-xs text-on-surface-variant/70 px-1">Shown on your cover and project list.</p>
                </div>

                {/* Genre chips — optional in Quick Start (Fix 3.1) */}
                {mode === 'quick' && (
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Genre &amp; tone</label>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high rounded-full px-2 py-0.5">Optional</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {GENRE_CHIPS.map((chip) => (
                        <GenreChip
                          key={chip.label}
                          label={chip.label}
                          tooltip={chip.tooltip}
                          active={genre === chip.label}
                          onClick={() => { setGenre(genre === chip.label ? '' : chip.label); flashSave(); }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-on-surface-variant/70 px-1">Helps AI understand your story&apos;s visual tone.</p>
                  </div>
                )}

                {mode === 'full' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="projectId">Project ID</label>
                    <div className="relative">
                      <input
                        id="projectId" value={projectId} placeholder="last_ember_001" className="field font-mono pr-10"
                        onChange={(e) => { setProjectId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '')); flashSave(); }}
                      />
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">tag</span>
                    </div>
                    <p className="text-xs text-on-surface-variant/70 px-1">Letters, numbers, - and _ only.</p>
                  </div>
                )}
                {mode === 'full' && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="genre">Genre &amp; tone</label>
                    <input
                      id="genre" value={genre} placeholder="Fantasy / Adventure · Epic, hopeful" className="field"
                      onChange={(e) => { setGenre(e.target.value); flashSave(); }}
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      {GENRE_CHIPS.map((chip) => (
                        <GenreChip
                          key={chip.label}
                          label={chip.label}
                          tooltip={chip.tooltip}
                          active={genre === chip.label}
                          onClick={() => { setGenre(chip.label); flashSave(); }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Your narrative */}
            <div
              className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,88,190,0.05)] border border-outline-variant/10"
              onFocus={() => setActiveSection('narrative')}
            >
              <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">edit_note</span>
                  <h2 className="text-xl font-bold tracking-tight">Your narrative</h2>
                </div>
                <button type="button" onClick={fillSample}
                  className="text-xs font-semibold text-primary hover:bg-surface-container-low rounded-full px-3 py-1.5 flex items-center gap-1 transition-colors">
                  <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                  Use sample
                </button>
              </div>

              {/* Upload zone */}
              <label htmlFor="fileInput"
                className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-outline-variant hover:border-primary/50 bg-surface-container-low/60 hover:bg-surface-container-low px-5 py-4 cursor-pointer transition-all mb-5">
                <span className="material-symbols-outlined text-primary text-2xl">upload_file</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-on-surface">
                    Drop a <span className="font-mono">.txt</span> or <span className="font-mono">.md</span> file, or <span className="text-primary">browse</span>
                  </p>
                  <p className="text-xs text-on-surface-variant/70 mt-0.5">Optional — auto-fills the text below. Up to 5,000 words.</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-container-high text-on-surface-variant rounded-full px-2 py-1">Optional</span>
                <input id="fileInput" type="file" accept=".txt,.md" className="hidden" onChange={handleFile} />
              </label>

              {/* Adapted story badge + toggle */}
              {adaptedStory !== null && (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>auto_fix_high</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                      AI-adapted story
                    </span>
                  </div>
                  <button type="button"
                    onClick={() => setShowOriginal((v) => !v)}
                    className="text-xs font-semibold text-primary hover:bg-surface-container-low rounded-full px-3 py-1.5 flex items-center gap-1 transition-colors">
                    <span className="material-symbols-outlined text-sm">{showOriginal ? 'visibility' : 'history'}</span>
                    {showOriginal ? 'View adapted' : 'View original'}
                  </button>
                </div>
              )}

              <textarea
                value={adaptedStory !== null && !showOriginal ? adaptedStory : storyText}
                onChange={(e) => {
                  if (adaptedStory !== null && !showOriginal) {
                    setAdaptedStory(e.target.value);
                  } else {
                    setStoryText(e.target.value);
                  }
                  flashSave();
                }}
                placeholder={`Paste or write your story here...\n\nExample:\nIn a world where magic is forbidden, a young scholar named Elena discovers an ancient spellbook...\n\nTip: include character names, key plot points, and the tone you're after.`}
                className="field !rounded-2xl !p-5 leading-relaxed min-h-[260px] w-full"
              />

              {/* Word count — dual label + progress bar */}
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-on-surface-variant">
                  {adaptedStory !== null ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`flex items-center gap-1 ${!showOriginal ? 'font-semibold text-emerald-700' : ''}`}>
                        <span className="material-symbols-outlined text-xs text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>auto_fix_high</span>
                        AI-adapted: <span className="font-bold">{(adaptedWords ?? 0).toLocaleString()}</span> words · ~{Math.max(0, Math.round((adaptedWords ?? 0) / 200))} min read
                      </span>
                      <span className="w-px h-3 bg-outline-variant" />
                      <span className={`flex items-center gap-1.5 ${showOriginal ? 'font-semibold' : ''}`}>
                        Original: <span className="font-bold">{originalWords.toLocaleString()}</span> words
                        {originalWords > WORD_LIMIT && (
                          <span className="text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 text-[10px] font-bold">⚠ Over limit</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span><span className="font-bold text-on-surface">{originalWords.toLocaleString()}</span> words</span>
                      <span className="w-px h-3 bg-outline-variant" />
                      <span>~{Math.max(0, Math.round(originalWords / 200))} min read</span>
                      {originalWords > WORD_LIMIT && (
                        <span className="text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 text-[10px] font-bold">⚠ Over limit</span>
                      )}
                    </div>
                  )}
                  <span className="text-on-surface-variant/60 tabular-nums">{displayWords.toLocaleString()} / {WORD_LIMIT.toLocaleString()}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${wordBarColor}`}
                    style={{ width: `${wordProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Creative direction — collapsible, hidden in Quick Start */}
            {mode === 'full' && <div
              className="bg-surface-container-lowest rounded-3xl shadow-[0_20px_50px_rgba(0,88,190,0.05)] border border-outline-variant/10 overflow-hidden"
              onFocus={() => setActiveSection('creative')}
            >
              <button
                type="button"
                onClick={() => setCreativeOpen((v) => !v)}
                className="w-full flex items-center justify-between px-8 py-5 hover:bg-surface-container-low transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>draw</span>
                  <h2 className="text-xl font-bold tracking-tight">Creative direction</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high rounded-full px-2 py-1">Optional</span>
                </div>
                <span
                  className="material-symbols-outlined text-on-surface-variant text-xl transition-transform duration-200"
                  style={{ transform: creativeOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {creativeOpen && (
              <div className="px-8 pb-8 pt-2 border-t border-outline-variant/10">
              <p className="text-sm text-on-surface-variant mb-5">
                Describe how you want the AI to adapt your story — add a character, shift the genre, introduce a twist.
                The AI acts as a Comic Scriptwriter and rewrites the narrative with visual-rich prose ready for panels.
              </p>

              <textarea
                value={creativeDirection}
                onChange={(e) => setCreativeDirection(e.target.value)}
                placeholder={`e.g. "Add a mysterious rival named Kira who challenges Elena at every turn — cold, calculating, and secretly working for the Inquisition."\n\nor: "Change the tone to cyberpunk. The Inquisition is now a megacorp and the spellbook is forbidden AI code."`}
                className="field !rounded-2xl !p-5 leading-relaxed min-h-[130px] w-full"
              />

              {/* Quick-pick chips */}
              <div className="mt-3">
                <p className="text-xs font-semibold text-on-surface-variant mb-2">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {DIRECTION_CHIPS.map((chip) => (
                    <button key={chip} type="button"
                      onClick={() => setCreativeDirection((prev) => prev ? `${prev}; ${chip.toLowerCase()}` : chip)}
                      className="text-xs font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high rounded-full px-3 py-1.5 transition-colors">
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thinking state */}
              {adaptState === 'thinking' && (
                <div className="mt-5 rounded-2xl bg-surface-container-low border border-outline-variant/20 px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-base animate-spin text-primary">progress_activity</span>
                    <span className="text-sm font-semibold text-on-surface-variant">Thinking…</span>
                  </div>
                  {thinkingText && (
                    <p className="text-xs text-on-surface-variant/70 leading-relaxed line-clamp-4 max-h-24 overflow-hidden">
                      {thinkingText}
                    </p>
                  )}
                </div>
              )}

              {/* Changes summary — collapsible */}
              {adaptState === 'done' && changesSummary.length > 0 && (
                <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setChangesExpanded((v) => !v)}
                    className="w-full flex items-center justify-between"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Changes applied</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 rounded-full px-2 py-0.5">{changesSummary.length}</span>
                      <span
                        className="material-symbols-outlined text-emerald-700 text-sm transition-transform duration-200"
                        style={{ transform: changesExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      >
                        expand_more
                      </span>
                    </div>
                  </button>
                  {changesExpanded && (
                    <ul className="space-y-1.5 mt-3">
                      {changesSummary.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-emerald-800">
                          <span className="material-symbols-outlined text-sm text-emerald-600 mt-px" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {adaptState === 'error' && (
                <div className="mt-5 rounded-2xl bg-red-50 border border-red-100 px-5 py-4 text-xs text-red-700">
                  Adaptation failed. Check your connection and try again.
                </div>
              )}

              <div className="flex justify-end mt-5">
                <button type="button" onClick={runAdaptation}
                  disabled={!storyText.trim() || !creativeDirection.trim() || adaptState === 'thinking'}
                  className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all ${
                    storyText.trim() && creativeDirection.trim() && adaptState !== 'thinking'
                      ? 'bg-primary text-on-primary hover:opacity-90 shadow-md shadow-primary/20'
                      : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                  }`}>
                  <span className={`material-symbols-outlined text-lg ${adaptState === 'thinking' ? 'animate-spin' : ''}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {adaptState === 'thinking' ? 'progress_activity' : 'auto_fix_high'}
                  </span>
                  {adaptState === 'thinking' ? 'Adapting…' : adaptState === 'done' ? 'Re-adapt story' : 'Adapt story'}
                </button>
              </div>
              </div>
              )}
            </div>}

            {/* 4. Advanced Setup — collapsible production targets, hidden in Quick Start */}
            {mode === 'full' &&
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-[0_20px_50px_rgba(0,88,190,0.05)] overflow-hidden">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="w-full flex items-center justify-between px-8 py-5 hover:bg-surface-container-low transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant text-2xl">tune</span>
                  <div>
                    <h2 className="text-base font-bold tracking-tight">Advanced Setup</h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Production targets · {advancedTargetPages} pages · {advancedNumChapters} chapters · {advancedMainChars} chars
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {analysisResult && (() => {
                    const charMismatch = analysisResult.chars.length > parseInt(advancedMainChars, 10);
                    const pagesMismatch = analysisResult.panels > parseInt(advancedTargetPages, 10) * parseInt(advancedMaxPanels, 10) * 0.7;
                    return (charMismatch || pagesMismatch) ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">Mismatch</span>
                    ) : null;
                  })()}
                  <span
                    className="material-symbols-outlined text-on-surface-variant text-xl transition-transform duration-200"
                    style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    expand_more
                  </span>
                </div>
              </button>

              {advancedOpen && (
                <div className="px-8 pb-8 pt-2 space-y-6 border-t border-outline-variant/10">

                  {/* Capacity check warnings */}
                  {analysisResult && (() => {
                    const suggestedChars = analysisResult.chars.length;
                    const charMismatch = suggestedChars > parseInt(advancedMainChars, 10);
                    const estPages = Math.ceil(analysisResult.panels / (parseInt(advancedMaxPanels, 10) * 0.7));
                    const pagesMismatch = estPages > parseInt(advancedTargetPages, 10);
                    if (!charMismatch && !pagesMismatch) return null;
                    return (
                      <div className="space-y-2 mt-2">
                        {charMismatch && (
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                            <div className="flex items-start gap-2 text-sm">
                              <span className="material-symbols-outlined text-amber-500 text-base mt-0.5">warning</span>
                              <span className="text-amber-800">
                                Story has <strong>{suggestedChars}</strong> characters but you configured <strong>{advancedMainChars}</strong>.
                              </span>
                            </div>
                            <button type="button"
                              onClick={() => setAdvancedMainChars(String(suggestedChars))}
                              className="flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl px-3 py-1.5 whitespace-nowrap">
                              Adjust to {suggestedChars} ↓
                            </button>
                          </div>
                        )}
                        {pagesMismatch && (
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                            <div className="flex items-start gap-2 text-sm">
                              <span className="material-symbols-outlined text-amber-500 text-base mt-0.5">warning</span>
                              <span className="text-amber-800">
                                Story may need ~<strong>{estPages}</strong> pages. You configured <strong>{advancedTargetPages}</strong>.
                              </span>
                            </div>
                            <button type="button"
                              onClick={() => setAdvancedTargetPages(String(Math.min(90, estPages)))}
                              className="flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl px-3 py-1.5 whitespace-nowrap">
                              Adjust to {Math.min(90, estPages)} ↓
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Presets */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Quick presets</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Single page', pages: '1',  chapters: '1', chars: '1', panels: '4' },
                        { label: 'Mini comic',  pages: '5',  chapters: '1', chars: '2', panels: '5' },
                        { label: 'Quick read',  pages: '20', chapters: '2', chars: '3', panels: '5' },
                        { label: 'Short comic', pages: '50', chapters: '4', chars: '4', panels: '5' },
                        { label: 'Full book',   pages: '90', chapters: '10', chars: '6', panels: '6' },
                      ].map((p) => (
                        <button key={p.label} type="button"
                          onClick={() => {
                            setAdvancedTargetPages(p.pages);
                            setAdvancedNumChapters(p.chapters);
                            setAdvancedMainChars(p.chars);
                            setAdvancedMaxPanels(p.panels);
                          }}
                          className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-all ${
                            advancedTargetPages === p.pages
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                          }`}>
                          {p.label} ({p.pages}p)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Numeric fields */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {([
                      { id: 'adv-chars',   label: 'Main Characters', min: 1, max: 10,  val: advancedMainChars,   set: setAdvancedMainChars },
                      { id: 'adv-chaps',   label: 'Chapters',        min: 1, max: 20,  val: advancedNumChapters, set: setAdvancedNumChapters },
                      { id: 'adv-pages',   label: 'Target Pages',    min: 1, max: 90,  val: advancedTargetPages, set: setAdvancedTargetPages },
                      { id: 'adv-panels',  label: 'Max Panels/Page', min: 2, max: 8,   val: advancedMaxPanels,   set: setAdvancedMaxPanels },
                    ] as const).map((f) => (
                      <div key={f.id} className="space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant" htmlFor={f.id}>
                          {f.label}
                        </label>
                        <input
                          id={f.id}
                          type="number"
                          min={f.min}
                          max={f.max}
                          value={f.val}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!isNaN(n) && n >= f.min && n <= f.max) f.set(String(n));
                          }}
                          className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-center font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="text-[10px] text-on-surface-variant/60 text-center">{f.min}–{f.max}</p>
                      </div>
                    ))}
                  </div>

                  {/* Estimate */}
                  <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant">
                    Est. panels: <strong className="text-on-surface">
                      ~{Math.round(parseInt(advancedTargetPages, 10) * parseInt(advancedMaxPanels, 10) * 0.7)}
                    </strong> · {advancedTargetPages} pages × {advancedMaxPanels} panels × 70% fill rate
                  </div>
                </div>
              )}
            </div>}


          </section>

          {/* ═══════════ ANALYSIS SIDEBAR ═══════════ */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">

            <div className="bg-surface-container-lowest rounded-3xl p-7 border border-outline-variant/10 shadow-[0_20px_50px_rgba(0,88,190,0.05)] min-h-[420px] flex flex-col">
              <div className="flex items-center gap-2.5 mb-6">
                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <h2 className="text-lg font-bold tracking-tight">AI Story Analysis</h2>
              </div>

              {/* STATE 1 — Empty */}
              {panelState === 'empty' && (
                <div className="flex-grow flex flex-col py-2">
                  <p className="text-sm font-semibold text-on-surface mb-4">
                    {mode === 'quick' ? 'Add a title and narrative to auto-trigger analysis' : 'Complete the essentials to unlock AI Analysis'}
                  </p>
                  <div className="space-y-3 mb-6">
                    {(mode === 'quick'
                      ? [{ label: 'Story Title', done: essentialChecks[0] }, { label: 'Your Narrative', done: essentialChecks[1] }]
                      : [{ label: 'Story Title', done: essentialChecks[0] }, { label: 'Genre & Tone', done: essentialChecks[1] }, { label: 'Your Narrative', done: essentialChecks[2] }]
                    ).map(({ label, done }) => (
                      <div key={label} className="flex items-center gap-2.5 text-sm">
                        <span className={`material-symbols-outlined text-base ${done ? 'text-emerald-500' : 'text-outline'}`} style={{ fontVariationSettings: done ? "'FILL' 1" : "'FILL' 0" }}>
                          {done ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={done ? 'text-on-surface-variant line-through opacity-60' : 'text-on-surface-variant'}>{label}</span>
                      </div>
                    ))}
                  </div>
                  {mode === 'quick' ? (
                    <div className="mt-auto flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-low rounded-2xl px-4 py-3">
                      <span className="material-symbols-outlined text-sm">bolt</span>
                      Analysis will auto-run when ready
                    </div>
                  ) : (
                    <button disabled className="mt-auto w-full px-5 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-surface-container-high text-on-surface-variant cursor-not-allowed">
                      <span className="material-symbols-outlined text-lg">auto_awesome</span>
                      Run AI Analysis
                    </button>
                  )}
                </div>
              )}

              {/* STATE 2 — Filling */}
              {panelState === 'filling' && (
                <div className="flex-grow flex flex-col py-2">
                  <p className="text-sm font-semibold text-on-surface mb-4">Analyzing your story…</p>
                  <div className="space-y-3 mb-5">
                    {genre && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>📖</span>
                        <span className="text-on-surface-variant">Genre detected: <span className="font-semibold text-on-surface">{genre}</span></span>
                      </div>
                    )}
                    {detectedChars.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>👤</span>
                        <span className="text-on-surface-variant">Characters found: <span className="font-semibold text-on-surface">{detectedChars.length}</span></span>
                      </div>
                    )}
                    {genre && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>🎭</span>
                        <span className="text-on-surface-variant">Tone: <span className="font-semibold text-on-surface">
                          {genre.includes('·') ? genre.split('·').slice(1).join('·').trim() : genre.split('/').pop()?.trim() ?? genre}
                        </span></span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 mb-6">
                    {(mode === 'quick'
                      ? [{ label: 'Story Title', done: essentialChecks[0] }, { label: 'Your Narrative', done: essentialChecks[1] }]
                      : [{ label: 'Story Title', done: essentialChecks[0] }, { label: 'Genre & Tone', done: essentialChecks[1] }, { label: 'Your Narrative', done: essentialChecks[2] }]
                    ).map(({ label, done }) => (
                      <div key={label} className="flex items-center gap-2 text-xs">
                        <span className={`material-symbols-outlined text-sm ${done ? 'text-emerald-500' : 'text-outline'}`} style={{ fontVariationSettings: done ? "'FILL' 1" : "'FILL' 0" }}>
                          {done ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={done ? 'text-on-surface-variant line-through' : 'text-on-surface-variant'}>{label}</span>
                      </div>
                    ))}
                  </div>
                  <button disabled className="mt-auto w-full px-5 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-surface-container-high text-on-surface-variant cursor-not-allowed">
                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                    Run AI Analysis
                  </button>
                </div>
              )}

              {/* STATE 3 — Ready */}
              {panelState === 'ready' && (
                <div className="flex-grow flex flex-col items-center justify-center text-center py-6">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <p className="font-semibold text-on-surface mb-2">Ready to analyze</p>
                  {mode === 'quick' ? (
                    <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-6 bg-surface-container-low rounded-2xl px-4 py-3 w-full justify-center">
                      <span className="material-symbols-outlined text-sm animate-pulse text-primary">bolt</span>
                      Starting automatically…
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
                        All essentials complete. Run AI analysis to preview characters, scene beats, and tone.
                      </p>
                      <button type="button" onClick={runAnalysis}
                        className="w-full px-5 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-primary text-on-primary shadow-lg shadow-primary/20 animate-pulse hover:animate-none hover:opacity-90 transition-all">
                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                        ▶ Run AI Analysis
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* STATE 4 — Running */}
              {panelState === 'running' && (
                <div className="flex-grow">
                  <p className="text-on-surface-variant font-medium flex items-center gap-2 mb-6 text-sm">
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    AI is reading your story…
                  </p>
                  {streamingText ? (
                    <div className="text-xs text-on-surface-variant leading-relaxed max-h-52 overflow-hidden line-clamp-[12]">
                      {streamingText}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-2 rounded-full bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20 animate-pulse" />
                      <div className="h-4 rounded-full w-3/4 bg-surface-container-high animate-pulse" />
                      <div className="h-4 rounded-full w-1/2 bg-surface-container-high animate-pulse" />
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        {[1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-2xl bg-surface-container-high animate-pulse" />)}
                      </div>
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => <div key={i} className={`h-3 rounded-full bg-surface-container-high animate-pulse ${i === 1 ? 'w-full' : i === 2 ? 'w-5/6' : 'w-4/6'}`} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STATE 5 — Done */}
              {panelState === 'done' && analysisResult && (
                <div className="flex-grow">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { val: analysisResult.sceneBeats, label: 'Scene beats' },
                      { val: analysisResult.chars.length, label: 'Characters' },
                      { val: `~${analysisResult.panels}`, label: 'Est. panels' },
                    ].map(({ val, label }) => (
                      <div key={label} className="bg-surface-container-low rounded-2xl p-3 text-center">
                        <p className="text-2xl font-extrabold text-on-surface leading-none">{val}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-1">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Characters — split confirmed/uncertain (Fixes 4, 7) */}
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Characters</p>
                  {(() => {
                    const textLower = storyText.toLowerCase();
                    const charsWithConf = analysisResult.chars
                      .filter((name) => charOverrides[name] !== 'removed')
                      .map((name) => {
                        const count = (textLower.match(new RegExp(name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
                        const override = charOverrides[name];
                        const rawConf = count >= 5 ? 'high' : count >= 2 ? 'medium' : 'low';
                        const confidence = override === 'keep' ? 'medium' : rawConf;
                        return { name, confidence, isKept: override === 'keep' };
                      });
                    const confirmed = charsWithConf.filter((c) => c.confidence !== 'low');
                    const uncertain = charsWithConf.filter((c) => c.confidence === 'low');
                    return (
                      <div className="mb-6 space-y-4">
                        {/* Confirmed characters — auto-fit grid */}
                        {confirmed.length > 0 && (
                          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
                            {confirmed.map(({ name, confidence, isKept }) => (
                              <div key={name} className="flex flex-col items-center gap-1.5">
                                <div className={`w-full aspect-square rounded-2xl flex items-center justify-center border ${
                                  confidence === 'high' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
                                }`}>
                                  <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl">person</span>
                                </div>
                                <span className="text-xs font-semibold text-on-surface truncate w-full text-center">{name}</span>
                                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${confidence === 'high' ? 'text-emerald-600' : 'text-amber-500'}`}>
                                  {isKept && <span title="Manually kept">⚠️</span>}
                                  {confidence === 'high' ? 'High' : 'Med'} confidence
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Uncertain characters — full-width cards with Keep/Remove */}
                        {uncertain.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex-1 h-px bg-outline-variant/20" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Please review</span>
                              <div className="flex-1 h-px bg-outline-variant/20" />
                            </div>
                            <div className="space-y-2">
                              {uncertain.map(({ name }) => (
                                <div key={name} className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 px-3 py-2.5">
                                  <span className="material-symbols-outlined text-red-400 text-lg flex-shrink-0">person</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-on-surface truncate">{name}</p>
                                    <p className="text-[10px] text-red-600">Appears rarely — may be a false positive</p>
                                  </div>
                                  <div className="flex gap-1.5 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCharOverrides((p) => ({ ...p, [name]: 'keep' }));
                                        setToast({ message: `${name} kept — add more story detail for better accuracy.` });
                                      }}
                                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                    >
                                      Keep
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCharOverrides((p) => ({ ...p, [name]: 'removed' }))}
                                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Scene beats */}
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left mb-3"
                    onClick={() => setBeatsExpanded((v) => !v)}
                  >
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Scene beats</p>
                    <span
                      className="material-symbols-outlined text-sm text-on-surface-variant transition-transform duration-200"
                      style={{ transform: beatsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      expand_more
                    </span>
                  </button>
                  <div className="space-y-2 mb-6">
                    {(['Opening', 'Rising', 'Climax'] as const).map((act, i) => {
                      const act1 = Math.max(1, Math.round(analysisResult.sceneBeats * 0.2));
                      const act2 = Math.max(2, Math.round(analysisResult.sceneBeats * 0.5));
                      const act3 = Math.max(1, analysisResult.sceneBeats - act1 - act2);
                      const actCounts = [act1, act2, act3];
                      const beatCount = actCounts[i];

                      const paragraphs = storyText.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 20);
                      const totalParas = Math.max(1, paragraphs.length);
                      const actRanges = [[0, 0.25], [0.25, 0.75], [0.75, 1.0]] as [[number,number],[number,number],[number,number]];
                      const [startFrac, endFrac] = actRanges[i];
                      const actParas = paragraphs.slice(
                        Math.floor(startFrac * totalParas),
                        Math.ceil(endFrac * totalParas),
                      );

                      const beatDescs: string[] = [];
                      for (let b = 0; b < beatCount; b++) {
                        if (actParas.length === 0) { beatDescs.push(`Beat ${b + 1}`); continue; }
                        const idx = beatCount === 1 ? 0 : Math.round(b * (actParas.length - 1) / Math.max(1, beatCount - 1));
                        const para = actParas[Math.min(idx, actParas.length - 1)];
                        const first = para.split(/[.!?]/)[0].trim();
                        beatDescs.push(first);
                      }

                      return (
                        <div key={act}>
                          <div className="flex items-center justify-between text-xs bg-surface-container-low rounded-xl px-3 py-2">
                            <span className="text-on-surface-variant">Act {i + 1} · {act}</span>
                            <span className="font-bold text-on-surface">{beatCount} beats</span>
                          </div>
                          {beatsExpanded && (
                            <ul className="mt-1 ml-1 space-y-0.5 pl-2 border-l-2 border-outline-variant/20">
                              {beatDescs.map((desc, j) => {
                                const beatKey = `${act}-${j}`;
                                const isExpanded = expandedBeats.has(beatKey);
                                if (!isValidBeat(desc)) {
                                  return (
                                    <li key={j} className="flex items-start gap-2 py-1 text-[11px]">
                                      <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-surface-container-high flex items-center justify-center text-[9px] font-bold">{j + 1}</span>
                                      <span className="italic text-on-surface-variant/50">[Beat could not be extracted · Add more story content]</span>
                                    </li>
                                  );
                                }
                                const displayText = isExpanded ? desc : truncateBeat(desc);
                                const isTruncated = desc.length > 60;
                                return (
                                  <li key={j}>
                                    <button
                                      type="button"
                                      className="flex items-start gap-2 py-1 text-[11px] text-on-surface-variant w-full text-left hover:text-on-surface transition-colors"
                                      onClick={() => setExpandedBeats((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(beatKey)) next.delete(beatKey); else next.add(beatKey);
                                        return next;
                                      })}
                                      title={isTruncated && !isExpanded ? desc : undefined}
                                    >
                                      <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-surface-container-high flex items-center justify-center text-[9px] font-bold">{j + 1}</span>
                                      <span>
                                        {displayText}
                                        {isTruncated && (
                                          <span className="ml-1 text-primary font-semibold text-[9px]">
                                            {isExpanded ? '▲' : '▼'}
                                          </span>
                                        )}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tone */}
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Tone tags</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {analysisResult.tone.map((t) => (
                      <span key={t} className="text-xs font-semibold text-primary bg-surface-container-high rounded-full px-3 py-1">{t}</span>
                    ))}
                  </div>
                  {!genre && (
                    <p className="text-[10px] text-on-surface-variant/60 mb-4 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">info</span>
                      Auto-detected from story content · Set a genre for more accurate visual direction
                    </p>
                  )}
                  {genre && <div className="mb-4" />}

                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Analysis complete. Story looks well-structured for your comic.
                    </p>
                  </div>

                  <button type="button" onClick={runAnalysis}
                    className="mt-5 w-full px-5 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-all">
                    <span className="material-symbols-outlined text-lg">refresh</span>
                    Re-run analysis
                  </button>
                </div>
              )}
            </div>

            {/* Contextual pro tip */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20 relative overflow-hidden">
              <div className="absolute right-[-20%] top-[-30%] w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <div className="flex items-start gap-4 relative">
                <span className="material-symbols-outlined text-3xl">lightbulb</span>
                <div>
                  <h4 className="font-bold mb-1">Pro tip</h4>
                  <p className="text-sm opacity-90 leading-relaxed">
                    {activeSection === 'foundation' && !genre
                      ? 'Setting a genre helps the AI choose the right visual palette and art style for your comic.'
                      : PRO_TIPS[activeSection].tip}
                  </p>
                </div>
              </div>
            </div>

          </aside>
        </div>
      </main>

      {/* ── Toast notification ── */}
      {toast && (
        <div className="fixed bottom-24 right-6 z-[100] flex items-center gap-3 bg-surface-container-highest text-on-surface rounded-2xl shadow-xl px-4 py-3 border border-outline-variant/20 animate-in slide-in-from-bottom-4 duration-300">
          <span className="material-symbols-outlined text-emerald-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <span className="text-sm font-medium">{toast.message}</span>
          {toast.action && (
            <Link href={toast.action.href} className="text-xs font-bold text-primary hover:underline">
              {toast.action.label}
            </Link>
          )}
          <button type="button" onClick={() => setToast(null)} className="ml-1 text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ── Load story modal ── */}
      {loadModalOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) { setLoadModalOpen(false); setLoadConfirm(null); } }}>
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20">
              <h2 className="text-lg font-bold">Load a saved story</h2>
              <button type="button" onClick={() => { setLoadModalOpen(false); setLoadConfirm(null); }} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {loadConfirm ? (
              <div className="p-6 flex flex-col gap-4">
                <p className="text-sm text-on-surface-variant">Load <span className="font-bold text-on-surface">&ldquo;{loadConfirm.title}&rdquo;</span>? Any unsaved changes will be lost.</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => handleLoadStory(loadConfirm)}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-primary text-on-primary hover:opacity-90">
                    Load story
                  </button>
                  <button type="button" onClick={() => setLoadConfirm(null)}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest">
                    Cancel
                  </button>
                </div>
              </div>
            ) : savedStories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/40">auto_stories</span>
                <p className="text-on-surface-variant font-medium">No saved stories yet</p>
                <p className="text-sm text-on-surface-variant/70">Save a story using the &ldquo;More&rdquo; menu above.</p>
              </div>
            ) : (
              <div className="overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {savedStories.map((story) => (
                  <div key={story.id} className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/10">
                    <p className="font-bold text-on-surface text-sm truncate">{story.title || 'Untitled'}</p>
                    {story.genre && <p className="text-xs text-on-surface-variant mt-0.5 truncate">{story.genre}</p>}
                    <p className="text-xs text-on-surface-variant/70 mt-1">
                      {new Date(story.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <button type="button" onClick={() => setLoadConfirm(story)}
                      className="mt-3 w-full px-3 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:opacity-90">
                      Load this story
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sticky bottom bar ── */}
      <div
        className="fixed bottom-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-t border-outline-variant/30 px-8 py-4"
        style={{ left: 'var(--studio-sidebar-width, 16rem)' }}
      >
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            {canProceed ? (
              <div className="flex items-center gap-2 text-emerald-700">
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="font-semibold">Story ready to go!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-base text-amber-500">warning</span>
                <span>
                  <span className="font-bold">{essentials}/{essentialsTotal}</span> essentials · Missing: {missingEssentials}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={canProceed ? handleNext : undefined}
            disabled={!canProceed}
            title={!canProceed ? `Complete to continue: ${missingEssentials}` : undefined}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
              canProceed
                ? 'bg-primary text-on-primary hover:opacity-90 shadow-lg shadow-primary/20'
                : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
            }`}
          >
            Continue to Pipeline
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </div>
      </div>

    </div>
  );
}
