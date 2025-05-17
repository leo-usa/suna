"use client";

import React from 'react';
import AccountBillingStatus from "@/components/billing/account-billing-status";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface TeamBillingClientProps {
  teamAccount: any;
  dict: Record<string, string>;
  returnUrl: string;
}

const TeamBillingClient: React.FC<TeamBillingClientProps> = ({ teamAccount, dict, returnUrl }) => {
  // Defensive t function
  const t = (key: string) => (dict && dict[key]) || key;

  if (!teamAccount) {
    return <div>{t('loading')}</div>;
  }

  if (teamAccount.account_role !== 'owner') {
    return (
      <Alert variant="destructive" className="border-red-300 dark:border-red-800 rounded-xl">
        <AlertTitle>{t('billing.access_denied')}</AlertTitle>
        <AlertDescription>{t('billing.no_permission')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-card-title">{t('billing.team_billing')}</h3>
        <p className="text-sm text-foreground/70">
          {t('billing.manage_team_subscription')}
        </p>
      </div>
      <AccountBillingStatus 
        accountId={teamAccount.account_id} 
        returnUrl={returnUrl} 
        dict={dict}
      />
    </div>
  );
};

export default TeamBillingClient; 