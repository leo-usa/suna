'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/home/sections/pricing-section";
import { isLocalMode } from "@/lib/config";
import { getSubscription, createPortalSession, SubscriptionStatus } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from 'react-i18next';

type Props = {
    accountId: string;
    returnUrl: string;
}

export default function AccountBillingStatus({ accountId, returnUrl }: Props) {
    const { t, i18n } = useTranslation();
    const { session, isLoading: authLoading } = useAuth();
    const [subscriptionData, setSubscriptionData] = useState<SubscriptionStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isManaging, setIsManaging] = useState(false);

    useEffect(() => {
        async function fetchSubscription() {
            if (authLoading || !session) return;
            
            try {
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
    }, [session, authLoading]);

    const handleManageSubscription = async () => {
        try {
            setIsManaging(true);
            // Map app language to Stripe-supported locale
            const supportedLocales = [
                'auto', 'bg', 'cs', 'da', 'de', 'el', 'en', 'en-AU', 'en-CA', 'en-GB', 'en-IE', 'en-IN', 'en-NZ', 'en-SG',
                'es', 'es-419', 'et', 'fi', 'fil', 'fr', 'fr-CA', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'ms', 'mt',
                'nb', 'nl', 'pl', 'pt', 'pt-BR', 'ro', 'ru', 'sk', 'sl', 'sv', 'th', 'tr', 'vi', 'zh', 'zh-HK', 'zh-TW'
            ];
            // Map i18n.language to Stripe locale
            let locale = i18n.language;
            if (locale === 'zh-CN' || locale === 'zh') locale = 'zh';
            else if (locale === 'zh-TW') locale = 'zh-TW';
            else if (locale === 'en-US' || locale === 'en') locale = 'en';
            else if (locale === 'es') locale = 'es';
            else if (locale === 'fr') locale = 'fr';
            else if (locale === 'de') locale = 'de';
            else if (locale === 'ja') locale = 'ja';
            else if (locale === 'ko') locale = 'ko';
            else if (locale === 'pt-BR') locale = 'pt-BR';
            else if (!supportedLocales.includes(locale)) locale = 'auto';
            const { url } = await createPortalSession({ return_url: returnUrl, locale });
            window.location.href = url;
        } catch (err) {
            console.error('Failed to create portal session:', err);
            setError(err instanceof Error ? err.message : 'Failed to create portal session');
        } finally {
            setIsManaging(false);
        }
    };

    // In local development mode, show a simplified component
    if (isLocalMode()) {
        return (
            <div className="rounded-xl border shadow-sm bg-card p-6">
                <h2 className="text-xl font-semibold mb-4">{t('billing.status', 'Billing Status')}</h2>
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
                <h2 className="text-xl font-semibold mb-4">{t('billing.status', 'Billing Status')}</h2>
                <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="rounded-xl border shadow-sm bg-card p-6">
                <h2 className="text-xl font-semibold mb-4">{t('billing.status', 'Billing Status')}</h2>
                <div className="p-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                    <p className="text-sm text-destructive">
                        {t('billing.errorLoading', 'Error loading billing status')}: {error}
                    </p>
                </div>
            </div>
        );
    }

    const isPlan = (planId?: string) => {
        return subscriptionData?.plan_name === planId;
    };
    
    const planName = isPlan('free') 
        ? t('billing.plan.free', 'Free')
        : isPlan('base')
            ? t('billing.plan.pro', 'Pro')
            : isPlan('extra')
                ? t('billing.plan.enterprise', 'Enterprise')
                : t('billing.plan.unknown', 'Unknown');

    return (
        <div className="rounded-xl border shadow-sm bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">{t('billing.status', 'Billing Status')}</h2>
            
            {subscriptionData ? (
                <>
                    <div className="mb-6">
                        <div className="rounded-lg border bg-background p-4 grid grid-cols-1 md:grid-cols-2 gap-4">                            
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-foreground/90">{t('billing.usageThisMonth', 'Agent Usage This Month')}</span>
                                <span className="text-sm font-medium text-card-title">
                                    {subscriptionData.current_usage?.toFixed(2) || '0'} / {subscriptionData.minutes_limit || '0'} {t('billing.minutes', 'minutes')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Plans Comparison */}
                    <PricingSection
                        returnUrl={returnUrl}
                        showTitleAndTabs={false}
                    />

                    {/* Manage Subscription Button */}
                    <Button
                        onClick={handleManageSubscription}
                        disabled={isManaging}
                        className="w-full bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                    >
                        {isManaging ? t('billing.loading', 'Loading...') : t('billing.manage', 'Manage Subscription')}
                    </Button>
                </>
            ) : (
                <>
                    <div className="mb-6">
                        <div className="rounded-lg border bg-background p-4 gap-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-foreground/90">{t('billing.currentPlan', 'Current Plan')}</span>
                                <span className="text-sm font-medium text-card-title">{t('billing.plan.free', 'Free')}</span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-foreground/90">{t('billing.usageThisMonth', 'Agent Usage This Month')}</span>
                                <span className="text-sm font-medium text-card-title">
                                    {subscriptionData?.current_usage?.toFixed(2) || '0'} / {subscriptionData?.minutes_limit || '0'} {t('billing.minutes', 'minutes')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Plans Comparison */}
                    <PricingSection
                        returnUrl={returnUrl}
                        showTitleAndTabs={false}
                    />

                    {/* Manage Subscription Button */}
                    <Button
                        onClick={handleManageSubscription}
                        disabled={isManaging}
                        className="w-full bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                    >
                        {isManaging ? t('billing.loading', 'Loading...') : t('billing.manage', 'Manage Subscription')}
                    </Button>
                </>
            )}
        </div>
    );
}