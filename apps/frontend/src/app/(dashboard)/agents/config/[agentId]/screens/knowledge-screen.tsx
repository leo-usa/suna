'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { KnowledgeBaseManager } from '@/components/knowledge-base/knowledge-base-manager';
import { useAgent } from '@/hooks/agents/use-agents';

interface KnowledgeScreenProps {
    agentId: string;
}

export function KnowledgeScreen({ agentId }: KnowledgeScreenProps) {
    const t = useTranslations('agentConfig.knowledge');
    const { data: agent } = useAgent(agentId);

    return (
        <div className="flex-1 overflow-auto pb-6">
            <div className="px-1 pt-1">
                <KnowledgeBaseManager
                    agentId={agentId}
                    agentName={agent?.name || t('thisWorker')}
                    showHeader={false}
                    showRecentFiles={false}
                    enableAssignments={true}
                />
            </div>
        </div>
    );
}
