import Image from 'next/image';
import { Sparkles, Star, Heart, PenTool, BookOpen, MessageCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const PANEL_CLASSES = [
  'bg-primary',
  'bg-primary-container',
  'bg-surface',
  'bg-surface-container-high',
  'bg-surface-container',
  'bg-surface-container-highest',
];

const PANEL_ICONS: LucideIcon[] = [Sparkles, Star, Heart, PenTool, BookOpen, MessageCircle];

interface ComicPanelMockProps {
  rows?: number;
  cols?: number;
  className?: string;
  withIcons?: boolean;
  images?: string[];
}

export function ComicPanelMock({
  rows = 2,
  cols = 2,
  className = 'h-[320px] md:h-[420px]',
  withIcons = true,
  images,
}: ComicPanelMockProps) {
  const count = rows * cols;
  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };

  if (images && images.length >= count) {
    return (
      <div
        className={`grid w-full gap-2 overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-low p-2 ${className}`}
        style={gridStyle}
        aria-hidden="true"
      >
        {images.slice(0, count).map((src) => (
          <div key={src} className="relative overflow-hidden rounded-xl">
            <Image src={src} alt="" fill sizes="(min-width: 768px) 20vw, 33vw" className="object-cover" />
          </div>
        ))}
      </div>
    );
  }

  const panels = Array.from({ length: count }, (_, i) => ({
    bgClass: PANEL_CLASSES[i % PANEL_CLASSES.length],
    Icon: PANEL_ICONS[i % PANEL_ICONS.length],
  }));

  return (
    <div
      className={`grid w-full gap-2 overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-low p-2 ${className}`}
      style={gridStyle}
      aria-hidden="true"
    >
      {panels.map(({ bgClass, Icon }, i) => (
        <div key={i} className={`relative flex items-center justify-center rounded-xl ${bgClass}`}>
          {withIcons && <Icon size={20} strokeWidth={1.5} className="text-on-surface-variant/40" />}
        </div>
      ))}
    </div>
  );
}
