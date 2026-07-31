'use client';

import { Cpu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ModelPricingTable } from './model-pricing-table';
import { ModelPricingModal } from './model-pricing-modal';
import { useState } from 'react';

interface ModelPricingSectionProps {
  /** When true, show a short teaser + open full table in a modal */
  modalOnly?: boolean;
}

export function ModelPricingSection({ modalOnly = false }: ModelPricingSectionProps) {
  const t = useTranslations('billing.modelPricing');
  const [open, setOpen] = useState(false);

  if (modalOnly) {
    return (
      <>
        <div className="w-full max-w-5xl mx-auto flex justify-center">
          <Button
            variant="link"
            onClick={() => setOpen(true)}
            className="text-muted-foreground hover:text-foreground h-auto p-0"
          >
            <Cpu className="h-3.5 w-3.5 mr-2" />
            <span className="text-sm">{t('viewLink')}</span>
          </Button>
        </div>
        <ModelPricingModal open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <section className="w-full max-w-5xl mx-auto mt-10 pb-4 space-y-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-foreground">
          <Cpu className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight">{t('title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          {t('subtitle')}
        </p>
      </div>
      <ModelPricingTable compact />
    </section>
  );
}
