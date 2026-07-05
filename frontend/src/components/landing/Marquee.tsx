const ITEMS = [
  { label: 'EPUB export', highlight: false },
  { label: 'AI image generation', highlight: false },
  { label: 'Character consistency', highlight: true },
  { label: 'Manga styles', highlight: false },
];

function MarqueeRow() {
  return (
    <div className="flex">
      {ITEMS.map(({ label, highlight }) => (
        <span
          key={label}
          className={`flex items-center whitespace-nowrap px-8 text-sm font-extrabold uppercase ${
            highlight ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          {label} •
        </span>
      ))}
    </div>
  );
}

export function Marquee() {
  return (
    <div className="flex overflow-hidden border-y border-outline-variant bg-surface py-6">
      <div className="marquee-track flex">
        <MarqueeRow />
        <MarqueeRow />
      </div>
    </div>
  );
}
