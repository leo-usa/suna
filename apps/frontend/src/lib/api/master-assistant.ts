import { backendApi } from '@/lib/api-client';

export interface MasterAssistantInfo {
  thread_id: string;
  project_id: string;
  path: string;
  name: string;
  running: boolean;
}

export interface MasterChildStatus {
  thread_id: string;
  project_id?: string | null;
  title?: string | null;
  execution_target?: string | null;
  model_name?: string | null;
  status: string;
  path: string;
}

export async function getMasterAssistant(): Promise<MasterAssistantInfo> {
  const res = await backendApi.get<MasterAssistantInfo>('/master-assistant', { showErrors: false });
  if (!res.success || !res.data) {
    throw new Error('master-assistant');
  }
  return res.data;
}

export async function getMasterChild(threadId: string): Promise<MasterChildStatus> {
  const res = await backendApi.get<MasterChildStatus>(
    `/master-assistant/children/${encodeURIComponent(threadId)}`,
    { showErrors: false },
  );
  if (!res.success || !res.data) {
    throw new Error('master-child');
  }
  return res.data;
}
