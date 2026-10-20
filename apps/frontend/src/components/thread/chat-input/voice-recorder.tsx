import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { DobbyLoader } from '@/components/ui/dobby-loader';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranscription } from '@/hooks/transcription/use-transcription';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatRecordingTime, startLiveSpeech } from '@/lib/voice/live-speech';

interface VoiceRecorderProps {
    onTranscription: (text: string) => void;
    onRecordingStart?: () => void;
    onLiveText?: (text: string) => void;
    onRecordingCancel?: () => void;
    onRecordingEnd?: () => void;
    disabled?: boolean;
}

const MAX_RECORDING_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
const IOS_TIMESLICE_MS = 250;

type RecordingFormat = {
    mimeType?: string;
    extension: string;
    blobType: string;
};

export function getSupportedAudioRecordingFormat(): RecordingFormat {
    if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder is not supported in this browser');
    }

    const candidates: RecordingFormat[] = [
        { mimeType: 'audio/webm;codecs=opus', extension: 'webm', blobType: 'audio/webm' },
        { mimeType: 'audio/webm', extension: 'webm', blobType: 'audio/webm' },
        { mimeType: 'audio/mp4', extension: 'mp4', blobType: 'audio/mp4' },
        { mimeType: 'audio/aac', extension: 'm4a', blobType: 'audio/mp4' },
    ];

    for (const candidate of candidates) {
        if (candidate.mimeType && MediaRecorder.isTypeSupported(candidate.mimeType)) {
            return candidate;
        }
    }

    // Safari on iOS: use browser default (typically MP4/AAC)
    return { extension: 'mp4', blobType: 'audio/mp4' };
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = memo(function VoiceRecorder({
    onTranscription,
    onRecordingStart,
    onLiveText,
    onRecordingCancel,
    onRecordingEnd,
    disabled = false,
}) {
    const t = useTranslations('thread.chatInputTooltips');
    const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
    const [elapsedMs, setElapsedMs] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const recordingStartTimeRef = useRef<number | null>(null);
    const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const recordingFormatRef = useRef<RecordingFormat>({ extension: 'webm', blobType: 'audio/webm' });
    const isStartingRef = useRef(false);
    const liveSpeechRef = useRef<{ stop: () => void } | null>(null);
    const onLiveTextRef = useRef(onLiveText);
    const onTranscriptionRef = useRef(onTranscription);
    const onRecordingCancelRef = useRef(onRecordingCancel);
    const onRecordingEndRef = useRef(onRecordingEnd);
    onLiveTextRef.current = onLiveText;
    onTranscriptionRef.current = onTranscription;
    onRecordingCancelRef.current = onRecordingCancel;
    onRecordingEndRef.current = onRecordingEnd;

    const stopLiveSpeech = useCallback(() => {
        liveSpeechRef.current?.stop();
        liveSpeechRef.current = null;
    }, []);

    const transcriptionMutation = useTranscription();

    const cleanupStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const stopRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
            recorder.stop();
        }
    }, []);

    // Auto-stop recording after 15 minutes
    useEffect(() => () => stopLiveSpeech(), [stopLiveSpeech]);

    useEffect(() => {
        if (state === 'recording') {
            recordingStartTimeRef.current = Date.now();
            setElapsedMs(0);
            const tick = setInterval(() => {
                if (recordingStartTimeRef.current) {
                    setElapsedMs(Date.now() - recordingStartTimeRef.current);
                }
            }, 250);
            maxTimeoutRef.current = setTimeout(() => {
                stopRecording();
            }, MAX_RECORDING_TIME);
            return () => {
                clearInterval(tick);
                if (maxTimeoutRef.current) {
                    clearTimeout(maxTimeoutRef.current);
                    maxTimeoutRef.current = null;
                }
            };
        } else {
            recordingStartTimeRef.current = null;
            if (maxTimeoutRef.current) {
                clearTimeout(maxTimeoutRef.current);
                maxTimeoutRef.current = null;
            }
        }

        return () => {
            if (maxTimeoutRef.current) {
                clearTimeout(maxTimeoutRef.current);
            }
        };
    }, [state, stopRecording]);

    const startRecording = async () => {
        if (isStartingRef.current || state !== 'idle') {
            return;
        }

        isStartingRef.current = true;

        try {
            if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                throw new Error('Microphone access is not available in this browser');
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const format = getSupportedAudioRecordingFormat();
            recordingFormatRef.current = format;

            const mediaRecorder = format.mimeType
                ? new MediaRecorder(stream, { mimeType: format.mimeType })
                : new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                stopLiveSpeech();
                if (chunksRef.current.length === 0) {
                    cleanupStream();
                    setState('idle');
                    onRecordingCancelRef.current?.();
                    return;
                }

                setState('processing');
                const { blobType, extension } = recordingFormatRef.current;
                const audioBlob = new Blob(chunksRef.current, { type: blobType });
                const audioFile = new File([audioBlob], `recording.${extension}`, { type: blobType });

                transcriptionMutation.mutate(audioFile, {
                    onSuccess: (data) => {
                        const text = data.text?.trim();
                        if (text) onTranscriptionRef.current(text);
                        else onRecordingEndRef.current?.();
                        setState('idle');
                    },
                    onError: (error) => {
                        console.error('Transcription failed:', error);
                        onRecordingEndRef.current?.();
                        setState('idle');
                    },
                });

                cleanupStream();
            };

            // Timeslice required on iOS Safari so dataavailable events fire
            mediaRecorder.start(IOS_TIMESLICE_MS);
            onRecordingStart?.();
            liveSpeechRef.current = startLiveSpeech((text) => onLiveTextRef.current?.(text));
            setState('recording');
        } catch (error) {
            console.error('Error starting recording:', error);
            cleanupStream();
            mediaRecorderRef.current = null;
            setState('idle');
        } finally {
            isStartingRef.current = false;
        }
    };

    const cancelRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
            chunksRef.current = [];
            recorder.stop();
        }
    };

    const handleClick = () => {
        if (state === 'idle') {
            void startRecording();
        } else if (state === 'recording') {
            stopRecording();
        }
    };

    const handleRightClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (state === 'recording') {
            cancelRecording();
        }
    };

    const getIcon = () => {
        switch (state) {
            case 'recording':
                return <Square className="h-5 w-5" />;
            case 'processing':
                return <DobbyLoader size="small" />;
            default:
                return <Mic className="h-5 w-5" />;
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClick}
                    onContextMenu={handleRightClick}
                    disabled={disabled || state === 'processing'}
                    className={cn(
                        'h-10 px-2 py-2 bg-transparent border-[1.5px] rounded-2xl flex items-center gap-2 transition-colors',
                        state === 'recording'
                            ? 'border-[#BA2E2E] text-[#BA2E2E] hover:bg-[#BA2E2E]/10'
                            : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent/50',
                    )}
                >
                    {state === 'recording' && (
                        <span className="h-2 w-2 rounded-full bg-[#BA2E2E] animate-pulse" />
                    )}
                    {getIcon()}
                    {state === 'recording' && (
                        <span className="text-xs tabular-nums">{formatRecordingTime(elapsedMs)}</span>
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
                <p>
                    {state === 'recording'
                        ? t('clickToStopRecording')
                        : state === 'processing'
                            ? t('processing')
                            : t('recordVoiceMessage')
                    }
                </p>
            </TooltipContent>
        </Tooltip>
    );
});
