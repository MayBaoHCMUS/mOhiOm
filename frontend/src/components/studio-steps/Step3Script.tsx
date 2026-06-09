'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';

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
    const clean = line.replace(/^#{1,4}\s*/, '').replace(/[*_`]/g, '').trim();

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
      curPanel = { panelNumber: +pnM[1], label: `Panel ${pnM[1]}`, layoutSummary: '', description: pnM[2].trim(), dialogues: [], prompt: '' };
      mode = 'description'; continue;
    }
    if (!curPanel) continue;
    if (/^(layout\s+summary|scene|setting)\s*:/i.test(clean)) { mode = 'layout'; const r = clean.replace(/^[^:]+:\s*/, '').trim(); if (r) curPanel.layoutSummary += (curPanel.layoutSummary ? ' ' : '') + r; continue; }
    if (/^(ai\s+image\s+prompt|image\s+prompt)\s*:/i.test(clean)) { mode = 'prompt'; const r = clean.replace(/^[^:]+:\s*/, '').trim(); if (r) curPanel.prompt = r; continue; }
    if (/^(dialogue(\/sfx)?|speech)\s*:/i.test(clean)) { mode = 'dialogue'; const r = clean.replace(/^[^:]+:\s*/, '').trim(); if (r) appendDialogueLine(curPanel, r); continue; }
    if (/^SFX\s*:/i.test(clean)) { curPanel.dialogues.push({ type: 'sfx', text: clean.replace(/^SFX\s*:\s*/i, '').trim() }); continue; }
    if (mode === 'layout')    curPanel.layoutSummary += ' ' + clean;
    else if (mode === 'prompt')   curPanel.prompt += (curPanel.prompt ? '\n' : '') + clean;
    else if (mode === 'dialogue') appendDialogueLine(curPanel, clean);
    else { curPanel.description += (curPanel.description ? ' ' : '') + clean; }
  }
  commitChapter();
  return chapters;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPanelStatus(panel: ParsedPanel, isScriptApproved: boolean): PanelStatus {
  if (isScriptApproved) return 'approved';
  if (panel.prompt)     return 'generated';
  return 'pending';
}

function matchesFilter(panel: ParsedPanel, filter: FilterMode, isApproved: boolean): boolean {
  if (filter === 'all') return true;
  return getPanelStatus(panel, isApproved) === filter;
}

// ── State badge ───────────────────────────────────────────────────────────────

function StateBadge({ state }: { state: OverallState }) {
  if (state === 1) return null;
  if (state === 2) return <div className="flex items-center gap-2 text-sm text-on-surface-variant"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />Generating…</div>;
  if (state === 4) return <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold"><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>Approved</div>;
  if (state === 5) return <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold"><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>Regenerated — re-approval needed</div>;
  return <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold"><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pending</span>Pending review</div>;
}

// ── Panel status dot ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: PanelStatus }) {
  if (status === 'approved') return <span className="material-symbols-outlined text-[13px] text-emerald-500 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>;
  if (status === 'generated') return <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 inline-block" />;
  return <span className="w-2 h-2 rounded-full border-2 border-[#9CA3AF] flex-shrink-0 inline-block" />;
}

// ── AI prompt code block ──────────────────────────────────────────────────────

