'use client';

import React, { useState } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import Markdown from '@/components/Markdown';

// Parse analysisMarkdown into named sections by ## headings
function parseSections(md: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;
  for (const line of md.split('\n')) {
    if (/^#{1,3}\s/.test(line) && !/^####/.test(line)) {
      if (current && current.body.trim()) sections.push(current);
      current = { heading: line.replace(/^#+\s*/, '').trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current && current.body.trim()) sections.push(current);
  return sections;
}

function AnalysisSection({
  heading,
  body,
  defaultExpanded = false,
}: {
  heading: string;
  body: string;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-sm text-on-surface">{heading}</span>
        <span
          className="material-symbols-outlined text-lg text-on-surface-variant transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <Markdown className="[&>*:last-child]:mb-0">{body.trim()}</Markdown>
        </div>
      )}
    </div>
  );
}

function CharacterCard({ entry }: { entry: string }) {
  const [name, ...rest] = entry.split(/[-–:]/);
  const desc = rest.join(' ').trim();
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-on-surface leading-snug">{name.trim()}</p>
        {desc && <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">{desc}</p>}
      </div>
    </div>
  );
}

function extractStats(structuredJson: Record<string, unknown> | null): { label: string; value: string }[] {
  if (!structuredJson) return [];
  const stats: { label: string; value: string }[] = [];
  try {
    const steps = structuredJson.steps as Record<string, unknown> | undefined;
    const s1 = (steps?.step1 ?? structuredJson.step_1_analysis) as Record<string, unknown> | undefined;
    const data = (s1?.data ?? s1?.api_data) as Record<string, unknown> | undefined;
    const json = (data?.structured_json ?? data) as Record<string, unknown> | undefined;
    if (json) {
      const chapters = json.chapters as unknown[] | undefined;
      if (chapters?.length) stats.push({ label: 'Chapters', value: String(chapters.length) });
      const totalPanels = json.total_panels ?? json.estimated_panels;
      if (totalPanels != null) stats.push({ label: 'Est. panels', value: String(totalPanels) });
    }
  } catch {
    // ignore
  }
  return stats;
}

type State = 1 | 2 | 3 | 4 | 5;

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
        Approved
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
      Regenerated — re-approval needed
    </div>
  );
}

export default function Step1Analysis() {
  const {
    step1,
    handleGenerate,
    handleApprove,
    handleRevokeApproval,
    handleRetry,
    getCooldownSeconds,
  } = useComicGeneration();

  const cooldown = getCooldownSeconds(1);
  const isGenerating = step1.isLoading;
  const canGenerate = !isGenerating && cooldown === 0;

  let state: State = 1;
  if (isGenerating) {
    state = 2;
  } else if (step1.isApproved && !step1.regeneratedAfterApproval) {
    state = 4;
  } else if (step1.data && step1.regeneratedAfterApproval) {
    state = 5;
  } else if (step1.data) {
    state = 3;
  }

  const sections = step1.data ? parseSections(step1.data.analysisMarkdown) : [];
  const stats = extractStats(step1.data?.structuredJson ?? null);
  const chars = step1.data?.characterBreakdown ?? [];
  const defaultExpandedIdx = new Set([0, 1]);

  return (
    <section className="text-on-surface space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Story Analysis</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Narrative insights, character arcs, and structural breakdown
          </p>
        </div>
        <StateBadge state={state} />
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => handleGenerate(1)}
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
            {isGenerating ? 'hourglass_empty' : state >= 3 ? 'refresh' : 'auto_awesome'}
          </span>
          {isGenerating
            ? 'Generating…'
            : cooldown > 0
              ? `Retry in ${cooldown}s`
              : state >= 3
                ? 'Regenerate'
                : 'Generate Analysis'}
        </button>

        {(state === 3 || state === 5) && (
          <button
            type="button"
            onClick={() => handleApprove(1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Approve
          </button>
        )}

        {state === 4 && (
          <button
            type="button"
            onClick={() => handleRevokeApproval(1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base">undo</span>
            Revoke Approval
          </button>
        )}

        {step1.error && (
          <button
            type="button"
            onClick={() => handleRetry(1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
          >
            <span className="material-symbols-outlined text-base">replay</span>
            Retry
          </button>
        )}
        {step1.error && <span className="text-sm text-red-500">{step1.error}</span>}
      </div>

      {/* ── Streaming ── */}
      {state === 2 && step1.streamingText && (
        <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-6">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Live analysis stream
          </p>
          <Markdown className="[&>*:last-child]:mb-0">{step1.streamingText}</Markdown>
        </div>
      )}

      {/* ── Empty ── */}
      {state === 1 && (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant/20 py-16 flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-outline-variant" style={{ fontVariationSettings: "'FILL' 1" }}>
            auto_stories
          </span>
          <div className="text-center">
            <p className="font-semibold text-on-surface">No analysis yet</p>
            <p className="text-sm text-on-surface-variant mt-1">
              Click &ldquo;Generate Analysis&rdquo; to extract narrative structure and characters.
            </p>
          </div>
        </div>
      )}

      {/* ── Content (states 3, 4, 5) ── */}
      {(state === 3 || state === 4 || state === 5) && step1.data && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

          {/* Left — collapsible sections */}
          <div className="space-y-3">
            {sections.length > 0 ? (
              sections.map((sec, i) => (
                <AnalysisSection
                  key={sec.heading}
                  heading={sec.heading}
                  body={sec.body}
                  defaultExpanded={defaultExpandedIdx.has(i)}
                />
              ))
            ) : (
              <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
                <Markdown className="[&>*:last-child]:mb-0">{step1.data.analysisMarkdown}</Markdown>
              </div>
            )}
          </div>

          {/* Right — character cards + stats */}
          <div className="space-y-4">
            {chars.length > 0 && (
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                  Characters
                </p>
                <div className="space-y-2">
                  {chars.map((c, i) => (
                    <CharacterCard key={`${c}-${i}`} entry={c} />
                  ))}
                </div>
              </div>
            )}

            {stats.length > 0 && (
              <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-4">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                  Quick Stats
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {stats.map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-2xl font-extrabold text-on-surface">{s.value}</p>
                      <p className="text-xs text-on-surface-variant">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state === 4 && step1.approvedAt && (
              <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/15 p-4 text-center">
                <span className="material-symbols-outlined text-2xl text-emerald-500 mb-1 block" style={{ fontVariationSettings: "'FILL' 1" }}>
                  task_alt
                </span>
                <p className="text-xs text-emerald-600 font-semibold">Approved</p>
                <p className="text-[10px] text-emerald-500/70 mt-0.5">
                  {new Date(step1.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
