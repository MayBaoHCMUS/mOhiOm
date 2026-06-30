'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { projectsApi, bubblesApi } from '@/services/api';
import type { CloudProjectListItem } from '@/services/api';
import { publishComic, buildShareUrl, getComicStats, unpublishComic } from '@/lib/publish';
import { recordPublish } from '@/lib/publishHistory';
import { recomposePages, DEFAULT_BORDER_CONFIG } from '@/lib/borderComposer';
import type { BorderConfig } from '@/lib/borderComposer';
import { compositePanelToBlob } from '@/lib/bubbles/exportComposite';
import { downloadSocialPack, PLATFORMS } from '@/lib/socialPack';

const SESSION_KEY = 'mohiom-image-api-url';
const CARD_STATES_KEY = 'mohiom-export-card-states';

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

function QRModal({ url, onClose }: { url: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, url, { width: 256, margin: 2 });
    });
  }, [url]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleDownload() {
    const QRCode = await import('qrcode');
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'qrcode.png';
    a.click();
  }

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 w-80"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between w-full">
          <p className="text-[13px] font-bold text-on-surface">Scan to open</p>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <canvas ref={canvasRef} className="rounded-xl" />

        <input
          type="text"
          value={url}
          readOnly
          onFocus={e => e.target.select()}
          className="w-full px-2.5 py-1.5 text-[11px] font-mono bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface-variant outline-none overflow-hidden text-ellipsis"
        />

        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 py-2 rounded-xl text-[12px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            Download PNG
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
              copied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SocialPackModal({
  projectId,
  onClose,
  getPages,
}: {
  projectId: string;
  onClose: () => void;
  getPages: (projectId: string) => Promise<string[]>;
}) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [pageIndices, setPageIndices] = useState<number[]>([]);
  const [selected, setSelected] = useState<string[]>(PLATFORMS.map(p => p.name));
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getPages(projectId)
      .then(p => {
        setPages(p);
        setPageIndices(p.map((_, i) => i));
      })
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load pages'));
  }, [projectId, getPages]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function togglePage(i: number) {
    setPageIndices(prev => prev.includes(i) ? prev.filter(n => n !== i) : [...prev, i]);
  }

  function togglePlatform(name: string) {
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  async function handleDownload() {
    if (!pages || !selected.length || !pageIndices.length) return;
    setGenerating(true);
    try {
      await downloadSocialPack(pages, pageIndices, selected, projectId);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl shadow-2xl p-6 flex flex-col gap-5 w-[480px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-bold text-on-surface">Social Media Pack</p>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-lg leading-none" aria-label="Close">×</button>
        </div>

        {/* Page picker */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Pages (for square/landscape formats)
            </p>
            {pages && (
              <button
                type="button"
                onClick={() => setPageIndices(pageIndices.length === pages.length ? [] : pages.map((_, i) => i))}
                className="text-[10px] text-primary hover:underline"
              >
                {pageIndices.length === pages.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          {!pages && !loadError && (
            <div className="flex items-center gap-2 text-[12px] text-on-surface-variant py-4">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              Loading pages…
            </div>
          )}
          {loadError && <p className="text-[12px] text-red-600 py-2">{loadError}</p>}
          {pages && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pages.map((src, i) => {
                const active = pageIndices.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => togglePage(i)}
                    className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                      active ? 'border-primary' : 'border-outline-variant/30'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Page ${i + 1}`} className="h-20 w-auto object-cover" />
                    {active && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center leading-none">✓</span>
                    )}
                    <p className={`text-[10px] text-center py-0.5 ${active ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                      p.{i + 1}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Platform selector */}
        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
            Platforms
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map(p => (
              <label
                key={p.name}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                  selected.includes(p.name)
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selected.includes(p.name)}
                  onChange={() => togglePlatform(p.name)}
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-tight">{p.label}</p>
                  <p className="text-[10px] opacity-70 leading-tight">
                    {p.size}{p.mode === 'strip' ? ' · all pages' : ''}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Download */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={!pages || !selected.length || !pageIndices.length || generating}
          className="w-full py-2.5 rounded-xl text-[13px] font-semibold bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {generating && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
          {generating ? 'Generating…' : 'Download ZIP'}
        </button>
      </div>
    </div>
  );
}

type EmbedSize = 'portrait' | 'landscape' | 'responsive';

const EMBED_SIZES: { key: EmbedSize; label: string; hint: string }[] = [
  { key: 'portrait',   label: 'Portrait',   hint: '400×600' },
  { key: 'landscape',  label: 'Landscape',  hint: '800×600' },
  { key: 'responsive', label: 'Responsive', hint: '100%×auto' },
];

function getEmbedCode(url: string, size: EmbedSize): string {
  if (size === 'portrait')
    return `<iframe\n  src="${url}"\n  width="400"\n  height="600"\n  frameborder="0"\n  allowfullscreen\n></iframe>`;
  if (size === 'landscape')
    return `<iframe\n  src="${url}"\n  width="800"\n  height="600"\n  frameborder="0"\n  allowfullscreen\n></iframe>`;
  return `<iframe\n  src="${url}"\n  width="100%"\n  style="aspect-ratio: 2/3; border: none;"\n  allowfullscreen\n></iframe>`;
}

function IframeSnippet({ url, size }: { url: string; size: EmbedSize }) {
  const attrs: [string, string | null][] =
    size === 'portrait'
      ? [['src', url], ['width', '400'], ['height', '600'], ['frameborder', '0'], ['allowfullscreen', null]]
      : size === 'landscape'
      ? [['src', url], ['width', '800'], ['height', '600'], ['frameborder', '0'], ['allowfullscreen', null]]
      : [['src', url], ['width', '100%'], ['style', 'aspect-ratio: 2/3; border: none;'], ['allowfullscreen', null]];

  return (
    <pre className="text-[11px] font-mono bg-[#1e1e2e] rounded-xl px-4 py-3 overflow-x-auto text-left leading-[1.7] select-all">
      <span className="text-[#89b4fa]">{'<iframe'}</span>
      {attrs.map(([name, val]) => (
        <span key={name}>
          {'\n  '}
          <span className="text-[#f9e2af]">{name}</span>
          {val !== null && (
            <>
              <span className="text-[#cdd6f4]">{'='}</span>
              <span className="text-[#a6e3a1]">{`"${val}"`}</span>
            </>
          )}
        </span>
      ))}
      {'\n'}
      <span className="text-[#89b4fa]">{'></iframe>'}</span>
    </pre>
  );
}

function EmbedPreviewModal({ url, size, onClose }: { url: string; size: EmbedSize; onClose: () => void }) {
  const previewW = size === 'landscape' ? 800 : 400;
  const previewH = size === 'landscape' ? 600 : 600;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-1">
          <p className="text-[12px] text-white/60">Embed preview{size === 'responsive' ? ' (shown at 400×600)' : ''}</p>
          <button type="button" onClick={onClose} className="text-white text-xl leading-none ml-4">×</button>
        </div>
        <iframe
          src={url}
          width={previewW}
          height={previewH}
          frameBorder={0}
          allowFullScreen
          className="rounded-xl bg-white"
        />
      </div>
    </div>
  );
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
  onRefreshStats,
  getPages,
}: {
  project: CloudProjectListItem;
  apiUrl: string;
  cardState: CardState;
  onPublish: (projectId: string) => void;
  onUnpublish: (projectId: string, comicId: string) => void;
  onRefreshStats: (projectId: string) => void;
  getPages: (projectId: string) => Promise<string[]>;
}) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'embed'>('share');
  const [embedSize, setEmbedSize] = useState<EmbedSize>('portrait');
  const [codeCopied, setCodeCopied] = useState(false);
  const [showEmbedPreview, setShowEmbedPreview] = useState(false);
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

  function copyEmbedCode() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(getEmbedCode(shareUrl, embedSize)).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
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
            {/* Published badge + reads */}
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
              <span className="material-symbols-outlined text-base">check_circle</span>
              Published
              <span className="ml-auto flex items-center gap-1.5">
                {cardState.published?.readCount !== null && cardState.published?.readCount !== undefined && (
                  <span className="text-on-surface-variant font-normal">
                    {cardState.published.readCount} {cardState.published.readCount === 1 ? 'read' : 'reads'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRefreshStats(project.project_id)}
                  title="Refresh read count"
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                </button>
              </span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-outline-variant/20">
              {(['share', 'embed'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-[11px] font-semibold border-b-2 -mb-px transition-colors ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab === 'share' ? 'Share link' : 'Embed'}
                </button>
              ))}
            </div>

            {/* Share tab */}
            {activeTab === 'share' && (
              <div className="space-y-2">
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
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowQR(true)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  >
                    QR code
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSocialModal(true)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  >
                    Social pack
                  </button>
                </div>
              </div>
            )}

            {/* Embed tab */}
            {activeTab === 'embed' && (
              <div className="space-y-2.5">
                {/* Size presets */}
                <div className="flex gap-1.5">
                  {EMBED_SIZES.map(({ key, label, hint }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEmbedSize(key)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors leading-tight ${
                        embedSize === key
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      <span className="block">{label}</span>
                      <span className="block opacity-60 font-normal">{hint}</span>
                    </button>
                  ))}
                </div>

                {/* Syntax-highlighted snippet */}
                <IframeSnippet url={shareUrl} size={embedSize} />

                {/* Actions */}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={copyEmbedCode}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                      codeCopied
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                  >
                    {codeCopied ? '✓ Copied' : 'Copy code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmbedPreview(true)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  >
                    Preview
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => onUnpublish(project.project_id, cardState.published!.comicId)}
              className="text-[11px] text-red-500 hover:underline bg-transparent border-none cursor-pointer p-0"
            >
              Remove from public access
            </button>
          </div>
        )}
        {showQR && shareUrl && <QRModal url={shareUrl} onClose={() => setShowQR(false)} />}
        {showSocialModal && (
          <SocialPackModal
            projectId={project.project_id}
            onClose={() => setShowSocialModal(false)}
            getPages={getPages}
          />
        )}
        {showEmbedPreview && shareUrl && (
          <EmbedPreviewModal url={shareUrl} size={embedSize} onClose={() => setShowEmbedPreview(false)} />
        )}
      </div>
    </div>
  );
}

export default function PublishPage() {
  const [apiUrl, setApiUrl] = useState('');
  const [projects, setProjects] = useState<CloudProjectListItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(() => {
    try {
      const saved = window.sessionStorage.getItem(CARD_STATES_KEY);
      return saved ? (JSON.parse(saved) as Record<string, CardState>) : {};
    } catch { return {}; }
  });
  const pagesCache = useRef<Map<string, string[]>>(new Map());

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
    setCardStates(prev => {
      const next = {
        ...prev,
        [projectId]: { ...((prev[projectId] ?? { status: 'idle' }) as CardState), ...patch },
      };
      try { window.sessionStorage.setItem(CARD_STATES_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
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

      pagesCache.current.set(projectId, pages);
      setCard(projectId, { status: 'publishing' });
      const result = await publishComic(apiUrl, pages, projectId, '');

      recordPublish({
        comic_id:     result.comic_id,
        reader_url:   buildShareUrl(apiUrl, result.reader_url),
        title:        projectId,
        page_count:   result.page_count,
        published_at: Date.now(),
      });

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

  const handleRefreshStats = useCallback(async (projectId: string) => {
    const pub = cardStates[projectId]?.published;
    if (!pub || !apiUrl.trim()) return;
    try {
      const stats = await getComicStats(apiUrl, pub.comicId);
      setCard(projectId, { published: { ...pub, readCount: stats.read_count } });
    } catch { /* noop */ }
  }, [apiUrl, cardStates]);

  const handleUnpublish = useCallback(async (projectId: string, comicId: string) => {
    if (!window.confirm('Remove this comic from public access?')) return;
    try {
      await unpublishComic(apiUrl, comicId);
      setCard(projectId, { status: 'idle', published: undefined });
    } catch { /* noop */ }
  }, [apiUrl]);

  const getComposedPages = useCallback(async (projectId: string): Promise<string[]> => {
    const cached = pagesCache.current.get(projectId);
    if (cached) return cached;

    const [projectRes, imagesRes, bubblesRes] = await Promise.all([
      projectsApi.load(projectId),
      projectsApi.loadImages(projectId),
      bubblesApi.getForComic(projectId).catch(() => ({ data: [] })),
    ]);
    const allImages = imagesRes.data.images;
    const bubbleMap: Record<string, unknown[]> = {};
    for (const doc of bubblesRes.data) {
      if (doc.panelId && Array.isArray(doc.bubbles)) bubbleMap[doc.panelId] = doc.bubbles;
    }
    const pageEntries = allImages
      .filter(e => e.image_key.startsWith('page:'))
      .sort((a, b) => {
        const numA = parseInt(a.image_key.replace('page:page-', ''), 10) || 0;
        const numB = parseInt(b.image_key.replace('page:page-', ''), 10) || 0;
        return numA - numB;
      });

    let pages: string[];
    if (pageEntries.length > 0) {
      pages = pageEntries.map(e => `data:image/png;base64,${e.image_data}`);
    } else {
      const steps = (projectRes.data.steps ?? {}) as Record<string, unknown>;
      const step4Data = ((steps.step4 as Record<string, unknown>)?.data ?? {}) as Record<string, unknown>;
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
      if (!allPanelImages.length) throw new Error('No page images found');
      const b64Pages = await recomposePages(allPanelImages, allLayouts, borderConfig);
      pages = b64Pages.map(b64 => `data:image/png;base64,${b64}`);
    }

    pagesCache.current.set(projectId, pages);
    return pages;
  }, []);

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
                        onRefreshStats={handleRefreshStats}
                        getPages={getComposedPages}
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
                      onRefreshStats={handleRefreshStats}
                      getPages={getComposedPages}
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
