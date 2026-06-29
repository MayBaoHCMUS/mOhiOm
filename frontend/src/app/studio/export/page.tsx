'use client';

import { useEffect, useState, useCallback } from 'react';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { projectsApi, bubblesApi } from '@/services/api';
import type { CloudProjectListItem } from '@/services/api';
import { publishComic, buildShareUrl, getComicStats, unpublishComic } from '@/lib/publish';
import { recomposePages, DEFAULT_BORDER_CONFIG } from '@/lib/borderComposer';
import type { BorderConfig } from '@/lib/borderComposer';
import { compositePanelToBlob } from '@/lib/bubbles/exportComposite';

const SESSION_KEY = 'mohiom-image-api-url';

interface PublishedInfo {
  comicId: string;
  readerUrl: string;
  readCount: number | null;
}

interface CardState {
  status: 'idle' | 'loading-images' | 'composing' | 'publishing' | 'done' | 'error';
  error?: string;
  published?: PublishedInfo;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ComicCard({
  project,
  apiUrl,
  cardState,
  onPublish,
  onUnpublish,
}: {
  project: CloudProjectListItem;
  apiUrl: string;
  cardState: CardState;
  onPublish: (projectId: string) => void;
  onUnpublish: (projectId: string, comicId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = cardState.published
    ? buildShareUrl(apiUrl, cardState.published.readerUrl)
    : null;

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const busy = cardState.status === 'loading-images' || cardState.status === 'composing' || cardState.status === 'publishing';
  const canPublish = !!apiUrl.trim() && !busy;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-outline-variant/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-on-surface truncate" title={project.project_id}>
              {project.project_id}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {project.genre ?? 'Comic'} · {formatDate(project.saved_at)}
            </p>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Step 4 ✓
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 space-y-3">
        {cardState.status === 'idle' && (
          <button
            type="button"
            onClick={() => onPublish(project.project_id)}
            disabled={!canPublish}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold border transition-all ${
              canPublish
                ? 'border-primary text-primary hover:bg-primary/5'
                : 'border-outline-variant/30 text-on-surface-variant/50 cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-base">public</span>
            Publish to Web Reader
          </button>
        )}

        {busy && (
          <div className="flex items-center justify-center gap-2.5 py-2.5 text-[13px] text-primary">
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            {cardState.status === 'loading-images' ? 'Loading images…'
              : cardState.status === 'composing' ? 'Composing pages…'
              : 'Publishing…'}
          </div>
        )}

        {cardState.status === 'error' && (
          <div className="space-y-2">
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {cardState.error ?? 'Publish failed'}
            </p>
            <button
              type="button"
              onClick={() => onPublish(project.project_id)}
              disabled={!canPublish}
              className="w-full py-2 rounded-xl text-[12px] font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {cardState.status === 'done' && shareUrl && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
              <span className="material-symbols-outlined text-base">check_circle</span>
              Published
              {cardState.published?.readCount !== null && cardState.published?.readCount !== undefined && (
                <span className="ml-auto text-on-surface-variant font-normal">
                  {cardState.published.readCount} {cardState.published.readCount === 1 ? 'read' : 'reads'}
                </span>
              )}
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={shareUrl}
                readOnly
                onFocus={e => e.target.select()}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] font-mono bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface-variant outline-none overflow-hidden text-ellipsis"
              />
              <button
                type="button"
                onClick={copyLink}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  copied
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {copied ? '✓' : 'Copy'}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                title="Open reader"
              >
                ↗
              </a>
            </div>

            <button
              type="button"
              onClick={() => onUnpublish(project.project_id, cardState.published!.comicId)}
              className="text-[11px] text-red-500 hover:underline bg-transparent border-none cursor-pointer p-0"
            >
              Remove from public access
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublishPage() {
  const [apiUrl, setApiUrl] = useState('');
  const [projects, setProjects] = useState<CloudProjectListItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});

  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored) setApiUrl(stored.replace(/\/$/, ''));
  }, []);

  function handleUrlChange(val: string) {
    const trimmed = val.replace(/\/$/, '');
    setApiUrl(trimmed);
    if (trimmed) window.sessionStorage.setItem(SESSION_KEY, trimmed);
    else window.sessionStorage.removeItem(SESSION_KEY);
  }

  useEffect(() => {
    setLoadingProjects(true);
    projectsApi.list()
      .then(res => setProjects(res.data.filter(p => p.has_step4)))
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, []);

  function setCard(projectId: string, patch: Partial<CardState>) {
    setCardStates(prev => ({
      ...prev,
      [projectId]: { ...((prev[projectId] ?? { status: 'idle' }) as CardState), ...patch },
    }));
  }

  const handlePublish = useCallback(async (projectId: string) => {
    if (!apiUrl.trim()) return;
    setCard(projectId, { status: 'loading-images', error: undefined });
    try {
      const [projectRes, imagesRes, bubblesRes] = await Promise.all([
        projectsApi.load(projectId),
        projectsApi.loadImages(projectId),
        bubblesApi.getForComic(projectId).catch(() => ({ data: [] })),
      ]);
      const allImages = imagesRes.data.images;

      // Build bubble map: panelId → SingleBubble[]
      const bubbleMap: Record<string, unknown[]> = {};
      for (const doc of bubblesRes.data) {
        if (doc.panelId && Array.isArray(doc.bubbles)) bubbleMap[doc.panelId] = doc.bubbles;
      }

      // Full-page mode: page:page-1, page:page-2 … (generated in Full Page mode)
      const pageEntries = allImages
        .filter(e => e.image_key.startsWith('page:'))
        .sort((a, b) => {
          const numA = parseInt(a.image_key.replace('page:page-', ''), 10) || 0;
          const numB = parseInt(b.image_key.replace('page:page-', ''), 10) || 0;
          return numA - numB;
        });

      let pages: string[];

      if (pageEntries.length > 0) {
        // Full Page mode — bubbles are already baked into the AI-generated image
        pages = pageEntries.map(e => e.image_data);
      } else {
        // Panel-by-panel mode: composite bubbles onto panels, then compose pages.
        const steps = (projectRes.data.steps ?? {}) as Record<string, unknown>;
        const step4Wrapper = (steps.step4 ?? {}) as Record<string, unknown>;
        const step4Data = (step4Wrapper.data ?? {}) as Record<string, unknown>;
        const panels = Array.isArray(step4Data.panels)
          ? (step4Data.panels as Array<{ id: string; pageNumber: number; panelNumber: number }>)
          : [];

        const imageGenSettings = (projectRes.data.image_gen_settings ?? {}) as Record<string, unknown>;
        const savedLayouts = (imageGenSettings.page_layout_names ?? {}) as Record<string, string>;
        const savedBorderCfg = (imageGenSettings.border_config ?? {}) as Partial<BorderConfig>;
        const borderConfig: BorderConfig = { ...DEFAULT_BORDER_CONFIG, ...savedBorderCfg };

        const imageMap: Record<string, string> = {};
        for (const { image_key, image_data } of allImages) {
          if (image_key.startsWith('panel:')) imageMap[image_key.slice(6)] = image_data;
        }

        const byPage = new Map<number, Array<{ id: string; panelNumber: number }>>();
        for (const p of panels) {
          const arr = byPage.get(p.pageNumber) ?? [];
          arr.push({ id: p.id, panelNumber: p.panelNumber });
          byPage.set(p.pageNumber, arr);
        }

        const LAYOUT_FALLBACKS: Record<number, string> = {
          1: 'single', 2: 'horizontal_duo', 3: 'three_panels_row',
          4: 'grid_2x2', 5: 'splash_top', 6: 'grid_2x3',
        };

        setCard(projectId, { status: 'composing' });

        const allPanelImages: string[][] = [];
        const allLayouts: string[] = [];
        for (const pageNum of Array.from(byPage.keys()).sort((a, b) => a - b)) {
          const panelList = byPage.get(pageNum)!.sort((a, b) => a.panelNumber - b.panelNumber);
          const imgs = await Promise.all(panelList.map(async ({ id }) => {
            const rawUrl = imageMap[id];
            if (!rawUrl) return '';
            const bubbles = bubbleMap[id];
            if (bubbles?.length) {
              try {
                const blob = await compositePanelToBlob(rawUrl, bubbles as Parameters<typeof compositePanelToBlob>[1]);
                return await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              } catch { /* fallback to raw */ }
            }
            return rawUrl;
          }));
          const validImgs = imgs.filter(Boolean);
          if (validImgs.length > 0) {
            allPanelImages.push(validImgs);
            allLayouts.push(savedLayouts[String(pageNum)] ?? LAYOUT_FALLBACKS[validImgs.length] ?? 'single');
          }
        }

        if (!allPanelImages.length) {
          setCard(projectId, { status: 'error', error: 'No page images found. Save your project with images first.' });
          return;
        }

        const b64Pages = await recomposePages(allPanelImages, allLayouts, borderConfig);
        pages = b64Pages.map(b64 => `data:image/png;base64,${b64}`);
      }

      if (!pages.length) {
        setCard(projectId, { status: 'error', error: 'No page images found. Save your project with images first.' });
        return;
      }

      setCard(projectId, { status: 'publishing' });
      const result = await publishComic(apiUrl, pages, projectId, '');

      let readCount: number | null = null;
      try {
        const stats = await getComicStats(apiUrl, result.comic_id);
        readCount = stats.read_count;
      } catch { /* noop */ }

      setCard(projectId, {
        status: 'done',
        published: { comicId: result.comic_id, readerUrl: result.reader_url, readCount },
      });
    } catch (err) {
      setCard(projectId, { status: 'error', error: err instanceof Error ? err.message : 'Publish failed' });
    }
  }, [apiUrl]);

  const handleUnpublish = useCallback(async (projectId: string, comicId: string) => {
    if (!window.confirm('Remove this comic from public access?')) return;
    try {
      await unpublishComic(apiUrl, comicId);
      setCard(projectId, { status: 'idle', published: undefined });
    } catch { /* noop */ }
  }, [apiUrl]);

  const publishedProjects  = projects.filter(p => cardStates[p.project_id]?.status === 'done');
  const unpublishedProjects = projects.filter(p => cardStates[p.project_id]?.status !== 'done');

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="pt-24 pb-16 px-8 ml-[var(--studio-sidebar-width)]">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-on-surface">Publish</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Share your comics as a public web reader link
            </p>
          </div>

          {/* Server URL */}
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <span className="material-symbols-outlined text-primary mt-0.5">language</span>
              <div>
                <p className="text-[13px] font-bold text-on-surface">Web Reader Server URL</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Your Cloudflare tunnel URL — the same server used for image generation in Step 1.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={apiUrl}
                onChange={e => handleUrlChange(e.target.value)}
                placeholder="https://xxxx.trycloudflare.com"
                className="field flex-1 font-mono text-sm"
              />
              {apiUrl && (
                <a
                  href={apiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-outline-variant/40 text-[13px] text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  Test
                </a>
              )}
            </div>
            {!apiUrl && (
              <p className="text-[11px] text-amber-600 mt-2.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">warning</span>
                Enter the server URL above to enable publishing.
              </p>
            )}
          </div>

          {/* Comics */}
          {loadingProjects ? (
            <div className="flex items-center justify-center py-16 text-on-surface-variant gap-3">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading your comics…
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl mb-3 block text-outline">auto_stories</span>
              <p className="text-[14px] font-medium">No comics with generated images yet</p>
              <p className="text-[12px] mt-1">Complete Step 4 (Generate) and save your project first.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {publishedProjects.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                    Published ({publishedProjects.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {publishedProjects.map(p => (
                      <ComicCard
                        key={p.project_id}
                        project={p}
                        apiUrl={apiUrl}
                        cardState={cardStates[p.project_id] ?? { status: 'idle' }}
                        onPublish={handlePublish}
                        onUnpublish={handleUnpublish}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                  Ready to publish ({unpublishedProjects.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unpublishedProjects.map(p => (
                    <ComicCard
                      key={p.project_id}
                      project={p}
                      apiUrl={apiUrl}
                      cardState={cardStates[p.project_id] ?? { status: 'idle' }}
                      onPublish={handlePublish}
                      onUnpublish={handleUnpublish}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
