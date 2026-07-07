'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

type NavItem = { href: string; label: string; icon: string; tour?: string };

const PRE_PRODUCTION: NavItem[] = [
  { href: '/studio/story-setup',       label: 'Story Setup',       icon: 'auto_stories', tour: 'story-setup' },
  { href: '/studio/character-manager', label: 'Character Manager', icon: 'face_6',       tour: 'character-manager' },
];

const POST_PRODUCTION: NavItem[] = [
  { href: '/studio/editor',  label: 'Comic Editor', icon: 'edit_note', tour: 'comic-editor' },
  { href: '/studio/publish', label: 'Publish',      icon: 'ios_share', tour: 'publish' },
];

const LIBRARY: NavItem[] = [
  { href: '/studio/my-stories', label: 'My Stories', icon: 'library_books' },
  { href: '/gallery',           label: 'Gallery',     icon: 'photo_library' },
  { href: '/studio/analytics',  label: 'Analytics',  icon: 'bar_chart' },
];

// Items the sliding pill glides between — Home and the Comic Pipeline card sit
// outside this set since they're visually distinct (a single anchor, and a
// permanently-colored featured card), not plain list-style feature tabs.
const PILL_NAV_ITEMS: NavItem[] = [...PRE_PRODUCTION, ...POST_PRODUCTION, ...LIBRARY];

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

  // Allows the onboarding spotlight tour to force the sidebar open so link
  // labels/rects are meaningful while it's running.
  useEffect(() => {
    const handler = () => setIsCollapsed(false);
    window.addEventListener('studio-sidebar-force-expand', handler);
    return () => window.removeEventListener('studio-sidebar-force-expand', handler);
  }, []);

  const toggleLabel = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';

  const isActive = (href: string) => {
    if (href === '/studio/dashboard') return pathname === href;
    if (href === '/studio') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // ── Sliding pill behind the active nav item ────────────────────────────────
  const pillGroupRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  const registerItemRef = (href: string) => (el: HTMLAnchorElement | null) => {
    if (el) itemRefs.current.set(href, el);
    else itemRefs.current.delete(href);
  };

  const updatePill = (skipTransition = false) => {
    const container = pillGroupRef.current;
    const pill = pillRef.current;
    if (!container || !pill) return;
    const activeHref = PILL_NAV_ITEMS.map((item) => item.href).find(isActive);
    const activeEl = activeHref ? itemRefs.current.get(activeHref) : undefined;

    if (!activeEl) {
      pill.style.opacity = '0';
      return;
    }
    const top = activeEl.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const height = activeEl.offsetHeight;

    const apply = () => {
      pill.style.opacity = '1';
      pill.style.transform = `translateY(${top}px)`;
      pill.style.height = `${height}px`;
    };

    if (skipTransition) {
      const prevTransition = pill.style.transition;
      pill.style.transition = 'none';
      apply();
      void pill.offsetHeight; // force reflow so the transition suspension takes effect
      pill.style.transition = prevTransition;
    } else {
      apply();
    }
  };

  // First paint — snap into place with no animation.
  useLayoutEffect(() => {
    updatePill(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route changed — glide the pill to the new active item.
  useEffect(() => {
    updatePill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Sidebar width/collapse or viewport resize can shift item rects — resync
  // without animating the pill itself.
  useEffect(() => {
    const handleResize = () => updatePill(true);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => updatePill(true), 320);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed]);

  // `ownBackground` is for items outside the sliding-pill group (e.g. Home) —
  // they still need their own bg-white highlight since no shared pill sits
  // behind them. Pill-group items only change text color; the pill (a single
  // shared element) supplies the background/shadow, animated between them.
  const navItemClass = (active: boolean, ownBackground = false) =>
    `relative z-10 flex items-center gap-3 rounded-lg transition-colors duration-200 ${
      isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'
    } ${
      active
        ? `text-primary ${ownBackground ? 'bg-white shadow-sm' : ''}`
        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
    }`;

  const sectionLabel = (text: string) =>
    !isCollapsed ? (
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/50 px-4 mb-1.5">
        {text}
      </p>
    ) : null;

  const navItems = (items: NavItem[]) =>
    items.map((item) => {
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          ref={registerItemRef(item.href)}
          className={navItemClass(active)}
          aria-current={active ? 'page' : undefined}
          title={isCollapsed ? item.label : undefined}
          data-tour={item.tour}
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span className={isCollapsed ? 'sr-only' : 'text-sm font-semibold'}>{item.label}</span>
        </Link>
      );
    });

  return (
    <aside
      className={`h-screen w-[var(--studio-sidebar-width)] fixed left-0 top-0 bg-surface-container-low border-r-0 z-[60] flex flex-col transition-[width] duration-300 ${
        isCollapsed ? 'px-2 py-4' : 'p-4'
      }`}
    >
      {/* Zone A — Brand + collapse toggle */}
      <div className={`mb-6 ${isCollapsed ? 'px-1 pt-2' : 'px-2 pt-4'}`}>
        <div className="flex items-start justify-between">
          <div className={isCollapsed ? 'flex flex-col items-center gap-1' : ''}>
            {isCollapsed ? (
              <Image src="/favicon-icon.png" alt="mOhiOm" width={32} height={32} className="h-8 w-8" />
            ) : (
              <Image src="/images/landing/logo-nav.png" alt="mOhiOm" width={160} height={30} className="h-7 w-auto" />
            )}
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

      {/* Home — standalone, outside the pill group, so it keeps its own highlight */}
      <Link
        href="/studio/dashboard"
        className={navItemClass(isActive('/studio/dashboard'), true)}
        aria-current={isActive('/studio/dashboard') ? 'page' : undefined}
        title={isCollapsed ? 'Home' : undefined}
      >
        <span className="material-symbols-outlined">home</span>
        <span className={isCollapsed ? 'sr-only' : 'text-sm font-semibold'}>Home</span>
      </Link>

      {/* Zone B — Navigation */}
      <nav className="flex-1 overflow-y-auto mt-2 space-y-5 hide-scrollbar">

        {/* Comic Pipeline — blue gradient featured card */}
        <div>
          <Link
            href="/studio"
            className={`flex items-center gap-3 rounded-xl overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 ${
              isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'
            }`}
            aria-current={isActive('/studio') ? 'page' : undefined}
            title={isCollapsed ? 'Comic Pipeline' : undefined}
            data-tour="comic-pipeline"
          >
            <span className="material-symbols-outlined">movie_creation</span>
            {isCollapsed ? (
              <span className="sr-only">Comic Pipeline</span>
            ) : (
              <span className="flex flex-col">
                <span className="text-sm font-semibold">Comic Pipeline</span>
                <span className="text-[11px] text-white/70">6-step AI comic generation</span>
              </span>
            )}
          </Link>
        </div>

        {/* Feature nav — sliding pill glides behind whichever item is active */}
        <div ref={pillGroupRef} className="relative space-y-5">
          <div ref={pillRef} className="t-sidebar-pill absolute left-0 right-0 top-0 h-0 rounded-lg bg-white shadow-sm opacity-0 pointer-events-none z-0" />

          {/* PRE-PRODUCTION */}
          <div>
            {sectionLabel('Pre-Production')}
            <div className="space-y-0.5">{navItems(PRE_PRODUCTION)}</div>
          </div>

          {/* POST-PRODUCTION */}
          <div>
            {sectionLabel('Post-Production')}
            <div className="space-y-0.5">{navItems(POST_PRODUCTION)}</div>
          </div>

          {/* LIBRARY */}
          <div>
            {sectionLabel('Library')}
            <div className="space-y-0.5">{navItems(LIBRARY)}</div>
          </div>
        </div>

      </nav>

      {/* Zone C — Bottom: user row (links to settings) */}
      <div className="mt-auto pt-4">
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