function PromptBlock({ prompt, promptKey, copiedKey, onCopy }: { prompt: string; promptKey: string; copiedKey: string | null; onCopy: (k: string, t: string) => void }) {
  const isCopied = copiedKey === promptKey;
  return (
    <div className="rounded-[6px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#2D2D4E]">
        <span className="text-[10px] font-mono text-[#9CA3AF] uppercase" style={{ letterSpacing: '0.1em' }}>AI Image Prompt</span>
        <button type="button" onClick={() => onCopy(promptKey, prompt)} className="flex items-center gap-1 text-[11px] font-semibold text-[#9CA3AF] hover:text-white transition-colors">
          <span className="material-symbols-outlined text-sm">{isCopied ? 'check' : 'content_copy'}</span>{isCopied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="px-3 py-3 text-[12px] font-mono text-[#A8B4FF] leading-relaxed bg-[#1E1E2E] overflow-x-auto whitespace-pre-wrap break-all">{prompt}</pre>
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

// ── Page heading ──────────────────────────────────────────────────────────────

function PageHeading({ page }: { page: ParsedPage }) {
  return (
    <div className="sticky top-[2.5rem] z-10 py-2 bg-white -mx-1 px-1">
      <div className="flex items-center gap-3 pl-3.5 border-l-[3px] border-[#CBD5E1]">
        <p className="text-[15px] font-semibold text-on-surface">Page {page.pageNumber}</p>
        <span className="text-[#CBD5E1]">—</span>
        <span className="text-sm text-on-surface-variant">{page.panels.length} Panel{page.panels.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ── Panel card ────────────────────────────────────────────────────────────────

function PanelCard({ panel, chapterNumber, pageNumber, panelKey, isExpanded, onToggle, viewMode, isScriptApproved, copiedKey, onCopyPrompt, onApproveScript }: {
  panel: ParsedPanel; chapterNumber: number; pageNumber: number; panelKey: string;
  isExpanded: boolean; onToggle: () => void; viewMode: ViewMode; isScriptApproved: boolean;
  copiedKey: string | null; onCopyPrompt: (k: string, t: string) => void; onApproveScript: () => void;
}) {
  const effectiveExpanded = viewMode !== 'compact' && isExpanded;
  const showLeft  = viewMode === 'script' || viewMode === 'dialogue';
  const showRight = viewMode === 'script' || viewMode === 'prompts';
  const dialogueOnly = viewMode === 'dialogue';
  const hasPrompt = !!panel.prompt;

  return (
    <div id={`panel-${panelKey}`} className="rounded-lg border border-[#E0E0E0] overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-[#F5F5F5] hover:bg-[#EEEEEE] text-left transition-colors group">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 px-2.5 py-1 rounded-md text-[13px] font-semibold uppercase text-on-primary bg-primary" style={{ letterSpacing: '0.04em', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>{panel.label}</span>
          {panel.description && <span className="text-[13px] text-on-surface-variant truncate max-w-[300px]">{panel.description}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="hidden sm:block text-[11px] text-on-surface-variant/50">Ch.{chapterNumber} · P.{pageNumber}</span>
          <div className="h-4 w-px bg-outline-variant/20" />
          <span className="material-symbols-outlined text-lg text-on-surface-variant/50 group-hover:text-on-surface-variant transition-transform duration-200" style={{ transform: effectiveExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
        </div>
      </button>
      <div className={`grid transition-all duration-200 ease-in-out ${effectiveExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className={`grid grid-cols-1 divide-y md:divide-y-0 md:divide-x divide-[#E0E0E0] ${showLeft && showRight ? 'md:grid-cols-2' : ''}`}>
            {showLeft && (
              <div className="bg-white p-4 space-y-4">
                {!dialogueOnly && <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>📋 Script</p>}
                {!dialogueOnly && panel.layoutSummary && <div className="space-y-1"><p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>Layout Summary</p><p className="text-[13px] text-[#374151] leading-[1.7]">{panel.layoutSummary}</p></div>}
                {!dialogueOnly && panel.description && <div className="space-y-1"><p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>Panel Description</p><p className="text-[13px] text-[#374151] leading-[1.7]">{panel.description}</p></div>}
                {panel.dialogues.length > 0 ? <DialogueLines dialogues={panel.dialogues} /> : dialogueOnly ? <p className="text-xs text-[#9CA3AF] italic">No dialogue in this panel.</p> : null}
                {!dialogueOnly && !panel.layoutSummary && !panel.description && !panel.dialogues.length && <p className="text-xs text-[#9CA3AF] italic">No script data.</p>}
              </div>
            )}
            {showRight && (
              <div className="bg-[#F8F9FF] p-4 space-y-4">
                <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>🖼 Image Prompt</p>
                {hasPrompt ? <PromptBlock prompt={panel.prompt} promptKey={panelKey} copiedKey={copiedKey} onCopy={onCopyPrompt} /> : <div className="flex flex-col items-center justify-center py-8 rounded-[6px] border-2 border-dashed border-[#E0E0E0] text-center"><span className="material-symbols-outlined text-3xl text-[#D0D0D0] mb-2">image_search</span><p className="text-xs text-[#9CA3AF]">No AI image prompt detected</p></div>}
                <div className="flex flex-col items-center justify-center h-20 rounded-[6px] border-2 border-dashed border-[#E0E0E0] text-center bg-white/60"><span className="material-symbols-outlined text-xl text-[#D0D0D0]">photo_library</span><p className="text-[11px] text-[#9CA3AF] mt-1">Generated in Step 4</p></div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-[#FAFAFA] border-t border-[#E0E0E0]">
            <button type="button" disabled title="Panel-level regeneration coming soon" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#9CA3AF] bg-white border border-[#E0E0E0] cursor-not-allowed select-none"><span className="material-symbols-outlined text-sm">refresh</span>Regen Panel</button>
            <button type="button" disabled title="Inline editing coming soon" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#9CA3AF] bg-white border border-[#E0E0E0] cursor-not-allowed select-none"><span className="material-symbols-outlined text-sm">edit</span>Edit</button>
            <div className="flex-1" />
            {hasPrompt && <button type="button" onClick={() => onCopyPrompt(panelKey, panel.prompt)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant bg-white border border-[#E0E0E0] hover:bg-surface-container transition-colors"><span className="material-symbols-outlined text-sm">content_copy</span>Copy Prompt</button>}
            <button type="button" onClick={() => { if (!isScriptApproved) onApproveScript(); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isScriptApproved ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200 cursor-default' : 'bg-primary text-on-primary hover:opacity-90'}`}>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>{isScriptApproved ? 'Approved' : 'Approve Script'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Navigation panel ──────────────────────────────────────────────────────────

function NavPanel({ chapters, filterMode, onFilterChange, isScriptApproved, onScrollTo }: {
  chapters: ParsedChapter[]; filterMode: FilterMode; onFilterChange: (f: FilterMode) => void;
  isScriptApproved: boolean; onScrollTo: (key: string) => void;
}) {
  const [collapsedChapters, setCollapsedChapters] = useState<Set<number>>(new Set());
  const [collapsedPages, setCollapsedPages]       = useState<Set<string>>(new Set());
  const toggleCh = (n: number) => setCollapsedChapters((p) => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s; });
  const togglePg = (k: string) => setCollapsedPages((p) => { const s = new Set(p); s.has(k) ? s.delete(k) : s.add(k); return s; });

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-outline-variant/10 flex-shrink-0">
        <p className="text-[11px] font-bold uppercase text-on-surface-variant tracking-widest mb-2">Navigation</p>
        <div className="flex gap-1 flex-wrap">
          {(['all', 'pending', 'generated', 'approved'] as FilterMode[]).map((f) => (
            <button key={f} type="button" onClick={() => onFilterChange(f)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${filterMode === f ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
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
                return (
                  <div key={pgKey}>
                    <button type="button" onClick={() => togglePg(pgKey)} className="w-full flex items-center gap-1.5 pl-6 pr-3 py-1 hover:bg-surface-container text-left transition-colors">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant/40 flex-shrink-0 transition-transform duration-150" style={{ transform: isPgColl ? 'rotate(-90deg)' : 'none' }}>expand_more</span>
                      <span className="text-[12px] font-semibold text-on-surface-variant">Page {page.pageNumber}</span>
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

function Toolbar({ filterMode, onFilterChange, viewMode, onViewModeChange, onCollapseAll, onExpandAll, onApproveAll, canApprove }: {
  filterMode: FilterMode; onFilterChange: (f: FilterMode) => void;
  viewMode: ViewMode; onViewModeChange: (v: ViewMode) => void;
  onCollapseAll: () => void; onExpandAll: () => void;
  onApproveAll: () => void; canApprove: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-container border border-outline-variant/10">
        <button type="button" onClick={onCollapseAll} title="Collapse all" className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"><span className="material-symbols-outlined text-sm">unfold_less</span><span className="hidden sm:inline">Collapse All</span></button>
        <button type="button" onClick={onExpandAll}   title="Expand all"   className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"><span className="material-symbols-outlined text-sm">unfold_more</span><span className="hidden sm:inline">Expand All</span></button>
      </div>
      <div className="h-6 w-px bg-outline-variant/20 hidden sm:block" />
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold text-on-surface-variant hidden sm:inline">Filter:</span>
        <select value={filterMode} onChange={(e) => onFilterChange(e.target.value as FilterMode)} className="text-xs font-semibold text-on-surface bg-surface-container border border-outline-variant/20 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40">
          <option value="all">All</option>
          <option value="pending">○ Pending</option>
          <option value="generated">● Ready</option>
          <option value="approved">✓ Approved</option>
        </select>
      </div>
      <div className="h-6 w-px bg-outline-variant/20 hidden sm:block" />
      <button type="button" disabled title="Panel-level regeneration coming soon" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#9CA3AF] bg-white border border-[#E0E0E0] cursor-not-allowed select-none"><span className="material-symbols-outlined text-sm">refresh</span><span className="hidden sm:inline">Regen Pending</span></button>
      <button type="button" onClick={onApproveAll} disabled={!canApprove} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${canApprove ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'}`}>
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span><span className="hidden sm:inline">Approve All</span>
      </button>
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
  state, totalPanels, panelsWithPrompts, isApproved,
  canGenerate, cooldown,
  onPrevious, onContinue, onRegenerate, showContinueWarning, onConfirmContinue, onCancelContinue,
}: {
  state: OverallState; totalPanels: number; panelsWithPrompts: number; isApproved: boolean;
  canGenerate: boolean; cooldown: number;
  onPrevious: () => void; onContinue: () => void; onRegenerate: () => void;
  showContinueWarning: boolean; onConfirmContinue: () => void; onCancelContinue: () => void;
}) {
  const pendingCount = totalPanels - panelsWithPrompts;
  const pct = totalPanels > 0 ? Math.round((isApproved ? totalPanels : panelsWithPrompts) / totalPanels * 100) : 0;

  return (
    <div className="fixed bottom-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]" style={{ left: 'var(--studio-sidebar-width, 0)' }}>
      {showContinueWarning && (
        <div className="absolute inset-x-0 bottom-full mb-2 flex justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-outline-variant/20 p-4 max-w-sm w-full">
            <p className="font-semibold text-on-surface text-sm">{pendingCount} panel{pendingCount !== 1 ? 's' : ''} pending</p>
            <p className="text-xs text-on-surface-variant mt-1 mb-3">Some panels don&apos;t have AI image prompts yet. Continue to Step 4 anyway?</p>
            <div className="flex gap-2">
              <button type="button" onClick={onCancelContinue} className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-colors">Cancel</button>
              <button type="button" onClick={onConfirmContinue} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:opacity-90">Continue Anyway</button>
            </div>
          </div>
        </div>
      )}
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <button type="button" onClick={onPrevious} className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors flex-shrink-0">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span className="hidden sm:inline">Previous Step</span>
        </button>
        {state >= 3 && totalPanels > 0 && (
          <div className="flex-1 max-w-[320px] hidden sm:block">
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-1">
              <span className="font-semibold">
                {isApproved ? `${totalPanels} Approved` : `${panelsWithPrompts} Generated · ${pendingCount} Pending`}
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-on-surface/8 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${isApproved ? 'bg-emerald-500' : 'bg-primary/60'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          {state >= 3 && (
            <button type="button" onClick={onRegenerate} disabled={!canGenerate}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40">
              <span className="material-symbols-outlined text-sm">refresh</span>
              {cooldown > 0 ? `Retry in ${cooldown}s` : 'Regenerate'}
            </button>
          )}
          {state >= 2 && (
            <button type="button" onClick={onContinue}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${isApproved ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-900 text-white hover:opacity-90'}`}>
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isApproved ? 'check_circle' : 'arrow_forward'}
              </span>
              {isApproved ? 'Approved · Continue →' : 'Continue → Images'}
            </button>
          )}
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
  } = useComicGeneration();

  const [copiedKey,           setCopiedKey]           = useState<string | null>(null);
  const [panelExpandStates,   setPanelExpandStates]   = useState<Record<string, boolean>>({});
  const [filterMode,          setFilterMode]          = useState<FilterMode>('all');
  const [viewMode,            setViewMode]            = useState<ViewMode>('script');
  const [navOpen,             setNavOpen]             = useState(true);
  const [showContinueWarning, setShowContinueWarning] = useState(false);

  const handleCopyPrompt = useCallback(async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  }, []);

  const isPanelExpanded = useCallback((key: string) => panelExpandStates[key] !== false, [panelExpandStates]);
  const togglePanel = useCallback((key: string) => setPanelExpandStates((prev) => ({ ...prev, [key]: !isPanelExpanded(key) })), [isPanelExpanded]);

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

  const allPanelKeys = useMemo(() => {
    const keys: string[] = [];
    for (const c of chapters) for (const p of c.pages) for (const pan of p.panels)
      keys.push(`${c.chapterNumber}-${p.pageNumber}-${pan.panelNumber}`);
    return keys;
  }, [chapters]);

  const panelsWithPrompts = useMemo(() =>
    chapters.reduce((s, c) => c.pages.reduce((ps, p) => ps + p.panels.filter((pan) => pan.prompt).length, s), 0),
    [chapters]);

  const collapseAll = useCallback(() => { const n: Record<string, boolean> = {}; allPanelKeys.forEach((k) => { n[k] = false; }); setPanelExpandStates(n); if (viewMode === 'compact') setViewMode('script'); }, [allPanelKeys, viewMode]);
  const expandAll   = useCallback(() => { const n: Record<string, boolean> = {}; allPanelKeys.forEach((k) => { n[k] = true; });  setPanelExpandStates(n); if (viewMode === 'compact') setViewMode('script'); }, [allPanelKeys, viewMode]);

  const scrollToPanel = useCallback((key: string) => {
    const el = document.getElementById(`panel-${key}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleContinue = useCallback(() => {
    if (isApproved) { setActiveStep(4); return; }
    const pendingPanels = totalPanels - panelsWithPrompts;
    if (pendingPanels > 0) { setShowContinueWarning(true); return; }
    handleApprove(3);
    setActiveStep(4);
  }, [isApproved, totalPanels, panelsWithPrompts, handleApprove, setActiveStep]);

  return (
    <section className="text-on-surface space-y-4 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Panel Script</h2>
          <p className="text-sm text-on-surface-variant mt-1">Full page-by-page, panel-by-panel script for image generation</p>
        </div>
        <StateBadge state={state} />
      </div>

      {/* ── Global action bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => handleGenerate(3)} disabled={!canGenerate}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${!canGenerate ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50' : state >= 3 ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest' : 'bg-primary text-on-primary hover:opacity-90'}`}>
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{isGenerating ? 'hourglass_empty' : state >= 3 ? 'refresh' : 'edit_document'}</span>
          {isGenerating ? 'Generating…' : cooldown > 0 ? `Retry in ${cooldown}s` : state >= 3 ? 'Regenerate script' : 'Generate script'}
        </button>
        {(state === 3 || state === 5) && (
          <button type="button" onClick={() => handleApprove(3)} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>Approve script
          </button>
        )}
        {state === 4 && (
          <button type="button" onClick={() => handleRevokeApproval(3)} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-base">undo</span>Revoke approval
          </button>
        )}
        {step3.error && <button type="button" onClick={() => handleRetry(3)} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"><span className="material-symbols-outlined text-base">replay</span>Retry</button>}
        {step3.error && <span className="text-sm text-red-500">{step3.error}</span>}
      </div>

      {/* ── Streaming ── */}
      {state === 2 && step3.streamingText && (
        <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />Live script stream</p>
          <pre className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto">{step3.streamingText}</pre>
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
          <div className="flex gap-4 items-start">
            {navOpen && (
              <div className="flex-shrink-0 w-[280px]">
                <div className="sticky top-14 rounded-xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden max-h-[calc(100vh-9rem)] flex flex-col">
                  <NavPanel chapters={chapters} filterMode={filterMode} onFilterChange={setFilterMode} isScriptApproved={isApproved} onScrollTo={scrollToPanel} />
                </div>
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Sticky toolbar */}
              <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-outline-variant/10 -mx-1 px-1 mb-4">
                <Toolbar filterMode={filterMode} onFilterChange={setFilterMode} viewMode={viewMode} onViewModeChange={setViewMode}
                  onCollapseAll={collapseAll} onExpandAll={expandAll}
                  onApproveAll={() => { if (state === 3 || state === 5) handleApprove(3); }} canApprove={state === 3 || state === 5} />
              </div>

              {/* Chapters / Pages / Panels */}
              {hasContent ? (
                <div className="space-y-2">
                  {chapters.map((chapter) => (
                    <div key={chapter.chapterNumber}>
                      {showChapters && <ChapterHeading chapter={chapter} />}
                      <div className={showChapters ? 'mt-4 space-y-5' : 'space-y-5'}>
                        {chapter.pages.map((page) => (
                          <div key={page.pageNumber} className="relative">
                            <PageHeading page={page} />
                            <div className="mt-3 space-y-3">
                              {page.panels.filter((pan) => matchesFilter(pan, filterMode, isApproved)).map((panel) => {
                                const key = `${chapter.chapterNumber}-${page.pageNumber}-${panel.panelNumber}`;
                                return (
                                  <PanelCard key={key} panel={panel} chapterNumber={chapter.chapterNumber} pageNumber={page.pageNumber}
                                    panelKey={key} isExpanded={isPanelExpanded(key)} onToggle={() => togglePanel(key)}
                                    viewMode={viewMode} isScriptApproved={isApproved}
                                    copiedKey={copiedKey} onCopyPrompt={handleCopyPrompt}
                                    onApproveScript={() => { if (state === 3 || state === 5) handleApprove(3); }} />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
                  <pre className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto">{step3.data.scriptMarkdown}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      {state >= 2 && (
        <ScriptBottomBar
          state={state} totalPanels={totalPanels} panelsWithPrompts={panelsWithPrompts} isApproved={isApproved}
          canGenerate={canGenerate} cooldown={cooldown}
          onPrevious={() => setActiveStep(2)}
          onContinue={handleContinue}
          onRegenerate={() => handleGenerate(3)}
          showContinueWarning={showContinueWarning}
          onConfirmContinue={() => { setShowContinueWarning(false); setActiveStep(4); }}
          onCancelContinue={() => setShowContinueWarning(false)}
        />
      )}
    </section>
  );
}