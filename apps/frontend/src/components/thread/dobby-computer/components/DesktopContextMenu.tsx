'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
import { 
  RefreshCw, 
  FolderPlus, 
  Upload, 
  Download,
  Info,
  Folder,
  Globe,
  TerminalSquare,
} from 'lucide-react';

interface DesktopContextMenuProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  onNewFolder?: () => void;
  onUpload?: () => void;
  onDownloadAll?: () => void;
  onOpenFiles?: () => void;
  onOpenBrowser?: () => void;
  onOpenTerminal?: () => void;
  onShowInfo?: () => void;
}

export const DesktopContextMenu = memo(function DesktopContextMenu({
  children,
  onRefresh,
  onNewFolder,
  onUpload,
  onDownloadAll,
  onOpenFiles,
  onOpenBrowser,
  onOpenTerminal,
  onShowInfo,
}: DesktopContextMenuProps) {
  const t = useTranslations('dobbyComputer.contextMenu');
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-background/60 backdrop-blur-xl border-border/20 rounded-xl overflow-hidden">
        <ContextMenuItem 
          onClick={onOpenFiles}
          className="focus:bg-background/10 focus:backdrop-blur-xl rounded-lg gap-2"
        >
          <Folder className="h-4 w-4" />
          {t('openFiles')}
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={onOpenBrowser}
          className="focus:bg-background/10 focus:backdrop-blur-xl rounded-lg gap-2"
        >
          <Globe className="h-4 w-4" />
          {t('openBrowser')}
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={onOpenTerminal}
          className="focus:bg-background/10 focus:backdrop-blur-xl rounded-lg gap-2"
        >
          <TerminalSquare className="h-4 w-4" />
          {t('openTerminal')}
        </ContextMenuItem>
        
        <ContextMenuSeparator className="bg-border/50" />
        
        <ContextMenuItem 
          onClick={onNewFolder}
          className="focus:bg-background/10 focus:backdrop-blur-xl rounded-lg gap-2"
        >
          <FolderPlus className="h-4 w-4" />
          {t('newFolder')}
          <ContextMenuShortcut>⇧⌘N</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="bg-border/50" />
    
        <ContextMenuItem 
          onClick={onShowInfo}
          className="focus:bg-background/10 focus:backdrop-blur-xl rounded-lg gap-2"
        >
          <Info className="h-4 w-4" />
          {t('systemInfo')}
          <ContextMenuShortcut>⌘I</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

DesktopContextMenu.displayName = 'DesktopContextMenu';
