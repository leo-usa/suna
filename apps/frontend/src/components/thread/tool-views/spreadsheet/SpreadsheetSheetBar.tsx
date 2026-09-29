'use client';

import { cn } from '@/lib/utils';
import type { SpreadsheetSheetTab } from './useSpreadsheetSync';

interface SpreadsheetSheetBarProps {
  sheets: SpreadsheetSheetTab[];
  activeSheetIndex: number;
  onSelect: (index: number) => void;
}

export function SpreadsheetSheetBar({
  sheets,
  activeSheetIndex,
  onSelect,
}: SpreadsheetSheetBarProps) {
  if (sheets.length < 2) return null;

  return (
    <div className="relative z-10 flex h-9 shrink-0 items-stretch overflow-x-auto border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      {sheets.map((sheet) => {
        const active = sheet.index === activeSheetIndex;
        return (
          <button
            key={sheet.index}
            type="button"
            onClick={() => onSelect(sheet.index)}
            className={cn(
              'shrink-0 border-r border-zinc-200 px-3 text-xs dark:border-zinc-800',
              active
                ? 'bg-background font-medium text-foreground'
                : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
            )}
          >
            {sheet.name}
          </button>
        );
      })}
    </div>
  );
}
