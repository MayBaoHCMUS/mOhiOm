'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { projectsApi, bubblesApi } from '@/services/api';
import type { CloudProjectListItem } from '@/services/api';
import { publishComic, buildShareUrl, getComicStats, unpublishComic } from '@/lib/publish';
import { recomposePages, DEFAULT_BORDER_CONFIG } from '@/lib/borderComposer';
import type { BorderConfig } from '@/lib/borderComposer';
import { compositePanelToBlob } from '@/lib/bubbles/exportComposite';
import { downloadSocialPack, PLATFORMS } from '@/lib/socialPack';
import { recordPublish } from '@/lib/publishHistory';
import { getImageApiUrl } from '@/lib/imageApiUrl';
import { useOnboardingContext } from '@/context/OnboardingContext';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Eye, EyeOff, ExternalLink,
  MoreHorizontal, RefreshCw,
} from 'lucide-react';

const CARD_STATES_KEY = 'mohiom-export-card-states';

// ── Gradient system (matches Home page) ────────────────────────────
const PROJECT_GRADIENTS = [
  'from-violet-900 via-purple-800 to-indigo-900',
  'from-slate-900 via-blue-900 to-cyan-900',
  'from-rose-900 via-pink-800 to-fuchsia-900',
  'from-amber-900 via-orange-800 to-red-900',
  'from-emerald-900 via-teal-800 to-cyan-900',
  'from-indigo-900 via-violet-800 to-purple-900',
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PROJECT_GRADIENTS[hash % PROJECT_GRADIENTS.length];
}

// Step badge uses 1-indexed display: has_step4 = step 5 in the pipeline UI
function getMaxStep(p: CloudProjectListItem): number {
  if (p.has_step4) return 5;
  if (p.has_step3) return 4;
  if (p.has_step2) return 3;
  if (p.has_step1) return 2;
  return 0;
}

function truncateTitle(title: string, maxLen = 24): string {
  return title.length > maxLen ? title.slice(0, maxLen - 2) + '…' : title;
}

function _formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const formatProjectTitle = (slug: string): string =>
  slug.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

const PROJECT_ACCENT_COLORS = [
  '#7C3AED', '#0891B2', '#059669', '#DC2626',
  '#D97706', '#2563EB', '#DB2777', '#65A30D',
];

function projectColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PROJECT_ACCENT_COLORS[hash % PROJECT_ACCENT_COLORS.length];
}

// Portal-based overflow menu — escapes overflow:hidden card boundary
function PortalMenu({ isOpen, onClose, triggerRef, children }: {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 6, right: window.innerWidth - rect.right });
    }
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: MouseEvent) => { if (!triggerRef.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={onClose} />
      <div style={{
        position: 'absolute', top: pos.top, right: pos.right, zIndex: 999,
        background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        minWidth: 220, padding: 4, whiteSpace: 'nowrap',
      }}>
        {children}
      </div>
    </>,
    document.body
  );
}

