'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import { projectsApi } from '@/services/api';
import type { CloudProjectListItem } from '@/services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const StepBadge = ({ label, active }: { label: string; active: boolean }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      active ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-400'
    }`}
  >
    {label}
  </span>
);

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default function ProjectsDrawer({ isOpen, onClose }: Props) {
  const {
    step3,
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsFetching(true);
    try {
      const list = await listCloudProjects();
      setProjects(list);
    } catch {
      // silently ignore list failures
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

  const handlePublish = async (projectId: string, isPublic: boolean) => {
    setPublishingId(projectId);
    // Optimistic update
    setProjects((prev) => prev.map((p) => p.project_id === projectId ? { ...p, is_public: isPublic } : p));
    try {
      await projectsApi.publishProject(projectId, isPublic);
    } catch {
      // Revert on error
      setProjects((prev) => prev.map((p) => p.project_id === projectId ? { ...p, is_public: !isPublic } : p));
    } finally {
      setPublishingId(null);
    }
  };

  const canSave = !!step3.data;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold">My Projects</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-gray-600">close</span>
          </button>
        </div>

        {/* Save current project */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Save current project</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {canSave
                  ? 'Steps 1–3 complete — ready to save.'
                  : 'Complete at least step 3 to save.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || cloudSaveStatus === 'saving'}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-transform flex-shrink-0 ${
                !canSave || cloudSaveStatus === 'saving'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : cloudSaveStatus === 'saved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-900 text-white hover:scale-105'
              }`}
            >
              {cloudSaveStatus === 'saving' ? 'Saving…' : cloudSaveStatus === 'saved' ? 'Saved!' : 'Save'}
            </button>
          </div>
          {cloudSaveError ? (
            <p className="mt-2 text-xs text-red-600">{cloudSaveError}</p>
          ) : null}
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadError ? (
            <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
          ) : null}

          {isFetching ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-300">folder_open</span>
              <p className="mt-3 text-sm text-gray-500">No saved projects yet.</p>
              <p className="text-xs text-gray-400 mt-1">Save a project above to see it here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div key={p.project_id} className="rounded-2xl bg-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-gray-900 truncate">{p.project_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDate(p.saved_at)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <StepBadge label="S1" active={p.has_step1} />
                        <StepBadge label="S2" active={p.has_step2} />
                        <StepBadge label="Img" active={p.has_step2_images} />
                        <StepBadge label="S3" active={p.has_step3} />
                        <StepBadge label="S4" active={p.has_step4} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                      {deleteConfirmId === p.project_id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-200 text-gray-700 hover:scale-105 transition-transform"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLoad(p.project_id)}
                          disabled={loadingId === p.project_id}
                          className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-transform ${
                            loadingId === p.project_id
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-900 text-white hover:scale-105'
                          }`}
                        >
                          {loadingId === p.project_id ? 'Loading…' : 'Load'}
                        </button>
                      )}
                      {p.has_step4 && (
                        <button
                          type="button"
                          title={p.is_public ? 'Remove from Gallery' : 'Publish to Gallery'}
                          disabled={publishingId === p.project_id}
                          onClick={() => handlePublish(p.project_id, !p.is_public)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                            p.is_public
                              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          } ${publishingId === p.project_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Globe size={11} />
                          {p.is_public ? 'Published' : 'Publish'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
