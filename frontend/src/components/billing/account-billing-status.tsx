'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/home/sections/pricing-section";
import { isLocalMode } from "@/lib/config";
import { getSubscription, createPortalSession, SubscriptionStatus, getCreditBalance, createCreditSession } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard, Landmark, QrCode } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type Props = {
    accountId: string;
    returnUrl: string;
}

// Mapping from minutes to Stripe price IDs
const CREDIT_PRICE_IDS: Record<number, string> = {
    60: 'price_1RQZVpP2cIDuyWfbF62E3dsi',   // $9 for 1 hour
    300: 'price_1RQZVpP2cIDuyWfbgUnmBizh',  // $49 for 5 hours
    600: 'price_1RQZVpP2cIDuyWfbcceSm4gM',  // $99 for 10 hours
};

// Inline AliPay and WeChat Pay SVG icons
const AliPayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" width={24} height={24} {...props}><rect width="32" height="32" rx="6" fill="#1677FF"/><path d="M8.5 13.5h15M8.5 18.5h15" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><text x="16" y="24" textAnchor="middle" fontSize="10" fill="#fff" fontFamily="Arial">支付宝</text></svg>
);
const WeChatPayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" width={24} height={24} {...props}><rect width="32" height="32" rx="6" fill="#07C160"/><circle cx="12" cy="16" r="6" fill="#fff"/><circle cx="20" cy="16" r="6" fill="#fff"/><circle cx="12" cy="16" r="1.2" fill="#07C160"/><circle cx="20" cy="16" r="1.2" fill="#07C160"/></svg>
);

// Add price mapping for display
const CREDIT_PRICES: Record<number, string> = {
  60: '$9',
  300: '$49',
  600: '$99',
};

