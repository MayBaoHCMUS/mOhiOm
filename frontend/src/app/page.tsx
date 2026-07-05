import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Star, BookOpen, MessageCircle, Twitter, Instagram, Github } from 'lucide-react';
import { ScrollZoomHero } from '@/components/landing/ScrollZoomHero';
import { HeroDemoSection } from '@/components/landing/HeroDemoSection';
import { Marquee } from '@/components/landing/Marquee';
import { StatsBar } from '@/components/landing/StatsBar';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { AboutSection } from '@/components/landing/AboutSection';
import { GallerySection } from '@/components/landing/GallerySection';
import { ExampleStripSection } from '@/components/landing/ExampleStripSection';
import { ShowcaseSection } from '@/components/landing/ShowcaseSection';
import { FAQSection } from '@/components/landing/FAQSection';

export default function LandingPage() {
  return (
    <main className="landing-root min-h-screen bg-surface text-on-surface">
      <MiniTopBar />
      <ScrollZoomHero />
      <HeroDemoSection />
      <Marquee />
      <StatsBar />
      <HowItWorksSection />
      <ServicesSection />
      <AboutSection />
      <GallerySection />
      <ExampleStripSection />
      <ShowcaseSection />
      <FAQSection />
      <CTASection />
      <LandingFooter />
    </main>
  );
}

function MiniTopBar() {
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-on-surface/5 px-6 py-5 md:px-12">
      <Image
        src="/images/landing/logo-nav.png"
        alt="mOhiOm"
        width={160}
        height={30}
        priority
        className="h-7 w-auto md:h-8"
      />
      <div className="hidden items-center gap-8 text-sm font-semibold text-on-surface-variant md:flex">
        <a href="#features" className="transition-colors hover:text-on-surface">
          Features
        </a>
        <Link href="/gallery" className="transition-colors hover:text-on-surface">
          Gallery
        </Link>
        <Link href="/pricing" className="transition-colors hover:text-on-surface">
          Pricing
        </Link>
        <a href="#" className="transition-colors hover:text-on-surface">
          Docs
        </a>
        <a href="#" className="transition-colors hover:text-on-surface">
          Blog
        </a>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/login"
          className="hidden text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface md:inline"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-on-surface px-5 py-2 text-xs font-bold uppercase tracking-widest text-surface hover:scale-105 active:scale-95 transition-transform"
        >
          Try free
        </Link>
      </div>
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
    <section className="relative z-10 flex flex-col items-center gap-6 overflow-hidden bg-primary px-6 py-20 text-center md:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {CTA_DOODLES.map(({ Icon, top, left, size, rotate, color }, i) => (
          <div key={i} className="absolute" style={{ top, left, color, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}>
            <Icon size={size} strokeWidth={1.5} />
          </div>
        ))}
      </div>

      <MessageCircle size={40} strokeWidth={1.5} className="relative text-on-primary/80" />
      <h2 className="relative max-w-xl text-4xl font-black leading-tight tracking-tight text-on-primary md:text-6xl">
        Ready to bring your stories to life?
      </h2>
      <p className="relative max-w-md text-lg text-on-primary/70">
        Join creators building comics with AI — no drawing skill required.
      </p>
      <Link
        href="/register"
        className="relative inline-flex items-center gap-2 rounded-full bg-surface px-8 py-4 text-sm font-bold uppercase tracking-widest text-on-surface shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        Start Creating Now →
      </Link>
    </section>
  );
}

const FOOTER_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Gallery', href: '/gallery' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Updates', href: '#' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Docs', href: '#' },
      { label: 'Tutorials', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'API', href: '#' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '#about' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: 'mailto:hello@mohiom.me' },
      { label: 'Press', href: '#' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Refund Policy', href: '#' },
    ],
  },
];

function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-primary px-6 pb-8 pt-16 md:px-12">
      <div className="relative mx-auto grid grid-cols-2 gap-10 md:grid-cols-6" style={{ maxWidth: 1100 }}>
        <div className="col-span-2 md:col-span-2">
          <Image src="/images/landing/logo-footer.png" alt="mOhiOm" width={200} height={114} className="h-16 w-auto" />
          <p className="mt-3 max-w-[220px] text-sm text-white/60">
            AI-Powered Comic Generation from Text to Visual Stories.
          </p>
          <div className="mt-5 flex gap-4">
            <a href="#" aria-label="Twitter" className="text-white/50 transition-colors hover:text-white">
              <Twitter size={18} />
            </a>
            <a href="#" aria-label="Instagram" className="text-white/50 transition-colors hover:text-white">
              <Instagram size={18} />
            </a>
            <a href="#" aria-label="GitHub" className="text-white/50 transition-colors hover:text-white">
              <Github size={18} />
            </a>
          </div>
        </div>

        {FOOTER_COLUMNS.map(({ heading, links }) => (
          <div key={heading}>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/50">{heading}</p>
            <ul className="flex flex-col gap-3">
              {links.map(({ label, href }) => (
                <li key={label}>
                  {href.startsWith('/') ? (
                    <Link href={href} className="text-sm text-white/70 transition-colors hover:text-white">
                      {label}
                    </Link>
                  ) : (
                    <a href={href} className="text-sm text-white/70 transition-colors hover:text-white">
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        className="relative mx-auto mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6"
        style={{ maxWidth: 1100 }}
      >
        <span className="text-xs text-white/40">mohiom.me — 2026</span>
        <span className="text-xs text-white/40">Built with Gemini + IP-Adapter</span>
      </div>

      <div aria-hidden="true" className="absolute bottom-4 right-6 hidden h-16 w-16 md:block">
        <Image src="/images/landing/mascot-bot.png" alt="" fill sizes="64px" className="object-contain" />
      </div>
    </footer>
  );
}
