'use client';

import { useEffect, useState } from 'react';
import { galleryApi, projectsApi } from '@/services/api';
import type { GalleryComicDetail, FullProjectSave } from '@/services/api';

interface Props {
  projectId: string;
  onClose: () => void;
  /** 'public' reads the published gallery record; 'owned' reads the signed-in user's
   * own project (published or not) so drafts can be previewed before sharing. */
  mode?: 'public' | 'owned';
  /** When provided, shows an "Add to My Stories" action in the top bar so a reader
   * can save this comic to their own library right from the preview. */
  onAddToLibrary?: () => void;
  addToLibraryStatus?: 'idle' | 'adding' | 'added';
}

function extractOwnedComicDetail(project: FullProjectSave): GalleryComicDetail {
  const steps = project.steps as { step4?: { data?: { pageStates?: Record<string, { status?: string; imageUrl?: string | null }> } } };
  const pageStates = steps?.step4?.data?.pageStates ?? {};
  const pages = Object.keys(pageStates)
    .sort()
    .map((key) => {
      const state = pageStates[key];
      if (state?.status !== 'success' || !state?.imageUrl) return null;
      const pageNumber = parseInt(key.replace('page-', ''), 10) || 0;
      return { page_number: pageNumber, image_url: state.imageUrl as string };
    })
    .filter((p): p is { page_number: number; image_url: string } => p !== null);

  const userInputs = project.user_inputs as Record<string, unknown>;
  const story = (userInputs.story_content as string) || (userInputs.storyText as string) || '';
  const title = story.trim().split('\n')[0]?.slice(0, 80) || 'Untitled';

  return {
    project_id: project.project_id,
    title,
    genre: (userInputs.manga_genre as string) || (userInputs.genre as string) || '',
    art_style: (userInputs.art_style as string) || '',
    story_content: story,
    main_characters: (userInputs.main_characters as string) || (userInputs.mainCharacters as string) || '',
    pages,
  };
}

export default function ComicReaderModal({ projectId, onClose, mode = 'public', onAddToLibrary, addToLibraryStatus = 'idle' }: Props) {
  const [comic, setComic] = useState<GalleryComicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 0 = story info screen, 1+ = page index
  const [screen, setScreen] = useState(0);
  const [showStory, setShowStory] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setScreen(0);
    setShowStory(false);
    const request = mode === 'owned'
      ? projectsApi.load(projectId).then((r) => extractOwnedComicDetail(r.data))
      : galleryApi.comicDetail(projectId).then((r) => r.data);
    request
      .then((data) => setComic(data))
      .catch(() => setError('Failed to load comic.'))
      .finally(() => setLoading(false));
  }, [projectId, mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!comic) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setScreen((s) => Math.min(s + 1, comic.pages.length));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setScreen((s) => Math.max(s - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [comic, onClose]);

  const totalScreens = comic ? comic.pages.length + 1 : 1;
  const isStoryScreen = screen === 0;
  const currentPage = comic && !isStoryScreen ? comic.pages[screen - 1] : null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-black/80 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-white text-lg">close</span>
          </button>
          {comic && (
            <div>
              <p className="text-white font-bold text-sm leading-tight">{comic.title}</p>
              <p className="text-white/50 text-[11px]">{comic.genre}{comic.art_style ? ` · ${comic.art_style}` : ''}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onAddToLibrary && (
            <button
              type="button"
              onClick={onAddToLibrary}
              disabled={addToLibraryStatus !== 'idle'}
              title="Add to My Stories"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                addToLibraryStatus === 'added'
                  ? 'bg-emerald-500/90 text-white cursor-default'
                  : addToLibraryStatus === 'adding'
                  ? 'bg-white/10 text-white/50 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {addToLibraryStatus === 'added' ? '✓ Added' : addToLibraryStatus === 'adding' ? 'Adding…' : 'Add to My Stories'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowStory((v) => !v)}
            title="Toggle story info"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              showStory ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Story
          </button>
          {comic && (
            <span className="text-white/50 text-xs tabular-nums">
              {isStoryScreen ? 'Info' : `${screen} / ${comic.pages.length}`}
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <span className="material-symbols-outlined text-5xl text-white/30">error</span>
            <p className="text-white/60 text-sm">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20"
            >
              Close
            </button>
          </div>
        )}

        {comic && (
          <>
            {/* Story info overlay */}
            {showStory && (
              <div className="absolute inset-0 z-10 bg-black/90 overflow-y-auto p-8 max-w-2xl mx-auto">
                <h2 className="text-white text-2xl font-bold mb-2">{comic.title}</h2>
                <div className="flex gap-2 mb-6 flex-wrap">
                  {comic.genre && <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">{comic.genre}</span>}
                  {comic.art_style && <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">{comic.art_style}</span>}
                </div>
                {comic.main_characters && (
                  <div className="mb-5">
                    <p className="text-white/50 text-xs uppercase tracking-widest font-bold mb-2">Characters</p>
                    <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{comic.main_characters}</p>
                  </div>
                )}
                {comic.story_content && (
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-widest font-bold mb-2">Story</p>
                    <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{comic.story_content}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowStory(false)}
                  className="mt-8 px-5 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20"
                >
                  Close
                </button>
              </div>
            )}

            {/* Story info screen (screen 0) */}
            {isStoryScreen && !showStory && (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-6">
                <div className="max-w-lg">
                  <h2 className="text-white text-3xl font-bold mb-3">{comic.title}</h2>
                  <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
                    {comic.genre && <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">{comic.genre}</span>}
                    {comic.art_style && <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">{comic.art_style}</span>}
                    <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">{comic.pages.length} pages</span>
                  </div>
                  {comic.story_content && (
                    <p className="text-white/60 text-sm leading-relaxed line-clamp-4">{comic.story_content.slice(0, 300)}{comic.story_content.length > 300 ? '…' : ''}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setScreen(1)}
                  className="px-8 py-3 rounded-full bg-white text-black font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  Start Reading
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </div>
            )}

            {/* Comic page */}
            {currentPage && !showStory && (
              <div className="flex items-center justify-center h-full">
                <img
                  src={currentPage.image_url}
                  alt={`Page ${currentPage.page_number}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      {comic && (
        <>
          <button
            type="button"
            onClick={() => setScreen((s) => Math.max(s - 1, 0))}
            disabled={screen === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 disabled:opacity-20 flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-white text-2xl">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={() => setScreen((s) => Math.min(s + 1, totalScreens - 1))}
            disabled={screen === totalScreens - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 disabled:opacity-20 flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-white text-2xl">chevron_right</span>
          </button>

          {/* Page dots */}
          {comic.pages.length <= 12 && (
            <div className="flex items-center justify-center gap-1.5 py-3 bg-black/50 flex-shrink-0">
              <button
                type="button"
                onClick={() => setScreen(0)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${screen === 0 ? 'bg-white w-4' : 'bg-white/30'}`}
              />
              {comic.pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScreen(i + 1)}
                  className={`h-1.5 rounded-full transition-all ${screen === i + 1 ? 'bg-white w-4' : 'bg-white/30 w-1.5'}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
