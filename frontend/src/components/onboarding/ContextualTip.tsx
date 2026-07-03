'use client';

import { useEffect, useState } from 'react';
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
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [target, dismissed]);

  if (dismissed || !rect || typeof document === 'undefined') return null;

  const width = 240;
  const gap = 10;
  const pos = (() => {
    switch (position) {
      case 'top':
        return { left: rect.left, top: rect.top - gap - 110 };
      case 'left':
        return { left: rect.left - width - gap, top: rect.top };
      case 'right':
        return { left: rect.right + gap, top: rect.top };
      case 'bottom':
      default:
        return { left: rect.left, top: rect.bottom + gap };
    }
  })();

  const close = () => {
    dismissTip(id);
    setDismissedState(true);
  };

  return createPortal(
    <div
      style={{ position: 'fixed', left: pos.left, top: pos.top, width, zIndex: 900 }}
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
