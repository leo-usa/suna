'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Monitor, ExternalLink, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { constructHtmlPreviewUrl } from '@/lib/utils/url';
import type { Project } from '@/lib/api';

interface HtmlRendererProps {
    content: string;
    previewUrl: string;
    className?: string;
    project?: Project;
    onEdit?: () => void;
}

/**
 * HTML renderer that supports both preview (iframe) and code view modes
 */
export function HtmlRenderer({
    content,
    previewUrl,
    className,
    project,
    onEdit
}: HtmlRendererProps) {
    const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Get filename from the previewUrl
    const fileName = useMemo(() => {
        try {
            // If it's an API URL, extract the filename from the path parameter
            if (previewUrl.includes('/api/sandboxes/')) {
                const url = new URL(previewUrl);
                const path = url.searchParams.get('path');
                if (path) {
                    return path.split('/').pop() || '';
                }
            }

            // Otherwise just get the last part of the URL
            return previewUrl.split('/').pop() || '';
        } catch (e) {
            console.error('Error extracting filename:', e);
            return '';
        }
    }, [previewUrl]);

    // Create a blob URL for HTML content if needed
    const blobHtmlUrl = useMemo(() => {
        // Create blob URL when we have HTML content and either:
        // - No sandbox URL (ports closed) OR
        // - No sandbox URL available
        if (content && (!project?.sandbox?.sandbox_url || !fileName)) {
            const blob = new Blob([content], { type: 'text/html' });
            return URL.createObjectURL(blob);
        }
        return undefined;
    }, [content, project?.sandbox?.sandbox_url, fileName]);

    // Construct HTML file preview URL using the same logic as FileRenderer
    const htmlPreviewUrl = useMemo(() => {
        // 1. Try sandbox URL first (when ports are open)
        if (project?.sandbox?.sandbox_url && fileName) {
            return constructHtmlPreviewUrl(project.sandbox.sandbox_url, fileName);
        }
        
        // 2. Try blob URL (when ports are closed but we have content)
        if (content && blobHtmlUrl) {
            return blobHtmlUrl;
        }
        
        // 3. Fallback to original preview URL
        return previewUrl;
    }, [project?.sandbox?.sandbox_url, fileName, content, blobHtmlUrl, previewUrl]);

    // Inject HTML content directly into iframe when in preview mode
    useEffect(() => {
        if (viewMode === 'preview' && iframeRef.current && content) {
            const iframe = iframeRef.current;
            const doc = iframe.contentDocument || iframe.contentWindow?.document;

            if (doc) {
                // Calculate the base URL for relative assets
                let baseUrl = '';
                if (htmlPreviewUrl) {
                    try {
                        const url = new URL(htmlPreviewUrl);
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
    }, [viewMode, content, htmlPreviewUrl]);

    // Clean up blob URL on unmount
    useEffect(() => {
        return () => {
            if (blobHtmlUrl) {
                URL.revokeObjectURL(blobHtmlUrl);
            }
        };
    }, [blobHtmlUrl]);

    return (
        <div className={cn('w-full h-full flex flex-col', className)}>
            {/* Content area */}
                    <div className="flex-1 min-h-0 relative">
            {/* View mode toggle */}
            <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                    onClick={() => setViewMode('preview')}
                >
                    <Monitor className="h-4 w-4" />
                    Preview
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                    onClick={() => setViewMode('code')}
                >
                    <Code className="h-4 w-4" />
                    Code
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                    onClick={() => window.open(htmlPreviewUrl, '_blank')}
                >
                    <ExternalLink className="h-4 w-4" />
                    Open
                </Button>
                {onEdit && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                        onClick={onEdit}
                    >
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Button>
                )}
            </div>

            {viewMode === 'preview' ? (
                <div className="w-full h-full">
                    <iframe
                        ref={iframeRef}
                        title="HTML Preview"
                        className="w-full h-full border-0"
                        sandbox="allow-same-origin allow-scripts"
                        style={{ background: 'white' }}
                    />
                </div>
            ) : (
                <ScrollArea className="w-full h-full">
                    <pre className="p-4 overflow-auto">
                        <code className="text-sm">{content}</code>
                    </pre>
                </ScrollArea>
            )}
        </div>
        </div>
    );
} 