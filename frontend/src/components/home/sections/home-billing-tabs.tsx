'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PricingSection } from './pricing-section';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { createCreditSession } from '@/lib/api';
import { useTranslation } from 'react-i18next';

// Price mapping for display and Stripe price IDs
const CREDIT_PRICE_IDS: Record<number, string> = {
  9: 'price_1RQZVpP2cIDuyWfbF62E3dsi',   // $9 (after service fee: $4.50)
  49: 'price_1RQZVpP2cIDuyWfbgUnmBizh',  // $49 (after service fee: $44.50)
  99: 'price_1RQZVpP2cIDuyWfbcceSm4gM',  // $99 (after service fee: $94.50)
};

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

export default function HomeBillingTabs() {
  const { session, isLoading: authLoading } = useAuth();
  // Set default to $49
  const [topUpAmount, setTopUpAmount] = useState(49);
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat_pay' | 'card'>('alipay');
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const { t, i18n } = useTranslation();
  
  // Show prepaid tab by default for Chinese users
  const defaultTab = i18n.language === 'zh-CN' ? 'prepaid' : 'subscription';

  // Prepaid top-up handler
  const handleTopUp = async () => {
    if (!session && !authLoading) {
      window.location.href = '/auth';
      return;
    }
    
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

      const res = await createCreditSession({
        price_id,
        payment_method: paymentMethod,
        success_url,
        cancel_url,
        locale: i18n.language === 'zh-CN' ? 'zh' : 'en'
      });
      
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setTopUpError('Failed to redirect to payment page');
      }
    } catch (err: any) {
      setTopUpError(err?.message || 'Error creating payment session');
    } finally {
      setIsTopUpLoading(false);
    }
  };

  return (
    <section className="flex flex-col items-center justify-center gap-10 w-full relative pb-12">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-medium tracking-tighter text-center text-balance">
          {t('pricing.title', 'Choose the right plan for your needs')}
        </h2>
        <p className="text-muted-foreground text-center text-balance font-medium mt-2">
          {t('pricing.subtitle', 'Start with our free plan or upgrade for more AI token credits')}
        </p>
      </div>

      <div className="w-full max-w-6xl mx-auto px-6">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="mb-6 border-b border-border bg-transparent px-0">
            <TabsTrigger
              value="subscription"
              className="rounded-t-lg border border-b-0 border-border bg-background px-6 py-2 mr-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/90 data-[state=active]:border-b-card"
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
          
          <TabsContent value="subscription">
            <PricingSection showTitleAndTabs={false} />
          </TabsContent>
          
          <TabsContent value="prepaid">
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
                >
                  {t('billing.cancel', 'Cancel')}
                </Button>
                <Button
                  onClick={handleTopUp}
                  disabled={isTopUpLoading}
                >
                  {isTopUpLoading ? t('common.loading', 'Loading...') : t('billing.payNow', 'Pay Now')}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      <div className="mt-4 p-4 bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-lg max-w-2xl mx-auto">
        <p className="text-sm text-foreground dark:text-foreground text-center">
          <strong>{t('billing.whatAreTokensQuestion', 'What are AI tokens?')}</strong> {t('billing.whatAreTokensExplanation', 'Tokens are units of text that AI models process. Your plan includes credits to spend on various AI models - the more complex the task, the more tokens used.')}
        </p>
      </div>
    </section>
  );
} 