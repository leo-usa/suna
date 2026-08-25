'use client';

import { useEffect, useState } from 'react';
import { Monitor, Bell, Keyboard, Zap, MousePointerClick, ShieldAlert, Settings2, MessageCircle, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { SimpleFooter } from '@/components/home/simple-footer';
import { DobbyLogo } from '@/components/sidebar/dobby-logo';
import { DESKTOP_DOWNLOAD_LINKS } from '@/lib/desktop-download';
// import { detectDesktopPlatform, type DesktopPlatform } from '@/lib/desktop-download';

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

const FEATURE_KEYS = ['local', 'handoff', 'native', 'shortcuts', 'fast'] as const;
const FEATURE_ICONS = {
  local: MousePointerClick,
  handoff: Monitor,
  native: Bell,
  shortcuts: Keyboard,
  fast: Zap,
} as const;

const OPEN_STEPS = ['1', '2', '3', '4'] as const;
const LOCAL_STEPS = ['1', '2', '3', '4'] as const;
const PERMISSION_KEYS = ['screen', 'accessibility', 'files', 'automation'] as const;
const HOST_TOOL_KEYS = ['python', 'packages', 'cloud'] as const;

function DownloadButton({
  href,
  label,
  sublabel,
  icon,
}: {
  href: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="flex-1 min-w-[140px] h-12 bg-black dark:bg-white rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
    >
      {icon}
      <span className="flex flex-col items-start">
        <span className="text-[10px] text-white/70 dark:text-black/70 leading-none">{sublabel}</span>
        <span className="text-sm font-semibold text-white dark:text-black leading-tight">{label}</span>
      </span>
    </a>
  );
}

export default function DesktopDownloadPage() {
  const t = useTranslations('downloadPage');
  const tBanners = useTranslations('announcements.appBanners');
  const [mounted, setMounted] = useState(false);
  // const [platform, setPlatform] = useState<DesktopPlatform>('mac');

  useEffect(() => {
    setMounted(true);
    // setPlatform(detectDesktopPlatform());
  }, []);

  if (!mounted) {
    return null;
  }

  const primaryHref = DESKTOP_DOWNLOAD_LINKS.macArm;
  // Windows installer — enable when build is published:
  // platform === 'windows' ? DESKTOP_DOWNLOAD_LINKS.windows : DESKTOP_DOWNLOAD_LINKS.macArm;

  return (
    <main className="w-full min-h-screen bg-background relative flex flex-col">
      <motion.div
        className="relative z-10 flex-1 max-w-4xl mx-auto px-6 md:px-10 py-16 md:pt-28"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center mb-12"
        >
          <motion.div className="relative mb-6 z-10">
            <div className="relative w-20 h-20 bg-foreground rounded-[20px] flex items-center justify-center">
              <DobbyLogo size={48} className="invert dark:invert-0" />
            </div>
          </motion.div>

          <h1 className="text-2xl md:text-3xl font-semibold text-foreground text-center tracking-tight mb-3">
            {t('title')}
          </h1>
          <p className="text-base text-muted-foreground text-center max-w-xl leading-relaxed">
            {t('subtitleMac')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center mb-16"
        >
          <div className="relative bg-white dark:bg-[#2a2a2a] rounded-3xl overflow-hidden border border-border/60 dark:border-[#232324] w-full max-w-md">
            <div className="relative h-32 bg-muted dark:bg-[#e8e4df] flex items-center justify-center">
              <div className="w-[200px] h-16 bg-background dark:bg-white rounded-xl p-2 flex items-center justify-center border border-border/40 dark:border-transparent shadow-sm">
                <div className="w-10 h-10 bg-foreground dark:bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                  <DobbyLogo size={28} className="invert dark:invert-0" />
                </div>
              </div>
            </div>

            <div className="p-6 bg-muted/30 dark:bg-[#161618]">
              <h2 className="text-foreground dark:text-white text-sm font-medium mb-1 text-center">
                {t('downloadHeading')}
              </h2>
              <p className="text-muted-foreground dark:text-white/60 text-xs text-center mb-5">
                {t('downloadHint')}
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                <DownloadButton
                  href={primaryHref}
                  sublabel={tBanners('downloadFor')}
                  label={tBanners('platformMacM')}
                  icon={<AppleLogo className="h-5 w-5 text-white dark:text-black" />}
                />
              </div>

              {/* Windows download — uncomment when installer is ready
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                <DownloadButton
                  href={DESKTOP_DOWNLOAD_LINKS.windows}
                  sublabel={tBanners('downloadFor')}
                  label={tBanners('platformWindows')}
                  icon={<Monitor className="h-5 w-5 text-white dark:text-black" />}
                />
              </div>
              */}

              {DESKTOP_DOWNLOAD_LINKS.macIntel && (
                <p className="mt-4 text-center">
                  <a
                    href={DESKTOP_DOWNLOAD_LINKS.macIntel}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {tBanners('intelMacLink')}
                  </a>
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          <h2 className="text-2xl md:text-3xl font-medium text-foreground mb-12">{t('featuresTitle')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
            {FEATURE_KEYS.map((key, index) => {
              const Icon = FEATURE_ICONS[key];
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + index * 0.08, duration: 0.5 }}
                  className="flex flex-col"
                >
                  <div className="w-10 h-10 bg-foreground/10 dark:bg-foreground/5 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-3">{t(`features.${key}.title`)}</h3>
                  <p className="text-muted-foreground text-base leading-relaxed">
                    {t(`features.${key}.description`)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full mt-20 md:mt-24"
        >
          <h2 className="text-2xl md:text-3xl font-medium text-foreground mb-12">{t('setupTitle')}</h2>

          <div className="space-y-14">
            <section>
              <div className="w-10 h-10 bg-foreground/10 dark:bg-foreground/5 rounded-xl flex items-center justify-center mb-4">
                <ShieldAlert className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-3">{t('openUnsigned.title')}</h3>
              <p className="text-muted-foreground text-base leading-relaxed mb-6">{t('openUnsigned.intro')}</p>
              <ol className="space-y-4">
                {OPEN_STEPS.map((step) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-foreground/10 text-sm font-medium flex items-center justify-center text-foreground">
                      {step}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-muted-foreground text-base leading-relaxed">
                        {t(`openUnsigned.steps.${step}`)}
                      </p>
                      {step === '2' && (
                        <pre className="mt-3 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 font-mono text-sm text-foreground whitespace-pre-wrap">
                          {t('openUnsigned.command')}
                        </pre>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <div className="w-10 h-10 bg-foreground/10 dark:bg-foreground/5 rounded-xl flex items-center justify-center mb-4">
                <MousePointerClick className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-3">{t('localSetup.title')}</h3>
              <p className="text-muted-foreground text-base leading-relaxed mb-6">{t('localSetup.intro')}</p>
              <ol className="space-y-4">
                {LOCAL_STEPS.map((step) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-foreground/10 text-sm font-medium flex items-center justify-center text-foreground">
                      {step}
                    </span>
                    <p className="text-muted-foreground text-base leading-relaxed pt-0.5">
                      {t(`localSetup.steps.${step}`)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <div className="w-10 h-10 bg-foreground/10 dark:bg-foreground/5 rounded-xl flex items-center justify-center mb-4">
                <Settings2 className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-3">{t('permissions.title')}</h3>
              <p className="text-muted-foreground text-base leading-relaxed mb-6">{t('permissions.intro')}</p>
              <ul className="space-y-3">
                {PERMISSION_KEYS.map((key) => (
                  <li key={key} className="text-muted-foreground text-base leading-relaxed pl-4 border-l-2 border-border">
                    {t(`permissions.${key}`)}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="w-10 h-10 bg-foreground/10 dark:bg-foreground/5 rounded-xl flex items-center justify-center mb-4">
                <MessageCircle className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-3">{t('otherApps.title')}</h3>
              <p className="text-muted-foreground text-base leading-relaxed">{t('otherApps.body')}</p>
            </section>

            <section>
              <div className="w-10 h-10 bg-foreground/10 dark:bg-foreground/5 rounded-xl flex items-center justify-center mb-4">
                <Terminal className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-3">{t('hostTools.title')}</h3>
              <p className="text-muted-foreground text-base leading-relaxed mb-6">{t('hostTools.intro')}</p>
              <ul className="space-y-3">
                {HOST_TOOL_KEYS.map((key) => (
                  <li key={key} className="text-muted-foreground text-base leading-relaxed pl-4 border-l-2 border-border">
                    {t(`hostTools.${key}`)}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </motion.div>
      </motion.div>

      <SimpleFooter />
    </main>
  );
}
