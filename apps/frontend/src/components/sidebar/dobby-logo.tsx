'use client';

import { cn } from '@/lib/utils';

interface DobbyLogoProps {
  size?: number;
  variant?: 'symbol' | 'logomark';
  className?: string;
}

export function DobbyLogo({ size = 24, variant = 'symbol', className }: DobbyLogoProps) {
  // White Dobby symbol; invert for light mode (no JS needed)
  if (variant === 'logomark') {
    return (
      <img
        src="/dobby-logomark-white.svg"
        alt="Dobby"
        className={cn('invert dark:invert-0 flex-shrink-0', className)}
        style={{ height: `${size}px`, width: 'auto' }}
        suppressHydrationWarning
      />
    );
  }

  // Default symbol variant behavior - invert for dark mode
  return (
    <img
      src="/dobby-symbol.svg"
      alt="Dobby"
      className={cn('dark:invert flex-shrink-0', className)}
      style={{ width: `${size}px`, height: `${size}px` }}
      suppressHydrationWarning
    />
  );
}
