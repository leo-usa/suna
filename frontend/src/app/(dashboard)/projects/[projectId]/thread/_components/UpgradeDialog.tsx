import React from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Clock, Crown, Sparkles, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
}

export function UpgradeDialog({ open, onOpenChange, onDismiss }: UpgradeDialogProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleUpgradeClick = () => {
    router.push('/settings/billing');
    onOpenChange(false);
    localStorage.setItem('suna_upgrade_dialog_displayed', 'true');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Crown className="h-5 w-5 mr-2 text-primary" />
            {t('billing.upgradeDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('billing.upgradeDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            {t('billing.upgradeDialog.proBenefits')}
          </h3>

          <div className="space-y-3">
            <div className="flex items-start">
              <div className="rounded-full bg-secondary/10 p-2 flex-shrink-0 mt-0.5">
                <Brain className="h-4 w-4 text-secondary" />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {t('billing.upgradeDialog.advancedModels.title')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('billing.upgradeDialog.advancedModels.description')}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="rounded-full bg-secondary/10 p-2 flex-shrink-0 mt-0.5">
                <Zap className="h-4 w-4 text-secondary" />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {t('billing.upgradeDialog.fasterResponses.title')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('billing.upgradeDialog.fasterResponses.description')}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="rounded-full bg-secondary/10 p-2 flex-shrink-0 mt-0.5">
                <Clock className="h-4 w-4 text-secondary" />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {t('billing.upgradeDialog.higherUsageLimits.title')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('billing.upgradeDialog.higherUsageLimits.description')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onDismiss}>
            {t('billing.upgradeDialog.maybeLater')}
          </Button>
          <Button onClick={handleUpgradeClick}>
            <Sparkles className="h-4 w-4" />
            {t('billing.upgradeDialog.upgradeNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 