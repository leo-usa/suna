'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccountState, accountStateSelectors } from '@/hooks/billing';
import { motion, AnimatePresence } from 'framer-motion';
import { usePricingModalStore } from '@/stores/pricing-modal-store';
import { usePathname } from 'next/navigation';
import { useWelcomeBannerStore } from '@/stores/welcome-banner-store';
import { usePromo } from '@/hooks/utils/use-promo';
import { useTranslations } from 'next-intl';

const BANNER_DISMISSED_KEY = 'dashboard-promo-banner-dismissed';

export function DashboardPromoBanner() {
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: accountState, isLoading } = useAccountState();
  const { openPricingModal } = usePricingModalStore();
  const pathname = usePathname();
  const { setIsVisible } = useWelcomeBannerStore();
  const promo = usePromo();
  const t = useTranslations('dashboard.promoBanner');
  
  const tierKey = accountStateSelectors.tierKey(accountState)?.toLowerCase();
  const isFreeTier = !tierKey || tierKey === 'free' || tierKey === 'none';
  const isDashboardPage = pathname === '/dashboard';
  
  // Show API promo (and legacy promo ids, if ever re-enabled)
  const shouldShowPromo = promo?.isActive && (promo.promoId === 'dobby-api' || promo.promoId === 'welcome-bonus' || promo.promoCode === 'KORTIX26');

  // Compute whether banner should be visible
  const shouldShow = mounted && !isDismissed && isDashboardPage && !isLoading && isFreeTier && shouldShowPromo;

  // Update the store whenever visibility changes
  useEffect(() => {
    setIsVisible(shouldShow);
    return () => setIsVisible(false);
  }, [shouldShow, setIsVisible]);

  useEffect(() => {
    setMounted(true);
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  };

  const handleUpgrade = () => {
    openPricingModal();
  };

  // Only show on /dashboard, for confirmed free tier users, and if not dismissed
  if (!shouldShow || !promo) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute top-0 left-0 right-0 z-50 pointer-events-auto"
      >
        <div className="relative border-b border-border/40 bg-background/95 backdrop-blur-md">
          <div className="px-4 py-2">
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              {/* Content - simplified */}
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-foreground">
                  {promo.promoId === 'dobby-api' ? (
                    <>
                      <span className="text-primary">API</span>
                      <span className="text-muted-foreground mx-1.5">·</span>
                      {t('apiMessage', { host: 'api.dobby.now' })}
                    </>
                  ) : (
                    <>
                      <span className="text-primary">{promo.promoCode}</span>
                      <span className="text-muted-foreground mx-1.5">·</span>
                      30% off
                    </>
                  )}
                </span>
              </div>

              <span className="text-muted-foreground/50 hidden sm:inline">·</span>
              
              {/* Countdown - simplified */}
              {promo.promoId !== 'dobby-api' && (
                <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                  {promo.timeLabel}
                </span>
              )}

              {/* CTA */}
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  if (promo.promoId === 'dobby-api') {
                    window.open('https://api.dobby.now', '_blank', 'noopener,noreferrer');
                    return;
                  }
                  handleUpgrade();
                }}
                className="h-6 px-2.5 text-xs font-medium"
              >
                {promo.promoId === 'dobby-api' ? t('openCta') : t('upgradeCta')}
              </Button>

              {/* Close */}
              <button
                onClick={handleDismiss}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground/60 hover:text-muted-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

