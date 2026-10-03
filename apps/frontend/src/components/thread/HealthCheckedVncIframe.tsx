'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { useVncPreloader } from '@/hooks/files';
import { cn } from '@/lib/utils';

interface HealthCheckedVncIframeProps {
  sandbox: {
    id: string;
    vnc_preview: string;
    pass: string;
  };
  className?: string;
  /** Prefer 1:1 mapping for login handoff so clicks/keys hit fields correctly. */
  interactive?: boolean;
  /** Show a one-line tip about focusing the remote desktop before typing. */
  showInputHint?: boolean;
}

/**
 * Build noVNC URL.
 *
 * IMPORTANT: vnc_lite.html assigns query values directly (no boolean parse).
 * `view_only=false` is the string "false", which is truthy → view-only ON
 * (clicks/keys blocked). Omit view_only entirely so the default boolean false applies.
 */
function buildVncSrc(vncPreview: string, pass: string, interactive: boolean) {
  const params = new URLSearchParams({
    password: pass,
    autoconnect: 'true',
  });
  // Always scale to fit the panel so the full remote desktop is visible
  // (login modals, phone verification, etc.).
  params.set('scale', 'true');
  return `${vncPreview}/vnc_lite.html?${params.toString()}`;
}

export function HealthCheckedVncIframe({ sandbox, className, interactive = false, showInputHint = false }: HealthCheckedVncIframeProps) {
  const [iframeKey] = useState(0);
  const [isBrowserLoading, setIsBrowserLoading] = useState(!interactive);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  
  const { status, retryCount, retry, isPreloaded } = useVncPreloader(sandbox, {
    maxRetries: 5,
    initialDelay: 1000,
    timeoutMs: 5000
  });

  const focusVnc = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.focus();
      iframe.contentWindow?.focus();
    } catch {
      // Cross-origin; iframe.focus() is enough for keyboard routing
    }
  }, []);

  useEffect(() => {
    if (!interactive) {
      if (isPreloaded && isBrowserLoading) {
        const timer = setTimeout(() => setIsBrowserLoading(false), 4000);
        return () => clearTimeout(timer);
      }
      return;
    }
    setIsBrowserLoading(false);
  }, [interactive, isPreloaded, isBrowserLoading]);

  useEffect(() => {
    if (!interactive) {
      setIsBrowserLoading(true);
    }
  }, [sandbox?.id, interactive]);

  useEffect(() => {
    if (!interactive || !isPreloaded) return;
    const timer = setTimeout(focusVnc, 300);
    return () => clearTimeout(timer);
  }, [interactive, isPreloaded, iframeKey, focusVnc]);

  if (status === 'loading') {
    return (
      <div className={`overflow-hidden m-2 sm:m-4 relative ${className || ''}`}>
        <Card className="p-0 overflow-hidden border">
          <div className='relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11] overflow-hidden bg-background flex flex-col items-center justify-center'>
            <DobbyLoader size="medium" className="mb-3" />
            <p className="text-sm font-medium text-center mb-2 text-foreground">Connecting to browser...</p>
            <p className="text-xs text-muted-foreground mb-2 text-center">
              Testing VNC connection
            </p>
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                🔄 Attempt {retryCount + 1}/5
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`overflow-hidden m-2 sm:m-4 relative ${className || ''}`}>
        <Card className="p-0 overflow-hidden border">
          <div className='relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11] overflow-hidden bg-destructive/10 flex flex-col items-center justify-center'>
            <AlertCircle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm font-medium text-center mb-2">Connection Failed</p>
            <p className="text-xs text-muted-foreground mb-4 text-center">
              Unable to connect to VNC server after 5 attempts
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isPreloaded) {
    const vncSrc = buildVncSrc(sandbox.vnc_preview, sandbox.pass, interactive);
    // Interactive: no CSS crop transform (that breaks click mapping).
    // Preview: crop browser chrome for a cleaner screenshot look.
    const iframeClassName = interactive
      ? 'absolute inset-0 w-full h-full border-0'
      : 'absolute inset-0 w-full h-full border-0 md:w-[102%] md:h-[130%] md:-translate-y-[4.4rem] lg:-translate-y-[4.7rem] xl:-translate-y-[5.4rem] md:left-0 md:-translate-x-2';

    return (
      <div className={cn('overflow-hidden m-2 sm:m-4 relative', className)}>
        <Card className="p-0 overflow-hidden border">
          {showInputHint && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/40">
              Click once inside the remote desktop, then type. If a popup is cut off, press Ctrl+- in the remote browser to zoom out, or drag the popup title bar up.
            </div>
          )}
          <div
            className="relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11] overflow-hidden bg-gray-100 dark:bg-gray-800"
            onMouseDown={focusVnc}
            onPointerDown={focusVnc}
          >
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={vncSrc}
              title="Browser preview"
              className={iframeClassName}
              allow="clipboard-read; clipboard-write"
              tabIndex={0}
              onLoad={focusVnc}
            />
            {isBrowserLoading && (
              <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <div className="flex flex-col items-center space-y-3">
                  <DobbyLoader size="medium" />
                  <p className="text-sm font-medium text-foreground">
                    Initializing browser...
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
