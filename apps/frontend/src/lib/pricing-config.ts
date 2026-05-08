import { config } from '@/lib/config';

interface UpgradePlan {
  /** @deprecated */
  hours: string;
  price: string;
  tierKey: string;
}

/** Structured plan feature for i18n (resolved via billing.pricingFeatureItems). */
export type PricingFeatureItem =
  | { kind: 'credits_monthly'; credits: number }
  | { kind: 'credits_bonus'; original: number; bonus: number }
  | { kind: 'unlimited_chats' }
  | { kind: 'weekly_credits'; credits: number }
  | { kind: 'concurrent_run_single' }
  | { kind: 'basic_mode' }
  | { kind: 'concurrent_runs'; count: number }
  | { kind: 'custom_workers'; count: number }
  | { kind: 'custom_workers_short'; count: number }
  | { kind: 'scheduled_triggers'; count: number }
  | { kind: 'app_triggers'; count: number }
  | { kind: 'integrations_100' }
  | { kind: 'advanced_mode' }
  | { kind: 'private_projects' }
  | { kind: 'premium_models' }
  | { kind: 'priority_support' }
  | { kind: 'account_manager' }
  | { kind: 'custom_deployment' };

export type PricingDisabledItem =
  | { kind: 'no_custom_workers' }
  | { kind: 'no_scheduled_triggers' }
  | { kind: 'no_app_triggers' }
  | { kind: 'no_integrations' };

export interface PricingTier {
  name: string;
  price: string;
  yearlyPrice?: string;
  description: string;
  buttonText: string;
  buttonColor: string;
  isPopular: boolean;
  /** @deprecated */
  hours: string;
  features: PricingFeatureItem[];
  disabledFeatures?: PricingDisabledItem[];
  baseCredits?: number;
  bonusCredits?: number;
  tierKey: string;
  upgradePlans: UpgradePlan[];
  hidden?: boolean;
  billingPeriod?: 'monthly' | 'yearly';
  originalYearlyPrice?: string;
  discountPercentage?: number;
}

