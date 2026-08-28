import { useMemo } from 'react';
import type { UnifiedMessage } from '@/components/thread/types';
import { 
  useAgentStream as useAgentStreamNew,
  type ToolOutputStreamData,
  type AckEvent,
  type EstimateEvent,
  type PrepStageEvent,
  type DegradationEvent,
  type ThinkingEvent,
  type ErrorEvent,
} from '@/lib/streaming';
import { toast } from '@/lib/toast';
import { agentKeys } from '@/hooks/agents/keys';
import { composioKeys } from '@/hooks/composio/keys';
import { knowledgeBaseKeys } from '@/hooks/knowledge-base/keys';
import { fileQueryKeys } from '@/hooks/files/use-file-queries';
import { threadKeys, projectKeys } from '@/hooks/threads/keys';
import { isInsufficientCreditsMessage } from '@agentpress/shared/utils';
import { usePricingModalStore } from '@/stores/pricing-modal-store';
import { useTranslations } from 'next-intl';
import { accountStateKeys } from '@/hooks/billing';
import { clearToolTracking } from './tool-tracking';

export interface UseAgentStreamResult {
  status: string;
  textContent: string;
  reasoningContent: string;
  isReasoningComplete: boolean;
  toolCall: UnifiedMessage | null;
  error: string | null;
  agentRunId: string | null;
  startStreaming: (runId: string) => Promise<void>;
  stopStreaming: () => Promise<void>;
}

export interface AgentStreamCallbacks {
  onMessage: (message: UnifiedMessage) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  onClose?: (finalStatus: string) => void;
  onAssistantStart?: () => void;
  onAssistantChunk?: (chunk: { content: string }) => void;
  onToolCallChunk?: (message: UnifiedMessage) => void;
  onToolOutputStream?: (data: ToolOutputStreamData) => void;
  onAck?: (event: AckEvent) => void;
  onEstimate?: (event: EstimateEvent) => void;
  onPrepStage?: (event: PrepStageEvent) => void;
  onDegradation?: (event: DegradationEvent) => void;
  onThinking?: (event: ThinkingEvent) => void;
  onUXError?: (event: ErrorEvent) => void;
}

export { ToolOutputStreamData, AckEvent, EstimateEvent, PrepStageEvent, DegradationEvent, ThinkingEvent, ErrorEvent };

export function useAgentStream(
  callbacks: AgentStreamCallbacks,
  threadId: string,
  setMessages: (messages: UnifiedMessage[]) => void,
  agentId?: string,
): UseAgentStreamResult {
  const t = useTranslations('billing');

  const queryKeys: (string | readonly string[])[] = useMemo(() => {
    const keys: (string | readonly string[])[] = [
      fileQueryKeys.all,
      ['active-agent-runs'],
      accountStateKeys.all,
      threadKeys.messages(threadId),
      // CRITICAL: Include threads and projects list so sidebar updates after stream completion
      threadKeys.lists(),
      threadKeys.all,
      projectKeys.lists(),
      projectKeys.all,
    ];

    if (agentId) {
      keys.push(
        agentKeys.all,
        agentKeys.detail(agentId),
        agentKeys.lists(),
        agentKeys.details(),
        ['agent-tools', agentId],
        ['agent-tools'],
        ['custom-mcp-tools', agentId],
        ['custom-mcp-tools'],
        composioKeys.mcpServers(),
        composioKeys.profiles.all(),
        composioKeys.profiles.credentials(),
        ['triggers', agentId],
        ['triggers'],
        knowledgeBaseKeys.agent(agentId),
        knowledgeBaseKeys.all,
        ['versions'],
        ['versions', 'list'],
        ['versions', 'list', agentId],
        ['versions', 'detail'],
        ['version-store'],
      );
    }

    return keys;
  }, [threadId, agentId]);

  const handleBillingError = useMemo(() => (errorMessage: string, balance?: string | null) => {
    const isCreditsExhausted = isInsufficientCreditsMessage(errorMessage);

    const alertTitle = isCreditsExhausted
      ? t('limitAlerts.insufficientCredits.title')
      : t('limitAlerts.billingCheck.title');

    const alertSubtitle = balance
      ? isCreditsExhausted
        ? t('limitAlerts.insufficientCredits.subtitleWithBalance', { balance })
        : t('limitAlerts.billingCheck.subtitleWithBalance', { balance })
      : isCreditsExhausted
        ? t('limitAlerts.insufficientCredits.subtitle')
        : t('limitAlerts.billingCheck.subtitle');

    usePricingModalStore.getState().openPricingModal({
      isAlert: true,
      alertTitle,
      alertSubtitle,
    });
  }, [t]);

  const showToast = useMemo(() => (message: string, type?: 'error' | 'success' | 'warning') => {
    if (type === 'error') {
      toast.error(message, { duration: 15000 });
    } else if (type === 'success') {
      toast.success(message);
    } else if (type === 'warning') {
      toast.warning(message);
    } else {
      toast(message);
    }
  }, []);

  const result = useAgentStreamNew(
    callbacks,
    threadId,
    setMessages,
    {
      handleBillingError,
      showToast,
      clearToolTracking,
      queryKeys,
    }
  );

  return {
    status: result.status,
    textContent: result.textContent,
    reasoningContent: result.reasoningContent,
    isReasoningComplete: result.isReasoningComplete,
    toolCall: result.toolCall as UnifiedMessage | null,
    error: result.error,
    agentRunId: result.agentRunId,
    startStreaming: result.startStreaming,
    stopStreaming: result.stopStreaming,
  };
}
