'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { 
    Search, 
    ChevronUp, 
    ChevronDown, 
    FileSpreadsheet,
    ArrowUpDown,
    Filter,
    AlertTriangle,
    Loader2,
    Eye,
    HardDrive,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

interface CsvRendererProps {
    content: string;
    className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
    column: string;
    direction: SortDirection;
}

interface ParsedData {
    headers: string[];
    data: any[];
    totalRows: number;
    isLargeFile: boolean;
    fileSizeMB: number;
}

// Virtual scrolling hook for performance
function useVirtualScrolling<T>(
    items: T[],
    itemHeight: number = 40,
    containerHeight: number = 400
) {
    const [scrollTop, setScrollTop] = useState(0);
    
    const visibleRange = useMemo(() => {
        const start = Math.floor(scrollTop / itemHeight);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const end = Math.min(start + visibleCount + 2, items.length); // +2 for buffer
        return { start: Math.max(0, start - 1), end }; // -1 for buffer
    }, [scrollTop, itemHeight, containerHeight, items.length]);
    
    const totalHeight = items.length * itemHeight;
    
    return { 
        visibleRange, 
        setScrollTop, 
        totalHeight,
        startOffset: visibleRange.start * itemHeight
    };
}

// Smart CSV parser with streaming support
function parseCSVSmart(content: string): ParsedData {
    if (!content) return { headers: [], data: [], totalRows: 0, isLargeFile: false, fileSizeMB: 0 };

    try {
        const fileSizeMB = content.length / (1024 * 1024);
        const estimatedRows = content.split('\n').length;
        const isLargeFile = fileSizeMB > 1 || estimatedRows > 1000;

        if (isLargeFile) {
            // For large files, parse headers and sample data
            const lines = content.split('\n');
            const headerLine = lines[0];
            const sampleLines = lines.slice(1, Math.min(1001, lines.length)); // First 1000 data rows
            
            const sampleContent = [headerLine, ...sampleLines].join('\n');
            const results = Papa.parse(sampleContent, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
            });

            return {
                headers: results.meta?.fields || [],
                data: results.data,
                totalRows: estimatedRows,
                isLargeFile: true,
                fileSizeMB
            };
        } else {
            // For small files, parse everything
            const results = Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
            });

            return {
                headers: results.meta?.fields || [],
                data: results.data,
                totalRows: results.data.length,
                isLargeFile: false,
                fileSizeMB
            };
        }
    } catch (error) {
        console.error("Error parsing CSV:", error);
        return { headers: [], data: [], totalRows: 0, isLargeFile: false, fileSizeMB: 0 };
    }
}

// Advanced streaming CSV parser for massive files
class StreamingCSVParser {
    private chunkSize = 1024 * 1024; // 1MB chunks
    private maxMemoryUsage = 100; // 100MB limit
    private processedChunks: any[] = [];
    private currentMemoryUsage = 0;

    async parseInChunks(content: string, onProgress?: (progress: number) => void): Promise<ParsedData> {
        if (!content) return { headers: [], data: [], totalRows: 0, isLargeFile: false, fileSizeMB: 0 };

        const fileSizeMB = content.length / (1024 * 1024);
        const isLargeFile = fileSizeMB > 5; // Consider >5MB as very large

        if (!isLargeFile) {
            // For smaller files, use regular parsing
            return parseCSVSmart(content);
        }

        try {
            // Extract headers first
            const firstLine = content.split('\n')[0];
            const headers = Papa.parse(firstLine, { header: false }).data[0] as string[];
            
            // Estimate total rows
            const estimatedRows = content.split('\n').length - 1;
            
            // Process in chunks
            const chunks = this.splitIntoChunks(content);
            let processedRows = 0;
            
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkData = this.parseChunk(chunk, headers);
                
                // Add to processed chunks
                this.processedChunks.push(...chunkData);
                processedRows += chunkData.length;
                
                // Update progress
                if (onProgress) {
                    const progress = Math.round((i / chunks.length) * 100);
                    onProgress(progress);
                }
                
                // Memory management - clear old chunks if memory usage is high
                this.manageMemory();
                
                // Yield control to prevent blocking
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            return {
                headers,
                data: this.processedChunks,
                totalRows: estimatedRows,
                isLargeFile: true,
                fileSizeMB
            };
            
        } catch (error) {
            console.error("Error in streaming CSV parsing:", error);
            return { headers: [], data: [], totalRows: 0, isLargeFile: false, fileSizeMB: 0 };
        }
    }

    private splitIntoChunks(content: string): string[] {
        const lines = content.split('\n');
        const chunks: string[] = [];
        const headerLine = lines[0];
        
        for (let i = 1; i < lines.length; i += 1000) { // 1000 rows per chunk
            const chunkLines = lines.slice(i, i + 1000);
            chunks.push([headerLine, ...chunkLines].join('\n'));
        }
        
        return chunks;
    }

