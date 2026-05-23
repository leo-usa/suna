'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Check,
  Cloud,
  Globe,
  MessageCircle,
  Plug,
  Shield,
  Smartphone,
  Sparkles,
  Timer,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { DobbyLogo } from '@/components/sidebar/dobby-logo';
import { Button } from '@/components/ui/button';
import { getCnLandingContent } from './cn-landing-content';
import type { CnLandingVariant } from './cn-landing-types';

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  globe: Globe,
  wallet: Wallet,
  'message-circle': MessageCircle,
  smartphone: Smartphone,
  zap: Zap,
  bot: Bot,
  cloud: Cloud,
  plug: Plug,
  timer: Timer,
  users: Users,
  shield: Shield,
};

type CnLandingPageProps = {
  variant: CnLandingVariant;
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const hoverEase = [0.22, 1, 0.36, 1] as const;

function CnFeatureCard({
  feature,
  index,
  variant,
}: {
  feature: { icon: string; title: string; description: string };
  index: number;
  variant: CnLandingVariant;
}) {
  const Icon = ICONS[feature.icon] ?? Sparkles;
  const isEnterprise = variant === 'enterprise';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: hoverEase }}
      whileHover={{ y: -8, transition: { duration: 0.28, ease: hoverEase } }}
      className="group relative h-full cursor-default"
    >
      <div
        className={`relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-500 ${
          isEnterprise
            ? 'group-hover:border-slate-400/45 group-hover:bg-card/90 group-hover:shadow-[0_12px_40px_-12px_rgba(100,116,139,0.35)]'
            : 'group-hover:border-amber-400/45 group-hover:bg-card/90 group-hover:shadow-[0_12px_40px_-12px_rgba(245,158,11,0.28)]'
        }`}
      >
        <div
          className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl transition-opacity duration-500 opacity-0 group-hover:opacity-100 ${
            isEnterprise ? 'bg-slate-400/25' : 'bg-amber-400/30'
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100 ${
            isEnterprise
              ? 'bg-gradient-to-r from-transparent via-slate-400/70 to-transparent'
              : 'bg-gradient-to-r from-transparent via-amber-500/80 to-transparent'
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${
            isEnterprise
              ? 'bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.08),transparent_55%)]'
              : 'bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.1),transparent_55%)]'
          }`}
        />

        <motion.div
          className={`relative mb-4 inline-flex rounded-xl p-2.5 transition-colors duration-300 ${
            isEnterprise
              ? 'bg-muted/60 group-hover:bg-slate-500/15'
              : 'bg-muted/60 group-hover:bg-amber-500/15'
          }`}
          whileHover={{ scale: 1.12, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
        >
          <Icon
            className={`h-5 w-5 transition-colors duration-300 ${
              isEnterprise
                ? 'text-foreground group-hover:text-slate-700 dark:group-hover:text-slate-200'
                : 'text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-300'
            }`}
            strokeWidth={1.75}
          />
        </motion.div>

        <h3 className="relative text-base font-semibold transition-transform duration-300 group-hover:translate-x-0.5">
          {feature.title}
        </h3>
        <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground transition-[color,opacity] duration-300 group-hover:text-foreground/75">
          {feature.description}
        </p>

        <motion.span
          className={`absolute right-4 top-4 text-xs font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
            isEnterprise ? 'text-slate-500' : 'text-amber-600/80 dark:text-amber-400/80'
          }`}
          initial={false}
          aria-hidden
        >
          ✦
        </motion.span>
      </div>
    </motion.div>
  );
}

export function CnLandingPage({ variant }: CnLandingPageProps) {
  const content = getCnLandingContent(variant);
  const titleLines = content.title.split('\n');
  const isEnterprise = variant === 'enterprise';

  return (
    <main className="min-h-dvh bg-background text-foreground overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <img
          src="/dobby-brandmark-bg.svg?v=3"
          alt=""
          className="absolute left-1/2 top-[-8%] w-[130vw] min-w-[720px] max-w-none -translate-x-1/2 opacity-[0.07] dark:opacity-[0.12] invert dark:invert-0 select-none"
          draggable={false}
        />
        <div
          className={`absolute inset-0 ${
            isEnterprise
              ? 'bg-gradient-to-b from-slate-500/[0.04] via-transparent to-transparent'
              : 'bg-gradient-to-b from-amber-500/[0.05] via-transparent to-transparent'
          }`}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-28 md:pt-32">
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <DobbyLogo size={22} variant="logomark" />
            <span className="text-sm font-medium text-muted-foreground">Dobby</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/cn/consumer" className={variant === 'consumer' ? 'text-foreground font-medium' : 'hover:text-foreground'}>
              个人
            </Link>
            <span className="opacity-40">|</span>
            <Link href="/cn/enterprise" className={variant === 'enterprise' ? 'text-foreground font-medium' : 'hover:text-foreground'}>
              企业
            </Link>
          </div>
        </motion.div>

        <motion.section {...fadeUp} transition={{ duration: 0.55, delay: 0.05 }} className="max-w-3xl">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium tracking-wide ${
              isEnterprise
                ? 'border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-600/50 dark:text-slate-200'
                : 'border-amber-300/60 bg-amber-500/10 text-amber-900 dark:border-amber-700/50 dark:text-amber-100'
            }`}
          >
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
        </motion.section>

        <motion.section {...fadeUp} transition={{ duration: 0.55, delay: 0.12 }} className="mt-20 md:mt-28">
          <div className="relative inline-block">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{content.featuresTitle}</h2>
            <motion.span
              className={`absolute -bottom-2 left-0 block h-0.5 rounded-full ${
                isEnterprise ? 'bg-slate-400/60' : 'bg-amber-500/70'
              }`}
              initial={{ width: 0 }}
              whileInView={{ width: '100%' }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15, ease: hoverEase }}
            />
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {content.features.map((feature, index) => (
              <CnFeatureCard key={feature.title} feature={feature} index={index} variant={variant} />
            ))}
          </div>
        </motion.section>

        <motion.section {...fadeUp} transition={{ duration: 0.55, delay: 0.16 }} className="mt-20 md:mt-28">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{content.comparisonTitle}</h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">{content.comparisonSubtitle}</p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border/60">
            <div className="grid grid-cols-[1fr_1fr_1fr] bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:px-6 md:text-sm">
              <span>维度</span>
              <span>Dobby</span>
              <span>OpenClaw</span>
            </div>
            {content.comparisonRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_1fr_1fr] border-t border-border/50 px-4 py-4 text-sm md:px-6"
              >
                <span className="font-medium text-foreground/90">{row.label}</span>
                <span className="text-foreground/80">{row.dobby}</span>
                <span className="text-muted-foreground">{row.openClaw}</span>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          {...fadeUp}
          transition={{ duration: 0.55, delay: 0.2 }}
          className={`mt-20 rounded-3xl border p-8 md:mt-28 md:p-12 ${
            isEnterprise
              ? 'border-slate-300/50 bg-slate-500/[0.06] dark:border-slate-700/50'
              : 'border-amber-300/40 bg-amber-500/[0.06] dark:border-amber-800/40'
          }`}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{content.closingTitle}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{content.closingBody}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  支持 Claude、GPT、Kimi 等主流模型
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  Dobby Computer 实时查看执行过程
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  {isEnterprise ? '企业试点可从少数 Worker 开始扩展' : '微信 / Telegram 多入口同一账户'}
                </li>
              </ul>
            </div>
            <Button asChild size="lg" className="h-12 shrink-0 rounded-xl px-8">
              <Link href={content.primaryCta.href}>{content.primaryCta.label}</Link>
            </Button>
          </div>
        </motion.section>

        <footer className="mt-16 border-t border-border/40 pt-8 text-center text-xs text-muted-foreground md:text-left">
          <p>© {new Date().getFullYear()} Dobby. 保留所有权利。</p>
          <div className="mt-2 flex flex-wrap justify-center gap-4 md:justify-start">
            <Link href="/pricing" className="hover:text-foreground">
              定价
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
    </main>
  );
}
