'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { useTranslations } from 'next-intl';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAccountState } from '@/hooks/billing';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function UsageLimitsCard() {
  const t = useTranslations('dashboard');
  const { data: accountState, isLoading } = useAccountState();
  const limits = accountState?.limits;
  const UNLIMITED_THRESHOLD = 100_000;

  const formatMax = (max: number | undefined) => {
    const value = max || 0;
    return value >= UNLIMITED_THRESHOLD ? t('usageUnlimited') : value;
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{t('usageLimits')}</CardTitle>
          <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm">
            {t('usageLimitsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
                <div className="h-2 w-full bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">{t('usageLimits')}</CardTitle>
        <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm">
          {t('usageLimitsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="space-y-4">
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-between text-sm cursor-help">
                    <span className="text-muted-foreground">{t('usageRowChats')}</span>
                    <span className="font-medium">
                      {limits?.threads?.current || 0} / {formatMax(limits?.threads?.max)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t('usageRowChatsTip')}</p>
                </TooltipContent>
              </Tooltip>
              <Progress 
                className="h-2"
                value={
                  (limits?.threads?.max || 0) >= UNLIMITED_THRESHOLD
                    ? 0
                    : ((limits?.threads?.current || 0) / (limits?.threads?.max || 1)) * 100
                }
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-between text-sm cursor-help">
                    <span className="text-muted-foreground">{t('usageRowConcurrentRuns')}</span>
                    <span className="font-medium">{limits?.concurrent_runs?.running_count || 0} / {limits?.concurrent_runs?.limit || 0}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t('usageRowConcurrentRunsTip')}</p>
                </TooltipContent>
              </Tooltip>
              <Progress 
                className="h-2"
                value={((limits?.concurrent_runs?.running_count || 0) / (limits?.concurrent_runs?.limit || 1)) * 100} 
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-between text-sm cursor-help">
                    <span className="text-muted-foreground">{t('usageRowCustomWorkers')}</span>
                    <span className="font-medium">{limits?.ai_worker_count?.current_count || 0} / {limits?.ai_worker_count?.limit || 0}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t('usageRowCustomWorkersTip')}</p>
                </TooltipContent>
              </Tooltip>
              <Progress 
                className="h-2"
                value={((limits?.ai_worker_count?.current_count || 0) / (limits?.ai_worker_count?.limit || 1)) * 100} 
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-between text-sm cursor-help">
                    <span className="text-muted-foreground">{t('usageRowIntegrations')}</span>
                    <span className="font-medium">{limits?.custom_mcp_count?.current_count || 0} / {limits?.custom_mcp_count?.limit || 0}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t('usageRowIntegrationsTip')}</p>
                </TooltipContent>
              </Tooltip>
              <Progress 
                className="h-2"
                value={((limits?.custom_mcp_count?.current_count || 0) / (limits?.custom_mcp_count?.limit || 1)) * 100} 
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-between text-sm cursor-help">
                    <span className="text-muted-foreground">{t('usageRowScheduledTriggers')}</span>
                    <span className="font-medium">{limits?.trigger_count?.scheduled?.current_count || 0} / {limits?.trigger_count?.scheduled?.limit || 0}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t('usageRowScheduledTriggersTip')}</p>
                </TooltipContent>
              </Tooltip>
              <Progress 
                className="h-2"
                value={((limits?.trigger_count?.scheduled?.current_count || 0) / (limits?.trigger_count?.scheduled?.limit || 1)) * 100} 
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-between text-sm cursor-help">
                    <span className="text-muted-foreground">{t('usageRowAppTriggers')}</span>
                    <span className="font-medium">{limits?.trigger_count?.app?.current_count || 0} / {limits?.trigger_count?.app?.limit || 0}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t('usageRowAppTriggersTip')}</p>
                </TooltipContent>
              </Tooltip>
              <Progress 
                className="h-2"
                value={((limits?.trigger_count?.app?.current_count || 0) / (limits?.trigger_count?.app?.limit || 1)) * 100} 
              />
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
