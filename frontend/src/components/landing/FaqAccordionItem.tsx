'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface Props {
  question: string;
  answer: string;
}

export function FaqAccordionItem({ question, answer }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-on-surface"
      >
        <span className="text-lg font-bold">{question}</span>
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary transition-transform duration-200"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          <Plus size={16} strokeWidth={3} className="text-on-primary" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl px-6 pb-6 text-sm leading-relaxed text-on-surface-variant md:text-base">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
