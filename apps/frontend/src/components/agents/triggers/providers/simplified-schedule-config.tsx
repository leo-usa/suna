'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Clock,
  Zap,
  Calendar as CalendarIcon,
  Target,
  Timer,
  Repeat,
  ChevronRight,
  Sparkles,
  Activity,
  Globe,
  CheckCircle2,
  Settings,
  Info
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TriggerProvider, ScheduleTriggerConfig } from '../types';
import { AgentSelector } from '@/components/agents/agent-selector';
import { AgentModelSelector } from '@/components/agents/config/model-selector';
import { useTranslations } from 'next-intl';

function presetSlug(id: string): string {
  return id.replace(/-/g, '_');
}

interface SimplifiedScheduleConfigProps {
  provider: TriggerProvider;
  config: ScheduleTriggerConfig;
  onChange: (config: ScheduleTriggerConfig) => void;
  errors: Record<string, string>;
  agentId: string;
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
  selectedAgent?: string;
  onAgentSelect?: (agentId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (data: { name: string; description: string; config: ScheduleTriggerConfig; is_active: boolean }) => void;
  isEditMode?: boolean;
}

interface SchedulePreset {
  id: string;
  cron: string;
  icon: React.ReactNode;
}

const QUICK_PRESETS: SchedulePreset[] = [
  {
    id: 'hourly',
    cron: '0 * * * *',
    icon: <Clock className="h-5 w-5" />
  },
  {
    id: 'daily-9am',
    cron: '0 9 * * *',
    icon: <Target className="h-5 w-5" />
  },
  {
    id: 'daily-12pm',
    cron: '0 12 * * *',
    icon: <Target className="h-5 w-5" />
  },
  {
    id: 'daily-6pm',
    cron: '0 18 * * *',
    icon: <Target className="h-5 w-5" />
  },
  {
    id: 'twice-daily',
    cron: '0 9,17 * * *',
    icon: <Repeat className="h-5 w-5" />
  },
  {
    id: 'weekdays-9am',
    cron: '0 9 * * 1-5',
    icon: <CalendarIcon className="h-5 w-5" />
  },
  {
    id: 'monday-mornings',
    cron: '0 9 * * 1',
    icon: <CalendarIcon className="h-5 w-5" />
  },
  {
    id: 'friday-evenings',
    cron: '0 17 * * 5',
    icon: <CalendarIcon className="h-5 w-5" />
  },
  {
    id: 'weekend-mornings',
    cron: '0 10 * * 0,6',
    icon: <CalendarIcon className="h-5 w-5" />
  },
  {
    id: 'monthly-1st',
    cron: '0 9 1 * *',
    icon: <CalendarIcon className="h-5 w-5" />
  },
  {
    id: 'monthly-15th',
    cron: '0 9 15 * *',
    icon: <CalendarIcon className="h-5 w-5" />
  },
  {
    id: 'end-of-month',
    cron: '0 9 28-31 * *',
    icon: <CalendarIcon className="h-5 w-5" />
  }
];

const RECURRING_PRESETS: SchedulePreset[] = [
  {
    id: 'weekdays-9am',
    cron: '0 9 * * 1-5',
    icon: <CalendarIcon className="h-5 w-5" />
  },
  {
    id: 'weekly-monday',
    cron: '0 9 * * 1',
    icon: <Repeat className="h-5 w-5" />
  },
  {
    id: 'monthly-1st',
    cron: '0 9 1 * *',
    icon: <CalendarIcon className="h-5 w-5" />
  }
];

const TIMEZONE_DEFS: { value: string; labelKey: string }[] = [
  { value: 'UTC', labelKey: 'UTC' },
  { value: 'America/New_York', labelKey: 'America_New_York' },
  { value: 'America/Chicago', labelKey: 'America_Chicago' },
  { value: 'America/Denver', labelKey: 'America_Denver' },
  { value: 'America/Los_Angeles', labelKey: 'America_Los_Angeles' },
  { value: 'Europe/London', labelKey: 'Europe_London' },
  { value: 'Europe/Paris', labelKey: 'Europe_Paris' },
  { value: 'Asia/Tokyo', labelKey: 'Asia_Tokyo' },
  { value: 'Asia/Shanghai', labelKey: 'Asia_Shanghai' },
  { value: 'Australia/Sydney', labelKey: 'Australia_Sydney' },
];

const WEEKDAY_VALUES = [
  { value: '1' },
  { value: '2' },
  { value: '3' },
  { value: '4' },
  { value: '5' },
  { value: '6' },
  { value: '0' },
];

const isCronTooFrequent = (cronExpression: string): boolean => {
  if (!cronExpression) return false;
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  
  const [minute, hour] = parts;
  
  if (hour === '*' && (minute === '*' || minute.startsWith('*/'))) {
    return true;
  }
  
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.slice(2), 10);
    if (!isNaN(interval) && interval < 60) {
      return true;
    }
  }
  
  return false;
};

