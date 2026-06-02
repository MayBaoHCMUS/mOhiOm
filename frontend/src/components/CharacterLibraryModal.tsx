'use client';

import { useEffect, useMemo, useState } from 'react';
import { projectsApi } from '@/services/api';
import type { CharacterSummary } from '@/services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** IDs of characters already in the project — shown as already-added */
  existingIds: Set<string>;
  onConfirm: (selected: CharacterSummary[]) => void;
}

function CharacterCard({
  char,
  state,
  onToggle,
}: {
  char: CharacterSummary;
  state: 'selectable' | 'selected' | 'added';
  onToggle: () => void;
}) {
  const isAdded    = state === 'added';
  const isSelected = state === 'selected';

  return (
    <button
      type="button"
      onClick={isAdded ? undefined : onToggle}
      disabled={isAdded}
      className={`relative w-full text-left rounded-2xl border-2 overflow-hidden transition-all duration-150 ${
        isAdded
          ? 'border-outline-variant/20 opacity-50 cursor-default'
          : isSelected
            ? 'border-primary shadow-md scale-[1.01]'
            : 'border-transparent bg-surface-container-low hover:border-primary/30 hover:bg-surface-container'
      }`}
    >
      {/* Image */}
      <div className="aspect-[3/4] bg-surface-container-high overflow-hidden">
        {char.selected_image_url ? (
          <img
            src={char.selected_image_url}
            alt={char.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-outline-variant">person</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-bold text-sm text-on-surface truncate">{char.name}</p>
        <p className="text-[10px] text-outline truncate mt-0.5">{char.project_id ? char.project_id.replace(/_/g, ' ') : 'My Library'}</p>
        {char.prompt && (
          <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">{char.prompt}</p>
        )}
      </div>

      {/* State badge */}
      {isAdded && (
        <div className="absolute top-2 right-2 bg-surface/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <span className="text-[10px] font-bold text-primary">Added</span>
        </div>
      )}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow">
          <span className="material-symbols-outlined text-white text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
        </div>
      )}
    </button>
  );
}

export default function CharacterLibraryModal({ isOpen, onClose, existingIds, onConfirm }: Props) {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set());
    setSearch('');
    setLoading(true);
    projectsApi.characters()
      .then((r) => setCharacters(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const filtered = useMemo(() =>
    characters.filter((c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.project_id ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [characters, search]
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const chosen = characters.filter((c) => selectedIds.has(c.character_id));
    onConfirm(chosen);
    onClose();
  };

  const newCount = [...selectedIds].filter((id) => !existingIds.has(id)).length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-3xl max-h-[88vh] flex flex-col bg-surface rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-outline-variant/20 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Character Library</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Select characters to add to this project's reference review
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-7 py-4 border-b border-outline-variant/10 flex-shrink-0">
          <div className="flex items-center gap-3 bg-surface-container-low rounded-2xl px-4 py-2.5">
            <span className="material-symbols-outlined text-outline text-lg">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or project…"
              className="flex-1 bg-transparent text-sm text-on-surface placeholder-outline outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-container-low animate-pulse">
                  <div className="aspect-[3/4] bg-surface-container-high rounded-t-2xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-surface-container-high rounded w-3/4" />
                    <div className="h-2 bg-surface-container-high rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant mb-4">
                {search ? 'search_off' : 'person_off'}
              </span>
              <p className="font-semibold text-on-surface">
                {search ? `No results for "${search}"` : 'No characters in library'}
              </p>
              {!search && (
                <p className="text-sm text-on-surface-variant mt-1 max-w-xs">
                  Create characters in the Character Manager and save them to a project first.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {filtered.map((char) => {
                const isAdded = existingIds.has(char.character_id);
                const isSelected = selectedIds.has(char.character_id);
                return (
                  <CharacterCard
                    key={char.character_id}
                    char={char}
                    state={isAdded ? 'added' : isSelected ? 'selected' : 'selectable'}
                    onToggle={() => toggle(char.character_id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-outline-variant/20 bg-surface-container-low flex-shrink-0">
          <p className="text-sm text-on-surface-variant">
            {newCount > 0
              ? `${newCount} character${newCount !== 1 ? 's' : ''} selected`
              : 'Select characters to add'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={newCount === 0}
              className="px-6 py-2.5 rounded-2xl text-sm font-bold bg-primary text-on-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Add {newCount > 0 ? newCount : ''} to Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
