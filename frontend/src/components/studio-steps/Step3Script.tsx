'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import Markdown from '@/components/Markdown';

// ── Types ─────────────────────────────────────────────────────────────────────

type OverallState = 1 | 2 | 3 | 4 | 5;
type ViewMode    = 'script' | 'prompts' | 'dialogue' | 'compact';
type FilterMode  = 'all' | 'pending' | 'generated' | 'approved';
type PanelStatus = 'approved' | 'generated' | 'pending';

interface DialogueLine {
  type: 'speech' | 'sfx' | 'caption';
  speaker?: string;
  text: string;
}

interface ParsedPanel {
  panelNumber: number;
  label: string;
  layoutSummary: string;
  description: string;
  dialogues: DialogueLine[];
  prompt: string;
  shotType?: string;
  aspectRatio?: string;
  negativePrompt?: string;
}

interface ParsedPage {
  pageNumber: number;
  panels: ParsedPanel[];
}

interface ParsedChapter {
  chapterNumber: number;
  title: string;
  pages: ParsedPage[];
}

// ── Streaming types ───────────────────────────────────────────────────────────

type PanelStreamStatus = 'skeleton' | 'streaming' | 'complete';
type LivePanelField = 'shot_type' | 'aspect_ratio' | 'description' | 'dialogue_sfx' | 'ai_image_prompt' | 'negative_prompt';

interface LivePanel {
  number: number;
  status: PanelStreamStatus;
  activeField: LivePanelField | null;
  shot_type: string;
  aspect_ratio: string;
  description: string;
  dialogue_sfx: string;
  ai_image_prompt: string;
  negative_prompt: string;
}

interface LivePage {
  number: number;
  panels: LivePanel[];
}

interface LiveChapter {
  number: number;
  title: string;
  pages: LivePage[];
}

interface StreamParserState {
  parsedLength: number;
  lineBuffer: string;
  stopped: boolean;
  curChIdx: number;
  curPgIdx: number;
  curPnIdx: number;
  activeField: LivePanelField | null;
  chapters: LiveChapter[];
}

