'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { isLocalMode } from '@/lib/config';
import {
    getSubscription,
    createPortalSession,
    SubscriptionStatus,
} from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Check } from 'lucide-react';
import { createCreditSession } from '@/lib/api';
import { siteConfig } from '@/lib/home';
import { cn } from '@/lib/utils';
import { config } from '@/lib/config';

// Constants for credit pricing - now using config
const CREDIT_PRICE_IDS: Record<number, string> = {
  9: config.CREDIT_PRICES.CREDIT_9.priceId,
  49: config.CREDIT_PRICES.CREDIT_49.priceId,
  99: config.CREDIT_PRICES.CREDIT_99.priceId,
};

const CREDIT_PRICES: Record<number, string> = {
  9: '~1 hour',
  49: '~5 hours',
  99: '~10 hours',
};

interface BillingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    returnUrl?: string;
}

export function BillingModal({ open, onOpenChange, returnUrl = typeof window !== 'undefined' ? window?.location?.href || '/' : '/' }: BillingModalProps) {
    const { session, isLoading: authLoading } = useAuth();
    const { t, i18n } = useTranslation();
    const [subscriptionData, setSubscriptionData] = useState<SubscriptionStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isManaging, setIsManaging] = useState(false);
    
    // Prepaid credits state
    const [topUpAmount, setTopUpAmount] = useState(49);
    const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat_pay' | 'card'>('alipay');
    const [isTopUpLoading, setIsTopUpLoading] = useState(false);
    const [topUpError, setTopUpError] = useState<string | null>(null);
    
    // Billing period state
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');

    // Show prepaid tab by default for Chinese users
    const defaultTab = i18n.language === 'zh-CN' ? 'prepaid' : 'subscription';

    useEffect(() => {
        async function fetchSubscription() {
            if (!open || authLoading || !session) return;

            try {
                setIsLoading(true);
                const data = await getSubscription();
                setSubscriptionData(data);
                setError(null);
            } catch (err) {
                console.error('Failed to get subscription:', err);
                setError(err instanceof Error ? err.message : 'Failed to load subscription data');
            } finally {
                setIsLoading(false);
            }
        }

        fetchSubscription();
    }, [open, session, authLoading]);

    const handleManageSubscription = async () => {
        try {
            setIsManaging(true);
            const { url } = await createPortalSession({ return_url: returnUrl });
            window.location.href = url;
        } catch (err) {
            console.error('Failed to create portal session:', err);
            setError(err instanceof Error ? err.message : 'Failed to create portal session');
        } finally {
            setIsManaging(false);
        }
    };

    const handleTopUp = async () => {
        if (!session && !authLoading) {
            window.location.href = '/auth';
            return;
        }
        
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
                locale: i18n.language === 'zh-CN' ? 'zh' : 'en',
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

    // Local mode content
    if (isLocalMode()) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Billing & Subscription</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 bg-muted/30 border border-border rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">
                            Running in local development mode - billing features are disabled
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            All premium features are available in this environment
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Upgrade Your Plan</DialogTitle>
                </DialogHeader>

                {isLoading || authLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : error ? (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                        <p className="text-sm text-destructive">Error loading billing status: {error}</p>
                    </div>
                ) : (
                    <>
                        {subscriptionData && (
                            <div className="mb-6">
                                <div className="rounded-lg border bg-background p-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-foreground/90">
                                            {t('billing.usageThisMonth', "This Month's Agent Usage")}
                                        </span>
                                        <span className="text-sm font-medium">
                                            ${subscriptionData.current_usage?.toFixed(2) || '0'} /{' '}
                                            ${subscriptionData.cost_limit || '0'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Tabs defaultValue={defaultTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger 
                                    value="subscription"
                                    className="rounded-t-lg border border-b-0 border-border bg-background px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/90 data-[state=active]:border-b-card"
                                >
                                    {t('billing.subscription', 'Subscription')}
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="prepaid"
                                    className="rounded-t-lg border border-b-0 border-border bg-background px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/90 data-[state=active]:border-b-card"
                                >
                                    {t('billing.prepaidCredits', 'Pre-paid Credits')}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="subscription" className="space-y-4">
                                {/* Billing Period Toggle */}
                                <div className="flex items-center justify-center mb-6">
                                    <div className="flex items-center space-x-2 bg-muted rounded-lg p-1">
                                        <button
                                            onClick={() => setBillingPeriod('monthly')}
                                            className={cn(
                                                'px-3 py-1 text-sm rounded-md transition-colors',
                                                billingPeriod === 'monthly'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {t('billing.billingPeriod.monthly', 'Monthly')}
                                        </button>
                                        <button
                                            onClick={() => setBillingPeriod('yearly')}
                                            className={cn(
                                                'px-3 py-1 text-sm rounded-md transition-colors relative',
                                                billingPeriod === 'yearly'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {t('billing.billingPeriod.yearly', 'Yearly')}
                                            {billingPeriod === 'yearly' && (
                                                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                                    15% off
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Subscription Plans Grid */}
                                <div className="grid gap-4 w-full mx-auto max-w-4xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
                                    {siteConfig.cloudPricingItems
                                        .filter((tier) => !tier.hidden && tier.price !== '$0')
                                        .map((tier) => {
                                            const price = billingPeriod === 'yearly' ? tier.yearlyPrice : tier.price;
                                            const originalPrice = billingPeriod === 'yearly' ? tier.originalYearlyPrice : null;
                                            const savings = billingPeriod === 'yearly' && tier.originalYearlyPrice && tier.yearlyPrice 
                                                ? Math.round(parseFloat(tier.originalYearlyPrice.replace('$', '')) - parseFloat(tier.yearlyPrice.replace('$', '')))
                                                : null;
                                            
                                            return (
                                                <div key={tier.name} className="relative rounded-xl border bg-card p-6 shadow-sm">
                                                    {tier.isPopular && (
                                                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                                                {t('pricing.popular', 'Popular')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="text-center">
                                                        <h3 className="text-xl font-semibold mb-2">{tier.name}</h3>
                                                        <div className="mb-4">
                                                            <span className="text-3xl font-bold">{price}</span>
                                                            {originalPrice && (
                                                                <span className="text-lg text-muted-foreground line-through ml-2">{originalPrice}</span>
                                                            )}
                                                            <span className="text-sm text-muted-foreground ml-1">
                                                                {billingPeriod === 'yearly' ? '/月 年付' : '/月'}
                                                            </span>
                                                        </div>
                                                        {savings && (
                                                            <div className="mb-4">
                                                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                                                    每年节省${savings}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <ul className="space-y-3 mb-6">
                                                        {tier.features?.map((feature, index) => (
                                                            <li key={index} className="flex items-center space-x-2">
                                                                <Check className="h-4 w-4 text-red-500 flex-shrink-0" />
                                                                <span className="text-sm">{feature}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    
                                                    <Button 
                                                        className="w-full bg-red-600 hover:bg-red-700"
                                                        onClick={() => {
                                                            // Handle subscription upgrade
                                                            const priceId = billingPeriod === 'yearly' ? tier.yearlyStripePriceId : tier.stripePriceId;
                                                            if (priceId) {
                                                                window.location.href = `/api/billing/create-checkout-session?price_id=${priceId}&return_url=${encodeURIComponent(returnUrl)}`;
                                                            }
                                                        }}
                                                    >
                                                        {t('billing.upgradePlan', 'Upgrade')}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                </div>

                                {subscriptionData && (
                                    <div className="text-center mt-6">
                                        <Button
                                            onClick={handleManageSubscription}
                                            disabled={isManaging}
                                            className="max-w-xs mx-auto w-full bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                                        >
                                            {isManaging ? 'Loading...' : 'Manage Subscription'}
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="prepaid" className="space-y-4">
                                <div className="text-center mb-8">
                                    <h3 className="text-2xl font-semibold mb-2">{t('billing.prepaidCredits', 'Pre-paid Credits')}</h3>
                                    <p className="text-muted-foreground">
                                        {t('billing.prepaidDescription', 'Purchase credits to use agents without a subscription. Credits never expire. New purchases use dollar-based credits with a $4.50 service fee.')}
                                    </p>
                                </div>
                                
                                <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6">
                                    <Label className="mb-2 font-medium">{t('billing.selectCreditAmount', 'Select Credit Amount')}</Label>
                                    <RadioGroup value={String(topUpAmount)} onValueChange={v => setTopUpAmount(Number(v))} className="flex flex-col gap-2 mb-4">
                                        {[9, 49, 99].map((dollars) => (
                                            <div key={dollars} className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                                                <RadioGroupItem value={String(dollars)} id={`credit-${dollars}`} />
                                                <Label htmlFor={`credit-${dollars}`} className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                                                    ${dollars} (${dollars - 4.50} {t('billing.netAfterFee', 'net after service fee')})
                                                    <span className="text-muted-foreground ml-2">{CREDIT_PRICES[dollars]}</span>
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                    
                                    <Label className="mb-2 mt-4 font-medium">{t('billing.selectPaymentMethod', 'Select Payment Method')}</Label>
                                    <RadioGroup value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)} className="flex flex-col gap-2 mb-4">
                                        <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                                            <RadioGroupItem value="alipay" id="pm-alipay" />
                                            <Label htmlFor="pm-alipay" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M22.319 12.546c.033-.07.033-.141.033-.212 0-.07-.033-.141-.033-.212L21.092 7.88c-.1-.424-.424-.707-.848-.707h-6.667l-1.01-3.788c-.07-.283-.353-.495-.636-.495H7.25c-.283 0-.566.212-.636.495L5.604 7.88H2.604c-.424 0-.707.283-.848.707L.604 12.122c-.033.07-.033.141-.033.212 0 .07.033.141.033.212l1.152 4.242c.1.424.424.707.848.707h6.667l1.01 3.788c.07.283.353.495.636.495h5.667c.283 0 .566-.212.636-.495l1.01-3.788h6.667c.424 0 .707-.283.848-.707l1.152-4.242z"/>
                                                </svg>
                                                {t('billing.alipay', 'AliPay')}
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                                            <RadioGroupItem value="wechat_pay" id="pm-wechat" />
                                            <Label htmlFor="pm-wechat" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 1.951.846 3.705 2.188 4.96.188.188.188.471 0 .659l-.659.659c-.188.188-.471.188-.659 0C.188 14.235 0 11.941 0 9.53 0 4.235 3.891 0 8.691 0s8.691 4.235 8.691 9.53c0 2.411-.188 4.705-1.188 6.647-.188.188-.471.188-.659 0l-.659-.659c-.188-.188-.188-.471 0-.659C16.845 13.235 17.691 11.481 17.691 9.53c0-4.054-3.891-7.342-9-7.342z"/>
                                                    <circle cx="20" cy="16" r="1.2" fill="#07C160"/>
                                                </svg>
                                                {t('billing.wechatPay', 'WeChat Pay')}
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                                            <RadioGroupItem value="card" id="pm-card" />
                                            <Label htmlFor="pm-card" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                                                <CreditCard className="w-5 h-5" />
                                                {t('billing.creditCard', 'Credit/Debit Card')}
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
                                            className="px-4 py-2"
                                        >
                                            {t('billing.reset', 'Reset')}
                                        </Button>
                                        <Button
                                            onClick={handleTopUp}
                                            disabled={isTopUpLoading}
                                            className="px-4 py-2 bg-primary hover:bg-primary/90"
                                        >
                                            {isTopUpLoading ? t('billing.loading', 'Loading...') : t('billing.payNow', 'Pay Now')}
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
} 