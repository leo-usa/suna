'use client';

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Lock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModelSelection, type ModelOption } from '@/hooks/agents';
import { usePricingModalStore } from '@/stores/pricing-modal-store';
import { ModelProviderIcon } from '@/lib/model-provider-icons';
import { Separator } from '@/components/ui/separator';
import { useTranslations } from 'next-intl';

function formatLitellmModelName(litellmModelId: string): string {
  const slug = litellmModelId.split('/').pop() || litellmModelId;
  return slug
    .split('-')
    .map((part) => {
      if (/^\d+(\.\d+)*$/.test(part)) return part;
      if (part.toLowerCase() === 'gpt') return 'GPT';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function resolveUnderlyingModelLabel(
  modeModel: ModelOption | undefined,
  allModels: ModelOption[],
): string | null {
  if (!modeModel?.litellmModelId) return null;

  const match = allModels.find(
    (m) =>
      m.id !== modeModel.id &&
      m.id !== 'dobby/basic' &&
      m.id !== 'dobby/power' &&
      m.litellmModelId === modeModel.litellmModelId,
  );
  if (match?.label) return match.label;

  return formatLitellmModelName(modeModel.litellmModelId);
}

// Logo component for mode display with theme support
// Uses CSS to switch between light/dark variants without JS
const ModeLogo = memo(function ModeLogo({ 
  mode, 
  height = 12
}: { 
  mode: 'basic' | 'advanced'; 
  height?: number;
}) {
  const t = useTranslations('thread.modeIndicator');
  const darkSrc = mode === 'advanced' ? '/Advanced-Light.svg' : '/Basic-Light.svg';
  const lightSrc = mode === 'advanced' ? '/Advanced-Dark.svg' : '/Basic-Dark.svg';

  return (
    <span className="flex-shrink-0 relative" style={{ height: `${height}px`, width: 'auto' }}>
      {/* Light mode image */}
      <img
        src={lightSrc}
        alt={mode === 'advanced' ? t('advancedAlt') : t('basicAlt')}
        className="block dark:hidden"
        style={{ height: `${height}px`, width: 'auto' }}
        suppressHydrationWarning
      />
      {/* Dark mode image */}
      <img
        src={darkSrc}
        alt={mode === 'advanced' ? t('advancedAlt') : t('basicAlt')}
        className="hidden dark:block"
        style={{ height: `${height}px`, width: 'auto' }}
        suppressHydrationWarning
      />
    </span>
  );
});

export const ModeIndicator = memo(function ModeIndicator() {
  const t = useTranslations('thread.modeIndicator');
  const [isOpen, setIsOpen] = useState(false);
  const {
    selectedModel,
    allModels: modelOptions,
    canAccessModel,
    handleModelChange,
  } = useModelSelection();

  // Allow users to see/select the full model list in production.
  // Access is still enforced by the backend (allowed models only are actionable).
  const showAllModelsOption = true;

  const basicModel = useMemo(
    () => modelOptions.find((m) => m.id === 'dobby/basic' || m.label === 'Dobby Basic'),
    [modelOptions]
  );
  
  const powerModel = useMemo(
    () => modelOptions.find((m) => m.id === 'dobby/power' || m.label === 'Dobby Advanced Mode'),
    [modelOptions]
  );

  // Get other models (not basic or power) for the staging section
  const otherModels = useMemo(() => {
    return modelOptions.filter(
      (m) => m.id !== 'dobby/basic' && m.id !== 'dobby/power' && 
             m.label !== 'Dobby Basic' && m.label !== 'Dobby Advanced Mode'
    ).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [modelOptions]);

  // Check if a non-standard model is selected
  const isOtherModelSelected = useMemo(() => {
    return selectedModel && 
           selectedModel !== basicModel?.id && 
           selectedModel !== powerModel?.id;
  }, [selectedModel, basicModel?.id, powerModel?.id]);

  const selectedOtherModel = useMemo(() => {
    if (!isOtherModelSelected) return null;
    return modelOptions.find((m) => m.id === selectedModel);
  }, [isOtherModelSelected, modelOptions, selectedModel]);

  const canAccessPower = powerModel ? canAccessModel(powerModel.id) : false;
  const isPowerSelected = powerModel && selectedModel === powerModel.id;
  const isBasicSelected = basicModel && selectedModel === basicModel.id;

  const basicUnderlyingLabel = useMemo(
    () => resolveUnderlyingModelLabel(basicModel, modelOptions),
    [basicModel, modelOptions],
  );
  const advancedUnderlyingLabel = useMemo(
    () => resolveUnderlyingModelLabel(powerModel, modelOptions),
    [powerModel, modelOptions],
  );
  const selectedUnderlyingLabel = isPowerSelected
    ? advancedUnderlyingLabel
    : isBasicSelected
      ? basicUnderlyingLabel
      : null;

  const handleBasicClick = useCallback(() => {
    if (basicModel) {
      handleModelChange(basicModel.id);
      setIsOpen(false);
    }
  }, [basicModel, handleModelChange]);

  const handleAdvancedClick = useCallback(() => {
    if (powerModel) {
      if (canAccessPower) {
        handleModelChange(powerModel.id);
        setIsOpen(false);
      } else {
        setIsOpen(false);
        usePricingModalStore.getState().openPricingModal({
          isAlert: true,
          alertTitle: t('upgradeAdvanced'),
        });
      }
    }
  }, [powerModel, canAccessPower, handleModelChange, t]);

  const handleOtherModelClick = useCallback((modelId: string) => {
    handleModelChange(modelId);
    setIsOpen(false);
  }, [handleModelChange]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 min-h-9 py-1 rounded-lg transition-all duration-150 cursor-pointer touch-manipulation',
            'hover:bg-accent/50 active:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
          aria-label={t('selectModel')}
        >
          {isOtherModelSelected && selectedOtherModel ? (
            <>
              <ModelProviderIcon modelId={selectedOtherModel.id} size={18} />
              <span className="text-sm font-medium truncate max-w-[140px] sm:max-w-[180px]">
                {selectedOtherModel.label}
              </span>
            </>
          ) : (
            <span className="flex flex-col items-start min-w-0 leading-none">
              <ModeLogo mode={isPowerSelected ? 'advanced' : 'basic'} height={13} />
              {selectedUnderlyingLabel && (
                <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate max-w-[140px] sm:max-w-[180px] mt-0.5">
                  {selectedUnderlyingLabel}
                </span>
              )}
            </span>
          )}
          <ChevronDown className={cn(
            "h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0",
            isOpen && "rotate-180"
          )} strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="start" 
        className="w-[280px] sm:w-[320px] p-1.5 sm:p-2 rounded-xl border border-border/50 shadow-lg"
        sideOffset={6}
      >
        {/* Basic Mode */}
        <div
          className={cn(
            'flex items-start gap-3 px-3 py-3 cursor-pointer rounded-lg transition-all duration-150 mb-1.5',
            isBasicSelected 
              ? 'bg-accent' 
              : 'hover:bg-accent/50 active:bg-accent/70'
          )}
          onClick={handleBasicClick}
        >
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <ModeLogo mode="basic" height={14} />
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">{t('basicDescription')}</div>
            {basicUnderlyingLabel && (
              <div className="text-[11px] text-muted-foreground/80 mt-1 truncate">
                {t('poweredBy', { model: basicUnderlyingLabel })}
              </div>
            )}
          </div>
          {isBasicSelected && (
            <Check className="h-4 w-4 text-foreground flex-shrink-0 mt-0.5" strokeWidth={2} />
          )}
        </div>

        {/* Advanced Mode */}
        <div
          className={cn(
            'flex items-start gap-3 px-3 py-3 cursor-pointer rounded-lg transition-all duration-150',
            isPowerSelected 
              ? 'bg-accent' 
              : 'hover:bg-accent/50 active:bg-accent/70'
          )}
          onClick={handleAdvancedClick}
        >
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <ModeLogo mode="advanced" height={14} />
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">{t('advancedDescription')}</div>
            {advancedUnderlyingLabel && (
              <div className="text-[11px] text-muted-foreground/80 mt-1 truncate">
                {t('poweredBy', { model: advancedUnderlyingLabel })}
              </div>
            )}
          </div>
          {isPowerSelected ? (
            <Check className="h-4 w-4 text-foreground flex-shrink-0 mt-0.5" strokeWidth={2} />
          ) : !canAccessPower ? (
            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" strokeWidth={2} />
          ) : null}
        </div>

        {/* All Models Section */}
        {showAllModelsOption && otherModels.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-2">
              <span>{t('allModels')}</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {otherModels.map((model) => {
                const isSelected = selectedModel === model.id;
                
                return (
                  <div
                    key={model.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-all duration-150 my-0.5',
                      isSelected 
                        ? 'bg-accent' 
                        : 'hover:bg-accent/50 active:bg-accent/70'
                    )}
                    onClick={() => handleOtherModelClick(model.id)}
                  >
                    <ModelProviderIcon modelId={model.id} size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{model.label}</div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-foreground flex-shrink-0" strokeWidth={2} />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default ModeIndicator;
