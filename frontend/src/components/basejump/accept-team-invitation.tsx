"use client";

import { acceptInvitation } from "@/lib/actions/invitations";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "../ui/alert";
import { Card, CardContent } from "../ui/card";
import { SubmitButton } from "../ui/submit-button";
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
    token: string;
};

export default function AcceptTeamInvitation({ token }: Props) {
    const { t } = useTranslation();
    const [invitation, setInvitation] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchInvitation() {
            setLoading(true);
            const supabaseClient = createClient();
            const { data } = await supabaseClient.rpc('lookup_invitation', {
                lookup_invitation_token: token
            });
            setInvitation(data);
            setLoading(false);
        }
        fetchInvitation();
    }, [token]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card>
            <CardContent className="p-8 text-center flex flex-col gap-y-8">
                <div>
                    <p>{t('invitation.invitedToJoin', "You've been invited to join")}</p>
                    <h1 className="text-xl font-bold">{invitation.account_name}</h1>
                </div>
                {Boolean(invitation.active) ? (
                    <form>
                        <input type="hidden" name="token" value={token} />
                        <SubmitButton formAction={acceptInvitation} pendingText={t('invitation.accepting', 'Accepting invitation...')}>
                            {t('invitation.accept', 'Accept invitation')}
                        </SubmitButton>
                    </form>
                ) : (
                    <Alert variant="destructive">
                        {t('invitation.deactivated', 'This invitation has been deactivated. Please contact the account owner for a new invitation.')}
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}