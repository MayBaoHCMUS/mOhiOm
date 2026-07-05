import { User, PenTool, Sparkles, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: LucideIcon[] = [User, PenTool, Sparkles, BookOpen];
const TINTS = ['bg-white/20', 'bg-white/10'];

interface AvatarStackProps {
  count?: number;
  className?: string;
}

export function AvatarStack({ count = 4, className = '' }: AvatarStackProps) {
  const items = Array.from({ length: count }, (_, i) => ({
    Icon: ICONS[i % ICONS.length],
    tint: TINTS[i % TINTS.length],
  }));

  return (
    <div className={`flex items-center ${className}`} aria-hidden="true">
      {items.map(({ Icon, tint }, i) => (
        <div
          key={i}
          className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary md:h-10 md:w-10 ${tint} ${i > 0 ? '-ml-3' : ''}`}
        >
          <Icon size={16} strokeWidth={1.75} className="text-white/80" />
        </div>
      ))}
    </div>
  );
}
