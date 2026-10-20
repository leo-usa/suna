export function formatRecordingTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: { transcript?: string };
  }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function recognitionLanguage(): string {
  const lang = (typeof document !== 'undefined' && document.documentElement.lang) || navigator.language || 'en-US';
  const lower = lang.toLowerCase();
  if (lower === 'zh' || lower.startsWith('zh-cn') || lower.startsWith('zh-hans')) return 'zh-CN';
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-hant')) return 'zh-TW';
  return lang;
}

/** Browser speech draft. Returns null when this browser cannot do live text. */
export function startLiveSpeech(onText: (text: string) => void): { stop: () => void } | null {
  const Ctor = speechRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = recognitionLanguage();

  let finals = '';
  let stopped = false;

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const piece = result?.[0]?.transcript || '';
      if (result?.isFinal) finals += piece;
      else interim += piece;
    }
    const text = `${finals}${interim}`.trim();
    if (text) onText(text);
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      stopped = true;
    }
  };

  recognition.onend = () => {
    if (stopped) return;
    try {
      recognition.start();
    } catch {
      stopped = true;
    }
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}
