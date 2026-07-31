'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ModelPricingTable } from './model-pricing-table';

interface ModelPricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelPricingModal({ open, onOpenChange }: ModelPricingModalProps) {
  const t = useTranslations('billing.modelPricing');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-medium">{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <ModelPricingTable compact />
        </div>
      </DialogContent>
    </Dialog>
  );
}
