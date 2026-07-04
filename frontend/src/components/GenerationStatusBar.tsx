'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { SegmentedProgressBar } from '@/components/SegmentedProgressBar';

export interface GenerationProgress {
  total: number;
  completed: number;
  failed: number;
  currentLabel: string | null;
  etaSeconds: number | null;
}

interface GenerationStatusBarProps {
  progress: GenerationProgress;
  label: string;
  itemNoun: string;
  renderDetail: () => React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s left`;
  return `~${Math.round(seconds / 60)}m left`;
}

export function GenerationStatusBar({
  progress,
  label,
  itemNoun,
  renderDetail,
  defaultExpanded = false,
  className = '',
}: GenerationStatusBarProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { total, completed, failed, currentLabel, etaSeconds } = progress;
  const done = completed + failed;
  const allDone = total > 0 && done >= total;

  const dotClass = allDone
    ? failed > 0
      ? 'bg-amber-500'
      : 'bg-emerald-500'
    : 'bg-blue-500 animate-pulse';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
        <span className="text-xs font-semibold text-on-surface-variant flex-shrink-0 whitespace-nowrap hidden sm:inline">
          {label}
          {currentLabel ? ` — ${currentLabel}` : ''}
        </span>
        <span className="flex-1 min-w-[80px] max-w-[240px]">
          <SegmentedProgressBar total={total} success={completed} error={failed} loading={allDone ? 0 : 1} height={6} />
        </span>
        <span className="text-xs text-on-surface-variant whitespace-nowrap">
          {done}/{total} {itemNoun}
          {total === 1 ? '' : 's'} done
          {failed > 0 ? ` · ${failed} failed` : ''}
        </span>
        {etaSeconds !== null && (
          <span className="text-xs text-outline whitespace-nowrap hidden sm:inline">{formatEta(etaSeconds)}</span>
        )}
        {expanded ? <ChevronDown size={14} className="text-outline flex-shrink-0" /> : <ChevronUp size={14} className="text-outline flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pt-3 max-h-56 overflow-y-auto">{renderDetail()}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
