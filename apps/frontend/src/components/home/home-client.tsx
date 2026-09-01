'use client';

import { Suspense, lazy } from 'react';
import { BackgroundAALChecker } from '@/components/auth/background-aal-checker';
import { HeroSection } from '@/components/home/hero-section';

const MobileAppInterstitial = lazy(() =>
  import('@/components/announcements/mobile-app-interstitial').then(mod => ({
    default: mod.MobileAppInterstitial,
  })),
);

export function HomeClient() {
  return (
    <BackgroundAALChecker>
      <div className="h-dvh">
        <HeroSection />
        <Suspense fallback={null}>
          <MobileAppInterstitial />
        </Suspense>
      </div>
    </BackgroundAALChecker>
  );
}
