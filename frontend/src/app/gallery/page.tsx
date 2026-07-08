'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import GalleryContent from '@/components/gallery/GalleryContent';
import { useAuth } from '@/context/AuthContext';

export default function GalleryPage() {
  const { user, isInitialized } = useAuth();
  const isAuthed = isInitialized && !!user;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {isAuthed ? (
        <>
          <StudioSidebar />
          <StudioTopBar />
        </>
      ) : (
        <nav className="flex items-center justify-between gap-4 border-b border-on-surface/5 px-6 py-5 md:px-12">
          <Link href="/">
            <Image src="/images/landing/logo-nav.png" alt="mOhiOm" width={160} height={30} className="h-7 w-auto md:h-8" priority />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface">
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
      )}

      <main className={isAuthed ? 'ml-[var(--studio-sidebar-width)] pt-24 px-8 pb-12 min-h-screen' : 'px-8 py-8 pb-12 min-h-screen'}>
        <Suspense fallback={null}>
          <GalleryContent />
        </Suspense>
      </main>
    </div>
  );
}
