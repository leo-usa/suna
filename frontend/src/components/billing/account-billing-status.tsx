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
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard, Landmark, QrCode } from 'lucide-react';

type Props = {
  accountId: string;
  returnUrl: string;
  defaultTab?: "subscription" | "prepaid";
};

// Mapping from minutes to Stripe price IDs
const CREDIT_PRICE_IDS: Record<number, string> = {
  30: 'price_1RQZVpP2cIDuyWfbF62E3dsi',   // $9 for 30 minutes
  300: 'price_1RQZVpP2cIDuyWfbgUnmBizh',  // $49 for 5 hours
  600: 'price_1RQZVpP2cIDuyWfbcceSm4gM',  // $99 for 10 hours
};

// Add price mapping for display
const CREDIT_PRICES: Record<number, string> = {
  30: '$9',
  300: '$49',
  600: '$99',
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
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isCreditLoading, setIsCreditLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(300); // default 5h
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
        setCreditBalance(0);
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
        <h2 className="text-xl font-semibold mb-4">Billing Status</h2>
        <div className="p-4 mb-4 bg-muted/30 border border-border rounded-lg text-center">
          <p className="text-sm text-muted-foreground">
            Running in local development mode - billing features are disabled
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Agent usage limits are not enforced in this environment
          </p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading || authLoading) {
    return (
      <div className="rounded-xl border shadow-sm bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Billing Status</h2>
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
        <h2 className="text-xl font-semibold mb-4">Billing Status</h2>
        <div className="p-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
          <p className="text-sm text-destructive">
            Error loading billing status:{' '}
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
      <h2 className="text-xl font-semibold mb-4">Billing Status</h2>

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
                        Usage logs
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
                    `${creditBalance?.toFixed(1) || '0'} minutes`
                  )}
                </span>
                <Button 
                  onClick={() => setShowTopUp(true)}
                  variant="outline" 
                  className="text-sm"
                  disabled={isCreditLoading}
                >
                  Top Up
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Pre-paid credits allow you to use agents without a subscription.</p>
            <p className="mt-1">Credits are consumed based on your usage and never expire.</p>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={() => setShowTopUp(true)}
              className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
              disabled={isCreditLoading}
            >
              Purchase Credits
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Top-up Dialog */}
      <Dialog open={showTopUp} onOpenChange={setShowTopUp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Purchase Credits</DialogTitle>
            <DialogDescription>
              Choose the amount of credits you want to purchase
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Credit Amount</Label>
              <RadioGroup value={topUpAmount.toString()} onValueChange={(value) => setTopUpAmount(Number(value))}>
                <div className="grid grid-cols-1 gap-3 mt-2">
                  <Label htmlFor="30" className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="30" id="30" />
                    <div className="flex-1">
                      <div className="font-medium">30 minutes</div>
                      <div className="text-sm text-muted-foreground">{CREDIT_PRICES[30]}</div>
                    </div>
                  </Label>
                  <Label htmlFor="300" className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="300" id="300" />
                    <div className="flex-1">
                      <div className="font-medium">5 hours</div>
                      <div className="text-sm text-muted-foreground">{CREDIT_PRICES[300]}</div>
                    </div>
                  </Label>
                  <Label htmlFor="600" className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="600" id="600" />
                    <div className="flex-1">
                      <div className="font-medium">10 hours</div>
                      <div className="text-sm text-muted-foreground">{CREDIT_PRICES[600]}</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-medium">Payment Method</Label>
              <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as any)}>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <Label htmlFor="alipay" className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="alipay" id="alipay" />
                    <AliPayIcon />
                    <span className="text-sm">AliPay</span>
                  </Label>
                  <Label htmlFor="wechat_pay" className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="wechat_pay" id="wechat_pay" />
                    <WeChatPayIcon />
                    <span className="text-sm">WeChat</span>
                  </Label>
                  <Label htmlFor="card" className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="card" id="card" />
                    <CreditCard className="w-6 h-6" />
                    <span className="text-sm">Card</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {topUpError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{topUpError}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTopUp(false)}>
              Cancel
            </Button>
            <Button onClick={handleTopUp} disabled={isTopUpLoading}>
              {isTopUpLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Purchase for ${CREDIT_PRICES[topUpAmount]}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
