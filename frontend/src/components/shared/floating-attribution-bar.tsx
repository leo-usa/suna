'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

export function FloatingAttributionBar() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
        aria-label="Show Dobby"
        title="Show Dobby"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-red-200/50 dark:border-red-900/50 rounded-xl shadow-lg p-4 max-w-sm hover:shadow-xl transition-all duration-300"
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        lineHeight: '1.4',
      }}
    >
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors duration-200"
        aria-label="Close"
      >
        <X className="h-3 w-3" />
      </button>

      <a
        href="https://dobby.now"
        target="_blank"
        rel="noopener noreferrer"
        className="block no-underline text-foreground"
      >
        <div className="flex items-center mb-3">
          <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mr-2 shadow-sm">
            <span className="text-white text-xs font-bold">D</span>
          </div>
          <span className="font-bold text-red-600 dark:text-red-400">DOBBY</span>
        </div>

        <div className="text-sm mb-3 text-muted-foreground">
          {t('communityPost.floatingBar.researchReport', 'This was created by Dobby AI agent')}
        </div>

        <div className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">
          {t('communityPost.floatingBar.tagline', 'Dobby, your AI assistant')}
        </div>

        <div className="text-sm mb-3 text-muted-foreground">
          {t('communityPost.floatingBar.description', 'Helps you with research, writing reports, building websites, creating PPTs')}
        </div>

        <div className="text-sm text-primary hover:underline mb-2 transition-colors duration-200">
          {t('communityPost.floatingBar.visitHomepage', 'Visit Dobby homepage')}
        </div>

        <div className="text-xs text-muted-foreground">
          {t('communityPost.floatingBar.website', 'Website: https://dobby.now')}
        </div>
      </a>
    </div>
  );
}
