'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type BackendHealth = 'checking' | 'up' | 'down' | 'unconfigured';

const HEALTH_TIMEOUT_MS = 6000;

/**
 * Pings `${url}/health` from the browser and reports whether an image-generation
 * backend is reachable. Both GPU servers (SD1.5/SDXL, OmniGen2) expose GET
 * /health and allow the app's origin in CORS, so a direct fetch works — no
 * proxy needed. Any error / non-2xx / timeout is treated as "down".
 *
 * Checks on mount and whenever `url` changes; call `recheck()` to re-run
 * manually (e.g. when opening the model picker). Deliberately does NOT poll on
 * an interval, to avoid spamming /health.
 */
export function useBackendHealth(url: string | null | undefined): { status: BackendHealth; recheck: () => void } {
  const [status, setStatus] = useState<BackendHealth>(url ? 'checking' : 'unconfigured');
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const check = useCallback(() => {
    // Cancel any in-flight probe first.
    abortRef.current?.abort();

    if (!url || !url.trim()) {
      setStatus('unconfigured');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    setStatus('checking');

    fetch(`${url.replace(/\/$/, '')}/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((res) => {
        if (!mountedRef.current || controller.signal.aborted) return;
        setStatus(res.ok ? 'up' : 'down');
      })
      .catch(() => {
        if (!mountedRef.current || controller.signal.aborted) return;
        setStatus('down');
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
  }, [url]);

  useEffect(() => {
    check();
    return () => abortRef.current?.abort();
  }, [check]);

  return { status, recheck: check };
}
