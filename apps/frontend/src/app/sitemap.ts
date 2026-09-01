import { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { CANONICAL_ORIGIN } from '@/lib/site-url';

const LOCALIZED_ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/legal', priority: 0.4, changeFrequency: 'monthly' as const },
  { path: '/support', priority: 0.6, changeFrequency: 'monthly' as const },
];

const EN_ONLY_ROUTES = [
  { path: '/about', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/download', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/tutorials', priority: 0.7, changeFrequency: 'weekly' as const },
  { path: '/works', priority: 0.8, changeFrequency: 'daily' as const },
  { path: '/careers', priority: 0.5, changeFrequency: 'monthly' as const },
  { path: '/agents-101', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/help', priority: 0.5, changeFrequency: 'monthly' as const },
  { path: '/docs/api', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/cn/consumer', priority: 0.85, changeFrequency: 'weekly' as const },
  { path: '/cn/enterprise', priority: 0.85, changeFrequency: 'weekly' as const },
];

function languageMap(path: string): Record<string, string> {
  const languages = Object.fromEntries(
    locales.map((loc) => [
      loc,
      loc === 'en' ? `${CANONICAL_ORIGIN}${path === '/' ? '' : path}` : `${CANONICAL_ORIGIN}/${loc}${path === '/' ? '' : path}`,
    ]),
  );
  languages['x-default'] = `${CANONICAL_ORIGIN}${path === '/' ? '' : path}`;
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  LOCALIZED_ROUTES.forEach((route) => {
    locales.forEach((locale) => {
      const url =
        locale === 'en'
          ? `${CANONICAL_ORIGIN}${route.path === '/' ? '' : route.path}`
          : `${CANONICAL_ORIGIN}/${locale}${route.path === '/' ? '' : route.path}`;

      entries.push({
        url,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages: languageMap(route.path) },
      });
    });
  });

  EN_ONLY_ROUTES.forEach((route) => {
    entries.push({
      url: `${CANONICAL_ORIGIN}${route.path}`,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    });
  });

  return entries;
}
