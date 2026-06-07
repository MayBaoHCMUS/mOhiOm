'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import ImageGenModePanel from '@/components/studio-steps/ImageGenModePanel';
import ProjectsDrawer from '@/components/ProjectsDrawer';

type ViewMode = 'page' | 'grid' | 'list';
type State = 1 | 2 | 3 | 4 | 5;

// ── State badge ──────────────────────────────────────────────────────────────
function StateBadge({ state }: { state: State }) {
  if (state === 1) return null;
  if (state === 2) {
    return (
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        Building panels…
      </div>
    );
  }
  if (state === 3) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pending</span>
        Pending review
      </div>
    );
  }
  if (state === 4) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        Completed
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
      Rebuilt — re-review needed
    </div>
  );
}

// ── Panel status dot ─────────────────────────────────────────────────────────
function PanelStatusDot({ status }: { status: string }) {
  if (status === 'success') return <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />;
  if (status === 'loading') return <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />;
  if (status === 'error') return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-outline-variant flex-shrink-0" />;
}

// ── Progress stats bar ────────────────────────────────────────────────────────
function StatsBar({ total, success, loading: load, error }: { total: number; success: number; loading: number; error: number }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Total', value: total, color: 'text-on-surface' },
        { label: 'Done', value: success, color: 'text-emerald-500' },
        { label: 'Generating', value: load, color: 'text-blue-500' },
        { label: 'Errors', value: error, color: 'text-red-500' },
      ].map((s) => (
        <div key={s.label} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4 text-center">
          <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── View mode toggle ─────────────────────────────────────────────────────────
function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const opts: { key: ViewMode; icon: string; label: string }[] = [
    { key: 'page', icon: 'auto_stories', label: 'Page' },
    { key: 'grid', icon: 'grid_view', label: 'Grid' },
    { key: 'list', icon: 'view_list', label: 'List' },
  ];
  return (
    <div className="flex items-center gap-1 bg-surface-container-low rounded-full p-1">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            mode === o.key
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-sm">{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Collapsible export panel ──────────────────────────────────────────────────
function ExportPanel({
  jsonCopied,
  jsonDownloaded,
  lastDownloadedJsonFile,
  projectSnapshot,
  cloudSaveStatus,
  cloudSaveError,
  copyProjectJson,
  downloadProjectJson,
  saveToCloud,
  onOpenProjects,
}: {
  jsonCopied: boolean;
  jsonDownloaded: boolean;
  lastDownloadedJsonFile: string | null;
  projectSnapshot: unknown;
  cloudSaveStatus: string;
  cloudSaveError: string | null;
  copyProjectJson: () => void;
  downloadProjectJson: () => void;
  saveToCloud: () => void;
  onOpenProjects: () => void;
}) {
  const [jsonOpen, setJsonOpen] = useState(false);
  return (
    <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-4">
      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Project Export</p>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveToCloud}
          disabled={cloudSaveStatus === 'saving'}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            cloudSaveStatus === 'saving'
              ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
              : cloudSaveStatus === 'saved'
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-primary text-on-primary hover:opacity-90'
          }`}
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            {cloudSaveStatus === 'saved' ? 'cloud_done' : 'cloud_upload'}
          </span>
          {cloudSaveStatus === 'saving' ? 'Saving…' : cloudSaveStatus === 'saved' ? 'Saved!' : 'Save to Cloud'}
        </button>
        <button
          type="button"
          onClick={onOpenProjects}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-sm">folder_open</span>
          My Projects
        </button>
        <button
          type="button"
          onClick={downloadProjectJson}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-sm">{jsonDownloaded ? 'check' : 'download'}</span>
          {jsonDownloaded ? 'Downloaded' : 'Download JSON'}
        </button>
        <button
          type="button"
          onClick={copyProjectJson}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-sm">{jsonCopied ? 'check' : 'content_copy'}</span>
          {jsonCopied ? 'Copied!' : 'Copy JSON'}
        </button>
      </div>

      {lastDownloadedJsonFile && (
        <p className="text-xs text-on-surface-variant">Last file: {lastDownloadedJsonFile}</p>
      )}
      {cloudSaveError && cloudSaveStatus === 'error' && (
        <p className="text-xs text-red-500">{cloudSaveError}</p>
      )}

      {/* Collapsible JSON preview */}
      <button
        type="button"
        onClick={() => setJsonOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left py-2 border-t border-outline-variant/10"
      >
        <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">data_object</span>
          Project JSON preview
        </span>
        <span
          className="material-symbols-outlined text-sm text-on-surface-variant transition-transform"
          style={{ transform: jsonOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>
      {jsonOpen && (
        <pre className="max-h-[280px] overflow-auto rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4 text-xs text-on-surface-variant font-mono leading-relaxed">
          {JSON.stringify(projectSnapshot, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Panel card used in grid + list view ──────────────────────────────────────
function PanelItem({
  panel,
  panelState,
  viewMode,
}: {
  panel: { id: string; contextLabel: string; dialogueSfx: string; aiImagePrompt: string };
  panelState: { status: string; imageUrl: string | null; error: string | null } | undefined;
  viewMode: 'grid' | 'list';
}) {
  const [open, setOpen] = useState(false);
  const status = panelState?.status ?? 'idle';

  if (viewMode === 'grid') {
    return (
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
        <div className="aspect-[3/4] relative bg-surface-container-high">
          {panelState?.imageUrl ? (
            <Image
              src={panelState.imageUrl}
              alt={panel.contextLabel}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {status === 'loading' ? (
                <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-3xl text-outline-variant">image</span>
              )}
            </div>
          )}
        </div>
        <div className="p-3 flex items-center gap-2">
          <PanelStatusDot status={status} />
          <p className="text-xs font-semibold text-on-surface truncate">{panel.contextLabel}</p>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <PanelStatusDot status={status} />
        <span className="text-sm font-semibold text-on-surface flex-1 truncate">{panel.contextLabel}</span>
        {panel.dialogueSfx && (
          <span className="text-xs text-on-surface-variant truncate max-w-[160px]">{panel.dialogueSfx}</span>
        )}
        <span
          className="material-symbols-outlined text-sm text-on-surface-variant transition-transform flex-shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {panelState?.error && (
            <p className="text-xs text-red-500">{panelState.error}</p>
          )}
          {panel.dialogueSfx && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Dialogue / SFX</p>
              <p className="text-sm text-on-surface-variant">{panel.dialogueSfx}</p>
            </div>
          )}
          <div className="rounded-xl bg-surface-container-low p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Image prompt</p>
            <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">{panel.aiImagePrompt}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Step4Generation() {
  const {
    step4,
    step3,
    step4PanelsByPage,
    step4Stats,
    jsonCopied,
    jsonDownloaded,
    lastDownloadedJsonFile,
    projectSnapshot,
    handleGenerate,
    handleApprove,
    handleRevokeApproval,
    handleRetry,
    handleStartFullGeneration,
    handleRegeneratePage,
    copyProjectJson,
    downloadProjectJson,
    saveToCloud,
    cloudSaveStatus,
    cloudSaveError,
    getCooldownSeconds,
  } = useComicGeneration();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('page');

  const cooldown = getCooldownSeconds(4);
  const isGenerating = step4.isLoading;
  const canBuildPanels = !isGenerating && cooldown === 0 && !!step3.data;
  const isImageGenerating = !!step4.data?.isGenerating;

  // Derive state
  let state: State = 1;
  if (isGenerating) {
    state = 2;
  } else if (step4.isApproved && !step4.regeneratedAfterApproval) {
    state = 4;
  } else if (step4.data && step4.regeneratedAfterApproval) {
    state = 5;
  } else if (step4.data) {
    state = 3;
  }

  // All panels flat for grid/list views
  const allPanels = step4PanelsByPage.flatMap(([, panels]) => panels);

  return (
    <section className="text-on-surface space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Image Generation</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Generate panel images and export the final project package
          </p>
        </div>
        <StateBadge state={state} />
      </div>

      {/* ── Image gen mode selector ── */}
      <div>
        <ImageGenModePanel disabled={isGenerating || isImageGenerating} />
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Build panels */}
        <button
          type="button"
          onClick={() => handleGenerate(4)}
          disabled={!canBuildPanels}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
            !canBuildPanels
              ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
              : state >= 3
                ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                : 'bg-primary text-on-primary hover:opacity-90'
          }`}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isGenerating ? 'hourglass_empty' : state >= 3 ? 'refresh' : 'build'}
          </span>
          {isGenerating
            ? 'Building panels…'
            : cooldown > 0
              ? `Retry in ${cooldown}s`
              : state >= 3
                ? 'Rebuild panels'
                : 'Build panels from script'}
        </button>

        {/* Generate all images */}
        <button
          type="button"
          onClick={handleStartFullGeneration}
          disabled={!step4.data || isImageGenerating}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
            !step4.data || isImageGenerating
              ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
              : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
          }`}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isImageGenerating ? 'hourglass_empty' : 'image'}
          </span>
          {isImageGenerating ? 'Generating images…' : 'Generate all images'}
        </button>

        {/* Mark complete / Revoke */}
        {(state === 3 || state === 5) && (
          <button
            type="button"
            onClick={() => handleApprove(4)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
            Mark complete
          </button>
        )}
        {state === 4 && (
          <button
            type="button"
            onClick={() => handleRevokeApproval(4)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base">undo</span>
            Revoke completion
          </button>
        )}

        {/* Retry on error */}
        {step4.error && (
          <button
            type="button"
            onClick={() => handleRetry(4)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
          >
            <span className="material-symbols-outlined text-base">replay</span>
            Retry
          </button>
        )}
        {step4.error && <span className="text-sm text-red-500">{step4.error}</span>}
      </div>

      {/* ── Empty state ── */}
      {state === 1 && (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-outline-variant" style={{ fontVariationSettings: "'FILL' 1" }}>
            image
          </span>
          <div className="text-center">
            <p className="font-semibold text-on-surface">No panels yet</p>
            <p className="text-sm text-on-surface-variant mt-1">
              {!step3.data ? 'Complete Step 3 first to generate the panel script.' : 'Click "Build panels from script" to begin.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Progress + Export ── */}
      {(state === 2 || state === 3 || state === 4 || state === 5) && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          {/* Left — stats */}
          <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-4">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Generation Progress</p>
            <StatsBar
              total={step4Stats.total}
              success={step4Stats.success}
              loading={step4Stats.loading}
              error={step4Stats.error}
            />
            {step4Stats.total > 0 && (
              <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((step4Stats.success / step4Stats.total) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Right — export */}
          <ExportPanel
            jsonCopied={jsonCopied}
            jsonDownloaded={jsonDownloaded}
            lastDownloadedJsonFile={lastDownloadedJsonFile}
            projectSnapshot={projectSnapshot}
            cloudSaveStatus={cloudSaveStatus}
            cloudSaveError={cloudSaveError}
            copyProjectJson={copyProjectJson}
            downloadProjectJson={downloadProjectJson}
            saveToCloud={saveToCloud}
            onOpenProjects={() => setIsDrawerOpen(true)}
          />
        </div>
      )}

      {/* ── Panel view ── */}
      {(state === 3 || state === 4 || state === 5) && step4PanelsByPage.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-on-surface">
              {step4PanelsByPage.length} page{step4PanelsByPage.length !== 1 ? 's' : ''} · {allPanels.length} panel{allPanels.length !== 1 ? 's' : ''}
            </p>
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {/* Page view */}
          {viewMode === 'page' && (
            <div className="space-y-6">
              {step4PanelsByPage.map(([pageNumber, panels]) => {
                const pageState = step4.data?.pageStates?.[`page-${pageNumber}`];
                const pageStatus = pageState?.status ?? 'idle';
                return (
                  <div key={`page-${pageNumber}`} className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-on-surface">Page {pageNumber}</h3>
                        <PanelStatusDot status={pageStatus} />
                        <span className="text-xs text-on-surface-variant">
                          {pageStatus === 'loading' ? 'Generating…' : pageStatus === 'success' ? 'Done' : pageStatus === 'error' ? 'Error' : 'Pending'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRegeneratePage(pageNumber)}
                        disabled={!step4.data || isImageGenerating}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          !step4.data || isImageGenerating
                            ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
                            : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {pageStatus === 'loading' ? 'hourglass_empty' : pageStatus === 'error' ? 'replay' : 'refresh'}
                        </span>
                        {pageStatus === 'loading' ? 'Generating…' : pageStatus === 'error' ? 'Retry page' : 'Regenerate page'}
                      </button>
                    </div>

                    {/* Full-page image */}
                    {pageState?.error && <p className="text-sm text-red-500">{pageState.error}</p>}
                    {pageState?.imageUrl ? (
                      <div className="overflow-hidden rounded-2xl bg-surface-container">
                        <Image
                          src={pageState.imageUrl}
                          alt={`Page ${pageNumber} comic render`}
                          width={720}
                          height={960}
                          className="h-auto w-full object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-surface-container py-12 text-center">
                        {pageStatus === 'loading' ? (
                          <span className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
                            <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            Generating comic page…
                          </span>
                        ) : (
                          <span className="text-sm text-on-surface-variant">
                            No image yet — click &ldquo;Regenerate page&rdquo; above.
                          </span>
                        )}
                      </div>
                    )}

                    {/* Panel script cards */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {panels.map((panel) => {
                        const ps = step4.data?.panelStates?.[panel.id];
                        return (
                          <div key={panel.id} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <PanelStatusDot status={ps?.status ?? 'idle'} />
                              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{panel.contextLabel}</p>
                            </div>
                            {panel.dialogueSfx && (
                              <p className="text-sm text-on-surface">{panel.dialogueSfx}</p>
                            )}
                            <div className="rounded-xl bg-surface-container-low p-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Prompt</p>
                              <p className="text-xs text-on-surface-variant leading-relaxed">{panel.aiImagePrompt}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Grid view */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {allPanels.map((panel) => (
                <PanelItem
                  key={panel.id}
                  panel={panel}
                  panelState={step4.data?.panelStates?.[panel.id]}
                  viewMode="grid"
                />
              ))}
            </div>
          )}

          {/* List view */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {allPanels.map((panel) => (
                <PanelItem
                  key={panel.id}
                  panel={panel}
                  panelState={step4.data?.panelStates?.[panel.id]}
                  viewMode="list"
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ProjectsDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </section>
  );
}