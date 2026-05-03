'use client';

import { FileText, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';

export default function KnowledgeRoute() {
  const t = useTranslations('settings.knowledgeBase');

  return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <div className="container mx-auto max-w-2xl px-3 sm:px-4 py-6 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-2 sm:gap-3 justify-center">
            <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold">{t('title')}</h1>
          </div>

          <Alert className="border-primary/20 bg-primary/5">
            <Sparkles className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong className="text-foreground">{t('comingSoonTitle')}</strong>
              <p className="text-muted-foreground mt-1">
                {t('comingSoonDescription')}
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
