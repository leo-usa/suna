import { useQuery } from '@tanstack/react-query';
import { getMasterAssistant, getMasterChild } from '@/lib/api/master-assistant';

export const masterAssistantKeys = {
  info: ['master-assistant'] as const,
  child: (threadId: string) => ['master-assistant', 'child', threadId] as const,
};

export function useMasterAssistant(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: masterAssistantKeys.info,
    queryFn: getMasterAssistant,
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useMasterChildStatus(threadId: string | undefined, initialStatus?: string) {
  return useQuery({
    queryKey: masterAssistantKeys.child(threadId || ''),
    queryFn: () => getMasterChild(threadId as string),
    enabled: Boolean(threadId),
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? initialStatus;
      return status === 'running' ? 5000 : false;
    },
    retry: 1,
  });
}
