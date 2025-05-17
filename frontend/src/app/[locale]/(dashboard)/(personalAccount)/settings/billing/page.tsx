import {createClient} from "@/lib/supabase/server";
import AccountBillingStatus from "@/components/billing/account-billing-status";
import { getDictionary } from '@/app/[locale]/getDictionary';

const returnUrl = process.env.NEXT_PUBLIC_URL as string;

export default async function PersonalAccountBillingPage({ params }: { params: { locale: string } }) {
    const supabaseClient = await createClient();
    const {data: personalAccount} = await supabaseClient.rpc('get_personal_account');
    const dict = await getDictionary(params.locale);

    return (
        <AccountBillingStatus accountId={personalAccount.account_id} returnUrl={`${returnUrl}/settings/billing`} dict={dict} />
    )
}