'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMasterAssistant } from '@/hooks/master-assistant/use-master-assistant';
import { useHoldToTalk } from './use-hold-to-talk';
import { formatRecordingTime } from '@/lib/voice/live-speech';
import { saveMasterVoicePrompt } from './voice-prompt';

const DOBBY_RED = '#BA2E2E';

export function MasterAvatarOrb({
  size = 56,
  thinking = false,
  listening = false,
  className,
}: {
  size?: number;
  thinking?: boolean;
  listening?: boolean;
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, '');
  const headId = `ma-head-${uid}`;
  const earId = `ma-ear-${uid}`;
  const earWiggle = listening
    ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const, times: [0, 0.15, 0.6, 1] }
    : thinking
      ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' as const }
      : { duration: 4, repeat: Infinity, ease: 'easeInOut' as const, times: [0, 0.75, 0.82, 0.9, 1] };
  const leftEar = listening
    ? { rotate: [0, 60, 54, 60] }
    : thinking
      ? { rotate: [0, -10, 0] }
      : { rotate: [0, 0, -12, 4, 0] };
  const rightEar = listening
    ? { rotate: [0, -60, -54, -60] }
    : thinking
      ? { rotate: [0, 10, 0] }
      : { rotate: [0, 0, 12, -4, 0] };

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      {(thinking || listening) && (
        <motion.span
          className="absolute inset-[12%] rounded-full"
          style={{ backgroundColor: `${DOBBY_RED}55` }}
          animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="relative overflow-visible drop-shadow-[0_6px_10px_rgba(120,20,20,0.35)]"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <defs>
          <radialGradient id={headId} cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#E86060" />
            <stop offset="45%" stopColor={DOBBY_RED} />
            <stop offset="100%" stopColor="#701515" />
          </radialGradient>
          <linearGradient id={earId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C93A3A" />
            <stop offset="100%" stopColor="#8A1C1C" />
          </linearGradient>
        </defs>

        <motion.g style={{ originX: 1, originY: 0.45 }} animate={leftEar} transition={earWiggle}>
          <path d="M30 42 C 19 37, 9 46, 3 66 C 11 58, 21 57, 30 58 Z" fill={`url(#${earId})`} />
          <path d="M28 46 C 21 44, 14 50, 10 59 C 15 55, 21 54, 28 55 Z" fill="#F08A8A" opacity="0.45" />
        </motion.g>
        <motion.g style={{ originX: 0, originY: 0.45 }} animate={rightEar} transition={earWiggle}>
          <path d="M70 42 C 81 37, 91 46, 97 66 C 89 58, 79 57, 70 58 Z" fill={`url(#${earId})`} />
          <path d="M72 46 C 79 44, 86 50, 90 59 C 85 55, 79 54, 72 55 Z" fill="#F08A8A" opacity="0.45" />
        </motion.g>

        <ellipse cx="50" cy="52" rx="24" ry="27" fill={`url(#${headId})`} />
        <ellipse cx="41" cy="36" rx="7" ry="4" fill="white" opacity="0.3" />

        {[42, 58].map((cx) => (
          <motion.ellipse
            key={cx}
            cx={cx}
            cy="52"
            rx="3.4"
            ry="4.8"
            fill="white"
            style={{ originY: 0.5 }}
            animate={
              listening
                ? { scale: 1.18, scaleY: 1, y: 0 }
                : thinking
                  ? { scale: 1, scaleY: 1, y: [0, -1.5, 0, 1.5, 0] }
                  : { scale: 1, y: 0, scaleY: [1, 1, 0.1, 1, 1] }
            }
            transition={
              listening
                ? { duration: 0.2 }
                : thinking
                  ? { duration: 1.2, repeat: Infinity }
                  : { duration: 4, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }
            }
          />
        ))}
        <path d="M45 63 Q 50 67 55 63" stroke="white" strokeOpacity="0.85" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </motion.svg>
    </div>
  );
}

/** Homepage visitor who is not signed in: same face, click opens sign-in, no recording. */
export function MasterAvatarGuest({ onSignIn }: { onSignIn: () => void }) {
  const t = useTranslations('masterAssistant');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSignIn}
          className="mb-4 flex flex-col items-center gap-1.5 rounded-2xl p-1 transition-transform hover:scale-105 focus:outline-none"
          aria-label={t('name')}
        >
          <MasterAvatarOrb size={56} />
          <span className="text-xs font-medium text-muted-foreground">{t('name')}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{t('guestHint')}</TooltipContent>
    </Tooltip>
  );
}

const HOLD_DELAY_MS = 220;

export function MasterAvatar() {
  const t = useTranslations('masterAssistant');
  const router = useRouter();
  const { data, isError } = useMasterAssistant();
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingRef = React.useRef(false);

  const { state: voiceState, start, stop, liveText, elapsedMs } = useHoldToTalk((text) => {
    if (!data?.path) return;
    saveMasterVoicePrompt(data.thread_id, text);
    router.push(data.path);
  });

  const openMaster = () => {
    if (data?.path) router.push(data.path);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !data?.path) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    holdingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      holdingRef.current = true;
      void start();
    }, HOLD_DELAY_MS);
  };

  const handlePointerUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      openMaster();
      return;
    }
    if (holdingRef.current) {
      holdingRef.current = false;
      stop();
    }
  };

  const handlePointerCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdingRef.current) {
      holdingRef.current = false;
      stop();
    }
  };

  if (isError) return null;

  const listening = voiceState === 'listening';
  const bubble =
    voiceState === 'listening'
      ? t('listening')
      : voiceState === 'transcribing'
        ? t('transcribing')
        : voiceState === 'empty'
          ? t('didNotHear')
          : voiceState === 'error'
            ? t('micError')
            : null;

  return (
    <div className="relative mb-4">
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={voiceState}
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute bottom-full left-1/2 mb-1 w-max max-w-[240px] -translate-x-1/2 rounded-2xl border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm"
          >
            <span className="inline-flex items-center gap-1.5">
              {listening && <Mic className="h-3 w-3 shrink-0 animate-pulse text-[#BA2E2E]" />}
              {listening && <span className="shrink-0 tabular-nums text-[#BA2E2E]">{formatRecordingTime(elapsedMs)}</span>}
              {voiceState === 'transcribing' && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
              <span className="line-clamp-3 text-left">{listening && liveText ? liveText : bubble}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <Tooltip open={bubble ? false : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClick={(e) => {
              if (e.detail === 0) openMaster();
            }}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!data?.path || voiceState === 'transcribing'}
            className={cn(
              'flex select-none touch-none flex-col items-center gap-1.5 rounded-2xl p-1 transition-transform focus:outline-none disabled:opacity-60 [-webkit-touch-callout:none]',
              listening ? 'scale-110' : 'hover:scale-105',
            )}
            aria-label={t('name')}
          >
            <MasterAvatarOrb
              size={56}
              thinking={Boolean(data?.running) || voiceState === 'transcribing'}
              listening={listening}
            />
            <span className="text-xs font-medium text-muted-foreground">{t('name')}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('avatarHint')}</TooltipContent>
      </Tooltip>
    </div>
  );
}
