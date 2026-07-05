import { Palette, Download, Clapperboard, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Stat {
  icon: LucideIcon;
  value: string;
  label: string;
}

const STATS: Stat[] = [
  { icon: Palette, value: '4', label: 'Art styles' },
  { icon: Download, value: '4', label: 'Export formats' },
  { icon: Clapperboard, value: '6', label: 'Pipeline steps' },
  { icon: Layers, value: '2', label: 'Generation modes' },
];

export function StatsBar() {
  return (
    <section className="relative z-10 bg-surface px-6 py-10 md:px-12">
      <div
        className="mx-auto grid grid-cols-2 gap-8 rounded-3xl border border-outline-variant bg-surface-container-lowest p-8 shadow-md md:grid-cols-4 md:p-10"
        style={{ maxWidth: 1000 }}
      >
        {STATS.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex flex-col items-center gap-2 text-center md:items-start md:text-left">
            <Icon size={22} strokeWidth={1.75} className="text-primary" />
            <h3 className="text-3xl font-black tracking-tight text-on-surface md:text-4xl">{value}</h3>
            <p className="text-sm font-medium text-on-surface-variant">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
