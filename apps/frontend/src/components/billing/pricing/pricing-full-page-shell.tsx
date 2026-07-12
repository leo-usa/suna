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
        !asPage && 'relative flex h-full min-h-0 w-full flex-col bg-background',
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

      {/*
        flex-1 min-h-0 + overflow-y-auto on the scrollport, and my-auto on the
        content: centers short content, but still allows scrolling when the
        plan cards are taller than the viewport (flex items-center clips the top).
      */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background flex flex-col pt-[60px] sm:pt-[67px]">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-8 my-auto lg:scale-90 xl:scale-100 lg:origin-top">
          {children}
        </div>
      </div>
    </div>
  );
}
