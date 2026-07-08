'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { galleryApi, projectsApi } from '@/services/api';
import type { CharacterSummary, GalleryComicSummary } from '@/services/api';
import ComicReaderModal from '@/components/ComicReaderModal';
import CharacterPreviewModal from '@/components/CharacterPreviewModal';
import { useAuth } from '@/context/AuthContext';
import { useStoryLibrary } from '@/hooks/useStoryLibrary';

const PAGE_SIZE = 20;

type Tab = 'comics' | 'characters';

function CharacterCard({
  char,
  onPreview,
  onAdd,
  inLibrary,
  adding,
  isAuthed,
}: {
  char: CharacterSummary;
  onPreview: () => void;
  onAdd: () => void;
  inLibrary: boolean;
  adding: boolean;
  isAuthed: boolean;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <button
        type="button"
        onClick={onPreview}
        title="Preview"
        className="relative aspect-[3/4] bg-surface-container-high overflow-hidden w-full text-left block"
      >
        {char.selected_image_url ? (
          <img src={char.selected_image_url} alt={char.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-outline-variant">person</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-on-surface text-xs font-semibold">
            <span className="material-symbols-outlined text-base leading-none">visibility</span>
            Preview
          </span>
        </div>
      </button>
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

function ComicCard({
  comic,
  onPreview,
  onAdd,
  inLibrary,
  adding,
  isAuthed,
}: {
  comic: GalleryComicSummary;
  onPreview: () => void;
  onAdd: () => void;
  inLibrary: boolean;
  adding: boolean;
  isAuthed: boolean;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest overflow-hidden flex flex-col hover:shadow-md hover:border-primary/30 transition-all group">
      <button
        type="button"
        onClick={onPreview}
        title="Preview"
        className="aspect-[3/4] bg-surface-container-high overflow-hidden relative w-full text-left block"
      >
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
        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-on-surface text-xs font-semibold">
            <span className="material-symbols-outlined text-base leading-none">visibility</span>
            Preview
          </span>
        </div>
      </button>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="font-bold text-sm text-on-surface truncate">{comic.title || comic.project_id}</p>
          {comic.art_style && <p className="text-[10px] text-outline mt-0.5 truncate">{comic.art_style}</p>}
          {comic.story_synopsis && (
            <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">{comic.story_synopsis}</p>
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
            {inLibrary ? '✓ In My Stories' : adding ? 'Adding…' : 'Add to My Stories'}
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

interface GalleryContentProps {
  showHeading?: boolean;
}

export default function GalleryContent({ showHeading = true }: GalleryContentProps) {
  const { user, isInitialized } = useAuth();
  const isAuthed = isInitialized && !!user;
  const { save: saveStory } = useStoryLibrary();
  const [tab, setTab] = useState<Tab>('comics');

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The open preview is driven by the URL — shareable/bookmarkable, and the
  // browser back button closes it — rather than local-only component state.
  const readingProjectId = searchParams.get('comic');
  const previewCharId = searchParams.get('character');

  const openComicPreview = (projectId: string) => router.push(`${pathname}?comic=${encodeURIComponent(projectId)}`, { scroll: false });
  const closeComicPreview = () => router.push(pathname, { scroll: false });
  const openCharPreview = (characterId: string) => router.push(`${pathname}?character=${encodeURIComponent(characterId)}`, { scroll: false });
  const closeCharPreview = () => router.push(pathname, { scroll: false });

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
  const [addedComicIds, setAddedComicIds] = useState<Set<string>>(new Set());
  const [addingComicId, setAddingComicId] = useState<string | null>(null);

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

  const handleAddComicToLibrary = async (comic: GalleryComicSummary) => {
    if (!isAuthed || addingComicId) return;
    setAddingComicId(comic.project_id);
    try {
      const detail = await galleryApi.comicDetail(comic.project_id);
      saveStory({
        title: comic.title || comic.project_id,
        projectId: comic.project_id,
        storyText: detail.data.story_content || comic.story_synopsis,
        adaptedStory: null,
        genre: comic.genre,
        creativeDirection: '',
        analysisResult: null,
      });
      setAddedComicIds((prev) => new Set([...prev, comic.project_id]));
    } catch { /* silently ignore */ } finally { setAddingComicId(null); }
  };

  const readingComic = comics.find((c) => c.project_id === readingProjectId) ?? null;
  const previewChar = characters.find((c) => c.character_id === previewCharId) ?? null;

  return (
    <>
      {showHeading && (
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tighter text-on-surface">Community Gallery</h1>
          <p className="text-on-surface-variant mt-1">Discover comics and characters created by the community</p>
        </div>
      )}

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
                    onPreview={() => openCharPreview(char.character_id)}
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
                    onPreview={() => openComicPreview(comic.project_id)}
                    onAdd={() => handleAddComicToLibrary(comic)}
                    inLibrary={addedComicIds.has(comic.project_id)}
                    adding={addingComicId === comic.project_id}
                    isAuthed={isAuthed}
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

      {readingProjectId && (
        <ComicReaderModal
          projectId={readingProjectId}
          onClose={closeComicPreview}
          onAddToLibrary={isAuthed && readingComic ? () => handleAddComicToLibrary(readingComic) : undefined}
          addToLibraryStatus={
            readingComic
              ? addedComicIds.has(readingComic.project_id)
                ? 'added'
                : addingComicId === readingComic.project_id
                ? 'adding'
                : 'idle'
              : undefined
          }
        />
      )}

      {previewChar && (
        <CharacterPreviewModal
          char={previewChar}
          onClose={closeCharPreview}
          onAdd={() => handleAddToLibrary(previewChar)}
          inLibrary={addedIds.has(previewChar.character_id)}
          adding={addingId === previewChar.character_id}
          isAuthed={isAuthed}
        />
      )}
    </>
  );
}
