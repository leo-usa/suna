'use client';

import { Zap, Clock, Sparkles, Info, RotateCcw, Infinity } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';

const RESOURCE_USAGE_KEYS = [
  ['aiActivityLabel', 'aiActivityText'],
  ['dobbyComputerLabel', 'dobbyComputerText'],
  ['fileStorageLabel', 'fileStorageText'],
  ['webSearchLabel', 'webSearchText'],
  ['peopleSearchLabel', 'peopleSearchText'],
  ['thirdPartyLabel', 'thirdPartyText'],
] as const;

export default function CreditsPage() {
  const t = useTranslations('billing.creditsExplainedPage');

  return (
    <div className="container mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-8 md:py-12">
      <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <div className="space-y-10">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('understandingCredits.title')}</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-base">
            {t('understandingCredits.description')}
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('howCreditsWork.title')}</h2>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            {t('howCreditsWork.description')}
          </p>

          <Card>
            <CardContent className="pt-6">
              <ul className="space-y-3 text-muted-foreground">
                {RESOURCE_USAGE_KEYS.map(([labelKey, textKey]) => (
                  <li key={labelKey} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">
                        {t(`resourceUsage.${labelKey}`)}
                      </span>{' '}
                      {t(`resourceUsage.${textKey}`)}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-muted-foreground leading-relaxed">{t('afterTaskComplete')}</p>
              </div>
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>{t('refundPolicyAlert')}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('typesOfCredits.title')}</h2>
          </div>

          <p className="text-muted-foreground leading-relaxed">{t('typesOverviewIntro')}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <RotateCcw className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold text-foreground">{t('typeCards.dailyWeeklyTitle')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t('typeCards.dailyWeeklyBody')}</p>
              </CardContent>
            </Card>

            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <h3 className="font-semibold text-foreground">{t('typeCards.monthlyTitle')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t('typeCards.monthlyBody')}</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Infinity className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">{t('typeCards.extraTitle')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t('typeCards.extraBody')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-3">{t('expiringDetailsTitle')}</h3>
              <div className="space-y-3 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{t('expiringDailyWeeklyLabel')}</span>{' '}
                    {t('expiringDailyWeeklyText')}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{t('expiringMonthlyLabel')}</span>{' '}
                    {t('expiringMonthlyText')}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{t('expiringPromotionalLabel')}</span>{' '}
                    {t('expiringPromotionalText')}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="font-semibold text-foreground mb-3">{t('nonExpiringDetailsTitle')}</h3>
              <div className="space-y-3 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{t('nonExpiringTopUpLabel')}</span>{' '}
                    {t('nonExpiringTopUpText')}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{t('nonExpiringPromoGrantsLabel')}</span>{' '}
                    {t('nonExpiringPromoGrantsText')}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{t('nonExpiringFreeLabel')}</span>{' '}
                    {t('nonExpiringFreeText')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Alert className="border-blue-500/20 bg-blue-500/5">
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t.rich('usagePriorityAlertRich', {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
