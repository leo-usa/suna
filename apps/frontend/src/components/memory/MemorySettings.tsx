'use client';

import { useMemo, useState } from 'react';
import { Brain } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MemoryList } from './MemoryList';
import {
  useDeleteAllMemories,
  useDeleteMemory,
  useInfiniteMemories,
  useMemorySettings,
  useMemoryStats,
  useUpdateMemorySettings,
} from '@/hooks/memory/use-memory';
import { usePricingModalStore } from '@/stores/pricing-modal-store';

export function MemorySettings() {
  const t = useTranslations('settings.memory');
  const tCommon = useTranslations('common');
  const { openPricingModal } = usePricingModalStore();
  const [showClearAll, setShowClearAll] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const statsQuery = useMemoryStats();
  const settingsQuery = useMemorySettings();
  const memoriesQuery = useInfiniteMemories(50);
  const updateSettings = useUpdateMemorySettings();
  const deleteMemory = useDeleteMemory();
  const deleteAll = useDeleteAllMemories();

  const stats = statsQuery.data;
  const memoryEnabled = settingsQuery.data?.memory_enabled ?? stats?.memory_enabled ?? false;
  const maxMemories = stats?.max_memories ?? 0;
  const totalMemories = stats?.total_memories ?? 0;
  const tierAvailable = maxMemories > 0;
  const memories = useMemo(
    () => memoriesQuery.data?.pages.flatMap((page) => page.memories) ?? [],
    [memoriesQuery.data]
  );

  const handleToggle = (enabled: boolean) => {
    if (!tierAvailable) {
      openPricingModal({ title: t('upgradeRequired') });
      return;
    }
    updateSettings.mutate(enabled);
  };

  const handleDelete = (memoryId: string) => {
    setDeletingIds((prev) => new Set(prev).add(memoryId));
    deleteMemory.mutate(memoryId, {
      onSettled: () => {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(memoryId);
          return next;
        });
      },
    });
  };

  return (
    <div className="p-4 sm:p-6 pb-12 sm:pb-6 space-y-5 sm:space-y-6 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{t('title')}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('description')}
            </p>
          </div>
        </div>
      </div>

      {statsQuery.isLoading || settingsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : !tierAvailable ? (
        <Alert className="border-primary/20 bg-primary/5">
          <AlertDescription className="text-sm space-y-3">
            <p>{t('notAvailable')}</p>
            <Button size="sm" onClick={() => openPricingModal({ title: t('upgradeRequired') })}>
              {t('clickToUpgrade')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 py-3 border-b">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="enable-memory" className="text-sm font-medium cursor-pointer">
                {t('enableMemory')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('enableMemoryDescription')}
              </p>
            </div>
            <Switch
              id="enable-memory"
              checked={memoryEnabled}
              onCheckedChange={handleToggle}
              disabled={updateSettings.isPending}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{t('usage')}</span>
              <span className="text-muted-foreground">
                {t('available', { count: `${totalMemories}/${maxMemories}` })}
              </span>
            </div>
            <Progress value={Math.min(100, (totalMemories / maxMemories) * 100)} />
          </div>

          {!memoryEnabled && (
            <Alert>
              <AlertDescription className="text-sm">
                {t('memoryDisabledByUser')}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">{t('yourMemories')}</h4>
                <p className="text-xs text-muted-foreground">{t('yourMemoriesDescription')}</p>
              </div>
              {totalMemories > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setShowClearAll(true)}
                >
                  {t('clearAll')}
                </Button>
              )}
            </div>

            <MemoryList
              memories={memories}
              isLoading={memoriesQuery.isLoading || memoriesQuery.isFetchingNextPage}
              error={memoriesQuery.error instanceof Error ? memoriesQuery.error.message : null}
              onDelete={handleDelete}
              onLoadMore={() => memoriesQuery.fetchNextPage()}
              hasMore={memoriesQuery.hasNextPage}
              deletingIds={deletingIds}
            />
          </div>
        </>
      )}

      <AlertDialog open={showClearAll} onOpenChange={setShowClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteAllTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteAllDescription', { count: totalMemories })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteAll.mutate(undefined, {
                  onSuccess: () => setShowClearAll(false),
                });
              }}
            >
              {t('deleteAllButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
