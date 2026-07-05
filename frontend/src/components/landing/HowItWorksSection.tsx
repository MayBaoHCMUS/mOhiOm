import { Fragment } from 'react';
import { PenTool, Sparkles, Download, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Step {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const STEPS: Step[] = [
  { number: '1', title: 'Write', description: 'Describe your story in any language.', icon: PenTool },
  { number: '2', title: 'Generate', description: 'Our AI turns your text into comic panels.', icon: Sparkles },
  { number: '3', title: 'Export', description: 'Download, share, or continue editing.', icon: Download },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative z-10 bg-surface-container-low px-6 py-20 md:px-12">
      <h2 className="mb-14 text-center text-3xl font-black tracking-tight text-on-surface md:text-5xl">
        How It Works
      </h2>
      <div className="mx-auto flex max-w-4xl flex-col gap-10 md:flex-row md:items-start">
        {STEPS.map(({ number, title, description, icon: Icon }, i) => (
          <Fragment key={number}>
            <div className="flex items-start gap-4 md:flex-1 md:flex-col md:items-center md:text-center">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary">
                <Icon size={28} strokeWidth={1.75} />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Step {number}</span>
                <h3 className="mt-1 text-xl font-black text-on-surface">{title}</h3>
                <p className="mt-1 max-w-[220px] text-sm text-on-surface-variant">{description}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="hidden items-center pt-8 md:flex" aria-hidden="true">
                <ArrowRight size={20} className="text-outline-variant" />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
