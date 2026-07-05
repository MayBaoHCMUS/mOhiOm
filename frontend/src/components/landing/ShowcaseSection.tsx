import { Sparkles, Star, MessageCircle } from 'lucide-react';

interface ShowcaseItem {
  quote: string;
  persona: string;
}

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    quote: 'Turn a short story into a manga in an afternoon, without touching a drawing tool.',
    persona: 'For beginners',
  },
  {
    quote: 'Upload one reference photo and every panel keeps your character on-model.',
    persona: 'For creators',
  },
  {
    quote: 'Export print-ready 300 DPI pages or a shareable web reader link in one step.',
    persona: 'For professionals & educators',
  },
];

const DOODLES = [
  { Icon: Sparkles, top: '8%', left: '4%', size: 36, rotate: -12, color: 'rgba(0, 88, 190, 0.2)' },
  { Icon: Star, top: '92%', left: '96%', size: 18, rotate: 10, color: 'rgba(0, 88, 190, 0.25)' },
  { Icon: MessageCircle, top: '6%', left: '50%', size: 26, rotate: 6, color: 'rgba(20, 27, 43, 0.1)' },
];

export function ShowcaseSection() {
  return (
    <section className="relative z-10 overflow-hidden bg-surface-container-low px-6 py-20 md:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DOODLES.map(({ Icon, top, left, size, rotate, color }, i) => (
          <div key={i} className="absolute" style={{ top, left, color, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}>
            <Icon size={size} strokeWidth={1.5} />
          </div>
        ))}
      </div>

      <div className="relative mx-auto grid grid-cols-1 gap-8 md:grid-cols-3" style={{ maxWidth: 1100 }}>
        {SHOWCASE_ITEMS.map(({ quote, persona }) => (
          <div key={persona} className="flex flex-col rounded-3xl bg-surface-container-lowest p-8 shadow-md">
            <span className="mb-4 text-4xl leading-none text-primary" aria-hidden="true">
              &ldquo;
            </span>
            <p className="mb-6 text-lg font-bold leading-snug text-on-surface">{quote}</p>
            <div className="mt-auto flex items-center gap-3">
              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-surface-container-high" />
              <p className="text-sm font-bold text-on-surface-variant">{persona}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
