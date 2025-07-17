'use client';

import { useAuth } from "@/components/AuthProvider";
import AccountBillingStatus from "@/components/billing/account-billing-status";

const returnUrl = process.env.NEXT_PUBLIC_URL as string;

export default function PersonalAccountBillingPage() {
    const { session, isLoading } = useAuth();

    // Adjust this line if your session exposes account_id differently
    const accountId = session?.user?.id;

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!accountId) {
        return <div>No personal account found. Please check your login status.</div>;
    }

    return (
        <div>
            <AccountBillingStatus accountId={accountId} returnUrl={`${returnUrl}/settings/billing`} />
        </div>
    );
}