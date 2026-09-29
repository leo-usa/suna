'use client';

import React, { useState, useEffect, memo } from 'react';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { useTranslations } from 'next-intl';

interface StreamingLoaderProps {
  message?: string;
  className?: string;
}

export const StreamingLoader = memo(function StreamingLoader({
  message,
  className,
}: StreamingLoaderProps) {
  const t = useTranslations('toolViews.shared');
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center justify-center h-full w-full min-h-[300px] ${className || ''}`}>
      <div className="flex flex-col items-center gap-4">
        <DobbyLoader customSize={32} speed={1} />
        <span className="text-sm text-muted-foreground">
          {message || t('generatingContent')}{dots}
        </span>
      </div>
    </div>
  );
});

StreamingLoader.displayName = 'StreamingLoader';

