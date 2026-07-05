import { Sparkles } from 'lucide-react';
import { ComicPanelMock } from './ComicPanelMock';

export function HeroDemoSection() {
  return (
    <section className="relative z-10 bg-surface px-6 py-16 md:px-12">
      <div
        aria-hidden="true"
        className="mx-auto grid gap-8 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-lg md:grid-cols-[1fr_1.4fr] md:gap-10 md:p-10"
        style={{ maxWidth: 1000 }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Your Story (Text)</p>
          <div className="flex-1 rounded-2xl border border-outline-variant bg-surface p-4 text-sm leading-relaxed text-on-surface-variant">
            A knight enters a haunted castle searching for the lost crown...
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-primary">
            <Sparkles size={14} strokeWidth={2} />
            Generate
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">AI Generated Comic</p>
          <ComicPanelMock
            rows={2}
            cols={3}
            className="h-[240px] md:h-[300px]"
            images={[
              '/images/landing/hero-panel-1.png',
              '/images/landing/hero-panel-2.png',
              '/images/landing/hero-panel-3.png',
              '/images/landing/hero-panel-4.png',
              '/images/landing/hero-panel-5.png',
              '/images/landing/hero-panel-6.png',
            ]}
          />
        </div>
      </div>
    </section>
  );
}
