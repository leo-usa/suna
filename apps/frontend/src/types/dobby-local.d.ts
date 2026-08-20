export type DobbyLocalStatus = {
  state: string;
  deviceId?: string | null;
  previewPort?: number;
  error?: string | null;
  hasToken?: boolean;
};

export type DobbyLocalAPI = {
  connect: (payload?: { deviceToken?: string; backendWsUrl?: string }) => Promise<{ ok: boolean; error?: string }>;
  status: () => Promise<DobbyLocalStatus>;
  stop: () => Promise<{ ok: boolean }>;
  openWorkspace: (projectId?: string) => Promise<string>;
};

declare global {
  interface Window {
    dobbyLocal?: DobbyLocalAPI;
  }
}

export {};
