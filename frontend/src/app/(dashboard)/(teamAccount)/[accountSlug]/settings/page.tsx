'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EditTeamName from "@/components/basejump/edit-team-name";
import EditTeamSlug from "@/components/basejump/edit-team-slug";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {createClient} from "@/lib/supabase/server";
import { useTranslation } from 'react-i18next';

type AccountParams = {
  accountSlug: string;
};

export default function TeamSettingsPage({ params }: { params: Promise<AccountParams> }) {
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
                setError("Failed to load account data");
                setLoading(false);
                console.error(err);
            }
        }
        
        loadData();
    }, [accountSlug]);
    
    if (loading) {
        return <div>{t('teamSettings.loading', 'Loading...')}</div>;
    }
    
    if (!teamAccount) {
        return <div>{t('teamSettings.accountNotFound', 'Account not found')}</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-card-title">{t('teamSettings.title', 'Team Settings')}</h3>
                <p className="text-sm text-foreground/70">
                    {t('teamSettings.manageDetails', 'Manage your team account details.')}
                </p>
            </div>
            
            <Card className="border-subtle dark:border-white/10 bg-white dark:bg-background-secondary shadow-none">
                <CardHeader>
                    <CardTitle className="text-base text-card-title">{t('teamSettings.teamName', 'Team Name')}</CardTitle>
                    <CardDescription>
                        {t('teamSettings.updateTeamName', 'Update your team name.')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <EditTeamName account={teamAccount} />
                </CardContent>
            </Card>
            
            <Card className="border-subtle dark:border-white/10 bg-white dark:bg-background-secondary shadow-none">
                <CardHeader>
                    <CardTitle className="text-base text-card-title">{t('teamSettings.teamUrl', 'Team URL')}</CardTitle>
                    <CardDescription>
                        {t('teamSettings.updateTeamUrl', 'Update your team URL slug.')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <EditTeamSlug account={teamAccount} />
                </CardContent>
            </Card>
        </div>
    )
}