'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { useStoryLibrary } from '@/hooks/useStoryLibrary';
import type { SavedStory } from '@/hooks/useStoryLibrary';

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
const STORY_ACCENT_COLORS = [
  '#7C3AED', '#0891B2', '#059669', '#DC2626',
  '#D97706', '#2563EB', '#DB2777', '#65A30D',
];
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
const storyGradient = (id: string) => STORY_GRADIENTS[hashId(id) % STORY_GRADIENTS.length];
const storyAccent   = (id: string) => STORY_ACCENT_COLORS[hashId(id) % STORY_ACCENT_COLORS.length];

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
              const accent = storyAccent(story.id);
              return (
                <div
                  key={story.id}
                  className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all"
                >
                  {/* Gradient thumbnail */}
                  <div className={`relative h-[72px] bg-gradient-to-br ${grad} flex flex-col justify-between p-3`}>
                    {genre && (
                      <span className="self-start text-[9px] font-bold uppercase tracking-[0.06em] text-white bg-black/30 rounded px-1.5 py-0.5">
                        {genre}
                      </span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.90)', textShadow: '0 1px 3px rgba(0,0,0,0.30)', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {story.title || 'Untitled'}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3 flex flex-col gap-2" style={{ borderLeft: `4px solid ${accent}` }}>
                    {/* Title + word count */}
                    <div>
                      <p className="text-[13px] font-bold text-on-surface truncate">{story.title || 'Untitled'}</p>
                      <p className="text-[11px] text-on-surface-variant"
                        title={new Date(story.savedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}>
                        {[genre && `${wc.toLocaleString()} words`, `Last saved ${formatRelativeDate(story.savedAt)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>

                    {/* Story excerpt */}
                    <p className="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed">
                      {(story.adaptedStory ?? story.storyText).slice(0, 150)}…
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleLoadInSetup(story)}
                        className="flex-1 h-9 rounded-xl border-[1.5px] border-primary text-primary text-[13px] font-semibold hover:bg-primary/5 transition-colors"
                      >
                        Load in Setup
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicate(story.id)}
                        title="Duplicate"
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(story)}
                        title="Delete"
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container text-error hover:bg-error/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
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
    </div>
  );
}