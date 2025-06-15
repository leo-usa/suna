"use client";

import React, { useState } from "react";
import { CodeRenderer } from "./code-renderer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Monitor, Code, ExternalLink, Pencil } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface HtmlRendererProps {
  content: string;
  previewUrl: string;
  className?: string;
  onEdit?: () => void;
}

export function HtmlRenderer({ content, previewUrl, className, onEdit }: HtmlRendererProps) {
  // Always default to 'preview' mode
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const { t } = useTranslation();

  // Custom class to ensure text color stays visible on hover
  const toolbarButtonClass = "text-foreground hover:text-foreground";

  return (
    <div className={cn("w-full h-full flex flex-col", className)}>
      {/* Content area */}
      <div className="flex-1 min-h-0 relative">
        {/* View mode toggle */}
        <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              toolbarButtonClass,
              "flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90",
              viewMode === 'preview' && "bg-background/90"
            )}
            onClick={() => setViewMode('preview')}
          >
            <Monitor className="h-4 w-4" />
            {t('editor.preview')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              toolbarButtonClass,
              "flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90",
              viewMode === 'code' && "bg-background/90"
            )}
            onClick={() => setViewMode('code')}
          >
            <Code className="h-4 w-4" />
            {t('editor.code')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(toolbarButtonClass, "flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90")}
            onClick={() => window.open(previewUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            {t('editor.open')}
          </Button>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(toolbarButtonClass, "flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90")}
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
              {t('editor.edit')}
            </Button>
          )}
        </div>

        {viewMode === 'preview' ? (
          <div className="absolute inset-0">
            <iframe
              src={previewUrl}
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