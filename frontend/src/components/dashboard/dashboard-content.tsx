"use client";
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter, useParams } from 'next/navigation';
import { Menu } from "lucide-react";
import { ChatInput, ChatInputHandles } from '@/components/thread/chat-input';
import { initiateAgent, createThread, addUserMessage, startAgent, createProject, BillingError } from "@/lib/api";
import { generateThreadName } from "@/lib/actions/threads";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBillingError } from "@/hooks/useBillingError";
import { BillingErrorAlert } from "@/components/billing/usage-limit-alert";
import { useAccounts } from "@/hooks/use-accounts";
import { isLocalMode, config } from "@/lib/config";
import { toast } from "sonner";

const PENDING_PROMPT_KEY = 'pendingAgentPrompt';

export default function DashboardContent({ dict }: { dict: Record<string, string> }) {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const { billingError, handleBillingError, clearBillingError } = useBillingError();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();
  const { data: accounts } = useAccounts();
  const personalAccount = accounts?.find(account => account.personal_account);
  const chatInputRef = useRef<ChatInputHandles>(null);

  const t = (key: string) => (dict && dict[key]) || key;

  const handleSubmit = async (message: string, options?: { model_name?: string; enable_thinking?: boolean }) => {
    if ((!message.trim() && !(chatInputRef.current?.getPendingFiles().length)) || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const files = chatInputRef.current?.getPendingFiles() || [];
      localStorage.removeItem(PENDING_PROMPT_KEY);
      if (files.length > 0) {
        const formData = new FormData();
        formData.append('message', message);
        files.forEach(file => {
          formData.append('files', file);
        });
        if (options) {
          formData.append('options', JSON.stringify(options));
        }
        const result = await initiateAgent(formData);
        if (result.thread_id) {
          router.push(`/${locale}/agents/${result.thread_id}`);
        }
      } else {
        const projectName = await generateThreadName(message);
        const newProject = await createProject({ name: projectName, description: "" });
        const thread = await createThread(newProject.id);
        await addUserMessage(thread.thread_id, message);
        await startAgent(thread.thread_id, options);
        router.push(`/${locale}/agents/${thread.thread_id}`);
      }
    } catch (error: any) {
      if (error instanceof BillingError) {
        handleBillingError({
          message: error.detail.message || 'Monthly usage limit reached. Please upgrade your plan.',
          currentUsage: error.detail.currentUsage as number | undefined,
          limit: error.detail.limit as number | undefined,
          subscription: error.detail.subscription || {
            price_id: config.SUBSCRIPTION_TIERS.FREE.priceId,
            plan_name: "Free"
          }
        });
        setIsSubmitting(false);
        return;
      }
      const isConnectionError = error instanceof TypeError && error.message.includes('Failed to fetch');
      if (!isLocalMode() || isConnectionError) {
        toast.error(error.message || "An unexpected error occurred");
      }
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);
      if (pendingPrompt) {
        setInputValue(pendingPrompt);
        setAutoSubmit(true);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (autoSubmit && inputValue && !isSubmitting) {
      const timer = setTimeout(() => {
        handleSubmit(inputValue);
        setAutoSubmit(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoSubmit, inputValue, isSubmitting]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      {isMobile && (
        <div className="absolute top-4 left-4 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8" 
                onClick={() => setOpenMobile(true)}
              >
                <Menu className="h-4 w-4" />
                <span className="sr-only">{t('dashboard.open_menu')}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('dashboard.open_menu_tooltip')}</TooltipContent>
          </Tooltip>
        </div>
      )}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[90%]">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-medium text-foreground mb-2">{t('dashboard.hey')}</h1>
          <h2 className="text-2xl text-muted-foreground">{t('dashboard.what_to_do')}</h2>
        </div>
        <ChatInput 
          ref={chatInputRef}
          onSubmit={handleSubmit} 
          loading={isSubmitting}
          placeholder={t('dashboard.input_placeholder')}
          value={inputValue}
          onChange={setInputValue}
          hideAttachments={false}
        />
      </div>
      <BillingErrorAlert
        message={billingError?.message}
        currentUsage={billingError?.currentUsage}
        limit={billingError?.limit}
        accountId={personalAccount?.account_id}
        onDismiss={clearBillingError}
        isOpen={!!billingError}
      />
    </div>
  );
} 