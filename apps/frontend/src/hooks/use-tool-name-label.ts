import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getUserFriendlyToolName, getCompletedToolName } from '@agentpress/shared/tools';
import { TOOL_TITLES } from '@/components/thread/tool-views/utils';

const ELAPSED_SUFFIX = / for (?:(\d+(?:\.\d+)?) seconds|(\d+)ms)$/;

const TITLE_KEYS = new Map<string, string>();
for (const [toolName, title] of Object.entries(TOOL_TITLES)) {
  if (!TITLE_KEYS.has(title)) TITLE_KEYS.set(title, toolName.replace(/_/g, '-'));
}

export function useToolTitleLabel() {
  const t = useTranslations('toolTitles');
  return useCallback(
    (title: string) => {
      const key = typeof title === 'string' ? TITLE_KEYS.get(title) : undefined;
      return key && t.has(key) ? t(key) : title;
    },
    [t],
  );
}

export function useToolNameLabel() {
  const t = useTranslations('toolNames');

  const lookup = useCallback(
    (group: 'running' | 'completed', rawToolName: string): string | null => {
      if (!rawToolName) return null;
      const key = `${group}.${rawToolName.replace(/_/g, '-')}`;
      return t.has(key) ? t(key) : null;
    },
    [t],
  );

  const toolLabel = useCallback(
    (rawToolName: string) => lookup('running', rawToolName) ?? getUserFriendlyToolName(rawToolName),
    [lookup],
  );

  const completedToolLabel = useCallback(
    (rawToolName: string) =>
      lookup('completed', rawToolName) ?? lookup('running', rawToolName) ?? getCompletedToolName(rawToolName),
    [lookup],
  );

  // Localizes an English display name produced by the shared tool formatters,
  // leaving custom names (display hints, MCP tools) untouched.
  const localizeDisplayName = useCallback(
    (rawToolName: string, displayName: string) => {
      if (!rawToolName || !displayName) return displayName;
      const elapsed = displayName.match(ELAPSED_SUFFIX);
      const base = elapsed ? displayName.slice(0, elapsed.index) : displayName;
      let label = base;
      if (base === getCompletedToolName(rawToolName)) {
        label = completedToolLabel(rawToolName);
      } else if (base === getUserFriendlyToolName(rawToolName) || base === rawToolName) {
        label = toolLabel(rawToolName);
      }
      if (!elapsed) return label;
      return elapsed[1] !== undefined
        ? t('elapsedSeconds', { name: label, seconds: elapsed[1] })
        : t('elapsedMs', { name: label, ms: elapsed[2] });
    },
    [t, toolLabel, completedToolLabel],
  );

  return useMemo(
    () => ({ t, toolLabel, completedToolLabel, localizeDisplayName }),
    [t, toolLabel, completedToolLabel, localizeDisplayName],
  );
}