    private parseChunk(chunk: string, headers: string[]): any[] {
        try {
            const results = Papa.parse(chunk, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
            });
            
            return results.data || [];
        } catch (error) {
            console.error("Error parsing chunk:", error);
            return [];
        }
    }

    private manageMemory() {
        // Estimate memory usage (rough calculation)
        this.currentMemoryUsage = this.processedChunks.length * 100; // ~100 bytes per row
        
        if (this.currentMemoryUsage > this.maxMemoryUsage * 1024 * 1024) {
            // Keep only recent chunks
            const keepRows = Math.floor(this.maxMemoryUsage * 1024 * 1024 / 200); // Keep rows that fit in memory
            this.processedChunks = this.processedChunks.slice(-keepRows);
        }
    }

    clearMemory() {
        this.processedChunks = [];
        this.currentMemoryUsage = 0;
    }
}

// Enhanced CSV parser with streaming support
function parseCSVEnhanced(content: string, onProgress?: (progress: number) => void): Promise<ParsedData> {
    const fileSizeMB = content.length / (1024 * 1024);
    
    if (fileSizeMB > 10) { // Very large files >10MB
        const streamingParser = new StreamingCSVParser();
        return streamingParser.parseInChunks(content, onProgress);
    } else if (fileSizeMB > 1) { // Large files 1-10MB
        return new Promise((resolve) => {
            const data = parseCSVSmart(content);
            resolve(data);
        });
    } else { // Small files <1MB
        return new Promise((resolve) => {
            const data = parseCSVSmart(content);
            resolve(data);
        });
    }
}

