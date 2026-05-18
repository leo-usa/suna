import { createTranslator } from 'next-intl';
import {
  extractTierLimitErrorState,
  formatTierLimitErrorForUI,
  type TierLimitErrorState,
  type TierLimitErrorUI,
} from '@/lib/api/errors';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { loadMessages } from '@/i18n/load-messages';

function getClientLocale(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }
  const stored = localStorage.getItem('locale');
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale;
  }
  return defaultLocale;
}

function localizeFromState(
  state: TierLimitErrorState,
  t: ReturnType<typeof createTranslator>,
): TierLimitErrorUI {
  switch (state.type) {
    case 'THREAD_LIMIT_EXCEEDED':
      return {
        alertTitle: t('limitAlerts.thread.title'),
        alertSubtitle:
          state.currentCount != null && state.limit != null
            ? t('limitAlerts.thread.subtitleWithCounts', {
                current: state.currentCount,
                limit: state.limit,
              })
            : t('limitAlerts.thread.subtitle'),
      };
    case 'AGENT_RUN_LIMIT_EXCEEDED':
      return {
        alertTitle: t('limitAlerts.concurrentRuns.title'),
        alertSubtitle: t('limitAlerts.concurrentRuns.subtitle'),
      };
    case 'PROJECT_LIMIT_EXCEEDED':
      return {
        alertTitle: t('limitAlerts.project.title'),
        alertSubtitle:
          state.currentCount != null && state.limit != null
            ? t('limitAlerts.project.subtitleWithCounts', {
                current: state.currentCount,
                limit: state.limit,
              })
            : t('limitAlerts.project.subtitle'),
      };
    case 'AGENT_LIMIT_EXCEEDED':
      return {
        alertTitle: t('limitAlerts.workers.title'),
        alertSubtitle: t('limitAlerts.workers.subtitle'),
      };
    case 'TRIGGER_LIMIT_EXCEEDED':
      return {
        alertTitle: t('limitAlerts.trigger.title'),
        alertSubtitle:
          state.currentCount != null && state.limit != null
            ? t('limitAlerts.trigger.subtitleWithCounts', {
                current: state.currentCount,
                limit: state.limit,
              })
            : t('limitAlerts.trigger.subtitle'),
      };
    case 'MODEL_ACCESS_DENIED':
      return {
        alertTitle: t('limitAlerts.modelAccess.title'),
        alertSubtitle: t('limitAlerts.modelAccess.subtitle'),
      };
    case 'CUSTOM_WORKER_LIMIT_EXCEEDED':
      return {
        alertTitle: t('limitAlerts.customWorkers.title'),
        alertSubtitle:
          state.currentCount != null && state.limit != null
            ? t('limitAlerts.customWorkers.subtitleWithCounts', {
                current: state.currentCount,
                limit: state.limit,
              })
            : t('limitAlerts.customWorkers.subtitle'),
      };
    case 'INSUFFICIENT_CREDITS':
      return {
        alertTitle: t('limitAlerts.insufficientCredits.title'),
        alertSubtitle: t('limitAlerts.insufficientCredits.subtitle'),
      };
    case 'BILLING_ERROR':
      return {
        alertTitle: t('limitAlerts.billingCheck.title'),
        alertSubtitle: t('limitAlerts.billingCheck.subtitle'),
      };
    default:
      return {
        alertTitle: t('limitReachedUpgrade'),
        alertSubtitle: state.message || t('limitAlerts.billingCheck.subtitle'),
      };
  }
}

/** Localized pricing-modal copy for tier / billing restriction errors (client only). */
export function getLocalizedTierErrorForUI(error: unknown): TierLimitErrorUI | null {
  const state = extractTierLimitErrorState(error);
  if (!state) {
    return null;
  }

  try {
    const locale = getClientLocale();
    const messages = loadMessages(locale);
    const t = createTranslator({ locale, messages, namespace: 'billing' });
    return localizeFromState(state, t);
  } catch {
    return formatTierLimitErrorForUI(state);
  }
}
