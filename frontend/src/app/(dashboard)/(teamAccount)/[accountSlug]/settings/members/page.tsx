'use client';

import React from 'react';
import {createClient} from "@/lib/supabase/server";
import ManageTeamMembers from "@/components/basejump/manage-team-members";
import ManageTeamInvitations from "@/components/basejump/manage-team-invitations";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from 'react-i18next';

type AccountParams = {
  accountSlug: string;
};

export default function TeamMembersPage({ params }: { params: Promise<AccountParams> }) {
    const unwrappedParams = React.use(params);
    const { accountSlug } = unwrappedParams;
    
    // Use an effect to load team account data
    const [teamAccount, setTeamAccount] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    
    const { t } = useTranslation();
    
    React.useEffect(() => {
        async function loadData() {
            try {
                const supabaseClient = await createClient();
                const {data} = await supabaseClient.rpc('get_account_by_slug', {
                    slug: accountSlug
                });
                setTeamAccount(data);
                setLoading(false);
            } catch (err) {
                setError("Failed to load team data");
                setLoading(false);
                console.error(err);
            }
        }
        
        loadData();
    }, [accountSlug]);
    
    if (loading) {
        return <div>{t('teamMembers.loading', 'Loading...')}</div>;
    }
    
    if (error) {
        return (
            <Alert variant="destructive" className="border-red-300 dark:border-red-800 rounded-xl">
                <AlertTitle>{t('teamMembers.error', 'Error')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    if (!teamAccount || teamAccount.account_role !== 'owner') {
        return (
            <Alert variant="destructive" className="border-red-300 dark:border-red-800 rounded-xl">
                <AlertTitle>{t('teamMembers.accessDenied', 'Access Denied')}</AlertTitle>
                <AlertDescription>{t('teamMembers.noPermission', 'You do not have permission to access this page.')}</AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-card-title">{t('teamMembers.title', 'Team Members')}</h3>
                <p className="text-sm text-foreground/70">
                    {t('teamMembers.manage', 'Manage your team members and invitations.')}
                </p>
            </div>
            
            <Card className="border-subtle dark:border-white/10 bg-white dark:bg-background-secondary shadow-none">
                <CardHeader>
                    <CardTitle className="text-base text-card-title">{t('teamMembers.invitations', 'Invitations')}</CardTitle>
                    <CardDescription>
                        {t('teamMembers.inviteNew', 'Invite new members to your team.')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ManageTeamInvitations accountId={teamAccount.account_id} />
                </CardContent>
            </Card>
            
            <Card className="border-subtle dark:border-white/10 bg-white dark:bg-background-secondary shadow-none">
                <CardHeader>
                    <CardTitle className="text-base text-card-title">{t('teamMembers.members', 'Members')}</CardTitle>
                    <CardDescription>
                        {t('teamMembers.manageExisting', 'Manage existing team members.')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ManageTeamMembers accountId={teamAccount.account_id} />
                </CardContent>
            </Card>
        </div>
    )
}