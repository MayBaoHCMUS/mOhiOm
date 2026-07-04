'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Circle, ChevronUp, ChevronDown, BookOpen, Clapperboard, ImagePlus, MessageCircle, Send } from 'lucide-react';
import { useOnboardingContext } from '@/context/OnboardingContext';
import type { OnboardingChecklistItems } from '@/utils/onboardingStorage';

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

  useEffect(() => {
    if (state.completed) setExpanded(true);
  }, [state.completed]);

  if (dismissed) return null;

  return (
    <div
      className="fixed z-40 bottom-4"
      style={{ left: 'calc(var(--studio-sidebar-width) + 1rem)' }}
    >
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="mb-2 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl p-4"
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

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 shadow-lg hover:bg-surface-container transition-colors"
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
        {expanded ? <ChevronDown size={14} className="text-primary" /> : <ChevronUp size={14} className="text-primary" />}
      </button>
    </div>
  );
}
