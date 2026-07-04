'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FolderOpen, Plus } from 'lucide-react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { CloudProjectListItem } from '@/services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Step badge mapping: backend field → 1-indexed display label
const PIPELINE_STEP_BADGES: Array<{
  label: string;
  title: string;
  key: keyof CloudProjectListItem;
}> = [
  { label: 'S1', title: 'Story Setup',           key: 'has_step1' },
  { label: 'S2', title: 'Story Breakdown',        key: 'has_step2' },
  { label: 'S3', title: 'Designs & References',   key: 'has_step2_images' },
  { label: 'S4', title: 'Panel Script',           key: 'has_step3' },
  { label: 'S5', title: 'Image Generation',       key: 'has_step4' },
];

const PROJECT_COLORS = [
  '#7C3AED', '#0891B2', '#059669', '#DC2626',
  '#D97706', '#2563EB', '#DB2777', '#65A30D',
];

const getProjectColor = (id: string): string => {
  const idx = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % PROJECT_COLORS.length;
  return PROJECT_COLORS[idx];
};

const formatProjectTitle = (slug: string): string =>
  slug.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatProjectDate = (iso: string): string => {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1)   return 'Just now';
    if (diffMins < 60)  return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7)   return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return iso;
  }
};

const fullTimestamp = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

type SortKey = 'recent' | 'name' | 'steps';

const sortProjects = (list: CloudProjectListItem[], key: SortKey): CloudProjectListItem[] => {
  const copy = [...list];
  if (key === 'recent') return copy.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  if (key === 'name')   return copy.sort((a, b) => formatProjectTitle(a.project_id).localeCompare(formatProjectTitle(b.project_id)));
  if (key === 'steps') {
    const count = (p: CloudProjectListItem) =>
      PIPELINE_STEP_BADGES.filter(({ key: k }) => !!p[k]).length;
    return copy.sort((a, b) => count(b) - count(a));
  }
  return copy;
};

