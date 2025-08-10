'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Monitor, ExternalLink, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { constructHtmlPreviewUrl } from '@/lib/utils/url';
import type { Project } from '@/lib/api';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
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

    // Function to fetch and convert assets to data URIs
    const embedAssets = async (htmlContent: string, project: any, fileName: string): Promise<string> => {
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
                // Embed assets to bypass proxy issues
                embedAssets(content, project, fileName).then((finalHtml) => {
                    doc.open();
                    doc.write(finalHtml);
                    doc.close();
                });
            }
        }
    }, [viewMode, content, project?.sandbox?.sandbox_url, fileName]);

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