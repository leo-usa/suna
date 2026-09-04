'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

const CAPABILITY_KEYS = ['slides', 'research', 'docs', 'data', 'media', 'canvas'] as const;
const FAQ_KEYS = ['what', 'desktop', 'wechat', 'free'] as const;

export function HomeSeoContent() {
  const t = useTranslations('home.seo');
  const locale = useLocale();
  const faq = FAQ_KEYS.map((key) => ({
    q: t(`faq.${key}.q`),
    a: t(`faq.${key}.a`),
  }));

  return (
    <div className="relative z-10 bg-background border-t border-border/40">
      <h1 className="sr-only">{t('h1')}</h1>
      <section className="max-w-3xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
          {t('canDoTitle')}
        </h2>
        <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          {t('canDoBody')}
        </p>
        <ul className="mt-8 grid sm:grid-cols-2 gap-3 text-sm md:text-base text-foreground/80">
          {CAPABILITY_KEYS.map((key) => (
            <li key={key}>{t(`capabilities.${key}`)}</li>
          ))}
        </ul>
      </section>

      <section className="max-w-3xl mx-auto px-6 md:px-10 pb-16 md:pb-24">
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
          {t('channelsTitle')}
        </h2>
        <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          {t('channelsBody')}
        </p>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          <Link href="/download" className="text-foreground underline underline-offset-4">
            {t('download')}
          </Link>
          <Link href="/works" className="text-foreground underline underline-offset-4">
            {t('works')}
          </Link>
          <Link href="/pricing" className="text-foreground underline underline-offset-4">
            {t('pricing')}
          </Link>
          {locale !== 'zh' && (
            <Link href="/cn" className="text-foreground underline underline-offset-4">
              {t('cnIntro')}
            </Link>
          )}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 md:px-10 pb-20 md:pb-28">
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
          {t('questionsTitle')}
        </h2>
        <dl className="mt-8 space-y-8">
          {faq.map((item) => (
            <div key={item.q}>
              <dt className="text-base md:text-lg font-medium text-foreground">{item.q}</dt>
              <dd className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-3">
          <Link href="/about" className="hover:text-foreground">{t('footer.about')}</Link>
          <Link href="/tutorials" className="hover:text-foreground">{t('footer.tutorials')}</Link>
          <Link href="/legal?tab=privacy" className="hover:text-foreground">{t('footer.privacy')}</Link>
          <Link href="/legal?tab=terms" className="hover:text-foreground">{t('footer.terms')}</Link>
          <Link href="/support" className="hover:text-foreground">{t('footer.support')}</Link>
        </div>
        <p>© {new Date().getFullYear()} Dobby</p>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
    </div>
  );
}
