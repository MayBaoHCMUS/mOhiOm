'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface TourStep {
  selector: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

interface Props {
  steps: TourStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

const PADDING = 8;
const GLOW_PADDING = 20;

function useTargetRect(selector: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const recalc = useCallback(() => {
    const el = document.querySelector(selector);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [selector]);

  useEffect(() => {
    // Force the (possibly collapsed) studio sidebar open so labels/rects are meaningful.
    window.dispatchEvent(new Event('studio-sidebar-force-expand'));

    // The sidebar's width transition (300ms) changes target geometry without
    // firing scroll/resize, so give it a moment before the first measurement.
    const initialTimer = window.setTimeout(() => {
      recalc();
      const target = document.querySelector(selector);
      if (target) {
        const targetRect = target.getBoundingClientRect();
        const inView =
          targetRect.top >= 0 &&
          targetRect.left >= 0 &&
          targetRect.bottom <= window.innerHeight &&
          targetRect.right <= window.innerWidth;
        if (!inView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 320);
    recalc();

    const el = document.querySelector(selector);
    const observer = new ResizeObserver(recalc);
    if (el) observer.observe(el);
    const sidebar = document.querySelector('aside');
    if (sidebar) observer.observe(sidebar);

    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);

    return () => {
      window.clearTimeout(initialTimer);
      observer.disconnect();
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [selector, recalc]);

  return rect;
}

function popoverPosition(rect: DOMRect, tooltipHeight: number) {
  const width = 280;
  const gap = 24;
  const margin = 16;

  const spaceRight = window.innerWidth - rect.right - gap;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;

  let left: number;
  let top: number;
  let arrow: 'left' | 'top' | 'bottom';

  if (spaceRight >= width) {
    // Preferred: to the right, vertically centered on the target.
    left = rect.right + gap;
    top = rect.top + rect.height / 2 - tooltipHeight / 2;
    arrow = 'left';
  } else if (spaceBelow >= tooltipHeight) {
    // Below the target, arrow pointing up at it.
    left = rect.right - width;
    top = rect.bottom + gap;
    arrow = 'top';
  } else if (spaceAbove >= tooltipHeight) {
    // Above the target, arrow pointing down at it.
    left = rect.right - width;
    top = rect.top - gap - tooltipHeight;
    arrow = 'bottom';
  } else {
    // Neither side fully fits — clamping alone would otherwise cover the
    // target, so pick whichever side has more room and let the final clamp
    // below just keep it on-screen.
    if (spaceBelow >= spaceAbove) {
      left = rect.right - width;
      top = rect.bottom + gap;
      arrow = 'top';
    } else {
      left = rect.right - width;
      top = rect.top - gap - tooltipHeight;
      arrow = 'bottom';
    }
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - tooltipHeight - margin));

  return { left, top, width, arrow };
}

export default function SpotlightTour({ steps, currentStep, onNext, onPrev, onSkip, onComplete }: Props) {
  const [mounted, setMounted] = useState(false);
  const step = steps[currentStep];
  const rect = useTargetRect(step?.selector ?? '');

  // Measure the tooltip's real rendered height so it (and its arrow, which
  // sits at 50% of the card's own height) center correctly on the target —
  // a fixed height guess drifts whenever the card's content changes.
  // useLayoutEffect (not useEffect) so the correction lands before the
  // browser paints, instead of one frame after — avoiding a visible jump.
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(240);

  useLayoutEffect(() => {
    if (tooltipRef.current) setTooltipHeight(tooltipRef.current.offsetHeight);
  }, [currentStep]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStep < steps.length - 1) onNext();
        else onComplete();
      } else if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentStep, steps.length, onNext, onPrev, onSkip, onComplete]);

  if (!mounted || typeof document === 'undefined' || !step) return null;

  const Icon = step.icon;
  const box = rect
    ? {
        x: rect.left - PADDING,
        y: rect.top - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;
  const pos = rect ? popoverPosition(rect, tooltipHeight) : null;
  const glowBox = rect
    ? {
        x: rect.left - GLOW_PADDING,
        y: rect.top - GLOW_PADDING,
        width: rect.width + GLOW_PADDING * 2,
        height: rect.height + GLOW_PADDING * 2,
      }
    : null;

  return createPortal(
    <>
      {glowBox && (
        <motion.div
          animate={{ left: glowBox.x, top: glowBox.y, width: glowBox.width, height: glowBox.height }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            borderRadius: 16,
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.18) 0%, transparent 70%)',
            filter: 'blur(4px)',
            zIndex: 999,
            pointerEvents: 'none',
          }}
        />
      )}

      <svg
        style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none', width: '100%', height: '100%' }}
      >
        <defs>
          <mask id="onboarding-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {box && (
              // Plain <rect> (not motion.rect): framer-motion's SVG-attribute path doesn't
              // reliably apply x/y to elements that only ever live inside a <mask> (no normal
              // layout box to measure), silently leaving the cutout stuck at (0,0). A CSS
              // transition on the presentation attributes animates it correctly instead.
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx={10}
                fill="black"
                style={{ transition: 'all 300ms ease-in-out' }}
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#onboarding-spotlight-mask)"
        />
      </svg>

      {box && (
        <motion.div
          animate={{ left: box.x, top: box.y, width: box.width, height: box.height }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.10)',
            zIndex: 1001,
            pointerEvents: 'none',
          }}
        />
      )}

      {box && (
        <motion.div
          animate={{ left: box.x, top: box.y, width: box.width, height: box.height }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            borderRadius: 10,
            border: '2px solid var(--color-primary)',
            boxShadow: '0 0 0 4px rgba(0,88,190,0.20)',
            zIndex: 1002,
            pointerEvents: 'none',
          }}
        />
      )}

      {pos && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            ref={tooltipRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 1003,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
            }}
            className="bg-surface-container-lowest rounded-xl p-5"
          >
            {pos.arrow === 'left' && (
              <div
                style={{
                  position: 'absolute', left: -9, top: '50%', transform: 'translateY(-50%)',
                  width: 0, height: 0, borderStyle: 'solid', borderWidth: '9px 9px 9px 0',
                  borderColor: 'transparent var(--color-surface-container-lowest) transparent transparent',
                }}
              />
            )}
            {pos.arrow === 'top' && (
              <div
                style={{
                  position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                  width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 9px 9px 9px',
                  borderColor: 'transparent transparent var(--color-surface-container-lowest) transparent',
                }}
              />
            )}
            {pos.arrow === 'bottom' && (
              <div
                style={{
                  position: 'absolute', bottom: -9, left: '50%', transform: 'translateX(-50%)',
                  width: 0, height: 0, borderStyle: 'solid', borderWidth: '9px 9px 0 9px',
                  borderColor: 'var(--color-surface-container-lowest) transparent transparent transparent',
                }}
              />
            )}

            <p className="text-[11px] text-outline mb-2">
              {currentStep + 1} of {steps.length}
            </p>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary-container/10 flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-primary" />
              </div>
              <p className="text-[15px] font-bold text-on-surface">{step.title}</p>
            </div>
            <p className="mt-2 text-[13px] text-on-surface-variant leading-relaxed">{step.body}</p>

            <div className="mt-4 flex items-center gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === currentStep
                      ? 'w-5 bg-primary'
                      : i < currentStep
                        ? 'w-1.5 bg-green-600'
                        : 'w-1.5 bg-outline-variant'
                  }`}
                />
              ))}
            </div>

            <div className="mt-3.5 flex items-center justify-between">
              <button
                type="button"
                onClick={onSkip}
                className="h-9 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs text-outline hover:text-on-surface-variant hover:border-outline hover:bg-surface-container transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={currentStep < steps.length - 1 ? onNext : onComplete}
                className="h-[34px] px-[18px] rounded-lg bg-primary text-xs font-semibold text-on-primary hover:opacity-90 transition-opacity"
              >
                {currentStep < steps.length - 1 ? 'Next →' : 'Finish ✓'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </>,
    document.body
  );
}
