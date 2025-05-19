import { useEffect, useState } from 'react';
import i18n from '@/lib/i18n';

export function useI18nReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const lng = typeof window !== 'undefined' ? localStorage.getItem('i18nextLng') || 'en' : 'en';
    if (i18n.language === lng) {
      setReady(true);
    } else {
      i18n.changeLanguage(lng).then(() => setReady(true));
    }
  }, []);

  return ready;
} 