'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { galleryApi, projectsApi } from '@/services/api';
import type { CharacterSummary, GalleryComicSummary } from '@/services/api';
import ComicReaderModal from '@/components/ComicReaderModal';
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

function CharacterPreviewModal({
  char,
  onClose,
  onAdd,
  inLibrary,
  adding,
  isAuthed,
}: {
  char: CharacterSummary;
  onClose: () => void;
  onAdd: () => void;
  inLibrary: boolean;
  adding: boolean;
  isAuthed: boolean;
}) {
  // Trait tags parsed from the same prompt string — rendering only, data source unchanged.
  const traits = (char.prompt ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const sourceLabel = char.project_id ? char.project_id.replace(/_/g, ' ') : 'Community';

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ maxWidth: 300, borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', background: '#FFFFFF' }}
      >
        {/* Image area — ~60% of modal height */}
        <div className="relative w-full aspect-[3/4] bg-surface-container-high overflow-hidden">
          {char.selected_image_url ? (
            <img src={char.selected_image_url} alt={char.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-7xl text-outline-variant">person</span>
            </div>
          )}

          {/* Gradient bridge from image into the content area — dark enough to stay legible over any artwork */}
          <div
            className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.85) 100%)' }}
          />

          {/* Name + source badge, overlaid on the image — kept clear of the content panel's overlap below */}
          <div className="absolute left-3 right-12 bottom-6 flex flex-col gap-1">
            <p
              className="truncate"
              style={{ fontSize: 17, fontWeight: 700, color: '#FFFFFF', textShadow: '0 1px 4px rgba(0,0,0,0.4)', lineHeight: 1.2 }}
            >
              {char.name}
            </p>
            <span
              className="self-start"
              style={{ fontSize: 10, color: '#FFFFFF', background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '2px 8px' }}
            >
              {sourceLabel}
            </span>
          </div>

          {/* Close button — 44x44 touch target, floats above the image */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close character preview"
            className="absolute flex items-center justify-center transition-colors hover:bg-black/60"
            style={{
              top: 8, right: 8, width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              zIndex: 10,
            }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Content area — overlaps the image slightly so the gradient is the only seam */}
        <div
          className="relative bg-surface-container-lowest flex flex-col gap-3"
          style={{
            marginTop: -8,
            borderRadius: '20px 20px 0 0',
            padding: '14px 16px',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}
        >
          {/* Trait chip tags (parsed from char.prompt) */}
          {traits.length > 0 && (
            <div className="flex flex-wrap" style={{ gap: 5 }}>
              {traits.map((trait, i) => (
                <span
                  key={`${trait}-${i}`}
                  className="inline-flex"
                  style={{ background: '#F0F0F5', color: '#333', borderRadius: 999, padding: '3px 10px', fontSize: 12 }}
                >
                  {trait}
                </span>
              ))}
            </div>
          )}

          {/* Primary CTA — same handler and states as before */}
          {isAuthed ? (
            <button
              type="button"
              onClick={onAdd}
              disabled={inLibrary || adding}
              aria-label={inLibrary ? 'Already in your library' : 'Add to My Library'}
              className={`w-full transition-colors ${
                inLibrary
                  ? 'bg-emerald-100 text-emerald-700 cursor-default'
                  : adding
                  ? 'bg-surface-container text-outline cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:opacity-90'
              }`}
              style={{ height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600 }}
            >
              {inLibrary ? '✓ In Library' : adding ? 'Adding…' : 'Add to My Library'}
            </button>
          ) : (
            <Link
              href="/login"
              className="w-full flex items-center justify-center text-center text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors"
              style={{ height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600 }}
            >
              Sign in to save
            </Link>
          )}
        </div>
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

  // Characters
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [charsLoading, setCharsLoading] = useState(false);
  const [charsHasMore, setCharsHasMore] = useState(false);
  const [charsLoadingMore, setCharsLoadingMore] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [previewChar, setPreviewChar] = useState<CharacterSummary | null>(null);

  // Comics
  const [comics, setComics] = useState<GalleryComicSummary[]>([]);
  const [comicsLoading, setComicsLoading] = useState(false);
  const [comicsHasMore, setComicsHasMore] = useState(false);
  const [comicsLoadingMore, setComicsLoadingMore] = useState(false);
  const [readingProjectId, setReadingProjectId] = useState<string | null>(null);
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
                    onPreview={() => setPreviewChar(char)}
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
                    onPreview={() => setReadingProjectId(comic.project_id)}
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
          onClose={() => setReadingProjectId(null)}
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
          onClose={() => setPreviewChar(null)}
          onAdd={() => handleAddToLibrary(previewChar)}
          inLibrary={addedIds.has(previewChar.character_id)}
          adding={addingId === previewChar.character_id}
          isAuthed={isAuthed}
        />
      )}
    </>
  );
}
