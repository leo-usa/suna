'use client';

import React from 'react';
import {createClient} from "@/lib/supabase/server";
import AccountBillingStatus from "@/components/billing/account-billing-status";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { getDictionary } from '@/app/[locale]/getDictionary';

const returnUrl = process.env.NEXT_PUBLIC_URL as string;

type AccountParams = {
  accountSlug: string;
};

export default async function TeamBillingPage({ params }: { params: Promise<AccountParams> }) {
    const unwrappedParams = await params;
    const { accountSlug } = unwrappedParams;
    const dict = await getDictionary('en');
    const [teamAccount, setTeamAccount] = React.useState<any>(null);
    const [error, setError] = React.useState<string | null>(null);
    
    React.useEffect(() => {
        async function loadData() {
            try {
                const supabaseClient = await createClient();
                const {data} = await supabaseClient.rpc('get_account_by_slug', {
                    slug: accountSlug
                });
                setTeamAccount(data);
            } catch (err) {
                setError(dict['billing.failed_to_load_account'] || "Failed to load account data");
                console.error(err);
            }
        }
        
        loadData();
    }, [accountSlug, dict]);
    
    if (error) {
        return (
            <Alert variant="destructive" className="border-red-300 dark:border-red-800 rounded-xl">
                <AlertTitle>{dict['error'] || 'Error'}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }
    
    if (!teamAccount) {
        return <div>{dict['loading'] || 'Loading...'}</div>;
    }

    if (teamAccount.account_role !== 'owner') {
        return (
            <Alert variant="destructive" className="border-red-300 dark:border-red-800 rounded-xl">
                <AlertTitle>{dict['billing.access_denied'] || 'Access Denied'}</AlertTitle>
                <AlertDescription>{dict['billing.no_permission'] || 'You do not have permission to access this page.'}</AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-card-title">{dict['billing.team_billing'] || 'Team Billing'}</h3>
                <p className="text-sm text-foreground/70">
                    {dict['billing.manage_team_subscription'] || "Manage your team's subscription and billing details."}
                </p>
            </div>
            
            <AccountBillingStatus 
                accountId={teamAccount.account_id} 
                returnUrl={`${returnUrl}/${accountSlug}/settings/billing`} 
                dict={dict}
            />
        </div>
    )
}