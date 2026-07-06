'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clapperboard, Users, MessageCircle, Send, Sparkles, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onStartTour: () => void;
  onSkip: () => void;
}

const FEATURES = [
  {
    icon: Clapperboard,
    title: '6-Step Pipeline',
    description: 'From story to published comic, guided step by step.',
  },
  {
    icon: Users,
    title: 'Character Consistency',
    description: 'AI keeps your characters visually consistent across panels.',
  },
  {
    icon: MessageCircle,
    title: 'Speech Bubbles',
    description: 'Add dialogue with a full set of bubble styles.',
  },
  {
    icon: Send,
    title: 'One-Click Publish',
    description: 'Share your comic as a web reader link instantly.',
  },
];

export default function WelcomeModal({ isOpen, onStartTour, onSkip }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onSkip]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onSkip();
          }}
        >
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative z-10 w-full max-w-[480px] max-h-[90vh] flex flex-col bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="relative px-8 pt-9 pb-7 bg-gradient-to-br from-primary to-primary-container overflow-hidden">
              <motion.div
                className="absolute -top-2 right-6 text-on-primary/20"
                animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sparkles size={48} />
              </motion.div>
              <motion.div
                className="absolute bottom-3 right-16 text-on-primary/15"
                animate={{ opacity: [0.1, 0.25, 0.1], scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              >
                <Sparkles size={28} />
              </motion.div>
              <p className="text-[12px] font-bold tracking-[0.1em] text-[rgba(255,255,255,0.9)]">
                ✦ mOhiOm
              </p>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight text-on-primary">
                Turn your story into a comic — automatically.
              </h2>
              <p className="mt-1.5 text-sm text-[rgba(255,255,255,0.75)]">
                AI-powered, end-to-end comic creation.
              </p>
            </div>

            <div className="relative px-8 py-6 overflow-y-auto">
              <button
                type="button"
                onClick={onSkip}
                aria-label="Close"
                className="absolute top-3 right-3 p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <X size={18} />
              </button>
              <p className="text-xs font-semibold tracking-[0.08em] uppercase text-on-surface-variant mb-4">
                What you can do with mOhiOm
              </p>
              <div className="flex flex-col">
                {FEATURES.map(({ icon: Icon, title, description }, i) => (
                  <div
                    key={title}
                    className={`flex items-start gap-3 pb-2.5 ${
                      i < FEATURES.length - 1 ? 'mb-2.5 border-b border-surface-container' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-container/10 flex items-center justify-center">
                      <Icon size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{title}</p>
                      <p className="text-[13px] text-on-surface-variant">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-8 pb-7 flex items-center justify-end gap-[10px]">
              <button
                type="button"
                onClick={onSkip}
                className="h-10 min-w-[120px] px-5 rounded-lg border-[1.5px] border-outline text-[13px] font-medium text-on-surface hover:border-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Skip tour
              </button>
              <button
                type="button"
                onClick={onStartTour}
                className="h-10 min-w-[160px] px-6 rounded-lg bg-primary text-[13px] font-bold text-on-primary hover:opacity-90 transition-opacity"
              >
                Start the tour →
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
