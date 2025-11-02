'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { BillingError } from '@/lib/api';
import { toast } from 'sonner';
import { ChatInput } from '@/components/thread/chat-input/chat-input';
import { useSidebar } from '@/components/ui/sidebar';
import { useAgentStream } from '@/hooks/useAgentStream';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { isLocalMode } from '@/lib/config';
import { ThreadContent } from '@/components/thread/content/ThreadContent';
import { ThreadSkeleton } from '@/components/thread/content/ThreadSkeleton';
import { useAddUserMessageMutation } from '@/hooks/react-query/threads/use-messages';
import { useStartAgentMutation, useStopAgentMutation } from '@/hooks/react-query/threads/use-agent-run';
import { useSubscription } from '@/hooks/react-query/subscriptions/use-subscriptions';
import { SubscriptionStatus } from '@/components/thread/chat-input/_use-model-selection';
import { shareReport } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';



import { UnifiedMessage, ApiMessageType, ToolCallInput, Project } from '../_types';
import { useThreadData, useToolCalls, useBilling, useKeyboardShortcuts } from '../_hooks';
import { ThreadError, UpgradeDialog, ThreadLayout } from '../_components';
import { useVncPreloader } from '@/hooks/useVncPreloader';
import { useThreadAgent } from '@/hooks/react-query/agents/use-agents';

