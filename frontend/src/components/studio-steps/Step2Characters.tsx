'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { ImageGenMode, ImageGenSettings } from '@/context/ComicGenerationContext';
import CharacterLibraryModal from '@/components/CharacterLibraryModal';
import GalleryModal from '@/components/GalleryModal';
import Markdown from '@/components/Markdown';
import { apiClient } from '@/services/api';

// ── Design section definitions ────────────────────────────────────────────────

const DESIGN_SECTION_DEFS = [
  { id: 1 as const, coreMarker: '1. Global Design Guidelines',             title: '1. Global Design Guidelines' },
  { id: 2 as const, coreMarker: '2. Main Character Design Sheets',         title: '2. Main Character Design Sheets' },
  { id: 3 as const, coreMarker: '3. Supporting Character Design Sheets',   title: '3. Supporting Character Design Sheets' },
  { id: 4 as const, coreMarker: '4. Interaction & Relationship Notes',     title: '4. Interaction & Relationship Notes' },
  { id: 5 as const, coreMarker: '5. Final Design Summary',                 title: '5. Final Design Summary' },
];

const TOTAL_SECTIONS = DESIGN_SECTION_DEFS.length;

type DesignSectionId = 1 | 2 | 3 | 4 | 5;
type SectionStatus   = 'skeleton' | 'active' | 'complete';

interface ParsedSection {
  id:      DesignSectionId;
  title:   string;
  content: string;
  status:  SectionStatus;
}

function findMarker(text: string, coreMarker: string): { start: number; contentStart: number } {
  for (const prefix of ['## ', '### ', '# ', '#### ', '**', '']) {
    const full = prefix + coreMarker;
    let lineStart = -1;
    const nlIdx = text.indexOf('\n' + full);
    if (nlIdx !== -1) { lineStart = nlIdx + 1; }
    else if (text.startsWith(full)) { lineStart = 0; }
    if (lineStart !== -1) {
      const nlAfter = text.indexOf('\n', lineStart);
      return { start: lineStart, contentStart: nlAfter === -1 ? text.length : nlAfter };
    }
  }
  return { start: -1, contentStart: -1 };
}

function parseDesignSections(text: string): ParsedSection[] {
  return DESIGN_SECTION_DEFS.map((def, i) => {
    const { start, contentStart } = findMarker(text, def.coreMarker);
    if (start === -1) return { id: def.id, title: def.title, content: '', status: 'skeleton' as const };
    const nextDef = DESIGN_SECTION_DEFS[i + 1];
    const { start: nextStart } = nextDef ? findMarker(text, nextDef.coreMarker) : { start: -1 };
    if (nextStart !== -1) {
      return { id: def.id, title: def.title, content: text.slice(contentStart, nextStart).trim(), status: 'complete' as const };
    }
    return { id: def.id, title: def.title, content: text.slice(contentStart).trim(), status: 'active' as const };
  });
}

function cleanContent(raw: string): string {
  return raw.replace(/[\s\n]*[•·•·]{2,}[\s\n]*$/, '').trimEnd();
}

// ── Default settings (inline — no longer imported from CharacterModePanel) ────

const DEFAULT_SETTINGS: ImageGenSettings = {
  mode: 1,
  referenceImageBase64: '',
  controlImageBase64: '',
  ipAdapterScale: 0.7,
  controlnetScale: 0.8,
};

// ── State badge (Design Sheets tab) ──────────────────────────────────────────

type State = 1 | 2 | 3 | 4 | 5;

function StateBadge({
  state,
  streamProgress,
}: {
  state: State;
  streamProgress?: { current: number; total: number } | null;
}) {
  if (state === 1) return null;
  if (state === 2) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 motion-safe:animate-pulse" />
          Designing characters…
        </div>
        {streamProgress && streamProgress.current > 0 && (
          <div className="flex items-center gap-2 min-w-[160px]">
            <div className="flex-1 h-1 rounded-full bg-on-surface/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.round((streamProgress.current / streamProgress.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-on-surface-variant flex-shrink-0 tabular-nums">
              {streamProgress.current} / {streamProgress.total}
            </span>
          </div>
        )}
      </div>
    );
  }
  if (state === 4) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        Approved
      </div>
    );
  }
  if (state === 5) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
        Regenerated — re-approval needed
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pending</span>
      Pending review
    </div>
  );
}

// ── Per-character approval progress badge (top-right, References tab) ─────────

function ApprovalProgressBadge({ approved, total }: { approved: number; total: number }) {
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
  const allDone = approved === total && total > 0;
  return (
    <div className="flex flex-col items-end gap-1.5 min-w-[160px]">
      <div className={`flex items-center gap-1.5 text-xs font-bold ${allDone ? 'text-emerald-600' : 'text-on-surface-variant'}`}>
        <span
          className="material-symbols-outlined text-sm"
          style={{ fontVariationSettings: allDone ? "'FILL' 1" : "'FILL' 0" }}
        >
          {allDone ? 'check_circle' : 'pending'}
        </span>
        Approved {approved}/{total} characters
      </div>
      <div className="w-full h-1.5 rounded-full bg-on-surface/8 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-primary/60'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Character status badge (Reference Images tab) ─────────────────────────────

function CharacterStatusBadge({ status }: { status: 'draft' | 'generated' | 'approved' }) {
  if (status === 'approved') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        Approved
      </span>
    );
  }
  if (status === 'generated') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>image</span>
        Generated
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full flex-shrink-0">
      <span className="material-symbols-outlined text-xs">edit_note</span>
      Draft
    </span>
  );
}

// ── Labeled aspect ratio pills ────────────────────────────────────────────────

const ASPECT_RATIOS: { value: string; icon: string; label: string }[] = [
  { value: '1:1',  icon: '□',  label: '1:1'  },
  { value: '2:3',  icon: '▯',  label: '2:3'  },
  { value: '3:4',  icon: '▯',  label: '3:4'  },
  { value: '16:9', icon: '▬',  label: '16:9' },
];

