'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PricingSection } from '@/components/home/sections/pricing-section';
import { isLocalMode } from '@/lib/config';
import { createPortalSession, getCreditBalance, createCreditSession, SubscriptionStatus } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubscription } from '@/hooks/react-query';
import Link from 'next/link';
import { OpenInNewWindowIcon } from '@radix-ui/react-icons';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard, Landmark, QrCode } from 'lucide-react';

type Props = {
  accountId: string;
  returnUrl: string;
  defaultTab?: "subscription" | "prepaid";
};

// Mapping from dollar amounts to Stripe price IDs
const CREDIT_PRICE_IDS: Record<number, string> = {
  9: 'price_1RQZVpP2cIDuyWfbF62E3dsi',   // $9 (after service fee: $4.50)
  49: 'price_1RQZVpP2cIDuyWfbgUnmBizh',  // $49 (after service fee: $44.50)
  99: 'price_1RQZVpP2cIDuyWfbcceSm4gM',  // $99 (after service fee: $94.50)
};

// Add price mapping for display
const CREDIT_PRICES: Record<number, string> = {
  9: '$9',
  49: '$49',
  99: '$99',
};

// Inline AliPay and WeChat Pay SVG icons
const AliPayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" width={24} height={24} {...props}><rect width="32" height="32" rx="6" fill="#1677FF"/><path d="M8.5 13.5h15M8.5 18.5h15" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><text x="16" y="24" textAnchor="middle" fontSize="10" fill="#fff" fontFamily="Arial">支付宝</text></svg>
);

const WeChatPayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" width={24} height={24} {...props}><rect width="32" height="32" rx="6" fill="#07C160"/><circle cx="12" cy="16" r="6" fill="#fff"/><circle cx="20" cy="16" r="6" fill="#fff"/><circle cx="12" cy="16" r="1.2" fill="#07C160"/><circle cx="20" cy="16" r="1.2" fill="#07C160"/></svg>
);

