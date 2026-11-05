'use client';

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export const UI_DENSITIES = ['default', 'dense', 'compact'] as const;
export type UiDensity = (typeof UI_DENSITIES)[number];

/** Map legacy preference values from the earlier Comfortable experiment. */
const LEGACY_DENSITY: Record<string, UiDensity> = {
  comfortable: 'dense',
};

export function isUiDensity(value: unknown): value is UiDensity {
  return UI_DENSITIES.some((density) => density === value);
}

export function normalizeUiDensity(value: unknown): UiDensity {
  if (isUiDensity(value)) return value;
  if (typeof value === 'string' && LEGACY_DENSITY[value]) return LEGACY_DENSITY[value];
  return 'default';
}

const storage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      return;
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      return;
    }
  },
};

interface UiDensityState {
  density: UiDensity;
  setDensity: (density: UiDensity) => void;
}

export const useUiDensityStore = create<UiDensityState>()(
  persist(
    (set) => ({
      density: 'default',
      setDensity: (density) => {
        set({ density: normalizeUiDensity(density) });
      },
    }),
    {
      name: 'dobby-ui-density',
      storage: createJSONStorage(() => storage),
      partialize: ({ density }) => ({ density }),
      skipHydration: true,
      merge: (persisted, current) => {
        const density = (persisted as Partial<UiDensityState> | null)?.density;
        return { ...current, density: normalizeUiDensity(density) };
      },
    },
  ),
);
