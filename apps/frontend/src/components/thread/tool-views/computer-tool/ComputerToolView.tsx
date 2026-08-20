'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Monitor, AlertTriangle, Code2, ImageIcon } from 'lucide-react';
import { ToolViewProps } from '../types';
import { formatTimestamp, getToolTitle } from '../utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageLoader } from '../shared/ImageLoader';
import { JsonViewer } from '../shared/JsonViewer';
import { ToolViewIconTitle } from '../shared/ToolViewIconTitle';

const COMPUTER_TOOL_TITLE_KEYS = {
  'computer-screenshot': 'toolTitle.computer-screenshot',
  'computer-click': 'toolTitle.computer-click',
  'computer-type': 'toolTitle.computer-type',
  'computer-key': 'toolTitle.computer-key',
  'computer-scroll': 'toolTitle.computer-scroll',
  'computer-open': 'toolTitle.computer-open',
} as const;

type ComputerToolTitleName = keyof typeof COMPUTER_TOOL_TITLE_KEYS;

function isComputerToolTitleName(name: string): name is ComputerToolTitleName {
  return name in COMPUTER_TOOL_TITLE_KEYS;
}

function translateComputerMessage(
  t: (key: string, values?: Record<string, string | number>) => string,
  message: string,
): string {
  if (message === 'Screenshot captured.') return t('screenshotCaptured');
  if (message === 'Typed text.') return t('typedText');
  if (message === 'Typed and submitted.') return t('typedAndSubmitted');
  if (message === 'Scrolled.') return t('scrolled');
  const clicked = message.match(/^Clicked \((-?\d+), (-?\d+)\)\.$/);
  if (clicked) return t('clicked', { x: clicked[1], y: clicked[2] });
  const pressed = message.match(/^Pressed (.+)\.$/);
  if (pressed) return t('pressed', { key: pressed[1] });
  const opened = message.match(/^Opened (.+)\.$/);
  if (opened) return t('opened', { target: opened[1] });
  return message;
}

const MAX_IMAGE_RETRIES = 4;
const IMAGE_RETRY_DELAY_MS = 400;

