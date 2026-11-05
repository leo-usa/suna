'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { UI_DENSITIES, useUiDensityStore } from '@/stores/ui-density-store';

const previews = {
  default: { spacing: 'gap-3', rows: 2 },
  dense: { spacing: 'gap-2', rows: 3 },
  compact: { spacing: 'gap-1', rows: 4 },
} as const;

export function DensitySelector() {
  const t = useTranslations('settings.general.density');
  const id = useId();
  const density = useUiDensityStore((state) => state.density);
  const setDensity = useUiDensityStore((state) => state.setDensity);

  return (
    <fieldset className="min-w-0 space-y-3 border-t border-border pt-6">
      <legend className="mb-1 w-full text-base font-medium text-foreground">{t('title')}</legend>
      <p id={`${id}-description`} className="text-sm text-muted-foreground">
        {t('description')}
      </p>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-describedby={`${id}-description`}
      >
        {UI_DENSITIES.map((option) => (
          <label key={option} className="relative cursor-pointer">
            <input
              type="radio"
              name={`${id}-density`}
              value={option}
              checked={density === option}
              onChange={() => setDensity(option)}
              className="peer sr-only"
              aria-describedby={`${id}-${option}-description`}
            />
            <div className="h-full min-h-11 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40 peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring dark:peer-checked:border-foreground/60">
              <div
                aria-hidden="true"
                className={`mb-3 flex h-20 flex-col justify-center overflow-hidden rounded border border-border/60 bg-muted/30 p-2 ${previews[option].spacing}`}
              >
                {Array.from({ length: previews[option].rows }, (_, row) => (
                  <div key={row} className="flex shrink-0 items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-muted-foreground/30" />
                    <div className="h-1.5 w-3/4 rounded-sm bg-muted-foreground/30" />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    density === option
                      ? 'border-primary dark:border-foreground'
                      : 'border-muted-foreground'
                  }`}
                >
                  {density === option && (
                    <span className="h-2 w-2 rounded-full bg-primary dark:bg-foreground" />
                  )}
                </span>
                {t(`${option}.label`)}
              </div>
              <p
                id={`${id}-${option}-description`}
                className="mt-1 text-xs text-muted-foreground"
              >
                {t(`${option}.description`)}
              </p>
            </div>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('savedAutomatically')}</p>
    </fieldset>
  );
}
