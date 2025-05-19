"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { createClient } from "@/lib/supabase/client";
import { Table, TableRow, TableBody, TableCell } from "../ui/table";
import { Button } from "../ui/button";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function ManageTeams() {
    const { t } = useTranslation();
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTeams() {
            setLoading(true);
            const supabaseClient = createClient();
            const { data } = await supabaseClient.rpc('get_accounts');
            const filtered = data?.filter((team: any) => team.personal_account === false) || [];
            setTeams(filtered);
            setLoading(false);
        }
        fetchTeams();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card className="border-subtle dark:border-white/10 bg-white dark:bg-background-secondary shadow-none rounded-xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-title">{t('teams.yourTeams', 'Your Teams')}</CardTitle>
                <CardDescription className="text-foreground/70">
                    {t('teams.description', 'Teams you belong to or own')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableBody>
                        {teams.map((team) => (
                            <TableRow key={team.account_id} className="hover:bg-hover-bg border-subtle dark:border-white/10">
                                <TableCell>
                                    <div className="flex items-center gap-x-2">
                                        <span className="font-medium text-card-title">{team.name}</span>
                                        <Badge variant={team.account_role === 'owner' ? 'default' : 'outline'} className={team.account_role === 'owner' ? 'bg-primary hover:bg-primary/90' : 'text-foreground/70 border-subtle dark:border-white/10'}>
                                            {team.is_primary_owner ? t('teams.primaryOwner', 'Primary Owner') : team.account_role}
                                        </Badge>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button 
                                        variant="outline" 
                                        asChild 
                                        className="rounded-lg h-9 border-subtle dark:border-white/10 hover:bg-hover-bg dark:hover:bg-hover-bg-dark"
                                    >
                                        <Link href={`/${team.slug}`}>{t('teams.view', 'View')}</Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