export const pricingTiers: PricingTier[] = [
  {
    name: 'Basic',
    price: '$0',
    yearlyPrice: '$0',
    originalYearlyPrice: '$0',
    discountPercentage: 0,
    description: 'Perfect for trying out Dobby AI Workers',
    buttonText: 'Get started',
    buttonColor: 'bg-secondary text-white',
    isPopular: false,
    hours: '0 hours',
    features: [
      { kind: 'weekly_credits', credits: 100 },
      { kind: 'concurrent_run_single' },
      { kind: 'basic_mode' },
    ],
    disabledFeatures: [
      { kind: 'no_custom_workers' },
      { kind: 'no_scheduled_triggers' },
      { kind: 'no_app_triggers' },
      { kind: 'no_integrations' },
    ],
    tierKey: config.SUBSCRIPTION_TIERS.FREE_TIER.tierKey,
    upgradePlans: [],
  },
  {
    name: 'Plus',
    price: '$20',
    yearlyPrice: '$204',
    originalYearlyPrice: '$240',
    discountPercentage: 15,
    description: 'Best for individuals and small teams',
    buttonText: 'Get started',
    buttonColor: 'bg-primary text-white dark:text-black',
    isPopular: false,
    hours: '2 hours',
    baseCredits: 2000,
    features: [
      { kind: 'credits_monthly', credits: 2000 },
      { kind: 'unlimited_chats' },
      { kind: 'concurrent_runs', count: 3 },
      { kind: 'custom_workers', count: 5 },
      { kind: 'scheduled_triggers', count: 5 },
      { kind: 'app_triggers', count: 25 },
      { kind: 'integrations_100' },
      { kind: 'advanced_mode' },
    ],
    tierKey: config.SUBSCRIPTION_TIERS.TIER_2_20.tierKey,
    upgradePlans: [],
  },
  {
    name: 'Pro',
    price: '$50',
    yearlyPrice: '$510',
    originalYearlyPrice: '$600',
    discountPercentage: 15,
    description: 'Ideal for growing businesses',
    buttonText: 'Get started',
    buttonColor: 'bg-primary text-white dark:text-black',
    isPopular: true,
    hours: '6 hours',
    baseCredits: 5000,
    features: [
      { kind: 'credits_monthly', credits: 5000 },
      { kind: 'unlimited_chats' },
      { kind: 'concurrent_runs', count: 5 },
      { kind: 'custom_workers', count: 20 },
      { kind: 'scheduled_triggers', count: 10 },
      { kind: 'app_triggers', count: 50 },
      { kind: 'integrations_100' },
      { kind: 'advanced_mode' },
    ],
    tierKey: config.SUBSCRIPTION_TIERS.TIER_6_50.tierKey,
    upgradePlans: [],
  },
  {
    name: 'Business',
    price: '$100',
    yearlyPrice: '$1020',
    originalYearlyPrice: '$1200',
    discountPercentage: 15,
    description: 'For established businesses',
    buttonText: 'Get started',
    buttonColor: 'bg-secondary text-white',
    isPopular: false,
    hours: '12 hours',
    features: [
      { kind: 'credits_monthly', credits: 10_000 },
      { kind: 'custom_workers_short', count: 20 },
      { kind: 'private_projects' },
      { kind: 'integrations_100' },
      { kind: 'premium_models' },
    ],
    tierKey: config.SUBSCRIPTION_TIERS.TIER_12_100.tierKey,
    upgradePlans: [],
    hidden: true,
  },
  {
    name: 'Ultra',
    price: '$200',
    yearlyPrice: '$2040',
    originalYearlyPrice: '$2400',
    discountPercentage: 15,
    description: 'For power users',
    buttonText: 'Get started',
    buttonColor: 'bg-primary text-white dark:text-black',
    isPopular: false,
    hours: '25 hours',
    baseCredits: 20000,
    features: [
      { kind: 'credits_monthly', credits: 20_000 },
      { kind: 'unlimited_chats' },
      { kind: 'concurrent_runs', count: 20 },
      { kind: 'custom_workers', count: 100 },
      { kind: 'scheduled_triggers', count: 50 },
      { kind: 'app_triggers', count: 200 },
      { kind: 'integrations_100' },
      { kind: 'advanced_mode' },
    ],
    tierKey: config.SUBSCRIPTION_TIERS.TIER_25_200.tierKey,
    upgradePlans: [],
  },
  {
    name: 'Enterprise',
    price: '$400',
    yearlyPrice: '$4080',
    originalYearlyPrice: '$4800',
    discountPercentage: 15,
    description: 'For large teams',
    buttonText: 'Get started',
    buttonColor: 'bg-secondary text-white',
    isPopular: false,
    hours: '50 hours',
    features: [
      { kind: 'credits_monthly', credits: 40_000 },
      { kind: 'private_projects' },
      { kind: 'integrations_100' },
      { kind: 'premium_models' },
      { kind: 'priority_support' },
    ],
    tierKey: config.SUBSCRIPTION_TIERS.TIER_50_400.tierKey,
    upgradePlans: [],
    hidden: true,
  },
  {
    name: 'Scale',
    price: '$800',
    yearlyPrice: '$8160',
    originalYearlyPrice: '$9600',
    discountPercentage: 15,
    description: 'For scaling teams',
    buttonText: 'Get started',
    buttonColor: 'bg-secondary text-white',
    isPopular: false,
    hours: '125 hours',
    features: [
      { kind: 'credits_monthly', credits: 80_000 },
      { kind: 'private_projects' },
      { kind: 'integrations_100' },
      { kind: 'premium_models' },
      { kind: 'priority_support' },
      { kind: 'account_manager' },
    ],
    tierKey: config.SUBSCRIPTION_TIERS.TIER_125_800.tierKey,
    upgradePlans: [],
    hidden: true,
  },
  {
    name: 'Max',
    price: '$1000',
    yearlyPrice: '$10200',
    originalYearlyPrice: '$12000',
    discountPercentage: 15,
    description: 'Maximum performance',
    buttonText: 'Get started',
    buttonColor: 'bg-secondary text-white',
    isPopular: false,
    hours: '200 hours',
    features: [
      { kind: 'credits_monthly', credits: 100_000 },
      { kind: 'private_projects' },
      { kind: 'integrations_100' },
      { kind: 'premium_models' },
      { kind: 'priority_support' },
      { kind: 'account_manager' },
      { kind: 'custom_deployment' },
    ],
    tierKey: config.SUBSCRIPTION_TIERS.TIER_200_1000.tierKey,
    upgradePlans: [],
    hidden: true,
  },
];
