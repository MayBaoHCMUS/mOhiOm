import { Sparkles, Star, Heart } from 'lucide-react';

const STATS = [
  { value: '4', label: 'Art styles' },
  { value: '4', label: 'Export formats' },
  { value: '6', label: 'Pipeline steps' },
  { value: '2', label: 'Generation modes' },
];

const PANEL_CLASSES = ['bg-primary', 'bg-primary-container', 'bg-surface', 'bg-surface-container-high'];

const DOODLES = [
  { Icon: Sparkles, top: '10%', left: '92%', size: 40, rotate: -8, color: 'rgba(0, 88, 190, 0.2)' },
  { Icon: Star, top: '88%', left: '6%', size: 22, rotate: 14, color: 'rgba(0, 88, 190, 0.25)' },
  { Icon: Heart, top: '50%', left: '97%', size: 16, rotate: -6, color: 'rgba(20, 27, 43, 0.1)' },
];

function ComicPanelMock() {
  return (
    <div
      className="grid h-[320px] w-full grid-cols-2 grid-rows-2 gap-2 overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-low p-2 md:h-[420px]"
      aria-hidden="true"
    >
      {PANEL_CLASSES.map((cls) => (
        <div key={cls} className={`rounded-xl ${cls}`} />
      ))}
    </div>
  );
}

export function AboutSection() {
  return (
    <section id="about" className="relative z-10 overflow-hidden bg-surface px-6 py-20 md:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DOODLES.map(({ Icon, top, left, size, rotate, color }, i) => (
          <div key={i} className="absolute" style={{ top, left, color, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}>
            <Icon size={size} strokeWidth={1.5} />
          </div>
        ))}
      </div>

      <div
        className="relative mx-auto grid items-center gap-12 md:gap-20"
        style={{ maxWidth: 1100, gridTemplateColumns: '1fr 1.2fr' }}
      >
        <div className="col-span-2 md:col-span-1">
          <ComicPanelMock />
        </div>
        <div className="col-span-2 md:col-span-1">
          <h2 className="mb-6 text-4xl font-black tracking-tight text-on-surface md:text-6xl">About mOhiOm</h2>
          <p className="mb-4 max-w-md text-lg font-medium leading-relaxed text-on-surface-variant md:text-xl">
            mOhiOm is an AI-powered comic studio built for anyone with a story to tell.
          </p>
          <p className="max-w-md text-lg font-medium leading-relaxed text-on-surface-variant md:text-xl">
            Write a scene, pick a style, and let generative AI handle the art — no drawing skill required.
          </p>

          <div className="mt-10 flex flex-wrap gap-10 border-t border-outline-variant pt-8">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <h4 className="text-3xl font-black tracking-tight text-primary">{value}</h4>
                <p className="mt-1 text-sm text-on-surface-variant">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
