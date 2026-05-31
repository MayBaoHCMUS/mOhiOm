'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { projectsApi } from '@/services/api';
import type { CharacterSummary, CloudProjectListItem } from '@/services/api';

// ─── Static data ──────────────────────────────────────────────────────────────

const STYLES = [
  'Photorealistic', 'Digital Art', 'Anime', '3D Render', 'Pixar',
  'Fantasy Art', 'RPG', 'Comic Book', 'Clay', 'Vector Art',
  'Minimalist', 'Watercolor', 'Oil Painting', 'GTA Style',
];

const VIBES    = ['Cool & Calm', 'Mysterious', 'Cheerful', 'Tough', 'Elegant', 'Playful', 'Dark', 'Heroic', 'Kawaii', 'Fierce'];
const GENDERS  = ['Male', 'Female', 'Non-binary', 'Androgynous'];
const ETHNS    = ['East Asian', 'South Asian', 'SE Asian', 'Black', 'Latino', 'Middle Eastern', 'Caucasian', 'Mixed'];
const AGES     = ['Child', 'Teen', 'Young Adult', 'Adult', 'Middle-aged', 'Elder'];
const BUILDS   = ['Slim', 'Athletic', 'Average', 'Stocky', 'Muscular', 'Petite'];

type Method = 'image' | 'describe' | 'build';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callImageProxy(apiUrl: string, prompt: string): Promise<string> {
  const res = await fetch('/api/image-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: apiUrl, prompt, negative_prompt: 'lowres, bad anatomy, deformed' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Image API error (${res.status})`);
  }
  const data = await res.json() as { image_base64?: string; message?: string };
  if (!data.image_base64) throw new Error(data.message ?? 'No image returned');
  return data.image_base64.startsWith('data:')
    ? data.image_base64
    : `data:image/png;base64,${data.image_base64}`;
}

// ─── Chip selector ────────────────────────────────────────────────────────────

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o} type="button"
          onClick={() => onChange(value === o ? '' : o)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            value === o
              ? 'bg-primary text-on-primary border-primary'
              : 'border-outline-variant/40 text-on-surface-variant hover:border-primary/50 hover:bg-primary/5'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── Preview pane ─────────────────────────────────────────────────────────────

function PreviewPane({ imageUrl, name, generating }: { imageUrl: string | null; name: string; generating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px] bg-surface-container rounded-2xl overflow-hidden relative">
      {generating ? (
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-on-surface-variant font-medium">Generating…</p>
        </div>
      ) : imageUrl ? (
        <>
          <img src={imageUrl} alt={name || 'Character preview'} className="w-full h-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <p className="text-white font-bold text-sm truncate">{name || 'Unnamed character'}</p>
            <p className="text-white/60 text-xs mt-0.5">Preview — save to confirm</p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-outline-variant">person</span>
          <p className="text-sm text-on-surface-variant">Character preview will appear here</p>
        </div>
      )}
    </div>
  );
}

// ─── Method: from image ───────────────────────────────────────────────────────

