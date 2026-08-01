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
import { useModelPricing, type ModelPricingItem } from '@/hooks/billing/use-model-pricing';
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

function formatUsdPerMillion(value: number): string {
  if (value >= 1) return `$${Number(value.toFixed(2))}`;
  return `$${Number(value.toFixed(3))}`;
}

function formatInputOutputPrice(input: number, output: number): string {
  return `${formatUsdPerMillion(input)}/${formatUsdPerMillion(output)}`;
}

function resolvePriceLabel(
  modelId: string | undefined,
  litellmModelId: string | undefined,
  pricingById: Map<string, string>,
  pricingModels: ModelPricingItem[] | undefined,
  allModels: ModelOption[],
): string | null {
  if (modelId) {
    const direct = pricingById.get(modelId);
    if (direct) return direct;
  }
  if (!litellmModelId || !pricingModels?.length) return null;
  const byLite = pricingModels.find((p) => {
    const opt = allModels.find((m) => m.id === p.id);
    return opt?.litellmModelId === litellmModelId;
  });
  if (!byLite) return null;
  return formatInputOutputPrice(
    byLite.input_cost_per_million_tokens,
    byLite.output_cost_per_million_tokens,
  );
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
  const { data: pricingData } = useModelPricing();

  // Allow users to see/select the full model list in production.
  // Access is still enforced by the backend (allowed models only are actionable).
  const showAllModelsOption = true;

  const pricingById = useMemo(() => {
    const map = new Map<string, string>();
    for (const model of pricingData?.models ?? []) {
      map.set(
        model.id,
        formatInputOutputPrice(
          model.input_cost_per_million_tokens,
          model.output_cost_per_million_tokens,
        ),
      );
    }
    return map;
  }, [pricingData?.models]);

  const basicModel = useMemo(
    () => modelOptions.find((m) => m.id === 'dobby/basic' || m.label === 'Dobby Basic'),
    [modelOptions]
  );
  
  const powerModel = useMemo(
    () => modelOptions.find((m) => m.id === 'dobby/power' || m.label === 'Dobby Advanced Mode'),
    [modelOptions]
  );

  // Get other models (not basic or power); accessible first, then by priority
  const otherModels = useMemo(() => {
    return modelOptions.filter(
      (m) => m.id !== 'dobby/basic' && m.id !== 'dobby/power' && 
             m.label !== 'Dobby Basic' && m.label !== 'Dobby Advanced Mode'
    ).sort((a, b) => {
      if (a.requiresSubscription !== b.requiresSubscription) {
        return a.requiresSubscription ? 1 : -1;
      }
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
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

  const basicPriceLabel = useMemo(
    () =>
      resolvePriceLabel(
        basicModel?.id,
        basicModel?.litellmModelId,
        pricingById,
        pricingData?.models,
        modelOptions,
      ),
    [basicModel, pricingById, pricingData?.models, modelOptions],
  );
  const advancedPriceLabel = useMemo(
    () =>
      resolvePriceLabel(
        powerModel?.id,
        powerModel?.litellmModelId,
        pricingById,
        pricingData?.models,
        modelOptions,
      ),
    [powerModel, pricingById, pricingData?.models, modelOptions],
  );

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

  const handleOtherModelClick = useCallback((model: ModelOption) => {
    if (model.requiresSubscription || !canAccessModel(model.id)) {
      setIsOpen(false);
      usePricingModalStore.getState().openPricingModal({
        isAlert: true,
        alertTitle: t('upgradePaidModel', { model: model.label }),
      });
      return;
    }
    handleModelChange(model.id);
    setIsOpen(false);
  }, [canAccessModel, handleModelChange, t]);

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
        className="w-[300px] sm:w-[360px] p-1.5 sm:p-2 rounded-xl border border-border/50 shadow-lg"
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
                {basicPriceLabel && (
                  <span className="ml-1.5 tabular-nums">{basicPriceLabel}</span>
                )}
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
                {advancedPriceLabel && (
                  <span className="ml-1.5 tabular-nums">{advancedPriceLabel}</span>
                )}
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
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center justify-between gap-2">
              <span>{t('allModels')}</span>
              <span className="text-[10px] font-normal text-muted-foreground/70">
                {t('pricePerMillion')}
              </span>
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              {otherModels.map((model) => {
                const isSelected = selectedModel === model.id;
                const isLocked = model.requiresSubscription || !canAccessModel(model.id);
                const priceLabel = resolvePriceLabel(
                  model.id,
                  model.litellmModelId,
                  pricingById,
                  pricingData?.models,
                  modelOptions,
                );

                return (
                  <div
                    key={model.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-all duration-150 my-0.5',
                      isSelected 
                        ? 'bg-accent' 
                        : 'hover:bg-accent/50 active:bg-accent/70',
                      isLocked && 'opacity-55'
                    )}
                    onClick={() => handleOtherModelClick(model)}
                  >
                    <ModelProviderIcon modelId={model.id} size={20} className={cn(isLocked && 'opacity-70')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          'text-sm font-medium truncate',
                          isLocked && 'text-muted-foreground'
                        )}>
                          {model.label}
                        </div>
                        {priceLabel && (
                          <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap flex-shrink-0">
                            {priceLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-foreground flex-shrink-0" strokeWidth={2} />
                    ) : isLocked ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" strokeWidth={2} />
                    ) : null}
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
