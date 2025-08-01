'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export const AgentsPageHeader = () => {
  const { t } = useTranslation();
  
  return (
    <PageHeader icon={Bot}>
      <div className="space-y-4">
        <div className="text-4xl font-semibold tracking-tight">
          <span className="text-primary">{t('marketplace.aiAgents', 'AI Agents')}</span> = <span className="text-primary">{t('marketplace.aiEmployees', 'AI Employee´s')}</span>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t('marketplace.exploreAndCreate', 'Explore and create your own custom agents that combine')}{' '}
          <span className="text-foreground font-medium">{t('marketplace.integrations', 'integrations')}</span>,{' '}
          <span className="text-foreground font-medium">{t('marketplace.instructions', 'instructions')}</span>,{' '}
          <span className="text-foreground font-medium">{t('marketplace.knowledge', 'knowledge')}</span>,{' '}
          <span className="text-foreground font-medium">{t('marketplace.triggers', 'triggers')}</span> {t('marketplace.and', 'and')}{' '}
          <span className="text-foreground font-medium">{t('marketplace.workflows', 'workflows')}</span>.
        </p>
      </div>
    </PageHeader>
  );
};
