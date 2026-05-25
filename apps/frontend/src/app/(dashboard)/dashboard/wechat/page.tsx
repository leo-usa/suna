'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { BackgroundAALChecker } from '@/components/auth/background-aal-checker';
import { useAccounts } from '@/hooks/account';
import { backendApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type LinkStatus = {
  account_id: string;
  connected: boolean;
  status?: string | null;
  connected_at?: string | null;
};

type ConnectStartResponse = {
  session_id: string;
  qrcode_url: string;
  expires_at: string;
  status: string;
};

type ConnectStatusResponse = {
  session_id: string;
  status: string;
  connected: boolean;
};

function qrImageUrl(content: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(content)}`;
}

export default function WeChatIlinkDashboardPage() {
  const t = useTranslations('wechatIlinkPage');
  const queryClient = useQueryClient();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const [accountId, setAccountId] = useState<string>('');
  const [connectSession, setConnectSession] = useState<ConnectStartResponse | null>(null);
  const [connectStatus, setConnectStatus] = useState<string>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const multipleAccounts = Boolean(accounts && accounts.length > 1);

  useEffect(() => {
    if (accounts?.length && !accountId) {
      setAccountId(accounts[0].account_id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    setConnectSession(null);
    setConnectStatus('idle');
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [accountId]);

  const linkQuery = useQuery({
    queryKey: ['wechat-ilink-link-status', accountId],
    queryFn: async () => {
      const res = await backendApi.get<LinkStatus>(
        `/integrations/wechat-ilink/link-status?account_id=${encodeURIComponent(accountId)}`,
        { showErrors: false },
      );
      if (!res.success || !res.data) {
        throw new Error('link-status');
      }
      return res.data;
    },
    enabled: Boolean(accountId),
  });

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollConnectStatus = useCallback(
    async (sessionId: string) => {
      const res = await backendApi.get<ConnectStatusResponse>(
        `/integrations/wechat-ilink/connect/status?account_id=${encodeURIComponent(accountId)}&session_id=${encodeURIComponent(sessionId)}`,
        { showErrors: false },
      );
      if (!res.success || !res.data) return;
      setConnectStatus(res.data.status);
      if (res.data.connected) {
        stopPolling();
        setConnectSession(null);
        queryClient.invalidateQueries({ queryKey: ['wechat-ilink-link-status', accountId] });
      } else if (res.data.status === 'expired') {
        stopPolling();
      }
    },
    [accountId, queryClient, stopPolling],
  );

  const connectStartMutation = useMutation({
    mutationFn: async () => {
      const res = await backendApi.post<ConnectStartResponse>('/integrations/wechat-ilink/connect/start', {
        account_id: accountId,
      });
      if (!res.success || !res.data) {
        throw new Error('connect-start');
      }
      return res.data;
    },
    onSuccess: (data) => {
      setConnectSession(data);
      setConnectStatus(data.status);
      stopPolling();
      pollRef.current = setInterval(() => {
        pollConnectStatus(data.session_id);
      }, 2000);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await backendApi.delete<{ ok: boolean }>(
        `/integrations/wechat-ilink/connect?account_id=${encodeURIComponent(accountId)}`,
      );
      if (!res.success) {
        throw new Error('disconnect');
      }
    },
    onSuccess: () => {
      setConnectSession(null);
      setConnectStatus('idle');
      stopPolling();
      queryClient.invalidateQueries({ queryKey: ['wechat-ilink-link-status', accountId] });
    },
  });

  useEffect(() => () => stopPolling(), [stopPolling]);

  const accountOptions = useMemo(
    () =>
      (accounts || []).map((a) => ({
        id: a.account_id,
        label: a.name,
      })),
    [accounts],
  );

  const isConnected = Boolean(linkQuery.data?.connected);
  const showQr = connectSession && !isConnected && connectStatus !== 'expired';

  return (
    <BackgroundAALChecker>
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-lg bg-primary/10 p-2">
            <MessageCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
              <Badge variant="secondary">{t('betaBadge')}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{t('subtitle')}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('instructionsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>{t('step1')}</p>
            <p>{t('step2')}</p>
            <p>{t('step3')}</p>
            <p>{t('step4')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {multipleAccounts ? t('accountPickerTitle') : t('connectSectionTitle')}
            </CardTitle>
            <CardDescription>
              {multipleAccounts ? t('accountPickerHint') : t('connectSectionHint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {accountsLoading ? (
              <p className="text-sm text-muted-foreground">…</p>
            ) : !accounts?.length ? (
              <p className="text-sm text-muted-foreground">{t('noAccounts')}</p>
            ) : (
              <>
                {multipleAccounts && (
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('accountPickerTitle')} />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!multipleAccounts && accounts[0] && (
                  <p className="text-sm text-muted-foreground">
                    {t('singleAccountInUse', { name: accounts[0].name })}
                  </p>
                )}
              </>
            )}

            {linkQuery.isError && (
              <p className="text-sm text-destructive">{t('loadError')}</p>
            )}

            {linkQuery.data && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('connectionStatus')}:</span>
                {isConnected ? (
                  <Badge variant="default">{t('statusConnected')}</Badge>
                ) : linkQuery.data.status === 'expired' ? (
                  <Badge variant="destructive">{t('statusExpired')}</Badge>
                ) : (
                  <Badge variant="outline">{t('statusDisconnected')}</Badge>
                )}
                {linkQuery.data.connected_at && isConnected && (
                  <span className="text-muted-foreground text-xs">
                    {new Date(linkQuery.data.connected_at).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {showQr && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3 flex flex-col items-center">
                <img
                  src={qrImageUrl(connectSession.qrcode_url)}
                  alt={t('qrAlt')}
                  width={240}
                  height={240}
                  className="rounded-md bg-white p-2"
                />
                <p className="text-sm text-center text-muted-foreground">
                  {connectStatus === 'scanned' ? t('qrScanned') : t('qrWaiting')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('expiresLabel')}: {new Date(connectSession.expires_at).toLocaleString()}
                </p>
              </div>
            )}

            {connectStatus === 'expired' && !isConnected && (
              <p className="text-sm text-destructive">{t('qrExpired')}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {!isConnected && (
                <Button
                  type="button"
                  onClick={() => connectStartMutation.mutate()}
                  disabled={!accountId || connectStartMutation.isPending || Boolean(showQr && connectStatus !== 'expired')}
                >
                  {connectStartMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('connecting')}
                    </>
                  ) : showQr ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t('refreshQr')}
                    </>
                  ) : (
                    t('connectWeChat')
                  )}
                </Button>
              )}
              {(isConnected || linkQuery.data?.status === 'expired') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={!accountId || disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? t('disconnecting') : t('disconnect')}
                </Button>
              )}
              {isConnected && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => connectStartMutation.mutate()}
                  disabled={connectStartMutation.isPending}
                >
                  {t('reconnect')}
                </Button>
              )}
            </div>

            {connectStartMutation.isError && (
              <p className="text-sm text-destructive">{t('connectError')}</p>
            )}
            {disconnectMutation.isError && (
              <p className="text-sm text-destructive">{t('disconnectError')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </BackgroundAALChecker>
  );
}
