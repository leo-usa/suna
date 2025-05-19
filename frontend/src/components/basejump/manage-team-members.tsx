"use client";

import { createClient } from "@/lib/supabase/client";
import { Table, TableRow, TableBody, TableCell } from "../ui/table";
import { Badge } from "../ui/badge";
import TeamMemberOptions from "./team-member-options";
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
    accountId: string;
};

export default function ManageTeamMembers({ accountId }: Props) {
    const { t } = useTranslation();
    const [members, setMembers] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMembers() {
            setLoading(true);
            const supabaseClient = createClient();
            const { data: membersData } = await supabaseClient.rpc('get_account_members', {
                account_id: accountId
            });
            const { data: userData } = await supabaseClient.auth.getUser();
            setMembers(membersData || []);
            setUser(userData?.user || null);
            setLoading(false);
        }
        fetchMembers();
    }, [accountId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const isPrimaryOwner = members?.find((member: any) => member.user_id === user?.id)?.is_primary_owner;

    return (
        <div>
            <Table>
                <TableBody>
                    {members.map((member: any) => (
                        <TableRow key={member.user_id} className="hover:bg-hover-bg border-subtle dark:border-white/10">
                            <TableCell>
                                <div className="flex items-center gap-x-2">
                                    <span className="font-medium text-card-title">{member.name}</span>
                                    <Badge 
                                        variant={member.account_role === 'owner' ? 'default' : 'outline'} 
                                        className={member.account_role === 'owner' ? 'bg-primary hover:bg-primary/90' : 'text-foreground/70 border-subtle dark:border-white/10'}
                                    >
                                        {member.is_primary_owner ? t('teamMembers.primaryOwner', 'Primary Owner') : (member.account_role === 'owner' ? t('teamMembers.role.owner', 'Owner') : t('teamMembers.role.member', 'Member'))}
                                    </Badge>
                                </div>
                            </TableCell>
                            <TableCell>
                                <span className="text-sm text-foreground/70">{member.email}</span>
                            </TableCell>
                            <TableCell className="text-right">
                                {!Boolean(member.is_primary_owner) && <TeamMemberOptions teamMember={member} accountId={accountId} isPrimaryOwner={isPrimaryOwner} />}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
