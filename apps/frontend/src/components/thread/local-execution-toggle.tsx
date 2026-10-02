'use client';

import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isElectron } from '@/lib/utils/is-electron';
import { useProjectQuery } from '@/hooks/threads/use-project';
import {
  ensureLocalRunnerReady,
  getPreferredExecutionTarget,
  getSaveComputerScreenshots,
  isLocalRunnerAvailable,
  setPreferredExecutionTarget,
  setProjectComputerScreenshots,
  setProjectExecutionTarget,
  setSaveComputerScreenshots,
  type ExecutionTarget,
} from '@/lib/api/local-runner';
import { dedicateProject, undedicateProject } from '@/lib/api/threads';
import { useQueryClient } from '@tanstack/react-query';
import { threadKeys } from '@/hooks/threads/keys';
import { toast } from '@/lib/toast';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Cloud, Laptop, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountState } from '@/hooks/billing';
import { usePricingModalStore } from '@/stores/pricing-modal-store';

function projectTarget(project?: { dedicated_at?: string | null; execution_target?: string | null }): ExecutionTarget {
  if (project?.dedicated_at) return 'dedicated';
  if (project?.execution_target === 'local') return 'local';
  return 'cloud';
}

export function LocalExecutionToggle({
  projectId,
  className,
}: {
  projectId?: string;
  className?: string;
}) {
  const t = useTranslations('threads');
  const tSidebar = useTranslations('sidebar');
  const queryClient = useQueryClient();
  const { data: project, isLoading: projectLoading } = useProjectQuery(projectId, {
    refetchOnMount: true,
    staleTime: 0,
  });
  const { data: accountState } = useAccountState();
  const { openPricingModal } = usePricingModalStore();
  const [pending, setPending] = useState(false);
  const [preferred, setPreferred] = useState<ExecutionTarget>(getPreferredExecutionTarget);
  const [saveScreenshots, setSaveScreenshots] = useState(getSaveComputerScreenshots);
  const electron = isElectron() || isLocalRunnerAvailable();
  const triedProject = useRef<string | null>(null);
  const selected = projectId ? projectTarget(project) : preferred;
  const canUseDedicated = accountState?.limits?.dedicated_computer?.can_use ?? false;

  useEffect(() => {
    if (!electron || !projectId || projectTarget(project) !== 'local') return;
    setProjectComputerScreenshots(projectId, getSaveComputerScreenshots()).catch(() => {});
  }, [electron, projectId, project]);

  const applyTarget = async (next: ExecutionTarget) => {
    if (next === selected) return;
    if (next === 'dedicated' && !canUseDedicated && !project?.dedicated_at) {
      openPricingModal({
        isAlert: true,
        alertTitle: t('runOnDedicated'),
        alertSubtitle: tSidebar('dedicatedComputerTooltip'),
      });
      return;
    }

    setPending(true);
    try {
      if (next === 'local') {
        await ensureLocalRunnerReady();
      }
      setPreferredExecutionTarget(next);
      setPreferred(next);

      if (projectId) {
        const isDedicated = Boolean(project?.dedicated_at);
        if (next === 'dedicated') {
          if (!isDedicated) {
            await dedicateProject(projectId);
          }
          if (project?.execution_target === 'local') {
            await setProjectExecutionTarget(projectId, 'cloud');
          }
        } else if (next === 'local') {
          if (isDedicated) {
            await undedicateProject(projectId);
          }
          await setProjectExecutionTarget(projectId, 'local');
          await setProjectComputerScreenshots(projectId, getSaveComputerScreenshots());
        } else {
          if (isDedicated) {
            await undedicateProject(projectId);
          }
          await setProjectExecutionTarget(projectId, 'cloud');
        }
        await queryClient.invalidateQueries({ queryKey: threadKeys.project(projectId) });
        await queryClient.invalidateQueries({ queryKey: threadKeys.lists() });
      }

      toast.success(
        next === 'local'
          ? t('localRunnerEnabled')
          : next === 'dedicated'
            ? t('dedicatedRunnerEnabled')
            : t('localRunnerDisabled'),
      );
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
    if (project.execution_target === 'local' && !project.dedicated_at) {
      void (async () => {
        try {
          await ensureLocalRunnerReady();
          await setProjectExecutionTarget(projectId, 'local');
          await queryClient.invalidateQueries({ queryKey: threadKeys.project(projectId) });
        } catch (error: any) {
          toast.error(error?.message || t('localRunnerConnectFailed'));
        }
      })();
    }
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

  const options: { value: ExecutionTarget; icon: typeof Cloud; label: string; hint?: string }[] = [
    { value: 'cloud', icon: Cloud, label: t('runOnCloud'), hint: t('runOnCloudHint') },
    { value: 'dedicated', icon: Monitor, label: t('runOnDedicated') },
    ...(electron ? [{ value: 'local' as const, icon: Laptop, label: t('runOnThisComputer') }] : []),
  ];
  const current = options.find((option) => option.value === selected) || options[0];
  const CurrentIcon = current.icon;

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex items-center', className)}>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={pending}
                  className="flex items-center gap-1.5 px-2 h-9 rounded-lg hover:bg-accent/50 text-muted-foreground"
                >
                  <CurrentIcon className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm whitespace-nowrap">{current.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              <p>
                {selected === 'local'
                  ? t('runOnThisComputerTooltip')
                  : selected === 'dedicated'
                    ? tSidebar('dedicatedComputerTooltip')
                    : t('runOnCloudTooltip')}
              </p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-56">
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => void applyTarget(option.value)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{option.label}</span>
                  {option.hint && (
                    <span className="text-[11px] text-muted-foreground">{option.hint}</span>
                  )}
                  {option.value === selected && <Check className="h-3.5 w-3.5" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {selected === 'local' && (
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
