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

  // Helper function to convert blob to base64
  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  // Function to fetch and convert assets to data URIs
  // This function gracefully handles proxy failures by returning the original HTML content
  // when external assets cannot be fetched, ensuring the HTML still renders correctly
  const embedAssets = useCallback(async (htmlContent: string): Promise<string> => {
    const sandboxUrl = project?.sandbox?.sandbox_url;
    if (!sandboxUrl || !fileName) {
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
            const cssUrl = `${sandboxUrl}/${relativePath}`;
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
            const imgUrl = `${sandboxUrl}/${relativePath}`;
            const response = await fetch(imgUrl);
            if (response.ok) {
              const blob = await response.blob();
              const dataUri = `data:${blob.type};base64,${await blobToBase64(blob)}`;
              finalHtml = finalHtml.replace(`src="${relativePath}"`, `src="${dataUri}"`);
            }
          } catch (e) {
            console.warn(`Failed to embed image ${relativePath}:`, e);
            hasAssetErrors = true;
          }
        }
      }
      
      // If we had asset errors, the proxy might not be working
      // In this case, return the original HTML content to avoid broken references
      if (hasAssetErrors) {
        console.warn('Some assets failed to load, using original HTML content');
        return htmlContent;
      }
      
      return finalHtml;
    } catch (e) {
      console.warn('Failed to embed assets, using original HTML content:', e);
      return htmlContent;
    }
  }, [project?.sandbox?.sandbox_url, fileName, blobToBase64]);

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