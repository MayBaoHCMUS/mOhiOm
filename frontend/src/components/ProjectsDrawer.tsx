'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FolderOpen, Plus, Trash2, AlertTriangle, X } from 'lucide-react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import { projectsApi } from '@/services/api';
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
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<CloudProjectListItem | null>(null);

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
    if (isOpen) {
      setPublishErrors({});
      setDeleteErrors({});
      setDeleteConfirmProject(null);
      fetchProjects();
    }
    // fetchProjects is intentionally omitted: it's derived from a context value
    // (listCloudProjects) that gets a new identity on every 1s context tick
    // (see ComicGenerationContext's nowMs interval), which would otherwise
    // refetch and reset scroll position every second while the drawer is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSave = async () => {
    await saveToCloud();
    await fetchProjects();
  };

  const handleTogglePublish = async (projectId: string, currentValue: boolean) => {
    if (publishingId) return;
    const next = !currentValue;

    setPublishErrors((prev) => {
      if (!(projectId in prev)) return prev;
      const { [projectId]: _removed, ...rest } = prev;
      return rest;
    });
    setProjects((prev) => prev.map((p) => (p.project_id === projectId ? { ...p, is_public: next } : p)));
    setPublishingId(projectId);

    try {
      const response = await projectsApi.publishProject(projectId, next);
      const isPublic = response.data.is_public;
      setProjects((prev) => prev.map((p) => (p.project_id === projectId ? { ...p, is_public: isPublic } : p)));
    } catch {
      setProjects((prev) => prev.map((p) => (p.project_id === projectId ? { ...p, is_public: currentValue } : p)));
      setPublishErrors((prev) => ({
        ...prev,
        [projectId]: next ? 'Could not publish to the gallery. Try again.' : 'Could not unpublish. Try again.',
      }));
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (deletingId) return;

    setDeleteErrors((prev) => {
      if (!(projectId in prev)) return prev;
      const { [projectId]: _removed, ...rest } = prev;
      return rest;
    });
    setDeletingId(projectId);

    try {
      await projectsApi.delete(projectId);
      setProjects((prev) => prev.filter((p) => p.project_id !== projectId));
      setDeleteConfirmProject(null);
    } catch {
      setDeleteErrors((prev) => ({ ...prev, [projectId]: 'Could not delete this project. Try again.' }));
    } finally {
      setDeletingId(null);
    }
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

                    {/* Share to Community Gallery */}
                    {hasStep5 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '8px 10px',
                          marginBottom: 12,
                          borderRadius: 8,
                          background: '#F9FAFB',
                          border: '1px solid #F3F4F6',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366F1' }}>
                            public
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#111827', margin: 0 }}>
                              Share to Community Gallery
                            </p>
                            <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0, marginTop: 1 }}>
                              {p.is_public ? 'Visible in the public gallery' : 'Only you can see this comic'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={publishingId === p.project_id}
                          onClick={() => handleTogglePublish(p.project_id, !!p.is_public)}
                          aria-label={p.is_public ? 'Unpublish from Community Gallery' : 'Publish to Community Gallery'}
                          style={{
                            position: 'relative',
                            width: 36,
                            height: 20,
                            borderRadius: 10,
                            border: 'none',
                            flexShrink: 0,
                            background: p.is_public ? '#6366F1' : '#E5E7EB',
                            cursor: publishingId === p.project_id ? 'not-allowed' : 'pointer',
                            opacity: publishingId === p.project_id ? 0.6 : 1,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: p.is_public ? 18 : 2,
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: '#FFFFFF',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                              transition: 'left 0.15s ease',
                            }}
                          />
                        </button>
                      </div>
                    )}
                    {publishErrors[p.project_id] && (
                      <p style={{ fontSize: 10, color: '#DC2626', margin: 0, marginTop: -8, marginBottom: 10 }}>
                        {publishErrors[p.project_id]}
                      </p>
                    )}
                    {deleteErrors[p.project_id] && (
                      <p style={{ fontSize: 10, color: '#DC2626', margin: 0, marginTop: -8, marginBottom: 10 }}>
                        {deleteErrors[p.project_id]}
                      </p>
                    )}

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

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmProject(p)}
                        disabled={deletingId === p.project_id}
                        aria-label="Delete project"
                        title="Delete project"
                        style={{
                          marginLeft: 'auto',
                          width: 34,
                          height: 34,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          border: 'none',
                          background: 'transparent',
                          color: '#9CA3AF',
                          cursor: deletingId === p.project_id ? 'not-allowed' : 'pointer',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          if (deletingId === p.project_id) return;
                          const b = e.currentTarget as HTMLButtonElement;
                          b.style.color = '#DC2626';
                          b.style.background = '#FEF2F2';
                        }}
                        onMouseLeave={(e) => {
                          const b = e.currentTarget as HTMLButtonElement;
                          b.style.color = '#9CA3AF';
                          b.style.background = 'transparent';
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
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

      {deleteConfirmProject && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45"
          onClick={() => { if (!deletingId) setDeleteConfirmProject(null); }}
        >
          <div
            style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 28, width: 400, maxWidth: 'calc(100vw - 32px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12, background: '#FEE2E2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <AlertTriangle size={20} color="#DC2626" />
              </span>
              <div>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>Delete this project?</p>
                <p style={{ fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 1.5 }}>
                  <strong style={{ color: '#111827' }}>{formatProjectTitle(deleteConfirmProject.project_id)}</strong> and all its panels, characters, and images will be permanently deleted. This cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmProject(null)}
                disabled={deletingId === deleteConfirmProject.project_id}
                aria-label="Close"
                style={{
                  marginLeft: 'auto', width: 26, height: 26, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {deleteErrors[deleteConfirmProject.project_id] && (
              <p style={{ fontSize: 12, color: '#DC2626', marginTop: -8, marginBottom: 14 }}>
                {deleteErrors[deleteConfirmProject.project_id]}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmProject(null)}
                disabled={deletingId === deleteConfirmProject.project_id}
                style={{
                  flex: 1, height: 42, borderRadius: 9, fontSize: 14, fontWeight: 500,
                  background: '#FFFFFF', border: '1.5px solid #E5E7EB', color: '#6B7280',
                  cursor: deletingId === deleteConfirmProject.project_id ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmProject.project_id)}
                disabled={deletingId === deleteConfirmProject.project_id}
                style={{
                  flex: 1, height: 42, borderRadius: 9, fontSize: 14, fontWeight: 600,
                  background: '#DC2626', color: '#FFFFFF', border: 'none',
                  cursor: deletingId === deleteConfirmProject.project_id ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: deletingId === deleteConfirmProject.project_id ? 0.75 : 1,
                }}
              >
                {deletingId === deleteConfirmProject.project_id && (
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full" />
                )}
                {deletingId === deleteConfirmProject.project_id ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
