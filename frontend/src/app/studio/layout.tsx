'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuth();

  useEffect(() => {
    if (isInitialized && !user) {
      // A plain location redirect (rather than next/navigation's router) is used
      // deliberately here: router.replace() raced with an in-flight client-side
      // <Link> transition and could silently no-op, leaving an unauthenticated
      // visitor on a protected /studio/* page. A full navigation can't be dropped.
      window.location.replace('/login');
    }
  }, [isInitialized, user]);

  if (!isInitialized || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="animate-spin inline-block w-6 h-6 border-2 border-outline-variant border-t-primary rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
