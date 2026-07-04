'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, BellOff } from 'lucide-react';
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
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [justMarkedAllRead, setJustMarkedAllRead] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
          <span className="t-badge-dot min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-surface-container-lowest">
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
            className="absolute right-0 top-full mt-2 w-[360px] max-h-96 overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-xl border border-outline-variant z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-on-surface">Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-primary/10 text-primary text-[11px] font-bold rounded-full px-2 py-0.5">
                    {unreadCount} new
                  </span>
                )}
              </div>
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
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <BellOff size={28} className="mx-auto mb-3 text-outline-variant" />
                <p className="text-sm font-semibold text-on-surface">You&apos;re all caught up!</p>
                <p className="text-xs text-on-surface-variant mt-1">Notifications will appear here</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const config = VARIANT_CONFIG[n.variant];
                  const Icon = config.icon;
                  return (
                    <li
                      key={n.id}
                      className={`group relative px-4 py-3 border-b border-outline-variant last:border-b-0 cursor-pointer transition-colors ${
                        n.read ? 'bg-transparent hover:bg-surface-container-low' : 'bg-primary/5 hover:bg-primary/10'
                      }`}
                      onClick={() => markRead(n.id)}
                    >
                      {!n.read && (
                        <span className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r ${config.barColor}`} />
                      )}
                      <div className="flex items-start gap-2.5">
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
                        {!n.read && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markRead(n.id);
                            }}
                            aria-label="Mark as read"
                            title="Mark as read"
                            className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity ${config.barColor}`}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