export default function AccountBillingStatus({ accountId, returnUrl, defaultTab = "subscription" }: Props) {
  const { session, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [creditBalance, setCreditBalance] = useState<{
    credits_dollars: number;
    credits_minutes: number;
    total_credits_dollars: number;
    conversion_rate: string;
    user_id: string;
  } | null>(null);
  const [isCreditLoading, setIsCreditLoading] = useState(true);
  const { t } = useTranslation();

  const [topUpAmount, setTopUpAmount] = useState(49); // default $49
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat_pay' | 'card'>('alipay');
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  
  const {
    data: subscriptionData,
    isLoading,
    error: subscriptionQueryError,
  } = useSubscription();

  // Load credit balance
  useEffect(() => {
    async function fetchCredits() {
      if (!session) return;
      
      setIsCreditLoading(true);
      try {
        const balance = await getCreditBalance();
        setCreditBalance(balance);
      } catch (err) {
        console.error('Failed to fetch credits:', err);
        setCreditBalance({
          credits_dollars: 0,
          credits_minutes: 0,
          total_credits_dollars: 0,
          conversion_rate: "6 minutes per $1",
          user_id: ""
        });
      } finally {
        setIsCreditLoading(false);
      }
    }

    fetchCredits();
  }, [session]);

  const handleManageSubscription = async () => {
    try {
      setIsManaging(true);
      const { url } = await createPortalSession({ return_url: returnUrl });
      window.location.href = url;
    } catch (err) {
      console.error('Failed to create portal session:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to create portal session',
      );
    } finally {
      setIsManaging(false);
    }
  };

  const handleTopUp = async () => {
    try {
      setIsTopUpLoading(true);
      setTopUpError(null);
      
      const priceId = CREDIT_PRICE_IDS[topUpAmount];
      if (!priceId) {
        throw new Error('Invalid top-up amount');
      }

      const { url } = await createCreditSession({
        price_id: priceId,
        payment_method: paymentMethod,
        success_url: `${window.location.origin}/settings/billing?success=true`,
        cancel_url: `${window.location.origin}/settings/billing?canceled=true`,
        locale: 'en', // TODO: Add i18n support
      });

      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Failed to create credit session:', err);
      setTopUpError(err instanceof Error ? err.message : 'Failed to create credit session');
    } finally {
      setIsTopUpLoading(false);
    }
  };

  // In local development mode, show a simplified component
  if (isLocalMode()) {
    return (
      <div className="rounded-xl border shadow-sm bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">{t('billing.billingStatus', 'Billing Status')}</h2>
        <div className="p-4 mb-4 bg-muted/30 border border-border rounded-lg text-center">
          <p className="text-sm text-muted-foreground">
            {t('billing.localMode', 'Running in local development mode - billing features are disabled')}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {t('billing.noLimits', 'Agent usage limits are not enforced in this environment')}
          </p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading || authLoading) {
    return (
      <div className="rounded-xl border shadow-sm bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">{t('billing.billingStatus', 'Billing Status')}</h2>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  // Show error state
  if (error || subscriptionQueryError) {
    return (
      <div className="rounded-xl border shadow-sm bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">{t('billing.billingStatus', 'Billing Status')}</h2>
        <div className="p-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
          <p className="text-sm text-destructive">
            {t('billing.errorLoading', 'Error loading billing status:')}{' '}
            {error || subscriptionQueryError.message}
          </p>
        </div>
      </div>
    );
  }

  const isPlan = (planId?: string) => {
    return subscriptionData?.plan_name === planId;
  };

  const planName = isPlan('free')
    ? 'Free'
    : isPlan('base')
      ? 'Pro'
      : isPlan('extra')
        ? 'Enterprise'
        : 'Unknown';

  return (
    <div className="rounded-xl border shadow-sm bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">{t('billing.billingStatus', 'Billing Status')}</h2>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="prepaid">Pre-paid Credits</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-4">
          {subscriptionData ? (
            <>
              <div className="mb-6">
                <div className="rounded-lg border bg-background p-4">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-sm font-medium text-foreground/90">
                      Agent Usage This Month
                    </span>
                    <span className="text-sm font-medium text-card-title">
                      ${subscriptionData.current_usage?.toFixed(2) || '0'} /{' '}
                      ${subscriptionData.cost_limit || '0'}
                    </span>
                    <Button variant='outline' asChild className='text-sm'>
                      <Link href="/settings/usage-logs">
                        {t('billing.usageLogs', 'Usage logs')}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Plans Comparison */}
              <PricingSection returnUrl={returnUrl} showTitleAndTabs={false} insideDialog={true} />

              <div className="mt-20"></div>
              {/* Manage Subscription Button */}
              <div className='flex justify-center items-center gap-4'>
                <Button
                  variant="outline"
                  className="border-border hover:bg-muted/50 shadow-sm hover:shadow-md transition-all whitespace-nowrap flex items-center"
                >
                  <Link href="/model-pricing">
                    View Model Pricing <OpenInNewWindowIcon className='w-4 h-4 inline ml-2' />
                  </Link>
                </Button>
                <Button
                  onClick={handleManageSubscription}
                  disabled={isManaging}
                  className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                >
                  {isManaging ? 'Loading...' : 'Manage Subscription'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="rounded-lg border bg-background p-4 gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground/90">
                      Current Plan
                    </span>
                    <span className="text-sm font-medium text-card-title">
                      Free
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground/90">
                      Agent Usage This Month
                    </span>
                    <span className="text-sm font-medium text-card-title">
                      ${subscriptionData?.current_usage?.toFixed(2) || '0'} /{' '}
                      ${subscriptionData?.cost_limit || '0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Plans Comparison */}
              <PricingSection returnUrl={returnUrl} showTitleAndTabs={false} insideDialog={true} />

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => window.open('/model-pricing', '_blank')}
                  variant="outline"
                  className="w-full border-border hover:bg-muted/50 shadow-sm hover:shadow-md transition-all"
                >
                  View Model Pricing
                </Button>
                <Button
                  onClick={handleManageSubscription}
                  disabled={isManaging}
                  className="w-full bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                >
                  {isManaging ? 'Loading...' : 'Manage Subscription'}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="prepaid" className="space-y-4">
          <div className="mb-6">
            <div className="rounded-lg border bg-background p-4">
              <div className="flex justify-between items-center gap-4">
                <span className="text-sm font-medium text-foreground/90">
                  Current Credit Balance
                </span>
                <span className="text-sm font-medium text-card-title">
                  {isCreditLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    `$${creditBalance?.total_credits_dollars.toFixed(2) || '0.00'} (${creditBalance?.conversion_rate || '6 min/$1'})`
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground mb-6">
                            <p>Pre-paid credits allow you to use agents without a subscription.</p>
                <p className="mt-1">Credits are consumed based on your usage and never expire. New purchases use dollar-based credits.</p>
          </div>

          <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6">
            <Label className="mb-2 font-medium">Select Credit Amount</Label>
            <RadioGroup value={topUpAmount.toString()} onValueChange={(value) => setTopUpAmount(Number(value))} className="flex flex-col gap-2 mb-4">
              {[9, 49, 99].map((dollars) => (
                <div key={dollars} className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                  <RadioGroupItem value={String(dollars)} id={`credit-${dollars}`} />
                  <Label htmlFor={`credit-${dollars}`} className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                    ${dollars} (${dollars - 4.50} net after service fee)
                    <span className="text-muted-foreground ml-2">{CREDIT_PRICES[dollars]}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            
            <Label className="mb-2 mt-4 font-medium">Select Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as any)} className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                <RadioGroupItem value="alipay" id="pm-alipay" />
                <Label htmlFor="pm-alipay" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                  <AliPayIcon />
                  AliPay
                </Label>
              </div>
              <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                <RadioGroupItem value="wechat_pay" id="pm-wechat" />
                <Label htmlFor="pm-wechat" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                  <WeChatPayIcon />
                  WeChat Pay
                </Label>
              </div>
              <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                <RadioGroupItem value="card" id="pm-card" />
                <Label htmlFor="pm-card" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Credit/Debit Card
                </Label>
              </div>
            </RadioGroup>
            
            {topUpError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md px-3 py-2 mb-2">
                {topUpError}
              </div>
            )}
            
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setTopUpAmount(49);
                  setPaymentMethod('alipay');
                  setTopUpError(null);
                }}
              >
                Reset
              </Button>
              <Button
                onClick={handleTopUp}
                disabled={isTopUpLoading}
              >
                {isTopUpLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2 inline" /> : null}
                Pay Now
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
