'use client';

import { useEffect, useRef } from 'react';
import { isElectron } from '@/lib/utils/is-electron';
import { ensureLocalRunnerReady } from '@/lib/api/local-runner';

export function useLocalRunnerPairing(enabled: boolean) {
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || !isElectron() || typeof window === 'undefined' || !window.dobbyLocal) {
      return;
    }
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    (async () => {
      try {
        await ensureLocalRunnerReady();
        if (cancelled) return;
      } catch (error) {
        console.warn('[local-runner] pairing failed', error);
        started.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
