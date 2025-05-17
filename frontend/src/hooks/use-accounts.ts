import useSWR, {SWRConfiguration} from "swr";
import { createClient } from "@/lib/supabase/client";
import { GetAccountsResponse } from "@usebasejump/shared";
import { useAuth } from "@/components/AuthProvider";

export const useAccounts = (options?: SWRConfiguration) => {
    const { user, isLoading } = useAuth();
    const supabaseClient = createClient();
    return useSWR<GetAccountsResponse>(
        !!supabaseClient && user && !isLoading ? ["accounts"] : null,
        async () => {
            const {data, error} = await supabaseClient.rpc("get_accounts");

            if (error) {
                throw new Error(error.message);
            }

            return data;
        },
        options
    );
};