export default function ThreadPage({
  params,
}: {
  params: Promise<{
    projectId: string;
    threadId: string;
  }>;
}) {
  const unwrappedParams = React.use(params);
  const { projectId, threadId } = unwrappedParams;
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();

  // State
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileToView, setFileToView] = useState<string | null>(null);
  const [filePathList, setFilePathList] = useState<string[] | undefined>(undefined);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [initialPanelOpenAttempted, setInitialPanelOpenAttempted] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);

  // Community share state
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityResult, setCommunityResult] = useState<{url: string}|null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const hasInitiallyScrolled = useRef<boolean>(false);
  const initialLayoutAppliedRef = useRef(false);

  // Sidebar
  const { state: leftSidebarState, setOpen: setLeftSidebarOpen } = useSidebar();

  // Custom hooks
  const {
    messages,
    setMessages,
    project,
    sandboxId,
    projectName,
    agentRunId,
    setAgentRunId,
    agentStatus,
    setAgentStatus,
    isLoading,
    error,
    initialLoadCompleted,

    threadQuery,
    messagesQuery,
    projectQuery,
    agentRunsQuery,
  } = useThreadData(threadId, projectId);

  const {
    toolCalls,
    setToolCalls,
    currentToolIndex,
    setCurrentToolIndex,
    isSidePanelOpen,
    setIsSidePanelOpen,
    autoOpenedPanel,
    setAutoOpenedPanel,
    externalNavIndex,
    setExternalNavIndex,
    handleToolClick,
    handleStreamingToolCall,
    toggleSidePanel,
    handleSidePanelNavigate,
    userClosedPanelRef,
  } = useToolCalls(messages, setLeftSidebarOpen, agentStatus);

  const {
    showBillingAlert,
    setShowBillingAlert,
    billingData,
    setBillingData,
    checkBillingLimits,
    billingStatusQuery,
  } = useBilling(project?.account_id, agentStatus, initialLoadCompleted);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    isSidePanelOpen,
    setIsSidePanelOpen,
    leftSidebarState,
    setLeftSidebarOpen,
    userClosedPanelRef,
  });

  const addUserMessageMutation = useAddUserMessageMutation();
  const startAgentMutation = useStartAgentMutation();
  const stopAgentMutation = useStopAgentMutation();
  const { data: threadAgentData } = useThreadAgent(threadId);
  const agent = threadAgentData?.agent;
  const workflowId = threadQuery.data?.metadata?.workflow_id;

  // Set initial selected agent from thread data
  useEffect(() => {
    if (threadAgentData?.agent && !selectedAgentId) {
      setSelectedAgentId(threadAgentData.agent.agent_id);
    }
  }, [threadAgentData, selectedAgentId]);

  const { data: subscriptionData } = useSubscription();
  const subscriptionStatus: SubscriptionStatus = subscriptionData?.status === 'active'
    ? 'active'
    : 'no_subscription';

  // Memoize project for VNC preloader to prevent re-preloading on every render
  const memoizedProject = useMemo(() => project, [project?.id, project?.sandbox?.vnc_preview, project?.sandbox?.pass]);

  useVncPreloader(memoizedProject);


  const handleProjectRenamed = useCallback((newName: string) => {
  }, []);

  const { t } = useTranslation();

  const handleCommunityShare = async () => {
    console.log("Community share clicked");
    if (communityLoading || communityResult) return;

    // Open a new tab immediately. It might be blocked by a popup blocker.
    const newTab = window.open('', '_blank');
          if (!newTab) {
        toast.error(t('communityShare.popupBlocked'));
        return;
      }
      newTab.document.write(t('communityShare.generating'));

    setCommunityLoading(true);
    toast.info(t('communityShare.sharing'));
    try {
      // Autofill title with project name
      const title = projectName || 'My Project';
      
      // Get the first user message as the description
      const firstUserMsg = messages.find(m => m.type === 'user');
      let description = 'Shared from Dobby'; // fallback
      if (firstUserMsg) {
        try {
          // Try to parse the content if it's JSON, otherwise use as-is
          const parsed = JSON.parse(firstUserMsg.content);
          description = parsed.content || firstUserMsg.content;
        } catch {
          description = firstUserMsg.content;
        }
      }
      
      // First, share the report to get HTML content
      const shareResult = await shareReport(projectId);
      console.log('Share result:', shareResult);
      
      if (!shareResult.shared || shareResult.shared.length === 0) {
        throw new Error(t('communityShare.noHtmlFound'));
      }
      
      // Get the first HTML file
      const htmlUrl = shareResult.shared[0].html;
      
      // Create the community post
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error(t('communityShare.noAccessToken'));
      }
      
      const communityResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/community/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          description,
          html_content: `<iframe src="${htmlUrl}" width="100%" height="600" frameborder="0"></iframe>`,
          thumbnail_path: '',
          project_id: projectId
        }),
      });
      
      if (!communityResponse.ok) {
        throw new Error(t('communityShare.failedToShare', { error: communityResponse.statusText }));
      }
      
      const communityResult = await communityResponse.json();
      console.log('Community share result:', communityResult);
      
      // Navigate to the community post
      const postUrl = `${window.location.origin}/community/view/${communityResult.post_id}`;
      newTab.location.href = postUrl;
      
      setCommunityResult({ url: postUrl });
      toast.success(t('communityShare.shared'));
      
    } catch (error) {
      console.error('Community share error:', error);
      toast.error(t('communityShare.error', { error: error instanceof Error ? error.message : 'Unknown error' }));
      newTab.close();
    } finally {
      setCommunityLoading(false);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleNewMessageFromStream = useCallback((message: UnifiedMessage) => {
    console.log(
      `[STREAM HANDLER] Received message: ID=${message.message_id}, Type=${message.type}`,
    );

    if (!message.message_id) {
      console.warn(
        `[STREAM HANDLER] Received message is missing ID: Type=${message.type}, Content=${message.content?.substring(0, 50)}...`,
      );
    }

    setMessages((prev) => {
      const messageExists = prev.some(
        (m) => m.message_id === message.message_id,
      );
      if (messageExists) {
        return prev.map((m) =>
          m.message_id === message.message_id ? message : m,
        );
      } else {
        return [...prev, message];
      }
    });

    if (message.type === 'tool') {
      setAutoOpenedPanel(false);
    }
  }, [setMessages, setAutoOpenedPanel]);

  const handleStreamStatusChange = useCallback((hookStatus: string) => {
    console.log(`[PAGE] Hook status changed: ${hookStatus}`);
    switch (hookStatus) {
      case 'idle':
      case 'completed':
      case 'stopped':
      case 'agent_not_running':
      case 'error':
      case 'failed':
        setAgentStatus('idle');
        setAgentRunId(null);
        setAutoOpenedPanel(false);

        if (
          [
            'completed',
            'stopped',
            'agent_not_running',
            'error',
            'failed',
          ].includes(hookStatus)
        ) {
          scrollToBottom('smooth');
        }
        break;
      case 'connecting':
        setAgentStatus('connecting');
        break;
      case 'streaming':
        setAgentStatus('running');
        break;
    }
  }, [setAgentStatus, setAgentRunId, setAutoOpenedPanel]);

  const handleStreamError = useCallback((errorMessage: string) => {
    console.error(`[PAGE] Stream hook error: ${errorMessage}`);
    
    // Filter out transient connection errors when agent might still be running
    const isTransientError = (
      errorMessage.toLowerCase().includes('too many connections') ||
      (errorMessage.toLowerCase().includes('failed to start stream') && 
       errorMessage.toLowerCase().includes('connection'))
    );
    
    // Don't show notifications for:
    // 1. "not found" errors (already filtered)
    // 2. Transient connection errors (agent may still work)
    if (
      !errorMessage.toLowerCase().includes('not found') &&
      !errorMessage.toLowerCase().includes('agent run is not running') &&
      !isTransientError
    ) {
      toast.error(`Stream Error: ${errorMessage}`);
    } else if (isTransientError) {
      // Log but don't show toast for transient errors
      console.warn(`[PAGE] Suppressed transient stream error (agent may still be running): ${errorMessage}`);
    }
  }, []);

  const handleStreamClose = useCallback(() => {
    console.log(`[PAGE] Stream hook closed with final status: ${agentStatus}`);
  }, [agentStatus]);

  // Agent stream hook
  const {
    status: streamHookStatus,
    textContent: streamingTextContent,
    toolCall: streamingToolCall,
    error: streamError,
    agentRunId: currentHookRunId,
    startStreaming,
    stopStreaming,
  } = useAgentStream(
    {
      onMessage: handleNewMessageFromStream,
      onStatusChange: handleStreamStatusChange,
      onError: handleStreamError,
      onClose: handleStreamClose,
    },
    threadId,
    setMessages,
  );

  const handleSubmitMessage = useCallback(
    async (
      message: string,
      options?: { model_name?: string; enable_thinking?: boolean },
    ) => {
      if (!message.trim()) return;
      setIsSending(true);

      const optimisticUserMessage: UnifiedMessage = {
        message_id: `temp-${Date.now()}`,
        thread_id: threadId,
        type: 'user',
        is_llm_message: false,
        content: message,
        metadata: '{}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUserMessage]);
      setNewMessage('');
      scrollToBottom('smooth');

      try {
        const messagePromise = addUserMessageMutation.mutateAsync({
          threadId,
          message
        });

        const agentPromise = startAgentMutation.mutateAsync({
          threadId,
          options: {
            ...options,
            agent_id: selectedAgentId
          }
        });

        const results = await Promise.allSettled([messagePromise, agentPromise]);

        if (results[0].status === 'rejected') {
          const reason = results[0].reason;
          console.error("Failed to send message:", reason);
          throw new Error(`Failed to send message: ${reason?.message || reason}`);
        }

        if (results[1].status === 'rejected') {
          const error = results[1].reason;
          console.error("Failed to start agent:", error);

          if (error instanceof BillingError) {
            console.log("Caught BillingError:", error.detail);
            setBillingData({
              currentUsage: error.detail.currentUsage as number | undefined,
              limit: error.detail.limit as number | undefined,
              message: error.detail.message || t('billing.monthlyUsageLimitReached', 'Monthly usage limit reached. Please upgrade.'),
              accountId: project?.account_id || null
            });
            setShowBillingAlert(true);

            setMessages(prev => prev.filter(m => m.message_id !== optimisticUserMessage.message_id));
            return;
          }

          throw new Error(`Failed to start agent: ${error?.message || error}`);
        }

        const agentResult = results[1].value;
        setAgentRunId(agentResult.agent_run_id);

        messagesQuery.refetch();
        agentRunsQuery.refetch();

      } catch (err) {
        console.error('Error sending message or starting agent:', err);
        if (!(err instanceof BillingError)) {
          toast.error(err instanceof Error ? err.message : 'Operation failed');
        }
        setMessages((prev) =>
          prev.filter((m) => m.message_id !== optimisticUserMessage.message_id),
        );
      } finally {
        setIsSending(false);
      }
    },
    [threadId, project?.account_id, addUserMessageMutation, startAgentMutation, messagesQuery, agentRunsQuery, setMessages, setBillingData, setShowBillingAlert, setAgentRunId],
  );

  const handleStopAgent = useCallback(async () => {
    console.log(`[PAGE] Requesting agent stop via hook.`);
    setAgentStatus('idle');

    await stopStreaming();

    if (agentRunId) {
      try {
        await stopAgentMutation.mutateAsync(agentRunId);
        agentRunsQuery.refetch();
      } catch (error) {
        console.error('Error stopping agent:', error);
      }
    }
  }, [stopStreaming, agentRunId, stopAgentMutation, agentRunsQuery, setAgentStatus]);

  const handleOpenFileViewer = useCallback((filePath?: string, filePathList?: string[]) => {
    if (filePath) {
      setFileToView(filePath);
    } else {
      setFileToView(null);
    }
    setFilePathList(filePathList);
    setFileViewerOpen(true);
  }, []);

  const toolViewAssistant = useCallback(
    (assistantContent?: string, toolContent?: string) => {
      if (!assistantContent) return null;

      return (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Assistant Message
          </div>
          <div className="rounded-md border bg-muted/50 p-3">
            <div className="text-xs prose prose-xs dark:prose-invert chat-markdown max-w-none">{assistantContent}</div>
          </div>
        </div>
      );
    },
    [],
  );

  const toolViewResult = useCallback(
    (toolContent?: string, isSuccess?: boolean) => {
      if (!toolContent) return null;

      return (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <div className="text-xs font-medium text-muted-foreground">
              Tool Result
            </div>
            <div
              className={`px-2 py-0.5 rounded-full text-xs ${isSuccess
                ? 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300'
                }`}
            >
              {isSuccess ? 'Success' : 'Failed'}
            </div>
          </div>
          <div className="rounded-md border bg-muted/50 p-3">
            <div className="text-xs prose prose-xs dark:prose-invert chat-markdown max-w-none">{toolContent}</div>
          </div>
        </div>
      );
    },
    [],
  );

  // Effects
  useEffect(() => {
    if (!initialLayoutAppliedRef.current) {
      setLeftSidebarOpen(false);
      initialLayoutAppliedRef.current = true;
    }
  }, [setLeftSidebarOpen]);

  useEffect(() => {
    if (initialLoadCompleted && !initialPanelOpenAttempted) {
      setInitialPanelOpenAttempted(true);

      if (toolCalls.length > 0) {
        setIsSidePanelOpen(true);
        setCurrentToolIndex(toolCalls.length - 1);
      } else {
        if (messages.length > 0) {
          setIsSidePanelOpen(true);
        }
      }
    }
  }, [initialPanelOpenAttempted, messages, toolCalls, initialLoadCompleted, setIsSidePanelOpen, setCurrentToolIndex]);

  useEffect(() => {
    if (agentRunId && agentRunId !== currentHookRunId) {
      console.log(
        `[PAGE] Target agentRunId set to ${agentRunId}, initiating stream...`,
      );
      startStreaming(agentRunId);
    }
  }, [agentRunId, startStreaming, currentHookRunId]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const isNewUserMessage = lastMsg?.type === 'user';
    if ((isNewUserMessage || agentStatus === 'running') && !userHasScrolled) {
      scrollToBottom('smooth');
    }
  }, [messages, agentStatus, userHasScrolled]);

  useEffect(() => {
    if (!latestMessageRef.current || messages.length === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollButton(!entry?.isIntersecting),
      { root: messagesContainerRef.current, threshold: 0.1 },
    );
    observer.observe(latestMessageRef.current);
    return () => observer.disconnect();
  }, [messages, streamingTextContent, streamingToolCall]);

  useEffect(() => {
    console.log(`[PAGE] 🔄 Page AgentStatus: ${agentStatus}, Hook Status: ${streamHookStatus}, Target RunID: ${agentRunId || 'none'}, Hook RunID: ${currentHookRunId || 'none'}`);

    if ((streamHookStatus === 'completed' || streamHookStatus === 'stopped' ||
      streamHookStatus === 'agent_not_running' || streamHookStatus === 'error') &&
      (agentStatus === 'running' || agentStatus === 'connecting')) {
      console.log('[PAGE] Detected hook completed but UI still shows running, updating status');
      setAgentStatus('idle');
      setAgentRunId(null);
      setAutoOpenedPanel(false);
    }
  }, [agentStatus, streamHookStatus, agentRunId, currentHookRunId, setAgentStatus, setAgentRunId, setAutoOpenedPanel]);

  // SEO title update
  useEffect(() => {
    if (projectName) {
      document.title = `${projectName} | Dobby`;

      const metaDescription = document.querySelector(
        'meta[name="description"]',
      );
      if (metaDescription) {
        metaDescription.setAttribute(
          'content',
          `${projectName} - Interactive agent conversation powered by Dobby`,
        );
      }

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', `${projectName} | Dobby`);
      }

      const ogDescription = document.querySelector(
        'meta[property="og:description"]',
      );
      if (ogDescription) {
        ogDescription.setAttribute(
          'content',
          `Interactive AI conversation for ${projectName}`,
        );
      }
    }
  }, [projectName]);

  useEffect(() => {
    const debugParam = searchParams.get('debug');
    setDebugMode(debugParam === 'true');
  }, [searchParams]);

  const hasCheckedUpgradeDialog = useRef(false);

  useEffect(() => {
    if (initialLoadCompleted && subscriptionData && !hasCheckedUpgradeDialog.current) {
      hasCheckedUpgradeDialog.current = true;
      const hasSeenUpgradeDialog = localStorage.getItem('suna_upgrade_dialog_displayed');
      const isFreeTier = subscriptionStatus === 'no_subscription';
      
      // Check if user has credits - if they do, don't show upgrade dialog
      const hasCredits = billingStatusQuery.data?.credits && billingStatusQuery.data.credits > 0;
      
      if (!hasSeenUpgradeDialog && isFreeTier && !isLocalMode() && !hasCredits) {
        setShowUpgradeDialog(true);
      }
    }
  }, [subscriptionData, subscriptionStatus, initialLoadCompleted, billingStatusQuery.data]);

  const handleDismissUpgradeDialog = () => {
    setShowUpgradeDialog(false);
    localStorage.setItem('suna_upgrade_dialog_displayed', 'true');
  };

  useEffect(() => {
    if (streamingToolCall) {
      handleStreamingToolCall(streamingToolCall);
    }
  }, [streamingToolCall, handleStreamingToolCall]);

  if (!initialLoadCompleted || isLoading) {
    return <ThreadSkeleton isSidePanelOpen={isSidePanelOpen} />;
  }

  if (error) {
    return (
      <ThreadLayout
        threadId={threadId}
        projectName={projectName}
        projectId={project?.id || ''}
        project={project}
        sandboxId={sandboxId}
        isSidePanelOpen={isSidePanelOpen}
        onToggleSidePanel={toggleSidePanel}
        onViewFiles={handleOpenFileViewer}
        fileViewerOpen={fileViewerOpen}
        setFileViewerOpen={setFileViewerOpen}
        fileToView={fileToView}
        filePathList={filePathList}
        toolCalls={toolCalls}
        messages={messages as ApiMessageType[]}
        externalNavIndex={externalNavIndex}
        agentStatus={agentStatus}
        currentToolIndex={currentToolIndex}
        onSidePanelNavigate={handleSidePanelNavigate}
        onSidePanelClose={() => {
          setIsSidePanelOpen(false);
          userClosedPanelRef.current = true;
          setAutoOpenedPanel(true);
        }}
        renderAssistantMessage={toolViewAssistant}
        renderToolResult={toolViewResult}
        isLoading={!initialLoadCompleted || isLoading}
        showBillingAlert={showBillingAlert}
        billingData={billingData}
        onDismissBilling={() => setShowBillingAlert(false)}
        debugMode={debugMode}
        isMobile={isMobile}
        initialLoadCompleted={initialLoadCompleted}
        agentName={agent && agent.name}
      >
        <ThreadError error={error} />
      </ThreadLayout>
    );
  }

  return (
    <>
      <ThreadLayout
        threadId={threadId}
        projectName={projectName}
        projectId={project?.id || ''}
        project={project}
        sandboxId={sandboxId}
        isSidePanelOpen={isSidePanelOpen}
        onToggleSidePanel={toggleSidePanel}
        onProjectRenamed={handleProjectRenamed}
        onViewFiles={handleOpenFileViewer}
        fileViewerOpen={fileViewerOpen}
        setFileViewerOpen={setFileViewerOpen}
        fileToView={fileToView}
        filePathList={filePathList}
        toolCalls={toolCalls}
        messages={messages as ApiMessageType[]}
        externalNavIndex={externalNavIndex}
        agentStatus={agentStatus}
        currentToolIndex={currentToolIndex}
        onSidePanelNavigate={handleSidePanelNavigate}
        onSidePanelClose={() => {
          setIsSidePanelOpen(false);
          userClosedPanelRef.current = true;
          setAutoOpenedPanel(true);
        }}
        renderAssistantMessage={toolViewAssistant}
        renderToolResult={toolViewResult}
        isLoading={!initialLoadCompleted || isLoading}
        showBillingAlert={showBillingAlert}
        billingData={billingData}
        onDismissBilling={() => setShowBillingAlert(false)}
        debugMode={debugMode}
        isMobile={isMobile}
        initialLoadCompleted={initialLoadCompleted}
        agentName={agent && agent.name}
        rightActions={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCommunityShare}
                  disabled={communityLoading}
                  className="h-9 w-9 cursor-pointer"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
                        <TooltipContent>
            <p>{t('communityShare.tooltip')}</p>
          </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      >
        {/* {workflowId && (
          <div className="px-4 pt-4">
            <WorkflowInfo workflowId={workflowId} />
          </div>
        )} */}

        <ThreadContent
          messages={messages}
          streamingTextContent={streamingTextContent}
          streamingToolCall={streamingToolCall}
          agentStatus={agentStatus}
          handleToolClick={handleToolClick}
          handleOpenFileViewer={handleOpenFileViewer}
          readOnly={false}
          streamHookStatus={streamHookStatus}
          sandboxId={sandboxId}
          project={project}
          debugMode={debugMode}
          agentName={agent && agent.name}
          agentAvatar={agent && agent.avatar}
        />

        <div
          className={cn(
            "fixed bottom-0 z-10 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pt-8 transition-all duration-200 ease-in-out",
            leftSidebarState === 'expanded' ? 'left-[72px] md:left-[256px]' : 'left-[72px]',
            isSidePanelOpen ? 'right-[90%] sm:right-[450px] md:right-[500px] lg:right-[550px] xl:right-[650px]' : 'right-0',
            isMobile ? 'left-0 right-0' : ''
          )}>
          <div className={cn(
            "mx-auto",
            isMobile ? "w-full" : "max-w-3xl"
          )}>
            <ChatInput
              value={newMessage}
              onChange={setNewMessage}
              onSubmit={handleSubmitMessage}
              placeholder={`Describe what you need help with...`}
              loading={isSending}
              disabled={isSending || agentStatus === 'running' || agentStatus === 'connecting'}
              isAgentRunning={agentStatus === 'running' || agentStatus === 'connecting'}
              onStopAgent={handleStopAgent}
              autoFocus={!isLoading}
              onFileBrowse={handleOpenFileViewer}
              sandboxId={sandboxId || undefined}
              messages={messages}
              agentName={agent && agent.name}
              selectedAgentId={selectedAgentId}
              onAgentSelect={setSelectedAgentId}
              toolCalls={toolCalls}
              toolCallIndex={currentToolIndex}
              showToolPreview={!isSidePanelOpen && toolCalls.length > 0}
              onExpandToolPreview={() => {
                setIsSidePanelOpen(true);
                userClosedPanelRef.current = false;
              }}
              defaultShowSnackbar="tokens"
            />
          </div>
        </div>
      </ThreadLayout>

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        onDismiss={handleDismissUpgradeDialog}
      />


    </>
  );
} 