'use client';

import { useAccounts } from '@/hooks/use-accounts';
import UsageLogs from '@/components/billing/usage-logs';
import { Skeleton } from '@/components/ui/skeleton';

export default function UsageLogsPage() {
  const { data: accounts, isLoading, error } = useAccounts();
  const personalAccount = accounts?.find((account) => account.personal_account);

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="rounded-xl border shadow-sm bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Usage Logs</h2>
        <div className="p-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
          <p className="text-sm text-destructive">
            Error loading account data: {error.message}
          </p>
        </div>
      </div>
    );
  }

  // Show error if no personal account found
  if (!personalAccount) {
    return (
      <div className="rounded-xl border shadow-sm bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Usage Logs</h2>
        <div className="p-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
          <p className="text-sm text-destructive">
            Personal account not found. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UsageLogs accountId={personalAccount.account_id} />
    </div>
  );
}
