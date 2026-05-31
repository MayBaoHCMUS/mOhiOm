'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { projectsApi } from '@/services/api';
import type { CharacterSummary } from '@/services/api';

const MAX_SLOTS = 12;

// Derive a short seed-style ID from the character_id string.
function seedFrom(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `#${(h % 90000 + 10000).toString().slice(0, 4)}`;
}

// Pick a short tag label (up to 2 chars) from the character_id.
function tagFrom(id: string) {
  const parts = id.split(/[-_]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return id.slice(0, 2).toUpperCase();
}

function CardSkeleton() {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-lg animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-16 h-16 rounded-full bg-surface-container-high flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-surface-container-high rounded w-2/3" />
          <div className="h-3 bg-surface-container-high rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-2 mb-6">
        <div className="h-3 bg-surface-container-high rounded" />
        <div className="h-3 bg-surface-container-high rounded w-4/5" />
      </div>
      <div className="h-px bg-surface-container-high" />
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="col-span-2 flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-outline-variant/40 text-center">
      <span className="material-symbols-outlined text-5xl text-outline-variant mb-4">group_off</span>
      <p className="font-bold text-on-surface text-lg mb-1">No characters yet</p>
      <p className="text-on-surface-variant text-sm max-w-xs mb-6">
        Complete Step 2 (Character Design) in the pipeline and save your project to see characters here.
      </p>
      <button
        onClick={onStart}
        className="px-6 py-3 bg-primary text-on-primary font-bold rounded-full hover:opacity-90 transition-opacity"
      >
        Go to Studio
      </button>
    </div>
  );
}

interface CharacterCardProps {
  character: CharacterSummary;
  locked: boolean;
  onToggleLock: () => void;
  onLoadProject: () => void;
}

function CharacterCard({ character, locked, onToggleLock, onLoadProject }: CharacterCardProps) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-lg flex flex-col h-full group hover:bg-surface-container-low transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full ring-4 ring-primary/10 overflow-hidden shadow-inner bg-surface-container">
              {character.selected_image_url ? (
                <img
                  alt={character.name}
                  className="w-full h-full object-cover"
                  src={character.selected_image_url}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold">
              {tagFrom(character.character_id)}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-on-surface leading-none">{character.name}</h4>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface text-[10px] font-bold tracking-tight">
              Seed: {seedFrom(character.character_id)}
            </span>
          </div>
        </div>
        <button
          onClick={onLoadProject}
          title={`Open project: ${character.project_id}`}
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-white transition-all flex-shrink-0"
        >
          <span className="material-symbols-outlined text-xl">open_in_new</span>
        </button>
      </div>

      <p className="text-sm text-on-surface-variant leading-relaxed flex-1 mb-4 line-clamp-3">
        {character.prompt ?? 'No prompt saved for this character.'}
      </p>

      <p className="text-[10px] font-mono text-outline mb-4 truncate">
        {character.project_id}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
        <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Lock Face</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            className="sr-only peer"
            type="checkbox"
            checked={locked}
            onChange={onToggleLock}
          />
          <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
        </label>
      </div>
    </div>
  );
}

