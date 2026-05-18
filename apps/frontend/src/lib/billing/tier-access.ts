/** Minimal fields needed to evaluate Basic vs prepaid-unlock billing tier. */
export type BillingTierCheck = {
  tier_key?: string;
  prepaid_unlock?: boolean;
};

/** True for Basic/none billing tier without prepaid credit unlock. */
export function isFreeBillingTier(subscription: BillingTierCheck | undefined | null): boolean {
  if (!subscription) return true;
  if (subscription.prepaid_unlock) return false;
  const key = subscription.tier_key;
  return !key || key === 'free' || key === 'none';
}

/** Paid subscription or prepaid unlock — eligible for paid-only features (e.g. downloads). */
export function hasPaidFeatureAccess(subscription: BillingTierCheck | undefined | null): boolean {
  return !isFreeBillingTier(subscription);
}
