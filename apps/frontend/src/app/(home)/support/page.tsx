'use client';

import { Mail, Clock, Shield, ChevronDown, UserX } from 'lucide-react';
import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AnimatedBg } from '@/components/ui/animated-bg';
import { useIsMobile } from '@/hooks/utils';
import { Button } from '@/components/ui/button';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/site-config';

const SectionHeader = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="p-8 space-y-4">
      {children}
    </div>
  );
};

const FAQItem = ({ question, answer }: { question: string; answer: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-6 hover:bg-accent/20 transition-colors flex items-center justify-between gap-4"
      >
        <span className="font-medium">{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-6 pb-6">
          <div className="text-muted-foreground leading-relaxed">{answer}</div>
        </div>
      )}
    </div>
  );
};

function SupportPageContent() {
  const t = useTranslations('support');
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const accountDeleteRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'account-delete' && accountDeleteRef.current) {
      // Small delay to ensure the page has rendered
      setTimeout(() => {
        accountDeleteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [searchParams]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-full">
      <div className="w-full divide-y divide-border">
        <section className="w-full relative overflow-hidden">
          <AnimatedBg
            variant="hero"
            sizeMultiplier={isMobile ? 0.7 : 1}
            blurMultiplier={isMobile ? 0.6 : 1}
            customArcs={isMobile ? {
              left: [
                {
                  pos: { left: -150, top: 30 },
                  size: 380,
                  tone: 'medium' as const,
                  opacity: 0.15,
                  delay: 0.5,
                  x: [0, 15, -8, 0],
                  y: [0, 12, -6, 0],
                  scale: [0.82, 1.08, 0.94, 0.82],
                  blur: ['12px', '20px', '16px', '12px'],
                },
              ],
              right: [
                {
                  pos: { right: -120, top: 140 },
                  size: 300,
                  tone: 'dark' as const,
                  opacity: 0.2,
                  delay: 1.0,
                  x: [0, -18, 10, 0],
                  y: [0, 14, -8, 0],
                  scale: [0.86, 1.14, 1.0, 0.86],
                  blur: ['10px', '6px', '8px', '10px'],
                },
              ],
            } : undefined}
          />
          <div className="relative flex flex-col items-center w-full px-6">
            <div className="relative z-10 pt-32 mx-auto h-full w-full max-w-6xl flex flex-col items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-6 pt-12 max-w-4xl mx-auto pb-16">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tighter text-balance text-center">
                  <span className="text-primary">{t('hero.title')}</span>
                </h1>
                
                <p className="text-base md:text-lg text-center text-muted-foreground font-medium text-balance leading-relaxed tracking-tight max-w-2xl">
                  {t('hero.subtitle')}
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <Button asChild size="lg" className="text-base h-14 w-48 rounded-full px-8">
                    <a href={SUPPORT_MAILTO}>
                      <Mail className="w-5 h-5"/>
                      {t('hero.emailSupport')}
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="text-base h-14 w-48 rounded-full px-8">
                    <a href="#faq">
                      {t('hero.browseFaqs')}
                    </a>
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  {t.rich('hero.directEmailRich', {
                    email: (chunks) => (
                      <a
                        href={SUPPORT_MAILTO}
                        className="text-primary hover:underline font-medium"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center justify-center w-full relative">
          <div className="relative w-full px-6">
            <div className="max-w-6xl mx-auto border-l border-r border-border">
              <SectionHeader>
                <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-center text-balance pb-1">
                  {t('contact.title')}
                </h2>
                <p className="text-sm text-muted-foreground text-center text-balance font-medium">
                  {t('contact.subtitle')}
                </p>
              </SectionHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 border-t border-border">
                <div className="p-8 border-r border-border space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t('contact.emailTitle')}</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {t('contact.emailBody')}
                    </p>
                    <a 
                      href={SUPPORT_MAILTO} 
                      className="text-primary hover:underline font-medium inline-flex items-center gap-2"
                    >
                      {SUPPORT_EMAIL}
                    </a>
                  </div>
                </div>

                <div className="p-8 border-r border-border space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t('contact.responseTitle')}</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {t('contact.responseBody')}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('contact.businessHours')}
                    </p>
                  </div>
                </div>

                <div className="p-8 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t('contact.priorityTitle')}</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {t('contact.priorityBody')}
                    </p>
                    <a href={SUPPORT_MAILTO} className="text-primary hover:underline font-medium">
                      {t('contact.priorityLink')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="flex flex-col items-center justify-center w-full relative">
          <div className="relative w-full px-6">
            <div className="max-w-6xl mx-auto border-l border-r border-border">
              <SectionHeader>
                <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-center text-balance pb-1">
                  {t('faq.title')}
                </h2>
                <p className="text-sm text-muted-foreground text-center text-balance font-medium">
                  {t('faq.subtitle')}
                </p>
              </SectionHeader>

              <div className="border-t border-border">
                <FAQItem
                  question={t('faq.q1.q')}
                  answer={t('faq.q1.a')}
                />
                <FAQItem
                  question={t('faq.q2.q')}
                  answer={t('faq.q2.a')}
                />
                <FAQItem
                  question={t('faq.q3.q')}
                  answer={t('faq.q3.a')}
                />
                <FAQItem
                  question={t('faq.q4.q')}
                  answer={t('faq.q4.a')}
                />
                <FAQItem
                  question={t('faq.q5.q')}
                  answer={t.rich('faq.q5.aRich', {
                    email: (chunks) => (
                      <a href={SUPPORT_MAILTO} className="text-primary hover:underline font-medium">
                        {chunks}
                      </a>
                    ),
                  })}
                />
                <FAQItem
                  question={t('faq.q6.q')}
                  answer={t.rich('faq.q6.aRich', {
                    email: (chunks) => (
                      <a href={SUPPORT_MAILTO} className="text-primary hover:underline font-medium">
                        {chunks}
                      </a>
                    ),
                  })}
                />
                <FAQItem
                  question={t('faq.q7.q')}
                  answer={t.rich('faq.q7.aRich', {
                    email: (chunks) => (
                      <a href={SUPPORT_MAILTO} className="text-primary hover:underline font-medium">
                        {chunks}
                      </a>
                    ),
                  })}
                />
              </div>
            </div>
          </div>
        </section>

        <section ref={accountDeleteRef} id="account-delete" className="flex flex-col items-center justify-center w-full relative">
          <div className="relative w-full px-6">
            <div className="max-w-6xl mx-auto border-l border-r border-border">
              <SectionHeader>
                <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-center text-balance pb-1">
                  {t('accountDelete.title')}
                </h2>
                <p className="text-sm text-muted-foreground text-center text-balance font-medium">
                  {t('accountDelete.subtitle')}
                </p>
              </SectionHeader>

              <div className="border-t border-border">
                <div className="p-8 space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <UserX className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-4 flex-1">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{t('accountDelete.sectionTitle')}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {t('accountDelete.intro')}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-lg border bg-accent/5">
                          <h4 className="font-medium mb-2 text-sm">{t('accountDelete.option1Title')}</h4>
                          <p className="text-muted-foreground text-sm mb-3">
                            {t.rich('accountDelete.option1BodyRich', {
                              email: (chunks) => (
                                <a href={SUPPORT_MAILTO} className="text-primary hover:underline font-medium">
                                  {chunks}
                                </a>
                              ),
                            })}
                          </p>
                        </div>

                        <div className="p-4 rounded-lg border bg-accent/5">
                          <h4 className="font-medium mb-2 text-sm">{t('accountDelete.option2Title')}</h4>
                          <p className="text-muted-foreground text-sm mb-3">
                            {t('accountDelete.option2Intro')}
                          </p>
                          <ol className="text-muted-foreground text-sm space-y-2 ml-4 list-decimal">
                            <li>{t('accountDelete.step1')}</li>
                            <li>{t.rich('accountDelete.step2Rich', { strong: (c) => <strong className="text-foreground">{c}</strong> })}</li>
                            <li>{t.rich('accountDelete.step3Rich', { strong: (c) => <strong className="text-foreground">{c}</strong> })}</li>
                            <li>{t.rich('accountDelete.step4Rich', { strong: (c) => <strong className="text-foreground">{c}</strong> })}</li>
                            <li>
                              {t('accountDelete.step5Intro')}
                              <ul className="ml-4 mt-1 space-y-1 list-disc">
                                <li>{t.rich('accountDelete.step5aRich', { strong: (c) => <strong className="text-foreground">{c}</strong> })}</li>
                                <li>{t.rich('accountDelete.step5bRich', { strong: (c) => <strong className="text-foreground">{c}</strong> })}</li>
                              </ul>
                            </li>
                            <li>{t.rich('accountDelete.step6Rich', { strong: (c) => <strong className="text-foreground">{c}</strong> })}</li>
                            <li>{t.rich('accountDelete.step7Rich', { strong: (c) => <strong className="text-foreground">{c}</strong> })}</li>
                          </ol>
                          <p className="text-muted-foreground text-xs mt-3 italic">
                            {t('accountDelete.note')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center justify-center w-full relative">
          <div className="relative w-full px-6">
            <div className="max-w-6xl mx-auto border-l border-r border-border">
              <SectionHeader>
                <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-center text-balance pb-1">
                  {t('legal.title')}
                </h2>
                <p className="text-sm text-muted-foreground text-center text-balance font-medium">
                  {t('legal.subtitle')}
                </p>
              </SectionHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 border-t border-border">
                <div className="p-8 border-r border-border space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t('legal.termsTitle')}</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {t('legal.termsBody')}
                    </p>
                    <Link href="/legal?tab=terms" className="text-primary hover:underline font-medium text-sm">
                      {t('legal.termsLink')}
                    </Link>
                  </div>
                </div>

                <div className="p-8 border-r border-border space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t('legal.privacyTitle')}</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {t('legal.privacyBody')}
                    </p>
                    <Link href="/legal?tab=privacy" className="text-primary hover:underline font-medium text-sm">
                      {t('legal.privacyLink')}
                    </Link>
                  </div>
                </div>

                <div className="p-8 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t('legal.imprintTitle')}</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {t('legal.imprintBody')}
                    </p>
                    <Link href="/legal?tab=imprint" className="text-primary hover:underline font-medium text-sm">
                      {t('legal.imprintLink')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center justify-center w-full relative">
          <div className="relative w-full px-6 py-16">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-balance">
                {t('footer.title')}
              </h2>
              <p className="text-sm text-muted-foreground text-balance font-medium">
                {t('footer.subtitle')}
              </p>
              <div className="pt-4">
                <Button asChild size="lg" className="text-base h-14 w-48 rounded-full px-8">
                  <a href={SUPPORT_MAILTO}>
                    <Mail className="w-5 h-5" />
                    {t('footer.contactSupport')}
                  </a>
                </Button>
              </div>
              <div className="pt-6 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('footer.generalInquiries')}{' '}
                  <a href="mailto:info@dobby.now" className="text-primary hover:underline">info@dobby.now</a>
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('footer.securityIssues')}{' '}
                  <a href="mailto:security@dobby.now" className="text-primary hover:underline">security@dobby.now</a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SupportLoadingFallback() {
  const t = useTranslations('common');
  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-full">
      <div className="w-full">
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="text-muted-foreground">{t('loading')}</div>
        </div>
      </div>
    </main>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportLoadingFallback />}>
      <SupportPageContent />
    </Suspense>
  );
}
