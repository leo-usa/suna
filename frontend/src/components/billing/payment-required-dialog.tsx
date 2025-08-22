import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Zap, Check, CreditCard } from 'lucide-react';
import { useModal } from '@/hooks/use-modal-store';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
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
  9: '',
  49: '',
  99: '',
};

// Inline AliPay and WeChat Pay SVG icons
const AliPayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" width={24} height={24} {...props}><rect width="32" height="32" rx="6" fill="#1677FF"/><path d="M8.5 13.5h15M8.5 18.5h15" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><text x="16" y="24" textAnchor="middle" fontSize="10" fill="#fff" fontFamily="Arial">支付宝</text></svg>
);

const WeChatPayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" width={24} height={24} {...props}><rect width="32" height="32" rx="6" fill="#07C160"/><circle cx="12" cy="16" r="6" fill="#fff"/><circle cx="20" cy="16" r="6" fill="#fff"/><circle cx="12" cy="16" r="1.2" fill="#07C160"/><circle cx="20" cy="16" r="1.2" fill="#07C160"/></svg>
);

const returnUrl = process.env.NEXT_PUBLIC_URL as string;

export const PaymentRequiredDialog = () => {
    const { isOpen, type, onClose } = useModal();
    const { t, i18n } = useTranslation();
    const isModalOpen = isOpen && type === 'paymentRequiredDialog';
    
    // Prepaid credits state
    const [topUpAmount, setTopUpAmount] = useState(49);
    const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat_pay' | 'card'>('alipay');
    const [isTopUpLoading, setIsTopUpLoading] = useState(false);
    const [topUpError, setTopUpError] = useState<string | null>(null);
    
    // Billing period state
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');

    // Show prepaid tab by default for Chinese users
    const defaultTab = i18n.language === 'zh-CN' ? 'prepaid' : 'subscription';

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
                success_url: `${returnUrl}/dashboard?success=true`,
                cancel_url: `${returnUrl}/dashboard?canceled=true`,
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
    
    return (
      <Dialog open={isModalOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 flex-shrink-0">
              <DialogTitle>
                {t('billing.upgradeRequired', 'Upgrade Required')}
              </DialogTitle>
              <DialogDescription>
                {t('billing.upgradeRequiredDescription', "You've reached your plan's usage limit. Upgrade to continue enjoying our premium features.")}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 pb-2 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent px-4 sm:px-6 min-h-0">
              <div className="space-y-4 sm:space-y-6 pb-4">
                <div className="flex items-start p-3 sm:p-4 bg-destructive/5 border border-destructive/50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                    </div>
                    <div className="text-xs sm:text-sm min-w-0">
                      <p className="font-medium text-destructive">{t('billing.usageLimitReached', 'Usage Limit Reached')}</p>
                      <p className="text-destructive break-words">
                        {t('billing.planExhaustedMessage', 'Your current plan has been exhausted for this billing period.')}
                      </p>
                    </div>
                  </div>
                </div>

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
                                    {i18n.language === 'zh-CN' ? '月付' : t('billing.billingPeriod.monthly', 'Monthly')}
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
                                    {i18n.language === 'zh-CN' ? '年付' : t('billing.billingPeriod.yearly', 'Yearly')}
                                    {billingPeriod === 'yearly' && (
                                        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                            {i18n.language === 'zh-CN' ? '15% 优惠' : '15% off'}
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
                                                <h3 className="text-xl font-semibold mb-2">
                                                    {i18n.language === 'zh-CN' ? 
                                                        (tier.name === 'Ultra' ? '超值版' : tier.name)
                                                        : tier.name
                                                    }
                                                </h3>
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
                                                            {i18n.language === 'zh-CN' ? `每年节省$${savings}` : `Save $${savings} annually`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <ul className="space-y-3 mb-6">
                                                {tier.features?.map((feature, index) => (
                                                    <li key={index} className="flex items-center space-x-2">
                                                        <Check className="h-4 w-4 text-red-500 flex-shrink-0" />
                                                        <span className="text-sm">
                                                            {i18n.language === 'zh-CN' ? 
                                                                feature.replace('$20 AI token credits/month', '每月$20 AI代币积分')
                                                                      .replace('$50 AI token credits/month', '每月$50 AI代币积分')
                                                                      .replace('$100 AI token credits/month', '每月$100 AI代币积分')
                                                                      .replace('$200 AI token credits/month', '每月$200 AI代币积分')
                                                                      .replace('Private projects', '私有项目')
                                                                      .replace('Premium AI Models', '高级AI模型')
                                                                      .replace('Community support', '社区支持')
                                                                      .replace('Priority support', '优先支持')
                                                                : feature
                                                            }
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                            
                                            <Button 
                                                className="w-full bg-red-600 hover:bg-red-700"
                                                onClick={() => {
                                                    // Handle subscription upgrade
                                                    const priceId = billingPeriod === 'yearly' ? tier.yearlyStripePriceId : tier.stripePriceId;
                                                    if (priceId) {
                                                        window.location.href = `/api/billing/create-checkout-session?price_id=${priceId}&return_url=${encodeURIComponent(`${returnUrl}/dashboard`)}`;
                                                    }
                                                }}
                                            >
                                                {t('billing.upgradePlan', 'Upgrade')}
                                            </Button>
                                        </div>
                                    );
                                })}
                        </div>
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
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                            
                            <Label className="mb-2 mt-4 font-medium">{t('billing.selectPaymentMethod', 'Select Payment Method')}</Label>
                            <RadioGroup value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)} className="flex flex-col gap-2 mb-4">
                                <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                                    <RadioGroupItem value="alipay" id="pm-alipay" />
                                    <Label htmlFor="pm-alipay" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                                        <AliPayIcon />
                                        {t('billing.alipay', 'AliPay')}
                                    </Label>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border px-4 py-2 hover:bg-muted cursor-pointer transition">
                                    <RadioGroupItem value="wechat_pay" id="pm-wechat" />
                                    <Label htmlFor="pm-wechat" className="flex-1 cursor-pointer text-sm font-normal flex items-center gap-2">
                                        <WeChatPayIcon />
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
              </div>
            </div>
        </DialogContent>
      </Dialog>
    );
};