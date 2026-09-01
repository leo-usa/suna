import { pricingTiers, type PricingTier } from '@/lib/pricing-config';
import { getSiteUrl } from '@/lib/site-url';

// Re-export for backward compatibility
export type { PricingTier } from '@/lib/pricing-config';

export const SUPPORT_EMAIL = 'support@dobby.now';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

export const siteConfig = {
  url: getSiteUrl(),
  nav: {
    links: [
      { id: 1, href: '/', i18nKey: 'home' as const },
      { id: 2, href: '/about', i18nKey: 'about' as const },
      { id: 3, href: '/pricing', i18nKey: 'pricing' as const },
      { id: 4, href: '/tutorials', i18nKey: 'tutorials' as const },
      { id: 5, href: '/works', i18nKey: 'works' as const },
      { id: 6, href: '/download', i18nKey: 'download' as const },
      { id: 7, href: 'https://api.dobby.now', i18nKey: 'api' as const },
    ],
  },
  hero: {
    description:
      'Dobby – open-source platform to build, manage and train your AI Workforce.',
  },
  cloudPricingItems: pricingTiers,
  footerLinks: [
    {
      title: 'Dobby',
      links: [
        { id: 1, title: 'About', url: '/about' },
        { id: 2, title: 'Careers', url: '/careers' },
        { id: 3, title: 'Support', url: '/support' },
        { id: 4, title: 'Contact', url: 'mailto:hey@dobby.now' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { id: 5, title: 'Tutorials', url: '/tutorials' },
        { id: 6, title: 'Documentation', url: '/docs/api' },
        { id: 7, title: 'Discord', url: 'https://discord.com/invite/RvFhXUdZ9H' },
        { id: 8, title: 'API', url: 'https://api.dobby.now' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { id: 9, title: 'Privacy Policy', url: '/legal?tab=privacy' },
        { id: 10, title: 'Terms of Service', url: '/legal?tab=terms' },
        { id: 11, title: 'License', url: '/legal' },
      ],
    },
  ],
};

export type SiteConfig = typeof siteConfig;
