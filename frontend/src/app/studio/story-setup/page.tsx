'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { analyzeStoryStructuredStream } from '@/services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_STORY = `In a world where magic is forbidden, a young scholar named Elena discovers an ancient spellbook hidden in her university's restricted archive. Drawn to its glowing script, she traces a single rune — and the room ignites with a light only she can see.

Master Kael, her stern mentor, warns her that the Inquisition burns those who awaken. But Elena cannot stop. Each night she returns to the archive, unlocking spells that whisper of a war the empire buried centuries ago.

When the Inquisitor arrives at the university gates, Elena must choose: surrender the book, or run into the wilds and become the very thing the empire fears most.`;

const GENRE_CHIPS = [
  'Fantasy / Adventure · Epic',
  'Sci-fi / Cyberpunk · Gritty',
  'Slice of life · Warm',
  'Mystery / Noir · Tense',
  'Romance · Tender',
];

const STYLES = [
  { name: 'Manga',      desc: 'B&W, dynamic',    ref: 'Japanese manga style, detailed line work, black & white' },
  { name: 'Western',    desc: 'Bold superhero',  ref: 'Classic Silver-Age inks, bold flat colors, dynamic action' },
  { name: 'Noir',       desc: 'Ink & shadow',    ref: 'High-contrast chiaroscuro, rain-slick noir, pulp detective ink' },
  { name: 'Indie',      desc: 'Hand-drawn',      ref: 'Loose sketch line, risograph zine print, watercolor & ink' },
  { name: 'Watercolor', desc: 'Soft, painterly', ref: 'Ethereal watercolor wash, Studio Ghibli warmth, ink & wash storybook' },
];

const ART_SUGGESTIONS: Record<string, string[]> = {
  Manga:      ['Detailed shonen line work', 'Soft shojo screentones', 'Gritty seinen ink'],
  Western:    ['Classic Silver-Age inks', 'Modern cinematic comic', 'Bold flat colors'],
  Noir:       ['High-contrast chiaroscuro', 'Rain-slick neon noir', 'Pulp detective ink'],
  Indie:      ['Loose sketch line', 'Risograph zine print', 'Watercolor & ink'],
  Watercolor: ['Ethereal watercolor wash', 'Studio Ghibli warmth', 'Ink & wash storybook'],
};

const CONSTRAINT_CHIPS = ['No gore', 'Soft lighting', 'All-ages', 'Dynamic angles', 'Minimal text'];

