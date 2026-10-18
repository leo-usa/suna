'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Check, Cloud, Copy, Laptop, Loader2, MessageSquare, Server, Share2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMasterChildStatus } from '@/hooks/master-assistant/use-master-assistant';

export const MASTER_CARD_TOOLS = new Set(['start-conversation', 'send-to-conversation', 'check-conversation']);
export const MASTER_PAGE_TOOL = 'open-dobby-page';
export const MASTER_SWITCH_TOOL = 'switch-conversation';
export const MASTER_SHARE_TOOL = 'share-conversation';

export function parseMasterToolOutput(result: any): Record<string, any> | null {
  if (!result || result.success === false) return null;
  let output = result.output ?? result;
  if (typeof output === 'string') {
    try {
      output = JSON.parse(output);
    } catch {
      return null;
    }
  }
  return output && typeof output === 'object' && !Array.isArray(output) ? output : null;
}

function TargetBadge({ target }: { target?: string }) {
  const t = useTranslations('masterAssistant');
  const Icon = target === 'local' ? Laptop : target === 'dedicated' ? Server : Cloud;
  const label = target === 'local' ? t('targetLocal') : target === 'dedicated' ? t('targetDedicated') : t('targetCloud');
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function StatusLabel({ status }: { status: string }) {
  const t = useTranslations('masterAssistant');
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('statusRunning')}
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Check className="h-3 w-3" />
        {t('statusCompleted')}
      </span>
    );
  }
  if (status === 'failed' || status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <XCircle className="h-3 w-3" />
        {t('statusFailed')}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{t('statusStopped')}</span>;
}

export function MasterConversationCard({ data }: { data: Record<string, any> }) {
  const t = useTranslations('masterAssistant');
  const router = useRouter();
  const { data: live } = useMasterChildStatus(data.thread_id, data.status);
  const status = live?.status || data.status || 'running';
  const path = live?.path || data.path;
  const modelLabel =
    data.model_name === 'dobby/power' ? t('modelAdvanced') : data.model_name === 'dobby/basic' ? t('modelBasic') : data.model_name;

  return (
    <div className="my-2 flex items-center gap-3 rounded-2xl border bg-card p-3 max-w-md">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <MessageSquare className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{data.title || t('untitledTask')}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <TargetBadge target={data.execution_target} />
          {modelLabel && <span className="text-[11px] text-muted-foreground">{modelLabel}</span>}
          <StatusLabel status={status} />
        </div>
      </div>
      {path && (
        <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => router.push(path)}>
          {t('open')}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function MasterPageButton({ data }: { data: Record<string, any> }) {
  const router = useRouter();
  if (!data.path) return null;
  return (
    <div className="my-2">
      <Button size="sm" variant="outline" onClick={() => router.push(data.path)}>
        {data.label || data.page}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function MasterShareLink({ data }: { data: Record<string, any> }) {
  const t = useTranslations('masterAssistant');
  const [copied, setCopied] = React.useState(false);
  if (!data.public || !data.share_url) {
    return <p className="my-2 text-xs text-muted-foreground">{t('shareTurnedOff')}</p>;
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="my-2 flex max-w-md items-center gap-2 rounded-2xl border bg-card p-3">
      <Share2 className="h-4 w-4 flex-shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{data.share_url}</span>
      <Button size="sm" variant="outline" className={cn('flex-shrink-0')} onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? t('copied') : t('copyLink')}
      </Button>
    </div>
  );
}
