'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileSpreadsheet, AlertTriangle, Eye, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';

interface CsvRendererProps {
    content: string;
    className?: string;
}

interface ParsedData {
    headers: string[];
    data: any[];
    totalRows: number;
    isLargeFile: boolean;
}

/**
 * Smart CSV parser that handles large files efficiently
 */
function parseCSVSmart(content: string): ParsedData {
    if (!content) return { headers: [], data: [], totalRows: 0, isLargeFile: false };

    try {
        // Estimate file size and row count
        const fileSizeMB = content.length / (1024 * 1024);
        const estimatedRows = content.split('\n').length;
        const isLargeFile = fileSizeMB > 1 || estimatedRows > 1000;

        if (isLargeFile) {
            // For large files, only parse first 100 rows + headers
            const lines = content.split('\n');
            const headerLine = lines[0];
            const sampleLines = lines.slice(1, 101); // First 100 data rows
            
            const sampleContent = [headerLine, ...sampleLines].join('\n');
            const results = Papa.parse(sampleContent, {
                header: true,
                skipEmptyLines: true
            });

            return {
                headers: results.meta?.fields || [],
                data: results.data,
                totalRows: estimatedRows,
                isLargeFile: true
            };
        } else {
            // For small files, parse everything
            const results = Papa.parse(content, {
                header: true,
                skipEmptyLines: true
            });

            return {
                headers: results.meta?.fields || [],
                data: results.data,
                totalRows: results.data.length,
                isLargeFile: false
            };
        }
    } catch (error) {
        console.error("Error parsing CSV:", error);
        return { headers: [], data: [], totalRows: 0, isLargeFile: false };
    }
}

/**
 * CSV/TSV renderer with smart handling for large files
 */
export function CsvRenderer({
    content,
    className
}: CsvRendererProps) {
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showFullData, setShowFullData] = useState(false);
    const [fullData, setFullData] = useState<any[]>([]);
    const [parsingProgress, setParsingProgress] = useState(0);

    useEffect(() => {
        const parseData = async () => {
            setIsLoading(true);
            setParsingProgress(0);

            // Simulate progress for large files
            if (content.length > 1024 * 1024) { // > 1MB
                const interval = setInterval(() => {
                    setParsingProgress(prev => Math.min(prev + 10, 90));
                }, 50);
                
                setTimeout(() => {
                    clearInterval(interval);
                    setParsingProgress(100);
                }, 500);
            }

            // Parse data
            const data = parseCSVSmart(content);
            setParsedData(data);
            setIsLoading(false);
        };

        parseData();
    }, [content]);

    const handleShowFullData = async () => {
        if (showFullData) {
            setShowFullData(false);
            setFullData([]);
            return;
        }

        setShowFullData(true);
        setIsLoading(true);
        setParsingProgress(0);

        try {
            // Parse full data with progress simulation
            let processedRows = 0;
            const estimatedTotalRows = content.split('\n').length - 1;
            
            const results = Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                step: () => {
                    processedRows++;
                    const progress = Math.round((processedRows / estimatedTotalRows) * 100);
                    setParsingProgress(Math.min(progress, 95)); // Cap at 95% until complete
                }
            });

            setFullData(results.data);
        } catch (error) {
            console.error("Error parsing full CSV:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderTable = (data: any[], headers: string[], isLargeFile: boolean = false) => {
        const isEmpty = data.length === 0;
        const displayData = isLargeFile && !showFullData ? data.slice(0, 100) : data;

        return (
            <table className="w-full border-collapse text-sm">
                <thead className="bg-muted sticky top-0">
                    <tr>
                        {headers.map((header, index) => (
                            <th key={index} className="px-3 py-2 text-left font-medium border border-border">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {!isEmpty ? displayData.map((row: any, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-border hover:bg-muted/50">
                            {headers.map((header, cellIndex) => (
                                <td key={cellIndex} className="px-3 py-2 border border-border">
                                    <div className="truncate max-w-[200px]" title={String(row[header] || '')}>
                                        {row[header] || ''}
                                    </div>
                                </td>
                            ))}
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={headers.length || 1} className="py-4 text-center text-muted-foreground">
                                No data available
                            </td>
                        </tr>
                    )}
                    
                    {/* Show truncated message for large files */}
                    {isLargeFile && !showFullData && data.length > 100 && (
                        <tr>
                            <td colSpan={headers.length} className="py-4 text-center text-muted-foreground bg-muted/30">
                                <div className="flex items-center justify-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Showing first 100 rows of {data.length.toLocaleString()} total rows</span>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        );
    };

    if (isLoading) {
        return (
            <div className={cn('w-full h-full flex items-center justify-center', className)}>
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <div>
                        <h3 className="text-lg font-medium">Processing CSV Data</h3>
                        <p className="text-sm text-muted-foreground">
                            {parsingProgress > 0 ? `Progress: ${parsingProgress}%` : 'Initializing...'}
                        </p>
                        {parsingProgress > 0 && (
                            <Progress value={parsingProgress} className="w-64 mx-auto mt-2" />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (!parsedData || parsedData.headers.length === 0) {
        return (
            <div className={cn('w-full h-full flex items-center justify-center', className)}>
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-foreground">No Data</h3>
                        <p className="text-sm text-muted-foreground">This CSV file appears to be empty or invalid.</p>
                    </div>
                </div>
            </div>
        );
    }

    const { headers, data, totalRows, isLargeFile } = parsedData;
    const fileSizeMB = (content.length / (1024 * 1024)).toFixed(2);

    return (
        <div className={cn('w-full h-full overflow-hidden', className)}>
            {/* Header with file info and controls */}
            <div className="border-b bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        <div>
                            <h3 className="font-medium text-sm">CSV Data</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{totalRows.toLocaleString()} rows</span>
                                <span>•</span>
                                <span>{headers.length} columns</span>
                                <span>•</span>
                                <span>{fileSizeMB} MB</span>
                                {isLargeFile && (
                                    <Badge variant="secondary" className="ml-2">
                                        Large File
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {isLargeFile && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleShowFullData}
                            disabled={isLoading}
                        >
                            {showFullData ? (
                                <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Show Sample
                                </>
                            ) : (
                                <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Show All Data
                                </>
                            )}
                        </Button>
                    )}
                </div>

                {/* Warning for large files */}
                {isLargeFile && !showFullData && (
                    <Alert className="mb-0">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            This is a large CSV file ({fileSizeMB} MB). Showing sample data to prevent performance issues. 
                            Click "Show All Data" to view the complete dataset.
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Table content */}
            <ScrollArea className="w-full h-full">
                <div className="p-0">
                    {renderTable(
                        showFullData ? fullData : data,
                        headers,
                        isLargeFile
                    )}
                </div>
            </ScrollArea>
        </div>
    );
} 