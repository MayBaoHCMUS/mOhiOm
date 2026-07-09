'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '@/services/api';

export type AuthUser = {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  providers?: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  refresh: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.me();
      const nextUser = response.data?.user ?? null;
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      setError('Not authenticated');
      return null;
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isInitialized,
      error,
      refresh,
      logout,
    }),
    [user, isLoading, isInitialized, error, refresh, logout]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}


