'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Star, BookOpen, MessageCircle } from 'lucide-react';
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
import { GalleryModal } from '@/components/landing/GalleryModal';

export default function LandingPage() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const openGallery = () => setGalleryOpen(true);

  return (
    <main className="landing-root min-h-screen bg-surface text-on-surface">
      <MiniTopBar onOpenGallery={openGallery} />
      <ScrollZoomHero />
      <HeroDemoSection />
      <Marquee />
      <StatsBar />
      <HowItWorksSection />
      <ServicesSection />
      <AboutSection />
      <GallerySection onOpenGallery={openGallery} />
      <ExampleStripSection />
      <ShowcaseSection />
      <FAQSection />
      <CTASection />
      <LandingFooter onOpenGallery={openGallery} />
      {galleryOpen && <GalleryModal onClose={() => setGalleryOpen(false)} />}
    </main>
  );
}

function MiniTopBar({ onOpenGallery }: { onOpenGallery: () => void }) {
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
        <button type="button" onClick={onOpenGallery} className="transition-colors hover:text-on-surface">
          Gallery
        </button>
        <Link href="/docs" className="transition-colors hover:text-on-surface">
          Docs
        </Link>
        <Link href="/changelog" className="transition-colors hover:text-on-surface">
          Blog
        </Link>
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
  { Icon: MessageCircle, top: '12%', left: '50%', size: 36, rotate: 0, color: 'rgba(255, 255, 255, 0.15)' },
  { Icon: Sparkles, top: '18%', left: '88%', size: 44, rotate: -10, color: 'rgba(255, 255, 255, 0.15)' },
  { Icon: Star, top: '78%', left: '94%', size: 20, rotate: 12, color: 'rgba(255, 255, 255, 0.15)' },
  { Icon: BookOpen, top: '85%', left: '76%', size: 28, rotate: -6, color: 'rgba(255, 255, 255, 0.15)' },
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

      <h2 className="relative max-w-xl text-4xl font-black leading-tight tracking-tight text-on-primary md:text-6xl">
        Ready to bring your stories to life?
      </h2>
      <p className="relative max-w-md text-lg text-on-primary/70">
        Join creators building comics with AI — no drawing skill required.
      </p>
      <Link
        href="/register"
        className="relative inline-flex h-[52px] items-center justify-center gap-2 rounded-[10px] bg-surface-container-lowest px-8 text-[15px] font-bold text-on-surface shadow-md transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-lg"
      >
        Start Creating Now →
      </Link>
    </section>
  );
}

const FOOTER_COLUMNS: { heading: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Gallery', href: '/gallery' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/changelog' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '#about' },
      { label: 'Contact', href: 'mailto:hello@mohiom.me' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

function LandingFooter({ onOpenGallery }: { onOpenGallery: () => void }) {
  return (
    <footer className="relative overflow-hidden bg-on-surface px-6 pb-8 pt-16 md:px-12">
      <div className="relative mx-auto grid grid-cols-2 gap-10 md:grid-cols-6" style={{ maxWidth: 1100 }}>
        <div className="col-span-2 md:col-span-2">
          <Image src="/images/landing/logo-footer-dark.png" alt="mOhiOm" width={200} height={114} className="h-16 w-auto" />
          <p className="mt-3 max-w-[220px] text-sm text-white/60">
            AI-Powered Comic Generation from Text to Visual Stories.
          </p>
        </div>

        {FOOTER_COLUMNS.map(({ heading, links }) => (
          <div key={heading}>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/50">{heading}</p>
            <ul className="flex flex-col gap-3">
              {links.map(({ label, href, external }) => (
                <li key={label}>
                  {label === 'Gallery' ? (
                    <button
                      type="button"
                      onClick={onOpenGallery}
                      className="text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {label}
                    </button>
                  ) : external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {label}
                    </a>
                  ) : href.startsWith('/') ? (
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
        <span className="text-xs text-white/40">© 2026 mOhiOm. All rights reserved.</span>
        <span className="text-xs text-white/40">
          Built by Thuong Nguyen ·{' '}
          <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white/70">
            Gemini
          </a>
          {' + '}
          <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white/70">
            Next.js
          </a>
        </span>
      </div>

      <div className="absolute bottom-4 right-6 hidden h-14 w-14 md:block" title="Made with ❤️ by mOhiOm">
        <Image src="/images/landing/mascot-bot.png" alt="mOhiOm mascot" fill sizes="56px" className="object-contain" />
      </div>
    </footer>
  );
}
