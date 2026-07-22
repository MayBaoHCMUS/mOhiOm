'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, BellOff, ChevronRight, MoreVertical, Settings, Trash2 } from 'lucide-react';
import { useNotifications, type Notification } from '@/context/NotificationContext';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const VARIANT_CONFIG: Record<Notification['variant'], { icon: typeof CheckCircle2; iconBg: string; iconColor: string; barColor: string }> = {
  success: { icon: CheckCircle2, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', barColor: 'bg-emerald-500' },
  partial: { icon: AlertTriangle, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', barColor: 'bg-amber-500' },
  error: { icon: XCircle, iconBg: 'bg-red-100', iconColor: 'text-red-600', barColor: 'bg-red-500' },
};

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const [justMarkedAllRead, setJustMarkedAllRead] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(unreadCount);

  // Replay the badge pop only when the unread count actually increases.
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) setPulseKey((k) => k + 1);
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Close the whole panel on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  // Reset the overflow menu / confirm banner whenever the panel closes.
  useEffect(() => {
    if (!open) { setMenuOpen(false); setShowConfirm(false); }
  }, [open]);

  // Close the overflow menu when clicking elsewhere inside the panel.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const handleMarkAllRead = () => {
    markAllRead();
    setJustMarkedAllRead(true);
    window.setTimeout(() => setJustMarkedAllRead(false), 2000);
  };

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);
  const showMarkAllRead = notifications.length > 0 && (unreadCount > 0 || justMarkedAllRead);

  return (
    <div className="relative" ref={containerRef}>
      <button
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
          open ? 'bg-surface-container-low' : 'hover:bg-surface-container-low'
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined">notifications</span>
        <span className="t-badge" data-open={unreadCount > 0 ? 'true' : 'false'}>
          <span
            key={pulseKey}
            className="t-badge-dot t-badge-pop min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-surface-container-lowest"
          >
            {badgeLabel}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[360px] rounded-2xl bg-surface-container-lowest shadow-xl border border-outline-variant z-50 flex flex-col overflow-hidden"
            style={{ maxHeight: 400 }}
          >
            {/* Header — fixed */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant flex-shrink-0">
              <span className="text-sm font-bold text-on-surface">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-primary/10 text-primary text-[11px] font-bold rounded-full px-2 py-0.5">
                  {unreadCount} new
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {showMarkAllRead && (
                  <button
                    className={`text-xs font-medium transition-colors ${
                      justMarkedAllRead ? 'text-outline cursor-default' : 'text-primary hover:opacity-80'
                    }`}
                    onClick={handleMarkAllRead}
                    disabled={justMarkedAllRead}
                  >
                    {justMarkedAllRead ? 'All read ✓' : 'Mark all read'}
                  </button>
                )}
                {/* Overflow menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    aria-label="More options"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-surface-container-lowest shadow-xl border border-outline-variant py-1 z-10">
                      <Link
                        href="/settings#notifications"
                        onClick={() => { setMenuOpen(false); setOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                      >
                        <Settings size={15} className="text-on-surface-variant" />
                        Notification settings
                      </Link>
                      {notifications.length > 0 && (
                        <>
                          <div className="my-1 border-t border-outline-variant" />
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); setShowConfirm(true); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={15} />
                            Clear all notifications
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Clear-all confirmation banner */}
            {showConfirm && (
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-100">
                <AlertTriangle size={15} className="text-red-600 flex-shrink-0" />
                <span className="text-xs text-red-700 flex-1">
                  Remove all {notifications.length} notification{notifications.length === 1 ? '' : 's'}?
                </span>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="text-xs font-medium text-on-surface-variant hover:text-on-surface px-2 py-1 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { clearAll(); setShowConfirm(false); setOpen(false); }}
                  className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Yes, clear all
                </button>
              </div>
            )}

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto relative">
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <BellOff size={28} className="mx-auto mb-3 text-outline-variant" />
                  <p className="text-sm font-semibold text-on-surface">You&apos;re all caught up!</p>
                  <p className="text-xs text-on-surface-variant mt-1">Notifications will appear here</p>
                </div>
              ) : (
                <>
                  <ul>
                    {notifications.map((n) => {
                      const config = VARIANT_CONFIG[n.variant];
                      const Icon = config.icon;
                      return (
                        <li
                          key={n.id}
                          className={`group relative flex items-start gap-2.5 px-4 py-3 border-b border-outline-variant last:border-b-0 cursor-pointer transition-colors ${
                            n.read ? 'bg-transparent hover:bg-surface-container-low' : 'bg-[#F8FAFF] hover:bg-[#EEF4FF]'
                          }`}
                          onClick={() => markRead(n.id)}
                        >
                          {!n.read && (
                            <span className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r ${config.barColor}`} />
                          )}
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
                            <Icon size={16} className={config.iconColor} strokeWidth={2.25} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm truncate transition-colors ${
                                n.read ? 'font-normal text-on-surface-variant' : 'font-semibold text-on-surface'
                              }`}
                            >
                              {n.title}
                            </p>
                            <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">{n.message}</p>
                            <p className="text-[11px] text-outline mt-1">{timeAgo(n.createdAt)}</p>
                          </div>
                          {/* Chevron affordance (hover) */}
                          <ChevronRight
                            size={16}
                            className="text-outline-variant mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                          {/* Per-item mark-read dot */}
                          {!n.read && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                              aria-label="Mark as read"
                              title="Mark as read"
                              className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full flex-shrink-0 hover:scale-150 transition-transform ${config.barColor}`}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {/* Scroll fade shadow */}
                  <div className="sticky bottom-0 h-6 bg-gradient-to-t from-surface-container-lowest to-transparent pointer-events-none" />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
