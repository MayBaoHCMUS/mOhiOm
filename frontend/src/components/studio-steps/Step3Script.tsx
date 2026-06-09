'use client';

import React, { useState } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import Markdown from '@/components/Markdown';

type State = 1 | 2 | 3 | 4 | 5;

// ── Parse script markdown into pages + panels ────────────────────────────────
interface ScriptPanel {
  label: string;
  dialogue: string;
  prompt: string;
  description: string;
}

interface ScriptPage {
  pageNumber: number;
  panels: ScriptPanel[];
}

function parseScript(md: string): ScriptPage[] {
  const pages: ScriptPage[] = [];
  let currentPage: ScriptPage | null = null;
  let currentPanel: ScriptPanel | null = null;

  const flush = () => {
    if (currentPanel && currentPage) currentPage.panels.push(currentPanel);
    currentPanel = null;
  };

  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const pageMatch = line.match(/^Page\s+(\d+)/i);
    if (pageMatch) {
      flush();
      if (currentPage) pages.push(currentPage);
      currentPage = { pageNumber: Number(pageMatch[1]), panels: [] };
      continue;
    }

    const panelMatch = line.match(/^Panel\s+(\d+)[:\s]/i);
    if (panelMatch && currentPage) {
      flush();
      currentPanel = {
        label: `Panel ${panelMatch[1]}`,
        description: line.replace(/^Panel\s+\d+[:\s]*/i, '').trim(),
        dialogue: '',
        prompt: '',
      };
      continue;
    }

    if (currentPanel) {
      if (/^Dialogue\/SFX[:\s]/i.test(line)) {
        currentPanel.dialogue = line.replace(/^Dialogue\/SFX[:\s]*/i, '').trim();
      } else if (/^AI Image Prompt[:\s]/i.test(line)) {
        currentPanel.prompt = line.replace(/^AI Image Prompt[:\s]*/i, '').trim();
      } else if (currentPanel.description) {
        // extra description lines
        currentPanel.description += ' ' + line;
      }
    } else if (currentPage && !currentPanel) {
      // Page-level description lines
    }
  }

  flush();
  if (currentPage) pages.push(currentPage);
  return pages;
}

// ── State badge ───────────────────────────────────────────────────────────────
function StateBadge({ state }: { state: State }) {
  if (state === 1) return null;
  if (state === 2) {
    return (
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        Generating…
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

// ── Page card ─────────────────────────────────────────────────────────────────
function PageCard({ page, defaultOpen }: { page: ScriptPage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
      {/* Header — same pattern as Step 2 DesignSheetCard */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[11px] font-bold text-on-surface-variant/40 flex-shrink-0">
            P{page.pageNumber}
          </span>
          <p className="font-semibold text-sm text-on-surface">Page {page.pageNumber}</p>
          <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full flex-shrink-0">
            {page.panels.length} panel{page.panels.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span
          className="material-symbols-outlined text-lg text-on-surface-variant transition-transform flex-shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="border-t border-outline-variant/10">
          {page.panels.map((panel, i) => (
            <div key={i} className={i > 0 ? 'border-t border-outline-variant/10' : ''}>
              {/* Panel label row */}
              <div className="px-5 py-2.5 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {panel.label}
                </span>
              </div>

              {/* 2-column layout: Scene + Dialogue left, Image Prompt right */}
              <div
                className={`grid border-t border-outline-variant/10 divide-x divide-outline-variant/10 ${
                  panel.prompt ? 'grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {/* Left — scene description + dialogue */}
                <div className="p-4 space-y-3">
                  {panel.description && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                        Scene
                      </p>
                      <p className="text-xs text-on-surface leading-relaxed">{panel.description}</p>
                    </div>
                  )}
                  {panel.dialogue && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                        Dialogue / SFX
                      </p>
                      <p className="text-xs text-on-surface leading-relaxed italic">
                        &ldquo;{panel.dialogue}&rdquo;
                      </p>
                    </div>
                  )}
                  {!panel.description && !panel.dialogue && (
                    <p className="text-xs text-on-surface-variant/50 italic">No description</p>
                  )}
                </div>

                {/* Right — image prompt */}
                {panel.prompt && (
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                      Image Prompt
                    </p>
                    <p className="text-xs text-on-surface-variant leading-relaxed font-mono">
                      {panel.prompt}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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

  const cooldown = getCooldownSeconds(3);
  const isGenerating = step3.isLoading;
  const canGenerate = !isGenerating && cooldown === 0;

  let state: State = 1;
  if (isGenerating) {
    state = 2;
  } else if (step3.isApproved && !step3.regeneratedAfterApproval) {
    state = 4;
  } else if (step3.data && step3.regeneratedAfterApproval) {
    state = 5;
  } else if (step3.data) {
    state = 3;
  }

  const pages = step3.data ? parseScript(step3.data.scriptMarkdown) : [];
  const totalPanels = pages.reduce((sum, p) => sum + p.panels.length, 0);

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

      {/* ── Streaming ── */}
      {state === 2 && step3.streamingText && (
        <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Live script stream
          </p>
          <Markdown className="[&>*:last-child]:mb-0">{step3.streamingText}</Markdown>
        </div>
      )}

      {/* ── Empty ── */}
      {state === 1 && (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-outline-variant" style={{ fontVariationSettings: "'FILL' 1" }}>
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

      {/* ── Content ── */}
      {(state === 3 || state === 4 || state === 5) && step3.data && (
        <div className="max-w-[750px]">
          {/* Stats row */}
          {pages.length > 0 && (
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm font-semibold text-on-surface">
                {pages.length} page{pages.length !== 1 ? 's' : ''}
              </span>
              <span className="text-on-surface-variant">·</span>
              <span className="text-sm text-on-surface-variant">
                {totalPanels} panel{totalPanels !== 1 ? 's' : ''}
              </span>
              {state === 4 && step3.approvedAt && (
                <>
                  <span className="text-on-surface-variant">·</span>
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Approved {new Date(step3.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Structured pages */}
          {pages.length > 0 ? (
            <div className="space-y-3">
              {pages.map((page, i) => (
                <PageCard key={page.pageNumber} page={page} defaultOpen={i === 0} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
              <Markdown className="[&>*:last-child]:mb-0">{step3.data.scriptMarkdown}</Markdown>
            </div>
          )}
        </div>
      )}
    </section>
  );
}