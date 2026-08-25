'use client';

import { useEffect, useRef } from 'react';
import { isElectron } from '@/lib/utils/is-electron';
import { ensureLocalRunnerReady } from '@/lib/api/local-runner';

export function useLocalRunnerPairing(enabled: boolean) {
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled || !isElectron() || typeof window === 'undefined' || !window.dobbyLocal) {
      return;
    }

    let cancelled = false;

    const connect = async () => {
      if (cancelled || inFlight.current) return;
      inFlight.current = true;
      try {
        await ensureLocalRunnerReady();
      } catch (error) {
        console.warn('[local-runner] pairing failed', error);
      } finally {
        inFlight.current = false;
      }
    };

    void connect();
    const interval = window.setInterval(() => {
      if (cancelled || inFlight.current) return;
      void window.dobbyLocal?.status().then((status) => {
        if (status.state !== 'online') void connect();
      });
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled]);
}
