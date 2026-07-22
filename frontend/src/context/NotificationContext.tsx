'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export type NotificationVariant = 'success' | 'partial' | 'error';

export interface Notification {
  id: string;
  title: string;
  message: string;
  variant: NotificationVariant;
  createdAt: string;
  read: boolean;
  projectId?: string | null;
}

type AddNotificationInput = {
  title: string;
  message: string;
  variant?: NotificationVariant;
  projectId?: string | null;
};

// Which notification severities the user wants to receive. Defaults to all on.
export type NotificationPrefs = Record<NotificationVariant, boolean>;
const DEFAULT_PREFS: NotificationPrefs = { success: true, partial: true, error: true };

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (input: AddNotificationInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  prefs: NotificationPrefs;
  setPref: (variant: NotificationVariant, enabled: boolean) => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const MAX_STORED_NOTIFICATIONS = 30;
const STORAGE_PREFIX = 'mohiom-notifications';
const PREFS_STORAGE_PREFIX = 'mohiom-notification-prefs';

function storageKeyFor(userId: string | undefined | null): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : `${STORAGE_PREFIX}:anonymous`;
}

function prefsKeyFor(userId: string | undefined | null): string {
  return userId ? `${PREFS_STORAGE_PREFIX}:${userId}` : `${PREFS_STORAGE_PREFIX}:anonymous`;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const hasLoadedRef = useRef(false);

  // Notification preferences (per severity), persisted per user. Read through a
  // ref inside addNotification so the callback keeps stable [] deps.
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const prefsRef = useRef(prefs);
  const hasLoadedPrefsRef = useRef(false);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    hasLoadedPrefsRef.current = false;
    try {
      const raw = window.localStorage.getItem(prefsKeyFor(userId));
      const parsed = raw ? (JSON.parse(raw) as Partial<NotificationPrefs>) : null;
      setPrefs(parsed && typeof parsed === 'object' ? { ...DEFAULT_PREFS, ...parsed } : DEFAULT_PREFS);
    } catch {
      setPrefs(DEFAULT_PREFS);
    } finally {
      hasLoadedPrefsRef.current = true;
    }
  }, [userId]);

  useEffect(() => {
    if (!hasLoadedPrefsRef.current || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(prefsKeyFor(userId), JSON.stringify(prefs));
    } catch (err) {
      console.warn('[notifications] Could not persist prefs to localStorage:', err);
    }
  }, [prefs, userId]);

  const setPref = useCallback((variant: NotificationVariant, enabled: boolean) => {
    setPrefs((prev) => ({ ...prev, [variant]: enabled }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    hasLoadedRef.current = false;
    try {
      const raw = window.localStorage.getItem(storageKeyFor(userId));
      const parsed = raw ? (JSON.parse(raw) as Notification[]) : [];
      setNotifications(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      console.warn('[notifications] Could not load from localStorage:', err);
      setNotifications([]);
    } finally {
      hasLoadedRef.current = true;
    }
  }, [userId]);

  useEffect(() => {
    if (!hasLoadedRef.current || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKeyFor(userId), JSON.stringify(notifications));
    } catch (err) {
      console.warn('[notifications] Could not persist to localStorage:', err);
    }
  }, [notifications, userId]);

  const addNotification = useCallback((input: AddNotificationInput) => {
    const variant = input.variant ?? 'success';
    // Respect the user's per-severity preference — silently drop muted ones.
    if (!prefsRef.current[variant]) return;
    const next: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: input.title,
      message: input.message,
      variant,
      createdAt: new Date().toISOString(),
      read: false,
      projectId: input.projectId ?? null,
    };
    setNotifications((prev) => [next, ...prev].slice(0, MAX_STORED_NOTIFICATIONS));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo(
    () => ({ notifications, unreadCount, addNotification, markRead, markAllRead, clearAll, prefs, setPref }),
    [notifications, unreadCount, addNotification, markRead, markAllRead, clearAll, prefs, setPref]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}
