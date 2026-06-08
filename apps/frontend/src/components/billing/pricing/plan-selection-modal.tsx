'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { PricingSection } from './pricing-section';
import { PricingFullPageShell } from './pricing-full-page-shell';
import { cn } from '@/lib/utils';
import { usePricingModalStore } from '@/stores/pricing-modal-store';
import { trackRouteChangeForModal } from '@/lib/analytics/gtm';
import { backendApi } from '@/lib/api-client';

interface PlanSelectionModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    returnUrl?: string;
    creditsExhausted?: boolean;
    upgradeReason?: string;
}

export function PlanSelectionModal({
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    returnUrl: controlledReturnUrl,
    creditsExhausted = false,
    upgradeReason: controlledUpgradeReason,
}: PlanSelectionModalProps) {
    const defaultReturnUrl = typeof window !== 'undefined' ? `${window.location.origin}/dashboard?subscription=success` : '/';

    const { isOpen: storeIsOpen, customTitle: storeCustomTitle, returnUrl: storeReturnUrl, closePricingModal, isAlert: storeIsAlert, alertTitle: storeAlertTitle, alertSubtitle: storeAlertSubtitle } = usePricingModalStore();

    const isOpen = controlledOpen !== undefined ? controlledOpen : storeIsOpen;
    const onOpenChange = controlledOnOpenChange || ((open: boolean) => !open && closePricingModal());
    const returnUrl = controlledReturnUrl || storeReturnUrl || defaultReturnUrl;
    const displayReason = controlledUpgradeReason || storeCustomTitle;

    // Track when Plans modal opens (for GTM and funnel analytics)
    React.useEffect(() => {
        if (isOpen) {
            trackRouteChangeForModal('plans');
            // Track in database for funnel analytics (fire and forget)
            backendApi.post('/billing/track-pricing-view', null, { showErrors: false });
        }
    }, [isOpen]);

    // Note: Checkout success detection is handled by dashboard-content.tsx
    // The modal just needs to close after subscription updates

    const handleSubscriptionUpdate = () => {
        // Let the dashboard handle cache invalidation - just close the modal
        setTimeout(() => {
            onOpenChange(false);
        }, 500);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent 
                className={cn(
                    "max-w-[100vw] w-full h-full max-h-[100vh] p-0 gap-0 overflow-hidden",
                    "rounded-none border-0",
                    "!top-0 !left-0 !translate-x-0 !translate-y-0 !max-w-none"
                )}
                hideCloseButton={true}
            >
                <DialogTitle className="sr-only">
                    {displayReason || (creditsExhausted ? 'You\'re out of credits' : 'Select a Plan')}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    {displayReason || (creditsExhausted ? 'Choose a plan to continue using Dobby' : 'Choose the plan that best fits your needs')}
                </DialogDescription>
                <PricingFullPageShell onClose={() => onOpenChange(false)}>
                    <PricingSection
                        returnUrl={returnUrl || defaultReturnUrl}
                        showTitleAndTabs={true}
                        insideDialog={false}
                        noPadding={true}
                        customTitle={displayReason || (creditsExhausted ? "You ran out of credits. Upgrade now." : undefined)}
                        isAlert={storeIsAlert}
                        alertTitle={storeAlertTitle}
                        alertSubtitle={storeAlertSubtitle}
                        onSubscriptionUpdate={handleSubscriptionUpdate}
                        showBuyCredits={true}
                    />
                </PricingFullPageShell>
            </DialogContent>
        </Dialog>
    );
}

