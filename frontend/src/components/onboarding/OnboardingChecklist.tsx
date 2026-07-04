'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useDragControls, useMotionValue } from 'framer-motion';
import { CheckCircle2, Circle, ChevronUp, ChevronDown, GripVertical, BookOpen, Clapperboard, ImagePlus, MessageCircle, Send } from 'lucide-react';
import { useOnboardingContext } from '@/context/OnboardingContext';
import type { OnboardingChecklistItems } from '@/utils/onboardingStorage';

const POSITION_STORAGE_KEY = 'mohiom-onboarding-widget-position';

const ITEMS: {
  key: keyof OnboardingChecklistItems;
  label: string;
  description: string;
  action: string;
  route: string;
  icon: typeof BookOpen;
}[] = [
  {
    key: 'createStory',
    label: 'Set up your first story',
    description: 'Write or paste a narrative to kick off the pipeline',
    action: 'Open the studio →',
    route: '/studio',
    icon: BookOpen,
  },
  {
    key: 'runPipeline',
    label: 'Run the Comic Pipeline',
    description: 'Move through Setup, Analysis, Characters and Script',
    action: 'Continue the pipeline →',
    route: '/studio',
    icon: Clapperboard,
  },
  {
    key: 'generateImage',
    label: 'Generate your first panels',
    description: 'Complete Step 4 — image generation',
    action: 'Continue the pipeline →',
    route: '/studio',
    icon: ImagePlus,
  },
  {
    key: 'addDialogue',
    label: 'Add speech bubbles',
    description: 'Place your first dialogue bubble on a panel',
    action: 'Open the editor →',
    route: '/studio/editor',
    icon: MessageCircle,
  },
  {
    key: 'publishComic',
    label: 'Publish your comic',
    description: 'Share it as a public web reader link',
    action: 'Go to Publish →',
    route: '/studio/publish',
    icon: Send,
  },
];

export default function OnboardingChecklist() {
  const { state, completedCount, totalCount, progressPct } = useOnboardingContext();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    if (state.completed) setExpanded(true);
  }, [state.completed]);

  // Restore a previously dragged-to position (stored as an offset from the
  // default anchor below), so the widget stays where the user last left it.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { x: number; y: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          x.set(parsed.x);
          y.set(parsed.y);
        }
      }
    } catch {
      // ignore malformed/unavailable storage
    }
  }, [x, y]);

  const persistPosition = () => {
    try {
      window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: x.get(), y: y.get() }));
    } catch {
      // ignore write failures (private browsing, quota, etc.)
    }
  };

  if (dismissed) return null;

  return (
    <div ref={constraintsRef} className="fixed inset-0 z-40 pointer-events-none">
      <motion.div
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={constraintsRef}
        onDragEnd={persistPosition}
        style={{ x, y, top: '5rem', left: 'calc(var(--studio-sidebar-width) + 1rem)' }}
        className="absolute pointer-events-auto w-fit"
      >
        <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant rounded-lg pl-1 pr-3 py-2 shadow-lg">
          <span
            onPointerDown={(e) => dragControls.start(e)}
            aria-label="Drag to move"
            className="cursor-grab active:cursor-grabbing text-outline hover:text-on-surface-variant p-1 touch-none flex-shrink-0"
          >
            <GripVertical size={14} />
          </span>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="relative w-6 h-6 flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
                <circle cx="12" cy="12" r="10" fill="none" stroke="var(--color-outline-variant)" strokeWidth="3" />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="3"
                  strokeDasharray={`${(progressPct / 100) * 62.8} 62.8`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-primary">
                {completedCount}/{totalCount}
              </span>
            </span>
            <span className="text-xs font-semibold text-primary">Getting started</span>
            {expanded ? <ChevronUp size={14} className="text-primary" /> : <ChevronDown size={14} className="text-primary" />}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="mt-2 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl p-4"
            >
              {state.completed ? (
                <div className="text-center py-2">
                  <CheckCircle2 size={32} className="mx-auto text-green-600" />
                  <p className="mt-2 text-sm font-bold text-on-surface">You&apos;re all set!</p>
                  <p className="mt-1 text-xs text-on-surface-variant">Your first comic awaits.</p>
                  <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    className="mt-3 text-xs text-outline hover:text-on-surface-variant transition-colors"
                  >
                    Got it, dismiss ✓
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[13px] font-bold text-on-surface">Getting started with mOhiOm</p>
                  <p className="text-[11px] text-outline mt-0.5">
                    {completedCount} of {totalCount} completed
                  </p>
                  <div className="h-[3px] rounded-full bg-outline-variant mt-2 mb-3.5 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div>
                    {ITEMS.map((item, i) => {
                      const done = state.checklistItems[item.key];
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.key}
                          className={`flex items-start gap-2.5 py-2 ${
                            i < ITEMS.length - 1 ? 'border-b border-surface-container' : ''
                          } ${!done ? 'cursor-pointer hover:bg-surface-container rounded-lg -mx-1.5 px-1.5' : ''}`}
                          onClick={done ? undefined : () => router.push(item.route)}
                        >
                          {done ? (
                            <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle size={20} className="text-outline-variant flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p
                              className={`text-[13px] font-medium ${
                                done ? 'line-through text-outline' : 'text-on-surface'
                              }`}
                            >
                              {item.label}
                            </p>
                            {!done && (
                              <p className="text-[11px] text-primary mt-0.5 flex items-center gap-1">
                                <Icon size={11} /> {item.action}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
