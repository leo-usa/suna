'use client';

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";

interface BillingErrorAlertProps {
  message?: string;
  currentUsage?: number;
  limit?: number;
  accountId?: string | null;
  onDismiss: () => void;
  isOpen: boolean;
  dict: Record<string, string>;
}

export function BillingErrorAlert({
  message,
  currentUsage,
  limit,
  accountId,
  onDismiss,
  isOpen,
  dict
}: BillingErrorAlertProps) {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = (key: string) => dict[key] || key;

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 shadow-lg max-w-md">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-destructive mb-1">{t('billing.usage_limit_reached')}</h3>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onDismiss}
                className="text-xs"
              >
                {t('dismiss')}
              </Button>
              <Button
                size="sm"
                onClick={() => router.push(`/${locale}/settings/billing?accountId=${accountId}`)}
                className="text-xs"
              >
                {t('billing.upgrade_plan')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 