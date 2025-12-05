import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthProvider';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Code,
  Eye,
  File,
} from 'lucide-react';
import {
  extractFilePath,
  extractFileContent,
  extractStreamingFileContent,
  formatTimestamp,
  getToolTitle,
  normalizeContentToString,
  extractToolData,
} from '../utils';
import {
  MarkdownRenderer,
  processUnicodeContent,
} from '@/components/file-renderers/markdown-renderer';
import { CsvRenderer } from '@/components/file-renderers/csv-renderer';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { CodeBlockCode } from '@/components/ui/code-block';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  getLanguageFromFileName,
  getOperationType,
  getOperationConfigs,
  getFileIcon,
  processFilePath,
  getFileName,
  getFileExtension,
  isFileType,
  hasLanguageHighlighting,
  splitContentIntoLines,
  type FileOperation,
  type OperationConfig,
} from './_utils';
import { ToolViewProps } from '../types';
import { GenericToolView } from '../GenericToolView';
import { LoadingState } from '../shared/LoadingState';

export function FileOperationToolView({
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  name,
  project,
}: ToolViewProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const { session } = useAuth();
  const isDarkTheme = resolvedTheme === 'dark';

  const operation = getOperationType(name, assistantContent);
  const configs = getOperationConfigs();
  const config = configs[operation];
  const Icon = config.icon;

  let filePath: string | null = null;
  let fileContent: string | null = null;

  const assistantToolData = extractToolData(assistantContent);
  const toolToolData = extractToolData(toolContent);

  if (assistantToolData.toolResult) {
    filePath = assistantToolData.filePath;
    fileContent = assistantToolData.fileContent;
  } else if (toolToolData.toolResult) {
    filePath = toolToolData.filePath;
    fileContent = toolToolData.fileContent;
  }

  if (!filePath) {
    filePath = extractFilePath(assistantContent);
  }

  if (!fileContent && operation !== 'delete') {
    fileContent = isStreaming
      ? extractStreamingFileContent(
        assistantContent,
        operation === 'create' ? 'create-file' : 'full-file-rewrite',
      ) || ''
      : extractFileContent(
        assistantContent,
        operation === 'create' ? 'create-file' : 'full-file-rewrite',
      );
  }

  const toolTitle = getToolTitle(name || `file-${operation}`, t);
  const processedFilePath = processFilePath(filePath);
  const fileName = getFileName(processedFilePath);
  const fileExtension = getFileExtension(fileName);

  const isMarkdown = isFileType.markdown(fileExtension);
  const isHtml = isFileType.html(fileExtension);
  const isCsv = isFileType.csv(fileExtension);

  const language = getLanguageFromFileName(fileName);
  const hasHighlighting = hasLanguageHighlighting(language);
  const contentLines = splitContentIntoLines(fileContent);

  const FileIcon = getFileIcon(fileName);

  if (!isStreaming && !processedFilePath && !fileContent) {
    return (
      <GenericToolView
        name={name || `file-${operation}`}
        assistantContent={assistantContent}
        toolContent={toolContent}
        assistantTimestamp={assistantTimestamp}
        toolTimestamp={toolTimestamp}
        isSuccess={isSuccess}
        isStreaming={isStreaming}
      />
    );
  }

  const renderFilePreview = () => {
    if (!fileContent) {
      return (
        <div className="flex items-center justify-center h-full p-12">
          <div className="text-center">
            <FileIcon className="h-12 w-12 mx-auto mb-4 text-zinc-400" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No content to preview</p>
          </div>
        </div>
      );
    }

    if (isHtml && fileContent) {
      return (
        <div className="flex flex-col h-[calc(100vh-16rem)]">
          <iframe
            ref={(iframe) => {
              if (iframe && fileContent) {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc) {
                  // Embed assets to bypass proxy issues
                  embedAssets(fileContent, project, fileName).then((finalHtml) => {
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
                    doc.write(fileContent);
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
            }}
            title={`HTML Preview of ${fileName}`}
            className="flex-grow border-0"
            sandbox="allow-same-origin allow-scripts allow-popups allow-top-navigation allow-forms allow-modals allow-pointer-lock allow-downloads"
          />
        </div>
      );
    }

    if (isMarkdown) {
      return (
        <div className="p-1 py-0 prose dark:prose-invert prose-zinc max-w-none">
          <MarkdownRenderer
            content={processUnicodeContent(fileContent)}
          />
        </div>
      );
    }

    if (isCsv) {
      return (
        <div className="h-full w-full p-4">
          <div className="h-[calc(100vh-17rem)] w-full bg-muted/20 border rounded-xl overflow-auto">
            <CsvRenderer content={processUnicodeContent(fileContent)} />
          </div>
        </div>
      );
    }

    return (
      <div className="p-4">
        <div className='w-full h-full bg-muted/20 border rounded-xl px-4 py-2 pb-6'>
          <pre className="text-sm font-mono text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap break-words">
            {processUnicodeContent(fileContent)}
          </pre>
        </div>
      </div>
    );
  };

  const renderDeleteOperation = () => (
    <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
      <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mb-6", config.bgColor)}>
        <Icon className={cn("h-10 w-10", config.color)} />
      </div>
      <h3 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-zinc-100">
        File Deleted
      </h3>
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 w-full max-w-md text-center mb-4 shadow-sm">
        <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">
          {processedFilePath || 'Unknown file path'}
        </code>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        This file has been permanently removed
      </p>
    </div>
  );

  const renderSourceCode = () => {
    if (!fileContent) {
      return (
        <div className="flex items-center justify-center h-full p-12">
          <div className="text-center">
            <FileIcon className="h-12 w-12 mx-auto mb-4 text-zinc-400" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No source code to display</p>
          </div>
        </div>
      );
    }

    if (hasHighlighting) {
      return (
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-12 border-r border-zinc-200 dark:border-zinc-800 z-10 flex flex-col bg-zinc-50 dark:bg-zinc-900">
            {contentLines.map((_, idx) => (
              <div
                key={idx}
                className="h-6 text-right pr-3 text-xs font-mono text-zinc-500 dark:text-zinc-500 select-none"
              >
                {idx + 1}
              </div>
            ))}
          </div>
          <div className="pl-12">
            <CodeBlockCode
              code={processUnicodeContent(fileContent)}
              language={language}
              className="text-xs"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-full table">
        {contentLines.map((line, idx) => (
          <div
            key={idx}
            className={cn("table-row transition-colors", config.hoverColor)}
          >
            <div className="table-cell text-right pr-3 pl-6 py-0.5 text-xs font-mono text-zinc-500 dark:text-zinc-500 select-none w-12 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              {idx + 1}
            </div>
            <div className="table-cell pl-3 py-0.5 pr-4 text-xs font-mono whitespace-pre-wrap text-zinc-800 dark:text-zinc-300">
              {processUnicodeContent(line) || ' '}
            </div>
          </div>
        ))}
        <div className="table-row h-4"></div>
      </div>
    );
  };

  // Function to fetch and convert assets to data URIs
  const embedAssets = async (htmlContent: string, project: any, fileName: string): Promise<string> => {
    if (!project?.sandbox || !fileName) {
      return htmlContent;
    }

    try {
      const imgRegex = /src=(["'])([^"']*\.(png|jpg|jpeg|gif|webp|svg))\1/gi;
      
      let finalHtml = htmlContent;
      
      // Helper to convert relative paths to backend API URLs
      const convertToBackendApiUrl = (relativePath: string): string => {
        if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('blob:')) {
          return relativePath;
        }
        
        const sandboxId = typeof project?.sandbox === 'string' 
          ? project.sandbox 
          : project?.sandbox?.id;
        
        if (sandboxId) {
          // Use backend API endpoint with auth
          let normalizedPath = relativePath;
          // Remove leading ./ or ../
          normalizedPath = normalizedPath.replace(/^\.\//, '').replace(/^\.\.\//, '');
          // Ensure it starts with /workspace
          if (!normalizedPath.startsWith('/workspace')) {
            normalizedPath = `/workspace/${normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath}`;
          }
          return `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(normalizedPath)}`;
        }
        
        return relativePath;
      };
      
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
        const apiUrl = convertToBackendApiUrl(relativePath);
        
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
        const apiUrl = convertToBackendApiUrl(relativePath);
        
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

  return (
    <Card className="flex border shadow-none border-t border-b-0 border-x-0 p-0 rounded-none flex-col h-full overflow-hidden bg-card">
      <Tabs defaultValue={'preview'} className="w-full h-full">
        <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2 mb-0">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("relative p-2 rounded-lg border", config.gradientBg, config.borderColor)}>
                <Icon className={cn("h-5 w-5", config.color)} />
              </div>
              <div>
                <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                  {toolTitle}
                </CardTitle>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <TabsList className="-mr-2 h-7 bg-zinc-100/70 dark:bg-zinc-800/70 rounded-lg">
                <TabsTrigger value="code" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-primary">
                  <Code className="h-4 w-4" />
                  {t('toolView.source', 'Source')}
                </TabsTrigger>
                <TabsTrigger value="preview" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-primary">
                  <Eye className="h-4 w-4" />
                  {t('toolView.preview', 'Preview')}
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 -my-2 h-full flex-1 overflow-hidden relative">
          <TabsContent value="code" className="flex-1 h-full mt-0 p-0 overflow-hidden">
            <ScrollArea className="h-screen w-full min-h-0">
              {isStreaming && !fileContent ? (
                <LoadingState
                  icon={Icon}
                  iconColor={config.color}
                  bgColor={config.bgColor}
                  title={config.progressMessage}
                  filePath={processedFilePath || 'Processing file...'}
                  subtitle="Please wait while the file is being processed"
                  showProgress={false}
                />
              ) : operation === 'delete' ? (
                <div className="flex flex-col items-center justify-center h-full py-12 px-6">
                  <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mb-6", config.bgColor)}>
                    <Icon className={cn("h-10 w-10", config.color)} />
                  </div>
                  <h3 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-zinc-100">
                    Delete Operation
                  </h3>
                  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 w-full max-w-md text-center">
                    <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">
                      {processedFilePath || 'Unknown file path'}
                    </code>
                  </div>
                </div>
              ) : (
                renderSourceCode()
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preview" className="w-full flex-1 h-full mt-0 p-0 overflow-hidden">
            <ScrollArea className="h-full w-full min-h-0">
              {isStreaming && !fileContent ? (
                <LoadingState
                  icon={Icon}
                  iconColor={config.color}
                  bgColor={config.bgColor}
                  title={config.progressMessage}
                  filePath={processedFilePath || 'Processing file...'}
                  subtitle="Please wait while the file is being processed"
                  showProgress={false}
                />
              ) : operation === 'delete' ? (
                renderDeleteOperation()
              ) : (
                renderFilePreview()
              )}
              {isStreaming && fileContent && (
                <div className="sticky bottom-4 right-4 float-right mr-4 mb-4">
                  <Badge className="bg-blue-500/90 text-white border-none shadow-lg animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Streaming...
                  </Badge>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </CardContent>

        <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
          <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Badge variant="outline" className="py-0.5 h-6">
              <FileIcon className="h-3 w-3" />
              {hasHighlighting ? language.toUpperCase() : fileExtension.toUpperCase() || 'TEXT'}
            </Badge>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {toolTimestamp && !isStreaming
              ? formatTimestamp(toolTimestamp)
              : assistantTimestamp
                ? formatTimestamp(assistantTimestamp)
                : ''}
          </div>
        </div>
      </Tabs>
    </Card>
  );
}