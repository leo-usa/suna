'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupportedAudioRecordingFormat } from '@/components/thread/chat-input/voice-recorder';
import { transcribeAudio } from '@/lib/api/transcription';
import { startLiveSpeech } from '@/lib/voice/live-speech';

export type HoldToTalkState = 'idle' | 'listening' | 'transcribing' | 'empty' | 'error';

const MAX_HOLD_MS = 2 * 60 * 1000;
const TIMESLICE_MS = 250;
const MIN_RECORDING_MS = 400;

/** Press-and-hold voice capture: `start()` on press, `stop()` on release; resolves text via `onText`. */
export function useHoldToTalk(onText: (text: string) => void) {
  const [state, setState] = useState<HoldToTalkState>('idle');
  const [liveText, setLiveText] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const liveSpeechRef = useRef<{ stop: () => void } | null>(null);
  const liveTextRef = useRef('');
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const releasedRef = useRef(false);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stopLiveSpeech = useCallback(() => {
    liveSpeechRef.current?.stop();
    liveSpeechRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
    stopLiveSpeech();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, [stopLiveSpeech]);

  const flash = useCallback((next: HoldToTalkState) => {
    setState(next);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setState('idle'), 2200);
  }, []);

  const stop = useCallback(() => {
    releasedRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    releasedRef.current = false;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('microphone unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (releasedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const format = getSupportedAudioRecordingFormat();
      const recorder = format.mimeType ? new MediaRecorder(stream, { mimeType: format.mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const tooShort = Date.now() - startedAtRef.current < MIN_RECORDING_MS;
        const chunks = chunksRef.current;
        const draft = liveTextRef.current.trim();
        cleanup();
        if (tooShort || chunks.length === 0) {
          setLiveText('');
          liveTextRef.current = '';
          flash('empty');
          return;
        }
        setState('transcribing');
        try {
          const file = new File([new Blob(chunks, { type: format.blobType })], `recording.${format.extension}`, {
            type: format.blobType,
          });
          const { text } = await transcribeAudio(file);
          const finalText = text?.trim() || draft;
          setLiveText('');
          liveTextRef.current = '';
          if (finalText) {
            setState('idle');
            onTextRef.current(finalText);
          } else {
            flash('empty');
          }
        } catch {
          setLiveText('');
          liveTextRef.current = '';
          if (draft) {
            setState('idle');
            onTextRef.current(draft);
          } else {
            flash('error');
          }
        }
      };

      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setLiveText('');
      liveTextRef.current = '';
      recorder.start(TIMESLICE_MS);
      liveSpeechRef.current = startLiveSpeech((text) => {
        liveTextRef.current = text;
        setLiveText(text);
      });
      setState('listening');
      maxTimerRef.current = setTimeout(stop, MAX_HOLD_MS);
    } catch {
      cleanup();
      flash('error');
    }
  }, [cleanup, flash, stop]);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state === 'recording') {
        recorder.onstop = null;
        recorder.stop();
      }
      cleanup();
    },
    [cleanup],
  );

  useEffect(() => {
    if (state !== 'listening') return;
    const started = startedAtRef.current || Date.now();
    const tick = setInterval(() => setElapsedMs(Date.now() - started), 250);
    return () => clearInterval(tick);
  }, [state]);

  return { state, start, stop, liveText, elapsedMs };
}
