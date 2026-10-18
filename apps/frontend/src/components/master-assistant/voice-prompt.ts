const KEY = 'master_voice_prompt';
const MAX_AGE_MS = 2 * 60 * 1000;

export function saveMasterVoicePrompt(threadId: string, text: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ threadId, text, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function peekMasterVoicePrompt(threadId: string): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { threadId?: string; text?: string; at?: number };
    if (!data.at || Date.now() - data.at > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data.threadId === threadId && data.text ? data.text : null;
  } catch {
    return null;
  }
}

export function clearMasterVoicePrompt() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
