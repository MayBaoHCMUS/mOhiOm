'use client';

import { useEffect, useRef, useState } from 'react';

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

/**
 * Detects a genuine user-initiated scroll attempt (wheel/touch/keyboard) while
 * `active` is true — e.g. while the page is auto-scrolling to follow streamed
 * text — so the caller can flag the conflict instead of silently fighting the
 * user's input. Only fires on real input events, never on programmatic
 * `scrollIntoView` calls, since those don't dispatch wheel/touch/key events.
 *
 * Detection re-arms every time `active` transitions from off to on (a fresh
 * streaming run), and can be silenced early via the returned `dismiss()`.
 */
export function useScrollIntentDetector(active: boolean): [boolean, () => void] {
  const [detected, setDetected] = useState(false);
  const wasActiveRef = useRef(false);
  const suppressedRef = useRef(false);

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      setDetected(false);
      suppressedRef.current = false;
    }
    wasActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const flag = () => {
      if (!suppressedRef.current) setDetected(true);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key)) flag();
    };
    window.addEventListener('wheel', flag, { passive: true });
    window.addEventListener('touchmove', flag, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', flag);
      window.removeEventListener('touchmove', flag);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);

  const dismiss = () => {
    suppressedRef.current = true;
    setDetected(false);
  };

  return [detected, dismiss];
}