function FromImagePanel({ onImageReady }: { onImageReady: (url: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = await readFileAsDataUrl(file);
    onImageReady(url);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) await handle(f); }}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-16 ${
        dragging ? 'border-primary bg-primary/5' : 'border-outline-variant/40 hover:border-primary/40 hover:bg-surface-container-low'
      }`}
    >
      <span className="material-symbols-outlined text-5xl text-outline-variant">add_photo_alternate</span>
      <div className="text-center">
        <p className="font-semibold text-on-surface">Drop an image here</p>
        <p className="text-sm text-on-surface-variant mt-1">or click to browse — PNG, JPG, WEBP</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handle(f); }} />
    </div>
  );
}

// ─── Method: describe ─────────────────────────────────────────────────────────

interface DescribePanelProps {
  style: string; onStyleChange: (v: string) => void;
  description: string; onDescriptionChange: (v: string) => void;
}

function DescribePanel({ style, onStyleChange, description, onDescriptionChange }: DescribePanelProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">Description</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={4}
          className="field mt-1.5"
          placeholder="Young woman, sharp detective features, dark bob haircut, cyberpunk noir style…"
        />
      </div>
      <div>
        <label className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">Art Style</label>
        <div className="mt-2">
          <Chips options={STYLES} value={style} onChange={onStyleChange} />
        </div>
      </div>
    </div>
  );
}

// ─── Method: build ────────────────────────────────────────────────────────────

interface BuildPanelProps {
  vibe: string; onVibe: (v: string) => void;
  gender: string; onGender: (v: string) => void;
  ethnicity: string; onEthnicity: (v: string) => void;
  age: string; onAge: (v: string) => void;
  build: string; onBuild: (v: string) => void;
  extra: string; onExtra: (v: string) => void;
}

function BuildPanel({ vibe, onVibe, gender, onGender, ethnicity, onEthnicity, age, onAge, build, onBuild, extra, onExtra }: BuildPanelProps) {
  return (
    <div className="space-y-4">
      {[
        { label: 'Look Vibe', opts: VIBES,   val: vibe,      set: onVibe },
        { label: 'Gender',    opts: GENDERS, val: gender,    set: onGender },
        { label: 'Ethnicity', opts: ETHNS,   val: ethnicity, set: onEthnicity },
        { label: 'Age Range', opts: AGES,    val: age,       set: onAge },
        { label: 'Build',     opts: BUILDS,  val: build,     set: onBuild },
      ].map(({ label, opts, val, set }) => (
        <div key={label}>
          <label className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">{label}</label>
          <div className="mt-1.5"><Chips options={opts} value={val} onChange={set} /></div>
        </div>
      ))}
      <div>
        <label className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">Additional Description <span className="text-outline normal-case font-normal">(optional)</span></label>
        <textarea
          value={extra}
          onChange={(e) => onExtra(e.target.value)}
          rows={2}
          className="field mt-1.5"
          placeholder="Scars on left cheek, always wears sunglasses…"
        />
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export interface CreateCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (char: CharacterSummary) => void;
  projects?: CloudProjectListItem[];
  defaultProjectId?: string;
}

export default function CreateCharacterModal({ isOpen, onClose, onCreated, projects = [], defaultProjectId }: CreateCharacterModalProps) {
  const [method, setMethod] = useState<Method>('describe');
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.project_id ?? '');
  const [apiUrl, setApiUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Describe state
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('');

  // Build state
  const [vibe, setVibe]           = useState('');
  const [gender, setGender]       = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [age, setAge]             = useState('');
  const [buildType, setBuildType] = useState('');
  const [extra, setExtra]         = useState('');

  // Sync projectId when prop changes
  useEffect(() => {
    setProjectId(defaultProjectId ?? projects[0]?.project_id ?? '');
  }, [defaultProjectId, projects]);

  // Read API URL from sessionStorage
  useEffect(() => {
    if (!isOpen) return;
    const stored = window.sessionStorage.getItem('mohiom-image-api-url');
    if (stored) setApiUrl(stored);
  }, [isOpen]);

  // Reset on close
  const reset = useCallback(() => {
    setMethod('describe'); setName(''); setPreviewUrl(null);
    setGenerating(false); setSaving(false); setError(null);
    setDescription(''); setStyle('');
    setVibe(''); setGender(''); setEthnicity(''); setAge(''); setBuildType(''); setExtra('');
  }, []);

  const handleClose = () => { reset(); onClose(); };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build assembled prompt for Build mode
  const assemblePrompt = (): string => {
    const parts = [
      vibe && `${vibe.toLowerCase()} personality`,
      gender && gender.toLowerCase(),
      ethnicity && `${ethnicity} descent`,
      age && `${age.toLowerCase()}`,
      buildType && `${buildType.toLowerCase()} build`,
      style && `${style} style`,
      extra,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const effectivePrompt = method === 'describe'
    ? [description, style && `${style} style`].filter(Boolean).join(', ')
    : method === 'build'
      ? assemblePrompt()
      : '';

  const canGenerate = method !== 'image' && !!effectivePrompt.trim() && !!apiUrl.trim();

  const handleGenerate = async () => {
    if (!canGenerate) { setError('Fill in a description and Image API URL first.'); return; }
    setError(null); setGenerating(true);
    try { setPreviewUrl(await callImageProxy(apiUrl.trim(), effectivePrompt)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Generation failed.'); }
    finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Character name is required.'); return; }
    if (!projectId) { setError('Select a project to save to.'); return; }
    if (!previewUrl && method !== 'image') { setError('Generate or upload an image first.'); return; }
    setSaving(true); setError(null);
    try {
      const newId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const res = await projectsApi.createCharacter(projectId, {
        character_id: newId,
        name: name.trim(),
        prompt: effectivePrompt || description || undefined,
        selected_image_url: previewUrl ?? undefined,
      });
      onCreated(res.data);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const METHODS: { id: Method; icon: string; label: string; sub: string }[] = [
    { id: 'image',    icon: 'add_photo_alternate', label: 'Start from Image',        sub: 'Upload a reference photo' },
    { id: 'describe', icon: 'edit_note',           label: 'Describe your Character', sub: 'Prompt + style' },
    { id: 'build',    icon: 'tune',                label: 'Build your Character',     sub: 'Structured options' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-4xl max-h-[92vh] flex flex-col bg-surface rounded-3xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-outline-variant/20 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Create Character</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">Add to your character library</p>
          </div>
          <button type="button" onClick={handleClose} className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: configuration */}
          <div className="flex-1 flex flex-col overflow-y-auto px-8 py-6 space-y-6 border-r border-outline-variant/20">

            {/* Method selector */}
            <div className="grid grid-cols-3 gap-3">
              {METHODS.map(({ id, icon, label, sub }) => (
                <button key={id} type="button" onClick={() => { setMethod(id); setPreviewUrl(null); setError(null); }}
                  className={`flex flex-col items-start gap-1.5 p-4 rounded-2xl border-2 text-left transition-all ${
                    method === id
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/30 hover:border-primary/40 hover:bg-surface-container-low'
                  }`}
                >
                  <span className={`material-symbols-outlined text-2xl ${method === id ? 'text-primary' : 'text-outline-variant'}`}>{icon}</span>
                  <span className={`text-sm font-bold leading-tight ${method === id ? 'text-primary' : 'text-on-surface'}`}>{label}</span>
                  <span className="text-[11px] text-on-surface-variant">{sub}</span>
                </button>
              ))}
            </div>

            {/* Shared: name */}
            <div>
              <label className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">Character Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" placeholder="e.g. Captain Kael" />
            </div>

            {/* Method content */}
            {method === 'image' && (
              <FromImagePanel onImageReady={(url) => setPreviewUrl(url)} />
            )}
            {method === 'describe' && (
              <DescribePanel style={style} onStyleChange={setStyle} description={description} onDescriptionChange={setDescription} />
            )}
            {method === 'build' && (
              <BuildPanel
                vibe={vibe} onVibe={setVibe}
                gender={gender} onGender={setGender}
                ethnicity={ethnicity} onEthnicity={setEthnicity}
                age={age} onAge={setAge}
                build={buildType} onBuild={setBuildType}
                extra={extra} onExtra={setExtra}
              />
            )}

            {/* API URL (generation methods only) */}
            {method !== 'image' && (
              <div>
                <label className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">Image API URL</label>
                <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="field mt-1.5" placeholder="https://your-image-api.example.com/generate" />
                {effectivePrompt && (
                  <p className="mt-2 text-[11px] text-outline leading-relaxed line-clamp-2">
                    <span className="font-semibold">Prompt: </span>{effectivePrompt}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: preview */}
          <div className="w-72 flex-shrink-0 flex flex-col px-6 py-6 space-y-5">
            <PreviewPane imageUrl={previewUrl} name={name} generating={generating} />

            {/* Project selector */}
            <div>
              <label className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">Save to Project</label>
              {projects.length === 0 ? (
                <p className="mt-1.5 text-xs text-outline bg-surface-container-low rounded-xl px-3 py-2.5">
                  No saved projects yet. Save a project first.
                </p>
              ) : (
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="field mt-1.5"
                >
                  {projects.map((p) => (
                    <option key={p.project_id} value={p.project_id}>{p.project_id.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              )}
            </div>

            {error && <p className="text-xs text-red-600 leading-relaxed">{error}</p>}

            {/* Actions */}
            <div className="space-y-2 mt-auto">
              {method !== 'image' && (
                <button type="button" onClick={handleGenerate} disabled={generating || !canGenerate}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                    generating || !canGenerate
                      ? 'bg-surface-container-high text-outline cursor-not-allowed'
                      : 'bg-surface-container-high text-primary hover:bg-primary/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">casino</span>
                  {generating ? 'Generating…' : previewUrl ? 'Regenerate' : 'Generate Image'}
                </button>
              )}
              <button
                type="button" onClick={handleSave}
                disabled={saving || !name.trim() || (!previewUrl && method !== 'image') || projects.length === 0}
                className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-on-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {saving ? 'Saving…' : 'Save Character'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
