import type { Metadata } from 'next';
import { CANONICAL_ORIGIN, pageUrl } from '@/lib/site-url';
import { siteMetadata } from '@/lib/site-metadata';

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
