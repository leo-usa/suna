import { backendApi } from '../api-client';
import { handleApiError } from '../error-handler';

export type ExecutionTarget = 'cloud' | 'local';

const PREFERRED_TARGET_KEY = 'dobby-run-on-this-computer';

export function getPreferredExecutionTarget(): ExecutionTarget {
  if (typeof window === 'undefined') return 'cloud';
  return window.localStorage.getItem(PREFERRED_TARGET_KEY) === '1' ? 'local' : 'cloud';
}

export function setPreferredExecutionTarget(target: ExecutionTarget) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREFERRED_TARGET_KEY, target === 'local' ? '1' : '0');
}

export async function pairLocalRunner(payload?: { name?: string; platform?: string }) {
  const response = await backendApi.post<{
    device_id: string;
    device_token: string;
    preview_port: number;
  }>('/local-runner/pair', payload || { name: 'This computer', platform: navigator.platform }, { showErrors: false });
  if (response.error || !response.data) {
    throw new Error(response.error?.message || 'Failed to pair this computer');
  }
  return response.data;
}

export async function setProjectExecutionTarget(
  projectId: string,
  target: ExecutionTarget,
  deviceId?: string,
) {
  const response = await backendApi.post<{
    project_id: string;
    execution_target: ExecutionTarget;
    device_id?: string;
    sandbox_id?: string;
    sandbox_url?: string;
  }>(
    `/projects/${projectId}/execution-target`,
    { target, device_id: deviceId },
    { showErrors: false },
  );
  if (response.error || !response.data) {
    handleApiError(response.error, { operation: 'set execution target', resource: 'project' });
    throw new Error(response.error?.message || 'Failed to change where this project runs');
  }
  return response.data;
}

export function localRunnerWsUrl(): string {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  return `${base.replace(/^http/, 'ws')}/local-runner/ws`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backendHasOnlineDevice(): Promise<boolean> {
  const response = await backendApi.get<Array<{ online?: boolean }>>('/local-runner/devices', { showErrors: false });
  return Boolean(response.data?.some((device) => device.online));
}

async function waitUntilOnline(api: NonNullable<Window['dobbyLocal']>, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await api.status();
    if (status.state === 'online') return true;
    await sleep(250);
  }
  return false;
}

async function startRunnerConnection(
  api: NonNullable<Window['dobbyLocal']>,
  payload: { deviceToken?: string; backendWsUrl: string },
): Promise<void> {
  const connected = await api.connect(payload);
  if (!connected?.ok) {
    throw new Error(connected?.error || 'Could not connect this computer');
  }
}

async function connectLocalRunner(timeoutMs: number): Promise<void> {
  if (typeof window === 'undefined' || !window.dobbyLocal) {
    throw new Error('This computer is not connected. Open the Dobby desktop app and try again.');
  }
  const api = window.dobbyLocal;
  const wsUrl = localRunnerWsUrl();
  const status = await api.status();

  if (status.state === 'online' && (await backendHasOnlineDevice())) return;

  if (status.hasToken) {
    await startRunnerConnection(api, { backendWsUrl: wsUrl });
    if (await waitUntilOnline(api, timeoutMs)) return;
  }

  const paired = await pairLocalRunner();
  await startRunnerConnection(api, {
    deviceToken: paired.device_token,
    backendWsUrl: wsUrl,
  });
  if (await waitUntilOnline(api, timeoutMs)) return;
  const failed = await api.status();
  throw new Error(failed.error || 'This computer is not connected. Open the Dobby desktop app and try again.');
}

let readyPromise: Promise<void> | null = null;

export function ensureLocalRunnerReady(timeoutMs = 15000): Promise<void> {
  if (!readyPromise) {
    readyPromise = connectLocalRunner(timeoutMs).finally(() => {
      readyPromise = null;
    });
  }
  return readyPromise;
}

const SAVE_SCREENSHOTS_KEY = 'dobby-save-computer-screenshots';

export function getSaveComputerScreenshots(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SAVE_SCREENSHOTS_KEY) === '1';
}

export function setSaveComputerScreenshots(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SAVE_SCREENSHOTS_KEY, enabled ? '1' : '0');
}

export async function setProjectComputerScreenshots(projectId: string, enabled: boolean) {
  setSaveComputerScreenshots(enabled);
  const response = await backendApi.post<{
    project_id: string;
    save_computer_screenshots: boolean;
  }>(
    `/projects/${projectId}/computer-screenshots`,
    { enabled },
    { showErrors: false },
  );
  if (response.error || !response.data) {
    handleApiError(response.error, { operation: 'set computer screenshots', resource: 'project' });
    throw new Error(response.error?.message || 'Failed to update screenshot saving');
  }
  return response.data;
}
