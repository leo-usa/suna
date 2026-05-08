import { pricingTiers, type PricingTier } from '@/lib/pricing-config';

// Re-export for backward compatibility
export type { PricingTier } from '@/lib/pricing-config';

export const SUPPORT_EMAIL = 'support@dobby.now';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

export const siteConfig = {
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  nav: {
    links: [
      { id: 1, href: '/', i18nKey: 'home' as const },
      { id: 2, href: '/about', i18nKey: 'about' as const },
      { id: 3, href: '/pricing', i18nKey: 'pricing' as const },
      { id: 4, href: '/tutorials', i18nKey: 'tutorials' as const },
      { id: 5, href: 'https://api.dobby.now', i18nKey: 'api' as const },
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
        { id: 4, title: 'Contact', url: 'mailto:hey@dobby.com' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { id: 5, title: 'Tutorials', url: '/tutorials' },
        { id: 6, title: 'Documentation', url: 'https://github.com/kortix-ai/suna' },
        { id: 7, title: 'Discord', url: 'https://discord.com/invite/RvFhXUdZ9H' },
        { id: 8, title: 'GitHub', url: 'https://github.com/kortix-ai/suna' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { id: 9, title: 'Privacy Policy', url: '/legal?tab=privacy' },
        { id: 10, title: 'Terms of Service', url: '/legal?tab=terms' },
        { id: 11, title: 'License', url: 'https://github.com/kortix-ai/suna/blob/main/LICENSE' },
      ],
    },
  ],
};

export type SiteConfig = typeof siteConfig;
