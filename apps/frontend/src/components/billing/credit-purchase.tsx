'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, CreditCard } from 'lucide-react';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { billingApi } from '@/lib/api/billing';
import { toast } from '@/lib/toast';
import { formatCredits } from '@agentpress/shared';
import { useUserCurrency } from '@/hooks/use-user-currency';
import { formatPrice } from '@/lib/utils/currency';
import { useLocale } from 'next-intl';

interface CreditPurchaseProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentBalance?: number;
    canPurchase: boolean;
    onPurchaseComplete?: () => void;
}

interface CreditPackage {
    amount: number;
    price: number;
    popular?: boolean;
}

type CreditPaymentMethod = 'card' | 'alipay' | 'wechat_pay';

const CREDIT_PACKAGES: CreditPackage[] = [
    { amount: 10, price: 10 },
    { amount: 25, price: 25 },
    { amount: 50, price: 50 },
    { amount: 100, price: 100, popular: true },
    { amount: 250, price: 250 },
    { amount: 500, price: 500 },
];

export function CreditPurchaseModal({
    open,
    onOpenChange,
    currentBalance = 0,
    canPurchase,
    onPurchaseComplete
}: CreditPurchaseProps) {
    const { currency } = useUserCurrency();
    const locale = useLocale();
    const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<CreditPaymentMethod>(
        locale?.startsWith('zh') ? 'alipay' : 'card'
    );
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePurchase = async (amount: number) => {
        if (amount < 10) {
            setError(`Minimum purchase amount is ${formatPrice(10, currency)}`);
            return;
        }
        if (amount > 5000) {
            setError(`Maximum purchase amount is ${formatPrice(5000, currency)}`);
            return;
        }
        setIsProcessing(true);
        setError(null);
        try {
            const response = await billingApi.purchaseCredits({
                amount: amount,
                success_url: `${window.location.origin}/dashboard?credit_purchase=success`,
                cancel_url: `${window.location.origin}/dashboard?credit_purchase=cancelled`,
                payment_method: paymentMethod,
                locale: locale?.startsWith('zh') ? 'zh' : 'en'
            });
            if (response.checkout_url) {
                window.location.href = response.checkout_url;
            } else {
                throw new Error('No checkout URL received');
            }
        } catch (err: any) {
            console.error('Credit purchase error:', err);
            const errorMessage = err.details?.detail || err.message || 'Failed to create checkout session';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePackageSelect = (pkg: CreditPackage) => {
        setSelectedPackage(pkg);
        setCustomAmount('');
        setError(null);
    };

    const handleCustomAmountChange = (value: string) => {
        setCustomAmount(value);
        setSelectedPackage(null);
        setError(null);
    };

    const handleConfirmPurchase = () => {
        const amount = selectedPackage ? selectedPackage.amount : parseFloat(customAmount);
        if (!isNaN(amount)) {
            handlePurchase(amount);
        } else {
            setError('Please select a package or enter a valid amount');
        }
    };

    if (!canPurchase) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Credits Not Available</DialogTitle>
                        <DialogDescription>
                            Prepaid credits are not available for this account right now.
                        </DialogDescription>
                    </DialogHeader>
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Please refresh the page or contact support if you believe this is a mistake.
                        </AlertDescription>
                    </Alert>
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Get additional credits</DialogTitle>
                    <DialogDescription>
                        Add prepaid credits to continue using Suna. Credits do not expire.
                    </DialogDescription>
                </DialogHeader>

                {currentBalance > 0 && (
                    <div className="text-sm text-muted-foreground">
                        Current balance: {formatCredits(currentBalance, { showDecimals: true })}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {CREDIT_PACKAGES.map((pkg) => (
                                <Card
                                    key={pkg.amount}
                                    className={`cursor-pointer transition-all ${selectedPackage?.amount === pkg.amount
                                        ? 'ring-2 ring-border'
                                        : 'hover:border-border/80'
                                        }`}
                                    onClick={() => handlePackageSelect(pkg)}
                                >
                                    <CardContent className="p-4 text-center">
                                        <div className="text-xl font-medium">{formatPrice(pkg.amount, currency)}</div>
                                        <div className="text-xs text-muted-foreground mt-1">Credits</div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Payment method</Label>
                        <RadioGroup
                            value={paymentMethod}
                            onValueChange={(value) => setPaymentMethod(value as CreditPaymentMethod)}
                            className="grid gap-2 sm:grid-cols-3"
                        >
                            <Label
                                htmlFor="credit-payment-card"
                                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                            >
                                <RadioGroupItem value="card" id="credit-payment-card" />
                                <CreditCard className="h-4 w-4" />
                                <span>Card</span>
                            </Label>
                            <Label
                                htmlFor="credit-payment-alipay"
                                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                            >
                                <RadioGroupItem value="alipay" id="credit-payment-alipay" />
                                <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-blue-600 text-[9px] font-semibold text-white">
                                    A
                                </span>
                                <span>Alipay</span>
                            </Label>
                            <Label
                                htmlFor="credit-payment-wechat"
                                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                            >
                                <RadioGroupItem value="wechat_pay" id="credit-payment-wechat" />
                                <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-green-600 text-[9px] font-semibold text-white">
                                    W
                                </span>
                                <span>WeChat Pay</span>
                            </Label>
                        </RadioGroup>
                    </div>
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>
                <div className="flex justify-center mt-6">
                    <Button
                        onClick={handleConfirmPurchase}
                        disabled={isProcessing || (!selectedPackage && !customAmount)}
                        className="w-full sm:w-auto min-w-[120px]"
                    >
                        {isProcessing ? (
                            <>
                                <DobbyLoader size="small" className="mr-2" />
                                Processing...
                            </>
                        ) : (
                            'Continue'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function CreditBalanceDisplay({ balance, canPurchase, onPurchaseClick }: {
    balance: number;
    canPurchase: boolean;
    onPurchaseClick?: () => void;
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>Credit Balance</span>
                    {canPurchase && onPurchaseClick && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onPurchaseClick}
                        >
                            Add Credits
                        </Button>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-medium">
                    {formatCredits(balance)}
                </div>
            </CardContent>
        </Card>
    );
}
