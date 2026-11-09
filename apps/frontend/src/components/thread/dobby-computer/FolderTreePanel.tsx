'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { listSandboxFiles, type FileInfo } from '@/lib/api/sandbox';
import { cn } from '@/lib/utils';

const WORKSPACE_ROOT = '/workspace';

function normalizePath(path: string): string {
  if (!path) return WORKSPACE_ROOT;
  if (path === 'workspace' || path.startsWith('workspace/')) {
    return `/${path}`;
  }
  if (path.startsWith('/workspace')) return path.replace(/\/+$/, '') || WORKSPACE_ROOT;
  return `${WORKSPACE_ROOT}/${path.replace(/^\//, '')}`.replace(/\/+$/, '') || WORKSPACE_ROOT;
}

function isAncestorOrSelf(currentPath: string, nodePath: string): boolean {
  const current = normalizePath(currentPath);
  const node = normalizePath(nodePath);
  return current === node || current.startsWith(`${node}/`);
}

function parentPath(path: string): string | null {
  const normalized = normalizePath(path);
  if (normalized === WORKSPACE_ROOT) return null;
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return WORKSPACE_ROOT;
  const parent = normalized.slice(0, idx);
  return parent || WORKSPACE_ROOT;
}

interface FolderTreePanelProps {
  sandboxId?: string;
  currentPath: string;
  enabled?: boolean;
  onNavigate: (path: string) => void;
  className?: string;
}

interface TreeNodeProps {
  path: string;
  name: string;
  depth: number;
  currentPath: string;
  expanded: Set<string>;
  childrenByPath: Record<string, FileInfo[] | undefined>;
  loadingPaths: Set<string>;
  onToggle: (path: string) => void;
  onNavigate: (path: string) => void;
}

function TreeNode({
  path,
  name,
  depth,
  currentPath,
  expanded,
  childrenByPath,
  loadingPaths,
  onToggle,
  onNavigate,
}: TreeNodeProps) {
  const isExpanded = expanded.has(path);
  const isActive = normalizePath(currentPath) === normalizePath(path);
  const children = childrenByPath[path];
  const isLoading = loadingPaths.has(path);
  const folders = useMemo(
    () => (children || []).filter((f) => f.is_dir).sort((a, b) => a.name.localeCompare(b.name)),
    [children],
  );

  return (
    <div>
      <div
        className={cn(
          'w-full flex items-center gap-0.5 pr-2 py-0.5 text-left text-sm rounded-md transition-colors',
          isActive
            ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-zinc-100',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        title={path}
      >
        <button
          type="button"
          className="p-0.5 rounded hover:bg-zinc-300/60 dark:hover:bg-zinc-700 flex-shrink-0 touch-manipulation"
          onClick={() => onToggle(path)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isLoading ? (
            <DobbyLoader size="small" className="h-3 w-3" />
          ) : isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          className="flex items-center gap-1 min-w-0 flex-1 py-0.5 touch-manipulation text-left"
          onClick={() => {
            onNavigate(path);
            if (!isExpanded) onToggle(path);
          }}
        >
          {isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-600/80 dark:text-amber-500/80" />
          ) : (
            <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-600/80 dark:text-amber-500/80" />
          )}
          <span className="truncate">{name}</span>
        </button>
      </div>

      {isExpanded && (
        <div>
          {folders.map((folder) => (
            <TreeNode
              key={folder.path}
              path={normalizePath(folder.path)}
              name={folder.name}
              depth={depth + 1}
              currentPath={currentPath}
              expanded={expanded}
              childrenByPath={childrenByPath}
              loadingPaths={loadingPaths}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
          {!isLoading && folders.length === 0 && children && (
            <div
              className="text-[11px] text-zinc-400 dark:text-zinc-600 py-0.5"
              style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
            >
              —
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FolderTreePanel({
  sandboxId,
  currentPath,
  enabled = true,
  onNavigate,
  className,
}: FolderTreePanelProps) {
  const t = useTranslations('dobbyComputer.fileBrowser');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([WORKSPACE_ROOT]));
  const [childrenByPath, setChildrenByPath] = useState<Record<string, FileInfo[] | undefined>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  const loadChildren = useCallback(
    async (path: string) => {
      if (!sandboxId || !enabled) return;
      const normalized = normalizePath(path);
      setLoadingPaths((prev) => new Set(prev).add(normalized));
      try {
        const files = await listSandboxFiles(sandboxId, normalized);
        setChildrenByPath((prev) => ({ ...prev, [normalized]: files }));
      } catch (error) {
        console.error('[FolderTreePanel] Failed to load', normalized, error);
        setChildrenByPath((prev) => ({ ...prev, [normalized]: [] }));
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(normalized);
          return next;
        });
      }
    },
    [sandboxId, enabled],
  );

  // Keep ancestors of current path expanded and loaded
  useEffect(() => {
    if (!sandboxId || !enabled) return;
    const normalized = normalizePath(currentPath);
    const toExpand = new Set<string>([WORKSPACE_ROOT]);
    let cursor: string | null = normalized;
    while (cursor) {
      toExpand.add(cursor);
      cursor = parentPath(cursor);
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      toExpand.forEach((p) => next.add(p));
      return next;
    });
    toExpand.forEach((p) => {
      if (childrenByPath[p] === undefined) {
        void loadChildren(p);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when path/sandbox changes
  }, [sandboxId, enabled, currentPath, loadChildren]);

  const onToggle = useCallback(
    (path: string) => {
      const normalized = normalizePath(path);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(normalized)) {
          // Don't collapse ancestors of the active folder — keep orientation
          if (isAncestorOrSelf(currentPath, normalized) && normalized !== normalizePath(currentPath)) {
            return prev;
          }
          next.delete(normalized);
        } else {
          next.add(normalized);
          if (childrenByPath[normalized] === undefined) {
            void loadChildren(normalized);
          }
        }
        return next;
      });
    },
    [childrenByPath, currentPath, loadChildren],
  );

  if (!sandboxId || !enabled) {
    return null;
  }

  return (
    <div
      className={cn(
        'w-[160px] sm:w-[180px] flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex flex-col min-h-0',
        className,
      )}
    >
      <div className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500 border-b border-zinc-200/80 dark:border-zinc-800">
        {t('folderTree')}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1 pr-1">
          <TreeNode
            path={WORKSPACE_ROOT}
            name={t('filesTitle')}
            depth={0}
            currentPath={currentPath}
            expanded={expanded}
            childrenByPath={childrenByPath}
            loadingPaths={loadingPaths}
            onToggle={onToggle}
            onNavigate={onNavigate}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
