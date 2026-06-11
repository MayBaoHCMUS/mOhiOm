'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { galleryApi, projectsApi } from '@/services/api';
import type { CharacterSummary, GalleryComicSummary } from '@/services/api';
import ComicReaderModal from '@/components/ComicReaderModal';

type Tab = 'characters' | 'comics';

function CharacterCard({
  char,
  onAdd,
  inLibrary,
  adding,
}: {
  char: CharacterSummary;
  onAdd: () => void;
  inLibrary: boolean;
  adding: boolean;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="aspect-[3/4] bg-surface-container-high overflow-hidden">
        {char.selected_image_url ? (
          <img src={char.selected_image_url} alt={char.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-outline-variant">person</span>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="font-bold text-sm text-on-surface truncate">{char.name}</p>
          <p className="text-[10px] text-outline mt-0.5 truncate">
            {char.project_id ? char.project_id.replace(/_/g, ' ') : 'Community'}
          </p>
          {char.prompt && (
            <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">{char.prompt}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={inLibrary || adding}
          className={`mt-auto py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            inLibrary
              ? 'bg-emerald-100 text-emerald-700 cursor-default'
              : adding
              ? 'bg-surface-container text-outline cursor-not-allowed'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          }`}
        >
          {inLibrary ? '✓ In Library' : adding ? 'Adding…' : 'Add to My Library'}
        </button>
      </div>
    </div>
  );
}

function ComicCard({
  comic,
  onClick,
}: {
  comic: GalleryComicSummary;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest overflow-hidden text-left hover:shadow-md hover:border-primary/30 transition-all group"
    >
      <div className="aspect-[3/4] bg-surface-container-high overflow-hidden relative">
        {comic.cover_image_url ? (
          <img src={comic.cover_image_url} alt={comic.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-outline-variant">auto_stories</span>
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-2 flex gap-1 flex-wrap">
          {comic.genre && (
            <span className="px-2 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm">
              {comic.genre}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-bold backdrop-blur-sm">
            {comic.page_count}p
          </span>
        </div>
      </div>
      <div className="p-3">
        <p className="font-bold text-sm text-on-surface truncate">{comic.title || comic.project_id}</p>
        {comic.art_style && <p className="text-[10px] text-outline mt-0.5 truncate">{comic.art_style}</p>}
        {comic.story_synopsis && (
          <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">{comic.story_synopsis}</p>
        )}
      </div>
    </button>
  );
}

export default function GalleryPage() {
  const [tab, setTab] = useState<Tab>('comics');

  // Characters tab
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [charsLoading, setCharsLoading] = useState(false);
  const [charSearch, setCharSearch] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  // Comics tab
  const [comics, setComics] = useState<GalleryComicSummary[]>([]);
  const [comicsLoading, setComicsLoading] = useState(false);
  const [comicSearch, setComicSearch] = useState('');
  const [readingProjectId, setReadingProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'characters' && characters.length === 0) {
      setCharsLoading(true);
      galleryApi.characters()
        .then((r) => setCharacters(r.data))
        .catch(() => {})
        .finally(() => setCharsLoading(false));
    }
    if (tab === 'comics' && comics.length === 0) {
      setComicsLoading(true);
      galleryApi.comics()
        .then((r) => setComics(r.data))
        .catch(() => {})
        .finally(() => setComicsLoading(false));
    }
  }, [tab]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddToLibrary = async (char: CharacterSummary) => {
    setAddingId(char.character_id);
    try {
      await projectsApi.createStandaloneCharacter({
        character_id: `gallery-${char.character_id}-${Date.now()}`,
        name: char.name,
        prompt: char.prompt ?? undefined,
        selected_image_url: char.selected_image_url ?? undefined,
      });
      setAddedIds((prev) => new Set([...prev, char.character_id]));
    } catch {
      // silently ignore; user can retry
    } finally {
      setAddingId(null);
    }
  };

  const filteredChars = characters.filter((c) =>
    !charSearch ||
    c.name.toLowerCase().includes(charSearch.toLowerCase()) ||
    (c.project_id ?? '').toLowerCase().includes(charSearch.toLowerCase())
  );

  const filteredComics = comics.filter((c) =>
    !comicSearch ||
    c.title.toLowerCase().includes(comicSearch.toLowerCase()) ||
    c.genre.toLowerCase().includes(comicSearch.toLowerCase()) ||
    c.art_style.toLowerCase().includes(comicSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Header */}
      <div className="border-b border-outline-variant/20 bg-surface sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link
              href="/studio"
              className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Studio
            </Link>
            <div className="w-px h-5 bg-outline-variant/30" />
            <h1 className="text-xl font-bold text-on-surface">Community Gallery</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-surface-container-low p-1 rounded-2xl">
            {(['comics', 'characters'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold capitalize transition-all ${
                  tab === t ? 'bg-surface shadow text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Characters tab ── */}
        {tab === 'characters' && (
          <>
            <div className="mb-6 max-w-sm">
              <div className="flex items-center gap-3 bg-surface-container-low rounded-2xl px-4 py-2.5">
                <span className="material-symbols-outlined text-outline text-lg">search</span>
                <input
                  value={charSearch}
                  onChange={(e) => setCharSearch(e.target.value)}
                  placeholder="Search characters…"
                  className="flex-1 bg-transparent text-sm text-on-surface placeholder-outline outline-none"
                />
              </div>
            </div>

            {charsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-surface-container-low animate-pulse">
                    <div className="aspect-[3/4] bg-surface-container-high rounded-t-2xl" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-surface-container-high rounded w-3/4" />
                      <div className="h-6 bg-surface-container-high rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredChars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <span className="material-symbols-outlined text-7xl text-on-surface-variant/20">person_off</span>
                <p className="font-semibold text-on-surface-variant">
                  {charSearch ? `No characters match "${charSearch}"` : 'No community characters yet'}
                </p>
                {!charSearch && (
                  <p className="text-sm text-on-surface-variant/70 max-w-xs">
                    Characters appear here when creators share them from their Character Library.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredChars.map((char) => (
                  <CharacterCard
                    key={char.character_id}
                    char={char}
                    inLibrary={addedIds.has(char.character_id)}
                    adding={addingId === char.character_id}
                    onAdd={() => handleAddToLibrary(char)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Comics tab ── */}
        {tab === 'comics' && (
          <>
            <div className="mb-6 max-w-sm">
              <div className="flex items-center gap-3 bg-surface-container-low rounded-2xl px-4 py-2.5">
                <span className="material-symbols-outlined text-outline text-lg">search</span>
                <input
                  value={comicSearch}
                  onChange={(e) => setComicSearch(e.target.value)}
                  placeholder="Search by title, genre, style…"
                  className="flex-1 bg-transparent text-sm text-on-surface placeholder-outline outline-none"
                />
              </div>
            </div>

            {comicsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-surface-container-low animate-pulse">
                    <div className="aspect-[3/4] bg-surface-container-high rounded-t-2xl" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-surface-container-high rounded w-3/4" />
                      <div className="h-2 bg-surface-container-high rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredComics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <span className="material-symbols-outlined text-7xl text-on-surface-variant/20">auto_stories</span>
                <p className="font-semibold text-on-surface-variant">
                  {comicSearch ? `No comics match "${comicSearch}"` : 'No published comics yet'}
                </p>
                {!comicSearch && (
                  <p className="text-sm text-on-surface-variant/70 max-w-xs">
                    Comics appear here when creators publish them from their Projects drawer.
                  </p>
                )}
                <Link
                  href="/studio"
                  className="px-5 py-2.5 rounded-2xl bg-primary text-on-primary text-sm font-bold hover:opacity-90"
                >
                  Create a Comic
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredComics.map((comic) => (
                  <ComicCard
                    key={comic.project_id}
                    comic={comic}
                    onClick={() => setReadingProjectId(comic.project_id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {readingProjectId && (
        <ComicReaderModal
          projectId={readingProjectId}
          onClose={() => setReadingProjectId(null)}
        />
      )}
    </div>
  );
}