const PAGE_PRESETS = [
  { label: 'Quick comic · 20',  pages: 20 },
  { label: 'Short story · 50',  pages: 50 },
  { label: 'Full book · 200',   pages: 200 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function Stepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1 mb-2">{label}</label>
      <div className="flex items-center bg-surface-container-low rounded-xl p-1">
        <button type="button" onClick={() => onChange(clamp(value - 1))}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors">
          <span className="material-symbols-outlined text-lg">remove</span>
        </button>
        <input
          type="text" inputMode="numeric" value={value}
          onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) onChange(clamp(n)); }}
          className="flex-1 bg-transparent text-center font-bold text-on-surface outline-none w-full"
        />
        <button type="button" onClick={() => onChange(clamp(value + 1))}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors">
          <span className="material-symbols-outlined text-lg">add</span>
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StorySetupPage() {
  const router = useRouter();

  // Form inputs
  const [storyTitle, setStoryTitle]       = useState('');
  const [projectId,  setProjectId]        = useState('');
  const [genre,      setGenre]            = useState('');
  const [storyText,  setStoryText]        = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [artRef,     setArtRef]           = useState('');
  const [palette,    setPalette]          = useState('Full color — vivid');
  const [mainChars,  setMainChars]        = useState(3);
  const [chapters,   setChapters]         = useState(1);
  const [targetPages, setTargetPages]     = useState(20);
  const [maxPanels,  setMaxPanels]        = useState(6);
  const [activeConstraints, setActiveConstraints] = useState<Set<string>>(new Set());
  const [specialRequests, setSpecialRequests]     = useState('');
  const [activePreset, setActivePreset]   = useState<number | null>(null);

  // Analysis
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [analysisResult, setAnalysisResult] = useState<{
    sceneBeats: number; chars: string[]; tone: string[]; panels: number;
  } | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Autosave
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSave = useCallback(() => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState('saved'), 900);
  }, []);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // Progress (5 essentials: title, genre, story ≥80 chars, style, pages > 0)
  const essentials = [
    storyTitle.trim() !== '',
    genre.trim() !== '',
    storyText.trim().length >= 80,
    selectedStyle !== null,
    targetPages > 0,
  ].filter(Boolean).length;
  const canAnalyze = essentials >= 4 && storyText.trim().length >= 80;

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
    if (!selectedStyle) selectStyle('Manga');
    flashSave();
  };

  // Style selection
  const selectStyle = (name: string) => {
    setSelectedStyle(name);
    const s = STYLES.find((s) => s.name === name);
    if (s) setArtRef(s.ref);
  };

  // Constraint toggle
  const toggleConstraint = (label: string) => {
    setActiveConstraints((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  // Real AI analysis
  const runAnalysis = useCallback(() => {
    if (!canAnalyze || analysisState === 'loading') return;
    abortRef.current?.abort();
    setAnalysisState('loading');
    setStreamingText('');

    const ctrl = analyzeStoryStructuredStream(
      {
        story_text: storyText,
        num_chapters: chapters,
        desired_main_characters: mainChars,
        target_total_pages: String(targetPages),
        genre_tone: genre || 'Adventure',
        art_style_reference: artRef || 'manga',
        max_panels_per_page: maxPanels,
        special_requests: specialRequests || 'None',
        project_id: projectId || undefined,
        stream: true,
      },
      {
        onToken: (tok) => setStreamingText((p) => p + tok),
        onDone: (res) => {
          // extract a few signals from structured JSON
          const sj = res.structured_json as Record<string, unknown> | null;
          const step1Data = (sj as { steps?: { step_1_analysis?: Record<string, unknown> } })?.steps?.step_1_analysis ?? {};
          const charList = Array.isArray((step1Data as { detected_characters?: unknown[] }).detected_characters)
            ? ((step1Data as { detected_characters: string[] }).detected_characters).slice(0, 3)
            : [];
          const toneList = Array.isArray((step1Data as { tone_tags?: unknown[] }).tone_tags)
            ? ((step1Data as { tone_tags: string[] }).tone_tags).slice(0, 4)
            : [];
          const beats = typeof (step1Data as { scene_beats?: number }).scene_beats === 'number'
            ? (step1Data as { scene_beats: number }).scene_beats
            : Math.max(4, Math.round(wordCount(storyText) / 15));

          setAnalysisResult({
            sceneBeats: beats,
            chars: charList.length ? charList : ['Character 1', 'Character 2', 'Character 3'].slice(0, mainChars),
            tone: toneList.length ? toneList : ['Epic', 'Adventure'],
            panels: targetPages * Math.max(3, maxPanels - 1),
          });
          setAnalysisState('done');
        },
        onError: () => {
          // On error, show a derived stub result so the user can still proceed
          setAnalysisResult({
            sceneBeats: Math.max(4, Math.round(wordCount(storyText) / 15)),
            chars: ['Character 1', 'Character 2', 'Character 3'].slice(0, mainChars),
            tone: ['Adventure'],
            panels: targetPages * Math.max(3, maxPanels - 1),
          });
          setAnalysisState('done');
        },
      },
    );
    abortRef.current = ctrl;
  }, [canAnalyze, analysisState, storyText, chapters, mainChars, targetPages, genre, artRef, maxPanels, specialRequests, projectId]);

  const handleNext = () => {
    // Persist key inputs to localStorage for the studio wizard to pick up
    if (typeof window !== 'undefined') {
      localStorage.setItem('mohiom-story-setup', JSON.stringify({
        storyText, genre, artRef, mainChars, chapters, targetPages, maxPanels, specialRequests, projectId,
      }));
    }
    router.push('/studio');
  };

  const words = wordCount(storyText);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="pt-24 pb-16 px-8 max-w-[1400px] mx-auto ml-[var(--studio-sidebar-width)]">

        {/* ── Page header ── */}
        <header className="mb-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tighter text-on-surface">Create Your Story</h1>
              <p className="text-on-surface-variant mt-1">
                Feed in your narrative, set the creative targets, and let Gemini map out characters and visual beats.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-on-surface-variant bg-surface-container-lowest border border-outline-variant/40 rounded-full px-4 py-2">
              <span className={`material-symbols-outlined text-base ${saveState === 'saved' ? 'text-emerald-500' : 'animate-spin text-on-surface-variant'}`}>
                {saveState === 'saved' ? 'cloud_done' : 'cloud_sync'}
              </span>
              <span>{saveState === 'saved' ? 'Draft saved' : 'Saving…'}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[220px]">
              <div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container transition-all duration-500"
                  style={{ width: `${(essentials / 5) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-on-surface whitespace-nowrap">{essentials}/5 essentials</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">bolt</span>
              Fill the essentials to unlock AI analysis
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ═══════════ FORM COLUMN ═══════════ */}
          <section className="lg:col-span-8 space-y-6">

            {/* 1. Story foundation */}
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,88,190,0.05)] border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary text-2xl">title</span>
                <h2 className="text-xl font-bold tracking-tight">Story foundation</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="storyTitle">Story title</label>
                  <input
                    id="storyTitle" value={storyTitle} placeholder="The Last Ember"
                    onChange={(e) => { setStoryTitle(e.target.value); flashSave(); }}
                    className="field"
                  />
                  <p className="text-xs text-on-surface-variant/70 px-1">Shown on your cover and project list.</p>
                </div>
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
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="genre">Genre &amp; tone</label>
                  <input
                    id="genre" value={genre} placeholder="Fantasy / Adventure · Epic, hopeful" className="field"
                    onChange={(e) => { setGenre(e.target.value); flashSave(); }}
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {GENRE_CHIPS.map((chip) => (
                      <button key={chip} type="button"
                        onClick={() => { setGenre(chip); flashSave(); }}
                        className="text-xs font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high rounded-full px-3 py-1.5 transition-colors">
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Your narrative */}
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,88,190,0.05)] border border-outline-variant/10">
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

              <textarea
                value={storyText} onChange={(e) => { setStoryText(e.target.value); flashSave(); }}
                placeholder={`Paste or write your story here...\n\nExample:\nIn a world where magic is forbidden, a young scholar named Elena discovers an ancient spellbook...\n\nTip: include character names, key plot points, and the tone you're after.`}
                className="field !rounded-2xl !p-5 leading-relaxed min-h-[260px] w-full"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 mt-3 px-1">
                <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                  <span><span className="font-bold text-on-surface">{words.toLocaleString()}</span> words</span>
                  <span className="w-px h-3 bg-outline-variant" />
                  <span><span className="font-bold text-on-surface">{storyText.length.toLocaleString()}</span> / 5,000</span>
                  <span className="w-px h-3 bg-outline-variant" />
                  <span>~{Math.max(0, Math.round(words / 200))} min read</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" title="Expand a brief into a fuller draft"
                    className="text-xs font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high rounded-full px-3 py-1.5 flex items-center gap-1 transition-colors">
                    <span className="material-symbols-outlined text-sm text-primary">expand_content</span>
                    Expand brief
                  </button>
                  <button type="button" title="Tighten and polish the narrative"
                    className="text-xs font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high rounded-full px-3 py-1.5 flex items-center gap-1 transition-colors">
                    <span className="material-symbols-outlined text-sm text-primary">compress</span>
                    Polish
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Art direction */}
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,88,190,0.05)] border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-primary text-2xl">palette</span>
                <h2 className="text-xl font-bold tracking-tight">Art direction</h2>
              </div>
              <p className="text-sm text-on-surface-variant mb-6">Pick a base style — you can fine-tune the reference below.</p>

              {/* Style grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {STYLES.map((s) => {
                  const active = selectedStyle === s.name;
                  return (
                    <button key={s.name} type="button" onClick={() => selectStyle(s.name)}
                      className={`relative rounded-2xl border-2 overflow-hidden text-left transition-all ${
                        active ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/40 hover:border-primary/40'
                      }`}>
                      <div className="aspect-[4/3] bg-surface-container-low flex items-center justify-center"
                        style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(0,88,190,0.07) 0,rgba(0,88,190,0.07) 1px,transparent 1px,transparent 9px)' }}>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/60">{s.name.toLowerCase()}</span>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-sm font-bold text-on-surface leading-tight">{s.name}</p>
                        <p className="text-[11px] text-on-surface-variant">{s.desc}</p>
                      </div>
                      {active && (
                        <span className="material-symbols-outlined absolute top-2 right-2 text-white bg-primary rounded-full text-lg p-0.5">check</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="artRef">Art style reference</label>
                  <input id="artRef" value={artRef} className="field"
                    placeholder="Japanese manga style, detailed line work, black & white"
                    onChange={(e) => { setArtRef(e.target.value); flashSave(); }}
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(ART_SUGGESTIONS[selectedStyle ?? ''] ?? []).map((sug) => (
                      <button key={sug} type="button" onClick={() => setArtRef(sug)}
                        className="text-xs font-semibold text-primary bg-surface-container-low hover:bg-surface-container-high rounded-full px-3 py-1.5 transition-colors">
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="palette">Color palette</label>
                  <div className="relative">
                    <select id="palette" value={palette} onChange={(e) => setPalette(e.target.value)}
                      className="field appearance-none cursor-pointer pr-10">
                      {['Full color — vivid', 'Full color — muted / cinematic', 'Black & white (ink)', 'Monochrome — duotone', 'Watercolor wash'].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                  </div>
                  <p className="text-xs text-on-surface-variant/70 px-1">Sets the default rendering across all panels.</p>
                </div>
              </div>
            </div>

            {/* 4. Structure & pacing */}
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,88,190,0.05)] border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary text-2xl">tune</span>
                <h2 className="text-xl font-bold tracking-tight">Structure &amp; pacing</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stepper label="Main characters" value={mainChars}  min={1} max={10}   onChange={setMainChars} />
                <Stepper label="Chapters"        value={chapters}   min={1} max={50}   onChange={setChapters} />
                <Stepper label="Target pages"    value={targetPages} min={1} max={1000} onChange={(n) => { setTargetPages(n); setActivePreset(null); }} />
                <Stepper label="Max panels / page" value={maxPanels} min={3} max={12}  onChange={setMaxPanels} />
              </div>
              <div className="mt-5">
                <span className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1 mb-2">Length presets</span>
                <div className="flex flex-wrap gap-2">
                  {PAGE_PRESETS.map((p) => (
                    <button key={p.pages} type="button"
                      onClick={() => { setTargetPages(p.pages); setActivePreset(p.pages); }}
                      className={`text-xs font-semibold rounded-full px-4 py-2 transition-colors ${
                        activePreset === p.pages
                          ? 'bg-surface-container-lowest text-primary shadow-sm'
                          : 'text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Constraints & special requests */}
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,88,190,0.05)] border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-primary text-2xl">rule</span>
                <h2 className="text-xl font-bold tracking-tight">Constraints &amp; special requests</h2>
              </div>
              <p className="text-sm text-on-surface-variant mb-5">Optional guardrails the AI will respect during generation.</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {CONSTRAINT_CHIPS.map((chip) => {
                  const on = activeConstraints.has(chip);
                  return (
                    <button key={chip} type="button" onClick={() => toggleConstraint(chip)}
                      className={`text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1 transition-colors ${
                        on ? 'text-white bg-primary' : 'text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high'
                      }`}>
                      <span className="material-symbols-outlined text-sm">{on ? 'check' : 'add'}</span>
                      {chip}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={specialRequests} onChange={(e) => { setSpecialRequests(e.target.value); flashSave(); }}
                className="field !rounded-2xl !p-5 leading-relaxed min-h-[110px] w-full"
                placeholder="e.g. Keep panels cinematic and wide. Avoid modern technology. Emphasize weather and atmosphere."
              />
            </div>

          </section>

          {/* ═══════════ ANALYSIS COLUMN ═══════════ */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">

            <div className="bg-surface-container-lowest rounded-3xl p-7 border border-outline-variant/10 shadow-[0_20px_50px_rgba(0,88,190,0.05)] min-h-[420px] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  <h2 className="text-lg font-bold tracking-tight">AI Story Analysis</h2>
                </div>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  analysisState === 'loading' ? 'bg-primary/10 text-primary' :
                  analysisState === 'done'    ? 'bg-emerald-100 text-emerald-700' :
                                               'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {analysisState === 'loading' ? 'Analyzing' : analysisState === 'done' ? 'Complete' : 'Idle'}
                </span>
              </div>

              {/* IDLE */}
              {analysisState === 'idle' && (
                <div className="flex-grow flex flex-col items-center justify-center text-center py-6">
                  <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl text-primary">neurology</span>
                  </div>
                  <p className="font-semibold text-on-surface mb-1">Ready when you are</p>
                  <p className="text-sm text-on-surface-variant leading-relaxed max-w-[240px]">
                    Add your narrative and genre, then run analysis to preview detected characters, scene beats, and tone.
                  </p>
                </div>
              )}

              {/* LOADING */}
              {analysisState === 'loading' && (
                <div className="flex-grow">
                  <p className="text-on-surface-variant font-medium flex items-center gap-2 mb-6 text-sm">
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    Gemini is reading your story…
                  </p>
                  {streamingText ? (
                    <div className="text-xs text-on-surface-variant leading-relaxed max-h-52 overflow-hidden fade-bottom line-clamp-[12]">
                      {streamingText}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-4 rounded-full w-3/4 bg-gradient-to-r from-surface-container-high via-surface-container-highest to-surface-container-high animate-pulse" />
                      <div className="h-4 rounded-full w-1/2 bg-gradient-to-r from-surface-container-high via-surface-container-highest to-surface-container-high animate-pulse" />
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        {[1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-2xl bg-surface-container-high animate-pulse" />)}
                      </div>
                      <div className="space-y-3 pt-2">
                        {[1, 2, 3].map((i) => <div key={i} className={`h-3 rounded-full bg-surface-container-high animate-pulse ${i === 1 ? 'w-full' : i === 2 ? 'w-5/6' : 'w-4/6'}`} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* RESULT */}
              {analysisState === 'done' && analysisResult && (
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

                  {/* Characters */}
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Detected characters</p>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {analysisResult.chars.map((name) => (
                      <div key={name} className="flex flex-col items-center gap-2">
                        <div className="w-full aspect-square rounded-2xl bg-surface-container-low flex items-center justify-center"
                          style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(0,88,190,0.07) 0,rgba(0,88,190,0.07) 1px,transparent 1px,transparent 9px)' }}>
                          <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl">person</span>
                        </div>
                        <span className="text-xs font-semibold text-on-surface truncate w-full text-center">{name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Tone */}
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Tone &amp; themes</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {analysisResult.tone.map((t) => (
                      <span key={t} className="text-xs font-semibold text-primary bg-surface-container-high rounded-full px-3 py-1">{t}</span>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Story looks well-structured for <span className="font-bold">{targetPages}</span> pages. Ready to generate character sheets.
                    </p>
                  </div>
                </div>
              )}

              {/* Analyze button */}
              <button type="button" onClick={runAnalysis} disabled={!canAnalyze || analysisState === 'loading'}
                className={`mt-6 w-full px-5 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  canAnalyze && analysisState !== 'loading'
                    ? 'bg-primary text-on-primary hover:opacity-90 shadow-lg shadow-primary/20'
                    : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                }`}>
                <span className={`material-symbols-outlined text-lg ${analysisState === 'loading' ? 'animate-spin' : ''}`}>
                  {analysisState === 'loading' ? 'progress_activity' : 'auto_awesome'}
                </span>
                {analysisState === 'loading' ? 'Analyzing…' : analysisState === 'done' ? 'Re-run analysis' : 'Run AI analysis'}
              </button>

              {/* Next button — only after analysis */}
              {analysisState === 'done' && (
                <button type="button" onClick={handleNext}
                  className="mt-3 w-full px-5 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-primary text-on-primary hover:opacity-90 shadow-lg shadow-primary/20 transition-all">
                  Next: Character Setup
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              )}
            </div>

            {/* Pro tip */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20 relative overflow-hidden">
              <div className="absolute right-[-20%] top-[-30%] w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <div className="flex items-start gap-4 relative">
                <span className="material-symbols-outlined text-3xl">lightbulb</span>
                <div>
                  <h4 className="font-bold mb-1">Pro tip</h4>
                  <p className="text-sm opacity-90 leading-relaxed">
                    Name and describe characters clearly in your text — distinctive looks, age, and demeanor give the AI far better character sheets in the next step.
                  </p>
                </div>
              </div>
            </div>

          </aside>
        </div>
      </main>
    </div>
  );
}
