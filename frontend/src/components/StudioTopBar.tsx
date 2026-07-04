'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useComicGenerationOptional } from '@/context/ComicGenerationContext';
import NotificationBell from '@/components/NotificationBell';
import SpeederLoader from '@/components/SpeederLoader';

type StudioTopBarProps = {
  leftOffset?: boolean;
};

function UserAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { user } = useAuth();
  const initials = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .map((w) => w![0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
  const dim = size === 'sm' ? 'w-9 h-9 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center font-black text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function StudioTopBar({ leftOffset = true }: StudioTopBarProps) {
  const comicGeneration = useComicGenerationOptional();
  const isTaskRunning = !!(
    comicGeneration?.step2ImageReview.data?.isGenerating || comicGeneration?.step4.data?.isGenerating
  );

  return (
    <header
      className={`fixed top-0 right-0 ${
        leftOffset ? 'left-[var(--studio-sidebar-width)]' : 'left-0'
      } z-50 glass-nav flex items-center justify-between px-8 h-16 text-on-surface shadow-[0_4px_20px_rgba(0,0,0,0.03)]`}
    >
      <div className="flex items-center">
        {isTaskRunning && <SpeederLoader />}
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <Link className="hover:opacity-80 transition-opacity" href="/settings" aria-label="Open profile">
          <UserAvatar />
        </Link>
      </div>
    </header>
  );
}