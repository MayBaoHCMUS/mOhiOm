'use client';

import { useCallback, useEffect, useState } from 'react';

const PREF_KEY = 'mohiom-pref-autoscroll-streaming';

function readPref(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(PREF_KEY);
  return raw === null ? true : raw === 'true';
}

/** Whether Step 1/2 should auto-scroll the page to follow AI text as it streams
 * in, vs. leaving scroll position under manual control. Defaults to on. */
export function useAutoScrollStreamingPref() {
  const [autoScroll, setAutoScrollState] = useState<boolean>(readPref);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === PREF_KEY) setAutoScrollState(readPref());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setAutoScroll = useCallback((value: boolean) => {
    window.localStorage.setItem(PREF_KEY, String(value));
    setAutoScrollState(value);
  }, []);

  return { autoScroll, setAutoScroll };
}
