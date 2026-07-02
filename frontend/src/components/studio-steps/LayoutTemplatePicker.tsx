'use client';

import React, { useState } from 'react';
import { TEMPLATES_BY_COUNT, LAYOUT_DISPLAY_NAMES_MAP, LAYOUT_SVGS } from './Step4Generation';

const LAYOUT_GROUPS: Record<string, string> = {
  single: 'standard', horizontal_duo: 'standard', vertical_trio: 'standard',
  grid_2x2: 'standard', grid_2x3: 'standard',
  splash_top: 'hero', splash_bottom: 'hero',
  hero_left: 'hero', hero_right: 'hero', wide_duo: 'hero',
  widescreen_pair: 'cinematic', widescreen_trio: 'cinematic', film_strip: 'cinematic',
  action_dynamic_4: 'dynamic', asymmetric_4: 'dynamic', vertical_flow: 'dynamic',
  t_shape: 'dynamic', l_shape: 'dynamic',
};

const GROUP_LABELS = ['all', 'standard', 'hero', 'cinematic', 'dynamic'] as const;
type GroupLabel = typeof GROUP_LABELS[number];

interface LayoutTemplatePickerProps {
  panelCount: number;
  selectedLayout: string;
  onSelect: (name: string) => void;
  suggestion: { suggested: string; reason: string } | null;
  isSuggLoading: boolean;
  onGetSuggestion: () => void;
}

export function LayoutTemplatePicker({
  panelCount,
  selectedLayout,
  onSelect,
  suggestion,
  isSuggLoading,
  onGetSuggestion,
}: LayoutTemplatePickerProps) {
  const [activeGroup, setActiveGroup] = useState<GroupLabel>('all');

  const allOptions = TEMPLATES_BY_COUNT[panelCount] ?? [];
  const options = activeGroup === 'all'
    ? allOptions
    : allOptions.filter(n => LAYOUT_GROUPS[n] === activeGroup);

  return (
    <div className="space-y-3">
      {/* AI Suggest button */}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={onGetSuggestion} disabled={isSuggLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors disabled:opacity-50">
          {isSuggLoading
            ? <><span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />Thinking…</>
            : '✨ AI Suggest Layout'}
        </button>
        {suggestion && (
          <span className="text-xs text-on-surface-variant">
            → <span className="font-semibold text-on-surface">{LAYOUT_DISPLAY_NAMES_MAP[suggestion.suggested] ?? suggestion.suggested}</span>
          </span>
        )}
      </div>
      {suggestion?.reason && (
        <p className="text-[11px] text-on-surface-variant bg-surface-container px-3 py-2 rounded-xl leading-relaxed">
          💡 {suggestion.reason}
        </p>
      )}

      {/* Group filter pills */}
      <div className="flex gap-1 flex-wrap">
        {GROUP_LABELS.map(g => (
          <button key={g} type="button" onClick={() => setActiveGroup(g)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors capitalize
              ${activeGroup === g
                ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
                : 'bg-transparent text-[#6B7280] border-[#E5E7EB] hover:border-primary/30'
              }`}>
            {g}
          </button>
        ))}
      </div>

      {/* Scrollable template card grid */}
      {options.length > 0 && (
        <div className="overflow-y-auto max-h-[320px]">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {options.map((name) => {
              const isSelected = selectedLayout === name;
              const isSuggested = suggestion?.suggested === name && !isSelected;
              return (
                <button key={name} type="button" onClick={() => onSelect(name)}
                  className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : isSuggested
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-outline-variant/20 hover:border-primary/30 hover:bg-surface-container-low'
                  }`}>
                  {isSelected && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold leading-none">✓</span>
                    </span>
                  )}
                  {isSuggested && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary/40 flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold leading-none">✨</span>
                    </span>
                  )}
                  <svg viewBox="0 0 48 64" className="w-8 h-[42px]" fill="none" xmlns="http://www.w3.org/2000/svg"
                    style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-outline-variant)' }}>
                    {LAYOUT_SVGS[name] ?? <rect x="2" y="2" width="44" height="60" rx="1" fill="currentColor"/>}
                  </svg>
                  <span className="text-[10px] font-semibold text-on-surface-variant leading-tight text-center line-clamp-1">
                    {LAYOUT_DISPLAY_NAMES_MAP[name] ?? name}
                  </span>
                  <span className="text-[9px] text-outline">{panelCount}p</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {options.length === 0 && activeGroup !== 'all' && (
        <p className="text-[11px] text-on-surface-variant text-center py-4">
          No {activeGroup} layouts for {panelCount} panels ·{' '}
          <button type="button" onClick={() => setActiveGroup('all')} className="text-primary underline">
            Show all
          </button>
        </p>
      )}
    </div>
  );
}