export default function ProjectsDrawer({ isOpen, onClose }: Props) {
  const router = useRouter();
  const {
    cloudSaveStatus,
    cloudSaveError,
    saveToCloud,
    loadFromCloud,
    listCloudProjects,
  } = useComicGeneration();

  const [projects, setProjects] = useState<CloudProjectListItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('recent');

  const sorted = useMemo(() => sortProjects(projects, sortKey), [projects, sortKey]);

  const fetchProjects = useCallback(async () => {
    setIsFetching(true);
    try {
      const list = await listCloudProjects();
      setProjects(list);
    } catch {
      // silently ignore
    } finally {
      setIsFetching(false);
    }
  }, [listCloudProjects]);

  useEffect(() => {
    if (isOpen) fetchProjects();
  }, [isOpen, fetchProjects]);

  const handleSave = async () => {
    await saveToCloud();
    await fetchProjects();
  };

  const handleLoad = async (projectId: string) => {
    setLoadingId(projectId);
    setLoadError(null);
    const result = await loadFromCloud(projectId);
    setLoadingId(null);
    if (result.success) {
      onClose();
    } else {
      setLoadError(result.error ?? 'Load failed.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div
        style={{ minWidth: 440, maxWidth: 520, width: '90vw' }}
        className="fixed right-0 top-0 h-full bg-white z-50 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>My Projects</h2>
          <div className="flex items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              style={{
                height: 30,
                padding: '0 8px',
                border: '1px solid #E5E7EB',
                borderRadius: 6,
                fontSize: 12,
                color: '#374151',
                background: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <option value="recent">Recent</option>
              <option value="name">Name A–Z</option>
              <option value="steps">Most complete</option>
            </select>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-gray-600 text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Save current project */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0, marginBottom: 2 }}>
                Save current project
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                Save your current pipeline progress.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={cloudSaveStatus === 'saving'}
              style={{
                height: 36,
                padding: '0 20px',
                background: cloudSaveStatus === 'saved' ? '#D1FAE5' : '#2563EB',
                color: cloudSaveStatus === 'saved' ? '#065F46' : '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: cloudSaveStatus === 'saving' ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                opacity: cloudSaveStatus === 'saving' ? 0.6 : 1,
              }}
            >
              {cloudSaveStatus === 'saving' ? 'Saving…' : cloudSaveStatus === 'saved' ? 'Saved!' : 'Save'}
            </button>
          </div>
          {cloudSaveError ? (
            <p className="mt-2 text-xs text-red-600">{cloudSaveError}</p>
          ) : null}
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadError ? (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
          ) : null}

          {isFetching ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
          ) : sorted.length === 0 ? (
            /* Empty state */
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <FolderOpen size={36} color="#D1D5DB" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', margin: 0, marginBottom: 6 }}>
                No projects yet
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                Start a new project to begin creating your comic.
              </p>
              <button
                type="button"
                onClick={() => { onClose(); router.push('/studio'); }}
                style={{
                  marginTop: 20,
                  height: 40,
                  padding: '0 24px',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={15} />
                Start new project
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sorted.map((p) => {
                const color = getProjectColor(p.project_id);
                const isLoading = loadingId === p.project_id;
                const hasStep5 = !!p.has_step4;

                return (
                  <div
                    key={p.project_id}
                    style={{
                      border: '1px solid #E5E7EB',
                      borderLeft: `4px solid ${color}`,
                      borderRadius: 10,
                      padding: '14px 16px',
                      background: `color-mix(in srgb, ${color} 3%, #FFFFFF)`,
                    }}
                  >
                    {/* Title + slug */}
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 1 }}>
                      {formatProjectTitle(p.project_id)}
                    </p>
                    <p style={{ fontSize: 10, color: '#D1D5DB', fontFamily: 'monospace', letterSpacing: '0.02em', margin: 0, marginBottom: 8 }}>
                      {p.project_id}
                    </p>

                    {/* Date + genre */}
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 8 }}>
                      <span
                        style={{ fontSize: 12, color: '#9CA3AF' }}
                        title={fullTimestamp(p.saved_at)}
                      >
                        Last saved {formatProjectDate(p.saved_at)}
                      </span>
                      {p.genre && (
                        <>
                          <span style={{ color: '#D1D5DB', fontSize: 11 }}>·</span>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{p.genre}</span>
                        </>
                      )}
                    </div>

                    {/* Step badges S1–S5 */}
                    <div className="flex items-center gap-1" style={{ marginBottom: 12 }}>
                      {PIPELINE_STEP_BADGES.map(({ label, title, key }) => {
                        const isComplete = !!p[key];
                        return (
                          <span
                            key={label}
                            title={`Step ${label.slice(1)}: ${title}${isComplete ? ' ✓' : ''}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 28,
                              height: 22,
                              borderRadius: 11,
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                              ...(isComplete
                                ? { background: '#DCFCE7', color: '#16A34A', border: 'none' }
                                : { background: 'transparent', color: '#D1D5DB', border: '1.5px solid #E5E7EB' }),
                            }}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleLoad(p.project_id)}
                        disabled={isLoading}
                        style={{
                          height: 34,
                          padding: '0 16px',
                          background: '#FFFFFF',
                          color: isLoading ? '#9CA3AF' : '#2563EB',
                          border: `1.5px solid ${isLoading ? '#E5E7EB' : '#2563EB'}`,
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
                      >
                        {isLoading
                          ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full" />Opening…</>
                          : 'Open Project'
                        }
                      </button>

                      {hasStep5 && (
                        <Link
                          href={`/studio/publish?project=${encodeURIComponent(p.project_id)}`}
                          onClick={onClose}
                          style={{
                            fontSize: 12,
                            color: '#2563EB',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
                        >
                          <ExternalLink size={11} />
                          Publish →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Start new project */}
              <button
                type="button"
                onClick={() => { onClose(); router.push('/studio'); }}
                style={{
                  width: '100%',
                  height: 44,
                  background: 'transparent',
                  border: '1.5px dashed #D1D5DB',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: '#6B7280',
                  cursor: 'pointer',
                  marginTop: 4,
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.borderColor = '#2563EB';
                  btn.style.color = '#2563EB';
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.borderColor = '#D1D5DB';
                  btn.style.color = '#6B7280';
                }}
              >
                <Plus size={15} />
                Start new project
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
