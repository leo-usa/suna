'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModelPricing } from '@/hooks/billing/use-model-pricing';
import { cn } from '@/lib/utils';

function formatUsdPerMillion(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

interface ModelPricingTableProps {
  className?: string;
  compact?: boolean;
}

export function ModelPricingTable({ className, compact = false }: ModelPricingTableProps) {
  const t = useTranslations('billing.modelPricing');
  const { data, isLoading, error, refetch } = useModelPricing();

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !data?.models?.length) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="max-w-sm text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{t('error')}</p>
          <Button onClick={() => refetch()} size="sm" variant="outline">
            {t('tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm text-muted-foreground leading-relaxed">{t('description')}</p>

      <div
        className={cn(
          'border border-border rounded-lg overflow-hidden bg-card',
          compact && 'max-h-[420px] overflow-y-auto'
        )}
      >
        <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-4 py-3 border-b border-border">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-4 sm:col-span-3">{t('model')}</div>
            <div className="col-span-2 sm:col-span-3 text-center">{t('inputCost')}</div>
            <div className="col-span-3 text-center">{t('outputCost')}</div>
            <div className="col-span-3 text-center">{t('cacheReadCost')}</div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {data.models.map((model) => (
            <div
              key={model.id}
              className="px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4 sm:col-span-3 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {model.name}
                  </div>
                  {model.requires_subscription ? (
                    <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0">
                      {t('paid')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                      {t('free')}
                    </Badge>
                  )}
                </div>
                <div className="col-span-2 sm:col-span-3 text-center">
                  <div className="text-sm font-semibold tabular-nums">
                    {formatUsdPerMillion(model.input_cost_per_million_tokens)}
                  </div>
                  <div className="text-[10px] text-muted-foreground hidden sm:block">
                    {t('per1MTokens')}
                  </div>
                </div>
                <div className="col-span-3 text-center">
                  <div className="text-sm font-semibold tabular-nums">
                    {formatUsdPerMillion(model.output_cost_per_million_tokens)}
                  </div>
                  <div className="text-[10px] text-muted-foreground hidden sm:block">
                    {t('per1MTokens')}
                  </div>
                </div>
                <div className="col-span-3 text-center">
                  <div className="text-sm font-semibold tabular-nums">
                    {formatUsdPerMillion(model.cached_read_cost_per_million_tokens)}
                  </div>
                  <div className="text-[10px] text-muted-foreground hidden sm:block">
                    {t('per1MTokens')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t('footnote')}</p>
    </div>
  );
}
