'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkles, MessageCircle, PenTool, BookOpen, Star } from 'lucide-react';
import { AvatarStack } from './AvatarStack';

const O_SIZE = 'clamp(64px, 14vw, 105px)';
const BASE_BORDER = 16;

const DOODLES = [
  { Icon: Sparkles, top: '16%', left: '20%', size: 28, rotate: -12, color: 'rgba(0, 88, 190, 0.3)' },
  { Icon: MessageCircle, top: '22%', left: '78%', size: 34, rotate: 8, color: 'rgba(20, 27, 43, 0.15)' },
  { Icon: PenTool, top: '74%', left: '16%', size: 26, rotate: 18, color: 'rgba(20, 27, 43, 0.15)' },
  { Icon: Star, top: '70%', left: '82%', size: 22, rotate: -10, color: 'rgba(0, 88, 190, 0.3)' },
  { Icon: BookOpen, top: '14%', left: '50%', size: 24, rotate: -6, color: 'rgba(20, 27, 43, 0.1)' },
] as const;

export function ScrollZoomHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] });

  const oScale = useTransform(scrollYProgress, [0, 1], [1, 22]);
  const oBorderWidth = useTransform(oScale, (s) => Math.max(0, BASE_BORDER / s));
  const fadeOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);
  const introOpacity = useTransform(scrollYProgress, [0.85, 1], [0, 1]);
  const introY = useTransform(scrollYProgress, [0.85, 1], [30, 0]);

  return (
    <div ref={containerRef} className="relative bg-surface" style={{ height: '260vh' }}>
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <div className="relative flex h-full w-full items-center justify-center">
          {DOODLES.map(({ Icon, top, left, size, rotate, color }, i) => (
            <motion.div
              key={i}
              aria-hidden="true"
              className="absolute"
              style={{
                top,
                left,
                x: '-50%',
                y: '-50%',
                rotate,
                color,
                opacity: fadeOpacity,
              }}
            >
              <Icon size={size} strokeWidth={1.5} />
            </motion.div>
          ))}

          <motion.span
            className="absolute font-black text-on-surface"
            style={{
              right: `calc(50% + (${O_SIZE} / 2) + 20px)`,
              fontSize: 'clamp(2.5rem, 9vw, 7.2rem)',
              letterSpacing: '-0.03em',
              opacity: fadeOpacity,
              whiteSpace: 'nowrap',
            }}
          >
            mOhi
          </motion.span>

          <motion.div
            aria-hidden="true"
            className="absolute rounded-full border-primary bg-primary"
            style={{
              left: '50%',
              top: '50%',
              x: '-50%',
              y: '-50%',
              width: O_SIZE,
              height: O_SIZE,
              borderStyle: 'solid',
              borderWidth: oBorderWidth,
              scale: oScale,
              zIndex: 5,
            }}
          />

          <motion.span
            className="absolute font-black text-on-surface"
            style={{
              left: `calc(50% + (${O_SIZE} / 2) + 20px)`,
              fontSize: 'clamp(2.5rem, 9vw, 7.2rem)',
              letterSpacing: '-0.03em',
              opacity: fadeOpacity,
              whiteSpace: 'nowrap',
            }}
          >
            m
          </motion.span>

          <motion.div
            className="absolute z-[6] max-w-2xl px-6 text-center"
            style={{ opacity: introOpacity, y: introY }}
          >
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white">
              <Sparkles size={14} strokeWidth={2} />
              AI Comic Generator
            </span>
            <h1 className="text-4xl font-black leading-snug text-white md:text-6xl">
              Turn Any Story Into a
              <br />
              <span className="font-[family-name:var(--font-bangers)] text-5xl tracking-wide md:text-7xl">
                Comic
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg text-white/70">
              Write, design, and publish comics with generative AI — no drawing skill required.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="rounded-full bg-surface px-7 py-3 text-sm font-bold uppercase tracking-widest text-on-surface shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                Create Your First Comic →
              </Link>
              <Link
                href="/demo"
                className="rounded-full border border-white/40 px-7 py-3 text-sm font-bold uppercase tracking-widest text-white transition-transform hover:scale-105 active:scale-95"
              >
                Watch Demo
              </Link>
            </div>
            <div className="mt-8 flex items-center justify-center gap-3">
              <AvatarStack />
              <p className="text-sm text-white/60">Built for writers, artists &amp; educators</p>
            </div>
          </motion.div>
        </div>

        <motion.span
          className="absolute font-bold italic text-primary"
          style={{
            bottom: 'clamp(24px, 6vw, 40px)',
            right: 'clamp(20px, 6vw, 50px)',
            fontSize: 'clamp(1.25rem, 3.5vw, 1.8rem)',
            zIndex: 10,
            opacity: fadeOpacity,
          }}
        >
          AI Comic Studio
        </motion.span>
      </div>
    </div>
  );
}
