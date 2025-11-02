"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Save, Undo, Redo, FileText, Globe, X } from "lucide-react"
import { Project } from "@/lib/api";
import { constructHtmlPreviewUrl } from "@/lib/utils/url";
import { useTranslation } from "react-i18next";

interface InlineContentEditorProps {
  html: string;
  onSave: (newHtml: string) => void;
  onCancel: () => void;
  project?: Project;
  fileName?: string;
}

function extractBodyContent(html: string): string {
  if (typeof html !== 'string') return '';
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

function extractTextContent(html: string): string {
    if (typeof html !== 'string') return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}

export default function InlineContentEditor({ html, onSave, onCancel, project, fileName }: InlineContentEditorProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"html" | "txt">("html")
  const [txtContent, setTxtContent] = useState(() => extractTextContent(html));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const previewUrl = constructHtmlPreviewUrl(project?.sandbox?.sandbox_url, fileName);

  // Helper function to convert relative image path to absolute backend API URL
  // This uses the same method as ImageRenderer/constructImageUrl to ensure compatibility
  const convertImagePathToAbsoluteUrl = useCallback((relativePath: string): string => {
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
  }, [project?.sandbox]);

  // Function to convert all relative image paths to absolute backend API URLs
  // This is CRITICAL because doc.write() creates about:blank origin, so relative paths don't work
  const embedAssets = useCallback(async (htmlContent: string): Promise<string> => {
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
        // Skip if already absolute URL or data URI
        if (relativePath.startsWith('http') || relativePath.startsWith('data:')) {
          return fullMatch;
        }
        
        // Check if we've already processed this path
        if (processedPaths.has(relativePath)) {
          return `src=${quote}${processedPaths.get(relativePath)}${quote}`;
        }
        
        // Convert to absolute URL
        const absoluteUrl = convertImagePathToAbsoluteUrl(relativePath);
        processedPaths.set(relativePath, absoluteUrl);
        
        return `src=${quote}${absoluteUrl}${quote}`;
      });
      
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
          const absoluteUrl = convertImagePathToAbsoluteUrl(relativePath);
          return `src=${quote}${absoluteUrl}${quote}`;
        });
      } catch (innerError) {
        console.warn('Failed to convert image paths in error handler:', innerError);
        return htmlContent;
      }
    }
  }, [project?.sandbox, convertImagePathToAbsoluteUrl]);

  // This effect handles writing content to the iframe and making it editable
  // This approach ensures HTML always renders correctly even when the Daytona proxy is down:
  // 1. Immediately render the HTML content to ensure it shows up
  // 2. Try to embed external assets (CSS/images) if the proxy is working
  // 3. If asset embedding fails, keep the original content (which is already rendered)
  // 4. Re-apply editable state after any re-rendering
  useEffect(() => {
    if (mode !== "html" || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument;

    if (doc) {
      // 1. Calculate the base URL for relative assets
      const sandboxUrl = project?.sandbox?.sandbox_url;
      let baseUrl = '';
      if (sandboxUrl && fileName) {
        const fullUrl = constructHtmlPreviewUrl(sandboxUrl, fileName);
        baseUrl = fullUrl ? fullUrl.substring(0, fullUrl.lastIndexOf('/') + 1) : '';
      }

      // 2. Inject the <base> tag into the head of the HTML string
      let finalHtml = html;
      if (baseUrl) {
        const headTag = /<head[^>]*>/i;
        if (headTag.test(finalHtml)) {
          finalHtml = finalHtml.replace(headTag, `$&<base href="${baseUrl}">`);
        } else {
          // Fallback if no head tag exists
          finalHtml = `<head><base href="${baseUrl}"></head>` + finalHtml;
        }
      }

      // 3. Write the full, modified HTML to the iframe
      doc.open();
      doc.write(finalHtml);
      doc.close();

      // 4. Make the body content editable
      if (doc.body) {
        doc.body.contentEditable = 'true';
        doc.body.focus();
        
        // 5. Add a listener to track changes
        doc.body.addEventListener('input', () => {
          setHasUnsavedChanges(true);
        });
      }

      // 6. Try to embed assets and re-render if successful
      embedAssets(html).then((enhancedHtml) => {
        if (enhancedHtml !== html) {
          // Only re-render if we actually enhanced the HTML
          doc.open();
          doc.write(enhancedHtml);
          doc.close();
          
          // Re-apply editable state
          if (doc.body) {
            doc.body.contentEditable = 'true';
            doc.body.focus();
            
            // Re-add the input listener
            doc.body.addEventListener('input', () => {
              setHasUnsavedChanges(true);
            });
          }
        }
      }).catch((error) => {
        console.warn('Failed to embed assets, keeping original content:', error);
        // Content is already rendered, no need to do anything
      });
    }
  }, [mode, html, project, fileName, embedAssets]);

  // Helper function to convert blob URLs or backend API URLs back to relative paths
  // This ensures we don't save temporary blob URLs or absolute backend URLs to the file
  const convertUrlsBackToRelative = useCallback((htmlContent: string): string => {
    // Track mappings from absolute URLs back to relative paths (from original HTML)
    const urlToRelativeMap = new Map<string, string>();
    
    // Build the mapping by looking at what we converted
    const originalImgRegex = /src=(["'])([^"']*\.(png|jpg|jpeg|gif|webp|svg))\1/gi;
    const originalMatches = [...html.matchAll(originalImgRegex)];
    
    for (const match of originalMatches) {
      const relativePath = match[2];
      if (!relativePath.startsWith('http') && !relativePath.startsWith('data:') && !relativePath.startsWith('blob:')) {
        const absoluteUrl = convertImagePathToAbsoluteUrl(relativePath);
        urlToRelativeMap.set(absoluteUrl, relativePath);
      }
    }
    
    // Replace blob URLs and backend API URLs with their original relative paths
    let cleanedHtml = htmlContent;
    const imgRegex = /src=(["'])([^"']+)\1/gi;
    
    cleanedHtml = cleanedHtml.replace(imgRegex, (fullMatch, quote, url) => {
      // If it's a blob URL or backend API URL, try to convert back to relative
      if (url.startsWith('blob:') || (url.includes('/sandboxes/') && url.includes('/files/content'))) {
        // Try to find the original relative path
        for (const [absoluteUrl, relativePath] of urlToRelativeMap.entries()) {
          if (url === absoluteUrl || url.includes(absoluteUrl.split('?')[0])) {
            return `src=${quote}${relativePath}${quote}`;
          }
        }
        // If we can't find the mapping, check if it's a backend API URL we can reverse
        if (url.includes('/sandboxes/') && url.includes('/files/content')) {
          try {
            const urlObj = new URL(url);
            const pathParam = urlObj.searchParams.get('path');
            if (pathParam) {
              // Extract the relative path from /workspace/...
              let relativePath = pathParam.replace(/^\/workspace\//, '');
              // Determine the original relative path based on fileName
              if (fileName) {
                const htmlDir = fileName.substring(0, fileName.lastIndexOf('/') + 1).replace(/^\/workspace\//, '');
                if (htmlDir) {
                  // Try to make it relative to the HTML file's directory
                  const imagePath = relativePath.replace(htmlDir, '');
                  if (imagePath !== relativePath && !imagePath.startsWith('/')) {
                    relativePath = `./${imagePath}`;
                  }
                }
              }
              return `src=${quote}${relativePath}${quote}`;
            }
          } catch (e) {
            // URL parsing failed, keep as-is
          }
        }
      }
      return fullMatch;
    });
    
    return cleanedHtml;
  }, [html, fileName, convertImagePathToAbsoluteUrl]);

  // Save all changes
  const saveChanges = () => {
    let finalHtml = '';
    if (mode === "html") {
      const iframe = iframeRef.current
      const doc = iframe?.contentDocument || iframe?.contentWindow?.document

      if (doc) {
        // Get the entire edited HTML content
        finalHtml = doc.documentElement.outerHTML;
        
        // The browser might add a contenteditable attribute, so we clean it up
        finalHtml = finalHtml.replace(/ contenteditable="true"/g, '');
        
        // Convert blob URLs and backend API URLs back to relative paths before saving
        finalHtml = convertUrlsBackToRelative(finalHtml);
      } else {
        console.error("Could not access iframe content to save.");
        return;
      }
    } else {
      // Reconstruct HTML from TXT content
      const bodyContent = txtContent.split('\n').map(line => `<p>${line}</p>`).join('');
      const originalDoc = new DOMParser().parseFromString(html, 'text/html');
      const headContent = originalDoc.head.innerHTML;
      finalHtml = `<!DOCTYPE html>\n<html>\n<head>\n${headContent}\n</head>\n<body>\n${bodyContent}\n</body>\n</html>`;
    }
    
    onSave(finalHtml);
    setHasUnsavedChanges(false);
  }

  const handleTxtChange = (value: string) => {
    setTxtContent(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="w-[90vw] h-[90vh] bg-gray-50 rounded-lg shadow-2xl flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b shadow-sm p-4 flex-shrink-0">
          <div className="w-full mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {/* Mode Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={mode === "html" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                    onClick={() => setMode("html")}
                  >
                    <Globe className="h-4 w-4" />
                    {t('editor.html', 'HTML')}
                  </Button>
                  <Button
                    variant={mode === "txt" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                    onClick={() => setMode("txt")}
                  >
                    <FileText className="h-4 w-4" />
                    {t('editor.text', 'Text')}
                  </Button>
                </div>

                {hasUnsavedChanges && <span className="text-sm text-orange-600 font-medium">{t('editor.unsavedChanges', 'Unsaved changes')}</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={saveChanges}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {t('editor.save', 'Save')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancel}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                {t('editor.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-white">
          {mode === "html" ? (
            <iframe
              ref={iframeRef}
              title="HTML Editor"
              className="w-full h-full border-0"
            />
          ) : (
            <Textarea
              value={txtContent}
              onChange={(e) => handleTxtChange(e.target.value)}
              className="w-full h-full p-4 font-mono text-sm border-0 rounded-none resize-none focus:ring-0 focus-visible:ring-0"
              placeholder={t('editor.placeholder', 'Enter plain text content...')}
            />
          )}
        </div>
      </div>
    </div>
  )
} 