export default function AccountBillingStatus({ accountId, returnUrl }: Props) {
    const { t, i18n } = useTranslation();
    const { session, isLoading: authLoading } = useAuth();
    const [subscriptionData, setSubscriptionData] = useState<SubscriptionStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isManaging, setIsManaging] = useState(false);
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isCreditLoading, setIsCreditLoading] = useState(true);
    const [showTopUp, setShowTopUp] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState(60); // default 1h
    const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat_pay' | 'card'>('alipay');
    const [isTopUpLoading, setIsTopUpLoading] = useState(false);
    const [topUpError, setTopUpError] = useState<string | null>(null);

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

    useEffect(() => {
        async function fetchCredits() {
            setIsCreditLoading(true);
            try {
                const balance = await getCreditBalance();
                setCreditBalance(balance);
            } catch (err) {
                setCreditBalance(null);
            } finally {
                setIsCreditLoading(false);
            }
        }
        if (session) fetchCredits();
    }, [session]);

    const handleManageSubscription = async () => {
        try {
            setIsManaging(true);
            // Map i18n.language to Stripe locale (always use 'zh-CN' for Simplified Chinese)
            let locale = i18n.language;
            if (locale === 'zh-CN') locale = 'zh-CN';
            else if (locale === 'zh-TW') locale = 'zh-TW';
            else if (locale === 'en-US' || locale === 'en') locale = 'en';
            else if (locale === 'es') locale = 'es';
            else if (locale === 'fr') locale = 'fr';
            else if (locale === 'de') locale = 'de';
            else if (locale === 'ja') locale = 'ja';
            else if (locale === 'ko') locale = 'ko';
            else if (locale === 'pt-BR') locale = 'pt-BR';
            else locale = 'auto';

            // Debug: log current language and translations
            console.log('Current i18n.language:', i18n.language);
            console.log('billing.prepaidCredits:', t('billing.prepaidCredits'));
            console.log('billing.topUp:', t('billing.topUp'));
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
            <Tabs defaultValue="subscription" className="w-full">
                <TabsList className="mb-6 border-b border-border bg-transparent px-0">
                    <TabsTrigger value="subscription" className="rounded-t-lg border border-b-0 border-border bg-background px-6 py-2 mr-2 data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-card">{t('billing.subscription', '订阅')}</TabsTrigger>
                    <TabsTrigger value="prepaid" className="rounded-t-lg border border-b-0 border-border bg-background px-6 py-2 data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-card">{t('billing.prepaidTab', '预付（支持微信，支付宝）')}</TabsTrigger>
                </TabsList>
                <TabsContent value="subscription">
                    <h2 className="text-xl font-semibold mb-4">{t('billing.subscription', 'Subscription')}</h2>
                    <div className="mb-6">
                        <div className="rounded-lg border bg-background p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-foreground/90">{t('billing.usageThisMonth', 'Agent Usage This Month')}</span>
                                <span className="text-sm font-medium text-card-title">
                                    {subscriptionData?.current_usage?.toFixed(2) || '0'} / {subscriptionData?.minutes_limit || '0'} {t('billing.minutes', 'minutes')}
                                </span>
                            </div>
                        </div>
                    </div>
                    <PricingSection
                        returnUrl={returnUrl}
                        showTitleAndTabs={false}
                    />
                    <Button
                        onClick={handleManageSubscription}
                        disabled={isManaging}
                        className="w-full bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg transition-all mt-4"
                    >
                        {isManaging ? t('billing.loading', 'Loading...') : t('billing.manage', 'Manage Subscription')}
                    </Button>
                </TabsContent>
                <TabsContent value="prepaid">
                    <h2 className="text-xl font-semibold mb-4">{t('billing.prepaidCredits', '预付费时长')}</h2>
                    <div className="mb-4">
                        <div className="rounded-lg border bg-background p-4 flex justify-between items-center">
                            <span className="text-sm font-medium text-foreground/90">{t('billing.prepaidCredits', '预付费时长')}</span>
                            {isCreditLoading ? (
                                <Skeleton className="h-6 w-24" />
                            ) : (
                                <span className="text-sm font-medium text-card-title">
                                    {creditBalance !== null ? creditBalance.toFixed(2) : '--'} {t('billing.minutes', '分钟')}
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Inline Top Up Form (was modal) */}
                    <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6 mt-4">
                        <Label className="mb-2 font-medium">{t('billing.selectAmount', '选择时长套餐')}</Label>
                        <RadioGroup value={String(topUpAmount)} onValueChange={v => setTopUpAmount(Number(v))} className="flex flex-col gap-2 mb-4">
                          {[60, 300, 600].map((minutes) => (
                            <div key={minutes} className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                              <RadioGroupItem value={String(minutes)} id={`credit-${minutes}`} />
                              <Label htmlFor={`credit-${minutes}`} className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                                {minutes === 60 && t('billing.1hour', '1小时')}
                                {minutes === 300 && t('billing.5hours', '5小时')}
                                {minutes === 600 && t('billing.10hours', '10小时')}
                                <span className="text-muted-foreground ml-2">{CREDIT_PRICES[minutes]}</span>
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        <Label className="mb-2 mt-4 font-medium">{t('billing.selectPayment', '选择支付方式')}</Label>
                        <RadioGroup value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)} className="flex flex-col gap-2 mb-4">
                          <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                            <RadioGroupItem value="alipay" id="pm-alipay" />
                            <Label htmlFor="pm-alipay" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                              <AliPayIcon />
                              {t('billing.alipay', '支付宝')}
                            </Label>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                            <RadioGroupItem value="wechat_pay" id="pm-wechat" />
                            <Label htmlFor="pm-wechat" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                              <WeChatPayIcon />
                              {t('billing.wechatpay', '微信支付')}
                            </Label>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                            <RadioGroupItem value="card" id="pm-card" />
                            <Label htmlFor="pm-card" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                              <span className="inline-block w-5 h-5 bg-muted rounded-sm flex items-center justify-center mr-1">💳</span>
                              {t('billing.card', '信用卡/借记卡')}
                            </Label>
                          </div>
                        </RadioGroup>
                        {topUpError && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md px-3 py-2 mb-2">{topUpError}</div>}
                        <div className="flex justify-end gap-2 mt-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setTopUpAmount(60);
                              setPaymentMethod('alipay');
                              setTopUpError(null);
                            }}
                          >{t('billing.cancel', '取消')}</Button>
                          <Button
                            onClick={async () => {
                              setIsTopUpLoading(true);
                              setTopUpError(null);
                              try {
                                const success_url = window.location.href;
                                const cancel_url = window.location.href;
                                const price_id = CREDIT_PRICE_IDS[topUpAmount];
                                if (!price_id) {
                                  setTopUpError('Invalid amount selected.');
                                  setIsTopUpLoading(false);
                                  return;
                                }
                                // Stripe supported locales
                                const supportedLocales = [
                                  'auto', 'bg', 'cs', 'da', 'de', 'el', 'en', 'en-AU', 'en-CA', 'en-GB', 'en-IE', 'en-IN', 'en-NZ', 'en-SG',
                                  'es', 'es-419', 'et', 'fi', 'fil', 'fr', 'fr-CA', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'ms', 'mt',
                                  'nb', 'nl', 'pl', 'pt', 'pt-BR', 'ro', 'ru', 'sk', 'sl', 'sv', 'th', 'tr', 'vi', 'zh', 'zh-HK', 'zh-TW'
                                ];
                                let locale = i18n.language;
                                if (!supportedLocales.includes(locale)) {
                                  if (locale.startsWith('zh')) locale = 'zh';
                                  else if (locale.startsWith('en')) locale = 'en';
                                  else if (locale.startsWith('fr')) locale = 'fr';
                                  else if (locale.startsWith('de')) locale = 'de';
                                  else if (locale.startsWith('es')) locale = 'es';
                                  else locale = 'en';
                                }
                                const res = await createCreditSession({
                                  price_id,
                                  payment_method: paymentMethod,
                                  success_url,
                                  cancel_url,
                                  locale
                                });
                                if (res.url) {
                                  window.location.href = res.url;
                                } else {
                                  setTopUpError(t('billing.errorRedirect', '跳转到支付页面失败'));
                                }
                              } catch (err: any) {
                                setTopUpError(err?.message || 'Error creating payment session');
                              } finally {
                                setIsTopUpLoading(false);
                              }
                            }}
                            disabled={isTopUpLoading}
                          >
                            {isTopUpLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2 inline" /> : null}
                            {t('billing.payNow', '立即支付')}
                          </Button>
                        </div>
                      </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}