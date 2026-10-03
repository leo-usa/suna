'use client';

import { useEffect } from 'react';
import { useDobbyComputerStore } from '@/stores/dobby-computer-store';

/**
 * Mounted when an ask tool call requests await_login.
 * Opens the side panel on the live Browser view for manual credential entry.
 */
export function LoginHandoffActivator() {
  const startLoginHandoff = useDobbyComputerStore((state) => state.startLoginHandoff);

  useEffect(() => {
    startLoginHandoff();
  }, [startLoginHandoff]);

  return null;
}
