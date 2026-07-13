'use client';

import { useEffect, useRef, useState } from 'react';
import type { AttributeCategory } from './characterOptions';

interface Props {
  category: AttributeCategory;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}

const POPOVER_WIDTH = 320;
const VIEWPORT_MARGIN = 16;

/** One pill button + popover of option chips, handling both single-select
 * (auto-closes on pick, exclusive) and multi-select (stays open, toggles
 * membership, closes via "Done"/outside-click/Escape) via `category.mode`. */
export default function AttributePillPicker({ category, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isMulti = category.mode === 'multi';
  const selectedValues = isMulti ? (value as string[]) : value ? [value as string] : [];
  const hasSelection = selectedValues.length > 0;

  const computePosition = () => {
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN);
    setPopoverPos({ top: rect.bottom + 8, left: Math.max(VIEWPORT_MARGIN, left) });
  };

  const handleToggleOpen = () => {
    if (!open) computePosition();
    setOpen((o) => !o);
  };

  // Outside-click / Escape / resize / scroll all close the popover — scroll and
  // resize invalidate the fixed-position measurement, so we close rather than
  // try to track a moving anchor.
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (pillRef.current?.contains(e.target as Node) || popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const handleDismiss = () => setOpen(false);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('resize', handleDismiss);
    window.addEventListener('scroll', handleDismiss, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', handleDismiss);
      window.removeEventListener('scroll', handleDismiss, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleChipClick = (option: string) => {
    if (isMulti) {
      const current = value as string[];
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      onChange(next);
    } else {
      onChange(value === option ? '' : option);
      setOpen(false);
    }
  };

  const pillLabel = hasSelection
    ? isMulti
      ? `${category.label} (${selectedValues.length})`
      : (value as string)
    : category.label;

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        onClick={handleToggleOpen}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all whitespace-nowrap ${
          hasSelection
            ? 'bg-primary/10 border-primary text-primary'
            : 'border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:bg-surface-container-low'
        }`}
      >
        <span className="material-symbols-outlined text-base">{category.icon}</span>
        {pillLabel}
      </button>

      {open && popoverPos && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`${category.label} options`}
          style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, width: POPOVER_WIDTH }}
          className="z-50 max-h-80 overflow-y-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-2xl p-3"
        >
          <div className="flex flex-wrap gap-2">
            {category.options.map((option) => {
              const selected = selectedValues.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleChipClick(option)}
                  aria-pressed={selected}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    selected
                      ? 'bg-primary text-on-primary border-primary'
                      : 'border-outline-variant/40 text-on-surface-variant hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {isMulti && (
            <div className="mt-3 pt-3 border-t border-outline-variant/20 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-primary text-on-primary hover:opacity-90"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
