import Link from 'next/link';

const LINK_CLASS = 'text-xs uppercase tracking-widest text-white/70 hover:text-white transition-colors';

export function BottomNav() {
  return (
    <nav className="flex flex-wrap gap-8 border-t border-white/20 bg-primary px-6 py-6 md:px-12">
      <a href="#how-it-works" className={LINK_CLASS}>
        How it works
      </a>
      <Link href="/gallery" className={LINK_CLASS}>
        Gallery
      </Link>
      <a href="#about" className={LINK_CLASS}>
        About
      </a>
      <Link href="/login" className="text-xs font-bold uppercase tracking-widest text-white">
        Try free
      </Link>
    </nav>
  );
}
