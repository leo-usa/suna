'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ToolViewProps } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Presentation, 
  Sparkles, 
  Settings, 
  CheckCircle,
  AlertCircle,
  LucideIcon
} from 'lucide-react';
import { ToolViewHeader } from '../shared/ToolViewHeader';
import { ToolViewFooter } from '../shared/ToolViewFooter';

/**
 * Maps tool names to their friendly display mode names and icons
 * All use neutral colors for consistency
 */
const TOOL_MODE_CONFIG: Record<string, { name: string; icon: LucideIcon }> = {
  'sb_presentation_tool': {
    name: 'Presentation Mode',
    icon: Presentation,
  },
  'presentation': {
    name: 'Presentation Mode',
    icon: Presentation,
  },
};

const DEFAULT_MODE_CONFIG = {
  name: 'Tools',
  icon: Settings,
};

/**
 * Formats a tool name into a readable display name
 * e.g., "sb_file_operations" -> "File Operations"
 */
function formatToolName(toolName: string): string {
  return toolName
    .replace(/^sb_/, '') // Remove sb_ prefix
    .replace(/_/g, ' ')  // Replace underscores with spaces
    .replace(/-/g, ' ')  // Replace hyphens with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function parseOutput(output: unknown): Record<string, any> | null {
  if (!output) return null;
  if (typeof output === 'object' && output !== null) return output as Record<string, any>;
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function asToolList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

export function InitializeToolsToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
}: ToolViewProps) {
  const t = useTranslations('toolViews.initializeTools');

  const requestedToolNames = React.useMemo(() => {
    if (!toolCall?.arguments) return [];
    
    const args = toolCall.arguments;
    if (typeof args === 'string') {
      try {
        const parsed = JSON.parse(args);
        return parsed.tool_names ? [parsed.tool_names].flat() : [];
      } catch {
        return [];
      }
    }
    
    if (typeof args === 'object' && args !== null) {
      const toolNamesArg = (args as any).tool_names;
      if (toolNamesArg) {
        return Array.isArray(toolNamesArg) ? toolNamesArg : [toolNamesArg];
      }
    }
    
    return [];
  }, [toolCall?.arguments]);

  const resultOutput = React.useMemo(() => parseOutput(toolResult?.output), [toolResult?.output]);
  const activatedTools = React.useMemo(
    () => asToolList(resultOutput?.activated_tools),
    [resultOutput],
  );
  const failedTools = React.useMemo(
    () => asToolList(resultOutput?.failed_tools),
    [resultOutput],
  );

  const actualSuccess = toolResult?.success !== undefined ? toolResult.success : isSuccess;
  const showFailure = !isStreaming && !actualSuccess;

  // While streaming, show requested tools; after completion prefer real activation results.
  const displayTools = React.useMemo(() => {
    if (isStreaming) return requestedToolNames;
    if (activatedTools.length > 0 || failedTools.length > 0) {
      return [...activatedTools, ...failedTools];
    }
    return requestedToolNames;
  }, [isStreaming, requestedToolNames, activatedTools, failedTools]);

  const modeConfig = React.useMemo(() => {
    const namesForMode = displayTools.length > 0 ? displayTools : requestedToolNames;
    for (const toolName of namesForMode) {
      const normalizedName = toolName.toLowerCase().replace(/-/g, '_');
      if (TOOL_MODE_CONFIG[normalizedName]) {
        return TOOL_MODE_CONFIG[normalizedName];
      }
      for (const [key, config] of Object.entries(TOOL_MODE_CONFIG)) {
        if (normalizedName.includes(key) || key.includes(normalizedName)) {
          return config;
        }
      }
    }
    return DEFAULT_MODE_CONFIG;
  }, [displayTools, requestedToolNames]);

  const Icon = modeConfig.icon;
  const modeName = modeConfig.name === 'Presentation Mode' ? t('presentationMode') : t('tools');
  const failureMessage =
    (typeof resultOutput?.message === 'string' && resultOutput.message) ||
    (typeof toolResult?.error === 'string' && toolResult.error) ||
    (typeof toolResult?.output === 'string' ? toolResult.output : '') ||
    '';

  const title = isStreaming
    ? t('activating', { mode: modeName })
    : showFailure
      ? t('activationFailed', { mode: modeName })
      : t('activated', { mode: modeName });

  const heading = isStreaming
    ? t('activating', { mode: modeName })
    : showFailure
      ? t('modeFailed', { mode: modeName })
      : t('modeReady', { mode: modeName });

  const subtitle = isStreaming
    ? t('preparing')
    : showFailure
      ? t('toolsFailed', { count: failedTools.length || requestedToolNames.length || 1 })
      : t('toolsActivated', { count: activatedTools.length || displayTools.length });

  return (
    <Card className="gap-0 flex border-0 shadow-none p-0 py-0 rounded-none flex-col h-full overflow-hidden bg-card">
      <ToolViewHeader icon={Icon} title={title} />

      <CardContent className="p-0 h-full flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-white dark:bg-zinc-950" />
        
        <div className="relative flex flex-col items-center justify-center h-full py-10 px-6">
          <div className={`relative w-12 h-12 mb-4 ${isStreaming ? 'animate-pulse' : ''}`}>
            <div className="absolute inset-0 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
              {isStreaming ? (
                <Sparkles className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
              ) : showFailure ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
              )}
            </div>
          </div>

          <h3 className="text-base font-medium mb-1 text-zinc-900 dark:text-zinc-100 tracking-tight">
            {heading}
          </h3>
          
          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mb-4 font-mono">
            {subtitle}
          </p>

          {showFailure && failureMessage && (
            <p className="text-xs text-destructive/90 text-center mb-4 max-w-md whitespace-pre-wrap">
              {failureMessage}
            </p>
          )}

          {displayTools.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
              {displayTools.map((tool, index) => {
                const failed = !isStreaming && failedTools.includes(tool);
                const activated = !isStreaming && activatedTools.includes(tool);
                return (
                  <div
                    key={tool}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono
                      transition-all duration-300 ease-out
                      border
                      ${failed
                        ? 'bg-destructive/10 text-destructive border-destructive/30'
                        : activated || isStreaming
                          ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'}
                    `}
                    style={{
                      animation: !isStreaming ? `fadeSlideIn 0.3s ease-out ${index * 0.05}s both` : undefined,
                    }}
                  >
                    <span className={failed ? 'text-destructive/60' : 'text-zinc-400 dark:text-zinc-600'}>›</span>
                    <span>{formatToolName(tool)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <style jsx>{`
          @keyframes fadeSlideIn {
            from {
              opacity: 0;
              transform: translateY(4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </CardContent>

      <ToolViewFooter
        assistantTimestamp={assistantTimestamp}
        toolTimestamp={toolTimestamp}
        isStreaming={isStreaming}
      >
        {!isStreaming && (
          <Badge
            variant="outline"
            className={`h-5 py-0 px-2 ${
              showFailure
                ? 'bg-destructive/10 border-destructive/30'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <span
              className={`text-[10px] font-mono uppercase tracking-wider ${
                showFailure
                  ? 'text-destructive'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {showFailure ? t('failed') : t('ready')}
            </span>
          </Badge>
        )}
      </ToolViewFooter>
    </Card>
  );
}
