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
  sandboxUrl?: string; // Add sandbox URL for base tag extraction
  className?: string;
  onEdit?: () => void;
  // Add project context for asset resolution
  project?: {
    sandbox?: {
      sandbox_url?: string;
    };
  };
  fileName?: string;
}

export function HtmlRenderer({
  content,
  previewUrl,
  sandboxUrl,
  className,
  onEdit,
  project,
  fileName,
}: HtmlRendererProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Function to fetch and convert assets to data URIs
  const embedAssets = async (htmlContent: string): Promise<string> => {
    if (!project?.sandbox?.sandbox_url || !fileName) {
      return htmlContent;
    }

    try {
      // Extract relative asset references
      const cssRegex = /href=["']([^"']*\.css)["']/g;
      const imgRegex = /src=["']([^"']*\.(png|jpg|jpeg|gif|webp|svg))["']/g;
      
      let finalHtml = htmlContent;
      
      // Replace CSS references
      const cssMatches = [...htmlContent.matchAll(cssRegex)];
      for (const match of cssMatches) {
        const relativePath = match[1];
        if (relativePath.startsWith('./') || relativePath.startsWith('../') || !relativePath.startsWith('http')) {
          try {
            const cssUrl = `${project.sandbox.sandbox_url}/${relativePath}`;
            const response = await fetch(cssUrl);
            if (response.ok) {
              const cssContent = await response.text();
              const dataUri = `data:text/css;base64,${btoa(cssContent)}`;
              finalHtml = finalHtml.replace(`href="${relativePath}"`, `href="${dataUri}"`);
            }
          } catch (e) {
            console.warn(`Failed to embed CSS ${relativePath}:`, e);
          }
        }
      }
      
      // Replace image references
      const imgMatches = [...htmlContent.matchAll(imgRegex)];
      for (const match of imgMatches) {
        const relativePath = match[1];
        if (relativePath.startsWith('./') || relativePath.startsWith('../') || !relativePath.startsWith('http')) {
          try {
            const imgUrl = `${project.sandbox.sandbox_url}/${relativePath}`;
            const response = await fetch(imgUrl);
            if (response.ok) {
              const blob = await response.blob();
              const dataUri = `data:${blob.type};base64,${await blobToBase64(blob)}`;
              finalHtml = finalHtml.replace(`src="${relativePath}"`, `src="${dataUri}"`);
            }
          } catch (e) {
            console.warn(`Failed to embed image ${relativePath}:`, e);
          }
        }
      }
      
      return finalHtml;
    } catch (e) {
      console.warn('Failed to embed assets:', e);
      return htmlContent;
    }
  };

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Inject HTML content directly into iframe when in preview mode
  useEffect(() => {
    if (viewMode === 'preview' && iframeRef.current && content) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      if (doc) {
        // Embed assets and write to iframe
        embedAssets(content).then((finalHtml) => {
          doc.open();
          doc.write(finalHtml);
          doc.close();
        });
      }
    }
  }, [viewMode, content, project?.sandbox?.sandbox_url, fileName]);

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
