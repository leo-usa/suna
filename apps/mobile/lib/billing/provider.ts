export type BillingProvider = 'revenuecat';

/**
 * Web checkout (PlanPage → dobby.now). Set to true when RevenueCat IAP is configured.
 */
export function shouldUseRevenueCat(): boolean {
  return false;
}

// Legacy aliases for backwards compatibility
export const isRevenueCatConfigured = shouldUseRevenueCat;
export const getBillingProvider = (): BillingProvider => 'revenuecat';
export const shouldUseStripe = () => false;