function AspectRatioPills({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ASPECT_RATIOS.map((r) => (
        <button
          key={r.value}
          type="button"
          title={r.label}
          onClick={() => onChange(r.value)}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            disabled ? 'cursor-not-allowed opacity-40' : ''
          } ${
            value === r.value
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
          }`}
        >
          <span className="text-[11px] leading-none">{r.icon}</span>
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ── Generation mode segmented control ─────────────────────────────────────────

const GENERATION_MODES: { id: ImageGenMode; label: string; icon: string; tooltip: string }[] = [
  { id: 1, label: 'Text',   icon: 'text_fields',      tooltip: 'Generate from text description only' },
  { id: 2, label: '+ Ref',  icon: 'photo_library',    tooltip: 'Use a reference image to guide character appearance' },
  { id: 3, label: '+ Pose', icon: 'accessibility_new', tooltip: 'Use a pose image to control body structure' },
  { id: 4, label: 'All',    icon: 'tune',              tooltip: 'Use both reference and pose images' },
];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function GenerationModePanel({
  value,
  onChange,
  disabled,
}: {
  value: ImageGenSettings;
  onChange: (s: ImageGenSettings) => void;
  disabled?: boolean;
}) {
  const [refName, setRefName]   = useState('');
  const [ctrlName, setCtrlName] = useState('');
  const set = (patch: Partial<ImageGenSettings>) => onChange({ ...value, ...patch });

  const handleRefFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set({ referenceImageBase64: await readFileAsBase64(file) });
    setRefName(file.name);
  };

  const handleCtrlFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set({ controlImageBase64: await readFileAsBase64(file) });
    setCtrlName(file.name);
  };

  const showRef  = value.mode === 2 || value.mode === 4;
  const showCtrl = value.mode === 3 || value.mode === 4;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Generation Mode</p>
        <div className="flex gap-0.5 p-1 rounded-xl bg-surface-container">
          {GENERATION_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.tooltip}
              onClick={() => set({ mode: m.id })}
              disabled={disabled}
              className={`group/mode relative flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition-all ${
                disabled ? 'cursor-not-allowed opacity-40' : ''
              } ${
                value.mode === m.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm leading-none">{m.icon}</span>
              <span className="hidden sm:inline truncate">{m.label}</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[160px] rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-normal leading-snug text-white opacity-0 group-hover/mode:opacity-100 transition-opacity text-center z-50 whitespace-normal">
                {m.tooltip}
              </span>
            </button>
          ))}
        </div>
      </div>

      {showRef && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Reference <span className="font-normal text-on-surface-variant/50 normal-case tracking-normal">(guides appearance)</span>
          </p>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container px-3 py-2 text-xs text-on-surface-variant hover:border-primary/40 transition-colors">
            <span className="material-symbols-outlined text-base text-on-surface-variant/50">add_photo_alternate</span>
            <span className="truncate">{refName || 'Upload reference image'}</span>
            <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={handleRefFile} />
          </label>
          {value.referenceImageBase64 && (
            <div className="flex items-center gap-2">
              <img src={`data:image/png;base64,${value.referenceImageBase64}`} alt="ref" className="h-10 w-10 rounded-xl object-cover" />
              <button type="button" onClick={() => { set({ referenceImageBase64: '' }); setRefName(''); }} className="text-[11px] text-red-500 hover:text-red-700">Remove</button>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Influence</span>
              <span className="text-[10px] font-bold text-on-surface">{value.ipAdapterScale.toFixed(1)}</span>
            </div>
            <input type="range" min={0.1} max={1.0} step={0.1} value={value.ipAdapterScale} onChange={(e) => set({ ipAdapterScale: Number(e.target.value) })} disabled={disabled} className="w-full accent-gray-900" />
          </div>
        </div>
      )}

      {showCtrl && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Pose <span className="font-normal text-on-surface-variant/50 normal-case tracking-normal">(guides structure)</span>
          </p>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container px-3 py-2 text-xs text-on-surface-variant hover:border-primary/40 transition-colors">
            <span className="material-symbols-outlined text-base text-on-surface-variant/50">add_photo_alternate</span>
            <span className="truncate">{ctrlName || 'Upload pose image'}</span>
            <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={handleCtrlFile} />
          </label>
          {value.controlImageBase64 && (
            <div className="flex items-center gap-2">
              <img src={`data:image/png;base64,${value.controlImageBase64}`} alt="ctrl" className="h-10 w-10 rounded-xl object-cover" />
              <button type="button" onClick={() => { set({ controlImageBase64: '' }); setCtrlName(''); }} className="text-[11px] text-red-500 hover:text-red-700">Remove</button>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Strength</span>
              <span className="text-[10px] font-bold text-on-surface">{value.controlnetScale.toFixed(1)}</span>
            </div>
            <input type="range" min={0.1} max={1.0} step={0.1} value={value.controlnetScale} onChange={(e) => set({ controlnetScale: Number(e.target.value) })} disabled={disabled} className="w-full accent-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Structured section parser (used by CharacterDesignInfo) ───────────────────

interface ParsedDesign {
  role?: string;
  subtitle?: string;
  personality?: string;
  physical?: string;
  outfit?: string;
  visualHook?: string;
  expressions?: string[];
  stagePrompt?: string;
  palette?: string;
  hasStructure: boolean;
}

function parseStructuredSections(lines: string[]): ParsedDesign {
  const result: ParsedDesign = { hasStructure: false };
  let currentKey = '';
  const buckets: Record<string, string[]> = {};

  for (const line of lines) {
    const t = line.trim();
    const mdH   = t.match(/^#{2,4}\s+(.+)$/);
    const boldH = t.match(/^\*\*([^*]+?)\*?\*:?\s*$/);
    const header = mdH?.[1]?.trim() ?? boldH?.[1]?.trim();

    if (header) {
      currentKey = header.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      if (!buckets[currentKey]) buckets[currentKey] = [];
    } else if (currentKey) {
      if (t) buckets[currentKey].push(t);
    } else if (t && !result.subtitle && !t.startsWith('#')) {
      const cleaned = t.replace(/\*\*/g, '').replace(/^(role|type|archetype)[:\s]*/i, '').trim();
      if (cleaned.length > 2 && cleaned.length < 100) result.subtitle = cleaned;
    }
  }

  for (const [k, vals] of Object.entries(buckets)) {
    const content = vals.join('\n').trim().replace(/\*\*/g, '');
    if (!content) continue;
    if (/\bname\b.*\brole\b|\brole\b.*\bname\b|\barchetype\b/.test(k)) {
      result.role = content;
      if (!result.subtitle) {
        const first = content.split('\n')[0].replace(/^is\s+/i, '').trim();
        if (first.length < 120) result.subtitle = first;
      }
      result.hasStructure = true;
    } else if (/personalit/.test(k)) { result.personality = content; result.hasStructure = true; }
    else if (/physical|appearance|look/.test(k)) { result.physical = content; result.hasStructure = true; }
    else if (/outfit|accessor|wear/.test(k)) { result.outfit = content; result.hasStructure = true; }
    else if (/visual|hook|distinct/.test(k)) { result.visualHook = content; result.hasStructure = true; }
    else if (/expression/.test(k)) {
      result.expressions = content
        .split(/[,\[\]\n]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 1 && e.length < 40);
      if (result.expressions.length) result.hasStructure = true;
    } else if (/palette|colou?r/.test(k)) {
      result.palette = content; result.hasStructure = true;
    } else if (/stage|prompt|image/.test(k)) {
      result.stagePrompt = content;
    }
  }

  return result;
}

function extractCharacterSection(markdown: string, characterName: string): string[] {
  const lines = markdown.split('\n');
  const nameLower = characterName.toLowerCase().trim();

  const cleanHeader = (t: string) =>
    t.toLowerCase().replace(/[*_`]/g, '').replace(/^\d+[\.\)]\s*/, '').replace(/[():\-]/g, ' ').replace(/\s+/g, ' ').trim();

  const scoreHeader = (raw: string): number => {
    const text    = raw.toLowerCase();
    const cleaned = cleanHeader(raw);
    if (text.includes(nameLower) || cleaned.includes(nameLower)) return 10;
    const sigWords = nameLower.split(/\s+/).filter((w) => w.length >= 4);
    if (sigWords.length > 0 && sigWords.every((w) => cleaned.includes(w))) return 7;
    const firstSig = nameLower.split(/\s+/).find((w) => w.length >= 5);
    if (firstSig && cleaned.includes(firstSig)) return 3;
    return 0;
  };

  type HeaderEntry = { lineIdx: number; depth: number; raw: string };
  const headers: HeaderEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+(.+)$/);
    if (m) headers.push({ lineIdx: i, depth: m[1].length, raw: m[2] });
  }

  let bestScore = 0;
  let bestEntry: HeaderEntry | null = null;
  for (const h of headers) {
    const s = scoreHeader(h.raw);
    if (s > bestScore) { bestScore = s; bestEntry = h; }
  }
  if (bestScore === 0 || !bestEntry) return [];

  const result: string[] = [];
  for (let i = bestEntry.lineIdx; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+/);
    if (m && i > bestEntry.lineIdx && m[1].length <= bestEntry.depth) break;
    result.push(lines[i]);
  }
  return result;
}

// ── Collapsible character design info (left column) ───────────────────────────

function CharacterDesignInfo({
  designMarkdown,
  characterName,
  fallbackPrompt,
}: {
  designMarkdown: string | null;
  characterName: string;
  fallbackPrompt?: string;
}) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set(['physical', 'personality']));
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const lines  = designMarkdown ? extractCharacterSection(designMarkdown, characterName) : [];
  const parsed = parseStructuredSections(lines);

  const CHIP_SECTIONS = new Set(['physical', 'outfit']);

  const extractTraitChips = (text: string): string[] =>
    text
      .split(/[,;·•]+/)
      .map((p) => p.trim().replace(/^[-*]\s*/, ''))
      .filter((p) => p.length > 1 && p.length <= 30 && p.split(/\s+/).length <= 5)
      .slice(0, 5);

  const SUB_SECTIONS = [
    { key: 'personality', label: 'Personality',         value: parsed.personality },
    { key: 'physical',    label: 'Physical Appearance',  value: parsed.physical },
    { key: 'outfit',      label: 'Outfit',               value: parsed.outfit },
    { key: 'visualHook',  label: 'Visual Hook',          value: parsed.visualHook },
    { key: 'palette',     label: 'Color Palette',        value: parsed.palette },
    { key: 'expressions', label: 'Expressions',          value: parsed.expressions?.join(' · ') },
  ].filter((s): s is { key: string; label: string; value: string } => Boolean(s.value));

  const noData = !parsed.hasStructure && lines.length === 0;

  const copyPrompt = async () => {
    if (!fallbackPrompt) return;
    await navigator.clipboard.writeText(fallbackPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-[520px]">
      {/* Character name */}
      <p className="text-[20px] font-bold text-primary leading-tight mb-1">{characterName}</p>

      {/* Subtitle / role */}
      {parsed.subtitle && (
        <p className="text-[14px] font-medium text-on-surface-variant leading-snug mb-2">
          {parsed.subtitle}
        </p>
      )}

      {noData && !fallbackPrompt && (
        <p className="text-xs text-on-surface-variant/50 italic mt-2">No design data found.</p>
      )}

      {noData && fallbackPrompt && (
        <p className="text-[13px] text-[#444] leading-[1.6] mt-2">{fallbackPrompt}</p>
      )}

      {/* Sub-sections */}
      {SUB_SECTIONS.length > 0 && (
        <div className="mt-3 divide-y divide-outline-variant/10">
          {SUB_SECTIONS.map((s) => {
            const allParts = CHIP_SECTIONS.has(s.key)
              ? s.value.split(/[,;·•]+/).map((p) => p.trim().replace(/^[-*]\s*/, '')).filter(Boolean)
              : [];
            const chips      = allParts.filter((p) => p.length > 1 && p.length <= 30 && p.split(/\s+/).length <= 5).slice(0, 5);
            const showChips  = chips.length >= 2;
            const remaining  = showChips ? allParts.filter((p) => !chips.includes(p)).join(', ').trim() : '';
            const bodyText   = showChips ? remaining : s.value;

            return (
              <div key={s.key}>
                <button
                  type="button"
                  onClick={() => toggle(s.key)}
                  className="w-full flex items-center justify-between py-2.5 text-left group/sub"
                >
                  <span
                    className="text-[11px] font-semibold uppercase text-[#888]"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {s.label}
                  </span>
                  <span
                    className="material-symbols-outlined text-sm text-[#bbb] group-hover/sub:text-[#888] transition-all duration-200"
                    style={{ transform: openKeys.has(s.key) ? 'rotate(180deg)' : 'none' }}
                  >
                    expand_more
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-200 ease-in-out ${
                    openKeys.has(s.key) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="pb-3 space-y-2">
                      {showChips && (
                        <div className="flex flex-wrap gap-1.5">
                          {chips.map((chip, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-container border border-outline-variant/20 text-on-surface-variant"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      )}
                      {bodyText && (
                        <p className="text-[13px] text-[#444] leading-[1.6]">{bodyText}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!SUB_SECTIONS.length && lines.length > 0 && (
        <Markdown className="text-xs [&>*:last-child]:mb-0 mt-3">{lines.join('\n')}</Markdown>
      )}

      {/* AI Image Prompt — dark code block with copy button */}
      {fallbackPrompt && (
        <div className={SUB_SECTIONS.length > 0 ? 'mt-4 pt-3 border-t border-outline-variant/10' : 'mt-3'}>
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-sm">
              {showPrompt ? 'expand_less' : 'code'}
            </span>
            {showPrompt ? 'Hide AI Image Prompt' : 'View AI Image Prompt'}
          </button>
          {showPrompt && (
            <div className="mt-2 rounded-xl overflow-hidden border border-outline-variant/10">
              <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d]">
                <span
                  className="text-[10px] font-mono text-[#888] uppercase"
                  style={{ letterSpacing: '0.1em' }}
                >
                  AI Image Prompt
                </span>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#aaa] hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="px-3 py-3 text-[12px] font-mono text-[#d4d4d4] leading-relaxed bg-[#1e1e1e] overflow-x-auto whitespace-pre-wrap break-all">
                {fallbackPrompt}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────────

function SkeletonLines({ count = 4 }: { count?: number }) {
  const widths = [88, 72, 84, 60, 78];
  return (
    <div className="space-y-2.5 motion-safe:animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-on-surface/[0.08]"
          style={{ width: `${widths[i % widths.length]}%` }}
        />
      ))}
    </div>
  );
}

// ── Section accordion (Design Sheets tab) ────────────────────────────────────

interface SectionAccordionProps {
  section:        ParsedSection;
  displayContent: string;
  isOpen:         boolean;
  onToggle:       () => void;
  isStreaming:    boolean;
  isEdited:       boolean;
  isEditing:      boolean;
  editBuffer:     string;
  onEditStart:    () => void;
  onEditChange:   (v: string) => void;
  onEditSave:     () => void;
  onEditCancel:   () => void;
}

const SectionAccordion = React.forwardRef<HTMLDivElement, SectionAccordionProps>(
  (
    {
      section, displayContent, isOpen, onToggle, isStreaming,
      isEdited, isEditing, editBuffer,
      onEditStart, onEditChange, onEditSave, onEditCancel,
    },
    ref,
  ) => {
    const { status, title } = section;
    const isSkeleton   = status === 'skeleton';
    const isActive     = status === 'active';
    const showEditBtn  = isOpen && !isStreaming && !isSkeleton;
    const taRef        = useRef<HTMLTextAreaElement>(null);

    const insertMarkdown = (before: string, after: string) => {
      const ta = taRef.current;
      if (!ta) return;
      const start  = ta.selectionStart;
      const end    = ta.selectionEnd;
      const sel    = editBuffer.slice(start, end);
      const newVal = editBuffer.slice(0, start) + before + sel + after + editBuffer.slice(end);
      onEditChange(newVal);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + before.length, start + before.length + sel.length);
      });
    };

    return (
      <div ref={ref} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
          className="w-full flex items-center justify-between px-5 py-4 text-left gap-3 cursor-pointer select-none group/header"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isSkeleton && (
              <span className="w-2 h-2 rounded-full bg-on-surface/15 flex-shrink-0 motion-safe:animate-pulse" />
            )}
            {isActive && (
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 motion-safe:animate-pulse" />
            )}
            {status === 'complete' && (
              <span
                className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            )}
            <span className={`font-semibold text-sm truncate ${isSkeleton ? 'text-on-surface-variant/50' : 'text-on-surface'}`}>
              {title}
            </span>
            {isEdited && (
              <span
                className="material-symbols-outlined text-sm text-amber-400 flex-shrink-0"
                title="Manually edited"
              >
                edit
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showEditBtn && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (!isEditing) onEditStart(); }}
                title="Edit this section"
                className={`flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface px-2 py-1 rounded-lg hover:bg-surface-container transition-all ${
                  isEditing ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'
                }`}
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
            )}
            <span
              className="material-symbols-outlined text-lg text-on-surface-variant transition-transform flex-shrink-0"
              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              expand_more
            </span>
          </div>
        </div>

        {isOpen && (
          <div className="px-5 pb-5 border-t border-outline-variant/10">
            {isEditing ? (
              <div className="space-y-2 pt-4">
                {/* Markdown toolbar */}
                <div className="flex items-center gap-1 pb-2 border-b border-outline-variant/10">
                  <button type="button" onClick={() => insertMarkdown('**', '**')} title="Bold"
                    className="px-2 py-1 text-xs font-bold rounded hover:bg-surface-container transition-colors">B</button>
                  <button type="button" onClick={() => insertMarkdown('*', '*')} title="Italic"
                    className="px-2 py-1 text-xs italic rounded hover:bg-surface-container transition-colors">I</button>
                  <button type="button" onClick={() => insertMarkdown('\n- ', '')} title="Bullet list"
                    className="px-2 py-1 text-xs rounded hover:bg-surface-container transition-colors">• List</button>
                  <div className="flex-1" />
                  <button type="button" onClick={onEditCancel}
                    className="px-3 py-1.5 text-xs rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={onEditSave}
                    className="px-3 py-1.5 text-xs rounded-xl bg-gray-900 text-white hover:opacity-90 font-semibold transition-opacity">
                    Save changes
                  </button>
                </div>
                <textarea
                  ref={taRef}
                  value={editBuffer}
                  onChange={(e) => onEditChange(e.target.value)}
                  className="w-full min-h-[220px] rounded-xl bg-surface-container px-4 py-3 text-sm font-mono focus:outline-none border border-outline-variant/20 focus:border-primary/40 resize-y leading-relaxed"
                />
              </div>
            ) : isSkeleton ? (
              <div className="pt-4"><SkeletonLines /></div>
            ) : displayContent ? (
              <div className="pt-4">
                <Markdown className="[&>*:last-child]:mb-0">{displayContent}</Markdown>
              </div>
            ) : isActive ? (
              <div className="pt-4"><SkeletonLines count={3} /></div>
            ) : null}
          </div>
        )}
      </div>
    );
  },
);
SectionAccordion.displayName = 'SectionAccordion';

// ── Design sheets right panel ─────────────────────────────────────────────────

function DesignSheetsRightPanel({
  sections,
  isStreaming,
  progressCount,
  activeSectionTitle,
  approvedAt,
  onScrollTo,
  state,
  reviewedSections,
}: {
  sections:             ParsedSection[];
  isStreaming:          boolean;
  progressCount:        number;
  activeSectionTitle?:  string;
  approvedAt:           string | null;
  onScrollTo:           (id: DesignSectionId) => void;
  state:                State;
  reviewedSections:     Set<number>;
}) {
  const reviewedCount = sections.filter((s) => reviewedSections.has(s.id)).length;

  const SectionDot = ({ sec }: { sec: ParsedSection }) => {
    if (isStreaming) {
      if (sec.status === 'active') {
        return <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 motion-safe:animate-pulse" />;
      }
      if (sec.status === 'complete') {
        return (
          <span
            className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
        );
      }
      return <span className="w-2.5 h-2.5 rounded-full bg-on-surface/15 flex-shrink-0 motion-safe:animate-pulse" />;
    }
    if (reviewedSections.has(sec.id)) {
      return (
        <span
          className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
      );
    }
    return <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-400 flex-shrink-0" />;
  };

  return (
    <div className="space-y-5">
      {isStreaming && progressCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Progress</p>
            <span className="text-xs text-on-surface-variant">{progressCount} / {TOTAL_SECTIONS}</span>
          </div>
          <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.round((progressCount / TOTAL_SECTIONS) * 100)}%` }}
            />
          </div>
          {activeSectionTitle && (
            <p className="text-[11px] text-on-surface-variant mt-1.5 truncate">
              Designing: {activeSectionTitle}
            </p>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Sections</p>
          {!isStreaming && (
            <span className="text-[11px] text-on-surface-variant tabular-nums">
              {reviewedCount} / {TOTAL_SECTIONS} reviewed{reviewedCount === TOTAL_SECTIONS ? ' ✅' : ''}
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => onScrollTo(sec.id)}
              className="w-full flex items-center gap-2.5 text-left py-1.5 px-2 rounded-xl hover:bg-surface-container transition-colors"
            >
              <SectionDot sec={sec} />
              <span className={`text-xs truncate ${
                isStreaming && sec.status === 'active' ? 'text-blue-600 font-semibold' :
                sec.status === 'skeleton'              ? 'text-on-surface-variant/40' :
                                                         'text-on-surface-variant'
              }`}>
                {sec.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {state === 4 && approvedAt && (
        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/15 p-4 text-center">
          <span
            className="material-symbols-outlined text-2xl text-emerald-500 mb-1 block"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            task_alt
          </span>
          <p className="text-xs text-emerald-600 font-semibold">Approved</p>
          <p className="text-[10px] text-emerald-500/70 mt-0.5">
            {new Date(approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Candidate type ────────────────────────────────────────────────────────────

type Candidate = { id: string; imageUrl: string; createdAt: string };

// ── Version filmstrip ─────────────────────────────────────────────────────────

function VersionFilmstrip({
  versions,
  activeVersion,
  selectedCandidateId,
  onVersionChange,
  onAddVersion,
  disabled,
  ratingByVersion,
}: {
  versions:            Candidate[][];
  activeVersion:       number;
  selectedCandidateId: string | null;
  onVersionChange:     (v: number) => void;
  onAddVersion:        () => void;
  disabled:            boolean;
  ratingByVersion?:    Record<number, string>;
}) {
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1">
      {versions.map((vCandidates, vIdx) => {
        const hasSelection = vCandidates.some((c) => c.id === selectedCandidateId);
        const isActive     = activeVersion === vIdx;
        const thumb        = vCandidates[0];
        return (
          <button
            key={vIdx}
            type="button"
            onClick={() => onVersionChange(vIdx)}
            className="flex-shrink-0 flex flex-col items-center gap-1"
          >
            <div
              className={`relative w-20 h-20 rounded-xl overflow-hidden transition-all duration-200 ${
                isActive
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface'
                  : 'ring-1 ring-outline-variant/20 opacity-60 hover:opacity-90 hover:ring-outline-variant/40'
              }`}
            >
              {thumb ? (
                <Image src={thumb.imageUrl} alt={`V${vIdx + 1}`} fill className="object-cover" unoptimized />
              ) : (
                <div className="w-full h-full bg-surface-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-surface-variant/30 text-2xl">image</span>
                </div>
              )}
              {hasSelection && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-sm">
                  <span
                    className="material-symbols-outlined text-white"
                    style={{ fontSize: '10px', fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              )}
            </div>
            <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isActive ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>
              V{vIdx + 1}
              {ratingByVersion?.[vIdx] && (
                <span className="text-[11px] leading-none">
                  {CHAR_REACTIONS.find((r) => r.id === ratingByVersion[vIdx])?.emoji}
                </span>
              )}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAddVersion}
        disabled={disabled}
        title="Generate new version"
        className="flex-shrink-0 flex flex-col items-center gap-1 group/add disabled:opacity-40"
      >
        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-outline-variant/30 group-hover/add:border-primary/40 flex items-center justify-center transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant/40 group-hover/add:text-primary/60 text-2xl transition-colors">
            add
          </span>
        </div>
        <span className="text-[10px] font-bold text-on-surface-variant/40">New</span>
      </button>
    </div>
  );
}

// ── Character rating constants ────────────────────────────────────────────────

const CHAR_REACTIONS = [
  { id: 'love',    emoji: '😍', label: 'Perfect', tooltip: 'nails the character exactly', bg: '#F0FDF4', border: '#86EFAC', color: '#166534' },
  { id: 'good',    emoji: '👍', label: 'Close',   tooltip: 'mostly right, minor issues',  bg: '#EFF6FF', border: '#93C5FD', color: '#1E40AF' },
  { id: 'neutral', emoji: '😐', label: 'Okay',    tooltip: 'acceptable but not ideal',    bg: '#FFFBEB', border: '#FCD34D', color: '#92400E' },
  { id: 'bad',     emoji: '👎', label: 'Off',     tooltip: "doesn't match my vision",     bg: '#FEF2F2', border: '#FCA5A5', color: '#991B1B' },
] as const;

type CharReaction = typeof CHAR_REACTIONS[number]['id'];

const CHAR_CHIPS = [
  { id: 'age_wrong',       label: '👤 Wrong age'        },
  { id: 'hair_wrong',      label: '💇 Hair is wrong'    },
  { id: 'eyes_wrong',      label: '👁 Wrong eyes'       },
  { id: 'outfit_wrong',    label: '👗 Outfit incorrect'  },
  { id: 'personality_off', label: '🎭 Personality'      },
  { id: 'build_wrong',     label: '📏 Wrong build'      },
  { id: 'color_wrong',     label: '🎨 Color wrong'      },
  { id: 'missing_details', label: '✨ Missing details'   },
] as const;

// ── Character rating widget ───────────────────────────────────────────────────

function CharacterRatingWidget({
  reaction,
  chips,
  feedback,
  onRate,
  onToggleChip,
  onFeedbackChange,
}: {
  reaction:         CharReaction | null;
  chips:            string[];
  feedback:         string;
  onRate:           (r: CharReaction) => void;
  onToggleChip:     (chipId: string) => void;
  onFeedbackChange: (text: string) => void;
}) {
  const showPositive = reaction === 'love' || reaction === 'good';
  const showNegative = reaction === 'neutral' || reaction === 'bad';

  return (
    <div className="space-y-3 pt-3 border-t border-outline-variant/10">
      <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>
        How well does this match your vision?
      </p>

      <div className="flex flex-wrap gap-2">
        {CHAR_REACTIONS.map((r) => {
          const sel = reaction === r.id;
          return (
            <button
              key={r.id}
              type="button"
              title={r.tooltip}
              onClick={() => onRate(r.id)}
              className="flex items-center gap-1.5 h-9 rounded-[20px] text-sm font-medium transition-all"
              style={{
                padding:    '0 14px',
                background: sel ? r.bg    : 'white',
                border:     `1px solid ${sel ? r.border : '#E5E7EB'}`,
                color:      sel ? r.color : '#374151',
              }}
            >
              <span>{r.emoji}</span>
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {showPositive && (
        <p className="text-[12px] text-emerald-600 font-medium leading-snug">
          Great! This character will be used as reference for all panels they appear in.
        </p>
      )}

      {showNegative && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>
            What&apos;s off? (select all that apply)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CHAR_CHIPS.map((chip) => {
              const chipSel = chips.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onToggleChip(chip.id)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                  style={{
                    background: chipSel ? '#1e40af' : 'white',
                    color:      chipSel ? 'white'   : '#374151',
                    border:     `1px solid ${chipSel ? '#1e40af' : '#E5E7EB'}`,
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#9CA3AF] mb-1">What&apos;s missing? (optional)</p>
            <textarea
              value={feedback}
              onChange={(e) => onFeedbackChange(e.target.value)}
              rows={2}
              className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder-gray-400 border border-gray-200 outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
              placeholder="Describe what's wrong or missing…"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Image generation panel (right column of accordion) ───────────────────────

function ImageGenPanel({
  character,
  settings,
  aspectRatio,
  versions,
  activeVersion,
  onVersionChange,
  isApproved,
  isAnyGenerating,
  onRegenerate,
  onSelectCandidate,
  onUpdateSettings,
  onAspectRatioChange,
  onApprove,
  onRevoke,
  charRating,
  charChips,
  charFeedback,
  onCharRate,
  onChipToggle,
  onFeedbackChange,
  approveWarning,
  onApproveAnyway,
  onRegenInstead,
  ratingByVersion,
}: {
  character: {
    characterId:         string;
    name:                string;
    prompt:              string;
    status:              string;
    error:               string | null;
    candidates:          Candidate[];
    selectedCandidateId: string | null;
  };
  settings:            ImageGenSettings;
  aspectRatio:         string;
  versions:            Candidate[][];
  activeVersion:       number;
  onVersionChange:     (v: number) => void;
  isApproved:          boolean;
  isAnyGenerating:     boolean;
  onRegenerate:        () => void;
  onSelectCandidate:   (id: string) => void;
  onUpdateSettings:    (s: ImageGenSettings) => void;
  onAspectRatioChange: (r: string) => void;
  onApprove:           () => void;
  onRevoke:            () => void;
  // Rating widget
  charRating:          CharReaction | null;
  charChips:           string[];
  charFeedback:        string;
  onCharRate:          (r: CharReaction) => void;
  onChipToggle:        (chipId: string) => void;
  onFeedbackChange:    (text: string) => void;
  approveWarning:      boolean;
  onApproveAnyway:     () => void;
  onRegenInstead:      () => void;
  ratingByVersion:     Record<number, string>;
}) {
  const isLoading        = character.status === 'loading';
  const isFailed         = character.status === 'error';
  const activeCandidates = versions[activeVersion] ?? [];
  const hasAnyImages     = character.candidates.length > 0;

  return (
    <div className="space-y-4">
      {/* Version filmstrip — shown when at least one version exists */}
      {versions.length > 0 && (
        <VersionFilmstrip
          versions={versions}
          activeVersion={activeVersion}
          selectedCandidateId={character.selectedCandidateId}
          onVersionChange={(v) => { onVersionChange(v); }}
          onAddVersion={onRegenerate}
          disabled={isAnyGenerating}
          ratingByVersion={ratingByVersion}
        />
      )}

      {/* Image area */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl bg-surface-container h-40">
          <span className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Generating…
          </span>
        </div>
      ) : activeCandidates.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {activeCandidates.map((candidate) => {
            const sel = candidate.id === character.selectedCandidateId;
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelectCandidate(candidate.id)}
                className={`group/img relative rounded-2xl overflow-hidden transition-all duration-200 ${
                  sel
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface'
                    : 'ring-1 ring-outline-variant/20 hover:ring-outline-variant/40'
                }`}
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    src={candidate.imageUrl}
                    alt={character.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover/img:scale-105"
                    unoptimized
                  />
                  {sel && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md z-10">
                      <span
                        className="material-symbols-outlined text-white"
                        style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    </div>
                  )}
                </div>
                <div
                  className={`px-3 py-2 text-xs font-bold flex items-center gap-1 ${
                    sel ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {sel && (
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  )}
                  {sel ? 'Selected' : 'Select'}
                </div>
              </button>
            );
          })}
        </div>
      ) : !hasAnyImages ? (
        /* Empty state */
        <div className="relative rounded-2xl border-2 border-dashed border-primary/20 bg-primary/[0.02] py-10 px-4 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent motion-safe:animate-pulse" />
          <div className="relative space-y-3">
            <span className="text-3xl text-primary/30 block leading-none">✦</span>
            <div>
              <p className="text-sm font-semibold text-on-surface">No images yet</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Generate the first reference image</p>
            </div>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isAnyGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-on-primary font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity shadow-md shadow-primary/20"
            >
              <span className="text-sm">✦</span>
              Generate First Image
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-2xl bg-surface-container h-24">
          <p className="text-xs text-on-surface-variant">No images in this version</p>
        </div>
      )}

      {isFailed && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">error</span>
          {character.error ?? 'Generation failed'}
        </p>
      )}

      {/* Aspect ratio */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Aspect Ratio</p>
        <AspectRatioPills value={aspectRatio} onChange={onAspectRatioChange} disabled={isAnyGenerating} />
      </div>

      {/* Generation mode */}
      <GenerationModePanel value={settings} onChange={onUpdateSettings} disabled={isAnyGenerating} />

      {/* Rating widget — only after at least one image exists */}
      {hasAnyImages && (
        <CharacterRatingWidget
          reaction={charRating}
          chips={charChips}
          feedback={charFeedback}
          onRate={onCharRate}
          onToggleChip={onChipToggle}
          onFeedbackChange={onFeedbackChange}
        />
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/10">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isAnyGenerating}
          className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 rounded-2xl text-xs font-bold border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          {character.candidates.length > 0 ? 'Regenerate' : 'Generate'}
        </button>
        {isApproved ? (
          <button
            type="button"
            onClick={onRevoke}
            className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 rounded-2xl text-xs font-semibold text-emerald-600 hover:bg-emerald-500/5 border border-emerald-500/20 transition-colors"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Approved — Revoke
          </button>
        ) : (
          <button
            type="button"
            onClick={onApprove}
            disabled={isAnyGenerating || !character.selectedCandidateId}
            title={!character.selectedCandidateId ? 'Select an image first' : undefined}
            className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 rounded-2xl text-xs font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Approve
          </button>
        )}
      </div>

      {/* Approve warning — shown when user rated poorly and clicks Approve */}
      {approveWarning && !isApproved && (
        <div className="p-3 rounded-xl space-y-2" style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
          <p className="text-sm font-semibold text-amber-900">
            ⚠ You rated this design as &ldquo;{charRating === 'neutral' ? 'Okay' : 'Off'}&rdquo;
          </p>
          <p className="text-xs text-amber-800 leading-snug">
            Approving will use this as the character reference in all panels.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={onRegenInstead}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 transition-colors"
            >
              Regenerate instead
            </button>
            <button
              type="button"
              onClick={onApproveAnyway}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              Approve anyway →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Version helpers ───────────────────────────────────────────────────────────

function computeVersions(candidates: Candidate[], boundaries: number[]): Candidate[][] {
  const bounds = boundaries.length > 0 ? boundaries : [0];
  const versions: Candidate[][] = [];
  for (let i = 0; i < bounds.length; i++) {
    const start = bounds[i];
    const end   = i + 1 < bounds.length ? bounds[i + 1] : candidates.length;
    versions.push(candidates.slice(start, end));
  }
  return versions.filter((v) => v.length > 0);
}

// ── Character accordion card ──────────────────────────────────────────────────

function CharacterAccordionCard({
  idx,
  character,
  isExpanded,
  onToggle,
  settings,
  aspectRatio,
  versions,
  activeVersion,
  onVersionChange,
  isApproved,
  isAnyGenerating,
  onRegenerate,
  onSelectCandidate,
  onUpdateSettings,
  onAspectRatioChange,
  onApprove,
  onRevoke,
  designMarkdown,
  projectId,
  onReactionChange,
}: {
  idx:                 number;
  character: {
    characterId:         string;
    name:                string;
    prompt:              string;
    status:              string;
    error:               string | null;
    candidates:          Candidate[];
    selectedCandidateId: string | null;
  };
  isExpanded:          boolean;
  onToggle:            () => void;
  settings:            ImageGenSettings;
  aspectRatio:         string;
  versions:            Candidate[][];
  activeVersion:       number;
  onVersionChange:     (v: number) => void;
  isApproved:          boolean;
  isAnyGenerating:     boolean;
  onRegenerate:        () => void;
  onSelectCandidate:   (id: string) => void;
  onUpdateSettings:    (s: ImageGenSettings) => void;
  onAspectRatioChange: (r: string) => void;
  onApprove:           () => void;
  onRevoke:            () => void;
  designMarkdown:      string | null;
  projectId:           string;
  onReactionChange:    (charId: string, version: number, reaction: CharReaction | null) => void;
}) {
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [ratingByVersion, setRatingByVersion]   = useState<Record<number, CharReaction>>({});
  const [chipsByVersion, setChipsByVersion]     = useState<Record<number, string[]>>({});
  const [ratingFeedback, setRatingFeedback]     = useState('');
  const [approveWarning, setApproveWarning]     = useState(false);

  const currentRating = ratingByVersion[activeVersion] ?? null;
  const currentChips  = chipsByVersion[activeVersion]  ?? [];

  const handleRate = useCallback((r: CharReaction) => {
    setRatingByVersion((prev) => ({ ...prev, [activeVersion]: r }));
    setApproveWarning(false);
    onReactionChange(character.characterId, activeVersion, r);
    apiClient.post('/ratings/character', {
      character_id:   character.characterId,
      comic_id:       projectId,
      version:        activeVersion,
      reaction:       r,
      chips_selected: chipsByVersion[activeVersion] ?? [],
      feedback_text:  ratingFeedback,
    }).catch(() => {/* fire-and-forget */});
  }, [activeVersion, character.characterId, chipsByVersion, onReactionChange, projectId, ratingFeedback]);

  const handleChipToggle = useCallback((chipId: string) => {
    setChipsByVersion((prev) => {
      const existing = prev[activeVersion] ?? [];
      const next = existing.includes(chipId)
        ? existing.filter((c) => c !== chipId)
        : [...existing, chipId];
      return { ...prev, [activeVersion]: next };
    });
    const chipLabel = CHAR_CHIPS.find((c) => c.id === chipId)?.label ?? chipId;
    const cleanLabel = chipLabel.replace(/^\p{Emoji}+\s*/u, '');
    setRatingFeedback((prev) => {
      const trimmed = prev.trim();
      if (trimmed.toLowerCase().includes(cleanLabel.toLowerCase())) return prev;
      return trimmed ? `${trimmed}, ${cleanLabel}` : cleanLabel;
    });
  }, [activeVersion]);

  const logCharApproved = useCallback(() => {
    apiClient.post('/analytics/log', {
      event: 'character_approved',
      data: {
        character_id: character.characterId,
        comic_id:     projectId,
        version:      activeVersion,
        reaction:     currentRating ?? 'unrated',
      },
    }).catch(() => {/* fire-and-forget */});
  }, [character.characterId, projectId, activeVersion, currentRating]);

  const handleApproveWithCheck = useCallback(() => {
    if (currentRating === 'neutral' || currentRating === 'bad') {
      setApproveWarning(true);
    } else {
      logCharApproved();
      onApprove();
    }
  }, [currentRating, onApprove, logCharApproved]);

  const handleApproveAnyway = useCallback(() => {
    setApproveWarning(false);
    logCharApproved();
    onApprove();
  }, [onApprove, logCharApproved]);

  const handleRegenInstead = useCallback(() => {
    setApproveWarning(false);
    onRegenerate();
  }, [onRegenerate]);

  const selectedCandidate = character.candidates.find((c) => c.id === character.selectedCandidateId) ?? null;
  const isLoading = character.status === 'loading';

  const cardStatus: 'draft' | 'generated' | 'approved' = isApproved
    ? 'approved'
    : character.candidates.length > 0
      ? 'generated'
      : 'draft';

  const handleRegenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isApproved) { setShowRegenConfirm(true); } else { onRegenerate(); }
  };

  const handleConfirmRegen = () => {
    setShowRegenConfirm(false);
    onRevoke();
    onRegenerate();
  };

  return (
    <>
      <div
        className={`rounded-2xl bg-surface-container-lowest overflow-hidden transition-all duration-200 ${
          isExpanded
            ? 'border border-outline-variant/20 border-l-[3px] border-l-primary shadow-sm'
            : 'border border-outline-variant/10'
        }`}
      >
        {/* ── Compact header row ── */}
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          {/* Thumbnail */}
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-surface-container flex-shrink-0">
            {selectedCandidate ? (
              <Image src={selectedCandidate.imageUrl} alt={character.name} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant/30 text-xl">
                  {isLoading ? 'hourglass_empty' : 'person'}
                </span>
              </div>
            )}
            {isLoading && (
              <div className="absolute inset-0 bg-surface-container/80 flex items-center justify-center">
                <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-bold text-on-surface-variant/30 flex-shrink-0">#{idx + 1}</span>
              <p className="font-semibold text-sm text-on-surface truncate">{character.name}</p>
              {currentRating && (
                <span className="text-sm leading-none flex-shrink-0" title={`Rated: ${CHAR_REACTIONS.find((r) => r.id === currentRating)?.label}`}>
                  {CHAR_REACTIONS.find((r) => r.id === currentRating)?.emoji}
                </span>
              )}
            </div>
            {character.candidates.length > 0 && (
              <p className="text-[10px] text-on-surface-variant/50 mt-0.5 truncate">
                {character.candidates.length} image{character.candidates.length !== 1 ? 's' : ''}
                {character.selectedCandidateId ? ' · 1 selected' : ' · none selected'}
              </p>
            )}
          </div>

          {/* Status + chevron */}
          <CharacterStatusBadge status={cardStatus} />
          <span
            className="material-symbols-outlined text-on-surface-variant/60 transition-transform duration-200 flex-shrink-0"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
          >
            expand_more
          </span>
        </button>

        {/* ── Collapsed quick actions ── */}
        {!isExpanded && (
          <div className="px-4 pb-3 flex items-center gap-2 border-t border-outline-variant/10 pt-2.5">
            <button
              type="button"
              onClick={handleRegenClick}
              disabled={isAnyGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                {character.candidates.length > 0 ? 'refresh' : 'image'}
              </span>
              {character.candidates.length > 0 ? 'Regenerate' : 'Generate'}
            </button>
            {isApproved ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRevoke(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-600 hover:bg-emerald-500/10 transition-colors"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Approved — Revoke
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                disabled={isAnyGenerating || !character.selectedCandidateId}
                title={!character.selectedCandidateId ? 'Select an image first' : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-900 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Approve
              </button>
            )}
          </div>
        )}

        {/* ── Expanded content (smooth CSS grid animation) ── */}
        <div
          className={`grid transition-all duration-200 ease-in-out ${
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-outline-variant/10 grid grid-cols-1 md:grid-cols-2">
              {/* Left — design info */}
              <div className="p-5 md:border-r border-outline-variant/10 border-b md:border-b-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Design Sheet</p>
                <CharacterDesignInfo
                  characterName={character.name}
                  designMarkdown={designMarkdown}
                  fallbackPrompt={character.prompt}
                />
              </div>
              {/* Right — image gen panel */}
              <div className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Reference Images</p>
                <ImageGenPanel
                  character={character}
                  settings={settings}
                  aspectRatio={aspectRatio}
                  versions={versions}
                  activeVersion={activeVersion}
                  onVersionChange={onVersionChange}
                  isApproved={isApproved}
                  isAnyGenerating={isAnyGenerating}
                  onRegenerate={() => { if (isApproved) { setShowRegenConfirm(true); } else { onRegenerate(); } }}
                  onSelectCandidate={onSelectCandidate}
                  onUpdateSettings={onUpdateSettings}
                  onAspectRatioChange={onAspectRatioChange}
                  onApprove={handleApproveWithCheck}
                  onRevoke={onRevoke}
                  charRating={currentRating}
                  charChips={currentChips}
                  charFeedback={ratingFeedback}
                  onCharRate={handleRate}
                  onChipToggle={handleChipToggle}
                  onFeedbackChange={setRatingFeedback}
                  approveWarning={approveWarning}
                  onApproveAnyway={handleApproveAnyway}
                  onRegenInstead={handleRegenInstead}
                  ratingByVersion={ratingByVersion}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-card regen confirm */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
              </div>
              <div>
                <p className="font-bold text-gray-900">Regenerate {character.name}?</p>
                <p className="text-sm text-gray-500 mt-1">This will remove the current approval and generate new images.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowRegenConfirm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmRegen} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity">
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Step2Characters() {
  const {
    step2,
    step2ImageReview,
    handleGenerate,
    handleApprove,
    handleRevokeApproval,
    handleRetry,
    handleGenerateCharacterReferences,
    handleRegenerateCharacterImage,
    handleSelectCharacterCandidate,
    handleApproveCharacterReferences,
    handleRetryCharacterReferences,
    getCooldownSeconds,
    injectLibraryCharacters,
    setActiveStep,
    projectId,
  } = useComicGeneration();

  // ── Reference Images tab state ────────────────────────────────────────────
  const [charSettings, setCharSettings]               = useState<Record<string, ImageGenSettings>>({});
  const [aspectRatioMap, setAspectRatioMap]           = useState<Record<string, string>>({});
  const [approvedCharIds, setApprovedCharIds]         = useState<Set<string>>(new Set());
  const [expandedCharIds, setExpandedCharIds]         = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab]                     = useState<'designs' | 'references'>('designs');
  const [isLibraryOpen, setIsLibraryOpen]             = useState(false);
  const [isGalleryOpen, setIsGalleryOpen]             = useState(false);
  const [showRegenConfirm, setShowRegenConfirm]       = useState(false);
  const [showRegenAllConfirm, setShowRegenAllConfirm] = useState(false);
  const [showSelectionAlert, setShowSelectionAlert]   = useState(false);
  const [versionBoundaries, setVersionBoundaries]     = useState<Record<string, number[]>>({});
  const [activeVersionTabs, setActiveVersionTabs]     = useState<Record<string, number>>({});
  const [charRegenModal, setCharRegenModal]           = useState<{ charId: string; charName: string; settings: ImageGenSettings } | null>(null);
  const [allCharReactions, setAllCharReactions]       = useState<Record<string, Record<number, string>>>({});
  const [showCharSetRating, setShowCharSetRating]     = useState(false);
  const stepStartRef = useRef(Date.now());

  // ── Design Sheets accordion state ─────────────────────────────────────────
  const [openSections, setOpenSections]           = useState<Set<number>>(new Set([1]));
  const [reviewedSections, setReviewedSections]   = useState<Set<number>>(new Set());
  const [showReviewWarning, setShowReviewWarning] = useState(false);
  const [editedContent, setEditedContent]         = useState<Map<number, string>>(new Map());
  const [editingSection, setEditingSection]       = useState<number | null>(null);
  const [editBuffer, setEditBuffer]               = useState('');
  const [showEditedWarning, setShowEditedWarning] = useState(false);
  const prevActiveRef = useRef<number | null>(null);
  const wasLoadingRef = useRef(false);
  const prevStateRef  = useRef<State>(1);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getCharSettings    = (id: string): ImageGenSettings => charSettings[id] ?? DEFAULT_SETTINGS;
  const updateCharSettings = (id: string, s: ImageGenSettings) =>
    setCharSettings((prev) => ({ ...prev, [id]: s }));
  const getAspectRatio     = (id: string): string => aspectRatioMap[id] ?? '2:3';
  const updateAspectRatio  = (id: string, r: string) =>
    setAspectRatioMap((prev) => ({ ...prev, [id]: r }));

  const approveChar = (id: string) =>
    setApprovedCharIds((prev) => new Set([...prev, id]));
  const revokeChar  = (id: string) =>
    setApprovedCharIds((prev) => { const n = new Set(prev); n.delete(id); return n; });

  const toggleCharExpanded = (id: string) =>
    setExpandedCharIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const cooldown      = getCooldownSeconds(2);
  const isGenerating  = step2.isLoading;
  const canGenerate   = !isGenerating && cooldown === 0;

  const characters        = (step2ImageReview.data?.characters ?? []).filter(
    (c) => !/^\d+[\.\)]\s/.test(c.name.trim()),
  );
  const isImageGenerating    = !!step2ImageReview.data?.isGenerating;
  const existingCharacterIds = new Set(characters.map((c) => c.characterId));

  let state: State = 1;
  if (isGenerating)                                              state = 2;
  else if (step2.isApproved && !step2.regeneratedAfterApproval) state = 4;
  else if (step2.data && step2.regeneratedAfterApproval)        state = 5;
  else if (step2.data)                                          state = 3;

  const approvedCount      = approvedCharIds.size;
  const allCharsApproved   = characters.length === 0 || approvedCount === characters.length;
  const generatedCount     = characters.filter((c) => c.candidates.length > 0 && !approvedCharIds.has(c.characterId)).length;
  const noCandidatesCount  = characters.filter((c) => c.candidates.length === 0).length;
  const pendingCount       = characters.filter((c) => !approvedCharIds.has(c.characterId)).length;
  const charsWithCandidates = characters.filter((c) => c.candidates.length > 0);
  const charsWithSelection  = charsWithCandidates.filter((c) => c.selectedCandidateId !== null);
  const allCharsHaveSelection = charsWithCandidates.length === 0 ||
    charsWithCandidates.every((c) => c.selectedCandidateId !== null);

  // ── Section parsing ───────────────────────────────────────────────────────
  const streamText = isGenerating
    ? (step2.streamingText ?? '')
    : (step2.data?.designMarkdown ?? '');

  const parsedSections = useMemo<ParsedSection[]>(() => {
    if (state === 1) {
      return DESIGN_SECTION_DEFS.map((def) => ({
        id: def.id, title: def.title, content: '', status: 'skeleton' as const,
      }));
    }
    const result = parseDesignSections(streamText);
    if (!isGenerating && step2.data && !result.some((s) => s.content !== '')) {
      return result.map((s, i) => ({
        ...s,
        content: i === 0 ? step2.data!.designMarkdown : '',
        status: 'complete' as const,
      }));
    }
    return result;
  }, [streamText, state, isGenerating]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreviewedSections = useMemo(
    () => parsedSections.filter((s) => s.status === 'complete' && !reviewedSections.has(s.id)),
    [parsedSections, reviewedSections],
  );

  useEffect(() => {
    if (showReviewWarning && unreviewedSections.length === 0) setShowReviewWarning(false);
  }, [showReviewWarning, unreviewedSections.length]);

  useEffect(() => {
    if (isGenerating && !wasLoadingRef.current) {
      setOpenSections(new Set([1]));
      prevActiveRef.current = null;
    }
    wasLoadingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    if (state >= 3 && prevStateRef.current === 2) {
      setReviewedSections(new Set());
      setOpenSections(new Set([1]));
    }
    prevStateRef.current = state;
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const active = parsedSections.find((s) => s.status === 'active');
    if (active && active.id !== prevActiveRef.current) {
      prevActiveRef.current = active.id;
      setOpenSections((prev) => new Set([...prev, active.id]));
    }
  }, [parsedSections]);

  // ── Section refs for scroll-to ────────────────────────────────────────────
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollTo = (id: DesignSectionId) => {
    sectionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const toggleSection = (id: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setReviewedSections((r) => new Set([...r, id]));
      }
      return next;
    });
  };

  // ── Progress counters ─────────────────────────────────────────────────────
  const completedCount   = parsedSections.filter((s) => s.status === 'complete').length;
  const activeSectionObj = parsedSections.find((s) => s.status === 'active');
  const progressCount    = completedCount + (activeSectionObj ? 1 : 0);

  // ── Version boundaries init ───────────────────────────────────────────────
  useEffect(() => {
    setVersionBoundaries((prev) => {
      const updated = { ...prev };
      let changed = false;
      for (const char of characters) {
        if (updated[char.characterId] === undefined) { updated[char.characterId] = [0]; changed = true; }
      }
      return changed ? updated : prev;
    });
    setActiveVersionTabs((prev) => {
      const updated = { ...prev };
      let changed = false;
      for (const char of characters) {
        if (updated[char.characterId] === undefined) { updated[char.characterId] = 0; changed = true; }
      }
      return changed ? updated : prev;
    });
  }, [characters]);

  // Pre-populate approvedCharIds on reload
  useEffect(() => {
    if (step2ImageReview.isApproved && characters.length > 0) {
      setApprovedCharIds(
        new Set(characters.filter((c) => c.selectedCandidateId).map((c) => c.characterId)),
      );
    }
  }, [step2ImageReview.isApproved, characters]);

  const handleCharacterVersionedRegenerate = useCallback(
    (charId: string, settings: ImageGenSettings, feedback?: string) => {
      const char = characters.find((c) => c.characterId === charId);
      if (!char) return;
      const currentCount = char.candidates.length;
      const newVersionIdx = (versionBoundaries[charId]?.length ?? 1);
      revokeChar(charId);
      setVersionBoundaries((prev) => {
        const existing = prev[charId] ?? [0];
        const newBoundaries = [...existing, currentCount];
        setActiveVersionTabs((prevTabs) => ({ ...prevTabs, [charId]: newBoundaries.length - 1 }));
        return { ...prev, [charId]: newBoundaries };
      });
      handleRegenerateCharacterImage(charId, settings, feedback);
      if (projectId) {
        apiClient.post('/analytics/log', {
          event: 'character_generated',
          data: {
            character_id:     charId,
            comic_id:         projectId,
            version:          newVersionIdx,
            generation_mode:  settings.mode,
          },
        }).catch(() => {/* fire-and-forget */});
      }
    },
    [characters, versionBoundaries, revokeChar, handleRegenerateCharacterImage, projectId],
  );

  const handleConfirmRegen = useCallback(() => {
    setShowRegenConfirm(false);
    setApprovedCharIds(new Set());
    setEditedContent(new Map());
    setEditingSection(null);
    setEditBuffer('');
    setShowEditedWarning(false);
    handleGenerate(2);
  }, [handleGenerate]);

  // ── Edit handlers (Design Sheets) ─────────────────────────────────────────
  const handleEditStart = useCallback((id: number) => {
    const current = editedContent.get(id) ?? parsedSections.find((s) => s.id === id)?.content ?? '';
    setEditingSection(id);
    setEditBuffer(current);
  }, [editedContent, parsedSections]);

  const handleEditSave = useCallback(() => {
    if (editingSection === null) return;
    setEditedContent((prev) => {
      const next = new Map(prev);
      next.set(editingSection, editBuffer);
      return next;
    });
    if (editedContent.size === 0) setShowEditedWarning(true);
    setEditingSection(null);
    setEditBuffer('');
  }, [editingSection, editBuffer, editedContent.size]);

  const handleEditCancel = useCallback(() => {
    setEditingSection(null);
    setEditBuffer('');
  }, []);

  const getDisplayContent = useCallback((sec: ParsedSection): string => {
    const raw = editedContent.get(sec.id) ?? sec.content;
    return cleanContent(raw);
  }, [editedContent]);

  const handleReactionChange = useCallback((charId: string, version: number, reaction: CharReaction | null) => {
    setAllCharReactions((prev) => ({
      ...prev,
      [charId]: { ...(prev[charId] ?? {}), [version]: reaction ?? '' },
    }));
  }, []);

  const proceedWithApproval = useCallback(() => {
    if (!step2.isApproved) handleApprove(2);
    handleApproveCharacterReferences();
  }, [step2.isApproved, handleApprove, handleApproveCharacterReferences]);

  const handleApproveAndContinue = useCallback(() => {
    if (step2ImageReview.isApproved) { setActiveStep(3); return; }
    if (!allCharsHaveSelection) { setShowSelectionAlert(true); return; }
    setShowCharSetRating(true);
  }, [step2ImageReview.isApproved, allCharsHaveSelection, setActiveStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCharSetRatingSave = useCallback((stars: number | null, comment: string) => {
    setShowCharSetRating(false);
    if (projectId) {
      const avgVersions = characters.length > 0
        ? characters.reduce((s, c) => s + (versionBoundaries[c.characterId]?.length ?? 1), 0) / characters.length
        : 1;
      const timeSpent = Math.round((Date.now() - stepStartRef.current) / 1000);
      apiClient.post('/ratings/character-set', {
        comic_id:                    projectId,
        stars,
        comment,
        total_characters:            characters.length,
        characters_regenerated:      characters.filter((c) => (versionBoundaries[c.characterId]?.length ?? 1) > 1).length,
        avg_versions_per_character:  avgVersions,
        character_reactions:         allCharReactions,
        time_spent_seconds:          timeSpent,
      }).catch(() => {/* fire-and-forget */});
      apiClient.post('/analytics/log', {
        event: 'step3_completed',
        data: {
          comic_id:           projectId,
          total_characters:   characters.length,
          avg_versions:       Math.round(avgVersions * 10) / 10,
          stars:              stars ?? null,
          time_spent_seconds: timeSpent,
        },
      }).catch(() => {/* fire-and-forget */});
    }
    proceedWithApproval();
  }, [projectId, characters, versionBoundaries, allCharReactions, proceedWithApproval]);

  const handleCharSetRatingSkip = useCallback(() => {
    setShowCharSetRating(false);
    proceedWithApproval();
  }, [proceedWithApproval]);

  const switchToReferencesAndGenerate = useCallback(() => {
    setActiveTab('references');
    if (!step2ImageReview.data) {
      handleGenerateCharacterReferences(charSettings);
    }
  }, [step2ImageReview.data, handleGenerateCharacterReferences, charSettings]);

  const handleDesignApproveClick = useCallback(() => {
    if (state === 4) { switchToReferencesAndGenerate(); return; }
    if (unreviewedSections.length > 0) { setShowReviewWarning(true); return; }
    handleApprove(2);
    switchToReferencesAndGenerate();
  }, [state, unreviewedSections, handleApprove, switchToReferencesAndGenerate]);

  const handleForceApprove = useCallback(() => {
    setShowReviewWarning(false);
    handleApprove(2);
    switchToReferencesAndGenerate();
  }, [handleApprove, switchToReferencesAndGenerate]);

  const scrollToFirstUnreviewed = useCallback(() => {
    const first = unreviewedSections[0];
    if (!first) return;
    scrollTo(first.id as DesignSectionId);
    setOpenSections((prev) => new Set([...prev, first.id]));
    setReviewedSections((prev) => new Set([...prev, first.id]));
    setShowReviewWarning(false);
  }, [unreviewedSections]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <section className="text-on-surface space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Character Designs</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            AI-generated design sheets and reference images for each character
          </p>

          {/* Summary status bar — shown when characters are loaded */}
          {characters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-sm font-semibold text-on-surface">
                {characters.length} Character{characters.length !== 1 ? 's' : ''}
              </span>
              <span className="text-outline-variant/40 select-none">—</span>
              {approvedCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  {approvedCount} Approved
                </span>
              )}
              {generatedCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-blue-600">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  {generatedCount} Generated
                </span>
              )}
              {noCandidatesCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full bg-outline-variant flex-shrink-0" />
                  {noCandidatesCount} Pending
                </span>
              )}
            </div>
          )}
        </div>

        {/* Top-right badge: progress in references tab, state badge in design sheets */}
        {activeTab === 'references' && characters.length > 0 ? (
          <ApprovalProgressBadge approved={approvedCount} total={characters.length} />
        ) : (
          <StateBadge
            state={state}
            streamProgress={isGenerating ? { current: progressCount, total: TOTAL_SECTIONS } : null}
          />
        )}
      </div>

      {/* Error bar */}
      {step2.error && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleRetry(2)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
          >
            <span className="material-symbols-outlined text-base">replay</span>
            Retry
          </button>
          <span className="text-sm text-red-500">{step2.error}</span>
        </div>
      )}

      {/* ── Tab navigation ── */}
      {state >= 2 && (
        <div className="flex gap-1 border-b border-outline-variant/10">
          <button
            type="button"
            onClick={() => setActiveTab('designs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'designs'
                ? 'border-gray-900 text-on-surface'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">description</span>
            Design Sheets
            {state >= 3 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('references')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'references'
                ? 'border-gray-900 text-on-surface'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">image</span>
            Reference Images
            {/*pendingCount > 0 ? (
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 flex-shrink-0 leading-none">
                ⚠️ {pendingCount}
              </span>
            ) : characters.length > 0 ? (
              <span
                className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            ) : null*/}
          </button>
        </div>
      )}

      {/* ══ TAB 1: Design Sheets ══════════════════════════════════════════════ */}
      {(activeTab === 'designs' || state < 2) && (
        <>
          {state === 1 && (
            <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4">
              <span
                className="material-symbols-outlined text-5xl text-outline-variant"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                style
              </span>
              <div className="text-center">
                <p className="font-semibold text-on-surface">No design sheet yet</p>
                <p className="text-sm text-on-surface-variant mt-1">
                  Complete Step 1 analysis first, then generate designs.
                </p>
              </div>
            </div>
          )}

          {state !== 1 && (
            <>
              {/* Edited content warning banner */}
              {showEditedWarning && editedContent.size > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">warning</span>
                  <p className="text-sm text-amber-800 flex-1">
                    Manual edits may affect AI generation in later steps. Regenerating will overwrite your edits.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowEditedWarning(false)}
                    className="text-amber-500 hover:text-amber-700 flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 lg:items-start">
              <div className="space-y-3 max-w-[750px]">
                {parsedSections.map((sec) => (
                  <SectionAccordion
                    key={sec.id}
                    ref={(el) => {
                      if (el) sectionRefs.current.set(sec.id, el);
                      else sectionRefs.current.delete(sec.id);
                    }}
                    section={sec}
                    displayContent={getDisplayContent(sec)}
                    isOpen={openSections.has(sec.id)}
                    onToggle={() => toggleSection(sec.id)}
                    isStreaming={isGenerating}
                    isEdited={editedContent.has(sec.id)}
                    isEditing={editingSection === sec.id}
                    editBuffer={editingSection === sec.id ? editBuffer : ''}
                    onEditStart={() => handleEditStart(sec.id)}
                    onEditChange={setEditBuffer}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                ))}
              </div>

              <div className="lg:sticky lg:top-28 overflow-y-auto max-h-[calc(100vh-10rem)] thin-scrollbar">
                <DesignSheetsRightPanel
                  sections={parsedSections}
                  isStreaming={isGenerating}
                  progressCount={progressCount}
                  activeSectionTitle={activeSectionObj?.title}
                  approvedAt={step2.approvedAt}
                  onScrollTo={scrollTo}
                  state={state}
                  reviewedSections={reviewedSections}
                />
              </div>
            </div>
            </>
          )}
        </>
      )}

      {/* ══ TAB 2: Reference Images ═══════════════════════════════════════════ */}
      {activeTab === 'references' && state >= 2 && (
        <div className="space-y-4">

          {/* Global toolbar — visually grouped */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-2xl border border-outline-variant/10 bg-surface-container">
              {/* Primary action */}
              <button
                type="button"
                onClick={() => {
                  if (step2ImageReview.data) { setShowRegenAllConfirm(true); }
                  else { handleGenerateCharacterReferences(charSettings); }
                }}
                disabled={step2ImageReview.locked || isImageGenerating || !step2.data}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  step2ImageReview.locked || isImageGenerating || !step2.data
                    ? 'text-on-surface-variant cursor-not-allowed opacity-50'
                    : step2ImageReview.data
                      ? 'bg-surface-container-highest text-on-surface hover:bg-surface-container-high/80'
                      : 'bg-primary text-on-primary hover:opacity-90 shadow-sm'
                }`}
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isImageGenerating ? 'hourglass_empty' : step2ImageReview.data ? 'refresh' : 'image'}
                </span>
                {isImageGenerating
                  ? 'Generating…'
                  : step2ImageReview.data
                    ? 'Regenerate All'
                    : 'Generate References'}
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-outline-variant/20 mx-0.5 flex-shrink-0" />

              {/* From Library */}
              <button
                type="button"
                onClick={() => setIsLibraryOpen(true)}
                disabled={isImageGenerating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">library_books</span>
                From Library
              </button>

              {/* Browse Community */}
              <button
                type="button"
                onClick={() => setIsGalleryOpen(true)}
                disabled={isImageGenerating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">public</span>
                Browse Community
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-outline-variant/20 mx-0.5 flex-shrink-0" />

              {/* Reset */}
              <button
                type="button"
                onClick={handleRetryCharacterReferences}
                disabled={step2ImageReview.locked}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-on-surface-variant/60 hover:text-on-surface-variant transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
                Reset
              </button>
            </div>

            {step2ImageReview.error && (
              <span className="text-sm text-red-500">{step2ImageReview.error}</span>
            )}
          </div>

          {/* Library notice */}
          {!step2ImageReview.locked && !step2.data && characters.length > 0 && (
            <p className="text-sm text-blue-600 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">info</span>
              Showing characters from your library. Generate designs to add AI-extracted characters.
            </p>
          )}

          {/* Locked */}
          {step2ImageReview.locked && (
            <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-12 text-center opacity-60">
              <span className="material-symbols-outlined text-4xl text-outline-variant mb-3 block">lock</span>
              <p className="font-semibold text-on-surface text-sm">
                Approve the design sheet first to unlock reference images
              </p>
            </div>
          )}

          {/* Regenerate all confirmation */}
          {showRegenAllConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
                <h3 className="font-bold text-on-surface text-lg">Regenerate all images?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  This will regenerate reference images for all characters and clear all approvals.
                  Previous versions will not be recoverable.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRegenAllConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-bold border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegenAllConfirm(false);
                      setApprovedCharIds(new Set());
                      setVersionBoundaries({});
                      setActiveVersionTabs({});
                      handleGenerateCharacterReferences(charSettings);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity"
                  >
                    Regenerate all
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Accordion character list ── */}
          {!step2ImageReview.locked && characters.length > 0 && (
            <div className="space-y-4">
              {characters.map((character, idx) => {
                const charId    = character.characterId;
                const versions  = computeVersions(character.candidates, versionBoundaries[charId] ?? [0]);
                const activeVer = activeVersionTabs[charId] ?? Math.max(0, versions.length - 1);

                return (
                  <CharacterAccordionCard
                    key={charId}
                    idx={idx}
                    character={character}
                    isExpanded={expandedCharIds.has(charId)}
                    onToggle={() => toggleCharExpanded(charId)}
                    settings={getCharSettings(charId)}
                    aspectRatio={getAspectRatio(charId)}
                    versions={versions}
                    activeVersion={activeVer}
                    onVersionChange={(v) => setActiveVersionTabs((prev) => ({ ...prev, [charId]: v }))}
                    isApproved={approvedCharIds.has(charId)}
                    isAnyGenerating={isImageGenerating}
                    onRegenerate={() => setCharRegenModal({ charId, charName: character.name, settings: getCharSettings(charId) })}
                    onSelectCandidate={(id) => handleSelectCharacterCandidate(charId, id)}
                    onUpdateSettings={(s) => updateCharSettings(charId, s)}
                    onAspectRatioChange={(r) => updateAspectRatio(charId, r)}
                    onApprove={() => approveChar(charId)}
                    onRevoke={() => revokeChar(charId)}
                    designMarkdown={step2.data?.designMarkdown ?? null}
                    projectId={projectId ?? ''}
                    onReactionChange={handleReactionChange}
                  />
                );
              })}
            </div>
          )}

          {/* Empty references */}
          {!step2ImageReview.locked && characters.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-outline-variant/20 py-12 text-center">
              <span
                className="material-symbols-outlined text-4xl text-outline-variant mb-3 block"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                image_search
              </span>
              <p className="font-semibold text-on-surface text-sm">No reference images yet</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Click &ldquo;Generate references&rdquo; or import from library.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Sticky bottom action bar ── */}
      <div
        className="fixed bottom-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ left: 'var(--studio-sidebar-width)' }}
      >
        {/* Review warning — Design Sheets tab only */}
        {showReviewWarning && unreviewedSections.length > 0 && activeTab === 'designs' && (
          <div className="px-10 py-3 max-w-6xl mx-auto border-b border-gray-100">
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">warning</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  You&apos;ve reviewed {reviewedSections.size} / {TOTAL_SECTIONS} sections
                </p>
                <p className="text-xs text-amber-700 mt-0.5 truncate">
                  Unreviewed: {unreviewedSections.map((s) => s.title).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={scrollToFirstUnreviewed}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2 whitespace-nowrap"
                >
                  Review sections ↑
                </button>
                <button
                  type="button"
                  onClick={handleForceApprove}
                  className="text-xs font-semibold text-white bg-gray-900 rounded-lg px-3 py-1.5 hover:opacity-90 whitespace-nowrap"
                >
                  Approve anyway →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Button row */}
        <div className="px-10 py-4 max-w-6xl mx-auto">
          {isGenerating ? (
            <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
              Generating designs… please wait
            </div>
          ) : state === 1 ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Previous Step
              </button>
              <button
                type="button"
                onClick={() => handleGenerate(2)}
                disabled={!canGenerate}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-gray-900 text-white hover:opacity-90 disabled:opacity-40 transition-all"
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>style</span>
                {cooldown > 0 ? `Retry in ${cooldown}s` : 'Generate Designs'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Previous Step
              </button>

              <div className="flex items-center gap-3">
                {/* Character completion dots — Reference Images tab */}
                {activeTab === 'references' && characters.length > 0 && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/10">
                    <div className="flex gap-1.5">
                      {characters.map((c) => (
                        <span
                          key={c.characterId}
                          title={c.name}
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors duration-300 ${
                            approvedCharIds.has(c.characterId)
                              ? 'bg-emerald-500'
                              : c.candidates.length > 0
                                ? 'bg-blue-400/60'
                                : 'bg-outline-variant/30'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-on-surface-variant tabular-nums">
                      {approvedCount}/{characters.length}
                    </span>
                  </div>
                )}

                {/* Regenerate Designs (design sheets tab) */}
                {activeTab === 'designs' && (
                  <button
                    type="button"
                    onClick={() => setShowRegenConfirm(true)}
                    disabled={!canGenerate}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">refresh</span>
                    {cooldown > 0 ? `Retry in ${cooldown}s` : 'Regenerate'}
                  </button>
                )}

                {/* Design sheet revoke — inline in bottom bar */}
                {activeTab === 'designs' && state === 4 && (
                  <button
                    type="button"
                    onClick={() => handleRevokeApproval(2)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-on-surface-variant hover:text-on-surface border border-outline-variant/20 hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">undo</span>
                    Revoke
                  </button>
                )}

                <button
                  type="button"
                  onClick={activeTab === 'designs' ? handleDesignApproveClick : handleApproveAndContinue}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all flex-shrink-0 ${
                    activeTab === 'designs'
                      ? state === 4
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-gray-900 text-white hover:opacity-90'
                      : step2ImageReview.isApproved
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-gray-900 text-white hover:opacity-90'
                  }`}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {activeTab === 'designs' ? (state === 4 ? 'image' : 'check_circle') : 'check_circle'}
                  </span>
                  {activeTab === 'designs'
                    ? state === 4
                      ? 'View Reference Images →'
                      : 'Approve & Generate Images →'
                    : step2ImageReview.isApproved
                      ? 'Approved · Continue →'
                      : 'Approve & Continue →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Global regenerate confirm modal ── */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span
                  className="material-symbols-outlined text-amber-600"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  refresh
                </span>
              </div>
              <div>
                <p className="font-bold text-gray-900">Regenerate designs?</p>
                <p className="text-sm text-gray-500 mt-1">
                  This will replace all current designs and remove any per-character approvals. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegen}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image selection alert ── */}
      {showSelectionAlert && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>image_search</span>
              </div>
              <div>
                <p className="font-bold text-gray-900">Select a final image first</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Please select one final image for every character before approving.
                </p>
                {charsWithCandidates.length > 0 && (
                  <p className="text-xs text-amber-600 font-semibold mt-2">
                    {charsWithSelection.length} of {charsWithCandidates.length} selected
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSelectionAlert(false)}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <CharacterLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        existingIds={existingCharacterIds}
        onConfirm={injectLibraryCharacters}
      />
      <GalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        existingIds={existingCharacterIds}
        onConfirm={injectLibraryCharacters}
      />

      {charRegenModal && (
        <CharacterRegenModal
          charName={charRegenModal.charName}
          onClose={() => setCharRegenModal(null)}
          onRegenerate={(feedback) => {
            handleCharacterVersionedRegenerate(charRegenModal.charId, charRegenModal.settings, feedback || undefined);
            setCharRegenModal(null);
          }}
        />
      )}

      {showCharSetRating && (
        <CharacterSetRatingModal
          characters={characters}
          allCharReactions={allCharReactions}
          activeVersionTabs={activeVersionTabs}
          onSkip={handleCharSetRatingSkip}
          onSave={handleCharSetRatingSave}
        />
      )}
    </section>
  );
}

// ── Character regenerate modal ────────────────────────────────────────────────
function CharacterRegenModal({
  charName,
  onClose,
  onRegenerate,
}: {
  charName: string;
  onClose: () => void;
  onRegenerate: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const CHIPS = [
    { label: '😠 More intense', text: 'more intense expression' },
    { label: '💪 Full body', text: 'full body view' },
    { label: '🌙 Darker tone', text: 'darker color palette' },
    { label: '✨ More detail', text: 'more detailed linework' },
    { label: '👁 Close-up', text: 'close-up portrait' },
    { label: '⚔️ With weapon', text: 'holding signature weapon' },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-[520px] bg-surface rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <h3 className="text-base font-bold text-on-surface">Regenerate {charName}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
              What would you like to change?
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value.slice(0, 200))}
                placeholder="e.g. make the armor more ornate, add glowing eyes, darker skin tone"
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface placeholder-outline outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed"
                rows={3}
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-outline select-none">{feedback.length}/200</span>
            </div>
            <p className="text-[11px] text-outline mt-1.5">Describe what to change, not what to keep</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setFeedback((prev) => { const t = prev.trim(); return t ? `${t}, ${chip.text}` : chip.text; })}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/20 bg-surface-container-low">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRegenerate('')}
              title="Re-run the original prompt without any new instructions"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-sm">replay</span>
              Regenerate without changes
            </button>
            <button
              type="button"
              onClick={() => onRegenerate(feedback)}
              disabled={!feedback.trim()}
              title="Regenerate using your feedback above as guidance"
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${feedback.trim() ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-surface-container text-outline cursor-not-allowed opacity-50'}`}
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Character set rating modal ────────────────────────────────────────────────
function CharacterSetRatingModal({
  characters,
  allCharReactions,
  activeVersionTabs,
  onSkip,
  onSave,
}: {
  characters:       { characterId: string; name: string }[];
  allCharReactions: Record<string, Record<number, string>>;
  activeVersionTabs: Record<string, number>;
  onSkip:           () => void;
  onSave:           (stars: number | null, comment: string) => void;
}) {
  const [stars, setStars]         = useState<number | null>(null);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [comment, setComment]     = useState('');

  const REACTION_EMOJI: Record<string, string> = { love: '😍', good: '👍', neutral: '😐', bad: '👎' };

  const charReactionSummary = characters
    .map((c) => {
      const version  = activeVersionTabs[c.characterId] ?? 0;
      const reaction = allCharReactions[c.characterId]?.[version] ?? null;
      return { name: c.name, reaction };
    })
    .filter((c) => c.reaction);

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Characters approved!</p>
          <h2 className="text-xl font-bold text-gray-900 mt-1">
            How well did AI capture your characters?
          </h2>
        </div>

        {/* Star rating */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStars(stars === s ? null : s)}
              onMouseEnter={() => setHoverStar(s)}
              onMouseLeave={() => setHoverStar(null)}
              className="text-3xl leading-none transition-transform hover:scale-110 text-amber-400 select-none"
            >
              {(hoverStar ?? stars ?? 0) >= s ? '★' : '☆'}
            </button>
          ))}
          {stars && <span className="text-sm text-gray-400 ml-2">{stars}/5</span>}
        </div>

        {/* Comment */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 block">
            Any notes? (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 border border-gray-200 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            placeholder="What worked well? What could be better?"
          />
        </div>

        {/* Character reaction summary */}
        {charReactionSummary.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Your character reactions:
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {charReactionSummary.map((c, i) => (
                <span key={i} className="text-sm text-gray-600">
                  {c.name}: {REACTION_EMOJI[c.reaction!] ?? c.reaction}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip →
          </button>
          <button
            type="button"
            onClick={() => onSave(stars, comment)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-gray-900 text-white hover:opacity-90 transition-opacity"
          >
            Save &amp; Continue →
          </button>
        </div>
      </div>
    </div>
  );
}