function MenuItemBtn({ icon, label, onClick, destructive }: {
  icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        height: 38, padding: '0 12px', background: 'transparent', border: 'none',
        borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 400,
        textAlign: 'left', whiteSpace: 'nowrap',
        color: destructive ? '#DC2626' : '#374151',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = destructive ? '#FEF2F2' : '#F9FAFB'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      <span style={{ color: destructive ? '#DC2626' : '#6B7280', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

// ── Types ───────────────────────────────────────────────────────────
interface PublishedInfo {
  comicId: string;
  readerUrl: string;
  readCount: number | null;
  publishedAt: number;
}

interface CardState {
  status: 'idle' | 'loading-images' | 'composing' | 'publishing' | 'done' | 'error';
  error?: string;
  published?: PublishedInfo;
}

// ── QR Modal ────────────────────────────────────────────────────────
function QRModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 w-80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between w-full">
          <p className="text-[13px] font-bold text-on-surface truncate max-w-[210px]" title={title}>
            Scan · {truncateTitle(title)}
          </p>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-lg leading-none" aria-label="Close">×</button>
        </div>
        <canvas ref={canvasRef} className="rounded-xl" />
        <input type="text" value={url} readOnly onFocus={e => e.target.select()}
          className="w-full px-2.5 py-1.5 text-[11px] font-mono bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface-variant outline-none overflow-hidden text-ellipsis" />
        <div className="flex gap-2 w-full">
          <button type="button" onClick={handleDownload}
            className="flex-1 py-2 rounded-xl text-[12px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors">
            Download PNG
          </button>
          <button type="button" onClick={handleCopy}
            className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${copied ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low'}`}>
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Social Pack Modal (FIX 8 + FIX 9) ───────────────────────────────
function SocialPackModal({ projectId, title, onClose, getPages }: {
  projectId: string;
  title: string;
  onClose: () => void;
  getPages: (projectId: string) => Promise<string[]>;
}) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [pageIndices, setPageIndices] = useState<number[]>([]);
  // FIX 8: Instagram only by default
  const [selected, setSelected] = useState<string[]>(['instagram_square']);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getPages(projectId)
      .then(p => { setPages(p); setPageIndices(p.map((_, i) => i)); })
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

  const allPagesSelected = pages !== null && pageIndices.length === pages.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl p-6 flex flex-col gap-5 w-[480px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-bold text-on-surface">Social Media Pack</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">{truncateTitle(title)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-lg leading-none" aria-label="Close">×</button>
        </div>

        {/* FIX 9: Page picker — relabelled */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Select pages to include
            </p>
            {pages && (
              <button type="button"
                onClick={() => setPageIndices(allPagesSelected ? [] : pages.map((_, i) => i))}
                className="text-[10px] text-primary hover:underline">
                {allPagesSelected ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          <p className="text-[11px] text-on-surface-variant/60 mb-2">Choose which comic pages to include in your social posts</p>
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
                  <button key={i} type="button" onClick={() => togglePage(i)}
                    className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-all ${active ? 'border-primary' : 'border-outline-variant/30 opacity-50'}`}>
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

        {/* FIX 9: Platform selector with story warning */}
        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Platforms</p>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map(p => {
              const isStory = p.mode === 'strip';
              const checked = selected.includes(p.name);
              return (
                <div key={p.name}>
                  <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}>
                    <input type="checkbox" className="accent-primary" checked={checked} onChange={() => togglePlatform(p.name)} />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold leading-tight">{p.label}</p>
                      <p className="text-[10px] opacity-70 leading-tight">{p.size}</p>
                    </div>
                  </label>
                  {isStory && checked && pages && (
                    <p className="text-[10px] text-amber-600 mt-1 px-1">
                      ⚠ Exports all {pages.length} pages as separate images
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FIX 8: Button text reflects selection count */}
        <button type="button" onClick={handleDownload}
          disabled={!pages || !selected.length || !pageIndices.length || generating}
          className="w-full py-2.5 rounded-xl text-[13px] font-semibold bg-primary text-on-primary hover:bg-primary/90 disabled:bg-surface-container disabled:text-on-surface-variant disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          {generating && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
          {generating ? 'Generating…'
            : !selected.length ? 'Select platforms to download'
            : selected.length === 1 ? 'Download ZIP · 1 format'
            : `Download ZIP · ${selected.length} formats`}
        </button>
      </div>
    </div>
  );
}

// ── Embed types ──────────────────────────────────────────────────────
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

// FIX 12: Syntax-highlighted embed snippet with horizontal scroll + overlaid copy button
function IframeSnippet({ url, size }: { url: string; size: EmbedSize }) {
  const [codeCopied, setCodeCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(getEmbedCode(url, size)).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    });
  }

  const attrs: [string, string | null][] =
    size === 'portrait'
      ? [['src', url], ['width', '400'], ['height', '600'], ['frameborder', '0'], ['allowfullscreen', null]]
      : size === 'landscape'
      ? [['src', url], ['width', '800'], ['height', '600'], ['frameborder', '0'], ['allowfullscreen', null]]
      : [['src', url], ['width', '100%'], ['style', 'aspect-ratio: 2/3; border: none;'], ['allowfullscreen', null]];

  return (
    <div className="relative">
      <pre style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 12,
        lineHeight: 1.6,
        color: '#E2E8F0',
        background: '#1E293B',
        borderRadius: 8,
        padding: '14px',
        overflowX: 'auto',
        overflowY: 'hidden',
        whiteSpace: 'pre',
        scrollbarWidth: 'thin',
        maxHeight: 160,
        margin: 0,
      }}>
        <span style={{ color: '#93C5FD' }}>{'<iframe'}</span>
        {attrs.map(([name, val]) => (
          <span key={name}>
            {'\n  '}
            <span style={{ color: '#86EFAC' }}>{name}</span>
            {val !== null && (
              <>
                <span style={{ color: '#E2E8F0' }}>{'='}</span>
                <span style={{ color: '#FCA5A5' }}>{`"${val}"`}</span>
              </>
            )}
          </span>
        ))}
        {'\n'}
        <span style={{ color: '#93C5FD' }}>{'></iframe>'}</span>
      </pre>
      <button type="button" onClick={copyCode} style={{
        position: 'absolute', top: 8, right: 8,
        height: 28, padding: '0 10px',
        background: codeCopied ? 'rgba(22,163,74,0.30)' : 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6, fontSize: 11, color: '#FFFFFF',
        cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap',
      }}>
        {codeCopied ? '✓ Copied!' : 'Copy code'}
      </button>
    </div>
  );
}

// ── Embed Preview Modal ──────────────────────────────────────────────
function EmbedPreviewModal({ url, size, title, onClose }: { url: string; size: EmbedSize; title: string; onClose: () => void }) {
  const previewW = size === 'landscape' ? 800 : 400;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-1">
          <p className="text-[12px] text-white/60">
            {truncateTitle(title)}{size === 'responsive' ? ' · shown at 400×600' : ''}
          </p>
          <button type="button" onClick={onClose} className="text-white text-xl leading-none ml-4">×</button>
        </div>
        <iframe src={url} width={previewW} height={600} frameBorder={0} allowFullScreen className="rounded-xl bg-white" />
      </div>
    </div>
  );
}

// ── Comic Card ────────────────────────────────────────────────────────
function ComicCard({ project, apiUrl, cardState, onPublish, onUnpublish, onRefreshStats, getPages }: {
  project: CloudProjectListItem;
  apiUrl: string;
  cardState: CardState;
  onPublish: (projectId: string) => void;
  onUnpublish: (projectId: string, comicId: string) => void;
  onRefreshStats: (projectId: string) => void;
  getPages: (projectId: string) => Promise<string[]>;
}) {
  const [showQR, setShowQR] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'embed'>('share');
  const [embedSize, setEmbedSize] = useState<EmbedSize>('portrait');
  const [showEmbedPreview, setShowEmbedPreview] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const gradient = gradientFor(project.project_id);
  const maxStep = getMaxStep(project);
  const shareUrl = cardState.published ? buildShareUrl(apiUrl, cardState.published.readerUrl) : null;
  const busy = cardState.status === 'loading-images' || cardState.status === 'composing' || cardState.status === 'publishing';
  const canPublish = !!apiUrl.trim() && !busy;
  const isDone = cardState.status === 'done';
  const pub = cardState.published;

  // FIX 6: time-aware read count
  const minutesSincePublish = pub?.publishedAt ? (Date.now() - pub.publishedAt) / 60000 : Infinity;
  const showJustPublished = minutesSincePublish < 10 && (pub?.readCount ?? 0) === 0;

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function confirmUnpublish() {
    if (!pub) return;
    setUnpublishing(true);
    try {
      await onUnpublish(project.project_id, pub.comicId);
    } finally {
      setUnpublishing(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">

        {/* FIX 3: Gradient thumbnail zone */}
        <div className={`relative h-[72px] bg-gradient-to-br ${gradient} flex flex-col justify-between p-3`}>
          {project.genre && (
            <span className="self-start text-[9px] font-bold uppercase tracking-[0.06em] text-white bg-black/30 rounded px-1.5 py-0.5">
              {project.genre.split('/')[0].split(',')[0].trim()}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.90)', textShadow: '0 1px 3px rgba(0,0,0,0.30)', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatProjectTitle(project.project_id)}</span>
        </div>

        {/* Card body */}
        <div className="px-4 py-3" style={{ borderLeft: `4px solid ${projectColorFor(project.project_id)}` }}>

          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-on-surface truncate" title={project.project_id}>
                {formatProjectTitle(project.project_id)}
              </p>
              <span style={{ fontSize: 10, color: '#D1D5DB', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                {project.project_id}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {/* Step badge — filled green */}
              <span style={{
                background: '#DCFCE7', color: '#16A34A', border: 'none',
                fontWeight: 600, padding: '3px 8px', borderRadius: 12, fontSize: 11,
                whiteSpace: 'nowrap',
              }}>
                Step {maxStep} ✓
              </span>

              {/* ⋮ overflow menu via portal */}
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setShowMenu(v => !v)}
                aria-label="More options"
                style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', borderRadius: 4, cursor: 'pointer', transition: 'background 120ms, color 120ms',
                  background: showMenu ? '#F3F4F6' : 'transparent',
                  color: showMenu ? '#374151' : '#9CA3AF',
                }}
                onMouseEnter={(e) => { if (!showMenu) { (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; } }}
                onMouseLeave={(e) => { if (!showMenu) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; } }}
              >
                <MoreHorizontal size={15} />
              </button>
              <PortalMenu isOpen={showMenu} onClose={() => setShowMenu(false)} triggerRef={menuButtonRef}>
                {isDone && shareUrl ? (
                  <>
                    <MenuItemBtn icon={<ExternalLink size={14} />} label="Open reader" onClick={() => { window.open(shareUrl, '_blank'); setShowMenu(false); }} />
                    <Link href={`/studio/editor?project=${encodeURIComponent(project.project_id)}`} onClick={() => setShowMenu(false)}>
                      <MenuItemBtn icon={<span className="material-symbols-outlined text-[14px] leading-none">edit_note</span>} label="Edit in Comic Editor" onClick={() => setShowMenu(false)} />
                    </Link>
                    <div style={{ height: 1, background: '#F3F4F6', margin: '4px 0' }} />
                    <MenuItemBtn icon={<EyeOff size={14} />} label="Remove from public access" onClick={() => { setShowMenu(false); setShowConfirm(true); }} destructive />
                  </>
                ) : (
                  <>
                    <Link href={`/studio/editor?project=${encodeURIComponent(project.project_id)}`} onClick={() => setShowMenu(false)}>
                      <MenuItemBtn icon={<span className="material-symbols-outlined text-[14px] leading-none">edit_note</span>} label="Edit in Comic Editor" onClick={() => setShowMenu(false)} />
                    </Link>
                    <Link href="/studio" onClick={() => setShowMenu(false)}>
                      <MenuItemBtn icon={<span className="material-symbols-outlined text-[14px] leading-none">movie_creation</span>} label="View in Pipeline" onClick={() => setShowMenu(false)} />
                    </Link>
                  </>
                )}
              </PortalMenu>

              {/* Chevron expand/collapse for published cards */}
              {isDone && (
                <button type="button" onClick={() => setIsExpanded(v => !v)}
                  className="w-7 h-7 flex items-center justify-center rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                  <ChevronDown size={15} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-[11px] text-on-surface-variant mb-3"
            title={new Date(project.saved_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}>
            {[project.genre?.split('/')[0].split(',')[0].trim(), `Last saved ${formatRelativeDate(project.saved_at)}`].filter(Boolean).join(' · ')}
          </p>

          {/* ── Idle: publish button ── */}
          {cardState.status === 'idle' && (
            <button type="button" onClick={() => onPublish(project.project_id)} disabled={!canPublish}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold border transition-all ${canPublish ? 'border-primary text-primary hover:bg-primary/5' : 'border-outline-variant/30 text-on-surface-variant/50 cursor-not-allowed'}`}>
              <span className="material-symbols-outlined text-base">public</span>
              Publish to Web Reader
            </button>
          )}

          {/* ── Busy ── */}
          {busy && (
            <div className="flex items-center justify-center gap-2.5 py-2.5 text-[13px] text-primary">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              {cardState.status === 'loading-images' ? 'Loading images…'
                : cardState.status === 'composing' ? 'Composing pages…'
                : 'Publishing…'}
            </div>
          )}

          {/* ── Error ── */}
          {cardState.status === 'error' && (
            <div className="space-y-2">
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {cardState.error ?? 'Publish failed'}
              </p>
              <button type="button" onClick={() => onPublish(project.project_id)} disabled={!canPublish}
                className="w-full py-2 rounded-xl text-[12px] font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors">
                Retry
              </button>
            </div>
          )}

          {/* ── Done ── */}
          {isDone && shareUrl && (
            <div>
              {/* Published badge + FIX 6: time-aware reads (always visible) */}
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 mb-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Published
                <span className="ml-auto flex items-center gap-1.5">
                  {showJustPublished ? (
                    <span className="text-[11px] text-on-surface-variant font-normal">Just published · views appear soon</span>
                  ) : pub?.readCount !== null && pub?.readCount !== undefined ? (
                    <span className="text-on-surface-variant font-normal">
                      {pub.readCount} {pub.readCount === 1 ? 'read' : 'reads'}
                    </span>
                  ) : null}
                  <button type="button"
                    title="Refresh view count"
                    aria-label="Refresh view count"
                    onClick={() => {
                      setIsRefreshing(true)
                      onRefreshStats(project.project_id)
                      setTimeout(() => setIsRefreshing(false), 600)
                    }}
                    className="inline-flex items-center justify-center p-0.5 rounded hover:bg-surface-container transition-colors group">
                    <RefreshCw size={13} className={`transition-colors group-hover:text-primary ${isRefreshing ? 'animate-spin' : 'text-on-surface-variant'}`} style={{ animationDuration: '600ms' }} />
                  </button>
                </span>
              </div>

              {/* FIX 11: Collapsible share/embed section */}
              <div className={`overflow-hidden transition-all duration-250 ease-in-out ${isExpanded ? 'max-h-[500px]' : 'max-h-0'}`}>
                {/* Tabs */}
                <div className="flex border-b border-outline-variant/20 mb-2.5">
                  {(['share', 'embed'] as const).map(tab => (
                    <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 text-[11px] font-semibold border-b-2 -mb-px transition-colors ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
                      {tab === 'share' ? 'Share link' : 'Embed'}
                    </button>
                  ))}
                </div>

                {/* Share tab */}
                {activeTab === 'share' && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      <input type="text" value={shareUrl} readOnly onFocus={e => e.target.select()}
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] font-mono bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface-variant outline-none overflow-hidden text-ellipsis" />
                      <button type="button" onClick={copyLink}
                        className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${copied ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low'}`}>
                        {copied ? '✓' : 'Copy'}
                      </button>
                      <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                        title="Open reader">↗</a>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setShowQR(true)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors">
                        QR code
                      </button>
                      <button type="button" onClick={() => setShowSocialModal(true)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low transition-colors">
                        Social pack
                      </button>
                    </div>
                  </div>
                )}

                {/* Embed tab — FIX 12 applied via IframeSnippet */}
                {activeTab === 'embed' && (
                  <div className="space-y-2.5">
                    <div className="flex gap-1.5">
                      {EMBED_SIZES.map(({ key, label, hint }) => (
                        <button key={key} type="button" onClick={() => setEmbedSize(key)}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors leading-tight ${embedSize === key ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}>
                          <span className="block">{label}</span>
                          <span className="block opacity-60 font-normal">{hint}</span>
                        </button>
                      ))}
                    </div>
                    <IframeSnippet url={shareUrl} size={embedSize} />
                    <button type="button" onClick={() => setShowEmbedPreview(true)}
                      className="w-full py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant/40 text-on-surface-variant hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5">
                      <Eye size={13} />
                      Preview embed
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showQR && shareUrl && <QRModal url={shareUrl} title={project.project_id} onClose={() => setShowQR(false)} />}
      {showSocialModal && (
        <SocialPackModal
          projectId={project.project_id}
          title={project.project_id}
          onClose={() => setShowSocialModal(false)}
          getPages={getPages}
        />
      )}
      {showEmbedPreview && shareUrl && (
        <EmbedPreviewModal url={shareUrl} size={embedSize} title={project.project_id} onClose={() => setShowEmbedPreview(false)} />
      )}

      {/* FIX 5: Unpublish confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!unpublishing) setShowConfirm(false); }}>
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-[400px] max-w-[calc(100vw-32px)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={24} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[16px] font-bold text-on-surface">Remove from public access?</p>
                <p className="text-[13px] text-on-surface-variant mt-2">
                  Readers will immediately lose access to <strong>{truncateTitle(formatProjectTitle(project.project_id))}</strong>. This cannot be undone without re-publishing.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setShowConfirm(false)} disabled={unpublishing}
                className="flex-1 h-[38px] rounded-lg text-[13px] font-medium bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={confirmUnpublish} disabled={unpublishing}
                className="flex-1 h-[38px] rounded-lg text-[13px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
                {unpublishing && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
                {unpublishing ? 'Removing…' : 'Yes, remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Publish Page ──────────────────────────────────────────────────────
export default function PublishPage() {
  const { markChecklistItem } = useOnboardingContext();
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
    setApiUrl(getImageApiUrl());
  }, []);

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
        pages = pageEntries.map(e => e.image_data);
      } else {
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
      markChecklistItem('publishComic');

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
        published: {
          comicId: result.comic_id,
          readerUrl: result.reader_url,
          readCount,
          publishedAt: Date.now(),
        },
      });
    } catch (err) {
      setCard(projectId, { status: 'error', error: err instanceof Error ? err.message : 'Publish failed' });
    }
  }, [apiUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefreshStats = useCallback(async (projectId: string) => {
    const pub = cardStates[projectId]?.published;
    if (!pub || !apiUrl.trim()) return;
    try {
      const stats = await getComicStats(apiUrl, pub.comicId);
      setCard(projectId, { published: { ...pub, readCount: stats.read_count } });
    } catch { /* noop */ }
  }, [apiUrl, cardStates]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 5: no window.confirm — confirmation is handled inside ComicCard
  const handleUnpublish = useCallback(async (projectId: string, comicId: string) => {
    try {
      await unpublishComic(apiUrl, comicId);
      setCard(projectId, { status: 'idle', published: undefined });
    } catch { /* noop */ }
  }, [apiUrl]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const publishedProjects   = projects.filter(p => cardStates[p.project_id]?.status === 'done');
  const unpublishedProjects = projects.filter(p => cardStates[p.project_id]?.status !== 'done');

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="ml-[var(--studio-sidebar-width)] pt-24 min-h-screen flex flex-col">

        {/* FIX 10: #F8FAFF page header band */}
        <div style={{ background: '#F8FAFF', borderBottom: '1px solid #E5E7EB', padding: '28px 32px 24px 32px', flexShrink: 0 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4, lineHeight: 1.2 }}>Publish</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Share your comics as a public web reader link</p>
        </div>

        {/* Content */}
        <div className="px-8 py-8 pb-16 flex-1">
          <div className="max-w-4xl mx-auto">

            {/* Server URL — read-only status; configured on the Settings page */}
            {apiUrl ? (
              <div className="flex items-center gap-2.5 h-10 px-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-8">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span className="text-[13px] font-semibold text-emerald-700">Server connected</span>
                <span className="text-[12px] text-on-surface-variant truncate max-w-[320px]">
                  · {apiUrl}
                </span>
                <Link href="/settings" className="ml-auto text-[12px] text-primary hover:underline whitespace-nowrap shrink-0">
                  Change →
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 h-10 px-4 bg-amber-50 border border-amber-200 rounded-xl mb-8">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span className="text-[13px] font-semibold text-amber-700">No web reader server configured</span>
                <Link href="/settings" className="ml-auto text-[12px] text-primary hover:underline whitespace-nowrap shrink-0">
                  Configure in Settings →
                </Link>
              </div>
            )}

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
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginTop: 28, marginBottom: 12 }}>
                      Published ({publishedProjects.length})
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
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
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', marginTop: 28, marginBottom: 12 }}>
                    Ready to publish ({unpublishedProjects.length})
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
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
        </div>
      </main>
    </div>
  );
}
