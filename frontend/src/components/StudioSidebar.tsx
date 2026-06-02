'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { href: '/studio/dashboard', label: 'Home', icon: 'home' },
  { href: '/studio/story-setup', label: 'Story Setup', icon: 'auto_stories' },
  { href: '/studio/character-manager', label: 'Character Manager', icon: 'face_6' },
  { href: '/studio/editor', label: 'Comic Editor', icon: 'edit_note' },
  { href: '/studio/export', label: 'Export & Publish', icon: 'ios_share' },
  { href: '/studio/layout-engine', label: 'Layout Engine', icon: 'grid_view' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
  { href: '/pricing', label: 'Pricing', icon: 'payments' },
  { href: '/gallery', label: 'Gallery', icon: 'collections' },
];

export default function StudioSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Creator';
  const initials = fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  useEffect(() => {
    const stored = window.localStorage.getItem('studio-sidebar-collapsed');
    setIsCollapsed(stored === 'true');
  }, []);

  useEffect(() => {
    const width = isCollapsed ? '5rem' : '16rem';
    document.documentElement.style.setProperty('--studio-sidebar-width', width);
    window.localStorage.setItem('studio-sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const toggleLabel = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';

  const isActive = (href: string) => {
    if (href === '/studio/dashboard') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={`h-screen w-[var(--studio-sidebar-width)] fixed left-0 top-0 bg-surface-container-low border-r-0 z-[60] flex flex-col transition-[width] duration-300 ${
        isCollapsed ? 'px-2 py-4' : 'p-4'
      }`}
    >
      <div className={`mb-8 ${isCollapsed ? 'px-1 pt-2' : 'px-2 pt-4'}`}>
        <div className="flex items-start justify-between">
          <div className={isCollapsed ? 'flex flex-col items-center gap-1' : ''}>
            <h1 className={`font-bold tracking-tight ${isCollapsed ? 'text-lg' : 'text-xl'}`}>
              {isCollapsed ? 'CG' : 'ComicGen AI'}
            </h1>
            {!isCollapsed && (
              <p className="text-xs text-on-surface-variant font-medium tracking-wide mt-1">Creative Hub</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all"
          >
            <span className="material-symbols-outlined text-lg">
              {isCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              className={`flex items-center gap-3 rounded-lg transition-all duration-200 ${
                isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'
              } ${
                active
                  ? 'text-primary bg-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className={isCollapsed ? 'sr-only' : 'text-sm font-semibold'}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-6 space-y-4">
        <Link
          className={`w-full bg-primary-container text-white rounded-xl font-semibold text-sm shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 py-3 ${
            isCollapsed ? '' : 'px-4'
          }`}
          href="/pricing"
          title={isCollapsed ? 'Upgrade to Pro' : undefined}
          aria-label={isCollapsed ? 'Upgrade to Pro' : undefined}
        >
          <span className="material-symbols-outlined text-base">workspace_premium</span>
          <span className={isCollapsed ? 'sr-only' : ''}>Upgrade to Pro</span>
        </Link>
        <Link
          href="/settings"
          className={`flex items-center gap-3 border-t border-outline-variant/30 hover:bg-surface-container-high rounded-xl transition-colors ${
            isCollapsed ? 'px-0 py-4 justify-center' : 'px-2 py-4'
          }`}
          title={isCollapsed ? fullName : undefined}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center font-black text-white text-sm flex-shrink-0">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate">{fullName}</span>
              <span className="text-xs text-on-surface-variant truncate">{user?.email ?? 'Free Tier'}</span>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}