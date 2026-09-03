'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, CreditCard, Cpu, Lightbulb } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { cn } from '@/lib/utils';
import { billingApi } from '@/lib/api/billing';
import { toast } from '@/lib/toast';
import { formatCredits } from '@agentpress/shared';
import { useUserCurrency } from '@/hooks/use-user-currency';
import { formatPrice } from '@/lib/utils/currency';
import { useAuth } from '@/components/AuthProvider';
import { useCreditPackages, type CreditPackage } from '@/hooks/billing';
import { defaultCreditPackage } from '@/lib/credit-packages';

type CreditPaymentMethod = 'card' | 'alipay' | 'wechat_pay';

interface CreditPackSectionProps {
  currentBalance?: number;
  canPurchase?: boolean;
  onPurchaseComplete?: () => void;
  showAnnualPrepayLink?: boolean;
  showHelpLinks?: boolean;
  showHeading?: boolean;
  isPrepaidAnnual?: boolean;
  onViewModelPricing?: () => void;
}

export function CreditPackSection({
  currentBalance = 0,
  canPurchase = true,
  onPurchaseComplete,
  showAnnualPrepayLink = false,
  showHelpLinks = true,
  showHeading = true,
  isPrepaidAnnual = false,
  onViewModelPricing,
}: CreditPackSectionProps) {
  const t = useTranslations('billing');
  const locale = useLocale();
  const { user } = useAuth();
  const { currency } = useUserCurrency();
  const { packages } = useCreditPackages();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CreditPaymentMethod | null>(null);
  const resolvedPaymentMethod: CreditPaymentMethod =
    paymentMethod ?? (locale?.startsWith('zh') ? 'alipay' : 'card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPackage = useMemo(() => {
    if (selectedAmount != null) {
      return packages.find((pkg) => pkg.amount === selectedAmount) || defaultCreditPackage(packages);
    }
    return defaultCreditPackage(packages);
  }, [packages, selectedAmount]);

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!user) {
      const returnUrl = typeof window !== 'undefined' ? window.location.href : '/pricing';
      window.location.href = `/auth?mode=signup&returnUrl=${encodeURIComponent(returnUrl)}`;
      return;
    }
    if (!canPurchase) {
      setError(t('creditPurchase.notAvailableAlert'));
      return;
    }

    setSelectedAmount(pkg.amount);
    setIsProcessing(true);
    setError(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await billingApi.purchaseCredits({
        amount: pkg.amount,
        success_url: `${origin}/dashboard?credit_purchase=success`,
        cancel_url: typeof window !== 'undefined' ? window.location.href : `${origin}/pricing`,
        payment_method: resolvedPaymentMethod,
        locale: locale?.startsWith('zh') ? 'zh' : 'en',
      });
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
        onPurchaseComplete?.();
      } else {
        throw new Error(t('creditPurchase.noCheckoutUrl'));
      }
    } catch (err: unknown) {
      const errorMessage =
        (err as { details?: { detail?: string }; message?: string })?.details?.detail ||
        (err as Error)?.message ||
        t('creditPurchase.checkoutSessionFailed');
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={cn('w-full max-w-5xl mx-auto', showHeading && 'mb-10 sm:mb-12')}>
      {showHeading && (
        <div className="mb-5 sm:mb-6">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {t('creditPurchase.sectionTitle')}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
              {t('creditPurchase.sectionSubtitle')}
            </p>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
              {t('creditPurchase.plusBenefits')}
            </p>
            {currentBalance > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('creditPurchase.currentBalance')}{' '}
                {formatCredits(currentBalance, { showDecimals: true })}
              </p>
            )}
          </div>
          {showHelpLinks && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Button
                variant="link"
                asChild
                className="text-muted-foreground hover:text-foreground h-auto p-0"
              >
                <Link href="/credits-explained" target="_blank" rel="noopener noreferrer">
                  <Lightbulb className="h-3.5 w-3.5 mr-2" />
                  <span className="text-sm">{t('creditsExplained')}</span>
                </Link>
              </Button>
              <Button
                variant="link"
                onClick={onViewModelPricing}
                className="text-muted-foreground hover:text-foreground h-auto p-0"
              >
                <Cpu className="h-3.5 w-3.5 mr-2" />
                <span className="text-sm">{t('modelPricing.viewLink')}</span>
              </Button>
            </div>
          )}
        </div>
      )}

      <CreditPaymentMethodPicker
        value={resolvedPaymentMethod}
        onChange={setPaymentMethod}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4">
        {packages.map((pkg) => {
          const isSelected = selectedPackage.amount === pkg.amount;
          return (
            <div
              key={pkg.amount}
              className={cn(
                'rounded-[14px] sm:rounded-[18px] flex flex-col bg-card border border-border overflow-hidden',
                isSelected && 'ring-2 ring-primary'
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedAmount(pkg.amount);
                  setError(null);
                }}
                className="flex flex-col items-start text-left p-4 sm:p-5 gap-2 flex-1"
              >
                <div className="flex items-center justify-between w-full gap-2 min-h-[24px]">
                  {pkg.popular ? (
                    <span className="text-[10px] sm:text-xs font-medium text-primary-foreground bg-primary px-2.5 py-1 rounded-full">
                      {t('pricingUi.mostPopular')}
                    </span>
                  ) : (
                    <span />
                  )}
                  {pkg.bonus_percent > 0 && (
                    <span className="text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/15 border border-green-500/30 px-2.5 py-1 rounded-full">
                      {t('creditPurchase.extraPercent', { percent: pkg.bonus_percent })}
                    </span>
                  )}
                </div>
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  {formatPrice(pkg.amount, currency)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('creditPurchase.creditsPackLabel', {
                    count: formatCredits(pkg.total_credits),
                  })}
                </div>
              </button>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                <Button
                  className="w-full h-10 sm:h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={isProcessing || (!canPurchase && !!user)}
                  onClick={() => handlePurchase(pkg)}
                >
                  {isProcessing && isSelected ? (
                    <>
                      <DobbyLoader size="small" className="mr-2" />
                      {t('creditPurchase.processing')}
                    </>
                  ) : (
                    t('creditPurchase.buyNow')
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function CreditPaymentMethodPicker({
  value,
  onChange,
}: {
  value: CreditPaymentMethod;
  onChange: (value: CreditPaymentMethod) => void;
}) {
  const t = useTranslations('billing');
  const id = useId();
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{t('creditPurchase.paymentMethod')}</Label>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as CreditPaymentMethod)}
        className="grid gap-2 sm:grid-cols-3"
      >
        <Label
          htmlFor={`${id}-card`}
          className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
        >
          <RadioGroupItem value="card" id={`${id}-card`} />
          <CreditCard className="h-4 w-4" />
          <span>{t('creditPurchase.payCard')}</span>
        </Label>
        <Label
          htmlFor={`${id}-alipay`}
          className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
        >
          <RadioGroupItem value="alipay" id={`${id}-alipay`} />
          <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-blue-600 text-[9px] font-semibold text-white">
            A
          </span>
          <span>{t('creditPurchase.payAlipay')}</span>
        </Label>
        <Label
          htmlFor={`${id}-wechat`}
          className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
        >
          <RadioGroupItem value="wechat_pay" id={`${id}-wechat`} />
          <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-green-600 text-[9px] font-semibold text-white">
            W
          </span>
          <span>{t('creditPurchase.payWeChatPay')}</span>
        </Label>
      </RadioGroup>
    </div>
  );
}
