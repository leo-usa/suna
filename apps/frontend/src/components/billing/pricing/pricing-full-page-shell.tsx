'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DobbyLogo } from '@/components/sidebar/dobby-logo';
import { cn } from '@/lib/utils';

interface PricingFullPageShellProps {
  children: React.ReactNode;
  onClose?: () => void;
  closeHref?: string;
  className?: string;
  /** When true, covers the viewport (standalone route). When false, fills the parent (dialog). */
  asPage?: boolean;
}

export function PricingFullPageShell({
  children,
  onClose,
  closeHref = '/dashboard',
  className,
  asPage = false,
}: PricingFullPageShellProps) {
  const router = useRouter();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.push(closeHref);
    }
  };

  return (
    <div
      className={cn(
        asPage && 'fixed inset-0 z-50 flex flex-col bg-background',
        !asPage && 'relative flex h-full w-full flex-col bg-background',
        className,
      )}
    >
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 lg:py-3 pointer-events-none bg-background/80 backdrop-blur-md">
        <div className="flex-1" />

        <div className="absolute -translate-y-1/2 top-1/2 left-1/2 -translate-x-1/2 pointer-events-none">
          <DobbyLogo size={18} className="sm:w-5 sm:h-5" variant="logomark" />
        </div>

        <div className="flex-1 flex justify-end pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 border border-border/50 transition-all"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-background pt-[60px] sm:pt-[67px] lg:flex lg:justify-center">
        <div className="lg:scale-90 xl:scale-100 lg:origin-top w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-4 sm:pt-8 lg:pt-0 pb-6 sm:pb-8 lg:pb-0 min-h-full lg:min-h-0 lg:my-auto flex items-center justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
