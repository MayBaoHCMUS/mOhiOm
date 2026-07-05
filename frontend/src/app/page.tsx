import Link from 'next/link';
import { Sparkles, Star, BookOpen } from 'lucide-react';
import { ScrollZoomHero } from '@/components/landing/ScrollZoomHero';
import { Marquee } from '@/components/landing/Marquee';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { AboutSection } from '@/components/landing/AboutSection';
import { ShowcaseSection } from '@/components/landing/ShowcaseSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { BottomNav } from '@/components/landing/BottomNav';

export default function LandingPage() {
  return (
    <main className="landing-root min-h-screen bg-surface text-on-surface">
      <MiniTopBar />
      <ScrollZoomHero />
      <Marquee />
      <ServicesSection />
      <AboutSection />
      <ShowcaseSection />
      <FAQSection />
      <CTASection />
      <LandingFooter />
    </main>
  );
}

function MiniTopBar() {
  return (
    <nav className="flex items-center justify-between px-6 py-5 md:px-12 border-b border-on-surface/5">
      <span className="text-lg font-black tracking-tighter text-on-surface">mOhiOm™</span>
      <Link
        href="/login"
        className="rounded-full bg-on-surface px-5 py-2 text-xs font-bold uppercase tracking-widest text-surface hover:scale-105 active:scale-95 transition-transform"
      >
        Try free
      </Link>
    </nav>
  );
}

const CTA_DOODLES = [
  { Icon: Sparkles, top: '18%', left: '88%', size: 44, rotate: -10, color: 'rgba(255, 255, 255, 0.25)' },
  { Icon: Star, top: '78%', left: '94%', size: 20, rotate: 12, color: 'rgba(255, 255, 255, 0.3)' },
  { Icon: BookOpen, top: '85%', left: '76%', size: 28, rotate: -6, color: 'rgba(255, 255, 255, 0.2)' },
];

function CTASection() {
  return (
    <section className="relative z-10 flex flex-col items-start gap-8 overflow-hidden bg-primary px-6 py-20 md:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {CTA_DOODLES.map(({ Icon, top, left, size, rotate, color }, i) => (
          <div key={i} className="absolute" style={{ top, left, color, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}>
            <Icon size={size} strokeWidth={1.5} />
          </div>
        ))}
      </div>

      <h2 className="relative max-w-xl text-4xl font-black leading-tight tracking-tight text-on-primary md:text-6xl">
        Your story deserves to be seen.
      </h2>
      <Link
        href="/login"
        className="relative inline-flex items-center gap-2 rounded-full bg-surface px-8 py-4 text-sm font-bold uppercase tracking-widest text-on-surface shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        Create your first comic →
      </Link>
    </section>
  );
}

function LandingFooter() {
  return (
    <>
      <BottomNav />
      <footer className="flex flex-col gap-4 bg-primary px-6 py-8 md:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href="mailto:hello@mohiom.me" className="text-xs text-white/70 transition-colors hover:text-white">
            hello@mohiom.me
          </a>
          <div className="flex gap-5">
            {['Twitter', 'Instagram'].map((social) => (
              <a
                key={social}
                href="#"
                className="text-xs uppercase tracking-widest text-white/50 transition-colors hover:text-white"
              >
                {social}
              </a>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-white/40">mohiom.me — 2026</span>
          <span className="text-xs text-white/40">Built with Gemini + IP-Adapter</span>
        </div>
      </footer>
    </>
  );
}
