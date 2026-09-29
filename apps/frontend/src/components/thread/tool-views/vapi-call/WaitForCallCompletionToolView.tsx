import React from 'react';
import { useTranslations } from 'next-intl';
import { Phone, Clock, DollarSign, MessageSquare, CheckCircle, AlertTriangle } from 'lucide-react';
import { ToolViewProps } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToolViewIconTitle } from '../shared/ToolViewIconTitle';
import { ToolViewFooter } from '../shared/ToolViewFooter';
import { cn } from '@/lib/utils';
import { extractWaitForCallCompletionData, formatDuration, statusConfig } from './_utils';
import { getToolTitle } from '../utils';

export function WaitForCallCompletionToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
}: ToolViewProps) {
  const t = useTranslations('toolViews.vapiCall');
  // Defensive check - ensure toolCall is defined
  if (!toolCall) {
    console.warn('WaitForCallCompletionToolView: toolCall is undefined. Tool views should use structured props.');
    return null;
  }

  const name = toolCall.function_name.replace(/_/g, '-').toLowerCase();
  const toolTitle = getToolTitle(name);
  const data = extractWaitForCallCompletionData(toolResult);

  if (!data) {
    return <div className="text-sm text-muted-foreground">{t('noCompletionData')}</div>;
  }

  const statusInfo = statusConfig[data.final_status as keyof typeof statusConfig] || statusConfig.completed;

  return (
    <Card className="gap-0 flex border-0 shadow-none p-0 py-0 rounded-none flex-col overflow-hidden bg-card">
      <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
        <div className="flex flex-row items-center justify-between">
          <ToolViewIconTitle icon={CheckCircle} title={toolTitle} />
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">

        <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{t('finalStatus')}</span>
            <Badge className={cn("text-xs", statusInfo.color)}>
              {t(`status.${statusInfo.label.replace(/\s/g, '')}`)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {t('callId')}
              </div>
              <div className="text-xs font-mono text-foreground truncate">
                {data.call_id}
              </div>
            </div>

            {data.duration_seconds !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {t('duration')}
                </div>
                <div className="text-sm font-medium text-foreground">
                  {formatDuration(data.duration_seconds)}
                </div>
              </div>
            )}

            {data.transcript_messages !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  {t('transcriptMessages')}
                </div>
                <div className="text-sm font-medium text-foreground">
                  {t('messageCount', { count: data.transcript_messages })}
                </div>
              </div>
            )}

            {data.cost !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  {t('totalCost')}
                </div>
                <div className="text-sm font-medium text-foreground">
                  ${data.cost.toFixed(4)}
                </div>
              </div>
            )}
          </div>
        </div>

        {data.message && (
          <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border">
            {data.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
