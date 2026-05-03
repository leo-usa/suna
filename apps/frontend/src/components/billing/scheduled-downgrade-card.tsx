'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar,
  ArrowRight,
  Undo2,
  CalendarClock
} from 'lucide-react';
import { useCancelScheduledChange } from '@/hooks/billing';
import { TierBadge } from './tier-badge';
import { siteConfig } from '@/lib/site-config';
import { useLocale, useTranslations } from 'next-intl';

interface ScheduledDowngradeCardProps {
  scheduledChange: {
    current_tier: {
      name: string;
      display_name: string;
      monthly_credits?: number;
    };
    target_tier: {
      name: string;
      display_name: string;
      monthly_credits?: number;
    };
    effective_date: string;
  };
  onCancel?: () => void;
  variant?: 'default' | 'compact';
}

export function ScheduledDowngradeCard({ 
  scheduledChange,
  onCancel,
  variant = 'default'
}: ScheduledDowngradeCardProps) {
  const cancelScheduledChangeMutation = useCancelScheduledChange();
  const t = useTranslations('settings.billing');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const effectiveDate = new Date(scheduledChange.effective_date);

  const getFrontendTierName = (tierKey: string) => {
    const tier = siteConfig.cloudPricingItems.find(p => p.tierKey === tierKey);
    return tier?.name || tierKey || tCommon('basic');
  };

  const currentTierName = getFrontendTierName(scheduledChange.current_tier.name);
  const targetTierName = getFrontendTierName(scheduledChange.target_tier.name);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const daysRemaining = Math.max(0, Math.ceil(
    (effectiveDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));

  const handleCancelChange = () => {
    cancelScheduledChangeMutation.mutate(undefined, {
      onSuccess: () => {
        if (onCancel) {
          onCancel();
        }
      }
    });
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TierBadge planName={currentTierName} size="sm" variant="default" />
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="opacity-60">
              <TierBadge planName={targetTierName} size="sm" variant="default" />
            </span>
            <span className="text-xs text-muted-foreground">
              {t('scheduledChangeEffectiveOn', { date: formatDate(effectiveDate) })}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancelChange}
          disabled={cancelScheduledChangeMutation.isPending}
          className="h-7 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
        >
          <Undo2 className="h-3 w-3 mr-1" />
          {cancelScheduledChangeMutation.isPending ? t('cancelling') : t('scheduledChangeUndo')}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              <span className="font-medium text-sm">{t('scheduledPlanChangeTitle')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <span className="text-xs font-medium">
                {daysRemaining === 0
                  ? t('scheduledChangeToday')
                  : t('scheduledChangeDaysLeft', { days: daysRemaining })}
              </span>
            </div>
          </div>

          {/* Plan Change */}
          <div className="flex items-center gap-3">
            <TierBadge planName={currentTierName} size="md" variant="default" />
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="opacity-60">
              <TierBadge planName={targetTierName} size="md" variant="default" />
            </div>
          </div>
          
          {/* Date and Action */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {formatDate(effectiveDate)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelChange}
              disabled={cancelScheduledChangeMutation.isPending}
              className="h-8 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1.5" />
              {cancelScheduledChangeMutation.isPending ? t('cancelling') : t('keepCurrentPlan')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
