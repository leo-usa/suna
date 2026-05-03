import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { loadMessages } from './load-messages';

export const locales = ['en', 'de', 'it', 'zh', 'ja', 'pt', 'fr', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    locale,
    messages: loadMessages(locale as Locale),
  };
});

