import { useTranslations } from 'next-intl';
import { Cloud, CloudOff, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { translateSyncErrorMessage } from './_utils';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'conflict';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  lastSyncedAt: number | null;
  pendingChanges: boolean;
  errorMessage?: string;
  onRefresh?: () => void;
  onResolveConflict?: (keepLocal: boolean) => void;
  className?: string;
}

function formatRelativeTime(timestamp: number, t: ReturnType<typeof useTranslations>): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return t('justNow');
  if (seconds < 60) return t('secondsAgo', { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  return new Date(timestamp).toLocaleDateString();
}

export function SyncStatusIndicator({
  status,
  lastSyncedAt,
  pendingChanges,
  errorMessage,
  onRefresh,
  onResolveConflict,
  className,
}: SyncStatusIndicatorProps) {
  const t = useTranslations('toolViews.spreadsheet');
  const getStatusConfig = () => {
    // All status indicators use consistent gray styling
    const grayStyle = { color: 'text-zinc-500', bgColor: 'bg-zinc-500/10' };
    
    switch (status) {
      case 'syncing':
        return {
          icon: <DobbyLoader customSize={14} />,
          label: t('saving'),
          ...grayStyle,
        };
      case 'synced':
        return {
          icon: <Check className="w-3.5 h-3.5" />,
          label: lastSyncedAt ? t('savedAt', { time: formatRelativeTime(lastSyncedAt, t) }) : t('saved'),
          ...grayStyle,
        };
      case 'offline':
        return {
          icon: <CloudOff className="w-3.5 h-3.5" />,
          label: pendingChanges ? t('offlineChangesPending') : t('offline'),
          ...grayStyle,
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          label: errorMessage ? translateSyncErrorMessage(errorMessage, t) : t('saveFailed'),
          ...grayStyle,
        };
      case 'conflict':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          label: t('externalChangesDetected'),
          ...grayStyle,
        };
      default:
        return {
          icon: <Cloud className="w-3.5 h-3.5" />,
          label: t('ready'),
          color: 'text-zinc-400',
          bgColor: 'bg-zinc-500/10',
        };
    }
  };

  const config = getStatusConfig();

  if (status === 'conflict') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200',
          config.bgColor,
          config.color
        )}>
          {config.icon}
          <span>{config.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolveConflict?.(false)}
            className="h-6 px-2 text-xs"
          >
            {t('loadExternal')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolveConflict?.(true)}
            className="h-6 px-2 text-xs"
          >
            {t('keepMine')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-default',
            config.bgColor,
            config.color,
            className
          )}>
            {config.icon}
            {(status === 'syncing' || status === 'error' || status === 'offline') && (
              <span className="hidden sm:inline">{config.label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex flex-col gap-1">
            <span>{config.label}</span>
            {pendingChanges && status !== 'syncing' && (
              <span className="text-amber-400">{t('unsavedChanges')}</span>
            )}
            {status === 'error' && onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-6 px-2 text-xs mt-1"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {t('retry')}
              </Button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
