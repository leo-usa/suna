import { getDictionary } from '@/app/[locale]/getDictionary';
import TeamBillingClient from './TeamBillingClient';
import { createClient } from "@/lib/supabase/server";

const returnUrl = process.env.NEXT_PUBLIC_URL as string;

type AccountParams = { accountSlug: string; locale: string };

export default async function TeamBillingPage({ params }: { params: AccountParams }) {
  const { accountSlug, locale } = params;
  const dict = await getDictionary(locale);
  const supabaseClient = await createClient();
  const { data: teamAccount } = await supabaseClient.rpc('get_account_by_slug', { slug: accountSlug });

  return (
    <TeamBillingClient
      teamAccount={teamAccount}
      dict={dict}
      returnUrl={`${returnUrl}/${accountSlug}/settings/billing`}
    />
  );
}