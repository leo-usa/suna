'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { PricingSection, PricingFullPageShell } from '@/components/billing/pricing';
import { billingApi } from '@/lib/api/billing';
import { useAccountState } from '@/hooks/billing';
import { toast } from '@/lib/toast';

type AnnualTierKey = 'tier_2_20' | 'tier_6_50' | 'tier_25_200';
type AnnualPaymentMethod = 'alipay' | 'wechat_pay';

export default function AnnualPrepayPage() {
  const t = useTranslations('billing.annualPrepay');
  const locale = useLocale();
  const { data: accountState, isLoading: isLoadingAccount } = useAccountState({ enabled: true });

  const [selectedTier, setSelectedTier] = useState<AnnualTierKey | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<AnnualPaymentMethod>('alipay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPrepaidAnnual = accountState?.subscription?.is_prepaid_annual;
  const prepaidExpiresAt = accountState?.subscription?.prepaid_plan_expires_at;
  const currentTierKey = accountState?.subscription?.tier_key;

  const handlePurchase = async () => {
    if (!selectedTier) {
      setError(t('selectPlan'));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const origin = window.location.origin;
      const response = await billingApi.purchaseAnnualPlan({
        tier_key: selectedTier,
        success_url: `${origin}/dashboard?annual_prepaid=success`,
        cancel_url: `${origin}/billing/annual-prepay?annual_prepaid=cancelled`,
        payment_method: paymentMethod,
        locale: locale?.startsWith('zh') ? 'zh' : 'en',
      });

      if (response.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        throw new Error(t('noCheckoutUrl'));
      }
    } catch (err: unknown) {
      const message =
        (err as { details?: { detail?: string }; message?: string })?.details?.detail ||
        (err as Error)?.message ||
        t('checkoutFailed');
      setError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingAccount) {
    return (
      <PricingFullPageShell asPage closeHref="/dashboard">
        <div className="flex min-h-[50vh] w-full items-center justify-center">
          <DobbyLoader />
        </div>
      </PricingFullPageShell>
    );
  }

  return (
    <PricingFullPageShell asPage closeHref="/dashboard">
      <div className="w-full">
        {isPrepaidAnnual && (
          <Alert className="mx-auto mb-6 max-w-5xl border-primary/20 bg-primary/5">
            <AlertDescription>
              {t('activePlanNotice', {
                tier: accountState?.subscription?.tier_display_name ?? '',
                date: prepaidExpiresAt
                  ? new Date(prepaidExpiresAt).toLocaleDateString(locale)
                  : '',
              })}
            </AlertDescription>
          </Alert>
        )}

        <PricingSection
          annualPrepaidMode
          hideFree
          noPadding
          customTitle={t('title')}
          customSubtitle={t('subtitle')}
          returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/billing/annual-prepay?annual_prepaid=cancelled`}
          isPrepaidAnnual={isPrepaidAnnual}
          prepaidAnnualTierKey={isPrepaidAnnual ? currentTierKey : null}
          selectedAnnualTierKey={selectedTier}
          onAnnualPrepaidSelect={(tierKey) => {
            setSelectedTier(tierKey as AnnualTierKey);
            setError(null);
          }}
        />

        {!isPrepaidAnnual && (
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            {selectedTier && (
              <div className="mt-2 space-y-3">
                <Label>{t('paymentMethod')}</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as AnnualPaymentMethod)}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <div>
                    <RadioGroupItem value="alipay" id="annual-alipay" className="peer sr-only" />
                    <Label
                      htmlFor="annual-alipay"
                      className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                    >
                      {t('payAlipay')}
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="wechat_pay" id="annual-wechat" className="peer sr-only" />
                    <Label
                      htmlFor="annual-wechat"
                      className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                    >
                      {t('payWeChatPay')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              className="mt-6 w-full sm:w-auto"
              size="lg"
              onClick={handlePurchase}
              disabled={isProcessing || !selectedTier}
            >
              {isProcessing ? (
                <>
                  <DobbyLoader className="mr-2 h-4 w-4" />
                  {t('processing')}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('continueToPayment')}
                </>
              )}
            </Button>

            <p className="mt-4 text-sm text-muted-foreground">{t('disclaimer')}</p>
          </div>
        )}

        {isPrepaidAnnual && (
          <p className="mt-6 text-center text-sm text-muted-foreground">{t('upgradeComingSoon')}</p>
        )}
      </div>
    </PricingFullPageShell>
  );
}
