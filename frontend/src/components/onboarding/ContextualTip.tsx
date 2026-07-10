'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const DISMISSED_KEY = 'mohiom-dismissed-tips';

const isDismissed = (id: string): boolean => {
  try {
    const dismissed = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(dismissed) && dismissed.includes(id);
  } catch {
    return false;
  }
};

const dismissTip = (id: string) => {
  try {
    const dismissed = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? '[]');
    const next = Array.isArray(dismissed) ? dismissed : [];
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next, id]));
  } catch {
    /* noop — private browsing */
  }
};

interface Props {
  id: string;
  target: string;
  title: string;
  body: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  ctaLabel?: string;
  onCta?: () => void;
}

export default function ContextualTip({ id, target, title, body, position = 'bottom', ctaLabel, onCta }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dismissed, setDismissedState] = useState(true);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [tipHeight, setTipHeight] = useState(110);

  useEffect(() => {
    setDismissedState(isDismissed(id));
  }, [id]);

  useEffect(() => {
    if (dismissed) return;
    const recalc = () => {
      const el = document.querySelector(target);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    recalc();

    const el = document.querySelector(target);
    if (el) {
      const elRect = el.getBoundingClientRect();
      const inView =
        elRect.top >= 0 && elRect.left >= 0 && elRect.bottom <= window.innerHeight && elRect.right <= window.innerWidth;
      if (!inView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [target, dismissed]);

  useLayoutEffect(() => {
    if (tipRef.current) setTipHeight(tipRef.current.offsetHeight);
  }, [rect, title, body]);

  if (dismissed || !rect || typeof document === 'undefined') return null;

  const width = 240;
  const gap = 10;
  const margin = 8;

  // Flip to the opposite side when the preferred direction doesn't have room —
  // otherwise clamping alone can shove the tip on top of its own target
  // (e.g. "bottom" placement near the bottom of the viewport).
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const spaceRight = window.innerWidth - rect.right - gap;
  const spaceLeft = rect.left - gap;

  let effectivePosition = position;
  if (position === 'bottom' && spaceBelow < tipHeight && spaceAbove > spaceBelow) {
    effectivePosition = 'top';
  } else if (position === 'top' && spaceAbove < tipHeight && spaceBelow > spaceAbove) {
    effectivePosition = 'bottom';
  } else if (position === 'right' && spaceRight < width && spaceLeft > spaceRight) {
    effectivePosition = 'left';
  } else if (position === 'left' && spaceLeft < width && spaceRight > spaceLeft) {
    effectivePosition = 'right';
  }

  const pos = (() => {
    switch (effectivePosition) {
      case 'top':
        return { left: rect.left, top: rect.top - gap - tipHeight };
      case 'left':
        return { left: rect.left - width - gap, top: rect.top };
      case 'right':
        return { left: rect.right + gap, top: rect.top };
      case 'bottom':
      default:
        return { left: rect.left, top: rect.bottom + gap };
    }
  })();

  const clampedLeft = Math.max(margin, Math.min(pos.left, window.innerWidth - width - margin));
  const clampedTop = Math.max(margin, Math.min(pos.top, window.innerHeight - tipHeight - margin));

  const close = () => {
    dismissTip(id);
    setDismissedState(true);
  };

  return createPortal(
    <div
      ref={tipRef}
      style={{ position: 'fixed', left: clampedLeft, top: clampedTop, width, zIndex: 900 }}
      className="bg-on-surface text-white rounded-xl shadow-xl p-3.5"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss tip"
        className="absolute top-2 right-2 text-white/50 hover:text-white/90 transition-colors"
      >
        <X size={12} />
      </button>
      <p className="text-[13px] font-semibold pr-4">{title}</p>
      <p className="text-xs text-white/75 mt-1 leading-relaxed">{body}</p>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={() => {
            onCta();
            close();
          }}
          className="mt-2.5 h-7 px-3 rounded-md bg-primary text-xs font-semibold text-on-primary hover:opacity-90 transition-opacity"
        >
          {ctaLabel}
        </button>
      )}
    </div>,
    document.body
  );
}
