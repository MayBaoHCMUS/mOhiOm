'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { Step4PanelState } from '@/context/ComicGenerationContext';
import { apiClient, bubblesApi } from '@/services/api';
import { exportWithDialogueAsZip } from '@/lib/bubbles/exportComposite';
import type { CompositePanel } from '@/lib/bubbles/exportComposite';
import type { PanelBubbles } from '@/components/studio-steps/DialogueEditor';

export default function Step5Export() {
  const {
    step4,
    step4PanelsByPage,
    comicPageMode,
    projectId,
    artStyle,
    mangaGenre,
    handleApprove,
    exportZip,
    exportPdf,
    exportStatus,
    saveToCloud,
    cloudSaveStatus,
    copyProjectJson,
    downloadProjectJson,
    jsonCopied,
    setActiveStep,
  } = useComicGeneration();

  const [panelBubbles, setPanelBubbles] = useState<Record<string, PanelBubbles>>({});
  const bubblesLoadedRef = useRef(false);

  const [comicRating, setComicRating] = useState<{ stars: number; positive: string; negative: string } | null>(null);
  const [exportStars, setExportStars] = useState(0);
  const [exportHovered, setExportHovered] = useState(0);
  const [exportPositive, setExportPositive] = useState('');
  const [exportNegative, setExportNegative] = useState('');
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [exportingDialogue, setExportingDialogue] = useState(false);
  const [dialogueExportProgress, setDialogueExportProgress] = useState<{ done: number; total: number } | null>(null);
  const sessionStartRef = useRef(Date.now());
  const [panelReactions, setPanelReactions] = useState<Record<string, string>>({});

  // Load ratings and bubbles on mount
  useEffect(() => {
    if (!projectId) return;
    apiClient.get(`/ratings/comic/${projectId}`).then((res) => {
      const r = res.data.rating;
      if (r) setComicRating({ stars: r.stars ?? 0, positive: r.comment_positive ?? '', negative: r.comment_negative ?? '' });
    }).catch(() => {});
    apiClient.get(`/ratings/panels/${projectId}`).then((res) => {
      const map: Record<string, string> = {};
      for (const r of (res.data.ratings ?? [])) map[r.panel_id] = r.reaction;
      setPanelReactions(map);
    }).catch(() => {});
  }, [projectId]);

  // Sync rating fields when comicRating loads
  useEffect(() => {
    if (comicRating) {
      setExportStars(comicRating.stars);
      setExportPositive(comicRating.positive);
      setExportNegative(comicRating.negative);
    }
  }, [comicRating]);

  // Load saved bubbles from MongoDB
  useEffect(() => {
    if (!projectId || bubblesLoadedRef.current) return;
    bubblesLoadedRef.current = true;
    bubblesApi.getForComic(projectId).then((res) => {
      const map: Record<string, PanelBubbles> = {};
      for (const doc of res.data) {
        map[doc.panelId] = doc.bubbles as PanelBubbles;
      }
      if (Object.keys(map).length > 0) {
        setPanelBubbles((prev) => ({ ...map, ...prev }));
      }
    }).catch(() => {});
  }, [projectId]);

  const handleRatingSubmit = useCallback(async (stars: number, positive: string, negative: string) => {
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const reactionSummary: Record<string, number> = {};
    for (const v of Object.values(panelReactions)) {
      reactionSummary[v] = (reactionSummary[v] ?? 0) + 1;
    }
    setComicRating({ stars, positive, negative });
    try {
      await apiClient.post('/ratings/comic', {
        comic_id: projectId,
        stars,
        skipped: false,
        comment_positive: positive,
        comment_negative: negative,
        total_panels: step4.data?.panels?.length ?? 0,
        panels_regenerated: 0,
        total_regen_count: 0,
        art_style: artStyle,
        genre: mangaGenre,
        total_session_time_seconds: elapsed,
        panel_reactions_summary: reactionSummary,
        step_completion_times: {},
      });
    } catch { /* fire-and-forget */ }
  }, [panelReactions, step4.data, projectId, artStyle, mangaGenre]);

  const handleExportWithDialogue = useCallback(async () => {
    const panels: CompositePanel[] = [];
    for (const [pageNum, pagePanels] of step4PanelsByPage) {
      for (const panel of pagePanels) {
        const state = (step4.data?.panelStates ?? {} as Record<string, Step4PanelState>)[panel.id] as Step4PanelState | undefined;
        if (!state?.imageUrl) continue;
        panels.push({
          label: `page-${pageNum}-panel-${panel.panelNumber}`,
          imageUrl: state.imageUrl,
          bubbles: panelBubbles[panel.id] ?? [],
        });
      }
    }
    if (panels.length === 0) return;
    setExportingDialogue(true);
    setDialogueExportProgress({ done: 0, total: panels.length });
    try {
      await exportWithDialogueAsZip(panels, projectId, (done, total) => {
        setDialogueExportProgress({ done, total });
      });
    } finally {
      setExportingDialogue(false);
      setDialogueExportProgress(null);
    }
  }, [step4PanelsByPage, step4.data, panelBubbles, projectId]);

  const hasImages = Object.values(step4.data?.pageStates ?? {}).some(
    (s) => (s as Step4PanelState).status === 'success' && (s as Step4PanelState).imageUrl
  );

  return (
    <section className="text-on-surface pb-20">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-1 pt-1 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Export</h2>
          <p className="text-sm text-on-surface-variant mt-1">Rate your experience and download your comic</p>
        </div>
      </div>

      <div className="space-y-8">

          {/* Rating section */}
          <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6 space-y-5">
            <div className="text-center">
              <p className="text-lg font-bold text-on-surface">🎉 Rate Your Experience</p>
              <p className="text-sm text-on-surface-variant mt-1">Optional — export whenever you&apos;re ready</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button"
                  onClick={() => setExportStars(n)}
                  onMouseEnter={() => setExportHovered(n)}
                  onMouseLeave={() => setExportHovered(0)}
                  className="transition-transform hover:scale-110">
                  <svg width="32" height="32" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                      fill={n <= (exportHovered || exportStars) ? '#F59E0B' : '#E5E7EB'}
                      stroke={n <= (exportHovered || exportStars) ? '#F59E0B' : '#D1D5DB'} strokeWidth="1" />
                  </svg>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">
                  What worked well? <span className="font-normal text-outline">(optional)</span>
                </label>
                <textarea value={exportPositive} onChange={(e) => setExportPositive(e.target.value)}
                  placeholder="e.g. The art style came out great…" rows={2}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder-outline outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">
                  What could be better? <span className="font-normal text-outline">(optional)</span>
                </label>
                <textarea value={exportNegative} onChange={(e) => setExportNegative(e.target.value)}
                  placeholder="e.g. Panel composition felt off…" rows={2}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder-outline outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>
            <button type="button"
              onClick={() => handleRatingSubmit(exportStars, exportPositive, exportNegative)}
              disabled={exportStars === 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                exportStars > 0 ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-surface-container text-outline cursor-not-allowed opacity-50'
              }`}>
              {comicRating ? '✓ Update Rating' : 'Submit Rating'}
            </button>
          </div>

          {/* Download section */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Download</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => exportPdf(includeMetadata)}
                disabled={!hasImages || exportStatus === 'exporting'}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  !hasImages || exportStatus === 'exporting'
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                }`}>
                <span className="text-2xl">📄</span>
                <p className="text-sm font-bold text-gray-900 mt-2">PDF Comic</p>
                <p className="text-xs text-gray-400 mt-0.5">Full comic, print-ready</p>
              </button>
              <button type="button"
                onClick={() => exportZip(includeMetadata)}
                disabled={!hasImages || exportStatus === 'exporting'}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  !hasImages || exportStatus === 'exporting'
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                }`}>
                <span className="text-2xl">🖼</span>
                <p className="text-sm font-bold text-gray-900 mt-2">Image Pack</p>
                <p className="text-xs text-gray-400 mt-0.5">All pages as PNG ZIP</p>
              </button>
              <label className="col-span-2 flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={includeMetadata} onChange={(e) => setIncludeMetadata(e.target.checked)} className="w-4 h-4 rounded accent-indigo-600" />
                <span className="text-sm text-gray-700">Include panel script (dialogue, shot types, prompts)</span>
              </label>

              {/* Export with Dialogue — shown only in panel mode */}
              {comicPageMode === 'panel' && (() => {
                const hasPanelsWithImages = step4PanelsByPage.some(([, panels]) =>
                  panels.some(p => !!(step4.data?.panelStates ?? {})[p.id]?.imageUrl)
                );
                const hasBubbles = Object.values(panelBubbles).some(bs =>
                  bs.some(b => b.bubbleType !== 'none' && (b.dialogue?.trim() ?? '') !== '' && b.dialogue?.toUpperCase().trim() !== 'NONE')
                );
                const disabled = !hasPanelsWithImages || exportingDialogue;
                return (
                  <button type="button" onClick={handleExportWithDialogue} disabled={disabled}
                    className={`col-span-2 flex items-start gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                      disabled
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer'
                    }`}>
                    <span className="text-2xl mt-0.5">💬</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">Export with Dialogue</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {exportingDialogue && dialogueExportProgress
                          ? `Compositing panel ${dialogueExportProgress.done} / ${dialogueExportProgress.total}…`
                          : hasBubbles
                          ? 'Panels + speech bubbles composited as PNG ZIP'
                          : 'Panels as PNG ZIP (add bubbles in Dialogue tab)'}
                      </p>
                    </div>
                    {exportingDialogue && (
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mt-0.5 flex-none" />
                    )}
                  </button>
                );
              })()}
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant pt-2">Save &amp; Share</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={saveToCloud}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-colors ${
                  cloudSaveStatus === 'saved' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                {cloudSaveStatus === 'saved' ? '✓ Saved to Cloud' : '☁ Save to Cloud'}
              </button>
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant pt-2">Developer</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={downloadProjectJson}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors">
                {'{ }'} Download JSON
              </button>
              <button type="button" onClick={copyProjectJson}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors">
                {jsonCopied ? '✓ Copied!' : '📋 Copy JSON'}
              </button>
            </div>
          </div>

          {/* Finish & Export */}
          <div className="border-t border-outline-variant/20 pt-4">
            <button type="button" onClick={() => handleApprove(5)}
              disabled={!hasImages}
              className={`w-full py-3 rounded-2xl text-sm font-bold transition-opacity ${
                hasImages ? 'bg-emerald-500 text-white hover:opacity-90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}>
              ✓ Finish &amp; Export
            </button>
          </div>
        </div>

      {/* ── Bottom bar ── */}
      <div className="fixed bottom-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ left: 'var(--studio-sidebar-width)' }}>
        <div className="px-10 max-w-6xl mx-auto flex items-center justify-between gap-4" style={{ height: 56 }}>
          <button type="button"
            onClick={() => setActiveStep(4)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span className="hidden sm:inline">Image Generation</span>
          </button>

          <button type="button"
            onClick={() => handleApprove(5)}
            disabled={!hasImages}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all flex-shrink-0 ${
              !hasImages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}>
            ✓ Finish &amp; Export
          </button>
        </div>
      </div>
    </section>
  );
}
