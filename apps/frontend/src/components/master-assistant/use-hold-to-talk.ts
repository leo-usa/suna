'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupportedAudioRecordingFormat } from '@/components/thread/chat-input/voice-recorder';
import { transcribeAudio } from '@/lib/api/transcription';

export type HoldToTalkState = 'idle' | 'listening' | 'transcribing' | 'empty' | 'error';

const MAX_HOLD_MS = 2 * 60 * 1000;
const TIMESLICE_MS = 250;
const MIN_RECORDING_MS = 400;

/** Press-and-hold voice capture: `start()` on press, `stop()` on release; resolves text via `onText`. */
export function useHoldToTalk(onText: (text: string) => void) {
  const [state, setState] = useState<HoldToTalkState>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const releasedRef = useRef(false);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const cleanup = useCallback(() => {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

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
        cleanup();
        if (tooShort || chunks.length === 0) {
          flash('empty');
          return;
        }
        setState('transcribing');
        try {
          const file = new File([new Blob(chunks, { type: format.blobType })], `recording.${format.extension}`, {
            type: format.blobType,
          });
          const { text } = await transcribeAudio(file);
          if (text && text.trim()) {
            setState('idle');
            onTextRef.current(text.trim());
          } else {
            flash('empty');
          }
        } catch {
          flash('error');
        }
      };

      startedAtRef.current = Date.now();
      recorder.start(TIMESLICE_MS);
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

  return { state, start, stop };
}
