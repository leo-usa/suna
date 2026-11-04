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
  /** Bring the desktop window back after computer-use hid it. */
  restoreUi?: () => Promise<{ ok: boolean }>;
};

declare global {
  interface Window {
    dobbyLocal?: DobbyLocalAPI;
  }
}

export {};