export default function CharacterManagerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    projectsApi.characters()
      .then((r) => setCharacters(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleLock = (id: string) => {
    setLockedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLoadProject = (projectId: string) => {
    window.localStorage.setItem('mohiom-pending-load', projectId);
    router.push('/studio');
  };

  const lockedCount = lockedIds.size;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex overflow-hidden">
      <StudioSidebar />
      <StudioTopBar />
      <main className="flex-1 ml-[var(--studio-sidebar-width)] h-screen overflow-y-auto relative px-10 pt-24 pb-12">
        <div className="max-w-7xl mx-auto space-y-12">

          {/* Header */}
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tighter text-on-surface">Character Manager</h2>
              <p className="text-on-surface-variant mt-1">Maintain identity and consistency across all panels.</p>
            </div>
            <div className="flex gap-4">
              <div className="flex bg-surface-container-low p-1 rounded-full">
                <button
                  onClick={() => setTab('active')}
                  className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${
                    tab === 'active'
                      ? 'bg-surface-container-lowest shadow-sm text-primary'
                      : 'text-on-surface-variant'
                  }`}
                >
                  Active Engine
                </button>
                <button
                  onClick={() => setTab('archived')}
                  className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${
                    tab === 'archived'
                      ? 'bg-surface-container-lowest shadow-sm text-primary'
                      : 'text-on-surface-variant'
                  }`}
                >
                  Archived
                </button>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Character grid */}
            <section className="xl:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-on-surface-variant tracking-widest uppercase">
                  {tab === 'active' ? 'Active Characters' : 'Archived Characters'}
                </h3>
                <span className="text-xs text-outline bg-surface-container px-3 py-1 rounded-full">
                  {loading ? '…' : characters.length} / {MAX_SLOTS} Slots used
                </span>
              </div>

              {tab === 'archived' ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-outline-variant/40 text-center">
                  <span className="material-symbols-outlined text-4xl text-outline-variant mb-3">inventory_2</span>
                  <p className="text-on-surface-variant text-sm">No archived characters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {loading ? (
                    <>
                      <CardSkeleton />
                      <CardSkeleton />
                      <CardSkeleton />
                    </>
                  ) : characters.length === 0 ? (
                    <EmptyState onStart={() => router.push('/studio')} />
                  ) : (
                    <>
                      {characters.map((char) => (
                        <CharacterCard
                          key={char.character_id}
                          character={char}
                          locked={lockedIds.has(char.character_id)}
                          onToggleLock={() => toggleLock(char.character_id)}
                          onLoadProject={() => handleLoadProject(char.project_id)}
                        />
                      ))}
                      {/* Add slot */}
                      {characters.length < MAX_SLOTS && (
                        <button
                          onClick={() => router.push('/studio')}
                          className="border-2 border-dashed border-outline-variant/40 p-6 rounded-xl flex flex-col items-center justify-center text-center group hover:border-primary/40 hover:bg-surface-container-low transition-all cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-outline">person_add</span>
                          </div>
                          <span className="font-bold text-on-surface-variant">Add Character</span>
                          <p className="text-[10px] text-outline mt-1 px-4 uppercase tracking-tighter">New project generation</p>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Sidebar */}
            <aside className="space-y-8">
              {/* Lock stats */}
              <div className="bg-surface-container-high p-8 rounded-xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl" />
                <h3 className="text-xs font-bold text-primary tracking-widest uppercase mb-4">Lock Status</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-on-surface-variant">Locked Characters</label>
                      <span className="text-[10px] text-primary font-bold">
                        {lockedCount} / {characters.length}
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-lowest h-2 rounded-full">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: characters.length ? `${(lockedCount / characters.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-on-surface-variant">Slots Filled</label>
                      <span className="text-[10px] text-primary font-bold">
                        {characters.length} / {MAX_SLOTS}
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-lowest h-2 rounded-full">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${(characters.length / MAX_SLOTS) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Projects breakdown */}
              <div className="bg-surface-container-lowest p-8 rounded-xl shadow-lg">
                <h3 className="text-xs font-bold text-on-surface-variant tracking-widest uppercase mb-6">By Project</h3>
                {loading ? (
                  <div className="space-y-3 animate-pulse">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-10 bg-surface-container-high rounded-xl" />
                    ))}
                  </div>
                ) : characters.length === 0 ? (
                  <p className="text-xs text-outline text-center py-4">No data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Array.from(
                      characters.reduce((map, c) => {
                        map.set(c.project_id, (map.get(c.project_id) ?? 0) + 1);
                        return map;
                      }, new Map<string, number>())
                    ).map(([projectId, count]) => (
                      <button
                        key={projectId}
                        onClick={() => handleLoadProject(projectId)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl transition-colors text-left"
                      >
                        <span className="text-xs font-semibold text-on-surface truncate max-w-[140px]">
                          {projectId.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-bold text-primary ml-2 flex-shrink-0">
                          {count} char{count !== 1 ? 's' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* FAB */}
      <button
        onClick={() => router.push('/studio')}
        className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-primary to-primary-container text-white rounded-full shadow-2xl flex items-center justify-center group active:scale-95 duration-150"
        title="New project"
      >
        <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform">add</span>
      </button>
    </div>
  );
}
