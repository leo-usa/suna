"use client";

import EditPersonalAccountName from "@/components/basejump/edit-personal-account-name";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function PersonalAccountSettingsPage() {
    const [personalAccount, setPersonalAccount] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAccount() {
            setLoading(true);
            const supabaseClient = createClient();
            const { data } = await supabaseClient.rpc('get_personal_account');
            setPersonalAccount(data);
            setLoading(false);
        }
        fetchAccount();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div>
            <EditPersonalAccountName account={personalAccount} />
        </div>
    );
}