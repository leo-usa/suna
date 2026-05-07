import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Zap, ChevronRight, Sparkles, Server } from 'lucide-react';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface CustomMCPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: CustomMCPConfiguration) => void;
}

interface CustomMCPConfiguration {
  name: string;
  type: 'http';
  config: any;
  enabledTools: string[];
  selectedProfileId?: string;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: any;
}

export const CustomMCPDialog: React.FC<CustomMCPDialogProps> = ({
  open,
  onOpenChange,
  onSave
}) => {
  const t = useTranslations('agentConfig.mcpWizard');
  const tErr = useTranslations('agentConfig.mcpWizard.errors');
  const [step, setStep] = useState<'setup' | 'tools'>('setup');
  const [serverType, setServerType] = useState<'http'>('http');
  const [configText, setConfigText] = useState('');
  const [serverName, setServerName] = useState('');
  const [manualServerName, setManualServerName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [discoveredTools, setDiscoveredTools] = useState<MCPTool[]>([]);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [processedConfig, setProcessedConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validateAndDiscoverTools = async () => {
    setIsValidating(true);
    setValidationError(null);
    setDiscoveredTools([]);
    
    try {
      let parsedConfig: any;
      
      if (serverType === 'http') {
        const url = configText.trim();
        if (!url) {
          throw new Error(tErr('urlRequired'));
        }
        if (!manualServerName.trim()) {
          throw new Error(tErr('nameRequired'));
        }
        
        parsedConfig = { url };
        setServerName(manualServerName.trim());
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(tErr('loginRequired'));
      }

      const response = await fetch(`${API_URL}/mcp/discover-custom-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: serverType,
          config: parsedConfig
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || tErr('connectFailed'));
      }

      const data = await response.json();
      
      if (!data.tools || data.tools.length === 0) {
        throw new Error(tErr('noTools'));
      }

      if (data.serverName) {
        setServerName(data.serverName);
      }

      if (data.processedConfig) {
        setProcessedConfig(data.processedConfig);
      }

      setDiscoveredTools(data.tools);
      setSelectedTools(new Set(data.tools.map((tool: MCPTool) => tool.name)));
      setStep('tools');
      
    } catch (error: any) {
      setValidationError(error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleToolsNext = async () => {
    if (selectedTools.size === 0) {
      setValidationError(tErr('selectTools'));
      return;
    }
    setValidationError(null);
    await handleSave();
  };

  const handleSave = async () => {
    if (discoveredTools.length === 0 || selectedTools.size === 0) {
      setValidationError(tErr('selectTools'));
      return;
    }

    if (!serverName.trim()) {
      setValidationError(tErr('saveNameMissing'));
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      const configToSave: any = { url: configText.trim() };
      
      onSave({
        name: serverName,
        type: serverType,
        config: configToSave,
        enabledTools: Array.from(selectedTools),
        selectedProfileId: undefined
      });
      
      setConfigText('');
      setManualServerName('');
      setDiscoveredTools([]);
      setSelectedTools(new Set());
      setServerName('');
      setProcessedConfig(null);
      setValidationError(null);
      setStep('setup');
      onOpenChange(false);
    } catch (error: any) {
      setValidationError(error.message || tErr('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToolToggle = (toolName: string) => {
    const newTools = new Set(selectedTools);
    if (newTools.has(toolName)) {
      newTools.delete(toolName);
    } else {
      newTools.add(toolName);
    }
    setSelectedTools(newTools);
  };

  const handleBack = () => {
    if (step === 'tools') {
      setStep('setup');
    }
    setValidationError(null);
  };

  const handleReset = () => {
    setConfigText('');
    setManualServerName('');
    setDiscoveredTools([]);
    setSelectedTools(new Set());
    setServerName('');
    setProcessedConfig(null);
    
    setValidationError(null);
    setStep('setup');
    setIsSaving(false);
  };

  const exampleConfigs = {
    http: `https://server.example.com/mcp`
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) handleReset();
    }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle>{t('title')}</DialogTitle>
          </div>
          <DialogDescription>
            {step === 'setup' 
              ? t('descriptionSetup')
              : t('descriptionTools')
            }
          </DialogDescription>
          <div className="flex items-center gap-2 pt-2">
            <div className={cn(
              "flex items-center gap-2 text-sm font-medium",
              step === 'setup' ? "text-primary" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                step === 'setup' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                1
              </div>
              {t('stepSetup')}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className={cn(
              "flex items-center gap-2 text-sm font-medium",
              step === 'tools' ? "text-primary" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                step === 'tools' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                2
              </div>
              {t('stepTools')}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto max-h-[60vh] flex flex-col">
          {step === 'setup' ? (
            <div className="space-y-6 p-1 flex-1">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base font-medium">{t('connectionType')}</Label>
                  <div className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border bg-primary/5",
                    "border-primary"
                  )}>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" />
                        <Label className="text-base font-medium">
                          {t('streamableHttpTitle')}
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t('streamableHttpBody')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serverName" className="text-base font-medium">
                    {t('serverNameLabel')}
                  </Label>
                  <input
                    id="serverName"
                    type="text"
                    placeholder={t('serverNamePlaceholder')}
                    value={manualServerName}
                    onChange={(e) => setManualServerName(e.target.value)}
                    className="w-full px-4 py-3 border border-input bg-background rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('serverNameHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="config" className="text-base font-medium">
                    {t('serverUrlLabel')}
                  </Label>
                  <Input
                      id="config"
                      type="url"
                      placeholder={exampleConfigs.http}
                      value={configText}
                      onChange={(e) => setConfigText(e.target.value)}
                      className="w-full px-4 py-3 border border-input bg-muted rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent font-mono"
                    />
                  <p className="text-sm text-muted-foreground">
                    {t('serverUrlHint')}
                  </p>
                </div>
              </div>

              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : step === 'tools' ? (
            <div className="space-y-6 p-1 flex-1 flex flex-col">
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="ml-2">
                  <h3 className="font-medium text-green-900 mb-1">
                    {t('connectedHeading')}
                  </h3>
                  <p className="text-sm text-green-700">
                    {t('foundTools', { count: discoveredTools.length, serverName })}
                  </p>
                </div>
              </Alert>

              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-medium">{t('availableTools')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('selectToolsHint')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedTools.size === discoveredTools.length) {
                        setSelectedTools(new Set());
                      } else {
                        setSelectedTools(new Set(discoveredTools.map((tool) => tool.name)));
                      }
                    }}
                  >
                    {selectedTools.size === discoveredTools.length ? t('deselectAll') : t('selectAll')}
                  </Button>
                </div>

                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-[400px] border border-border rounded-lg">
                    <div className="space-y-3 p-4">
                      {discoveredTools.map((tool) => (
                        <div 
                          key={tool.name} 
                          className={cn(
                            "flex items-start space-x-3 p-4 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                            selectedTools.has(tool.name) 
                              ? "border-primary bg-primary/5" 
                              : "border-border"
                          )}
                          onClick={() => handleToolToggle(tool.name)}
                        >
                          <Checkbox
                            id={tool.name}
                            checked={selectedTools.has(tool.name)}
                            onCheckedChange={() => handleToolToggle(tool.name)}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2 min-w-0">
                            <Label
                              htmlFor={tool.name}
                              className="text-base font-medium cursor-pointer block"
                            >
                              {tool.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Label>
                            {tool.description && (
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {tool.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-shrink-0 pt-4">
          {step === 'tools' ? (
            <>
              <Button variant="outline" onClick={handleBack} disabled={isSaving} type="button">
                {t('back')}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving} type="button">
                {t('cancel')}
              </Button>
              <Button 
                onClick={handleToolsNext}
                disabled={selectedTools.size === 0 || isSaving}
                type="button"
              >
                {isSaving ? (
                  <>
                    <DobbyLoader customSize={16} className="mr-1" />
                    {t('adding')}
                  </>
                ) : (
                  t('addWithCount', { count: selectedTools.size })
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
                {t('cancel')}
              </Button>
              <Button
                onClick={validateAndDiscoverTools}
                disabled={!configText.trim() || !manualServerName.trim() || isValidating}
                type="button"
              >
                {isValidating ? (
                  <>
                    <DobbyLoader customSize={20} className="mr-1" />
                    {t('connecting')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    {t('connectCta')}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};