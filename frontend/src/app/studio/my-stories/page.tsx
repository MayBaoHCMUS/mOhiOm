'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { useStoryLibrary } from '@/hooks/useStoryLibrary';
import type { SavedStory } from '@/hooks/useStoryLibrary';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function MyStoriesPage() {
  const router = useRouter();
  const { stories, remove, duplicate } = useStoryLibrary();
  const [confirmDelete, setConfirmDelete] = useState<SavedStory | null>(null);
  const [search, setSearch] = useState('');

  const filtered = stories.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.genre.toLowerCase().includes(q) ||
      s.storyText.toLowerCase().includes(q)
    );
  });

  const handleLoadInSetup = (story: SavedStory) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'mohiom-story-setup-load',
        JSON.stringify({ storyId: story.id })
      );
    }
    router.push('/studio/story-setup');
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="pt-24 pb-16 px-8 max-w-[1400px] mx-auto ml-[var(--studio-sidebar-width)]">
      <div className="max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-on-surface">My Stories</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {stories.length} saved stor{stories.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
          <Link
            href="/studio/story-setup"
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-on-primary text-sm font-bold hover:opacity-90"
          >
            <span className="material-symbols-outlined text-base">add</span>
            New Story
          </Link>
        </div>

        {/* Search */}
        {stories.length > 0 && (
          <div className="relative mb-6">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stories…"
              className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-low pl-11 pr-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}

        {/* Empty state */}
        {stories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <span className="material-symbols-outlined text-7xl text-on-surface-variant/30">auto_stories</span>
            <div>
              <p className="text-lg font-semibold text-on-surface-variant">No saved stories yet</p>
              <p className="text-sm text-on-surface-variant/70 mt-1">
                Save a story from Story Setup using the &ldquo;More&rdquo; menu.
              </p>
            </div>
            <Link
              href="/studio/story-setup"
              className="px-6 py-3 rounded-2xl bg-primary text-on-primary text-sm font-bold hover:opacity-90"
            >
              Go to Story Setup
            </Link>
          </div>
        )}

        {/* No search results */}
        {stories.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">search_off</span>
            <p className="text-on-surface-variant font-medium">No stories match &ldquo;{search}&rdquo;</p>
            <button type="button" onClick={() => setSearch('')} className="text-sm text-primary hover:underline">
              Clear search
            </button>
          </div>
        )}

        {/* Story grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((story) => {
              const wc = wordCount(story.adaptedStory ?? story.storyText);
              return (
                <div
                  key={story.id}
                  className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-on-surface truncate">{story.title || 'Untitled'}</p>
                      {story.genre && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                          {story.genre}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                    {(story.adaptedStory ?? story.storyText).slice(0, 200)}…
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant/70 mt-auto pt-2 border-t border-outline-variant/10">
                    <span>{wc.toLocaleString()} words</span>
                    <span>{formatDate(story.savedAt)}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadInSetup(story)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:opacity-90"
                    >
                      Load in Setup
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicate(story.id)}
                      title="Duplicate"
                      className="px-3 py-2 rounded-xl text-xs bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(story)}
                      title="Delete"
                      className="px-3 py-2 rounded-xl text-xs bg-surface-container-high text-error hover:bg-error/10"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </main>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
            <p className="font-bold text-on-surface">Delete &ldquo;{confirmDelete.title}&rdquo;?</p>
            <p className="text-sm text-on-surface-variant">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { remove(confirmDelete.id); setConfirmDelete(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-error text-on-error hover:opacity-90"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}