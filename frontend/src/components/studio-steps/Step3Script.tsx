'use client';

import React, { useState } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type OverallState = 1 | 2 | 3 | 4 | 5;

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

// ── Parser ────────────────────────────────────────────────────────────────────

function appendDialogueLine(panel: ParsedPanel, raw: string) {
  const t = raw.trim().replace(/^[-*•]\s*/, '');
  if (!t) return;
  if (/^SFX\s*:/i.test(t)) {
    panel.dialogues.push({ type: 'sfx', text: t.replace(/^SFX\s*:\s*/i, '').trim() });
    return;
  }
  if (/^CAPTION\s*:/i.test(t)) {
    panel.dialogues.push({ type: 'caption', text: t.replace(/^CAPTION\s*:\s*/i, '').trim() });
    return;
  }
  const speakerM = t.match(/^([A-Z][A-Z0-9\s\-'.]{0,25})\s*:\s*"?(.+)"?$/);
  if (speakerM) {
    panel.dialogues.push({
      type: 'speech',
      speaker: speakerM[1].trim(),
      text: speakerM[2].replace(/^["']|["']$/g, '').trim(),
    });
    return;
  }
  panel.dialogues.push({ type: 'speech', text: t.replace(/^["']|["']$/g, '').trim() });
}

function parseScript(md: string): ParsedChapter[] {
  type Mode = 'description' | 'dialogue' | 'prompt' | 'layout' | 'none';

  const chapters: ParsedChapter[] = [];
  let curChapter: ParsedChapter | null = null;
  let curPage: ParsedPage | null = null;
  let curPanel: ParsedPanel | null = null;
  let mode: Mode = 'none';

  const ensureChapter = () => {
    if (!curChapter) curChapter = { chapterNumber: 1, title: '', pages: [] };
  };

  const commitPanel = () => {
    if (!curPanel) return;
    ensureChapter();
    if (!curPage) curPage = { pageNumber: 1, panels: [] };
    curPage.panels.push(curPanel);
    curPanel = null;
    mode = 'none';
  };

  const commitPage = () => {
    commitPanel();
    if (!curPage) return;
    ensureChapter();
    curChapter!.pages.push(curPage);
    curPage = null;
  };

  const commitChapter = () => {
    commitPage();
    if (!curChapter) return;
    chapters.push(curChapter);
    curChapter = null;
  };

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^-{3,}$/.test(line)) continue;
    const clean = line.replace(/^#{1,4}\s*/, '').replace(/[*_`]/g, '').trim();

    const chM = clean.match(/^Chapter\s+(\d+)[:\-–—]?\s*(.*)/i);
    if (chM) {
      commitChapter();
      curChapter = { chapterNumber: +chM[1], title: chM[2].trim(), pages: [] };
      mode = 'none';
      continue;
    }

    const pgM = clean.match(/^Page\s+(\d+)/i);
    if (pgM) {
      commitPanel();
      if (curPage) { ensureChapter(); curChapter!.pages.push(curPage); }
      curPage = { pageNumber: +pgM[1], panels: [] };
      mode = 'none';
      continue;
    }

    const pnM = clean.match(/^Panel\s+(\d+)[:\s]?(.*)/i);
    if (pnM) {
      commitPanel();
      ensureChapter();
      if (!curPage) curPage = { pageNumber: 1, panels: [] };
      curPanel = {
        panelNumber: +pnM[1],
        label: `Panel ${pnM[1]}`,
        layoutSummary: '',
        description: pnM[2].trim(),
        dialogues: [],
        prompt: '',
      };
      mode = 'description';
      continue;
    }

    if (!curPanel) continue;

    if (/^(layout\s+summary|scene|setting)\s*:/i.test(clean)) {
      mode = 'layout';
      const rest = clean.replace(/^[^:]+:\s*/, '').trim();
      if (rest) curPanel.layoutSummary += (curPanel.layoutSummary ? ' ' : '') + rest;
      continue;
    }
    if (/^(ai\s+image\s+prompt|image\s+prompt)\s*:/i.test(clean)) {
      mode = 'prompt';
      const rest = clean.replace(/^[^:]+:\s*/, '').trim();
      if (rest) curPanel.prompt = rest;
      continue;
    }
    if (/^(dialogue(\/sfx)?|speech)\s*:/i.test(clean)) {
      mode = 'dialogue';
      const rest = clean.replace(/^[^:]+:\s*/, '').trim();
      if (rest) appendDialogueLine(curPanel, rest);
      continue;
    }
    if (/^SFX\s*:/i.test(clean)) {
      curPanel.dialogues.push({ type: 'sfx', text: clean.replace(/^SFX\s*:\s*/i, '').trim() });
      continue;
    }

    if (mode === 'layout')    curPanel.layoutSummary += ' ' + clean;
    else if (mode === 'prompt')  curPanel.prompt += (curPanel.prompt ? '\n' : '') + clean;
    else if (mode === 'dialogue') appendDialogueLine(curPanel, clean);
    else { curPanel.description += (curPanel.description ? ' ' : '') + clean; }
  }

  commitChapter();
  return chapters;
}

// ── State badge ───────────────────────────────────────────────────────────────

function StateBadge({ state }: { state: OverallState }) {
  if (state === 1) return null;
  if (state === 2) return (
    <div className="flex items-center gap-2 text-sm text-on-surface-variant">
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      Generating…
    </div>
  );
  if (state === 4) return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      Approved
    </div>
  );
  if (state === 5) return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
      Regenerated — re-approval needed
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>pending</span>
      Pending review
    </div>
  );
}

// ── AI prompt code block ──────────────────────────────────────────────────────

function PromptBlock({
  prompt,
  promptKey,
  copiedKey,
  onCopy,
}: {
  prompt: string;
  promptKey: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  const isCopied = copiedKey === promptKey;
  return (
    <div className="rounded-[6px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#2D2D4E]">
        <span
          className="text-[10px] font-mono text-[#9CA3AF] uppercase"
          style={{ letterSpacing: '0.1em' }}
        >
          AI Image Prompt
        </span>
        <button
          type="button"
          onClick={() => onCopy(promptKey, prompt)}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#9CA3AF] hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-sm">{isCopied ? 'check' : 'content_copy'}</span>
          {isCopied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="px-3 py-3 text-[12px] font-mono text-[#A8B4FF] leading-relaxed bg-[#1E1E2E] overflow-x-auto whitespace-pre-wrap break-all">
        {prompt}
      </pre>
    </div>
  );
}

// ── Dialogue lines ─────────────────────────────────────────────────────────────

function DialogueLines({ dialogues }: { dialogues: DialogueLine[] }) {
  if (!dialogues.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]" style={{ letterSpacing: '0.06em' }}>
        Dialogue / SFX
      </p>
      <div className="space-y-2">
        {dialogues.map((d, i) => {
          if (d.type === 'sfx') {
            return (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold uppercase text-[#9CA3AF] flex-shrink-0"
                  style={{ letterSpacing: '0.06em' }}
                >
                  SFX:
                </span>
                <span className="font-mono text-[13px] font-bold text-[#FF6B00] tracking-wider">
                  {d.text}
                </span>
              </div>
            );
          }
          if (d.type === 'caption') {
            return (
              <p key={i} className="text-[13px] italic text-[#9CA3AF] leading-[1.7]">
                [{d.text}]
              </p>
            );
          }
          return (
            <div key={i} className="flex items-start gap-2 pl-2.5 border-l-2 border-primary/30">
              {d.speaker && (
                <span
                  className="text-[11px] font-bold text-primary/70 flex-shrink-0 mt-0.5 uppercase"
                  style={{ letterSpacing: '0.04em' }}
                >
                  {d.speaker}:
                </span>
              )}
              <p className="text-[13px] italic text-[#374151] leading-[1.7]">&ldquo;{d.text}&rdquo;</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chapter heading (Level 1) ─────────────────────────────────────────────────

function ChapterHeading({ chapter }: { chapter: ParsedChapter }) {
  const totalPanels = chapter.pages.reduce((s, p) => s + p.panels.length, 0);
  return (
    <div className="mt-8 first:mt-0">
      <div className="h-px bg-outline-variant/20 mb-4" />
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/15">
        <span className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold tracking-widest">
          CH.{chapter.chapterNumber}
        </span>
        <h3 className="text-[18px] font-bold text-on-surface leading-tight min-w-0 truncate">
          {chapter.title || `Chapter ${chapter.chapterNumber}`}
        </h3>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-on-surface-variant flex-shrink-0">
          <span>{chapter.pages.length}p</span>
          <span className="text-outline-variant/40">·</span>
          <span>{totalPanels} panels</span>
        </div>
      </div>
    </div>
  );
}

// ── Page heading (Level 2) ────────────────────────────────────────────────────

function PageHeading({ page }: { page: ParsedPage }) {
  return (
    <div className="sticky top-14 z-10 py-2 bg-white -mx-1 px-1">
      <div className="flex items-center gap-3 pl-3.5 border-l-[3px] border-[#CBD5E1]">
        <p className="text-[15px] font-semibold text-on-surface">Page {page.pageNumber}</p>
        <span className="text-[#CBD5E1]">—</span>
        <span className="text-sm text-on-surface-variant">
          {page.panels.length} Panel{page.panels.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ── Panel card (Level 3+) ─────────────────────────────────────────────────────

function PanelCard({
  panel,
  chapterNumber,
  pageNumber,
  promptKey,
  copiedKey,
  onCopyPrompt,
  isScriptApproved,
  onApproveScript,
}: {
  panel: ParsedPanel;
  chapterNumber: number;
  pageNumber: number;
  promptKey: string;
  copiedKey: string | null;
  onCopyPrompt: (key: string, text: string) => void;
  isScriptApproved: boolean;
  onApproveScript: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasScript  = !!(panel.layoutSummary || panel.description || panel.dialogues.length > 0);
  const hasPrompt  = !!panel.prompt;

  return (
    <div className="rounded-lg border border-[#E0E0E0] overflow-hidden">
      {/* ── Header bar (click to collapse) ── */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#F5F5F5] hover:bg-[#EEEEEE] text-left transition-colors group"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Panel label pill — Level 3 */}
          <span
            className="flex-shrink-0 px-2.5 py-1 rounded-md text-[13px] font-semibold uppercase text-on-primary bg-primary"
            style={{ letterSpacing: '0.04em', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
          >
            {panel.label}
          </span>
          {panel.description && (
            <span className="text-[13px] text-on-surface-variant truncate max-w-[300px]">
              {panel.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="hidden sm:block text-[11px] text-on-surface-variant/50 font-medium">
            Ch.{chapterNumber} · P.{pageNumber}
          </span>
          <div className="h-4 w-px bg-outline-variant/20" />
          <span
            className="material-symbols-outlined text-lg text-on-surface-variant/50 group-hover:text-on-surface-variant transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
          >
            expand_more
          </span>
        </div>
      </button>

      {/* ── Body — collapses to header only ── */}
      <div className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          {/* 2-column: Script | Image Prompt */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E0E0E0]">

            {/* ── Left: Script side ── */}
            <div className="bg-white p-4 space-y-4">
              <p
                className="text-[11px] font-semibold uppercase text-[#9CA3AF]"
                style={{ letterSpacing: '0.06em' }}
              >
                📋 Script
              </p>

              {panel.layoutSummary && (
                <div className="space-y-1">
                  <p
                    className="text-[11px] font-semibold uppercase text-[#9CA3AF]"
                    style={{ letterSpacing: '0.06em' }}
                  >
                    Layout Summary
                  </p>
                  <p className="text-[13px] text-[#374151] leading-[1.7]">{panel.layoutSummary}</p>
                </div>
              )}

              {panel.description && (
                <div className="space-y-1">
                  <p
                    className="text-[11px] font-semibold uppercase text-[#9CA3AF]"
                    style={{ letterSpacing: '0.06em' }}
                  >
                    Panel Description
                  </p>
                  <p className="text-[13px] text-[#374151] leading-[1.7]">{panel.description}</p>
                </div>
              )}

              {panel.dialogues.length > 0 && <DialogueLines dialogues={panel.dialogues} />}

              {!hasScript && (
                <p className="text-xs text-[#9CA3AF] italic">No script data for this panel.</p>
              )}
            </div>

            {/* ── Right: Image prompt side ── */}
            <div className="bg-[#F8F9FF] p-4 space-y-4">
              <p
                className="text-[11px] font-semibold uppercase text-[#9CA3AF]"
                style={{ letterSpacing: '0.06em' }}
              >
                🖼 Image Prompt
              </p>

              {hasPrompt ? (
                <PromptBlock
                  prompt={panel.prompt}
                  promptKey={promptKey}
                  copiedKey={copiedKey}
                  onCopy={onCopyPrompt}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 rounded-[6px] border-2 border-dashed border-[#E0E0E0] text-center">
                  <span className="material-symbols-outlined text-3xl text-[#D0D0D0] mb-2">image_search</span>
                  <p className="text-xs text-[#9CA3AF]">No AI image prompt detected</p>
                </div>
              )}

              {/* Image thumbnail placeholder — filled in Step 4 */}
              <div className="flex flex-col items-center justify-center h-20 rounded-[6px] border-2 border-dashed border-[#E0E0E0] text-center bg-white/60">
                <span className="material-symbols-outlined text-xl text-[#D0D0D0]">photo_library</span>
                <p className="text-[11px] text-[#9CA3AF] mt-1">Generated in Step 4</p>
              </div>
            </div>
          </div>

          {/* ── Action row ── */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#FAFAFA] border-t border-[#E0E0E0]">
            <button
              type="button"
              disabled
              title="Panel-level regeneration — coming soon"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#9CA3AF] bg-white border border-[#E0E0E0] cursor-not-allowed select-none"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Regen Panel
            </button>
            <button
              type="button"
              disabled
              title="Inline panel editing — coming soon"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#9CA3AF] bg-white border border-[#E0E0E0] cursor-not-allowed select-none"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit
            </button>

            <div className="flex-1" />

            {hasPrompt && (
              <button
                type="button"
                onClick={() => onCopyPrompt(promptKey, panel.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant bg-white border border-[#E0E0E0] hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Copy Prompt
              </button>
            )}

            <button
              type="button"
              onClick={() => { if (!isScriptApproved) onApproveScript(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isScriptApproved
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200 cursor-default'
                  : 'bg-primary text-on-primary hover:opacity-90'
              }`}
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              {isScriptApproved ? 'Approved' : 'Approve Script'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Step3Script() {
  const {
    step3,
    handleGenerate,
    handleApprove,
    handleRevokeApproval,
    handleRetry,
    getCooldownSeconds,
  } = useComicGeneration();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyPrompt = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  };

  const cooldown     = getCooldownSeconds(3);
  const isGenerating = step3.isLoading;
  const canGenerate  = !isGenerating && cooldown === 0;

  let state: OverallState = 1;
  if (isGenerating)                                              state = 2;
  else if (step3.isApproved && !step3.regeneratedAfterApproval) state = 4;
  else if (step3.data && step3.regeneratedAfterApproval)        state = 5;
  else if (step3.data)                                          state = 3;

  const chapters     = step3.data ? parseScript(step3.data.scriptMarkdown) : [];
  const showChapters = chapters.length > 1 || (chapters.length === 1 && chapters[0].title !== '');
  const totalPages   = chapters.reduce((s, c) => s + c.pages.length, 0);
  const totalPanels  = chapters.reduce((s, c) => c.pages.reduce((ps, p) => ps + p.panels.length, 0) + s, 0);
  const hasContent   = totalPanels > 0;

  return (
    <section className="text-on-surface space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Panel Script</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Full page-by-page, panel-by-panel script for image generation
          </p>
        </div>
        <StateBadge state={state} />
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => handleGenerate(3)}
          disabled={!canGenerate}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
            !canGenerate
              ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
              : state >= 3
                ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                : 'bg-primary text-on-primary hover:opacity-90'
          }`}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isGenerating ? 'hourglass_empty' : state >= 3 ? 'refresh' : 'edit_document'}
          </span>
          {isGenerating
            ? 'Generating…'
            : cooldown > 0
              ? `Retry in ${cooldown}s`
              : state >= 3
                ? 'Regenerate script'
                : 'Generate script'}
        </button>

        {(state === 3 || state === 5) && (
          <button
            type="button"
            onClick={() => handleApprove(3)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Approve script
          </button>
        )}

        {state === 4 && (
          <button
            type="button"
            onClick={() => handleRevokeApproval(3)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base">undo</span>
            Revoke approval
          </button>
        )}

        {step3.error && (
          <button
            type="button"
            onClick={() => handleRetry(3)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
          >
            <span className="material-symbols-outlined text-base">replay</span>
            Retry
          </button>
        )}
        {step3.error && <span className="text-sm text-red-500">{step3.error}</span>}
      </div>

      {/* ── Streaming preview ── */}
      {state === 2 && step3.streamingText && (
        <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Live script stream
          </p>
          <pre className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto">
            {step3.streamingText}
          </pre>
        </div>
      )}

      {/* ── Empty state ── */}
      {state === 1 && (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4">
          <span
            className="material-symbols-outlined text-5xl text-outline-variant"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            edit_document
          </span>
          <div className="text-center">
            <p className="font-semibold text-on-surface">No script yet</p>
            <p className="text-sm text-on-surface-variant mt-1">
              Complete Steps 1 &amp; 2 first, then generate the panel script.
            </p>
          </div>
        </div>
      )}

      {/* ── Structured content ── */}
      {(state === 3 || state === 4 || state === 5) && step3.data && (
        <div className="max-w-[850px]">

          {/* Stats row */}
          {hasContent && (
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              {showChapters && (
                <>
                  <span className="text-sm font-semibold text-on-surface">
                    {chapters.length} Chapter{chapters.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-on-surface-variant/40">·</span>
                </>
              )}
              <span className="text-sm text-on-surface-variant">
                {totalPages} Page{totalPages !== 1 ? 's' : ''}
              </span>
              <span className="text-on-surface-variant/40">·</span>
              <span className="text-sm text-on-surface-variant">
                {totalPanels} Panel{totalPanels !== 1 ? 's' : ''}
              </span>
              {state === 4 && step3.approvedAt && (
                <>
                  <span className="text-on-surface-variant/40">·</span>
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    Approved {new Date(step3.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          )}

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
                          {page.panels.map((panel) => {
                            const key = `${chapter.chapterNumber}-${page.pageNumber}-${panel.panelNumber}`;
                            return (
                              <PanelCard
                                key={key}
                                panel={panel}
                                chapterNumber={chapter.chapterNumber}
                                pageNumber={page.pageNumber}
                                promptKey={key}
                                copiedKey={copiedKey}
                                onCopyPrompt={handleCopyPrompt}
                                isScriptApproved={state === 4}
                                onApproveScript={() => { if (state === 3 || state === 5) handleApprove(3); }}
                              />
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
            /* Fallback: raw markdown when parsing extracted no panels */
            <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
              <pre className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto">
                {step3.data.scriptMarkdown}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}