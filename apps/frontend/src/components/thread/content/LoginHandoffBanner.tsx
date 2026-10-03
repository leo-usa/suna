'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useDobbyComputerStore } from '@/stores/dobby-computer-store';

export function LoginHandoffBanner() {
  const t = useTranslations('thread');
  const startLoginHandoff = useDobbyComputerStore((state) => state.startLoginHandoff);
  const loginHandoffActive = useDobbyComputerStore((state) => state.loginHandoffActive);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100 space-y-2">
      <p>
        {t('loginHandoffHint')}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 border-amber-500/40 bg-background/60 hover:bg-background"
        onClick={() => startLoginHandoff()}
      >
        {loginHandoffActive ? t('loginHandoffReopenBrowser') : t('loginHandoffOpenBrowser')}
      </Button>
    </div>
  );
}
