import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Cloud,
  Globe,
  MessageCircle,
  Monitor,
  Presentation,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCnLandingContent } from './cn-landing-content';

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  globe: Globe,
  wallet: Wallet,
  'message-circle': MessageCircle,
  monitor: Monitor,
  cloud: Cloud,
  presentation: Presentation,
};

function CnFeatureCard({
  feature,
}: {
  feature: { icon: string; title: string; description: string };
}) {
  const Icon = ICONS[feature.icon] ?? Globe;

  return (
    <div className="group relative h-full cursor-default">
      <div className="relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-500 group-hover:border-amber-400/45 group-hover:bg-card/90 group-hover:shadow-[0_12px_40px_-12px_rgba(245,158,11,0.28)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-400/30 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-amber-500/80 to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.1),transparent_55%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative mb-4 inline-flex rounded-xl bg-muted/60 p-2.5 transition-colors duration-300 group-hover:bg-amber-500/15">
          <Icon
            className="h-5 w-5 text-foreground transition-colors duration-300 group-hover:text-amber-700 dark:group-hover:text-amber-300"
            strokeWidth={1.75}
          />
        </div>

        <h3 className="relative text-base font-semibold">{feature.title}</h3>
        <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground transition-[color,opacity] duration-300 group-hover:text-foreground/75">
          {feature.description}
        </p>
      </div>
    </div>
  );
}

export function CnLandingPage() {
  const content = getCnLandingContent();
  const titleLines = content.title.split('\n');

  return (
    <main className="min-h-dvh bg-background text-foreground overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <img
          src="/dobby-brandmark-bg.svg?v=3"
          alt=""
          className="absolute left-1/2 top-[-8%] w-[130vw] min-w-[720px] max-w-none -translate-x-1/2 opacity-[0.07] dark:opacity-[0.12] invert dark:invert-0 select-none"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.05] via-transparent to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-28 md:pt-32">
        <section className="max-w-3xl">
          <span className="inline-flex rounded-full border border-amber-300/60 bg-amber-500/10 px-3 py-1 text-xs font-medium tracking-wide text-amber-900 dark:border-amber-700/50 dark:text-amber-100">
            {content.badge}
          </span>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.15] tracking-tight md:text-5xl lg:text-6xl">
            {titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {content.subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-xl px-6">
              <Link href={content.primaryCta.href}>
                {content.primaryCta.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-xl px-6">
              <Link href={content.secondaryCta.href}>{content.secondaryCta.label}</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 md:mt-28">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{content.featuresTitle}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {content.features.map((feature) => (
              <CnFeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </section>

        <section className="mt-20 md:mt-28">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{content.comparisonTitle}</h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">{content.comparisonSubtitle}</p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-border/60">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-5 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:px-6 md:text-sm">
                <span>{content.comparisonHeaders.dimension}</span>
                <span>{content.comparisonHeaders.dobby}</span>
                <span>{content.comparisonHeaders.workbuddy}</span>
                <span>{content.comparisonHeaders.codingAgents}</span>
                <span>{content.comparisonHeaders.openClaw}</span>
              </div>
              {content.comparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-5 border-t border-border/50 px-4 py-4 text-sm md:px-6"
                >
                  <span className="font-medium text-foreground/90">{row.label}</span>
                  <span className="text-foreground/80">{row.dobby}</span>
                  <span className="text-muted-foreground">{row.workbuddy}</span>
                  <span className="text-muted-foreground">{row.codingAgents}</span>
                  <span className="text-muted-foreground">{row.openClaw}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-20 md:mt-28">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{content.faqTitle}</h2>
          <dl className="mt-8 max-w-3xl space-y-8">
            {content.faq.map((item) => (
              <div key={item.q}>
                <dt className="text-base font-medium md:text-lg">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-20 rounded-3xl border border-amber-300/40 bg-amber-500/[0.06] p-8 md:mt-28 md:p-12 dark:border-amber-800/40">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{content.closingTitle}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{content.closingBody}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {content.closingChecks.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Button asChild size="lg" className="h-12 shrink-0 rounded-xl px-8">
              <Link href={content.primaryCta.href}>{content.primaryCta.label}</Link>
            </Button>
          </div>
        </section>

        <footer className="mt-16 border-t border-border/40 pt-8 text-center text-xs text-muted-foreground md:text-left">
          <p>© {new Date().getFullYear()} Dobby. 保留所有权利。</p>
          <div className="mt-2 flex flex-wrap justify-center gap-4 md:justify-start">
            <Link href="/pricing" className="hover:text-foreground">
              定价
            </Link>
            <Link href="/download" className="hover:text-foreground">
              下载桌面端
            </Link>
            <Link href="/support" className="hover:text-foreground">
              支持
            </Link>
            <Link href="/legal" className="hover:text-foreground">
              法律条款
            </Link>
          </div>
        </footer>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            inLanguage: 'zh-CN',
            mainEntity: content.faq.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
    </main>
  );
}
