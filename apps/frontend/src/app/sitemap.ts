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
  { path: '/cn', priority: 0.95, changeFrequency: 'weekly' as const },
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

async function fetchRecentWorkPaths(): Promise<Array<{ path: string; lastModified?: Date }>> {
  const api = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || '';
  if (!api) return [];
  const out: Array<{ path: string; lastModified?: Date }> = [];
  for (const lang of ['en', 'zh'] as const) {
    try {
      const response = await fetch(
        `${api.replace(/\/$/, '')}/community?lang=${lang}&limit=100&offset=0&sort_by=created_at&order=desc`,
        { next: { revalidate: 3600 } },
      );
      if (!response.ok) continue;
      const data = (await response.json()) as {
        posts?: Array<{ id: string; slug?: string | null; created_at?: string; updated_at?: string }>;
      };
      for (const post of data.posts || []) {
        const key = post.slug || post.id;
        if (!key) continue;
        out.push({
          path: `/works/${key}`,
          lastModified: post.updated_at || post.created_at ? new Date(post.updated_at || post.created_at!) : undefined,
        });
      }
    } catch {
      // Sitemap should not fail the build if the API is unreachable.
    }
  }
  const seen = new Set<string>();
  return out.filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  const works = await fetchRecentWorkPaths();
  for (const work of works) {
    entries.push({
      url: `${CANONICAL_ORIGIN}${work.path}`,
      changeFrequency: 'weekly',
      priority: 0.7,
      lastModified: work.lastModified,
    });
  }

  return entries;
}
