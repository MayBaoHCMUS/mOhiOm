'use client';

// Shared image-generation model picker (SD1.5/SDXL vs Omni) with live backend
// health. Extracted from Step1 so the Create Character modal and the Publish
// page present the same control instead of a raw URL field / status strip.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { BackendHealth } from '@/hooks/useBackendHealth';

export const IMAGE_MODEL_OPTIONS = [
  { value: 'default' as const, icon: 'bolt', label: 'SD1.5 / SDXL', sub: 'Default image generation model' },
  { value: 'omni' as const, icon: 'auto_awesome', label: 'Omni (all generation)', sub: 'Used for every image in this project — characters, panels, pages' },
];

// Small colored status dot + label for a backend's health.
export function HealthPill({ status }: { status: BackendHealth }) {
  if (status === 'unconfigured') return null;
  const map: Record<Exclude<BackendHealth, 'unconfigured'>, { dot: string; label: string; text: string }> = {
    up:       { dot: 'bg-emerald-500', label: 'Online',    text: 'text-emerald-600' },
    down:     { dot: 'bg-red-500',     label: 'Offline',   text: 'text-red-600' },
    checking: { dot: 'bg-gray-300',    label: 'Checking…', text: 'text-gray-400' },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${status === 'checking' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  );
}

export default function ImageModelPicker({
  value,
  onChange,
  disabled,
  omniConfigured,
  defaultHealth,
  omniHealth,
  onRecheck,
  label = 'Image Generation Model',
  hint = 'This project follows whatever model is configured in Settings — no per-project override. Changes there apply immediately.',
}: {
  value: 'default' | 'omni';
  onChange: (v: 'default' | 'omni') => void;
  disabled?: boolean;
  omniConfigured: boolean;
  defaultHealth: BackendHealth;
  omniHealth: BackendHealth;
  onRecheck: () => void;
  label?: string;
  hint?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const healthFor = (v: 'default' | 'omni'): BackendHealth => (v === 'omni' ? omniHealth : defaultHealth);
  const options = IMAGE_MODEL_OPTIONS.map((o) =>
    o.value === 'omni' && !omniConfigured
      ? { ...o, sub: 'Set the Omni URL in Settings first' }
      : o
  );
  const selected = options.find((o) => o.value === value) ?? options[0];
  const selectedOffline = healthFor(value) === 'down';

  const close = useCallback(() => setOpen(false), []);

  // Decide which way the list opens. The picker can sit near the bottom of a
  // scrollable panel (e.g. the Create Character modal's left column), where a
  // downward list gets clipped by that container rather than the viewport — so
  // measure against the nearest scrollable ancestor, falling back to the viewport.
  const decideDirection = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const needed = options.length * 68 + 12;

    let clipBottom = window.innerHeight;
    let parent = el.parentElement;
    while (parent) {
      const { overflowY } = window.getComputedStyle(parent);
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
        clipBottom = Math.min(clipBottom, parent.getBoundingClientRect().bottom);
        break;
      }
      parent = parent.parentElement;
    }

    const rect = el.getBoundingClientRect();
    const spaceBelow = clipBottom - rect.bottom;
    const spaceAbove = rect.top;
    setDropUp(spaceBelow < needed && spaceAbove > spaceBelow);
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">{label}</label>
        <Link href="/settings" className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:underline">
          Edit in Settings
        </Link>
      </div>

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => {
            if (!o) { onRecheck(); decideDirection(); }
            return !o;
          });
        }}
        className={`
          w-full flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm
          border transition-all duration-150 text-left
          ${open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0 shadow-sm bg-gray-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-gray-500" style={{ fontSize: 16 }}>{selected.icon}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800 text-sm leading-tight">{selected.label}</p>
            <HealthPill status={healthFor(value)} />
          </div>
          <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate">{selected.sub}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {selectedOffline && (
        <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
          This model&apos;s server is offline — pick another or check Settings.
        </p>
      )}

      {/* Dropdown panel */}
      {open && (
        <div
          className={`absolute z-50 left-0 right-0 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden ${
            dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {options.map((option) => {
            const isActive = option.value === value;
            const health = healthFor(option.value);
            const isOffline = health === 'down';
            return (
              <button
                key={option.value}
                type="button"
                disabled={isOffline}
                onClick={() => { if (isOffline) return; onChange(option.value); setOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                  ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-sm bg-gray-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-500" style={{ fontSize: 18 }}>{option.icon}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold text-sm leading-tight ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {option.label}
                    </p>
                    <HealthPill status={health} />
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{option.sub}</p>
                </div>
                {isActive && !isOffline && (
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  );
}
