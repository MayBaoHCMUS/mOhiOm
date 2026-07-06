'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useComicGenerationOptional } from '@/context/ComicGenerationContext';
import NotificationBell from '@/components/NotificationBell';
import StepLoader from '@/components/StepLoader';

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
  const isAnalyzing       = !!comicGeneration?.step1.isLoading;
  const isDesigning       = !!comicGeneration?.step2.isLoading;
  const isCharGenerating  = !!comicGeneration?.step2ImageReview.data?.isGenerating;
  const isScripting       = !!comicGeneration?.step3.isLoading;
  const isPanelGenerating = !!comicGeneration?.step4.data?.isGenerating;
  const isTaskRunning = isAnalyzing || isDesigning || isCharGenerating || isScripting || isPanelGenerating;

  let loaderLabel = 'Generating';
  let loaderWords: [string, string, string, string] = ['characters', 'faces', 'outfits', 'poses'];
  if (isAnalyzing) {
    loaderLabel = 'Analyzing';
    loaderWords = ['story', 'themes', 'characters', 'tone'];
  } else if (isDesigning) {
    loaderLabel = 'Designing';
    loaderWords = ['characters', 'traits', 'looks', 'style'];
  } else if (isCharGenerating) {
    loaderLabel = 'Generating';
    loaderWords = ['characters', 'faces', 'outfits', 'poses'];
  } else if (isScripting) {
    loaderLabel = 'Writing';
    loaderWords = ['script', 'panels', 'dialogue', 'pacing'];
  } else if (isPanelGenerating) {
    loaderLabel = 'Generating';
    loaderWords = ['panels', 'scenes', 'linework', 'colors'];
  }

  return (
    <header
      className={`fixed top-0 right-0 ${
        leftOffset ? 'left-[var(--studio-sidebar-width)]' : 'left-0'
      } z-50 glass-nav flex items-center justify-between px-8 h-16 text-on-surface shadow-[0_4px_20px_rgba(0,0,0,0.03)]`}
    >
      <div className="flex items-center">
        {isTaskRunning && <StepLoader label={loaderLabel} words={loaderWords} />}
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