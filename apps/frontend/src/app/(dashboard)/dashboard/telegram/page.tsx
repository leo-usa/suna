'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
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

type LinkStatus = {
  account_id: string;
  linked_peer_count: number;
};

type PairingResponse = {
  code: string;
  expires_at: string;
};

export default function TelegramBotDashboardPage() {
  const t = useTranslations('telegramBotPage');
  const queryClient = useQueryClient();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const [accountId, setAccountId] = useState<string>('');

  const multipleAccounts = Boolean(accounts && accounts.length > 1);

  useEffect(() => {
    if (accounts?.length && !accountId) {
      setAccountId(accounts[0].account_id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    pairingMutation.reset();
  }, [accountId]);

  const linkQuery = useQuery({
    queryKey: ['telegram-bot-link-status', accountId],
    queryFn: async () => {
      const res = await backendApi.get<LinkStatus>(
        `/integrations/telegram-bot/link-status?account_id=${encodeURIComponent(accountId)}`,
        { showErrors: false },
      );
      if (!res.success || !res.data) {
        throw new Error('link-status');
      }
      return res.data;
    },
    enabled: Boolean(accountId),
  });

  const pairingMutation = useMutation({
    mutationFn: async () => {
      const res = await backendApi.post<PairingResponse>(
        '/integrations/telegram-bot/pairing-code',
        { account_id: accountId },
      );
      if (!res.success || !res.data) {
        throw new Error('pairing');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-bot-link-status', accountId] });
    },
  });

  const accountOptions = useMemo(
    () =>
      (accounts || []).map((a) => ({
        id: a.account_id,
        label: a.name,
      })),
    [accounts],
  );

  return (
    <BackgroundAALChecker>
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-lg bg-primary/10 p-2">
            <Send className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
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
              {multipleAccounts ? t('accountPickerTitle') : t('pairingSectionTitle')}
            </CardTitle>
            <CardDescription>
              {multipleAccounts ? t('accountPickerHint') : t('pairingSectionHint')}
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
              <p className="text-sm text-muted-foreground">
                {t('linkedSessions')}: <span className="font-medium text-foreground">{linkQuery.data.linked_peer_count}</span>
              </p>
            )}

            <Button
              type="button"
              onClick={() => pairingMutation.mutate()}
              disabled={!accountId || pairingMutation.isPending}
            >
              {t('generateCode')}
            </Button>
            {pairingMutation.isError && (
              <p className="text-sm text-destructive">{t('codeError')}</p>
            )}
            {pairingMutation.data && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1">
                <p className="text-xs text-muted-foreground">{t('codeLabel')}</p>
                <p className="text-2xl font-mono font-bold tracking-widest">{pairingMutation.data.code}</p>
                <p className="text-xs text-muted-foreground">
                  {t('expiresLabel')}: {new Date(pairingMutation.data.expires_at).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BackgroundAALChecker>
  );
}