interface StreamProgressInfo {
  completedPanels: number;
  activePanelLabel: string;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function appendDialogueLine(panel: ParsedPanel, raw: string) {
  const t = raw.trim().replace(/^[-*•]\s*/, '');
  if (!t) return;
  if (/^SFX\s*:/i.test(t)) { panel.dialogues.push({ type: 'sfx', text: t.replace(/^SFX\s*:\s*/i, '').trim() }); return; }
  if (/^CAPTION\s*:/i.test(t)) { panel.dialogues.push({ type: 'caption', text: t.replace(/^CAPTION\s*:\s*/i, '').trim() }); return; }
  const m = t.match(/^([A-Z][A-Z0-9\s\-'.]{0,25})\s*:\s*"?(.+)"?$/);
  if (m) { panel.dialogues.push({ type: 'speech', speaker: m[1].trim(), text: m[2].replace(/^["']|["']$/g, '').trim() }); return; }
  panel.dialogues.push({ type: 'speech', text: t.replace(/^["']|["']$/g, '').trim() });
}

function parseScript(md: string): ParsedChapter[] {
  type Mode = 'description' | 'dialogue' | 'prompt' | 'layout' | 'none';
  const chapters: ParsedChapter[] = [];
  let curChapter: ParsedChapter | null = null;
  let curPage: ParsedPage | null = null;
  let curPanel: ParsedPanel | null = null;
  let mode: Mode = 'none';

  const ensureChapter = () => { if (!curChapter) curChapter = { chapterNumber: 1, title: '', pages: [] }; };
  const commitPanel   = () => {
    if (!curPanel) return;
    ensureChapter(); if (!curPage) curPage = { pageNumber: 1, panels: [] };
    curPage.panels.push(curPanel); curPanel = null; mode = 'none';
  };
  const commitPage    = () => {
    commitPanel(); if (!curPage) return;
    ensureChapter(); curChapter!.pages.push(curPage); curPage = null;
  };
  const commitChapter = () => {
    commitPage(); if (!curChapter) return;
    chapters.push(curChapter); curChapter = null;
  };

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^-{3,}$/.test(line)) continue;
    if (/^===JSON===/.test(line)) break;   // stop before JSON block
    // Strip markdown decorators + leading bullet so "- **field:** value" → "field: value"
    const clean = line.replace(/^#{1,4}\s*/, '').replace(/[*`]/g, '').replace(/^-\s+/, '').trim();

    const chM = clean.match(/^Chapter\s+(\d+)[:\-–—]?\s*(.*)/i);
    if (chM) { commitChapter(); curChapter = { chapterNumber: +chM[1], title: chM[2].trim(), pages: [] }; mode = 'none'; continue; }
    const pgM = clean.match(/^Page\s+(\d+)/i);
    if (pgM) {
      commitPanel();
      if (curPage) { ensureChapter(); curChapter!.pages.push(curPage); }
      curPage = { pageNumber: +pgM[1], panels: [] }; mode = 'none'; continue;
    }
    const pnM = clean.match(/^Panel\s+(\d+)[:\s]?(.*)/i);
    if (pnM) {
      commitPanel(); ensureChapter(); if (!curPage) curPage = { pageNumber: 1, panels: [] };
      // pnM[2] may itself start with "- field:" if panel header had inline content — strip bullet
      const desc = pnM[2].trim().replace(/^-\s+/, '').trim();
      curPanel = { panelNumber: +pnM[1], label: `Panel ${pnM[1]}`, layoutSummary: '', description: desc, dialogues: [], prompt: '' };
      mode = 'description'; continue;
    }
    if (!curPanel) continue;
    // underscores preserved (removed [_] from the replace above); field names with underscores match directly
    if (/^shot_?type\s*:/i.test(clean))      { curPanel.shotType    = clean.replace(/^[^:]+:\s*/, '').trim(); mode = 'none';        continue; }
    if (/^aspect_?ratio\s*:/i.test(clean))   { curPanel.aspectRatio = clean.replace(/^[^:]+:\s*/, '').trim(); mode = 'none';        continue; }
    if (/^negative_?prompt\s*:/i.test(clean)) { curPanel.negativePrompt = clean.replace(/^[^:]+:\s*/, '').trim(); mode = 'none';   continue; }
    if (/^description\s*:/i.test(clean)) {
      mode = 'description';
      const r = clean.replace(/^[^:]+:\s*/, '').trim();
      if (r) curPanel.description = r;
      continue;
    }
    if (/^(layout[\s_]*summary|scene|setting)\s*:/i.test(clean)) { mode = 'layout'; const r = clean.replace(/^[^:]+:\s*/, '').trim(); if (r) curPanel.layoutSummary += (curPanel.layoutSummary ? ' ' : '') + r; continue; }
    if (/^(ai[\s_]*image[\s_]*prompt|image[\s_]*prompt)\s*:/i.test(clean)) { mode = 'prompt'; const r = clean.replace(/^[^:]+:\s*/, '').trim(); if (r) curPanel.prompt = r; continue; }
    if (/^(dialogue[\s_/]*sfx?|speech)\s*:/i.test(clean)) {
      mode = 'dialogue';
      const r = clean.replace(/^[^:]+:\s*/, '').trim();
      if (r) r.split(/\s*\|\s*/).forEach((part) => { if (part) appendDialogueLine(curPanel!, part); });
      continue;
    }
    if (/^SFX\s*:/i.test(clean)) { curPanel.dialogues.push({ type: 'sfx', text: clean.replace(/^SFX\s*:\s*/i, '').trim() }); continue; }
    if (mode === 'layout')        curPanel.layoutSummary += ' ' + clean;
    else if (mode === 'prompt')   curPanel.prompt += (curPanel.prompt ? '\n' : '') + clean;
    else if (mode === 'dialogue') clean.split(/\s*\|\s*/).forEach((part) => { if (part) appendDialogueLine(curPanel!, part); });
    else if (mode === 'description') { curPanel.description += (curPanel.description ? ' ' : '') + clean; }
    // mode === 'none': stray lines (summaries, tables) after known fields are ignored
  }
  commitChapter();
  return chapters;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractShotType(text: string): string | null {
  if (!text) return null;
  const m = text.match(/\b(wide\s+shot|close[- ]?up|medium\s+shot|establishing\s+shot|two[- ]?shot|overhead\s+shot|bird['s\s-]+eye|low[- ]+angle|high[- ]+angle|aerial|tracking\s+shot|full\s+shot|long\s+shot|extreme\s+close[- ]?up|reaction\s+shot|panning?\s+shot|insert\s+shot)\b/i);
  if (!m) return null;
  return m[1].replace(/[-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPanelStatus(panel: ParsedPanel, isScriptApproved: boolean, isLocallyApproved = false): PanelStatus {
  if (isScriptApproved || isLocallyApproved) return 'approved';
  if (panel.prompt) return 'generated';
  return 'pending';
}

function matchesFilter(panel: ParsedPanel, filter: FilterMode, isApproved: boolean, isLocallyApproved = false): boolean {
  if (filter === 'all') return true;
  return getPanelStatus(panel, isApproved, isLocallyApproved) === filter;
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────

function makeSkeletonPanel(num: number): LivePanel {
  return { number: num, status: 'skeleton', activeField: null, shot_type: '', aspect_ratio: '', description: '', dialogue_sfx: '', ai_image_prompt: '', negative_prompt: '' };
}

function buildSkeletonChapters(
  numChaptersStr: string,
  targetPagesStr: string,
  structuredJson: Record<string, unknown> | null,
): LiveChapter[] {
  const nc = Math.max(1, parseInt(numChaptersStr) || 4);
  const tp = Math.max(nc, parseInt(targetPagesStr) || 100);
  const ppc = Math.max(1, Math.round(tp / nc));
  const stepsObj = structuredJson?.steps as Record<string, unknown> | undefined;
  const analysisObj = stepsObj?.step_1_analysis as Record<string, unknown> | undefined;
  const dataObj = analysisObj?.data as Record<string, unknown> | undefined;
  const outlineArr = Array.isArray(dataObj?.chapter_outline) ? (dataObj.chapter_outline as Record<string, unknown>[]) : [];

  return Array.from({ length: nc }, (_, i) => {
    const chNum = i + 1;
    const oc = outlineArr.find((c) => c?.chapter_number === chNum);
    const title = (oc?.title as string | undefined) || `Chapter ${chNum}`;
    const pages: LivePage[] = Array.from({ length: ppc }, (__, j) => ({
      number: j + 1,
      panels: [makeSkeletonPanel(1)],
    }));
    return { number: chNum, title, pages };
  });
}

// ── Panel status dot ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: PanelStatus }) {
  if (status === 'approved') return <span className="material-symbols-outlined text-[13px] text-emerald-500 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>;
  if (status === 'generated') return <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 inline-block" />;
  return <span className="w-2 h-2 rounded-full border-2 border-[#9CA3AF] flex-shrink-0 inline-block" />;
}

// ── Skeleton panel card (shimmer, during streaming) ──────────────────────────

function SkeletonPanelCard() {
  return (
    <div className="rounded-lg border border-[#E2E6F0] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 h-12 bg-[#F7F8FC]">
        <div className="w-4 h-4 rounded-full bg-gray-200 animate-shimmer flex-shrink-0" />
        <div className="w-16 h-5 rounded-md bg-gray-200 animate-shimmer flex-shrink-0" />
        <div className="flex-1 h-3 rounded bg-gray-200 animate-shimmer" />
      </div>
    </div>
  );
}

// ── Live panel card (used during streaming) ───────────────────────────────────

function LivePanelCard({ panel, isExpanded, onToggle }: {
  panel: LivePanel;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (panel.status === 'skeleton') return <SkeletonPanelCard />;

  const shotType     = panel.shot_type || extractShotType(panel.description);
  const isStreaming  = panel.status === 'streaming';

  return (
    <div className={`rounded-lg border overflow-hidden transition-all duration-150 animate-panel-appear ${
      isStreaming ? 'border-blue-300 animate-border-pulse' : 'border-[#E2E6F0]'
    }`}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2.5 px-3 h-12 text-left transition-colors ${
          isExpanded ? 'bg-[#EEF2FF]' : 'bg-[#F7F8FC] hover:bg-[#EEF2FF]'
        }`}
        style={isExpanded ? { borderLeft: '3px solid var(--color-primary)' } : {}}
      >
        <span
          className="material-symbols-outlined text-[18px] flex-shrink-0 transition-transform duration-200"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', color: isExpanded ? 'var(--color-primary)' : '#9CA3AF' }}
        >chevron_right</span>
        <span className="flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[#E8EAF0] text-[#5A6375]">
          Panel {panel.number}
        </span>
        {shotType && (
          <span className="hidden sm:inline-flex flex-shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F0F0FB] text-[#7C85C8] border border-[#DDE0F5]">
            {shotType}
          </span>
        )}
        <span className="text-[12.5px] text-on-surface-variant/70 truncate flex-1 min-w-0">
          {panel.description || <span className="text-gray-400 italic">Generating…</span>}
        </span>
        <div className="flex-shrink-0 ml-1">
          {isStreaming
            ? <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
            : <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />}
        </div>
      </button>

      {/* Expandable body */}
      <div className={`grid transition-all ${isExpanded ? 'grid-rows-[1fr] duration-[250ms] ease-out' : 'grid-rows-[0fr] duration-[200ms] ease-in'}`}>
        <div className="overflow-hidden">
          <div className={`transition-opacity duration-150 ${isExpanded ? 'opacity-100 delay-[40ms]' : 'opacity-0'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y divide-[#E0E0E0] md:divide-y-0">
              {/* Left: description + dialogue */}
              <div className="bg-white p-4 space-y-3">
                {panel.description ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[#9CA3AF] mb-1" style={{ letterSpacing: '0.06em' }}>Description</p>
                    <p className="text-[13px] text-[#374151] leading-[1.7]">
                      {panel.description}
                      {isStreaming && panel.activeField === 'description' && <span className="animate-pulse text-blue-400">▋</span>}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="h-3 rounded bg-gray-100 animate-shimmer w-full" />
                    <div className="h-3 rounded bg-gray-100 animate-shimmer w-4/5" />
                  </div>
                )}
                {panel.dialogue_sfx && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[#9CA3AF] mb-1" style={{ letterSpacing: '0.06em' }}>Dialogue / SFX</p>
                    <p className="text-[13px] text-[#374151] italic leading-[1.7]">
                      {panel.dialogue_sfx}
                      {isStreaming && panel.activeField === 'dialogue_sfx' && <span className="animate-pulse text-blue-400">▋</span>}
                    </p>
                  </div>
                )}
              </div>
              {/* Right: AI prompt */}
              <div className="bg-[#12131F] relative" style={{ minHeight: '140px' }}>
                <div className="p-4" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
                  {panel.aspect_ratio && (
                    <span className="inline-flex items-center gap-1 mb-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/[0.06] text-[#7C85C8] border border-white/[0.1]">
                      {panel.aspect_ratio}
                    </span>
                  )}
                  {panel.ai_image_prompt ? (
                    <>
                      <p style={{ fontSize: '12.5px', lineHeight: 1.75, color: '#D4D8F0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {renderInline(panel.ai_image_prompt, '#D4D8F0')}
                        {isStreaming && panel.activeField === 'ai_image_prompt' && <span className="animate-pulse" style={{ color: '#86EFAC' }}>▋</span>}
                      </p>
                      {panel.negative_prompt && (
                        <p className="mt-2 italic" style={{ fontSize: '11px', lineHeight: 1.6, color: '#6B7280' }}>
                          <span style={{ color: '#4B5563', fontStyle: 'normal', fontWeight: 600 }}>–</span>{' '}{panel.negative_prompt}
                          {isStreaming && panel.activeField === 'negative_prompt' && <span className="animate-pulse" style={{ color: '#86EFAC' }}>▋</span>}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="h-3 rounded bg-white/[0.06] animate-shimmer w-full" />
                      <div className="h-3 rounded bg-white/[0.06] animate-shimmer w-4/5" />
                      <div className="h-3 rounded bg-white/[0.06] animate-shimmer w-3/4" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rich AI prompt block (right column) ──────────────────────────────────────

const SKIP_CAPS = new Set([
  'WIDE', 'CLOSE', 'PANEL', 'SCENE', 'VIEW', 'SHOT', 'OVER', 'FADE',
  'WITH', 'FROM', 'INTO', 'BACK', 'FULL', 'LONG', 'HIGH', 'NOTE',
  'DARK', 'LIGHT', 'STYLE', 'COMIC', 'MANGA', 'EPIC', 'BOLD', 'ANGLE',
  'FOCUS', 'FRAME', 'FLASH', 'ABOVE', 'BELOW', 'FRONT', 'THERE', 'THEIR',
]);

function renderInline(text: string, baseColor: string): React.ReactNode {
  const parts = text.split(/(\[[^\]]+\]|[A-Z]{4,}(?:\s+[A-Z]{3,})*)/g);
  return parts.map((part, i) => {
    if (/^\[.+\]$/.test(part)) {
      return (
        <span key={i} className="rounded-[3px]" style={{ color: '#C4B5FD', background: 'rgba(196,181,253,0.15)', padding: '1px 4px' }}>
          {part}
        </span>
      );
    }
    if (/^[A-Z]{4,}(\s+[A-Z]{3,})*$/.test(part) && !SKIP_CAPS.has(part.trim())) {
      return <span key={i} style={{ color: '#67E8F9', fontWeight: 600 }}>{part}</span>;
    }
    return <span key={i} style={{ color: baseColor }}>{part}</span>;
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-1 mb-2 uppercase" style={{ fontSize: '9px', letterSpacing: '0.1em', color: '#4B5563', borderBottom: '1px solid #1E2035' }}>
      {children}
    </p>
  );
}

function RichPromptBlock({
  panel, promptKey, copiedKey, onCopy,
}: {
  panel: ParsedPanel;
  promptKey: string;
  copiedKey: string | null;
  onCopy: (k: string, t: string) => void;
}) {
  const isCopied    = copiedKey === promptKey;
  const hasNotes    = !!(panel.layoutSummary || panel.description);
  const hasDialogue = panel.dialogues.some((d) => d.type !== 'sfx');
  const hasSfx      = panel.dialogues.some((d) => d.type === 'sfx');
  const hasPrompt   = !!panel.prompt;

  const copyTarget = panel.prompt || [
    panel.layoutSummary,
    panel.description,
    ...panel.dialogues.map((d) =>
      d.type === 'sfx' ? `SFX: ${d.text}` : d.speaker ? `${d.speaker}: "${d.text}"` : `"${d.text}"`
    ),
  ].filter(Boolean).join('\n');

  return (
    <div className="relative flex flex-col" style={{ background: '#12131F', minHeight: '180px' }}>
      <button
        type="button"
        onClick={() => onCopy(promptKey, copyTarget)}
        className={`absolute top-2.5 right-2.5 z-10 rounded-[6px] px-[10px] py-[4px] text-[11px] border border-white/[0.15] transition-colors ${
          isCopied
            ? 'bg-white/[0.12] text-[#86EFAC]'
            : 'bg-white/[0.08] text-[#94A3B8] hover:bg-white/[0.15] hover:text-[#E2E8F0]'
        }`}
      >
        {isCopied ? '✓ Copied!' : 'Copy'}
      </button>

      <div className="flex-1 px-4 pr-16 pt-3 pb-2" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
        {hasNotes && (
          <div className="mb-3">
            <SectionLabel>Panel Notes</SectionLabel>
            {panel.layoutSummary && (
              <p className="mb-1 text-[#94A3B8]" style={{ fontSize: '12.5px', lineHeight: 1.75 }}>
                {'📐 '}{renderInline(panel.layoutSummary, '#94A3B8')}
              </p>
            )}
            {panel.description && (
              <div className="text-[#94A3B8]" style={{ fontSize: '12.5px', lineHeight: 1.75 }}>
                <Markdown className="[&_p]:text-[#94A3B8] [&_p]:text-[12.5px] [&_p]:leading-[1.75] [&_table]:text-[11px] [&_th]:text-[#7C85C8] [&_td]:text-[#94A3B8] [&_td]:border-white/10 [&_th]:border-white/10">
                  {panel.description}
                </Markdown>
              </div>
            )}
          </div>
        )}

        {hasDialogue && (
          <div className="mb-3">
            <SectionLabel>Dialogue</SectionLabel>
            <div className="space-y-1.5">
              {panel.dialogues.filter((d) => d.type !== 'sfx').map((d, i) => (
                <div key={i} className="pl-2" style={{ borderLeft: '2px solid #FDE68A' }}>
                  {d.speaker && (
                    <span className="mr-1 uppercase" style={{ color: '#67E8F9', fontWeight: 600, fontSize: '10px', letterSpacing: '0.05em' }}>
                      {d.speaker}:{' '}
                    </span>
                  )}
                  <span className="italic" style={{ color: '#FDE68A', fontSize: '12.5px', lineHeight: 1.75 }}>
                    &ldquo;{d.text}&rdquo;
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasSfx && (
          <div className="mb-3">
            <SectionLabel>SFX</SectionLabel>
            <div className="space-y-1">
              {panel.dialogues.filter((d) => d.type === 'sfx').map((d, i) => (
                <p key={i} style={{ fontSize: '12.5px', lineHeight: 1.75, color: '#FCA5A5', fontWeight: 600 }}>
                  <span className="mr-1.5" style={{ color: '#4B5563', fontSize: '9px', letterSpacing: '0.08em' }}>[SFX]</span>
                  {d.text}
                </p>
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionLabel>Style Prompt</SectionLabel>
          {panel.aspectRatio && (
            <span className="inline-flex items-center gap-1 mb-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/[0.06] text-[#7C85C8] border border-white/[0.1]">
              {panel.aspectRatio}
            </span>
          )}
          {hasPrompt ? (
            <p style={{ fontSize: '12.5px', lineHeight: 1.75, color: '#D4D8F0', fontWeight: 400, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {renderInline(panel.prompt, '#D4D8F0')}
            </p>
          ) : (
            <p className="italic" style={{ fontSize: '11px', color: '#4B5563' }}>No AI image prompt for this panel</p>
          )}
          {panel.negativePrompt && (
            <p className="mt-2 italic" style={{ fontSize: '11px', lineHeight: 1.6, color: '#6B7280' }}>
              <span style={{ color: '#4B5563', fontStyle: 'normal', fontWeight: 600 }}>–</span>{' '}{panel.negativePrompt}
            </p>
          )}
        </div>
      </div>

      <div className="mx-4 mb-4 mt-3 flex flex-col items-center justify-center py-3 rounded-[4px]" style={{ border: '1px dashed #1E2035' }}>
        <span className="material-symbols-outlined text-lg" style={{ color: '#2D3050' }}>photo_library</span>
        <p className="text-[11px] mt-0.5" style={{ color: '#2D3050' }}>Generated in Step 4</p>
      </div>
    </div>
  );
}

// ── Dialogue lines ─────────────────────────────────────────────────────────────

function DialogueLines({ dialogues }: { dialogues: DialogueLine[] }) {
  if (!dialogues.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>Dialogue / SFX</p>
      <div className="space-y-2">
        {dialogues.map((d, i) => {
          if (d.type === 'sfx') return <div key={i} className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase text-[#9CA3AF] flex-shrink-0" style={{ letterSpacing: '0.06em' }}>SFX:</span><span className="font-mono text-[13px] font-bold text-[#FF6B00] tracking-wider">{d.text}</span></div>;
          if (d.type === 'caption') return <p key={i} className="text-[13px] italic text-[#9CA3AF] leading-[1.7]">[{d.text}]</p>;
          return <div key={i} className="flex items-start gap-2 pl-2.5 border-l-2 border-primary/30">{d.speaker && <span className="text-[11px] font-bold text-primary/70 flex-shrink-0 mt-0.5 uppercase" style={{ letterSpacing: '0.04em' }}>{d.speaker}:</span>}<p className="text-[13px] italic text-[#374151] leading-[1.7]">&ldquo;{d.text}&rdquo;</p></div>;
        })}
      </div>
    </div>
  );
}

// ── Chapter heading ───────────────────────────────────────────────────────────

function ChapterHeading({ chapter }: { chapter: ParsedChapter }) {
  const totalPanels = chapter.pages.reduce((s, p) => s + p.panels.length, 0);
  return (
    <div className="mt-8 first:mt-0">
      <div className="h-px bg-outline-variant/20 mb-4" />
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/15">
        <span className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold tracking-widest">CH.{chapter.chapterNumber}</span>
        <h3 className="text-[18px] font-bold text-on-surface leading-tight min-w-0 truncate">{chapter.title || `Chapter ${chapter.chapterNumber}`}</h3>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-on-surface-variant flex-shrink-0"><span>{chapter.pages.length}p</span><span className="text-outline-variant/40">·</span><span>{totalPanels} panels</span></div>
      </div>
    </div>
  );
}

// ── Scene accordion ────────────────────────────────────────────────────────────

function SceneAccordion({
  chapter, page, isExpanded, isApprovedLocally, isScriptApproved,
  allPanelsApproved, isRegenerating,
  onToggle, onApproveLocal, onRegen, canApprove, children,
}: {
  chapter: ParsedChapter; page: ParsedPage;
  isExpanded: boolean; isApprovedLocally: boolean; isScriptApproved: boolean;
  allPanelsApproved: boolean; isRegenerating: boolean;
  onToggle: () => void; onApproveLocal: () => void; onRegen: () => void;
  canApprove: boolean; children: React.ReactNode;
}) {
  const pageKey     = `${chapter.chapterNumber}-${page.pageNumber}`;
  const totalPanels = page.panels.length;
  const readyPanels = page.panels.filter((p) => p.prompt).length;
  const isAllDone   = isApprovedLocally || isScriptApproved || allPanelsApproved;
  const status: PanelStatus = isAllDone ? 'approved' : readyPanels === totalPanels && totalPanels > 0 ? 'generated' : 'pending';

  return (
    <div
      data-page-key={pageKey}
      className={`rounded-xl border overflow-hidden transition-colors duration-150 ${
        isAllDone ? 'border-emerald-200/70 opacity-60' : isExpanded ? 'border-primary/25' : 'border-[#E2E6F0]'
      }`}
    >
      {/* ── Header bar (always 52px) ── */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 h-[52px] text-left transition-colors group ${
          isAllDone
            ? 'bg-emerald-50/50 hover:bg-emerald-50'
            : isExpanded
            ? 'bg-primary/[0.04]'
            : 'bg-[#F7F8FC] hover:bg-[#F0F2FA]'
        }`}
        style={isExpanded && !isAllDone ? { borderLeft: '3px solid var(--color-primary)' } : {}}
      >
        <span
          className="material-symbols-outlined text-base flex-shrink-0 transition-transform duration-200"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'none',
            color: isAllDone ? '#10B981' : isExpanded ? 'var(--color-primary)' : '#9CA3AF',
          }}
        >
          {isAllDone && !isExpanded ? 'check_circle' : 'chevron_right'}
        </span>

        <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide ${
          isAllDone ? 'bg-emerald-100/70 text-emerald-600' : isExpanded ? 'bg-primary text-on-primary' : 'bg-[#E8EAF0] text-[#5A6375]'
        }`}>
          Page {page.pageNumber}
        </span>

        <StatusDot status={status} />

        {allPanelsApproved && !isApprovedLocally && !isScriptApproved ? (
          <span className="text-[12px] font-semibold text-emerald-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            All Done
          </span>
        ) : (
          <span className="text-[13px] font-medium text-on-surface-variant/70">
            {totalPanels} Panel{totalPanels !== 1 ? 's' : ''}
            {readyPanels > 0 && readyPanels < totalPanels && (
              <span className="text-blue-400 ml-1.5">· {readyPanels}/{totalPanels} ready</span>
            )}
          </span>
        )}

        <div className="flex-1" />

        {isAllDone ? (
          <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1 flex-shrink-0">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Approved
          </span>
        ) : (
          <div className={`flex items-center gap-1 transition-opacity flex-shrink-0 ${isRegenerating ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button type="button" onClick={(e) => { e.stopPropagation(); onRegen(); }}
              disabled={isRegenerating}
              title="Regenerates the full script — this page's panels aren't isolated yet"
              className="flex items-center px-2 py-1 rounded-md text-[11px] font-semibold text-[#9CA3AF] bg-white border border-[#E0E0E0] hover:text-on-surface hover:border-[#C0C0C0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {isRegenerating
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                : <span className="material-symbols-outlined text-sm">refresh</span>}
            </button>
            {canApprove && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onApproveLocal(); }}
                title="Approve this page" className="flex items-center px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </button>
            )}
          </div>
        )}
      </button>

      {/* ── Animated body ── */}
      <div className={`grid transition-all ${isExpanded ? 'grid-rows-[1fr] duration-[250ms] ease-out' : 'grid-rows-[0fr] duration-[200ms] ease-in'}`}>
        <div className="overflow-hidden">
          <div className={`transition-opacity duration-150 ${isExpanded ? 'opacity-100 delay-[50ms]' : 'opacity-0'}`}>
            <div className="px-3 pt-3 pb-3 space-y-3">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panel card ────────────────────────────────────────────────────────────────

function PanelCard({
  panel, chapterNumber, pageNumber, panelKey,
  isExpanded, onToggle, viewMode,
  isScriptApproved, isApprovedLocally, isRegenerating,
  copiedKey, onCopyPrompt, onApprovePanelLocally, onRegen,
}: {
  panel: ParsedPanel; chapterNumber: number; pageNumber: number; panelKey: string;
  isExpanded: boolean; onToggle: () => void; viewMode: ViewMode;
  isScriptApproved: boolean; isApprovedLocally: boolean; isRegenerating: boolean;
  copiedKey: string | null; onCopyPrompt: (k: string, t: string) => void;
  onApprovePanelLocally: () => void; onRegen: () => void;
}) {
  const effectiveExpanded = viewMode !== 'compact' && isExpanded;
  const showLeft     = viewMode === 'script' || viewMode === 'dialogue';
  const showRight    = viewMode === 'script' || viewMode === 'prompts';
  const dialogueOnly = viewMode === 'dialogue';
  const hasPrompt    = !!panel.prompt;
  const isApproved   = isScriptApproved || isApprovedLocally;
  const shotType     = panel.shotType || extractShotType(panel.layoutSummary || panel.description);
  const summary      = panel.layoutSummary || panel.description || '';

  return (
    <div
      id={`panel-${panelKey}`}
      className={`rounded-lg border overflow-hidden transition-all duration-150 ${
        isApproved ? 'border-emerald-200/60 opacity-70' : isExpanded ? 'border-primary/30' : 'border-[#E2E6F0]'
      }`}
    >
      {/* ── Collapsed header — always 48px ── */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2.5 px-3 h-12 text-left transition-colors group ${
          isExpanded ? 'bg-[#EEF2FF]' : isApproved ? 'bg-emerald-50/40' : 'bg-[#F7F8FC] hover:bg-[#EEF2FF]'
        }`}
        style={isExpanded ? { borderLeft: '3px solid var(--color-primary)' } : {}}
      >
        {/* Chevron */}
        <span
          className="material-symbols-outlined text-[18px] flex-shrink-0 transition-transform duration-200"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'none',
            color: isApproved ? '#10B981' : isExpanded ? 'var(--color-primary)' : '#9CA3AF',
          }}
        >
          {isApproved ? 'check_circle' : 'chevron_right'}
        </span>

        {/* Panel badge */}
        <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide ${
          isApproved ? 'bg-emerald-100/70 text-emerald-600' : isExpanded ? 'bg-primary text-on-primary' : 'bg-[#E8EAF0] text-[#5A6375]'
        }`}>
          {panel.label}
        </span>

        {/* Shot type tag */}
        {shotType && (
          <span className="hidden sm:inline-flex flex-shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F0F0FB] text-[#7C85C8] border border-[#DDE0F5]">
            {shotType}
          </span>
        )}

        {/* 1-line summary */}
        <span className="text-[12.5px] text-on-surface-variant/70 truncate flex-1 min-w-0">
          {summary}
        </span>

        {/* Right: Ch/P ref + status */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-1">
          <span className="hidden sm:block text-[11px] text-on-surface-variant/40">
            Ch.{chapterNumber} · P.{pageNumber}
          </span>
          <StatusDot status={getPanelStatus(panel, isScriptApproved, isApprovedLocally)} />
        </div>
      </button>

      {/* ── Expandable body ── */}
      <div className={`grid transition-all ${effectiveExpanded ? 'grid-rows-[1fr] duration-[250ms] ease-out' : 'grid-rows-[0fr] duration-[200ms] ease-in'}`}>
        <div className="overflow-hidden">
          <div className={`transition-opacity duration-150 ${effectiveExpanded ? 'opacity-100 delay-[40ms]' : 'opacity-0'}`}>
            <div className={`grid grid-cols-1 divide-y divide-[#E0E0E0] md:divide-y-0 ${showLeft && showRight ? 'md:grid-cols-2' : ''}`}>
              {showLeft && (
                <div className="bg-white p-4 space-y-4">
                  {!dialogueOnly && <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>📋 Script</p>}
                  {!dialogueOnly && panel.layoutSummary && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>Layout Summary</p>
                      <Markdown className="text-[13px] text-[#374151] leading-[1.7]">{panel.layoutSummary}</Markdown>
                    </div>
                  )}
                  {!dialogueOnly && panel.description && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>Panel Description</p>
                      <Markdown className="text-[13px] text-[#374151] leading-[1.7]">{panel.description}</Markdown>
                    </div>
                  )}
                  {panel.dialogues.length > 0 ? <DialogueLines dialogues={panel.dialogues} /> : dialogueOnly ? <p className="text-xs text-[#9CA3AF] italic">No dialogue in this panel.</p> : null}
                  {!dialogueOnly && !panel.layoutSummary && !panel.description && !panel.dialogues.length && <p className="text-xs text-[#9CA3AF] italic">No script data.</p>}
                </div>
              )}
              {showRight && (
                <div className="bg-[#12131F]">
                  <RichPromptBlock panel={panel} promptKey={panelKey} copiedKey={copiedKey} onCopy={onCopyPrompt} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-[#FAFAFA] border-t border-[#E0E0E0]">
              <button
                type="button"
                onClick={onRegen}
                disabled={isRegenerating || isApproved}
                title="Regenerates the full script — this panel isn't isolated yet"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#9CA3AF] bg-white border border-[#E0E0E0] hover:text-on-surface hover:border-[#C0C0C0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-[#9CA3AF] disabled:hover:border-[#E0E0E0]"
              >
                {isRegenerating
                  ? <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  : <span className="material-symbols-outlined text-sm">refresh</span>}
                {isRegenerating ? 'Regenerating…' : 'Regen'}
              </button>
              <div className="flex-1" />
              {hasPrompt && (
                <button type="button" onClick={() => onCopyPrompt(panelKey, panel.prompt)} disabled={isRegenerating} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant bg-white border border-[#E0E0E0] hover:bg-surface-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined text-sm">content_copy</span>Copy Prompt
                </button>
              )}
              <button
                type="button"
                onClick={() => { if (!isApproved) onApprovePanelLocally(); }}
                disabled={isRegenerating}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isApproved ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200 cursor-default' : 'bg-primary text-on-primary hover:opacity-90'
                }`}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {isApproved ? 'Approved' : 'Approve Panel'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Navigation panel ──────────────────────────────────────────────────────────

function NavPanel({ chapters, filterMode, onFilterChange, isScriptApproved, activePageKey, onScrollTo }: {
  chapters: ParsedChapter[]; filterMode: FilterMode; onFilterChange: (f: FilterMode) => void;
  isScriptApproved: boolean; activePageKey: string | null; onScrollTo: (key: string) => void;
}) {
  const [collapsedChapters, setCollapsedChapters] = useState<Set<number>>(new Set());
  const [collapsedPages, setCollapsedPages]       = useState<Set<string>>(new Set());
  const toggleCh = (n: number) => setCollapsedChapters((p) => { const s = new Set(p); if (s.has(n)) { s.delete(n); } else { s.add(n); } return s; });
  const togglePg = (k: string) => setCollapsedPages((p) => { const s = new Set(p); if (s.has(k)) { s.delete(k); } else { s.add(k); } return s; });

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-outline-variant/10 flex-shrink-0">
        <p className="text-[11px] font-bold uppercase text-on-surface-variant tracking-widest mb-2">Navigation</p>
        <div className="flex gap-1 flex-wrap">
          {(['all', 'pending', 'generated', 'approved'] as FilterMode[]).map((f) => (
            <button key={f} type="button" onClick={() => onFilterChange(f)}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${filterMode === f ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
              {f === 'all' ? 'All' : f === 'pending' ? '○ Pending' : f === 'generated' ? '● Ready' : '✓ Approved'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto thin-scrollbar py-1">
        {chapters.map((chapter) => {
          const isChColl = collapsedChapters.has(chapter.chapterNumber);
          return (
            <div key={chapter.chapterNumber}>
              <button type="button" onClick={() => toggleCh(chapter.chapterNumber)} className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-surface-container text-left transition-colors">
                <span className="material-symbols-outlined text-sm text-primary/60 flex-shrink-0 transition-transform duration-150" style={{ transform: isChColl ? 'rotate(-90deg)' : 'none' }}>expand_more</span>
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest flex-shrink-0">CH.{chapter.chapterNumber}</span>
                <span className="text-[12px] font-semibold text-on-surface truncate">{chapter.title || `Chapter ${chapter.chapterNumber}`}</span>
              </button>
              {!isChColl && chapter.pages.map((page) => {
                const pgKey    = `${chapter.chapterNumber}-${page.pageNumber}`;
                const isPgColl = collapsedPages.has(pgKey);
                const isActive = activePageKey === pgKey || activePageKey === 'ALL';
                return (
                  <div key={pgKey}>
                    <button type="button" onClick={() => togglePg(pgKey)}
                      className={`w-full flex items-center gap-1.5 pl-6 pr-3 py-1 text-left transition-colors ${isActive ? 'bg-primary/8 text-primary' : 'hover:bg-surface-container text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined text-sm flex-shrink-0 transition-transform duration-150" style={{ transform: isPgColl ? 'rotate(-90deg)' : 'none', color: isActive ? 'var(--color-primary)' : '#9CA3AF' }}>expand_more</span>
                      <span className={`text-[12px] font-semibold ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>Page {page.pageNumber}</span>
                      {isActive && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                      <span className="ml-auto text-[10px] text-on-surface-variant/40">{page.panels.length}p</span>
                    </button>
                    {!isPgColl && page.panels.map((panel) => {
                      const key    = `${chapter.chapterNumber}-${page.pageNumber}-${panel.panelNumber}`;
                      const status = getPanelStatus(panel, isScriptApproved);
                      const matches = matchesFilter(panel, filterMode, isScriptApproved);
                      return (
                        <button key={key} type="button" onClick={() => onScrollTo(key)}
                          className={`w-full flex items-center gap-2 pl-10 pr-3 py-1 text-left hover:bg-surface-container transition-colors ${!matches ? 'opacity-30' : ''}`}>
                          <StatusDot status={status} />
                          <span className="text-[12px] text-on-surface truncate flex-1">{panel.label}</span>
                          <span className={`text-[10px] font-bold flex-shrink-0 ${status === 'approved' ? 'text-emerald-500' : status === 'generated' ? 'text-blue-500' : 'text-[#9CA3AF]'}`}>
                            {status === 'approved' ? '✓' : status === 'generated' ? '●' : '○'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
        {chapters.length === 0 && <p className="px-3 py-4 text-xs text-on-surface-variant/50 italic">No panels yet</p>}
      </div>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

const VIEW_MODES: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'script',   label: 'Script',   icon: 'article' },
  { id: 'prompts',  label: 'Prompts',  icon: 'image' },
  { id: 'dialogue', label: 'Dialogue', icon: 'forum' },
  { id: 'compact',  label: 'Compact',  icon: 'view_headline' },
];

function Toolbar({ viewMode, onViewModeChange, onCollapseAll, onExpandAll }: {
  viewMode: ViewMode; onViewModeChange: (v: ViewMode) => void;
  onCollapseAll: () => void; onExpandAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-container border border-outline-variant/10">
        <button type="button" onClick={onCollapseAll} title="Collapse all" className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"><span className="material-symbols-outlined text-sm">unfold_less</span><span className="hidden sm:inline">Collapse All</span></button>
        <button type="button" onClick={onExpandAll}   title="Expand all"   className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"><span className="material-symbols-outlined text-sm">unfold_more</span><span className="hidden sm:inline">Expand All</span></button>
      </div>
      <div className="h-6 w-px bg-outline-variant/20 hidden sm:block" />
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-container border border-outline-variant/10">
        {VIEW_MODES.map((v) => (
          <button key={v.id} type="button" title={v.label} onClick={() => onViewModeChange(v.id)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === v.id ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined text-sm">{v.icon}</span><span className="hidden sm:inline">{v.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Bottom bar ────────────────────────────────────────────────────────────────

function ScriptBottomBar({
  isGenerating, approvedScenes, totalScenes, pendingPanelCount,
  canGenerate, cooldown, error, isScriptApproved,
  onPrevious, onContinue, onRegenerate, onRetry, onRevoke,
  showContinueWarning, onConfirmContinue, onCancelContinue,
  streamProgressInfo,
}: {
  isGenerating: boolean; approvedScenes: number; totalScenes: number; pendingPanelCount: number;
  canGenerate: boolean; cooldown: number; error: string | null;
  isScriptApproved: boolean;
  onPrevious: () => void; onContinue: () => void; onRegenerate: () => void; onRetry: () => void; onRevoke: () => void;
  showContinueWarning: boolean; onConfirmContinue: () => void; onCancelContinue: () => void;
  streamProgressInfo?: StreamProgressInfo;
}) {
  const allDone   = totalScenes > 0 && approvedScenes >= totalScenes;
  const remaining = Math.max(0, totalScenes - approvedScenes);
  const pct       = totalScenes > 0 ? Math.round(approvedScenes / totalScenes * 100) : 0;
  const showRegen = (totalScenes === 0 || pendingPanelCount > 0) && !isGenerating;

  // Pulse 2× when first reaching allDone
  const prevAllDoneRef = useRef(false);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (allDone && !prevAllDoneRef.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1000);
      return () => clearTimeout(t);
    }
    prevAllDoneRef.current = allDone;
  }, [allDone]);

  const ctaTooltip = !allDone && !isGenerating && totalScenes > 0
    ? `Review all ${totalScenes} pages to continue. ${remaining} page${remaining !== 1 ? 's' : ''} remaining.`
    : undefined;

  const regenTooltip = pendingPanelCount > 0
    ? `Regenerate all ${pendingPanelCount} pending panel${pendingPanelCount !== 1 ? 's' : ''} at once`
    : undefined;

  return (
    <div
      className="fixed bottom-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{ left: 'var(--studio-sidebar-width)' }}
    >
      {/* Warning dialog */}
      {showContinueWarning && (
        <div className="absolute inset-x-0 bottom-full mb-2 flex justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-outline-variant/20 p-4 max-w-sm w-full">
            <p className="font-semibold text-on-surface text-sm">Some panels have no AI image prompts</p>
            <p className="text-xs text-on-surface-variant mt-1 mb-3">Continue to Step 4 anyway?</p>
            <div className="flex gap-2">
              <button type="button" onClick={onCancelContinue} className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="button" onClick={onConfirmContinue} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white hover:opacity-90">Continue Anyway</button>
            </div>
          </div>
        </div>
      )}

      <div className="px-10 py-4 max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Previous Step */}
        <button
          type="button"
          onClick={onPrevious}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span className="hidden sm:inline">Previous Step</span>
        </button>

        {/* Center: progress bar + label */}
        <div className="flex-1 min-w-0 hidden sm:block">
          {isGenerating ? (
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-sm text-gray-500">Writing panel scripts…</span>
                {streamProgressInfo && streamProgressInfo.completedPanels > 0 && (
                  <span className="ml-2 text-xs text-gray-400 tabular-nums">
                    {streamProgressInfo.completedPanels} panel{streamProgressInfo.completedPanels !== 1 ? 's' : ''} written
                    {streamProgressInfo.activePanelLabel && (
                      <span className="ml-1 text-gray-300">· {streamProgressInfo.activePanelLabel}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          ) : error ? (
            <span className="text-sm text-red-500 truncate">{error}</span>
          ) : totalScenes > 0 ? (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className={`font-semibold ${allDone ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {allDone ? 'All pages approved — ready to continue!' : `${approvedScenes} / ${totalScenes} pages approved`}
                </span>
                <span className="text-gray-400 tabular-nums ml-3">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-gray-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {error && !isGenerating && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold border border-gray-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              <span className="material-symbols-outlined text-base">replay</span>
              Retry
            </button>
          )}

          {showRegen && (
            <div className="relative group/regen">
              <button
                type="button"
                onClick={onRegenerate}
                disabled={!canGenerate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">{totalScenes === 0 ? 'edit_document' : 'refresh'}</span>
                {cooldown > 0
                  ? `Retry in ${cooldown}s`
                  : totalScenes === 0
                  ? 'Generate Script'
                  : <>Regen Pending{pendingPanelCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold tabular-nums">{pendingPanelCount}</span>}</>}
              </button>
              {regenTooltip && canGenerate && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover/regen:block z-50 pointer-events-none">
                  <div className="bg-gray-900 text-white rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl">{regenTooltip}</div>
                  <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 mx-auto -mt-1.5" />
                </div>
              )}
            </div>
          )}

          {isScriptApproved && (
            <button
              type="button"
              onClick={onRevoke}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-on-surface-variant hover:text-on-surface border border-outline-variant/20 hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-base">undo</span>
              Revoke
            </button>
          )}

          <div className="relative group/cta">
            <button
              type="button"
              onClick={allDone && !isGenerating ? onContinue : undefined}
              disabled={!allDone || isGenerating}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 border-2 border-transparent ${
                isGenerating
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : allDone
                  ? `bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_4px_14px_rgba(5,150,105,0.35)] t-next-border ${pulse ? 'animate-[pulse_0.4s_ease-in-out_2]' : ''}`
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  {allDone ? 'Approved · Continue →' : 'Approve & Continue →'}
                </>
              )}
            </button>
            {ctaTooltip && (
              <div className="absolute bottom-full right-0 mb-2.5 hidden group-hover/cta:block z-50 pointer-events-none">
                <div className="bg-gray-900 text-white rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl">{ctaTooltip}</div>
                <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 ml-auto mr-4 -mt-1.5" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Step3Script() {
  const {
    step3, handleGenerate, handleApprove, handleRevokeApproval, handleRetry,
    getCooldownSeconds, setActiveStep,
    step1, numChapters, targetPages,
  } = useComicGeneration();

  const [copiedKey,           setCopiedKey]           = useState<string | null>(null);
  const [expandedPanelKey,    setExpandedPanelKey]    = useState<string | null>(null);
  const [approvedPanelKeys,   setApprovedPanelKeys]   = useState<Set<string>>(new Set());
  const [filterMode,          setFilterMode]          = useState<FilterMode>('all');
  const [viewMode,            setViewMode]            = useState<ViewMode>('script');
  const [navOpen,             setNavOpen]             = useState(true);
  const [showContinueWarning, setShowContinueWarning] = useState(false);
  const [expandedPageKey,     setExpandedPageKey]     = useState<string | null>(null);
  const [approvedPageKeys,    setApprovedPageKeys]    = useState<Set<string>>(new Set());
  const lastScriptRef  = useRef<string | null>(null);
  const parserRef      = useRef<StreamParserState>({
    parsedLength: 0, lineBuffer: '', stopped: false,
    curChIdx: -1, curPgIdx: -1, curPnIdx: -1,
    activeField: null, chapters: [],
  });
  const [streamTick, setStreamTick] = useState(0);

  const handleCopyPrompt = useCallback(async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  }, []);

  const cooldown     = getCooldownSeconds(3);
  const isGenerating = step3.isLoading;
  const canGenerate  = !isGenerating && cooldown === 0;

  let state: OverallState = 1;
  if (isGenerating)                                              state = 2;
  else if (step3.isApproved && !step3.regeneratedAfterApproval) state = 4;
  else if (step3.data && step3.regeneratedAfterApproval)        state = 5;
  else if (step3.data)                                          state = 3;

  const chapters     = useMemo(() => step3.data ? parseScript(step3.data.scriptMarkdown) : [], [step3.data]);
  const showChapters = chapters.length > 1 || (chapters.length === 1 && chapters[0].title !== '');
  const totalPages   = chapters.reduce((s, c) => s + c.pages.length, 0);
  const totalPanels  = chapters.reduce((s, c) => c.pages.reduce((ps, p) => ps + p.panels.length, 0) + s, 0);
  const hasContent   = totalPanels > 0;
  const isApproved   = state === 4;

  const allPageKeys = useMemo(() => {
    const keys: string[] = [];
    for (const c of chapters) for (const p of c.pages)
      keys.push(`${c.chapterNumber}-${p.pageNumber}`);
    return keys;
  }, [chapters]);

  const panelsWithPrompts = useMemo(() =>
    chapters.reduce((s, c) => c.pages.reduce((ps, p) => ps + p.panels.filter((pan) => pan.prompt).length, s), 0),
    [chapters]);

  const approvedScenes   = isApproved ? allPageKeys.length : approvedPageKeys.size;
  const totalScenes      = allPageKeys.length;
  const hasPendingPanels = panelsWithPrompts < totalPanels;

  // Auto-expand first page + first panel when script first loads or regenerates
  useEffect(() => {
    const scriptId = step3.data?.scriptMarkdown ?? null;
    if (scriptId !== lastScriptRef.current) {
      lastScriptRef.current = scriptId;
      if (chapters.length > 0 && chapters[0].pages.length > 0) {
        const firstPage  = chapters[0].pages[0];
        const firstPageK = `${chapters[0].chapterNumber}-${firstPage.pageNumber}`;
        setExpandedPageKey(firstPageK);
        setApprovedPageKeys(new Set());
        setApprovedPanelKeys(new Set());
        if (firstPage.panels.length > 0) {
          setExpandedPanelKey(`${chapters[0].chapterNumber}-${firstPage.pageNumber}-${firstPage.panels[0].panelNumber}`);
        }
      }
    }
  }, [step3.data, chapters]);

  // approvePanel: mark panel done, open next un-approved panel (or first of next page)
  const approvePanel = useCallback((panelKey: string) => {
    setApprovedPanelKeys((prev) => new Set([...prev, panelKey]));
    const [cNum, pNum] = panelKey.split('-').map(Number);
    const chapter = chapters.find((c) => c.chapterNumber === cNum);
    const page    = chapter?.pages.find((p) => p.pageNumber === pNum);
    if (!page) return;

    // Find next un-approved panel on same page
    const panelIdx = page.panels.findIndex((p) => p.panelNumber === Number(panelKey.split('-')[2]));
    const nextOnPage = page.panels.slice(panelIdx + 1).find((p) => {
      const k = `${cNum}-${pNum}-${p.panelNumber}`;
      return !approvedPanelKeys.has(k) && k !== panelKey;
    });
    if (nextOnPage) {
      setExpandedPanelKey(`${cNum}-${pNum}-${nextOnPage.panelNumber}`);
      return;
    }

    // All panels on this page done → mark page approved, move to next page
    const pageKey = `${cNum}-${pNum}`;
    setApprovedPageKeys((prev) => new Set([...prev, pageKey]));
    const pageIdx = allPageKeys.indexOf(pageKey);
    const nextPageKey = allPageKeys[pageIdx + 1];
    if (nextPageKey) {
      setExpandedPageKey(nextPageKey);
      const [nc, np] = nextPageKey.split('-').map(Number);
      const nextChapter = chapters.find((c) => c.chapterNumber === nc);
      const nextPage    = nextChapter?.pages.find((p) => p.pageNumber === np);
      if (nextPage && nextPage.panels.length > 0) {
        setExpandedPanelKey(`${nc}-${np}-${nextPage.panels[0].panelNumber}`);
      }
    } else {
      setExpandedPanelKey(null);
    }
  }, [chapters, allPageKeys, approvedPanelKeys]);

  const collapseAll = useCallback(() => {
    setExpandedPageKey(null);
    if (viewMode === 'compact') setViewMode('script');
  }, [viewMode]);

  const expandAll = useCallback(() => {
    setExpandedPageKey('ALL');
    if (viewMode === 'compact') setViewMode('script');
  }, [viewMode]);

  const scrollToPanel = useCallback((key: string) => {
    const parts = key.split('-');
    const pageKey = `${parts[0]}-${parts[1]}`;
    setExpandedPageKey(pageKey);
    requestAnimationFrame(() => {
      const el = document.getElementById(`panel-${key}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName ?? '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      const idx = allPageKeys.indexOf(expandedPageKey ?? '');
      if (e.key === 'ArrowDown' && !e.shiftKey && idx < allPageKeys.length - 1) {
        e.preventDefault(); setExpandedPageKey(allPageKeys[idx + 1]);
      } else if (e.key === 'ArrowUp' && !e.shiftKey && idx > 0) {
        e.preventDefault(); setExpandedPageKey(allPageKeys[idx - 1]);
      } else if (e.shiftKey && e.key === 'A' && expandedPageKey && expandedPageKey !== 'ALL' && (state === 3 || state === 5)) {
        e.preventDefault();
        setApprovedPageKeys((p) => new Set([...p, expandedPageKey]));
        const next = allPageKeys[idx + 1];
        setExpandedPageKey(next ?? null);
      } else if (e.shiftKey && e.key === 'R' && canGenerate) {
        e.preventDefault(); handleGenerate(3);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allPageKeys, expandedPageKey, state, canGenerate, handleGenerate]);

  // ── Stream parser effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isGenerating) return;

    const text = step3.streamingText || '';
    const p    = parserRef.current;

    // Detect new stream (text reset to empty)
    if (text.length < p.parsedLength) {
      parserRef.current = { parsedLength: 0, lineBuffer: '', stopped: false, curChIdx: -1, curPgIdx: -1, curPnIdx: -1, activeField: null, chapters: [] };
      setStreamTick(0);
      return;
    }
    if (text.length <= p.parsedLength || p.stopped) return;

    const newChunk = text.slice(p.parsedLength);
    p.parsedLength  = text.length;

    const combined  = p.lineBuffer + newChunk;
    const lines     = combined.split('\n');
    p.lineBuffer    = lines[lines.length - 1];

    for (const rawLine of lines.slice(0, -1)) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^===JSON===/.test(line)) {
        p.stopped = true;
        for (const ch of p.chapters) for (const pg of ch.pages) for (const pn of pg.panels) {
          pn.status = 'complete'; pn.activeField = null;
        }
        break;
      }

      const clean = line
        .replace(/^#{1,6}\s*/, '')
        .replace(/\*\*/g, '')
        .replace(/^[-•*]\s*/, '')
        .trim();

      // Chapter
      const chM = clean.match(/^(?:CHAPTER|Chapter)\s+(\d+)[:\-–—]?\s*(.*)/i);
      if (chM) {
        if (p.curChIdx >= 0 && p.curPgIdx >= 0 && p.curPnIdx >= 0) {
          p.chapters[p.curChIdx].pages[p.curPgIdx].panels[p.curPnIdx].status = 'complete';
          p.chapters[p.curChIdx].pages[p.curPgIdx].panels[p.curPnIdx].activeField = null;
        }
        const chNum = parseInt(chM[1]);
        const title = chM[2].trim() || `Chapter ${chNum}`;
        let idx = p.chapters.findIndex((c) => c.number === chNum);
        if (idx === -1) { p.chapters.push({ number: chNum, title, pages: [] }); idx = p.chapters.length - 1; }
        else { p.chapters[idx].title = title; }
        p.curChIdx = idx; p.curPgIdx = -1; p.curPnIdx = -1; p.activeField = null;
        continue;
      }

      // Page
      const pgM = clean.match(/^Page\s+(\d+)/i);
      if (pgM) {
        if (p.curChIdx < 0) { p.chapters.push({ number: 1, title: 'Chapter 1', pages: [] }); p.curChIdx = 0; }
        if (p.curPnIdx >= 0 && p.curPgIdx >= 0) {
          p.chapters[p.curChIdx].pages[p.curPgIdx].panels[p.curPnIdx].status = 'complete';
          p.chapters[p.curChIdx].pages[p.curPgIdx].panels[p.curPnIdx].activeField = null;
        }
        const pgNum = parseInt(pgM[1]);
        let pgIdx = p.chapters[p.curChIdx].pages.findIndex((pg) => pg.number === pgNum);
        if (pgIdx === -1) { p.chapters[p.curChIdx].pages.push({ number: pgNum, panels: [] }); pgIdx = p.chapters[p.curChIdx].pages.length - 1; }
        p.curPgIdx = pgIdx; p.curPnIdx = -1; p.activeField = null;
        continue;
      }

      // Panel
      const pnM = clean.match(/^Panel\s+(\d+)/i);
      if (pnM) {
        if (p.curChIdx < 0) { p.chapters.push({ number: 1, title: 'Chapter 1', pages: [] }); p.curChIdx = 0; }
        if (p.curPgIdx < 0) { p.chapters[p.curChIdx].pages.push({ number: 1, panels: [] }); p.curPgIdx = 0; }
        if (p.curPnIdx >= 0) {
          p.chapters[p.curChIdx].pages[p.curPgIdx].panels[p.curPnIdx].status = 'complete';
          p.chapters[p.curChIdx].pages[p.curPgIdx].panels[p.curPnIdx].activeField = null;
        }
        const pnNum = parseInt(pnM[1]);
        let pnIdx = p.chapters[p.curChIdx].pages[p.curPgIdx].panels.findIndex((pn) => pn.number === pnNum);
        if (pnIdx === -1) {
          p.chapters[p.curChIdx].pages[p.curPgIdx].panels.push({ number: pnNum, status: 'streaming', activeField: null, shot_type: '', aspect_ratio: '', description: '', dialogue_sfx: '', ai_image_prompt: '', negative_prompt: '' });
          pnIdx = p.chapters[p.curChIdx].pages[p.curPgIdx].panels.length - 1;
        }
        p.curPnIdx = pnIdx; p.activeField = null;
        continue;
      }

      // Field markers
      if (p.curChIdx < 0 || p.curPgIdx < 0 || p.curPnIdx < 0) continue;
      const pn = p.chapters[p.curChIdx].pages[p.curPgIdx].panels[p.curPnIdx];

      const setF = (field: LivePanelField, val: string) => { pn[field] = val; pn.activeField = field; p.activeField = field; };
      const appF = (field: LivePanelField, val: string) => { pn[field] += ' ' + val; };

      if (/^shot_type\s*:/i.test(clean))                          { setF('shot_type',       clean.replace(/^[^:]+:\s*/, '')); continue; }
      if (/^aspect_ratio\s*:/i.test(clean))                       { setF('aspect_ratio',     clean.replace(/^[^:]+:\s*/, '')); continue; }
      if (/^description\s*:/i.test(clean))                        { setF('description',      clean.replace(/^[^:]+:\s*/, '')); continue; }
      if (/^(dialogue_sfx|dialogue\/sfx)\s*:/i.test(clean))       { setF('dialogue_sfx',    clean.replace(/^[^:]+:\s*/, '')); continue; }
      if (/^(ai_image_prompt|ai\s+image\s+prompt)\s*:/i.test(clean)) { setF('ai_image_prompt', clean.replace(/^[^:]+:\s*/, '')); continue; }
      if (/^negative_prompt\s*:/i.test(clean))                    { setF('negative_prompt',  clean.replace(/^[^:]+:\s*/, '')); continue; }

      // Continuation line
      if (p.activeField && pn.status === 'streaming') appF(p.activeField, clean);
    }

    setStreamTick((t) => t + 1);
  }, [step3.streamingText, isGenerating]);

  const handleContinue = useCallback(() => {
    if (isApproved) { setActiveStep(4); return; }
    if (hasPendingPanels) { setShowContinueWarning(true); return; }
    handleApprove(3);
    setActiveStep(4);
  }, [isApproved, hasPendingPanels, handleApprove, setActiveStep]);

  // ── Streaming computed values ────────────────────────────────────────────────
  const skeletonChapters = useMemo(
    () => buildSkeletonChapters(numChapters, targetPages, step1.data?.structuredJson ?? null),
    [numChapters, targetPages, step1.data],
  );

  // Read live chapters from ref (safe in render because streamTick triggers re-render)
  const liveChapters = parserRef.current.chapters;

  // Active streaming panel: the last panel with status 'streaming'
  const activeStreamPanelKey = useMemo<string | null>(() => {
    if (!isGenerating) return null;
    const p = parserRef.current;
    if (p.curChIdx >= 0 && p.curPgIdx >= 0 && p.curPnIdx >= 0) {
      const ch = p.chapters[p.curChIdx];
      const pg = ch?.pages[p.curPgIdx];
      const pn = pg?.panels[p.curPnIdx];
      if (pn?.status === 'streaming') return `${ch.number}-${pg.number}-${pn.number}`;
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, streamTick]);

  // Stream progress info for bottom bar
  const streamProgressInfo = useMemo<StreamProgressInfo | undefined>(() => {
    if (!isGenerating) return undefined;
    let completed = 0;
    for (const ch of liveChapters) for (const pg of ch.pages) for (const pn of pg.panels) {
      if (pn.status === 'complete') completed++;
    }
    const p  = parserRef.current;
    let label = '';
    if (p.curChIdx >= 0 && p.curPgIdx >= 0 && p.curPnIdx >= 0) {
      const ch = p.chapters[p.curChIdx];
      const pg = ch?.pages[p.curPgIdx];
      const pn = pg?.panels[p.curPnIdx];
      if (ch && pg && pn) label = `Ch.${ch.number} · P.${pg.number} · Panel ${pn.number}`;
    }
    return { completedPanels: completed, activePanelLabel: label };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, streamTick]);

  // Convert live chapters to ParsedChapter[] for NavPanel during streaming
  const liveChaptersAsParsed = useMemo<ParsedChapter[]>(
    () => liveChapters.map((ch) => ({
      chapterNumber: ch.number,
      title: ch.title,
      pages: ch.pages.map((pg) => ({
        pageNumber: pg.number,
        panels: pg.panels
          .filter((pn) => pn.status !== 'skeleton')
          .map((pn) => ({
            panelNumber: pn.number,
            label: `Panel ${pn.number}`,
            layoutSummary: '',
            description: pn.description,
            dialogues: [],
            prompt: pn.ai_image_prompt,
            shotType: pn.shot_type || undefined,
            aspectRatio: pn.aspect_ratio || undefined,
            negativePrompt: pn.negative_prompt || undefined,
          })),
      })),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [streamTick]);

  return (
    <section className="text-on-surface space-y-4 pb-20">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-on-surface">Panel Script</h2>
        <p className="text-sm text-on-surface-variant mt-1">Full page-by-page, panel-by-panel script for image generation</p>
      </div>

      {/* ── Streaming ── */}
      {state === 2 && (
        <div>
          {/* Header bar */}
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                navOpen ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-container border-outline-variant/20 text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">account_tree</span>{navOpen ? 'Hide Nav' : 'Show Nav'}
            </button>
            <span className="text-sm text-on-surface-variant flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
              Writing panel script…
            </span>
          </div>

          {/* Two-column: nav + live content */}
          <div className="flex gap-4">
            {navOpen && liveChaptersAsParsed.length > 0 && (
              <div className="flex-shrink-0 w-[280px]">
                <div className="sticky top-20 rounded-xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
                  <NavPanel
                    chapters={liveChaptersAsParsed}
                    filterMode="all"
                    onFilterChange={() => undefined}
                    isScriptApproved={false}
                    activePageKey={activeStreamPanelKey ? activeStreamPanelKey.split('-').slice(0, 2).join('-') : null}
                    onScrollTo={() => undefined}
                  />
                </div>
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-4">
              {liveChapters.length === 0 ? (
                /* No chapters arrived yet — show skeleton */
                <div className="space-y-4">
                  {skeletonChapters.map((ch) => (
                    <div key={ch.number} className="mt-2 first:mt-0">
                      {/* Skeleton chapter header */}
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
                        <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-primary/20 text-[11px] font-bold tracking-widest text-primary/60">CH.{ch.number}</div>
                        <h3 className="text-[18px] font-bold text-on-surface leading-tight min-w-0 truncate">{ch.title}</h3>
                        <div className="ml-auto w-16 h-3 rounded bg-gray-200 animate-shimmer flex-shrink-0" />
                      </div>
                      <div className="mt-2 space-y-2">
                        {ch.pages.slice(0, 2).map((pg) => (
                          <div key={pg.number} className="rounded-xl border border-[#E2E6F0] overflow-hidden">
                            <div className="flex items-center gap-3 px-4 h-[52px] bg-[#F7F8FC]">
                              <div className="w-4 h-4 rounded bg-gray-200 animate-shimmer flex-shrink-0" />
                              <div className="w-14 h-5 rounded-md bg-gray-200 animate-shimmer flex-shrink-0" />
                              <div className="flex-1 h-3 rounded bg-gray-200 animate-shimmer" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Live chapters */
                <div className="space-y-4">
                  {liveChapters.map((ch) => {
                    const showChapterHeader = liveChapters.length > 1 || ch.title !== '';
                    return (
                      <div key={ch.number} className="mt-2 first:mt-0">
                        {showChapterHeader && (
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/15 mb-2">
                            <span className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold tracking-widest">CH.{ch.number}</span>
                            <h3 className="text-[18px] font-bold text-on-surface leading-tight min-w-0 truncate">{ch.title}</h3>
                            <div className="ml-auto flex items-center gap-1.5 text-xs text-on-surface-variant flex-shrink-0">
                              <span>{ch.pages.length}p</span>
                              <span className="text-outline-variant/40">·</span>
                              <span>{ch.pages.reduce((s, p) => s + p.panels.filter((pn) => pn.status !== 'skeleton').length, 0)} panels</span>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          {ch.pages.map((pg) => {
                            const livePanels = pg.panels.filter((pn) => pn.status !== 'skeleton');
                            return (
                              <div key={pg.number} className="rounded-xl border border-[#E2E6F0] overflow-hidden">
                                <div className="flex items-center gap-3 px-4 h-[52px] bg-[#F7F8FC]">
                                  <span className="flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[#E8EAF0] text-[#5A6375]">
                                    Page {pg.number}
                                  </span>
                                  <span className="text-[13px] font-medium text-on-surface-variant/70">
                                    {livePanels.length} Panel{livePanels.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                {livePanels.length > 0 && (
                                  <div className="px-3 pt-3 pb-3 space-y-2">
                                    {livePanels.map((pn) => {
                                      const key = `${ch.number}-${pg.number}-${pn.number}`;
                                      return (
                                        <LivePanelCard
                                          key={key}
                                          panel={pn}
                                          isExpanded={activeStreamPanelKey === key}
                                          onToggle={() => undefined}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Skeleton placeholders for remaining expected chapters */}
                  {Array.from({ length: Math.max(0, parseInt(numChapters) - liveChapters.length) }, (_, i) => {
                    const chNum = liveChapters.length + i + 1;
                    const sk    = skeletonChapters.find((c) => c.number === chNum);
                    return (
                      <div key={`sk-${chNum}`} className="mt-2">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10 mb-2">
                          <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-primary/20 text-[11px] font-bold tracking-widest text-primary/60">CH.{chNum}</div>
                          <h3 className="text-[18px] font-bold text-on-surface leading-tight min-w-0 truncate">{sk?.title ?? `Chapter ${chNum}`}</h3>
                          <div className="ml-auto w-16 h-3 rounded bg-gray-200 animate-shimmer flex-shrink-0" />
                        </div>
                        <div className="rounded-xl border border-[#E2E6F0] overflow-hidden">
                          <div className="flex items-center gap-3 px-4 h-[52px] bg-[#F7F8FC]">
                            <div className="w-4 h-4 rounded bg-gray-200 animate-shimmer flex-shrink-0" />
                            <div className="w-14 h-5 rounded-md bg-gray-200 animate-shimmer flex-shrink-0" />
                            <div className="flex-1 h-3 rounded bg-gray-200 animate-shimmer" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {state === 1 && (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-outline-variant" style={{ fontVariationSettings: "'FILL' 1" }}>edit_document</span>
          <div className="text-center"><p className="font-semibold text-on-surface">No script yet</p><p className="text-sm text-on-surface-variant mt-1">Complete Steps 1 &amp; 2 first, then generate the panel script.</p></div>
        </div>
      )}

      {/* ── Structured content ── */}
      {(state === 3 || state === 4 || state === 5) && step3.data && (
        <div>
          {/* Nav toggle + stats */}
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <button type="button" onClick={() => setNavOpen((v) => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${navOpen ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-container border-outline-variant/20 text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined text-base">account_tree</span>{navOpen ? 'Hide Nav' : 'Show Nav'}
            </button>
            {hasContent && (
              <>
                {showChapters && <><span className="text-sm font-semibold text-on-surface">{chapters.length} Chapter{chapters.length !== 1 ? 's' : ''}</span><span className="text-on-surface-variant/40">·</span></>}
                <span className="text-sm text-on-surface-variant">{totalPages} Page{totalPages !== 1 ? 's' : ''}</span>
                <span className="text-on-surface-variant/40">·</span>
                <span className="text-sm text-on-surface-variant">{totalPanels} Panel{totalPanels !== 1 ? 's' : ''}</span>
                {state === 4 && step3.approvedAt && (
                  <><span className="text-on-surface-variant/40">·</span><span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>Approved {new Date(step3.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></>
                )}
              </>
            )}
          </div>

          {/* Two-column: Nav + Content */}
          <div className="flex gap-4">
            {navOpen && (
              <div className="flex-shrink-0 w-[280px]">
                <div className="sticky top-20 rounded-xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
                  <NavPanel chapters={chapters} filterMode={filterMode} onFilterChange={setFilterMode} isScriptApproved={isApproved} activePageKey={expandedPageKey} onScrollTo={scrollToPanel} />
                </div>
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Sticky toolbar */}
              <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-sm border-b border-outline-variant/10 -mx-1 px-1 mb-4">
                <Toolbar viewMode={viewMode} onViewModeChange={setViewMode}
                  onCollapseAll={collapseAll} onExpandAll={expandAll} />
              </div>

              {/* Chapters / Pages / Panels */}
              {hasContent ? (
                <div className="space-y-2">
                  {chapters.map((chapter) => (
                    <div key={chapter.chapterNumber}>
                      {showChapters && <ChapterHeading chapter={chapter} />}
                      <div className={showChapters ? 'mt-4 space-y-2' : 'space-y-2'}>
                        {chapter.pages.map((page) => {
                          const pageKey = `${chapter.chapterNumber}-${page.pageNumber}`;
                          const pageIsExpanded = expandedPageKey === 'ALL' || expandedPageKey === pageKey;
                          const pageIsApproved = approvedPageKeys.has(pageKey);
                          const allPanelsOnPageApproved = page.panels.length > 0 &&
                            page.panels.every((pan) => {
                              const k = `${chapter.chapterNumber}-${page.pageNumber}-${pan.panelNumber}`;
                              return isApproved || approvedPanelKeys.has(k);
                            });
                          return (
                            <SceneAccordion
                              key={page.pageNumber}
                              chapter={chapter} page={page}
                              isExpanded={pageIsExpanded}
                              isApprovedLocally={pageIsApproved}
                              isScriptApproved={isApproved}
                              allPanelsApproved={allPanelsOnPageApproved}
                              onToggle={() => {
                                const opening = expandedPageKey !== pageKey;
                                setExpandedPageKey((prev) => (prev === pageKey ? null : pageKey));
                                if (opening && page.panels.length > 0) {
                                  // Auto-expand first un-approved panel, or first panel
                                  const firstUnApproved = page.panels.find((pan) => {
                                    const k = `${chapter.chapterNumber}-${page.pageNumber}-${pan.panelNumber}`;
                                    return !approvedPanelKeys.has(k) && !isApproved;
                                  });
                                  const target = firstUnApproved ?? page.panels[0];
                                  setExpandedPanelKey(`${chapter.chapterNumber}-${page.pageNumber}-${target.panelNumber}`);
                                }
                              }}
                              onApproveLocal={() => {
                                setApprovedPageKeys((p) => new Set([...p, pageKey]));
                                const next = allPageKeys[allPageKeys.indexOf(pageKey) + 1];
                                setExpandedPageKey(next ?? null);
                              }}
                              onRegen={() => { if (canGenerate) handleGenerate(3); }}
                              isRegenerating={isGenerating}
                              canApprove={state === 3 || state === 5}
                            >
                              {page.panels.filter((pan) => matchesFilter(pan, filterMode, isApproved, approvedPanelKeys.has(`${chapter.chapterNumber}-${page.pageNumber}-${pan.panelNumber}`))).map((panel) => {
                                const key = `${chapter.chapterNumber}-${page.pageNumber}-${panel.panelNumber}`;
                                return (
                                  <PanelCard
                                    key={key} panel={panel}
                                    chapterNumber={chapter.chapterNumber} pageNumber={page.pageNumber}
                                    panelKey={key}
                                    isExpanded={expandedPanelKey === key}
                                    onToggle={() => setExpandedPanelKey((prev) => (prev === key ? null : key))}
                                    viewMode={viewMode}
                                    isScriptApproved={isApproved}
                                    isApprovedLocally={approvedPanelKeys.has(key)}
                                    isRegenerating={isGenerating}
                                    copiedKey={copiedKey}
                                    onCopyPrompt={handleCopyPrompt}
                                    onApprovePanelLocally={() => approvePanel(key)}
                                    onRegen={() => { if (canGenerate) handleGenerate(3); }}
                                  />
                                );
                              })}
                            </SceneAccordion>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
                  <Markdown>{step3.data.scriptMarkdown}</Markdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <ScriptBottomBar
        isGenerating={isGenerating}
        approvedScenes={approvedScenes}
        totalScenes={totalScenes}
        pendingPanelCount={totalPanels - panelsWithPrompts}
        canGenerate={canGenerate}
        cooldown={cooldown}
        error={step3.error ?? null}
        isScriptApproved={isApproved}
        onPrevious={() => setActiveStep(2)}
        onContinue={handleContinue}
        onRegenerate={() => handleGenerate(3)}
        onRetry={() => handleRetry(3)}
        onRevoke={() => handleRevokeApproval(3)}
        showContinueWarning={showContinueWarning}
        onConfirmContinue={() => { setShowContinueWarning(false); setActiveStep(4); }}
        onCancelContinue={() => setShowContinueWarning(false)}
        streamProgressInfo={streamProgressInfo}
      />
    </section>
  );
}