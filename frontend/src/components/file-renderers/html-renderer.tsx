'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  // This function gracefully handles proxy failures by returning the original HTML content
  // when external assets cannot be fetched, ensuring the HTML still renders correctly
  const embedAssets = useCallback(async (htmlContent: string): Promise<string> => {
    // If no sandbox URL or filename, return content as-is
    if (!project?.sandbox?.sandbox_url || !fileName) {
      return htmlContent;
    }

    try {
      // Extract relative asset references
      const cssRegex = /href=["']([^"']*\.css)["']/g;
      const imgRegex = /src=["']([^"']*\.(png|jpg|jpeg|gif|webp|svg))["']/g;
      
      let finalHtml = htmlContent;
      let hasAssetErrors = false;
      
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
            hasAssetErrors = true;
          }
        }
      }
      
      // Replace image references
      const imgMatches = [...htmlContent.matchAll(imgRegex)];
      for (const match of imgMatches) {
        const relativePath = match[1];
        if (relativePath.startsWith('./') || relativePath.startsWith('../') || !relativePath.startsWith('http')) {
          try {
            // Try multiple URL patterns to find the image
            const possibleUrls = [
              `${project.sandbox.sandbox_url}/${relativePath}`,
              `${project.sandbox.sandbox_url}/workspace/${relativePath}`,
              `${project.sandbox.sandbox_url}/workspace/${fileName.replace(/\.html$/, '')}/${relativePath}`,
              // Try with the file's directory as base
              `${project.sandbox.sandbox_url}/${fileName.substring(0, fileName.lastIndexOf('/'))}/${relativePath}`
            ];
            
            let imageFound = false;
            for (const imgUrl of possibleUrls) {
              try {
                const response = await fetch(imgUrl);
                if (response.ok) {
                  const blob = await response.blob();
                  const dataUri = `data:${blob.type};base64,${await blobToBase64(blob)}`;
                  finalHtml = finalHtml.replace(`src="${relativePath}"`, `src="${dataUri}"`);
                  imageFound = true;
                  break;
                }
              } catch (e) {
                // Continue to next URL
                continue;
              }
            }
            
            if (!imageFound) {
              console.warn(`Failed to find image ${relativePath} at any of the attempted URLs:`, possibleUrls);
              
              // Convert relative path to absolute URL using the same method as constructImageUrl
              // This ensures images load correctly from Daytona sandbox
              const sandboxId = typeof project?.sandbox === 'string' 
                ? project.sandbox 
                : project?.sandbox?.id;
              
              let absoluteImgUrl: string;
              if (sandboxId) {
                // Use backend API endpoint (same as ImageRenderer) - this works correctly with Daytona
                let normalizedPath = relativePath;
                if (!normalizedPath.startsWith('/workspace')) {
                  normalizedPath = `/workspace/${normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath}`;
                }
                absoluteImgUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(normalizedPath)}`;
              } else if (project.sandbox.sandbox_url) {
                // Fallback: use sandbox URL directly (server serves /workspace at root)
                absoluteImgUrl = `${project.sandbox.sandbox_url}/${relativePath}`;
              } else {
                absoluteImgUrl = relativePath; // Keep as-is if no sandbox info
              }
              
              // Replace relative path with absolute URL so it works with doc.write()
              finalHtml = finalHtml.replace(`src="${relativePath}"`, `src="${absoluteImgUrl}"`);
              // Don't set hasAssetErrors - absolute URL should work
            }
          } catch (e) {
            console.warn(`Failed to embed image ${relativePath}:`, e);
            hasAssetErrors = true;
          }
        }
      }
      
      // Always return finalHtml (which has absolute URLs for images)
      // Never return htmlContent which has relative paths that don't work with doc.write()
      if (hasAssetErrors) {
        console.warn('Some assets may have failed, but images converted to absolute URLs');
      }
      
      return finalHtml;
    } catch (e) {
      console.warn('Failed to embed assets:', e);
      // Even on error, convert relative image paths to backend API URLs (like ImageRenderer)
      let errorHtml = htmlContent;
      try {
        const imgRegex = /src=["']([^"']*\.(png|jpg|jpeg|gif|webp|svg))["']/g;
        const imgMatches = [...htmlContent.matchAll(imgRegex)];
        const sandboxId = typeof project?.sandbox === 'string' 
          ? project.sandbox 
          : project?.sandbox?.id;
        
        for (const match of imgMatches) {
          const relativePath = match[1];
          const fullMatch = match[0];
          if (relativePath.startsWith('./') || relativePath.startsWith('../') || !relativePath.startsWith('http')) {
            let absoluteImgUrl: string;
            if (sandboxId) {
              // Use backend API endpoint (same as ImageRenderer) - works correctly with Daytona
              let normalizedPath = relativePath;
              if (!normalizedPath.startsWith('/workspace')) {
                normalizedPath = `/workspace/${normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath}`;
              }
              absoluteImgUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(normalizedPath)}`;
            } else if (project?.sandbox?.sandbox_url) {
              absoluteImgUrl = `${project.sandbox.sandbox_url}/${relativePath}`;
            } else {
              absoluteImgUrl = relativePath;
            }
            errorHtml = errorHtml.replace(new RegExp(fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fullMatch.replace(relativePath, absoluteImgUrl));
          }
        }
      } catch (innerError) {
        console.warn('Failed to convert image paths in error handler:', innerError);
      }
      return errorHtml;
    }
  }, [project?.sandbox?.sandbox_url, project?.sandbox?.id, fileName]);

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
          if (doc.readyState === 'loading') {
            doc.addEventListener('DOMContentLoaded', () => {
              // Force re-execution of any inline scripts
              const scripts = doc.querySelectorAll('script');
              scripts.forEach(script => {
                if (script.innerHTML) {
                  try {
                    // Create a new script element to execute the code
                    const newScript = doc.createElement('script');
                    newScript.innerHTML = script.innerHTML;
                    doc.head.appendChild(newScript);
                  } catch (e) {
                    console.warn('Failed to execute script:', e);
                  }
                }
              });
            });
          } else {
            // DOM is already loaded, execute scripts immediately
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(script => {
              if (script.innerHTML) {
                try {
                  const newScript = doc.createElement('script');
                  newScript.innerHTML = script.innerHTML;
                  doc.head.appendChild(newScript);
                } catch (e) {
                  console.warn('Failed to execute script:', e);
                }
              }
            });
          }
        }).catch((error) => {
          console.warn('Failed to embed assets, using original content:', error);
          // Fallback to original content
          doc.open();
          doc.write(content);
          doc.close();
          
          // Execute scripts for fallback content
          if (doc.readyState === 'loading') {
            doc.addEventListener('DOMContentLoaded', () => {
              const scripts = doc.querySelectorAll('script');
              scripts.forEach(script => {
                if (script.innerHTML) {
                  try {
                    const newScript = doc.createElement('script');
                    newScript.innerHTML = script.innerHTML;
                    doc.head.appendChild(newScript);
                  } catch (e) {
                    console.warn('Failed to execute script:', e);
                  }
                }
              });
            });
          } else {
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(script => {
              if (script.innerHTML) {
                try {
                  const newScript = doc.createElement('script');
                  newScript.innerHTML = script.innerHTML;
                  doc.head.appendChild(newScript);
                } catch (e) {
                  console.warn('Failed to execute script:', e);
                }
              }
            });
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
