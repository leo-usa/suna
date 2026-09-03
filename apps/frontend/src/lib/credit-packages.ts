export interface CreditPackage {
  amount: number;
  bonus_percent: number;
  base_credits: number;
  bonus_credits: number;
  total_credits: number;
  popular?: boolean;
}

export interface CreditPackagesResponse {
  packages: CreditPackage[];
  credits_per_dollar: number;
}

export const FALLBACK_CREDIT_PACKAGES: CreditPackage[] = [
  { amount: 10, bonus_percent: 0, base_credits: 10_000, bonus_credits: 0, total_credits: 10_000 },
  { amount: 25, bonus_percent: 5, base_credits: 25_000, bonus_credits: 1_250, total_credits: 26_250 },
  { amount: 50, bonus_percent: 8, base_credits: 50_000, bonus_credits: 4_000, total_credits: 54_000 },
  { amount: 100, bonus_percent: 12, base_credits: 100_000, bonus_credits: 12_000, total_credits: 112_000, popular: true },
  { amount: 250, bonus_percent: 16, base_credits: 250_000, bonus_credits: 40_000, total_credits: 290_000 },
  { amount: 500, bonus_percent: 20, base_credits: 500_000, bonus_credits: 100_000, total_credits: 600_000 },
];

export function defaultCreditPackage(packages: CreditPackage[] = FALLBACK_CREDIT_PACKAGES): CreditPackage {
  return packages.find((pkg) => pkg.popular) || packages[0];
}
