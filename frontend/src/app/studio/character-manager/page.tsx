'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import CreateCharacterModal from '@/components/CreateCharacterModal';
import { projectsApi } from '@/services/api';
import type { CharacterSummary, CloudProjectListItem } from '@/services/api';

const MAX_SLOTS = 12;

function seedFrom(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `#${(h % 90000 + 10000).toString().slice(0, 4)}`;
}

function tagFrom(id: string) {
  const parts = id.split(/[-_]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return id.slice(0, 2).toUpperCase();
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 'md' }: { src?: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-24 h-24' : size === 'md' ? 'w-16 h-16' : 'w-12 h-12';
  return (
    <div className={`${dim} rounded-full overflow-hidden bg-surface-container-high flex items-center justify-center ring-4 ring-primary/10 flex-shrink-0`}>
      {src
        ? <img alt={name} className="w-full h-full object-cover" src={src} />
        : <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: size === 'lg' ? 40 : 28 }}>person</span>}
    </div>
  );
}

// ─── Character card (list) ────────────────────────────────────────────────────

interface CardProps {
  character: CharacterSummary;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onToggleLock: (e: React.MouseEvent) => void;
}

function CharacterCard({ character, selected, locked, onSelect, onToggleLock }: CardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-5 rounded-xl shadow-sm flex items-start gap-4 transition-all duration-200 border-2 ${
        selected
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-transparent bg-surface-container-lowest hover:bg-surface-container-low hover:border-outline-variant/30'
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar src={character.selected_image_url} name={character.name} />
        <span className="absolute -bottom-1 -right-1 bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold">
          {tagFrom(character.character_id)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-on-surface text-sm leading-snug truncate">{character.name}</h4>
          <button
            type="button"
            onClick={onToggleLock}
            title={locked ? 'Unlock face' : 'Lock face'}
            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
              locked ? 'text-primary' : 'text-outline hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: locked ? "'FILL' 1" : "'FILL' 0" }}>
              lock
            </span>
          </button>
        </div>
        <span className="text-[10px] font-mono text-outline">Seed {seedFrom(character.character_id)}</span>
        {character.prompt && (
          <p className="mt-1.5 text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{character.prompt}</p>
        )}
        <p className="mt-1 text-[10px] text-outline/60 truncate">{character.project_id ?? 'My Library'}</p>
      </div>
    </button>
  );
}

// ─── Detail / Edit panel ─────────────────────────────────────────────────────

interface DetailPanelProps {
  character: CharacterSummary;
  onSaved: (updated: CharacterSummary) => void;
  onDeleted: () => void;
  onBack: () => void;
}

function DetailPanel({ character, onSaved, onDeleted, onBack }: DetailPanelProps) {
  const [name, setName] = useState(character.name);
  const [prompt, setPrompt] = useState(character.prompt ?? '');
  const [apiUrl, setApiUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Reset form when character changes
    setName(character.name);
    setPrompt(character.prompt ?? '');
    setPreviewUrl(null);
    setConfirmDelete(false);
    setError(null);
    setSuccess(false);
  }, [character.character_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stored = window.sessionStorage.getItem('mohiom-image-api-url');
    if (stored) setApiUrl(stored);
  }, []);

  const displayImage = previewUrl ?? character.selected_image_url;

  const handleGenerate = async () => {
    if (!apiUrl.trim()) { setError('Enter an Image API URL first.'); return; }
    if (!prompt.trim()) { setError('Enter a prompt first.'); return; }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch('/api/image-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: apiUrl.trim(), prompt: prompt.trim(), negative_prompt: 'lowres, bad anatomy' }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? `Error ${res.status}`); }
      const data = await res.json() as { image_base64?: string; message?: string };
      if (!data.image_base64) throw new Error(data.message ?? 'No image returned');
      const url = data.image_base64.startsWith('data:') ? data.image_base64 : `data:image/png;base64,${data.image_base64}`;
      setPreviewUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const patch: { name?: string; prompt?: string; selected_image_url?: string } = {};
      if (name.trim() !== character.name) patch.name = name.trim();
      if (prompt.trim() !== (character.prompt ?? '')) patch.prompt = prompt.trim();
      if (previewUrl) patch.selected_image_url = previewUrl;
      const res = character.project_id
        ? await projectsApi.updateCharacter(character.project_id, character.character_id, patch)
        : await projectsApi.updateStandaloneCharacter(character.character_id, patch);
      setPreviewUrl(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onSaved({ ...character, ...res.data });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      if (character.project_id) {
        await projectsApi.deleteCharacter(character.project_id, character.character_id);
      } else {
        await projectsApi.deleteStandaloneCharacter(character.character_id);
      }
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-6">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          All characters
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 font-semibold">Sure?</span>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-on-surface-variant hover:text-on-surface">Cancel</button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        ) : (
          <button type="button" onClick={handleDelete} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors">
            <span className="material-symbols-outlined text-base">delete</span>
            Delete
          </button>
        )}
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <Avatar src={displayImage} name={name} size="lg" />
          {previewUrl && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[12px]">check</span>
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xl font-bold bg-transparent border-b-2 border-outline-variant/30 focus:border-primary outline-none pb-1 text-on-surface transition-colors"
            placeholder="Character name"
          />
          <p className="text-xs text-outline mt-1">
            Seed {seedFrom(character.character_id)} · {character.project_id ?? 'My Library'}
          </p>
        </div>
      </div>

      {/* Prompt editor */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary text-base">smart_toy</span>
          <label className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">AI Prompt</label>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed"
          placeholder="Describe the character's appearance, style, and traits…"
        />
      </div>

      {/* Image generation */}
      <div className="mb-5 space-y-2">
        <label className="text-xs font-bold tracking-wider text-on-surface-variant uppercase block">Generate New Image</label>
        <input
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          className="w-full bg-surface-container-low rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="https://your-image-api.example.com/generate"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            generating
              ? 'bg-surface-container-high text-outline cursor-not-allowed'
              : 'bg-surface-container-high text-primary hover:bg-primary/10'
          }`}
        >
          <span className="material-symbols-outlined text-base">casino</span>
          {generating ? 'Generating…' : previewUrl ? 'Regenerate' : 'Generate Image'}
        </button>

        {previewUrl && (
          <div className="rounded-xl overflow-hidden aspect-[3/2] relative">
            <img src={previewUrl} alt="Generated preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-3">
              <span className="text-xs text-white font-semibold">New image — save to apply</span>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || success}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
          success
            ? 'bg-emerald-100 text-emerald-700'
            : saving
              ? 'bg-surface-container-high text-outline cursor-not-allowed'
              : 'bg-primary text-on-primary hover:opacity-90'
        }`}
      >
        {success ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

// ─── Stats panel (default right side) ────────────────────────────────────────

function StatsPanel({ characters, lockedIds, onLoadProject }: {
  characters: CharacterSummary[];
  lockedIds: Set<string>;
  onLoadProject: (id: string) => void;
}) {
  const byProject = Array.from(
    characters.reduce((m, c) => { const key = c.project_id ?? 'My Library'; m.set(key, (m.get(key) ?? 0) + 1); return m; }, new Map<string, number>())
  );

  return (
    <div className="space-y-8">
      <div className="bg-surface-container-high p-8 rounded-xl relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl" />
        <h3 className="text-xs font-bold text-primary tracking-widest uppercase mb-5">Overview</h3>
        <div className="space-y-5">
          {[
            { label: 'Locked', value: lockedIds.size, total: characters.length },
            { label: 'Slots filled', value: characters.length, total: MAX_SLOTS },
          ].map(({ label, value, total }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-on-surface-variant">{label}</span>
                <span className="text-[10px] text-primary font-bold">{value} / {total}</span>
              </div>
              <div className="w-full bg-surface-container-lowest h-1.5 rounded-full">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: total ? `${(value / total) * 100}%` : '0%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-container-lowest p-8 rounded-xl shadow-lg">
        <h3 className="text-xs font-bold text-on-surface-variant tracking-widest uppercase mb-5">By Project</h3>
        {byProject.length === 0 ? (
          <p className="text-xs text-outline text-center py-4">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {byProject.map(([pid, count]) => (
              <button key={pid} onClick={() => onLoadProject(pid)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl transition-colors text-left"
              >
                <span className="text-xs font-semibold text-on-surface truncate max-w-[140px]">{pid.replace(/_/g, ' ')}</span>
                <span className="text-xs font-bold text-primary ml-2 flex-shrink-0">{count} char{count !== 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type PanelMode = 'stats' | 'detail';

export default function CharacterManagerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [projects, setProjects] = useState<CloudProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CharacterSummary | null>(null);
  const [mode, setMode] = useState<PanelMode>('stats');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [charsRes, projsRes] = await Promise.all([projectsApi.characters(), projectsApi.list()]);
      setCharacters(charsRes.data);
      setProjects(projsRes.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleLock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLockedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectCharacter = (char: CharacterSummary) => {
    setSelected(char);
    setMode('detail');
  };

  const handleLoadProject = (projectId: string) => {
    window.localStorage.setItem('mohiom-pending-load', projectId);
    router.push('/studio');
  };

  const handleSaved = (updated: CharacterSummary) => {
    setCharacters((prev) => prev.map((c) => c.character_id === updated.character_id ? updated : c));
    setSelected(updated);
  };

  const handleDeleted = () => {
    if (selected) setCharacters((prev) => prev.filter((c) => c.character_id !== selected.character_id));
    setSelected(null);
    setMode('stats');
  };

  const handleCreated = (char: CharacterSummary) => {
    setCharacters((prev) => [char, ...prev]);
    setSelected(char);
    setMode('detail');
    setIsModalOpen(false);
  };

  const filtered = characters.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.project_id ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex overflow-hidden">
      <StudioSidebar />
      <StudioTopBar />
      <main className="flex-1 ml-[var(--studio-sidebar-width)] h-screen overflow-y-auto px-10 pt-24 pb-12">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Header */}
          <header className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tighter text-on-surface">Character Manager</h2>
              <p className="text-on-surface-variant mt-1">Maintain identity and consistency across all panels.</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full text-sm">
                <span className="material-symbols-outlined text-outline text-base">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search characters…"
                  className="bg-transparent outline-none text-on-surface placeholder-outline w-36"
                />
              </div>
              {/* Tabs */}
              <div className="flex bg-surface-container-low p-1 rounded-full">
                {(['active', 'archived'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-5 py-2 rounded-full font-bold text-sm transition-all capitalize ${
                      tab === t ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {t === 'active' ? 'Active' : 'Archived'}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Left — character list */}
            <section className="xl:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-on-surface-variant tracking-widest uppercase">
                  {tab === 'active' ? 'Active Characters' : 'Archived'}
                </h3>
                <span className="text-xs text-outline bg-surface-container px-3 py-1 rounded-full">
                  {loading ? '…' : filtered.length} / {MAX_SLOTS} slots
                </span>
              </div>

              {tab === 'archived' ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-outline-variant/40 text-center">
                  <span className="material-symbols-outlined text-4xl text-outline-variant mb-3">inventory_2</span>
                  <p className="text-on-surface-variant text-sm">No archived characters.</p>
                </div>
              ) : loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-surface-container-low animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 && !search ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-outline-variant/40 text-center">
                  <span className="material-symbols-outlined text-5xl text-outline-variant mb-4">group_off</span>
                  <p className="font-bold text-on-surface text-lg mb-1">No characters yet</p>
                  <p className="text-on-surface-variant text-sm max-w-xs mb-6">
                    Save a project with Step 2 images to see characters here, or create one manually.
                  </p>
                  <button onClick={() => setIsModalOpen(true)} className="px-6 py-3 bg-primary text-on-primary font-bold rounded-full hover:opacity-90 transition-opacity">
                    Create character
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-outline py-8">No characters match "{search}".</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map((char) => (
                    <CharacterCard
                      key={char.character_id}
                      character={char}
                      selected={selected?.character_id === char.character_id}
                      locked={lockedIds.has(char.character_id)}
                      onSelect={() => selectCharacter(char)}
                      onToggleLock={(e) => toggleLock(char.character_id, e)}
                    />
                  ))}
                  {characters.length < MAX_SLOTS && (
                    <button
                      onClick={() => { setSelected(null); setIsModalOpen(true); }}
                      className="w-full border-2 border-dashed border-outline-variant/40 p-5 rounded-xl flex items-center gap-4 group hover:border-primary/40 hover:bg-surface-container-low transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-outline">person_add</span>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface-variant text-sm">Add Character</p>
                        <p className="text-[10px] text-outline uppercase tracking-tighter">New generation or manual entry</p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Right — dynamic panel */}
            <aside className="bg-surface-container-lowest rounded-xl p-6 shadow-sm h-fit sticky top-8 max-h-[calc(100vh-8rem)] overflow-y-auto">
              {mode === 'detail' && selected ? (
                <DetailPanel
                  character={selected}
                  onSaved={handleSaved}
                  onDeleted={handleDeleted}
                  onBack={() => { setSelected(null); setMode('stats'); }}
                />
              ) : (
                <StatsPanel
                  characters={characters}
                  lockedIds={lockedIds}
                  onLoadProject={handleLoadProject}
                />
              )}
            </aside>
          </div>
        </div>
      </main>

      {/* FAB */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-primary to-primary-container text-white rounded-full shadow-2xl flex items-center justify-center group active:scale-95 duration-150"
        title="New character"
      >
        <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform">add</span>
      </button>

      <CreateCharacterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
        projects={projects}
      />
    </div>
  );
}
