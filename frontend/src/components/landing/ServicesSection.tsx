import { Clapperboard, Users, Send, Palette, Download, Sparkles, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Service {
  icon: LucideIcon;
  title: string;
  description: string;
  className: string;
  top: number;
}

const SERVICES: Service[] = [
  {
    icon: Clapperboard,
    title: '6-Step Pipeline',
    description: 'From story to published comic, guided step by step.',
    className: 'bg-primary text-on-primary',
    top: 80,
  },
  {
    icon: Palette,
    title: 'Multiple Art Styles',
    description: 'Manga, Webtoon, Chibi, or Watercolor — pick the look that fits your story.',
    className: 'bg-surface-container-high text-on-surface',
    top: 116,
  },
  {
    icon: Users,
    title: 'Character Consistency',
    description: 'AI keeps your characters visually consistent across panels.',
    className: 'bg-primary-container text-on-primary',
    top: 152,
  },
  {
    icon: Download,
    title: 'Flexible Export',
    description: 'Download as a ZIP, CBZ, print-ready PDF, or EPUB.',
    className: 'bg-surface-container-highest text-on-surface',
    top: 188,
  },
  {
    icon: Send,
    title: 'One-Click Publish',
    description: 'Share your comic as a web reader link instantly.',
    className: 'bg-primary text-on-primary',
    top: 224,
  },
];

const DOODLES = [
  { Icon: Sparkles, top: '4%', left: '8%', size: 20, rotate: -10, color: 'rgba(0, 88, 190, 0.25)' },
  { Icon: Star, top: '8%', left: '92%', size: 32, rotate: 12, color: 'rgba(20, 27, 43, 0.1)' },
];

export function ServicesSection() {
  return (
    <section className="relative z-10 bg-surface-container-low px-6 py-24 md:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {DOODLES.map(({ Icon, top, left, size, rotate, color }, i) => (
          <div key={i} className="absolute" style={{ top, left, color, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}>
            <Icon size={size} strokeWidth={1.5} />
          </div>
        ))}
      </div>

      <div className="relative mx-auto flex flex-col gap-8" style={{ maxWidth: 1100 }}>
        {SERVICES.map(({ icon: Icon, title, description, className, top }) => (
          <div
            key={title}
            className={`sticky flex flex-col justify-between gap-6 rounded-3xl p-8 shadow-lg md:p-14 ${className}`}
            style={{ top, minHeight: 300 }}
          >
            <h3 className="text-3xl font-black tracking-tight md:text-5xl">{title}</h3>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <p className="max-w-md text-lg font-medium opacity-90 md:text-xl">{description}</p>
              <Icon size={48} strokeWidth={1.5} className="flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
