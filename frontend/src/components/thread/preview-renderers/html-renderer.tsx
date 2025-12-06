'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Monitor, ExternalLink, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { constructHtmlPreviewUrl } from '@/lib/utils/url';
import type { Project } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthProvider';

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
    const { session } = useAuth();
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

    // Helper function to convert relative image path to absolute backend API URL
    // This uses the same method as ImageRenderer/constructImageUrl to ensure compatibility
    const convertImagePathToAbsoluteUrl = useCallback((relativePath: string, project: any): string => {
        // Skip if already absolute
        if (relativePath.startsWith('http') || relativePath.startsWith('data:')) {
            return relativePath;
        }

        const sandboxId = typeof project?.sandbox === 'string'
            ? project.sandbox
            : project?.sandbox?.id;

        if (sandboxId) {
            // Use backend API endpoint (same as ImageRenderer) - this works correctly with Daytona
            let normalizedPath = relativePath;
            // Remove leading ./ or ../
            normalizedPath = normalizedPath.replace(/^\.\//, '').replace(/^\.\.\//, '');
            // Ensure it starts with /workspace
            if (!normalizedPath.startsWith('/workspace')) {
                normalizedPath = `/workspace/${normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath}`;
            }
            return `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(normalizedPath)}`;
        }

        if (project?.sandbox?.sandbox_url) {
            // Fallback: use sandbox URL directly (server serves /workspace at root)
            const cleanPath = relativePath.replace(/^\.\//, '').replace(/^\.\.\//, '');
            return `${project.sandbox.sandbox_url.replace(/\/$/, '')}/${cleanPath}`;
        }

        // Keep as-is if no sandbox info
        return relativePath;
    }, []);

    // Function to convert all relative image paths to absolute backend API URLs
    // This is CRITICAL because doc.write() creates about:blank origin, so relative paths don't work
    const embedAssets = useCallback(async (htmlContent: string, project: any, fileName: string): Promise<string> => {
        if (!project?.sandbox) {
            return htmlContent;
        }

        try {
            // Extract relative image references - handle both single and double quotes
            const imgRegex = /src=(["'])([^"']*\.(png|jpg|jpeg|gif|webp|svg))\1/gi;

            let finalHtml = htmlContent;

            // Process all image matches and convert relative paths to absolute URLs
            const processedPaths = new Map<string, string>();

            finalHtml = finalHtml.replace(imgRegex, (fullMatch, quote, relativePath) => {
                if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('blob:')) {
                    return fullMatch;
                }

                if (processedPaths.has(relativePath)) {
                    return `src=${quote}${processedPaths.get(relativePath)}${quote}`;
                }

                const absoluteUrl = convertImagePathToAbsoluteUrl(relativePath, project);
                processedPaths.set(relativePath, absoluteUrl);

                return `src=${quote}${absoluteUrl}${quote}`;
            });

            // Handle CSS file references - fetch and inline them
            const cssRegex = /<link([^>]*)\shref=(["'])([^"']*\.css)\2([^>]*)>/gi;
            const cssMatches = [...htmlContent.matchAll(cssRegex)];
            const cssPromises: Promise<void>[] = [];

            for (const match of cssMatches) {
                const fullMatch = match[0];
                const relativePath = match[3];

                // Skip if already absolute URL
                if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('blob:')) {
                    continue;
                }

                // Convert to backend API URL
                const apiUrl = convertImagePathToAbsoluteUrl(relativePath, project);

                // Only fetch if it's a backend API URL
                if (apiUrl.includes('/sandboxes/') && apiUrl.includes('/files/content') && session?.access_token) {
                    const cssPromise = fetch(apiUrl, {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        }
                    })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Failed to load CSS: ${response.status}`);
                            }
                            return response.text();
                        })
                        .then(cssContent => {
                            // Inline the CSS as a <style> tag
                            const styleTag = `<style>/* ${relativePath} */\n${cssContent}\n</style>`;
                            finalHtml = finalHtml.replace(fullMatch, styleTag);
                        })
                        .catch(err => {
                            console.warn(`Failed to fetch CSS ${relativePath}:`, err);
                        });

                    cssPromises.push(cssPromise);
                }
            }

            // Wait for all CSS files to be fetched and inlined
            await Promise.all(cssPromises);

            // Handle JavaScript file references - fetch and convert to blob URLs
            const jsSrcRegex = /<script([^>]*)\ssrc=(["'])([^"']*\.js)\2([^>]*)>/gi;
            const jsMatches = [...htmlContent.matchAll(jsSrcRegex)];
            const jsPromises: Promise<void>[] = [];

            for (const match of jsMatches) {
                const fullMatch = match[0];
                const beforeSrc = match[1];
                const quote = match[2];
                const relativePath = match[3];
                const afterSrc = match[4];

                // Skip if already absolute URL
                if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('blob:')) {
                    continue;
                }

                // Convert to backend API URL
                const apiUrl = convertImagePathToAbsoluteUrl(relativePath, project);

                // Only fetch if it's a backend API URL
                if (apiUrl.includes('/sandboxes/') && apiUrl.includes('/files/content') && session?.access_token) {
                    const jsPromise = fetch(apiUrl, {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        }
                    })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Failed to load JS: ${response.status}`);
                            }
                            return response.blob();
                        })
                        .then(blob => {
                            const blobUrl = URL.createObjectURL(blob);
                            const newScript = `<script${beforeSrc} src=${quote}${blobUrl}${quote}${afterSrc}>`;
                            finalHtml = finalHtml.replace(fullMatch, newScript);
                        })
                        .catch(err => {
                            console.warn(`Failed to fetch JS ${relativePath}:`, err);
                        });

                    jsPromises.push(jsPromise);
                }
            }

            // Wait for all JS files to be fetched and converted
            await Promise.all(jsPromises);

            return finalHtml;
        } catch (e) {
            console.warn('Failed to convert image paths:', e);
            // Even on error, try to convert relative image paths to absolute URLs
            try {
                const imgRegex = /src=(["'])([^"']*\.(png|jpg|jpeg|gif|webp|svg))\1/gi;
                return htmlContent.replace(imgRegex, (fullMatch, quote, relativePath) => {
                    if (relativePath.startsWith('http') || relativePath.startsWith('data:')) {
                        return fullMatch;
                    }
                    const absoluteUrl = convertImagePathToAbsoluteUrl(relativePath, project);
                    return `src=${quote}${absoluteUrl}${quote}`;
                });
            } catch (innerError) {
                console.warn('Failed to convert image paths in error handler:', innerError);
                return htmlContent;
            }
        }
    }, [convertImagePathToAbsoluteUrl, session?.access_token]);

    // Inject HTML content directly into iframe when in preview mode
    // This approach ensures HTML always renders correctly even when the Daytona proxy is down:
    // 1. Try to embed external assets (CSS/images) if the proxy is working
    // 2. Render the final HTML content once with proper JavaScript execution
    // 3. Ensure JavaScript executes after DOM is fully loaded
    useEffect(() => {
        if (viewMode === 'preview' && iframeRef.current && content) {
            const iframe = iframeRef.current;
            const doc = iframe.contentDocument || iframe.contentWindow?.document;

            if (doc) {
                // Try to embed assets first, then render once
                embedAssets(content, project, fileName).then((finalHtml) => {
                    // Clear the document completely
                    doc.open();
                    doc.write(finalHtml);
                    doc.close();

                    // Ensure JavaScript executes after DOM is ready
                    const executeScripts = () => {
                        const scripts = doc.querySelectorAll('script');
                        const externalScripts: Promise<void>[] = [];
                        const inlineScripts: HTMLScriptElement[] = [];

                        scripts.forEach(script => {
                            if (script.src) {
                                const newScript = doc.createElement('script');
                                newScript.src = script.src;
                                newScript.async = script.async;
                                newScript.defer = script.defer;
                                newScript.type = script.type || 'text/javascript';

                                const scriptPromise = new Promise<void>((resolve) => {
                                    newScript.onload = () => resolve();
                                    newScript.onerror = () => resolve();
                                    doc.head.appendChild(newScript);
                                });
                                externalScripts.push(scriptPromise);
                            } else if (script.innerHTML) {
                                inlineScripts.push(script);
                            }
                        });

                        Promise.all(externalScripts).then(() => {
                            inlineScripts.forEach(script => {
                                try {
                                    const newScript = doc.createElement('script');
                                    newScript.innerHTML = script.innerHTML;
                                    newScript.type = script.type || 'text/javascript';
                                    doc.head.appendChild(newScript);
                                } catch (e) {
                                    console.warn('Failed to execute inline script:', e);
                                }
                            });
                        });
                    };

                    if (doc.readyState === 'loading') {
                        doc.addEventListener('DOMContentLoaded', executeScripts);
                    } else {
                        executeScripts();
                    }
                }).catch((error) => {
                    console.warn('Failed to embed assets, using original content:', error);
                    // Fallback to original content
                    doc.open();
                    doc.write(content);
                    doc.close();

                    // Execute scripts for fallback content
                    const executeScripts = () => {
                        const scripts = doc.querySelectorAll('script');
                        const externalScripts: Promise<void>[] = [];
                        const inlineScripts: HTMLScriptElement[] = [];

                        scripts.forEach(script => {
                            if (script.src) {
                                const newScript = doc.createElement('script');
                                newScript.src = script.src;
                                newScript.async = script.async;
                                newScript.defer = script.defer;
                                newScript.type = script.type || 'text/javascript';

                                const scriptPromise = new Promise<void>((resolve) => {
                                    newScript.onload = () => resolve();
                                    newScript.onerror = () => resolve();
                                    doc.head.appendChild(newScript);
                                });
                                externalScripts.push(scriptPromise);
                            } else if (script.innerHTML) {
                                inlineScripts.push(script);
                            }
                        });

                        Promise.all(externalScripts).then(() => {
                            inlineScripts.forEach(script => {
                                try {
                                    const newScript = doc.createElement('script');
                                    newScript.innerHTML = script.innerHTML;
                                    newScript.type = script.type || 'text/javascript';
                                    doc.head.appendChild(newScript);
                                } catch (e) {
                                    console.warn('Failed to execute script:', e);
                                }
                            });
                        });
                    };

                    if (doc.readyState === 'loading') {
                        doc.addEventListener('DOMContentLoaded', executeScripts);
                    } else {
                        executeScripts();
                    }
                });
            }
        }
    }, [viewMode, content, project?.sandbox?.sandbox_url, fileName, embedAssets, project]);

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
                        {t('editor.preview', 'Preview')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                        onClick={() => setViewMode('code')}
                    >
                        <Code className="h-4 w-4" />
                        {t('editor.code', 'Code')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                        onClick={async () => {
                            // Open a new window and write HTML content directly (same as preview mode)
                            // This avoids the Daytona warning page
                            const newWindow = window.open('', '_blank');
                            if (newWindow) {
                                try {
                                    // Embed assets first (same as preview mode)
                                    const finalHtml = await embedAssets(content, project, fileName);

                                    // Write the HTML content
                                    newWindow.document.open();
                                    newWindow.document.write(finalHtml);
                                    newWindow.document.close();

                                    // Set the title
                                    if (fileName) {
                                        newWindow.document.title = fileName;
                                    }
                                } catch (error) {
                                    console.error('Error opening HTML in new window:', error);
                                    // Fallback to original URL if something goes wrong
                                    newWindow.location.href = htmlPreviewUrl;
                                }
                            }
                        }}
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
                    <div className="w-full h-full">
                        <iframe
                            ref={iframeRef}
                            title="HTML Preview"
                            className="w-full h-full border-0"
                            sandbox="allow-same-origin allow-scripts allow-popups allow-top-navigation allow-forms allow-modals allow-pointer-lock allow-downloads"
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