const ProgressStepper = ({ currentStep }: { currentStep: 'setup' | 'schedule' | 'execute' }) => {
  const t = useTranslations('agentConfig.scheduleWizard');
  const steps = [
    { id: 'setup' as const, name: t('stepSetup'), icon: <Target className="h-4 w-4" /> },
    { id: 'schedule' as const, name: t('stepSchedule'), icon: <Clock className="h-4 w-4" /> },
    { id: 'execute' as const, name: t('stepExecute'), icon: <Sparkles className="h-4 w-4" /> }
  ];

  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="px-6 py-3 border-b bg-muted/30">
      <div className="flex items-center space-x-1">
        {steps.map((wizardStep, index) => (
          <React.Fragment key={wizardStep.id}>
            <div className="flex items-center space-x-2">
              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                index <= currentIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {index < currentIndex ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className={cn(
                "text-sm font-medium",
                index <= currentIndex
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}>
                {wizardStep.name}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: (i + 1).toString(),
  label: (i + 1).toString()
}));

export const SimplifiedScheduleConfig: React.FC<SimplifiedScheduleConfigProps> = ({
  config,
  onChange,
  errors,
  agentId,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  isActive,
  onActiveChange,
  selectedAgent,
  onAgentSelect,
  open,
  onOpenChange,
  onSave,
  isEditMode = false
}) => {
  const t = useTranslations('agentConfig.scheduleWizard');
  const localizedUserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const timezoneOptions = useMemo(() => {
    const rows = TIMEZONE_DEFS.map((d) => ({
      value: d.value,
      label: t(`timezones.${d.labelKey}`),
    }));
    const hasUser = TIMEZONE_DEFS.some((d) => d.value === localizedUserTz);
    if (!hasUser) {
      return [
        {
          value: localizedUserTz,
          label: `${localizedUserTz} ${t('timezones.userSuffix')}`,
        },
        ...rows,
      ];
    }
    return rows;
  }, [t, localizedUserTz]);

  const weekdays = useMemo(
    () =>
      WEEKDAY_VALUES.map((day) => ({
        value: day.value,
        label: t(`weekdays.${day.value}.long`),
        short: t(`weekdays.${day.value}.short`),
      })),
    [t]
  );

  const presetDefaultName = (presetId: string) => {
    if (QUICK_PRESETS.some((p) => p.id === presetId)) {
      return t(`presetQuick.${presetSlug(presetId)}.name`);
    }
    return t(`presetRecurring.${presetSlug(presetId)}.name`);
  };

  const [currentStep, setCurrentStep] = useState<'setup' | 'schedule' | 'execute'>('setup');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [timezone, setTimezone] = useState<string>(config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Recurring schedule state
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedHour, setSelectedHour] = useState<string>('9');
  const [selectedMinute, setSelectedMinute] = useState<string>('0');
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [selectedMonthDays, setSelectedMonthDays] = useState<string[]>(['1']);

  // One-time schedule state
  const [oneTimeDate, setOneTimeDate] = useState<Date | undefined>(undefined);
  const [oneTimeHour, setOneTimeHour] = useState<string>('9');
  const [oneTimeMinute, setOneTimeMinute] = useState<string>('0');


  // Find matching preset
  useEffect(() => {
    const allPresets = [...QUICK_PRESETS, ...RECURRING_PRESETS];
    const preset = allPresets.find(p => p.cron === config.cron_expression);
    setSelectedPreset(preset?.id || '');
  }, [config.cron_expression]);

  // Update cron when recurring settings change
  // Removed auto-generation to prevent interference with preset selections

  // Update cron when one-time settings change
  useEffect(() => {
    if (!selectedPreset && oneTimeDate) { // Only auto-generate if no preset is selected
      handleOneTimeScheduleChange();
    }
  }, [oneTimeDate, oneTimeHour, oneTimeMinute]);

  // Initialize recurring schedule on component mount if no preset is selected
  useEffect(() => {
    if (!selectedPreset && !config.cron_expression) {
      handleRecurringScheduleChange();
    }
  }, []);

  const handlePresetSelect = (presetId: string) => {
    const allPresets = [...QUICK_PRESETS, ...RECURRING_PRESETS];
    const preset = allPresets.find(p => p.id === presetId);
    if (preset) {
      setSelectedPreset(presetId);
      onChange({
        ...config,
        cron_expression: preset.cron,
        timezone: timezone
      });

      // Auto-generate name if empty
      if (!name) {
        onNameChange(presetDefaultName(presetId));
      }
    }
  };

  const handleTimezoneChange = (newTimezone: string) => {
    setTimezone(newTimezone);
    onChange({
      ...config,
      timezone: newTimezone
    });
  };

  const generateCronFromRecurring = () => {
    const minute = selectedMinute || '0';
    const hour = selectedHour || '9';

    switch (scheduleType) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        const weekdays = selectedWeekdays.length > 0 ? selectedWeekdays.join(',') : '1';
        return `${minute} ${hour} * * ${weekdays}`;
      case 'monthly':
        const monthDays = selectedMonthDays.length > 0 ? selectedMonthDays.join(',') : '1';
        return `${minute} ${hour} ${monthDays} * *`;
      default:
        return `${minute} ${hour} * * *`;
    }
  };

  const handleRecurringScheduleChange = () => {
    const cronExpression = generateCronFromRecurring();
    console.log('Generated cron expression:', cronExpression, {
      scheduleType,
      selectedHour,
      selectedMinute,
      selectedWeekdays,
      selectedMonthDays
    });
    onChange({
      ...config,
      cron_expression: cronExpression,
      timezone: timezone
    });
    // Only clear preset if we're generating a different cron than what's currently set
    if (cronExpression !== config.cron_expression) {
      setSelectedPreset(''); // Clear preset selection when using custom recurring
    }
  };

  const handleWeekdayToggle = (weekday: string) => {
    const newWeekdays = selectedWeekdays.includes(weekday)
      ? selectedWeekdays.filter(w => w !== weekday)
      : [...selectedWeekdays, weekday].sort();
    
    // Prevent deselecting all weekdays (must have at least one)
    if (newWeekdays.length > 0) {
      setSelectedWeekdays(newWeekdays);
      setTimeout(() => handleRecurringScheduleChange(), 0);
    }
  };

  const handleMonthDayToggle = (day: string) => {
    const newDays = selectedMonthDays.includes(day)
      ? selectedMonthDays.filter(d => d !== day)
      : [...selectedMonthDays, day].sort((a, b) => parseInt(a) - parseInt(b));
    
    // Prevent deselecting all month days (must have at least one)
    if (newDays.length > 0) {
      setSelectedMonthDays(newDays);
      setTimeout(() => handleRecurringScheduleChange(), 0);
    }
  };

  const generateCronFromOneTime = () => {
    if (!oneTimeDate) return '';

    const minute = oneTimeMinute;
    const hour = oneTimeHour;
    const day = oneTimeDate.getDate();
    const month = oneTimeDate.getMonth() + 1; // JavaScript months are 0-indexed

    return `${minute} ${hour} ${day} ${month} *`;
  };

  const handleOneTimeScheduleChange = () => {
    const cronExpression = generateCronFromOneTime();
    onChange({
      ...config,
      cron_expression: cronExpression,
      timezone: timezone
    });
    setSelectedPreset(''); // Clear preset selection when using one-time
  };

  const handleAgentPromptChange = (prompt: string) => {
    onChange({
      ...config,
      agent_prompt: prompt
    });
  };

  const renderContent = () => (
    <div className="flex flex-col h-full max-h-[90vh]">
      <div className="shrink-0 px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{isEditMode ? t('editTitle') : t('createTitle')}</h2>
        </div>
      </div>
      <ProgressStepper currentStep={currentStep} />
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {currentStep === 'setup' && (
            <div className="h-full flex flex-col">
              <div className="p-6 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{t('taskSetupHeading')}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t('taskSetupSubtitle')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Worker Selection */}
                  {onAgentSelect && (
                    <div className="border rounded-lg p-4 space-y-4">
                      <div>
                        <h3 className="font-medium mb-1">{t('workerSelectionTitle')}</h3>
                        <p className="text-sm text-muted-foreground">{t('workerSelectionSubtitle')}</p>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('workerLabel')}</Label>
                        <AgentSelector
                          selectedAgentId={selectedAgent}
                          onAgentSelect={onAgentSelect}
                          placeholder={t('workerSelectPlaceholder')}
                          showCreateOption={true}
                        />
                      </div>
                    </div>
                  )}

                  {/* Basic Info */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">{t('taskDetailsTitle')}</h3>
                      <p className="text-sm text-muted-foreground">{t('taskDetailsSubtitle')}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-name">{t('taskNameLabel')}</Label>
                        <Input
                          id="task-name"
                          value={name}
                          onChange={(e) => onNameChange(e.target.value)}
                          placeholder={t('taskNamePlaceholder')}
                          className={cn(errors.name && "border-destructive")}
                        />
                        {errors.name && (
                          <p className="text-sm text-destructive">{errors.name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-description">{t('taskDescriptionLabel')}</Label>
                        <Textarea
                          id="task-description"
                          value={description}
                          onChange={(e) => onDescriptionChange(e.target.value)}
                          placeholder={t('taskDescriptionPlaceholder')}
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Helpful Tip */}
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5">
                        <Info className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-1">{t('proTipTitle')}</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          {t('proTipBody')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Setup Step Footer */}
              <div className="shrink-0 border-t p-4 bg-background">
                <div className="flex justify-end">
                  <Button
                    onClick={() => setCurrentStep('schedule')}
                    disabled={!name.trim() || (onAgentSelect && !selectedAgent)}
                    size="sm"
                  >
                    {t('nextSchedule')}
                    <ChevronRight className="h-3 w-3 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'schedule' && (
            <div className="h-full flex flex-col">
              <div className="p-6 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{t('scheduleHeading')}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t('scheduleSubtitle')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Frequency Selection */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">{t('frequencyTitle')}</h3>
                      <p className="text-sm text-muted-foreground">{t('frequencySubtitle')}</p>
                    </div>
                    <Tabs defaultValue="quick" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="quick">{t('tabQuick')}</TabsTrigger>
                        <TabsTrigger value="recurring">{t('tabRecurring')}</TabsTrigger>
                        <TabsTrigger value="one-time">{t('tabOneTime')}</TabsTrigger>
                        <TabsTrigger value="advanced">{t('tabAdvanced')}</TabsTrigger>
                      </TabsList>

                      <TabsContent value="quick" className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">{t('quickChooserLabel')}</Label>
                          <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
                            {QUICK_PRESETS.map((preset) => (
                              <Button
                                key={preset.id}
                                variant={selectedPreset === preset.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePresetSelect(preset.id)}
                                className="w-full justify-start h-12 p-3"
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <div className="flex-shrink-0">
                                    {preset.icon}
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="font-medium text-sm">{t(`presetQuick.${presetSlug(preset.id)}.name`)}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {t(`presetQuick.${presetSlug(preset.id)}.description`)}
                                    </div>
                                  </div>
                                </div>
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t('quickTabHint')}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="recurring" className="space-y-4">
                        <div className="space-y-4">
                          <Label className="text-sm font-medium">{t('recurringLabel')}</Label>

                          {/* Schedule Type */}
                          <div className="space-y-2">
                            <Label className="text-sm">{t('intervalQuestion')}</Label>
                            <Select value={scheduleType} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => {
                              setScheduleType(value);
                              // Set appropriate defaults for the schedule type
                              if (value === 'weekly' && selectedWeekdays.length === 5) {
                                // If switching to weekly and currently have weekdays selected, set to just Monday
                                setSelectedWeekdays(['1']);
                              } else if (value === 'monthly' && selectedMonthDays.length !== 1) {
                                // If switching to monthly, set to first day of month
                                setSelectedMonthDays(['1']);
                              }
                              setTimeout(() => handleRecurringScheduleChange(), 0);
                            }}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">{t('intervalDaily')}</SelectItem>
                                <SelectItem value="weekly">{t('intervalWeekly')}</SelectItem>
                                <SelectItem value="monthly">{t('intervalMonthly')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Time Selection */}
                          <div className="space-y-2">
                            <Label className="text-sm">{t('whatTimeQuestion')}</Label>
                            <div className="flex gap-2 items-center">
                              <Select value={selectedHour} onValueChange={(value) => {
                                setSelectedHour(value);
                                setTimeout(() => handleRecurringScheduleChange(), 0);
                              }}>
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                      {i.toString().padStart(2, '0')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-muted-foreground">:</span>
                              <Select value={selectedMinute} onValueChange={(value) => {
                                setSelectedMinute(value);
                                setTimeout(() => handleRecurringScheduleChange(), 0);
                              }}>
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {['00', '15', '30', '45'].map((minute) => (
                                    <SelectItem key={minute} value={minute}>
                                      {minute}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-sm text-muted-foreground ml-2">
                                {t('timeSuffix24h', { hhmm: `${selectedHour.padStart(2, '0')}:${selectedMinute}` })}
                              </span>
                            </div>
                          </div>

                          {/* Weekly - Day Selection */}
                          {scheduleType === 'weekly' && (
                            <div className="space-y-3">
                              <Label className="text-sm">{t('whichWeekdays')}</Label>
                              <div className="flex gap-1 flex-wrap">
                                {weekdays.map((day) => (
                                  <Button
                                    key={day.value}
                                    variant={selectedWeekdays.includes(day.value) ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleWeekdayToggle(day.value)}
                                    className="h-9 w-14 p-0 text-xs"
                                  >
                                    {day.short}
                                  </Button>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t('weeklySelectionHint', { count: selectedWeekdays.length })}
                              </p>
                            </div>
                          )}

                          {/* Monthly - Day Selection */}
                          {scheduleType === 'monthly' && (
                            <div className="space-y-3">
                              <Label className="text-sm">{t('whichMonthDays')}</Label>
                              <div className="grid grid-cols-7 gap-1 max-h-32 overflow-y-auto">
                                {MONTH_DAYS.map((day) => (
                                  <Button
                                    key={day.value}
                                    variant={selectedMonthDays.includes(day.value) ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleMonthDayToggle(day.value)}
                                    className="h-8 w-8 p-0 text-xs"
                                  >
                                    {day.label}
                                  </Button>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t('monthlySelectionHint', { count: selectedMonthDays.length })}
                              </p>
                            </div>
                          )}

                          {/* Preview */}
                          <div className="bg-muted/50 p-4 rounded-lg border">
                            <div className="font-medium text-sm mb-2">{t('scheduleSummaryTitle')}</div>
                            <div className="space-y-2 text-sm">
                              <div className="text-foreground">
                                {scheduleType === 'daily' && t('summaryDaily', { time: `${selectedHour.padStart(2, '0')}:${selectedMinute}` })}
                                {scheduleType === 'weekly' && selectedWeekdays.length > 0 &&
                                  t('summaryWeeklyDays', {
                                    days: weekdays.filter(d => selectedWeekdays.includes(d.value)).map(d => d.label).join(', '),
                                    time: `${selectedHour.padStart(2, '0')}:${selectedMinute}`,
                                  })
                                }
                                {scheduleType === 'monthly' && selectedMonthDays.length > 0 &&
                                  (selectedMonthDays.length > 1
                                    ? t('summaryMonthlyPlural', {
                                        days: selectedMonthDays.join(', '),
                                        time: `${selectedHour.padStart(2, '0')}:${selectedMinute}`,
                                      })
                                    : t('summaryMonthlySingle', {
                                        days: selectedMonthDays.join(', '),
                                        time: `${selectedHour.padStart(2, '0')}:${selectedMinute}`,
                                      })
                                  )
                                }
                              </div>
                              <div className="text-muted-foreground">
                                <strong>{t('cronLabel')}</strong> <code className="bg-background px-1 rounded font-mono text-xs">{generateCronFromRecurring()}</code>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="one-time" className="space-y-4">
                        <div className="space-y-4">
                          <Label className="text-sm font-medium">{t('oneTimeHeading')}</Label>

                          {/* Date Selection */}
                          <div className="space-y-2">
                            <Label className="text-xs">{t('dateLabel')}</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !oneTimeDate && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {oneTimeDate ? format(oneTimeDate, "PPP") : <span>{t('pickDate')}</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={oneTimeDate}
                                  onSelect={setOneTimeDate}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Time Selection */}
                          <div className="space-y-2">
                            <Label className="text-xs">{t('timeLabel')}</Label>
                            <div className="flex gap-2">
                              <Select value={oneTimeHour} onValueChange={setOneTimeHour}>
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                      {i.toString().padStart(2, '0')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="flex items-center">:</span>
                              <Select value={oneTimeMinute} onValueChange={setOneTimeMinute}>
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {['00', '15', '30', '45'].map((minute) => (
                                    <SelectItem key={minute} value={minute}>
                                      {minute}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Preview */}
                          {oneTimeDate && (
                            <div className="bg-muted/50 p-4 rounded-lg border">
                              <div className="font-medium text-sm mb-2">{t('scheduleSummaryTitle')}</div>
                              <div className="space-y-2 text-sm">
                                <div className="text-foreground">
                                  <strong>{t('oneTimeScheduledFor')}</strong>{' '}
                                  {format(oneTimeDate, 'PPP')} · {oneTimeHour.padStart(2, '0')}:{oneTimeMinute}
                                </div>
                                <div className="text-muted-foreground">
                                  <strong>{t('cronLabel')}</strong> <code className="bg-background px-1 rounded font-mono text-xs">{generateCronFromOneTime()}</code>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground">
                            {t('oneTimeDisclaimer')}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="advanced" className="space-y-4">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium">{t('advancedCronTitle')}</Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('advancedCronSubtitle')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="cron">{t('cronExprLabel')}</Label>
                            <Input
                              id="cron"
                              value={config.cron_expression || ''}
                              onChange={(e) => onChange({ ...config, cron_expression: e.target.value })}
                              placeholder="0 9 * * 1-5"
                              className={cn("font-mono", isCronTooFrequent(config.cron_expression || '') && "border-destructive")}
                            />
                            {isCronTooFrequent(config.cron_expression || '') && (
                              <p className="text-sm text-destructive">
                                {t('cronTooFrequent')}
                              </p>
                            )}
                          </div>

                          <div className="bg-muted/50 p-4 rounded-lg border">
                            <div className="font-medium text-sm mb-2">{t('cronFormatTitle')}</div>
                            <div className="space-y-2 text-sm">
                              <div className="font-mono text-xs bg-background p-2 rounded border">
                                {t('cronFormatLine')}
                              </div>
                              <div className="text-muted-foreground">
                                <div>{t('cronFormatExample', { code: '0 9 * * 1-5' })}</div>
                                <div className="mt-1">
                                  {t('cronWildcardsExplain')}
                                </div>
                              </div>
                              <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                {t('cronRestrictedNote', { forbiddenExample: '*/5 * * * *' })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>

                    {errors.cron_expression && (
                      <p className="text-sm text-destructive">{errors.cron_expression}</p>
                    )}
                  </div>

                  {/* Timezone Selection */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">{t('timezoneTitle')}</h3>
                      <p className="text-sm text-muted-foreground">{t('timezoneSubtitle')}</p>
                    </div>
                    <Select value={timezone} onValueChange={handleTimezoneChange}>
                      <SelectTrigger>
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            <span>{timezoneOptions.find((opt) => opt.value === timezone)?.label || timezone}</span>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {timezoneOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Helpful Tip */}
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 mt-0.5">
                        <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-amber-900 dark:text-amber-100 mb-1">{t('timezoneCalloutTitle')}</h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {t('timezoneCalloutBody')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Step Footer */}
              <div className="shrink-0 border-t p-4 bg-background">
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep('setup')}
                    size="sm"
                  >
                    <ChevronRight className="h-3 w-3 mr-2 rotate-180" />
                    {t('backToSetup')}
                  </Button>
                  <Button
                    onClick={() => setCurrentStep('execute')}
                    disabled={(!config.cron_expression && !selectedPreset) || isCronTooFrequent(config.cron_expression || '')}
                    size="sm"
                  >
                    {t('nextExecutionMethod')}
                    <ChevronRight className="h-3 w-3 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'execute' && (
            <div className="h-full flex flex-col">
              <div className="p-6 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{t('executionHeading')}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t('executionSubtitle')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                <div className="max-w-2xl mx-auto space-y-6">

                  {/* Execution Type Selection */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">{t('executionMethodTitle')}</h3>
                      <p className="text-sm text-muted-foreground">{t('executionMethodSubtitle')}</p>
                    </div>

                    <div className="p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center space-x-3">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <Label className="font-medium">{t('workerInstructionsTitle')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('workerInstructionsCardSubtitle')}
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Worker Instructions */}
                  {true && (
                    <div className="border rounded-lg p-4 space-y-4">
                      <div>
                        <h3 className="font-medium mb-1">{t('workerInstructionsTitle')}</h3>
                        <p className="text-sm text-muted-foreground">{t('workerInstructionsSectionSubtitle')}</p>
                      </div>
                      <div className="space-y-2">
                        <Textarea
                          value={config.agent_prompt || ''}
                          onChange={(e) => handleAgentPromptChange(e.target.value)}
                          placeholder={t('workerInstructionsPlaceholder')}
                          rows={4}
                          className={cn(errors.agent_prompt && "border-destructive")}
                        />
                        {errors.agent_prompt && (
                          <p className="text-sm text-destructive">{errors.agent_prompt}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {t('promptVariablesHint', { syntax: '{{variable_name}}' })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Model Selection */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">{t('modelTitle')}</h3>
                      <p className="text-sm text-muted-foreground">{t('modelSubtitle')}</p>
                    </div>
                    <AgentModelSelector
                      value={config.model || 'dobby/basic'}
                      onChange={(model) => onChange({ ...config, model })}
                    />
                  </div>

                </div>
              </div>

              {/* Execute Step Footer */}
              <div className="shrink-0 border-t p-4 bg-background">
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep('schedule')}
                    size="sm"
                  >
                    <ChevronRight className="h-3 w-3 mr-2 rotate-180" />
                    {t('backToSchedule')}
                  </Button>
                  <Button
                    onClick={() => {
                      if (onSave) {
                        onSave({
                          name,
                          description,
                          config: {
                            ...config
                          },
                          is_active: isActive
                        });
                      }
                    }}
                    disabled={!config.agent_prompt?.trim()}
                    size="sm"
                  >
                    {isEditMode ? t('submitUpdate') : t('submitCreate')}
                    <Sparkles className="h-3 w-3 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Always render as dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{isEditMode ? t('editTitle') : t('createTitle')}</DialogTitle>
        </VisuallyHidden>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};
