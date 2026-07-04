'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { galleryApi, projectsApi } from '@/services/api';
import type { CharacterSummary, GalleryComicSummary } from '@/services/api';
import ComicReaderModal from '@/components/ComicReaderModal';

const PAGE_SIZE = 20;

type Tab = 'comics' | 'characters';

function CharacterCard({
  char,
  onAdd,
  inLibrary,
  adding,
  isAuthed,
}: {
  char: CharacterSummary;
  onAdd: () => void;
  inLibrary: boolean;
  adding: boolean;
  isAuthed: boolean;
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
        {isAuthed ? (
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
        ) : (
          <Link
            href="/login"
            className="mt-auto py-1.5 rounded-xl text-xs font-semibold text-center text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors"
          >
            Sign in to save
          </Link>
        )}
      </div>
    </div>
  );
}

function ComicCard({ comic, onClick }: { comic: GalleryComicSummary; onClick: () => void }) {
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

function GridSkeleton({ cols }: { cols: string }) {
  return (
    <div className={`grid ${cols} gap-4`}>
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
  );
}

export default function GalleryPage() {
  const [tab, setTab] = useState<Tab>('comics');
  const [isAuthed, setIsAuthed] = useState(false);

  // Characters
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [charsLoading, setCharsLoading] = useState(false);
  const [charsHasMore, setCharsHasMore] = useState(false);
  const [charsLoadingMore, setCharsLoadingMore] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  // Comics
  const [comics, setComics] = useState<GalleryComicSummary[]>([]);
  const [comicsLoading, setComicsLoading] = useState(false);
  const [comicsHasMore, setComicsHasMore] = useState(false);
  const [comicsLoadingMore, setComicsLoadingMore] = useState(false);
  const [readingProjectId, setReadingProjectId] = useState<string | null>(null);

  useEffect(() => {
    setIsAuthed(!!window.localStorage.getItem('mohiom-user-id'));
  }, []);

  useEffect(() => {
    if (tab === 'characters' && characters.length === 0) {
      setCharsLoading(true);
      galleryApi.characters({ limit: PAGE_SIZE, skip: 0 })
        .then((r) => { setCharacters(r.data); setCharsHasMore(r.data.length === PAGE_SIZE); })
        .catch(() => {})
        .finally(() => setCharsLoading(false));
    }
    if (tab === 'comics' && comics.length === 0) {
      setComicsLoading(true);
      galleryApi.comics({ limit: PAGE_SIZE, skip: 0 })
        .then((r) => { setComics(r.data); setComicsHasMore(r.data.length === PAGE_SIZE); })
        .catch(() => {})
        .finally(() => setComicsLoading(false));
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMoreChars = async () => {
    setCharsLoadingMore(true);
    try {
      const r = await galleryApi.characters({ limit: PAGE_SIZE, skip: characters.length });
      setCharacters((prev) => [...prev, ...r.data]);
      setCharsHasMore(r.data.length === PAGE_SIZE);
    } catch { /* ignore */ } finally { setCharsLoadingMore(false); }
  };

  const loadMoreComics = async () => {
    setComicsLoadingMore(true);
    try {
      const r = await galleryApi.comics({ limit: PAGE_SIZE, skip: comics.length });
      setComics((prev) => [...prev, ...r.data]);
      setComicsHasMore(r.data.length === PAGE_SIZE);
    } catch { /* ignore */ } finally { setComicsLoadingMore(false); }
  };

  const handleAddToLibrary = async (char: CharacterSummary) => {
    if (!isAuthed) return;
    setAddingId(char.character_id);
    try {
      await projectsApi.createStandaloneCharacter({
        character_id: `gallery-${char.character_id}-${Date.now()}`,
        name: char.name,
        prompt: char.prompt ?? undefined,
        selected_image_url: char.selected_image_url ?? undefined,
      });
      setAddedIds((prev) => new Set([...prev, char.character_id]));
    } catch { /* silently ignore */ } finally { setAddingId(null); }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="ml-[var(--studio-sidebar-width)] pt-24 px-8 pb-12 min-h-screen">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tighter text-on-surface">Community Gallery</h1>
            <p className="text-on-surface-variant mt-1">Discover comics and characters created by the community</p>
          </div>
          {!isAuthed && (
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Tab row */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex gap-1 bg-surface-container-low p-1 rounded-2xl">
            {(['comics', 'characters'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                  tab === t ? 'bg-surface shadow text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Characters tab ── */}
        {tab === 'characters' && (
          <>
            {charsLoading ? (
              <GridSkeleton cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" />
            ) : characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <span className="material-symbols-outlined text-7xl text-on-surface-variant/20">person_off</span>
                <p className="font-semibold text-on-surface-variant">No community characters yet</p>
                <p className="text-sm text-on-surface-variant/70 max-w-xs">
                  Characters appear here when creators share them from their Character Library.
                </p>
              </div>
            ) : (
              <>
                <div className="animate-skel-reveal grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {characters.map((char) => (
                    <CharacterCard
                      key={char.character_id}
                      char={char}
                      inLibrary={addedIds.has(char.character_id)}
                      adding={addingId === char.character_id}
                      isAuthed={isAuthed}
                      onAdd={() => handleAddToLibrary(char)}
                    />
                  ))}
                </div>
                {charsHasMore && (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMoreChars}
                      disabled={charsLoadingMore}
                      className="px-6 py-2.5 rounded-2xl text-sm font-semibold border border-outline-variant/30 hover:bg-surface-container transition-colors disabled:opacity-50"
                    >
                      {charsLoadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Comics tab ── */}
        {tab === 'comics' && (
          <>
            {comicsLoading ? (
              <GridSkeleton cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" />
            ) : comics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <span className="material-symbols-outlined text-7xl text-on-surface-variant/20">auto_stories</span>
                <p className="font-semibold text-on-surface-variant">No published comics yet</p>
                <p className="text-sm text-on-surface-variant/70 max-w-xs">
                  Comics appear here when creators publish them from their Projects drawer.
                </p>
                <Link href="/studio" className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-bold hover:opacity-90">
                  Create a Comic
                </Link>
              </div>
            ) : (
              <>
                <div className="animate-skel-reveal grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {comics.map((comic) => (
                    <ComicCard
                      key={comic.project_id}
                      comic={comic}
                      onClick={() => setReadingProjectId(comic.project_id)}
                    />
                  ))}
                </div>
                {comicsHasMore && (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMoreComics}
                      disabled={comicsLoadingMore}
                      className="px-6 py-2.5 rounded-2xl text-sm font-semibold border border-outline-variant/30 hover:bg-surface-container transition-colors disabled:opacity-50"
                    >
                      {comicsLoadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
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