export function CsvRenderer({
    content,
    className
}: CsvRendererProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ column: '', direction: null });
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage] = useState(100); // Increased for virtual scrolling
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showFullData, setShowFullData] = useState(false);
    const [fullData, setFullData] = useState<any[]>([]);
    const [parsingProgress, setParsingProgress] = useState(0);
    const [memoryUsage, setMemoryUsage] = useState<number>(0);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState(400);

    // Parse CSV data on mount
    useEffect(() => {
        const parseData = async () => {
            setIsLoading(true);
            setParsingProgress(0);

            try {
                const data = await parseCSVEnhanced(content, (progress) => {
                    setParsingProgress(progress);
                });
                setParsedData(data);
            } catch (error) {
                console.error("Error parsing CSV:", error);
                // Fallback to simple parser
                const fallbackData = parseCSVSmart(content);
                setParsedData(fallbackData);
            } finally {
                setIsLoading(false);
            }
        };

        parseData();
    }, [content]);

    // Monitor container height for virtual scrolling
    useEffect(() => {
        if (containerRef.current) {
            const resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    setContainerHeight(entry.contentRect.height);
                }
            });
            
            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    // Monitor memory usage
    useEffect(() => {
        if ('memory' in performance) {
            const updateMemoryUsage = () => {
                const memory = (performance as any).memory;
                const usedMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
                setMemoryUsage(usedMB);
            };
            
            updateMemoryUsage();
            const interval = setInterval(updateMemoryUsage, 2000);
            return () => clearInterval(interval);
        }
    }, []);

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
            let processedRows = 0;
            const estimatedTotalRows = content.split('\n').length - 1;
            
            const results = Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                step: () => {
                    processedRows++;
                    const progress = Math.round((processedRows / estimatedTotalRows) * 100);
                    setParsingProgress(Math.min(progress, 95));
                }
            });

            setFullData(results.data);
        } catch (error) {
            console.error("Error parsing full CSV:", error);
        } finally {
            setIsLoading(false);
        }
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

    const { headers, data, totalRows, isLargeFile, fileSizeMB } = parsedData;
    const isEmpty = data.length === 0;

    // Use virtual scrolling for large datasets
    const { visibleRange, setScrollTop, totalHeight, startOffset } = useVirtualScrolling(
        data,
        40, // row height
        containerHeight - 200 // account for header and controls
    );

    const processedData = useMemo(() => {
        let filtered = data;

        if (searchTerm) {
            filtered = filtered.filter((row: any) =>
                Object.values(row).some(value =>
                    String(value).toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }

        if (sortConfig.column && sortConfig.direction) {
            filtered = [...filtered].sort((a: any, b: any) => {
                const aVal = a[sortConfig.column];
                const bVal = b[sortConfig.column];
                
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return sortConfig.direction === 'asc' ? -1 : 1;
                if (bVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
                
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }
                
                const aStr = String(aVal).toLowerCase();
                const bStr = String(bVal).toLowerCase();
                
                if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [data, searchTerm, sortConfig]);

    const visibleHeaders = headers.filter(header => !hiddenColumns.has(header));
    const visibleData = processedData.slice(visibleRange.start, visibleRange.end);

    const handleSort = (column: string) => {
        setSortConfig(prev => {
            if (prev.column === column) {
                const newDirection = prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc';
                return { column: newDirection ? column : '', direction: newDirection };
            } else {
                return { column, direction: 'asc' };
            }
        });
    };

    const toggleColumnVisibility = (column: string) => {
        setHiddenColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(column)) {
                newSet.delete(column);
            } else {
                newSet.add(column);
            }
            return newSet;
        });
    };

    const getSortIcon = (column: string) => {
        if (sortConfig.column !== column) {
            return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
        }
        return sortConfig.direction === 'asc' ? 
            <ChevronUp className="h-3 w-3 text-primary" /> : 
            <ChevronDown className="h-3 w-3 text-primary" />;
    };

    const formatCellValue = (value: any) => {
        if (value == null) return '';
        if (typeof value === 'number') {
            return value.toLocaleString();
        }
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        return String(value);
    };

    const getCellClassName = (value: any) => {
        if (typeof value === 'number') {
            return 'text-right font-mono';
        }
        if (typeof value === 'boolean') {
            return value ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
        }
        return '';
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        setScrollTop(target.scrollTop);
    };

    if (isEmpty) {
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

    return (
        <div className={cn('w-full h-full flex flex-col bg-background', className)}>
            {/* Header with file info and controls */}
            <div className="flex-shrink-0 border-b bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        <div className='flex items-center gap-2'>
                            <h3 className="font-medium text-foreground">CSV Data</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{totalRows.toLocaleString()} rows</span>
                                <span>•</span>
                                <span>{visibleHeaders.length} columns</span>
                                <span>•</span>
                                <span>{fileSizeMB.toFixed(2)} MB</span>
                                {isLargeFile && (
                                    <Badge variant="secondary" className="ml-2">
                                        Large File
                                    </Badge>
                                )}
                                {memoryUsage > 0 && (
                                    <Badge variant="outline" className="ml-2">
                                        <HardDrive className="h-3 w-3 mr-1" />
                                        {memoryUsage}MB
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
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
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Filter className="h-4 w-4 mr-1" />
                                    Columns
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <div className="px-2 py-1.5 text-sm font-medium">Show/Hide Columns</div>
                                <DropdownMenuSeparator />
                                {headers.map(header => (
                                    <DropdownMenuCheckboxItem
                                        key={header}
                                        checked={!hiddenColumns.has(header)}
                                        onCheckedChange={() => toggleColumnVisibility(header)}
                                    >
                                        {header}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Warning for large files */}
                {isLargeFile && !showFullData && (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            This is a large CSV file ({fileSizeMB.toFixed(2)} MB). Showing sample data to prevent performance issues. 
                            Click "Show All Data" to view the complete dataset.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search data..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Virtual scrolling table */}
            <div className="flex-1 overflow-hidden" ref={containerRef}>
                <div 
                    className="w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent"
                    onScroll={handleScroll}
                >
                    <div style={{ height: totalHeight, position: 'relative' }}>
                        <table className="w-full border-collapse table-fixed" style={{ minWidth: `${visibleHeaders.length * 150}px` }}>
                            <thead className="bg-muted/50 sticky top-0 z-10">
                                <tr>
                                    {visibleHeaders.map((header) => (
                                        <th 
                                            key={header} 
                                            className="px-4 py-3 text-left font-medium border-b border-border bg-muted/50 backdrop-blur-sm"
                                            style={{ width: '150px', minWidth: '150px' }}
                                        >
                                            <button
                                                onClick={() => handleSort(header)}
                                                className="flex items-center gap-2 hover:text-primary transition-colors group w-full text-left"
                                            >
                                                <span className="truncate">{header}</span>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    {getSortIcon(header)}
                                                </div>
                                            </button>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleData.map((row: any, index) => {
                                    const actualIndex = visibleRange.start + index;
                                    return (
                                        <tr 
                                            key={actualIndex} 
                                            className="border-b border-border hover:bg-muted/30 transition-colors"
                                            style={{ height: '40px' }}
                                        >
                                            {visibleHeaders.map((header, cellIndex) => {
                                                const value = row[header];
                                                return (
                                                    <td 
                                                        key={`${actualIndex}-${cellIndex}`} 
                                                        className={cn(
                                                            "px-4 py-3 text-sm border-r border-border last:border-r-0",
                                                            getCellClassName(value)
                                                        )}
                                                        style={{ width: '150px', minWidth: '150px' }}
                                                    >
                                                        <div className="truncate" title={String(value || '')}>
                                                            {formatCellValue(value)}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Footer with info */}
            <div className="flex-shrink-0 border-t bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                        Showing {visibleRange.start + 1} to {Math.min(visibleRange.end, processedData.length)} of {processedData.length.toLocaleString()} rows
                        {searchTerm && ` (filtered from ${totalRows.toLocaleString()})`}
                    </div>
                    <div className="flex items-center gap-2">
                        <span>Virtual scrolling enabled</span>
                        {memoryUsage > 0 && (
                            <span>• Memory: {memoryUsage}MB</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
