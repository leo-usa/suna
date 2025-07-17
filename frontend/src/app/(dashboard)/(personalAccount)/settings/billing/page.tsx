'use client';

import { useAuth } from "@/components/AuthProvider";
import AccountBillingStatus from "@/components/billing/account-billing-status";
import { useTranslation } from "react-i18next";

const returnUrl = process.env.NEXT_PUBLIC_URL as string;

export default function PersonalAccountBillingPage() {
    const { session, isLoading } = useAuth();
    const { i18n } = useTranslation();

    const accountId = session?.user?.id;

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!accountId) {
        return <div>No personal account found. Please check your login status.</div>;
    }

    // Show prepaid tab by default if language is Chinese
    const defaultTab = i18n.language.startsWith("zh") ? "prepaid" : "subscription";

    return (
        <div>
            <AccountBillingStatus
                accountId={accountId}
                returnUrl={`${returnUrl}/settings/billing`}
                defaultTab={defaultTab}
            />
        </div>
    );
}