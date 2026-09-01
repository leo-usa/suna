import type { Metadata } from 'next';
import { CANONICAL_ORIGIN, pageUrl } from '@/lib/site-url';
import { siteMetadata } from '@/lib/site-metadata';

const HTML_LANG: Record<string, string> = {
  en: 'en',
  zh: 'zh-CN',
  de: 'de',
  it: 'it',
  ja: 'ja',
  pt: 'pt',
  fr: 'fr',
  es: 'es',
};

/** `<html lang>` from middleware request headers. `/cn` is always Chinese. */
export function htmlLangFromRequest(locale: string | null, pathname: string | null): string {
  if (pathname === '/cn' || pathname?.startsWith('/cn/')) return 'zh-CN';
  if (locale && HTML_LANG[locale]) return HTML_LANG[locale];
  return 'en';
}

export function pageMetadata({
  title,
  description,
  path,
  locale = 'en_US',
  absoluteTitle = true,
}: {
  title: string;
  description: string;
  path: string;
  locale?: string;
  absoluteTitle?: boolean;
}): Metadata {
  const url = pageUrl(path);
  const ogTitle = title;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: ogTitle,
      description,
      url,
      siteName: siteMetadata.name,
      locale,
      images: [
        {
          url: '/banner.png',
          width: 1200,
          height: 630,
          alt: ogTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: ['/banner.png'],
    },
  };
}

export { CANONICAL_ORIGIN, pageUrl };
