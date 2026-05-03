'use client';

import React, { useState } from 'react';
import { Key, Plus, Trash2, Copy, Shield, ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DobbyLogo } from '@/components/sidebar/dobby-logo';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  apiKeysApi,
  APIKeyCreateRequest,
  APIKeyResponse,
  APIKeyCreateResponse,
} from '@/lib/api/api-keys';

interface NewAPIKeyData {
  title: string;
  description: string;
  expiresInDays: string;
}

export default function APIKeysPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState<NewAPIKeyData>({
    title: '',
    description: '',
    expiresInDays: 'never',
  });
  const [createdApiKey, setCreatedApiKey] =
    useState<APIKeyCreateResponse | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);
  const queryClient = useQueryClient();
  const t = useTranslations('settings.apiKeysPage');
  const locale = useLocale();

  // Fetch API keys
  const {
    data: apiKeysResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list(),
  });

  const apiKeys = apiKeysResponse?.data || [];

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: (request: APIKeyCreateRequest) => apiKeysApi.create(request),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setCreatedApiKey(response.data);
        setShowCreatedKey(true);
        setIsCreateDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['api-keys'] });
        toast.success(t('toastCreated'));
        // Reset form
        setNewKeyData({ title: '', description: '', expiresInDays: 'never' });
      } else {
        toast.error(response.error?.message || t('toastCreateFailed'));
      }
    },
    onError: (error) => {
      toast.error(t('toastCreateFailed'));
      console.error('Error creating API key:', error);
    },
  });

  // Revoke API key mutation
  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => apiKeysApi.revoke(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success(t('toastRevoked'));
    },
    onError: (error) => {
      toast.error(t('toastRevokeFailed'));
      console.error('Error revoking API key:', error);
    },
  });

  // Delete API key mutation
  const deleteMutation = useMutation({
    mutationFn: (keyId: string) => apiKeysApi.delete(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete API key');
      console.error('Error deleting API key:', error);
    },
  });

  const handleCreateAPIKey = () => {
    const request: APIKeyCreateRequest = {
      title: newKeyData.title.trim(),
      description: newKeyData.description.trim() || undefined,
      expires_in_days:
        newKeyData.expiresInDays && newKeyData.expiresInDays !== 'never'
          ? parseInt(newKeyData.expiresInDays)
          : undefined,
    };

    createMutation.mutate(request);
  };

  const handleCopyKey = async (key: string, keyType: string = 'key') => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success(t('toastCopied', { type: keyType }));
    } catch (error) {
      toast.error(t('toastCopyFailed', { type: keyType }));
    }
  };

  const handleCopyFullKey = async (publicKey: string, secretKey: string) => {
    try {
      const fullKey = `${publicKey}:${secretKey}`;
      await navigator.clipboard.writeText(fullKey);
      toast.success(t('toastFullCopied'));
    } catch (error) {
      toast.error(t('toastFullCopyFailed'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            {t('statusActive')}
          </Badge>
        );
      case 'revoked':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            {t('statusRevoked')}
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            {t('statusExpired')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isKeyExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };


  return (
    <div className="container mx-auto max-w-6xl px-3 sm:px-6 py-4 sm:py-6">
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-medium">{t('pageTitle')}</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('pageSubtitle')}
          </p>
        </div>

        {/* SDK Beta Notice */}
        <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/10 dark:border-blue-800/30">
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/10 border border-blue-500/20 flex-shrink-0">
                <DobbyLogo size={18} variant="symbol" className="sm:[width:22px] sm:[height:22px] [filter:invert(37%)_sepia(93%)_saturate(1352%)_hue-rotate(207deg)_brightness(97%)_contrast(95%)] dark:[filter:invert(68%)_sepia(44%)_saturate(913%)_hue-rotate(186deg)_brightness(101%)_contrast(96%)]" />
              </div>
              <div className="flex-1 space-y-2 sm:space-y-3">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-blue-900 dark:text-blue-100 mb-1 flex items-center gap-2">
                    {t('apiHeading')}
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                      {t('betaBadge')}
                    </Badge>
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                    {t('betaDescription')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href="https://api.kortix.com/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    <span>{t('viewDocs')}</span>
                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span className="leading-relaxed">
              {t('securityNote')}
            </span>
          </div>

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t('newKeyButton')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('createDialogTitle')}</DialogTitle>
                <DialogDescription>
                  {t('createDialogDescription')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="title" className="m-1">
                    {t('titleLabel')}
                  </Label>
                  <Input
                    id="title"
                    placeholder={t('titlePlaceholder')}
                    value={newKeyData.title}
                    onChange={(e) =>
                      setNewKeyData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="m-1">
                    {t('descriptionLabel')}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder={t('descriptionPlaceholder')}
                    value={newKeyData.description}
                    onChange={(e) =>
                      setNewKeyData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="expires" className="m-1">
                    {t('expiresLabel')}
                  </Label>
                  <Select
                    value={newKeyData.expiresInDays}
                    onValueChange={(value) =>
                      setNewKeyData((prev) => ({
                        ...prev,
                        expiresInDays: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('expiresNever')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">{t('expiresNever')}</SelectItem>
                      <SelectItem value="7">{t('expires7')}</SelectItem>
                      <SelectItem value="30">{t('expires30')}</SelectItem>
                      <SelectItem value="90">{t('expires90')}</SelectItem>
                      <SelectItem value="365">{t('expires365')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreateAPIKey}
                  disabled={
                    !newKeyData.title.trim() || createMutation.isPending
                  }
                >
                  {createMutation.isPending ? t('creating') : t('createSubmit')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* API Keys List */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                {t('loadError')}
              </p>
            </CardContent>
          </Card>
        ) : apiKeys.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('emptyTitle')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('emptyDescription')}
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('createSubmit')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {apiKeys.map((apiKey: APIKeyResponse) => (
              <Card
                key={apiKey.key_id}
                className={
                  isKeyExpired(apiKey.expires_at) ? 'border-yellow-200' : ''
                }
              >
                <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate">{apiKey.title}</CardTitle>
                      {apiKey.description && (
                        <CardDescription className="mt-0.5 sm:mt-1 text-xs sm:text-sm line-clamp-2">
                          {apiKey.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getStatusBadge(apiKey.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="text-muted-foreground mb-0.5 sm:mb-1">{t('createdLabel')}</p>
                        <p className="font-medium truncate">
                          {formatDate(apiKey.created_at)}
                        </p>
                      </div>
                      {apiKey.expires_at && (
                        <div>
                          <p className="text-muted-foreground mb-0.5 sm:mb-1">{t('expiresMeta')}</p>
                          <p
                            className={`font-medium truncate ${isKeyExpired(apiKey.expires_at) ? 'text-yellow-600' : ''}`}
                          >
                            {formatDate(apiKey.expires_at)}
                          </p>
                        </div>
                      )}
                      {apiKey.last_used_at && (
                        <div className="col-span-2 sm:col-span-1">
                          <p className="text-muted-foreground mb-0.5 sm:mb-1">
                            {t('lastUsed')}
                          </p>
                          <p className="font-medium truncate">
                            {formatDate(apiKey.last_used_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {apiKey.status === 'active' && (
                    <div className="flex gap-2 mt-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('revoke')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('revokeDialogTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('revokeDialogDescription', {
                                title: apiKey.title,
                              })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                revokeMutation.mutate(apiKey.key_id)
                              }
                              className="bg-destructive hover:bg-destructive/90 text-white"
                            >
                              {t('revokeConfirm')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}

                  {(apiKey.status === 'revoked' ||
                    apiKey.status === 'expired') && (
                      <div className="flex gap-2 mt-4">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('delete')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('deleteDialogTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('deleteDialogDescription', {
                                  title: apiKey.title,
                                })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  deleteMutation.mutate(apiKey.key_id)
                                }
                                className="bg-destructive hover:bg-destructive/90 text-white"
                              >
                                {t('deleteConfirm')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Show Created API Key Dialog */}
        <Dialog open={showCreatedKey} onOpenChange={setShowCreatedKey}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                {t('createdDialogTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('createdDialogDescription')}
              </DialogDescription>
            </DialogHeader>

            {createdApiKey && (
              <div className="space-y-4">
                <div>
                  <Label className="m-1">{t('apiKeyLabel')}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${createdApiKey.public_key}:${createdApiKey.secret_key}`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleCopyFullKey(
                          createdApiKey.public_key,
                          createdApiKey.secret_key,
                        )
                      }
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      {t('importantStore')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setShowCreatedKey(false)}>{t('close')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
