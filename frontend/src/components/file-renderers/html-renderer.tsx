'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CodeRenderer } from './code-renderer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Monitor, Code, ExternalLink, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HtmlRendererProps {
  content: string;
  previewUrl: string;
  className?: string;
  onEdit?: () => void;
}

export function HtmlRenderer({
  content,
  previewUrl,
  className,
  onEdit,
}: HtmlRendererProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inject HTML content directly into iframe when in preview mode
  useEffect(() => {
    if (viewMode === 'preview' && iframeRef.current && content) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      if (doc) {
        // Calculate the base URL for relative assets
        let baseUrl = '';
        if (previewUrl) {
          try {
            const url = new URL(previewUrl);
            baseUrl = url.origin + url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
          } catch (e) {
            console.warn('Could not parse preview URL for base tag:', e);
          }
        }

        // Inject the <base> tag into the HTML string
        let finalHtml = content;
        if (baseUrl) {
          const headTag = /<head[^>]*>/i;
          if (headTag.test(finalHtml)) {
            finalHtml = finalHtml.replace(headTag, `$&<base href="${baseUrl}">`);
          } else {
            // Fallback if no head tag exists
            finalHtml = `<head><base href="${baseUrl}"></head>` + finalHtml;
          }
        }

        // Write the HTML content directly to the iframe document
        doc.open();
        doc.write(finalHtml);
        doc.close();
      }
    }
  }, [viewMode, content, previewUrl]);

  return (
    <div className={cn('w-full h-full flex flex-col', className)}>
      {/* Content area */}
      <div className="flex-1 min-h-0 relative">
        {/* View mode toggle */}
        <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90',
              viewMode === 'preview' && 'bg-background/90',
            )}
            onClick={() => setViewMode('preview')}
          >
            <Monitor className="h-4 w-4" />
            {t('editor.preview', 'Preview')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90',
              viewMode === 'code' && 'bg-background/90',
            )}
            onClick={() => setViewMode('code')}
          >
            <Code className="h-4 w-4" />
            {t('editor.code', 'Code')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
            onClick={() => window.open(previewUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            {t('editor.open', 'Open')}
          </Button>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
              {t('editor.edit', 'Edit')}
            </Button>
          )}
        </div>

        {viewMode === 'preview' ? (
          <div className="absolute inset-0">
            <iframe
              ref={iframeRef}
              title="HTML Preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        ) : (
          <div className="absolute inset-0">
            <CodeRenderer
              content={content}
              language="html"
              className="w-full h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
