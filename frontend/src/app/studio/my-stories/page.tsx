'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { useStoryLibrary } from '@/hooks/useStoryLibrary';
import type { SavedStory } from '@/hooks/useStoryLibrary';
import { projectsApi } from '@/services/api';
import type { CloudProjectListItem } from '@/services/api';
import ComicReaderModal from '@/components/ComicReaderModal';

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const STORY_GRADIENTS = [
  'from-violet-900 via-purple-800 to-indigo-900',
  'from-slate-900 via-blue-900 to-cyan-900',
  'from-rose-900 via-pink-800 to-fuchsia-900',
  'from-amber-900 via-orange-800 to-red-900',
  'from-emerald-900 via-teal-800 to-cyan-900',
  'from-indigo-900 via-violet-800 to-purple-900',
];
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
const storyGradient = (id: string) => STORY_GRADIENTS[hashId(id) % STORY_GRADIENTS.length];

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1)   return 'just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7)   return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export default function MyStoriesPage() {
  const router = useRouter();
  const { stories, remove, duplicate } = useStoryLibrary();
  const [confirmDelete, setConfirmDelete] = useState<SavedStory | null>(null);
  const [search, setSearch] = useState('');
  const [cloudProjects, setCloudProjects] = useState<Record<string, CloudProjectListItem>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<Record<string, string>>({});
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    projectsApi.list()
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, CloudProjectListItem> = {};
        for (const p of res.data) map[p.project_id] = p;
        setCloudProjects(map);
      })
      .catch(() => { /* gallery-sharing status is best-effort */ });
    return () => { cancelled = true; };
  }, []);

  const handleTogglePublish = async (story: SavedStory) => {
    const cloud = cloudProjects[story.projectId];
    if (!cloud?.is_publishable || publishingId) return;
    const next = !cloud.is_public;

    setPublishErrors((prev) => {
      if (!(story.projectId in prev)) return prev;
      const { [story.projectId]: _removed, ...rest } = prev;
      return rest;
    });
    setCloudProjects((prev) => ({ ...prev, [story.projectId]: { ...prev[story.projectId], is_public: next } }));
    setPublishingId(story.projectId);

    try {
      const response = await projectsApi.publishProject(story.projectId, next);
      setCloudProjects((prev) => ({
        ...prev,
        [story.projectId]: { ...prev[story.projectId], is_public: response.data.is_public },
      }));
    } catch {
      setCloudProjects((prev) => ({ ...prev, [story.projectId]: { ...prev[story.projectId], is_public: !next } }));
      setPublishErrors((prev) => ({
        ...prev,
        [story.projectId]: next ? 'Could not publish to the gallery. Try again.' : 'Could not unpublish. Try again.',
      }));
    } finally {
      setPublishingId(null);
    }
  };

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

      <main className="ml-[var(--studio-sidebar-width)] pt-24 min-h-screen flex flex-col">

        {/* Page header band */}
        <div style={{ background: '#F8FAFF', borderBottom: '1px solid #E5E7EB', padding: '28px 32px 24px 32px', flexShrink: 0 }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4, lineHeight: 1.2 }}>My Stories</h1>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                {stories.length} saved stor{stories.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
            <Link
              href="/studio/story-setup"
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-on-primary text-sm font-bold hover:opacity-90 shrink-0"
            >
              <span className="material-symbols-outlined text-base">add</span>
              New Story
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8 pb-16 flex-1">

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {filtered.map((story) => {
              const wc = wordCount(story.adaptedStory ?? story.storyText);
              const genre = story.genre?.split('/')[0].split(',')[0].trim();
              const grad = storyGradient(story.id);
              return (
                <div
                  key={story.id}
                  className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:translate-y-[-2px] transition-all"
                >
                  {/* Gradient header — title, genre pill, and metadata live here (single source of truth for the title) */}
                  <div className={`relative bg-gradient-to-br ${grad} px-4 pt-3 pb-8 flex flex-col gap-2`}>
                    {genre && (
                      <span className="self-start text-[9px] font-bold uppercase tracking-[0.06em] text-white bg-black/30 rounded-full px-2.5 py-1">
                        {genre}
                      </span>
                    )}
                    <div>
                      <p
                        className="truncate"
                        style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', textShadow: '0 1px 3px rgba(0,0,0,0.30)', lineHeight: 1.2 }}
                      >
                        {story.title || 'Untitled'}
                      </p>
                      <p
                        style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}
                        title={new Date(story.savedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      >
                        {[genre && `${wc.toLocaleString()} words`, `Last saved ${formatRelativeDate(story.savedAt)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  {/* Content body — rounded top overlaps the header slightly so the two blend instead of cutting hard */}
                  <div className="relative -mt-4 rounded-t-2xl bg-surface-container-lowest" style={{ padding: '12px 16px' }}>
                    {/* Story excerpt */}
                    <p
                      className="line-clamp-2 leading-relaxed"
                      style={{ fontSize: 14, color: '#444', marginBottom: 8 }}
                    >
                      {(story.adaptedStory ?? story.storyText).slice(0, 150)}…
                    </p>

                    {/* Action bar */}
                    {(() => {
                      const cloud = cloudProjects[story.projectId];
                      const isPublishable = !!cloud?.is_publishable;
                      const isPublished = !!cloud?.is_public;
                      const isPublishing = publishingId === story.projectId;
                      const shareTitle = !isPublishable
                        ? 'Finish generating at least one comic page image before sharing to the gallery'
                        : isPublished
                        ? 'Published — View in Gallery'
                        : 'Publish / View in Gallery';
                      const error = publishErrors[story.projectId];
                      return (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleLoadInSetup(story)}
                            className="w-full h-11 rounded-[10px] bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-opacity"
                          >
                            Load in Setup
                          </button>

                          <div className="flex items-center justify-end gap-1.5">
                            {isPublished && !error && (
                              <span className="flex items-center gap-1 mr-1 text-[11px] font-semibold text-emerald-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Published
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreviewProjectId(story.projectId)}
                              disabled={!isPublishable}
                              title={isPublishable ? 'Preview Comic' : 'Generate comic images in Setup to preview'}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors ${
                                !isPublishable ? 'opacity-40 cursor-not-allowed' : ''
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePublish(story)}
                              disabled={!isPublishable || isPublishing}
                              title={shareTitle}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                isPublished
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-on-surface-variant hover:bg-surface-container-high'
                              } ${!isPublishable ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              <span className={`material-symbols-outlined text-[18px] ${isPublishing ? 'animate-spin' : ''}`}>
                                {isPublishing ? 'progress_activity' : isPublished ? 'public' : 'share'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicate(story.id)}
                              title="Duplicate Story"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">content_copy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(story)}
                              title="Delete Story"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>

                          {error && <p className="text-[11px] text-error text-right">{error}</p>}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>{/* /content */}
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

      {/* Comic preview modal */}
      {previewProjectId && (
        <ComicReaderModal
          projectId={previewProjectId}
          mode="owned"
          onClose={() => setPreviewProjectId(null)}
        />
      )}
    </div>
  );
}