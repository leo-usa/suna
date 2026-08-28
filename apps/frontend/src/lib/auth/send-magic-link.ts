'use client';

import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl, isElectron } from '@/lib/utils/is-electron';

export async function sendMagicLink(options: {
  email: string;
  returnUrl?: string;
  termsAccepted?: boolean;
  referralCode?: string;
}) {
  const email = options.email.trim().toLowerCase();
  const supabase = createClient();
  const emailRedirectTo = isElectron()
    ? getAuthCallbackUrl(undefined, options.termsAccepted)
    : getAuthCallbackUrl(options.returnUrl || '/dashboard', options.termsAccepted);

  const redirectTo = email
    ? `${emailRedirectTo}${emailRedirectTo.includes('?') ? '&' : '?'}email=${encodeURIComponent(email)}`
    : emailRedirectTo;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
      data: options.referralCode
        ? { referral_code: options.referralCode.trim().toUpperCase() }
        : undefined,
    },
  });

  if (error) {
    throw error;
  }
}
