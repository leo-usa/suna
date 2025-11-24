'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CodeRenderer } from './code-renderer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Monitor, Code, ExternalLink, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthProvider';

interface HtmlRendererProps {
  content: string;
  previewUrl: string;
  sandboxUrl?: string; // Add sandbox URL for base tag extraction
  className?: string;
  onEdit?: () => void;
  // Accept flexible project type similar to constructImageUrl
  project?: {
    sandbox?: {
      sandbox_url?: string;
      id?: string;
    } | string; // Can be a string (sandbox ID) or object
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
  const { session } = useAuth();
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Helper function to convert relative image path to absolute backend API URL
  // This uses the same method as ImageRenderer/constructImageUrl to ensure compatibility
  const convertImagePathToAbsoluteUrl = useCallback((relativePath: string): string => {
    // Skip if already absolute
    if (relativePath.startsWith('http') || relativePath.startsWith('data:')) {
      return relativePath;
    }

    const sandbox = project?.sandbox;
    const sandboxId = typeof sandbox === 'string' 
      ? sandbox 
      : (typeof sandbox === 'object' ? sandbox?.id : undefined);
    
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
    
    const sandboxUrl = typeof sandbox === 'object' ? sandbox?.sandbox_url : undefined;
    if (sandboxUrl) {
      // Fallback: use sandbox URL directly (server serves /workspace at root)
      const cleanPath = relativePath.replace(/^\.\//, '').replace(/^\.\.\//, '');
      return `${sandboxUrl.replace(/\/$/, '')}/${cleanPath}`;
    }
    
    // Keep as-is if no sandbox info
    return relativePath;
  }, [project?.sandbox]);

  // Function to convert all relative image paths to blob URLs (fetched with auth)
  // This is CRITICAL because:
  // 1. doc.write() creates about:blank origin, so relative paths don't work
  // 2. Backend API URLs need Authorization headers, which <img src> can't send
  // Solution: Fetch images with auth, convert to blob URLs, then use in HTML
  const embedAssets = useCallback(async (htmlContent: string): Promise<string> => {
    if (!project?.sandbox || !session?.access_token) {
      return htmlContent;
    }

    try {
      // Extract relative image references - handle both single and double quotes
      const imgRegex = /src=(["'])([^"']*\.(png|jpg|jpeg|gif|webp|svg))\1/gi;
      
      let finalHtml = htmlContent;
      
      // Process all image matches and convert relative paths to blob URLs
      const processedPaths = new Map<string, string>();
      const imagePromises: Promise<void>[] = [];
      
      const imgMatches = [...htmlContent.matchAll(imgRegex)];
      for (const match of imgMatches) {
        const quote = match[1];
        const relativePath = match[2];
        
        // Skip if already absolute URL or data URI
        if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('blob:')) {
          continue;
        }
        
        // Check if we've already processed this path
        if (processedPaths.has(relativePath)) {
          continue;
        }
        
        // Convert to backend API URL first
        const apiUrl = convertImagePathToAbsoluteUrl(relativePath);
        
        // Only fetch if it's a backend API URL (not sandbox URL)
        if (apiUrl.includes('/sandboxes/') && apiUrl.includes('/files/content')) {
          // Fetch with auth and convert to blob URL
          const imagePromise = fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })
            .then(response => {
              if (!response.ok) {
                throw new Error(`Failed to load image: ${response.status}`);
              }
              return response.blob();
            })
            .then(blob => {
              const blobUrl = URL.createObjectURL(blob);
              processedPaths.set(relativePath, blobUrl);
              // Replace all occurrences of this relative path with the blob URL
              const escapedPath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`src=${quote}${escapedPath}${quote}`, 'gi');
              finalHtml = finalHtml.replace(regex, `src=${quote}${blobUrl}${quote}`);
            })
            .catch(err => {
              console.warn(`Failed to fetch image ${relativePath}:`, err);
              // Fallback: use the API URL directly (might work if project is public or uses cookies)
              processedPaths.set(relativePath, apiUrl);
            });
          
          imagePromises.push(imagePromise);
        } else {
          // For sandbox URLs, replace immediately (will try to load, might fail with SSL but that's OK)
          processedPaths.set(relativePath, apiUrl);
          const escapedPath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`src=${quote}${escapedPath}${quote}`, 'gi');
          finalHtml = finalHtml.replace(regex, `src=${quote}${apiUrl}${quote}`);
        }
      }
      
      // Wait for all images to be fetched and converted to blob URLs
      await Promise.all(imagePromises);
      
      // Helper to convert relative paths to absolute URLs for CSS/JS files
      const convertAssetPathToAbsoluteUrl = (relativePath: string): string => {
        if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('blob:')) {
          return relativePath;
        }
        
        const sandbox = project?.sandbox;
        const sandboxUrlObj = typeof sandbox === 'object' ? sandbox?.sandbox_url : undefined;
        
        if (sandboxUrlObj && fileName) {
          // Remove /workspace prefix from fileName if present
          const cleanFileName = fileName.replace(/^\/workspace\//, '');
          const htmlDir = cleanFileName.substring(0, cleanFileName.lastIndexOf('/') + 1);
          
          let assetPath = relativePath.replace(/^\.\//, '').replace(/^\.\.\//, '');
          
          if (!assetPath.startsWith('/')) {
            assetPath = htmlDir ? `${htmlDir}${assetPath}` : assetPath;
          } else {
            assetPath = assetPath.replace(/^\/workspace\//, '');
          }
          
          const pathSegments = assetPath.split('/').filter(s => s).map(segment => encodeURIComponent(segment));
          const encodedPath = pathSegments.join('/');
          
          return `${sandboxUrlObj.replace(/\/$/, '')}/${encodedPath}`;
        }
        
        return convertImagePathToAbsoluteUrl(relativePath);
      };
      
      // Handle CSS file references (<link rel="stylesheet" href="...">)
      const cssRegex = /href=(["'])([^"']*\.(css))\1/gi;
      finalHtml = finalHtml.replace(cssRegex, (fullMatch, quote, relativePath) => {
        const absoluteUrl = convertAssetPathToAbsoluteUrl(relativePath);
        return `href=${quote}${absoluteUrl}${quote}`;
      });
      
      // Handle JavaScript file references (<script src="...">)
      const jsSrcRegex = /<script([^>]*)\ssrc=(["'])([^"']*\.(js))\2([^>]*)>/gi;
      finalHtml = finalHtml.replace(jsSrcRegex, (fullMatch, beforeSrc, quote, relativePath, afterSrc) => {
        const absoluteUrl = convertAssetPathToAbsoluteUrl(relativePath);
        return `<script${beforeSrc} src=${quote}${absoluteUrl}${quote}${afterSrc}>`;
      });
      
      return finalHtml;
    } catch (e) {
      console.warn('Failed to convert image paths:', e);
      // On error, fall back to converting to absolute URLs (won't work without auth, but better than relative paths)
      try {
        const imgRegex = /src=(["'])([^"']*\.(png|jpg|jpeg|gif|webp|svg))\1/gi;
        return htmlContent.replace(imgRegex, (fullMatch, quote, relativePath) => {
          if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('blob:')) {
            return fullMatch;
          }
          const absoluteUrl = convertImagePathToAbsoluteUrl(relativePath);
          return `src=${quote}${absoluteUrl}${quote}`;
        });
      } catch (innerError) {
        console.warn('Failed to convert image paths in error handler:', innerError);
        return htmlContent;
      }
    }
  }, [project?.sandbox, convertImagePathToAbsoluteUrl, session?.access_token]);

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
        embedAssets(content).then((finalHtml) => {
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
                // External script - reload it
                const newScript = doc.createElement('script');
                newScript.src = script.src;
                newScript.async = script.async;
                newScript.defer = script.defer;
                newScript.type = script.type || 'text/javascript';
                
                const scriptPromise = new Promise<void>((resolve) => {
                  newScript.onload = () => resolve();
                  newScript.onerror = () => resolve(); // Continue even if fails
                  doc.head.appendChild(newScript);
                });
                externalScripts.push(scriptPromise);
              } else if (script.innerHTML) {
                inlineScripts.push(script);
              }
            });

            // Wait for external scripts then execute inline ones
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
  }, [viewMode, content, embedAssets]);

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
              sandbox="allow-same-origin allow-scripts allow-popups allow-top-navigation allow-forms allow-modals allow-pointer-lock allow-downloads"
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
