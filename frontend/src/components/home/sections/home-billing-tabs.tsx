import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PricingSection } from './pricing-section';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

// Price mapping for display and Stripe price IDs (copy from AccountBillingStatus)
const CREDIT_PRICE_IDS: Record<number, string> = {
  60: 'price_1RQZVpP2cIDuyWfbF62E3dsi',   // $9 for 1 hour
  300: 'price_1RQZVpP2cIDuyWfbgUnmBizh',  // $49 for 5 hours
  600: 'price_1RQZVpP2cIDuyWfbcceSm4gM',  // $99 for 10 hours
};
const CREDIT_PRICES: Record<number, string> = {
  60: '$9',
  300: '$49',
  600: '$99',
};

const AliPayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" width={24} height={24} {...props}><rect width="32" height="32" rx="6" fill="#1677FF"/><path d="M8.5 13.5h15M8.5 18.5h15" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><text x="16" y="24" textAnchor="middle" fontSize="10" fill="#fff" fontFamily="Arial">支付宝</text></svg>
);
const WeChatPayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" width={24} height={24} {...props}><rect width="32" height="32" rx="6" fill="#07C160"/><circle cx="12" cy="16" r="6" fill="#fff"/><circle cx="20" cy="16" r="6" fill="#fff"/><circle cx="12" cy="16" r="1.2" fill="#07C160"/><circle cx="20" cy="16" r="1.2" fill="#07C160"/></svg>
);

export default function HomeBillingTabs() {
  const { t, i18n } = useTranslation();
  const { session, isLoading: authLoading } = useAuth();
  const [topUpAmount, setTopUpAmount] = useState(60); // default 1h
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat_pay' | 'card'>('alipay');
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  // Prepaid top-up handler (copy logic from AccountBillingStatus, but no balance display)
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
      const res = await window.createCreditSession?.({
        price_id,
        payment_method: paymentMethod,
        success_url,
        cancel_url,
        locale
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setTopUpError(t('billing.errorRedirect', '跳转到支付页面失败'));
      }
    } catch (err: any) {
      setTopUpError(err?.message || 'Error creating payment session');
    } finally {
      setIsTopUpLoading(false);
    }
  };

  return (
    <div className="rounded-xl border shadow-sm bg-card p-6">
      <Tabs defaultValue="subscription" className="w-full">
        <TabsList className="mb-6 border-b border-border bg-transparent px-0">
          <TabsTrigger value="subscription" className="rounded-t-lg border border-b-0 border-border bg-background px-6 py-2 mr-2 data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-card">
            {t('billing.subscription', '订阅')}
          </TabsTrigger>
          <TabsTrigger value="prepaid" className="rounded-t-lg border border-b-0 border-border bg-background px-6 py-2 data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-card">
            {t('billing.prepaidTab', '预付（支持微信，支付宝）')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="subscription">
          <PricingSection showTitleAndTabs={false} />
        </TabsContent>
        <TabsContent value="prepaid">
          <h2 className="text-xl font-semibold mb-4">{t('billing.prepaidCredits', '预付费时长')}</h2>
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
                onClick={handleTopUp}
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