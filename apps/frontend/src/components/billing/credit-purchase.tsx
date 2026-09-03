'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCredits } from '@agentpress/shared';
import { useTranslations } from 'next-intl';
import { CreditPackSection } from '@/components/billing/credit-pack-section';

interface CreditPurchaseProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentBalance?: number;
    canPurchase: boolean;
    onPurchaseComplete?: () => void;
}

export function CreditPurchaseModal({
    open,
    onOpenChange,
    currentBalance = 0,
    canPurchase,
    onPurchaseComplete
}: CreditPurchaseProps) {
    const t = useTranslations('billing');
    const tClose = useTranslations('common');

    if (!canPurchase) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('creditPurchase.notAvailableTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('creditPurchase.notAvailableDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {t('creditPurchase.notAvailableAlert')}
                        </AlertDescription>
                    </Alert>
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            {tClose('close')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('creditPurchase.title')}</DialogTitle>
                    <DialogDescription>
                        {t('creditPurchase.sectionSubtitle')}{' '}
                        {t('creditPurchase.plusBenefits')}
                    </DialogDescription>
                </DialogHeader>
                <CreditPackSection
                    currentBalance={currentBalance}
                    canPurchase={canPurchase}
                    onPurchaseComplete={onPurchaseComplete}
                    showHeading={false}
                    showHelpLinks={false}
                />
            </DialogContent>
        </Dialog>
    );
}

export function CreditBalanceDisplay({ balance, canPurchase, onPurchaseClick }: {
    balance: number;
    canPurchase: boolean;
    onPurchaseClick?: () => void;
}) {
    const t = useTranslations('billing');
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>{t('creditPurchase.creditBalanceTitle')}</span>
                    {canPurchase && onPurchaseClick && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onPurchaseClick}
                        >
                            {t('creditPurchase.addCredits')}
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
