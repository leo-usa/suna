'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import i18n, { initI18n } from '@/lib/i18n';

// Ensure i18n is initialized with the correct language on the client
initI18n();

export default function ClientI18nSync() {
  const pathname = usePathname();
  const [, setRerender] = useState(0); // dummy state to force rerender
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const lng = localStorage.getItem('i18nextLng') || 'en';
      if (i18n.language !== lng) {
        i18n.changeLanguage(lng).then(() => setRerender(x => x + 1));
      }
      // Listen for global languageChanged events
      const handler = (e: CustomEvent) => {
        if (e.detail && typeof e.detail === 'string' && i18n.language !== e.detail) {
          i18n.changeLanguage(e.detail).then(() => setRerender(x => x + 1));
        }
      };
      window.addEventListener('languageChanged', handler as EventListener);
      return () => window.removeEventListener('languageChanged', handler as EventListener);
    }
  }, [pathname]);
  return null;
} 