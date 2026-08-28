'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { DobbyLogo } from '@/components/sidebar/dobby-logo';
import { useTranslations } from 'next-intl';

const OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }
  return value;
}

function ConfirmContent() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash');
  const typeParam = searchParams.get('type');
  const email = searchParams.get('email') || '';
  const next = safeNext(searchParams.get('next') || searchParams.get('returnUrl'));
  const [pending, setPending] = useState(false);

  const type: EmailOtpType = OTP_TYPES.has(typeParam as EmailOtpType)
    ? (typeParam as EmailOtpType)
    : 'magiclink';

  const onContinue = async () => {
    if (!tokenHash) {
      window.location.href = '/auth';
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (verifyError) {
      const expiredUrl = new URL('/auth', window.location.origin);
      expiredUrl.searchParams.set('expired', 'true');
      if (email) expiredUrl.searchParams.set('email', email);
      expiredUrl.searchParams.set('returnUrl', next);
      window.location.href = expiredUrl.toString();
      return;
    }

    window.location.href = `${next}${next.includes('?') ? '&' : '?'}auth_event=login&auth_method=email`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[420px] flex flex-col items-center gap-6">
        <DobbyLogo size={32} />
        <div className="text-center space-y-2">
          <h1 className="text-[28px] sm:text-[32px] font-normal tracking-tight text-foreground leading-none">
            {t('signInToContinue')}
          </h1>
          <p className="text-[15px] text-foreground/50">
            {t('magicLinkCardTitle')}
          </p>
        </div>
        <Button
          size="lg"
          className="w-full h-12"
          disabled={pending || !tokenHash}
          onClick={() => void onContinue()}
        >
          {pending ? <DobbyLoader size="small" /> : t('signIn')}
        </Button>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <DobbyLoader size="medium" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
