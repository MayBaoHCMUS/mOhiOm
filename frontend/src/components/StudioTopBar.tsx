'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

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
  return (
    <header
      className={`fixed top-0 right-0 ${
        leftOffset ? 'left-[var(--studio-sidebar-width)]' : 'left-0'
      } z-50 glass-nav flex items-center justify-between px-8 h-16 text-on-surface shadow-[0_4px_20px_rgba(0,0,0,0.03)]`}
    >
      <div className="flex-1 max-w-2xl">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-4 text-outline">search</span>
          <input
            className="w-full pl-12 pr-4 py-2 bg-surface-container-low border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
            placeholder="Search comics, characters, or assets..."
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Link className="text-primary font-semibold text-sm" href="/pricing">
          Pricing
        </Link>
        <div className="h-6 w-px bg-outline-variant/40"></div>
        <button className="hover:opacity-80 transition-opacity" aria-label="Notifications">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <Link className="hover:opacity-80 transition-opacity" href="/settings" aria-label="Open profile">
          <UserAvatar />
        </Link>
      </div>
    </header>
  );
}