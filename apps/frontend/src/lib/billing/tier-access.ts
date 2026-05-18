import type { AccountState } from '@/lib/api/billing';

type Subscription = AccountState['subscription'];

/** True for Basic/none billing tier without prepaid credit unlock. */
export function isFreeBillingTier(subscription: Subscription | undefined | null): boolean {
  if (!subscription) return true;
  if (subscription.prepaid_unlock) return false;
  const key = subscription.tier_key;
  return !key || key === 'free' || key === 'none';
}

/** Paid subscription or prepaid unlock — eligible for paid-only features (e.g. downloads). */
export function hasPaidFeatureAccess(subscription: Subscription | undefined | null): boolean {
  return !isFreeBillingTier(subscription);
}
