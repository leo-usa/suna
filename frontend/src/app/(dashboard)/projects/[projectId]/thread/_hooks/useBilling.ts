import { useCallback, useEffect, useRef, useState } from 'react';
import { isLocalMode } from '@/lib/config';
import { useBillingStatusQuery } from '@/hooks/react-query/threads/use-billing-status';
import { BillingData, AgentStatus } from '../_types';
import { useTranslation } from 'react-i18next';

interface UseBillingReturn {
  showBillingAlert: boolean;
  setShowBillingAlert: React.Dispatch<React.SetStateAction<boolean>>;
  billingData: BillingData;
  setBillingData: React.Dispatch<React.SetStateAction<BillingData>>;
  checkBillingLimits: () => Promise<boolean>;
  billingStatusQuery: ReturnType<typeof useBillingStatusQuery>;
}

export function useBilling(
  projectAccountId: string | null | undefined,
  agentStatus: AgentStatus,
  initialLoadCompleted: boolean
): UseBillingReturn {
  const [showBillingAlert, setShowBillingAlert] = useState(false);
  const [billingData, setBillingData] = useState<BillingData>({});
  const previousAgentStatus = useRef<AgentStatus>('idle');
  const billingStatusQuery = useBillingStatusQuery();
  const { t } = useTranslation();

  const checkBillingLimits = useCallback(async () => {
    if (isLocalMode()) {
      console.log(
        'Running in local development mode - billing checks are disabled',
      );
      return false;
    }

    try {
      const { data: result } = await billingStatusQuery.refetch();

      if (result && !result.can_run) {
        const sub = result.subscription as { monthly_limit?: number; overage_amount?: number; insufficient_credits?: boolean } | undefined;
        setBillingData({
          currentUsage: result.subscription?.minutes_limit || 0,
          limit: result.subscription?.minutes_limit || 0,
          message: result.message || t('billing.usageLimitReached', 'Usage limit reached'),
          accountId: projectAccountId || null,
          monthlyLimit: sub?.monthly_limit,
          overageAmount: sub?.overage_amount,
          insufficientCredits: sub?.insufficient_credits,
        });
        setShowBillingAlert(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error checking billing status:', err);
      return false;
    }
  }, [projectAccountId, billingStatusQuery, t]);

  useEffect(() => {
    const previousStatus = previousAgentStatus.current;
    if (previousStatus === 'running' && agentStatus === 'idle') {
      checkBillingLimits();
    }
    previousAgentStatus.current = agentStatus;
  }, [agentStatus, checkBillingLimits]);

  useEffect(() => {
    if (projectAccountId && initialLoadCompleted && !billingStatusQuery.data) {
      console.log('Checking billing status on initial load');
      checkBillingLimits();
    }
  }, [projectAccountId, checkBillingLimits, initialLoadCompleted, billingStatusQuery.data]);

  return {
    showBillingAlert,
    setShowBillingAlert,
    billingData,
    setBillingData,
    checkBillingLimits,
    billingStatusQuery,
  };
} 