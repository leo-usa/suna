"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { createClient } from "@/lib/supabase/client";
import { Table, TableRow, TableBody, TableCell } from "../ui/table";
import { Badge } from "../ui/badge";
import CreateTeamInvitationButton from "./create-team-invitation-button";
import { formatDistanceToNow } from "date-fns";
import DeleteTeamInvitationButton from "./delete-team-invitation-button";
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
    accountId: string;
};

export default function ManageTeamInvitations({ accountId }: Props) {
    const { t } = useTranslation();
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchInvitations() {
            setLoading(true);
            const supabaseClient = createClient();
            const { data } = await supabaseClient.rpc('get_account_invitations', {
                account_id: accountId
            });
            setInvitations(data || []);
            setLoading(false);
        }
        fetchInvitations();
    }, [accountId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between">
                    <div>
                        <CardTitle>{t('teamInvitations.pending', 'Pending Invitations')}</CardTitle>
                        <CardDescription>
                            {t('teamInvitations.pendingDescription', 'These are the pending invitations for your team')}
                        </CardDescription>
                    </div>
                    <CreateTeamInvitationButton accountId={accountId} />
                </div>
            </CardHeader>
            {Boolean(invitations.length) && (
                <CardContent>
                    <Table>
                        <TableBody>
                            {invitations.map((invitation: any) => (
                                <TableRow key={invitation.invitation_id}>
                                    <TableCell>
                                        <div className="flex gap-x-2">
                                            {formatDistanceToNow(invitation.created_at, { addSuffix: true })}
                                            <Badge variant={invitation.invitation_type === '24_hour' ? 'default' : 'outline'}>
                                                {invitation.invitation_type === '24_hour' ? t('teamInvitations.type.24hour', '24 Hour') : t('teamInvitations.type.oneTime', 'One time use')}
                                            </Badge>
                                            <Badge variant={invitation.account_role === 'owner' ? 'default' : 'outline'}>
                                                {invitation.account_role === 'owner' ? t('teamInvitations.role.owner', 'Owner') : t('teamInvitations.role.member', 'Member')}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DeleteTeamInvitationButton invitationId={invitation.invitation_id} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            )}
        </Card>
    );
}
