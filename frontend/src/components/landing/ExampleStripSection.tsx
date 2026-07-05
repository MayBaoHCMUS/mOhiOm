import Image from 'next/image';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ComicPanelMock } from './ComicPanelMock';

const THUMB_IMAGES = [
  '/images/landing/example-thumb-1.png',
  '/images/landing/example-thumb-2.png',
  '/images/landing/example-thumb-3.png',
  '/images/landing/example-thumb-4.png',
];

export function ExampleStripSection() {
  return (
    <section className="relative z-10 bg-surface-container-low px-6 py-20 md:px-12">
      <div
        className="mx-auto flex flex-col items-center gap-6 md:flex-row md:justify-center"
        style={{ maxWidth: 1100 }}
      >
        <div className="w-full max-w-xs rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Input</p>
          <p className="text-sm italic leading-relaxed text-on-surface-variant">
            &ldquo;A little girl finds a magic book in the attic. The book takes her to another world...&rdquo;
          </p>
        </div>

        <ArrowRight
          size={24}
          className="hidden flex-shrink-0 rotate-90 text-outline-variant md:block md:rotate-0"
          aria-hidden="true"
        />

        <div className="flex gap-2" aria-hidden="true">
          {THUMB_IMAGES.map((src, i) => (
            <div key={src} className="relative h-16 w-16 overflow-hidden rounded-xl">
              <Image src={src} alt="" fill sizes="64px" className="object-cover" />
              {i === 1 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 size={20} className="animate-spin text-white" />
                </div>
              )}
            </div>
          ))}
        </div>

        <ArrowRight
          size={24}
          className="hidden flex-shrink-0 rotate-90 text-outline-variant md:block md:rotate-0"
          aria-hidden="true"
        />

        <div className="w-full max-w-xs rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Output</p>
          <ComicPanelMock
            rows={2}
            cols={2}
            className="h-[140px]"
            images={[
              '/images/landing/example-output-1.png',
              '/images/landing/example-output-2.png',
              '/images/landing/example-output-3.png',
              '/images/landing/example-output-4.png',
            ]}
          />
          <p className="mt-3 text-center text-xs font-medium text-on-surface-variant">6-panel comic in seconds</p>
        </div>
      </div>
    </section>
  );
}
