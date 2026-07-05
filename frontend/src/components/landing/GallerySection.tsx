'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';

type Genre = 'Fantasy' | 'Sci-fi' | 'Manga' | 'Noir' | 'Adventure' | 'Comedy' | 'Western' | 'Pixel Art';

interface GalleryMockItem {
  id: string;
  title: string;
  genre: Genre;
  image: string;
}

const CATEGORIES: Array<'All' | Genre> = [
  'All',
  'Fantasy',
  'Sci-fi',
  'Manga',
  'Noir',
  'Adventure',
  'Comedy',
  'Western',
  'Pixel Art',
];

const GALLERY_ITEMS: GalleryMockItem[] = [
  { id: 'dragon-rider', title: 'The Last Dragon Rider', genre: 'Fantasy', image: '/images/landing/gallery-dragon-rider.png' },
  { id: 'space-odyssey', title: 'Space Odyssey', genre: 'Sci-fi', image: '/images/landing/gallery-space-odyssey.png' },
  { id: 'sakura-path', title: "Sakura's Path", genre: 'Manga', image: '/images/landing/gallery-sakura-path.png' },
  { id: 'dark-investigation', title: 'Dark Investigation', genre: 'Noir', image: '/images/landing/gallery-dark-investigation.png' },
  { id: 'lost-trail', title: 'The Lost Trail', genre: 'Adventure', image: '/images/landing/gallery-lost-trail.png' },
  { id: 'sitcom-strip', title: 'Sitcom Strip', genre: 'Comedy', image: '/images/landing/gallery-sitcom-strip.png' },
  { id: 'wild-frontier', title: 'Wild Frontier', genre: 'Western', image: '/images/landing/gallery-wild-frontier.png' },
  { id: 'pixel-quest', title: 'Pixel Quest', genre: 'Pixel Art', image: '/images/landing/gallery-pixel-quest.png' },
  { id: 'crown-heist', title: 'The Crown Heist', genre: 'Fantasy', image: '/images/landing/gallery-crown-heist.png' },
];

export function GallerySection() {
  const [active, setActive] = useState<'All' | Genre>('All');
  const items = GALLERY_ITEMS.filter((item) => active === 'All' || item.genre === active);

  return (
    <section id="explore" className="relative z-10 bg-surface px-6 py-20 md:px-12">
      <div className="mx-auto" style={{ maxWidth: 1100 }}>
        <h2 className="mb-8 flex items-center justify-center gap-2 text-center text-3xl font-black tracking-tight text-on-surface md:text-5xl">
          Explore Stunning Comics
          <Sparkles size={28} strokeWidth={1.75} className="text-primary" />
        </h2>

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActive(category)}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                active === category
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map(({ id, title, genre, image }) => (
            <div
              key={id}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-outline-variant/20"
            >
              <Image
                src={image}
                alt={title}
                fill
                sizes="(min-width: 768px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <span className="mb-1 inline-block rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  {genre}
                </span>
                <p className="truncate text-sm font-bold text-white">{title}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary hover:underline"
          >
            Browse full gallery →
          </Link>
        </div>
      </div>
    </section>
  );
}
