'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UserSettingsModal } from '@/components/settings/user-settings-modal';
import { ReferralDialog } from '@/components/referrals/referral-dialog';
import { usePricingModalStore } from '@/stores/pricing-modal-store';

type SettingsTab = 'general' | 'billing' | 'usage' | 'memory';

const MODAL_TABS: Record<string, SettingsTab> = {
  general: 'general',
  billing: 'billing',
  usage: 'usage',
  memory: 'memory',
};

/** Opens settings tabs from links like `/dashboard?settings=usage` (used by the master assistant). */
export function SettingsUrlOpener() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { openPricingModal } = usePricingModalStore();
  const [tab, setTab] = useState<SettingsTab | null>(null);
  const [referralsOpen, setReferralsOpen] = useState(false);

  const requested = searchParams?.get('settings');

  useEffect(() => {
    if (!requested) return;
    if (MODAL_TABS[requested]) {
      setTab(MODAL_TABS[requested]);
    } else if (requested === 'plan') {
      openPricingModal();
    } else if (requested === 'referrals') {
      setReferralsOpen(true);
    }
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.delete('settings');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [requested, searchParams, pathname, router, openPricingModal]);

  return (
    <>
      {tab && (
        <UserSettingsModal
          open={Boolean(tab)}
          onOpenChange={(open) => {
            if (!open) setTab(null);
          }}
          defaultTab={tab}
        />
      )}
      {referralsOpen && <ReferralDialog open={referralsOpen} onOpenChange={setReferralsOpen} />}
    </>
  );
}
