'use client';
import { useEffect } from 'react';
import i18n from '@/lib/i18n';

export default function ClientI18nSync() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const lng = localStorage.getItem('i18nextLng') || 'en';
      if (i18n.language !== lng) {
        i18n.changeLanguage(lng);
      }
    }
  }, []);
  return null;
} 