'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (input: AddNotificationInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const MAX_STORED_NOTIFICATIONS = 30;
const STORAGE_PREFIX = 'mohiom-notifications';

function getStorageKey(): string {
  if (typeof window === 'undefined') return `${STORAGE_PREFIX}:anonymous`;
  const userId = window.localStorage.getItem('mohiom-user-id');
  return userId ? `${STORAGE_PREFIX}:${userId}` : `${STORAGE_PREFIX}:anonymous`;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw) as Notification[];
        if (Array.isArray(parsed)) setNotifications(parsed);
      }
    } catch (err) {
      console.warn('[notifications] Could not load from localStorage:', err);
    } finally {
      hasLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(getStorageKey(), JSON.stringify(notifications));
    } catch (err) {
      console.warn('[notifications] Could not persist to localStorage:', err);
    }
  }, [notifications]);

  const addNotification = useCallback((input: AddNotificationInput) => {
    const next: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: input.title,
      message: input.message,
      variant: input.variant ?? 'success',
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
    () => ({ notifications, unreadCount, addNotification, markRead, markAllRead, clearAll }),
    [notifications, unreadCount, addNotification, markRead, markAllRead, clearAll]
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
