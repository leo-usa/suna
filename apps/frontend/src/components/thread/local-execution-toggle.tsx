'use client';

import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isElectron } from '@/lib/utils/is-electron';
import { useProjectQuery } from '@/hooks/threads/use-project';
import {
  ensureLocalRunnerReady,
  getPreferredExecutionTarget,
  getSaveComputerScreenshots,
  setPreferredExecutionTarget,
  setProjectComputerScreenshots,
  setProjectExecutionTarget,
  setSaveComputerScreenshots,
} from '@/lib/api/local-runner';
import { useQueryClient } from '@tanstack/react-query';
import { threadKeys } from '@/hooks/threads/keys';
import { toast } from '@/lib/toast';
import { useEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';

export function LocalExecutionToggle({ projectId }: { projectId?: string }) {
  const t = useTranslations('threads');
  const queryClient = useQueryClient();
  const { data: project, isLoading: projectLoading } = useProjectQuery(projectId, {
    refetchOnMount: true,
    staleTime: 0,
  });
  const [pending, setPending] = useState(false);
  const [preferredLocal, setPreferredLocal] = useState(
    () => getPreferredExecutionTarget() === 'local',
  );
  const [saveScreenshots, setSaveScreenshots] = useState(getSaveComputerScreenshots);
  const electron = isElectron();
  const triedProject = useRef<string | null>(null);
  const projectIsLocal = project?.execution_target === 'local';
  const checked = projectId ? projectIsLocal : preferredLocal;

  useEffect(() => {
    if (!electron || !projectId || !projectIsLocal) return;
    setProjectComputerScreenshots(projectId, getSaveComputerScreenshots()).catch(() => {});
  }, [electron, projectId, projectIsLocal]);

  const onToggle = async (next: boolean) => {
    setPending(true);
    try {
      setPreferredExecutionTarget(next ? 'local' : 'cloud');
      setPreferredLocal(next);
      if (next) {
        await ensureLocalRunnerReady();
      }
      if (projectId) {
        await setProjectExecutionTarget(projectId, next ? 'local' : 'cloud');
        await queryClient.invalidateQueries({ queryKey: threadKeys.project(projectId) });
        if (next) {
          await setProjectComputerScreenshots(projectId, getSaveComputerScreenshots());
        }
      }
      toast.success(next ? t('localRunnerEnabled') : t('localRunnerDisabled'));
    } catch (error: any) {
      toast.error(error?.message || t('localRunnerConnectFailed'));
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (!electron || !projectId || pending || projectLoading || !project) return;
    if (triedProject.current === projectId) return;
    triedProject.current = projectId;
    if (project.execution_target === 'local') {
      void (async () => {
        try {
          await ensureLocalRunnerReady();
          await setProjectExecutionTarget(projectId, 'local');
          await queryClient.invalidateQueries({ queryKey: threadKeys.project(projectId) });
        } catch (error: any) {
          toast.error(error?.message || t('localRunnerConnectFailed'));
        }
      })();
      return;
    }
    if (getPreferredExecutionTarget() !== 'local') return;
    void onToggle(true);
  }, [electron, projectId, project, pending, projectLoading]);

  const onSaveScreenshots = async (next: boolean) => {
    setSaveComputerScreenshots(next);
    setSaveScreenshots(next);
    try {
      if (projectId) {
        await setProjectComputerScreenshots(projectId, next);
      }
      toast.success(next ? t('saveComputerScreenshotsOn') : t('saveComputerScreenshotsOff'));
    } catch (error: any) {
      setSaveComputerScreenshots(!next);
      setSaveScreenshots(!next);
      toast.error(error?.message || t('localRunnerConnectFailed'));
    }
  };

  if (!electron) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="flex items-center gap-1.5 px-2 h-9 rounded-lg hover:bg-accent/50 cursor-pointer">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline text-sm text-muted-foreground whitespace-nowrap">
                {t('runOnThisComputer')}
              </span>
              <Switch checked={checked} disabled={pending} onCheckedChange={onToggle} />
            </label>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            <p>{t('runOnThisComputerTooltip')}</p>
          </TooltipContent>
        </Tooltip>
        {checked && (
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="flex items-center gap-1.5 px-2 h-9 rounded-lg hover:bg-accent/50 cursor-pointer">
                <span className="hidden sm:inline text-sm text-muted-foreground whitespace-nowrap">
                  {t('saveComputerScreenshots')}
                </span>
                <Switch checked={saveScreenshots} onCheckedChange={onSaveScreenshots} />
              </label>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4} className="max-w-xs">
              <p>{t('saveComputerScreenshotsTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