export function ComputerToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isStreaming = false,
  agentStatus = 'idle',
  viewToggle,
}: ToolViewProps) {
  const t = useTranslations('tools.computerToolView');
  const [showContext, setShowContext] = React.useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRunning = isStreaming || agentStatus === 'running';

  const computed = React.useMemo(() => {
    let screenshotUrl: string | null = null;
    let result: Record<string, any> | null = null;
    if (!toolResult?.output) return { screenshotUrl, result };

    let output = toolResult.output;
    if (typeof output === 'string') {
      try {
        const parsed = JSON.parse(output);
        output = typeof parsed === 'object' && parsed !== null ? parsed : null;
        if (!output) result = { message: parsed };
      } catch {
        result = { message: output };
        output = null;
      }
    }

    if (output && typeof output === 'object') {
      if (output.image_url) screenshotUrl = String(output.image_url).trim().replace(/\?+$/, '');
      result = Object.fromEntries(
        Object.entries(output).filter(([key]) => key !== 'image_url' && key !== '_image_context_data'),
      );
    }
    return { screenshotUrl, result };
  }, [toolResult?.output]);

  React.useEffect(() => {
    if (computed.screenshotUrl) {
      setIsImageLoading(true);
      setImageError(false);
      setRetry(0);
    }
  }, [computed.screenshotUrl]);

  React.useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  // The screenshot is uploaded in the background, so it can land a moment after
  // the tool result arrives. Retry briefly before showing a failure.
  const handleImageError = React.useCallback(() => {
    if (retry >= MAX_IMAGE_RETRIES) {
      setIsImageLoading(false);
      setImageError(true);
      return;
    }
    retryTimer.current = setTimeout(() => setRetry((attempt) => attempt + 1), IMAGE_RETRY_DELAY_MS);
  }, [retry]);

  if (!toolCall) return null;

  const name = toolCall.function_name.replace(/_/g, '-').toLowerCase();
  const toolTitle = isComputerToolTitleName(name)
    ? t(COMPUTER_TOOL_TITLE_KEYS[name])
    : getToolTitle(name);
  const parameters = toolCall.arguments || null;
  const screenshotUrl = computed.screenshotUrl;
  const imageSrc =
    screenshotUrl && retry > 0 && !screenshotUrl.startsWith('data:')
      ? `${screenshotUrl}?retry=${retry}`
      : screenshotUrl;
  const result = computed.result;

  return (
    <Card className="gap-0 flex border-0 shadow-none p-0 py-0 rounded-none flex-col h-full overflow-scroll bg-card">
      <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
        <div className="flex flex-row items-center justify-between">
          <ToolViewIconTitle icon={Monitor} title={t('thisComputer')} subtitle={toolTitle} />
          <div className="flex items-center gap-2">
            {viewToggle}
            {(result || parameters) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowContext(!showContext)}
                className="h-7 w-7 hover:bg-muted rounded-xl"
                title={showContext ? t('showScreenshot') : t('showContext')}
              >
                {showContext ? <ImageIcon className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden relative" style={{ height: 'calc(100vh - 150px)' }}>
        <div className="flex-1 flex h-full items-center overflow-scroll bg-white dark:bg-black">
          {showContext && (result || parameters) ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {parameters && <JsonViewer data={parameters} title="INPUT" defaultExpanded={true} />}
              {result && <JsonViewer data={result} title="OUTPUT" defaultExpanded={true} />}
            </div>
          ) : screenshotUrl ? (
            <div className="flex items-center justify-center w-full h-full min-h-[600px] relative p-4">
              {isImageLoading && !imageError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                  <ImageLoader />
                </div>
              )}
              {imageError ? (
                <div className="text-center text-zinc-500 dark:text-zinc-400">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-medium mb-1">{t('loadFailed')}</p>
                </div>
              ) : (
                <Card className="p-0 overflow-hidden relative border">
                  {screenshotUrl.startsWith('data:') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={screenshotUrl}
                      alt={t('thisComputer')}
                      className="max-w-full max-h-full object-contain"
                      onLoad={() => setIsImageLoading(false)}
                      onError={handleImageError}
                    />
                  ) : (
                    <Image
                      key={imageSrc}
                      src={imageSrc as string}
                      alt={t('thisComputer')}
                      className="max-w-full max-h-full object-contain"
                      width={1920}
                      height={1080}
                      unoptimized
                      priority
                      onLoadingComplete={() => setIsImageLoading(false)}
                      onError={handleImageError}
                    />
                  )}
                </Card>
              )}
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center w-full text-zinc-700 dark:text-zinc-400">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-zinc-100 dark:bg-zinc-800">
                {result?.success === false && !isRunning ? (
                  <AlertTriangle className="h-10 w-10 text-zinc-500" />
                ) : (
                  <Monitor className="h-10 w-10 text-zinc-500" />
                )}
              </div>
              <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
                {isRunning
                  ? t('working')
                  : result?.success === false
                    ? t('failed')
                    : result?.message
                      ? translateComputerMessage(t, String(result.message))
                      : t('completed')}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-md">
                {isRunning
                  ? t('watching')
                  : result?.success === false && result?.message
                    ? translateComputerMessage(t, String(result.message))
                    : ''}
              </p>
            </div>
          )}
        </div>
      </CardContent>

      <div className="px-4 py-2 h-10 bg-zinc-50/90 dark:bg-zinc-900/90 border-t flex justify-between items-center gap-4">
        <Badge className="h-6 py-0.5">
          <Monitor className="h-3 w-3" />
          {toolTitle}
        </Badge>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {toolTimestamp && !isRunning
            ? formatTimestamp(toolTimestamp)
            : assistantTimestamp
              ? formatTimestamp(assistantTimestamp)
              : ''}
        </div>
      </div>
    </Card>
  );
}
