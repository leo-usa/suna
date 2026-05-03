'use client';

import Image from 'next/image';
import Link from 'next/link';
import { SimpleFooter } from '@/components/home/simple-footer';
import { useScroll, useMotionValueEvent } from 'framer-motion';
import { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';

type ParagraphItem =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; linkText: string; linkHref: string };

const getParagraphText = (p: ParagraphItem): string =>
  p.kind === 'text' ? p.text : p.text + p.linkText;

function computeParagraphPositions(paragraphs: ParagraphItem[]) {
  const totalChars = paragraphs.reduce((sum, p) => sum + getParagraphText(p).length, 0);
  if (totalChars === 0) return paragraphs.map(() => ({ start: 0, end: 0 }));
  return paragraphs.reduce<{ start: number; end: number }[]>((acc, paragraph, index) => {
    const prevEnd = index === 0 ? 0 : acc[index - 1].end;
    const proportion = getParagraphText(paragraph).length / totalChars;
    acc.push({
      start: prevEnd,
      end: prevEnd + proportion,
    });
    return acc;
  }, []);
}

function TypewriterParagraph({
  paragraph,
  position,
  progress,
  isLocked,
}: {
  paragraph: ParagraphItem;
  position: { start: number; end: number };
  progress: number;
  isLocked: boolean;
}) {
  const { start, end } = position;
  const isLinkedParagraph = paragraph.kind === 'link';
  const fullText = getParagraphText(paragraph);
  const characters = fullText.split('');

  const linkStartIndex = isLinkedParagraph ? paragraph.text.length : -1;

  const renderCharacters = (chars: string[], startIdx: number) =>
    chars.map((char, i) => {
      const charIndex = startIdx + i;
      const charProgress = charIndex / characters.length;
      const charStart = start + (end - start) * charProgress;
      const charEnd = start + (end - start) * ((charIndex + 1) / characters.length);

      return (
        <CharReveal
          key={charIndex}
          char={char}
          progress={progress}
          charStart={charStart}
          charEnd={charEnd}
          isLocked={isLocked}
        />
      );
    });

  return (
    <div className="relative">
      <p className="opacity-[0.12] select-none" aria-hidden="true">
        {isLinkedParagraph ? (
          <>
            {paragraph.text}
            <span className="opacity-50">{paragraph.linkText}</span>
          </>
        ) : (
          fullText
        )}
      </p>
      <p className="absolute inset-0">
        {isLinkedParagraph ? (
          <>
            {renderCharacters(paragraph.text.split(''), 0)}
            <Link
              href={paragraph.linkHref}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              {renderCharacters(paragraph.linkText.split(''), linkStartIndex)}
            </Link>
          </>
        ) : (
          renderCharacters(characters, 0)
        )}
      </p>
    </div>
  );
}

function CharReveal({
  char,
  progress,
  charStart,
  charEnd,
  isLocked,
}: {
  char: string;
  progress: number;
  charStart: number;
  charEnd: number;
  isLocked: boolean;
}) {
  if (isLocked) {
    return <span>{char}</span>;
  }

  let opacity = 0;
  if (progress >= charEnd) {
    opacity = 1;
  } else if (progress > charStart) {
    opacity = (progress - charStart) / (charEnd - charStart);
  }

  return (
    <span style={{ opacity }} className="transition-opacity duration-75">
      {char}
    </span>
  );
}

export default function AboutPage() {
  const t = useTranslations('aboutPage');
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const isLockedRef = useRef(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const paragraphs = useMemo<ParagraphItem[]>(
    () => [
      { kind: 'text', text: t('paragraphs.p0') },
      { kind: 'text', text: t('paragraphs.p1') },
      { kind: 'text', text: t('paragraphs.p2') },
      { kind: 'text', text: t('paragraphs.p3') },
      { kind: 'text', text: t('paragraphs.p4') },
      { kind: 'text', text: t('paragraphs.p5') },
      { kind: 'text', text: t('paragraphs.p6') },
      { kind: 'text', text: t('paragraphs.p7') },
      {
        kind: 'link',
        text: t('paragraphs.hiringLead'),
        linkText: t('paragraphs.hiringLink'),
        linkHref: '/careers',
      },
    ],
    [t],
  );

  const paragraphPositions = useMemo(
    () => computeParagraphPositions(paragraphs),
    [paragraphs],
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.3', 'end 0.5'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (isMobile) return;

    if (isLockedRef.current) return;

    setCurrentProgress(latest);

    if (latest >= 0.95) {
      isLockedRef.current = true;
      setIsLocked(true);
      setCurrentProgress(1);
    }
  });

  useEffect(() => {
    if (!isMobile || !mainRef.current || !containerRef.current) return;

    const main = mainRef.current;
    const container = containerRef.current;

    const handleScroll = () => {
      if (isLockedRef.current) return;

      const mainScrollTop = main.scrollTop;
      const mainClientHeight = main.clientHeight;
      const containerTop = container.offsetTop;
      const containerHeight = container.offsetHeight;

      const startOffset = mainClientHeight * 0.3;
      const endOffset = mainClientHeight * 0.5;

      const containerStart = containerTop - startOffset;
      const containerEnd = containerTop + containerHeight - endOffset;
      const scrollRange = containerEnd - containerStart;

      let progress = 0;
      if (mainScrollTop >= containerStart) {
        progress = Math.min(1, (mainScrollTop - containerStart) / scrollRange);
      }

      setCurrentProgress(progress);

      if (progress >= 0.95) {
        isLockedRef.current = true;
        setIsLocked(true);
        setCurrentProgress(1);
      }
    };

    main.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      main.removeEventListener('scroll', handleScroll);
    };
  }, [isMobile]);

  return (
    <main ref={mainRef} className="min-h-screen bg-background">
      <article className="max-w-4xl mx-auto px-6 md:px-10 pt-24 md:pt-28 pb-32">
        <div
          ref={containerRef}
          className="text-foreground text-[1.375rem] md:text-[1.5rem] leading-[1.6] tracking-[-0.025em] font-medium space-y-7"
        >
          {paragraphs.map((paragraph, index) => (
            <TypewriterParagraph
              key={index}
              paragraph={paragraph}
              position={paragraphPositions[index]!}
              progress={currentProgress}
              isLocked={isLocked}
            />
          ))}
        </div>

        <div className="mt-24 md:mt-32">
          <div className="md:hidden border border-foreground/10 rounded-sm p-6">
            <div className="text-center mb-6">
              <span className="text-xs uppercase tracking-[0.3em] text-foreground/40 font-medium">
                {t('visasLabel')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 place-items-center">
              <div className="rotate-[-8deg] opacity-70 [filter:grayscale(100%)] dark:invert">
                <Image
                  src="/images/stamps/bg.svg"
                  alt={t('stamps.belgrade')}
                  width={120}
                  height={78}
                  className="w-[120px]"
                />
              </div>
              <div className="rotate-[12deg] opacity-70 [filter:grayscale(100%)] dark:invert">
                <Image
                  src="/images/stamps/lisbon.svg"
                  alt={t('stamps.lisbon')}
                  width={110}
                  height={71}
                  className="w-[110px]"
                />
              </div>
              <div className="rotate-[-5deg] opacity-70 [filter:grayscale(100%)] dark:invert">
                <Image
                  src="/images/stamps/nyc.svg"
                  alt={t('stamps.nyc')}
                  width={130}
                  height={84}
                  className="w-[130px]"
                />
              </div>
              <div className="rotate-[6deg] opacity-70 [filter:grayscale(100%)] dark:invert">
                <Image
                  src="/images/stamps/sf.svg"
                  alt={t('stamps.sanFrancisco')}
                  width={115}
                  height={75}
                  className="w-[115px]"
                />
              </div>
              <div className="rotate-[8deg] opacity-70 [filter:grayscale(100%)] dark:invert">
                <Image
                  src="/images/stamps/london.svg"
                  alt={t('stamps.london')}
                  width={115}
                  height={75}
                  className="w-[115px]"
                />
              </div>
              <div className="rotate-[-10deg] opacity-70 [filter:grayscale(100%)] dark:invert">
                <Image
                  src="/images/stamps/malaga.svg"
                  alt={t('stamps.malaga')}
                  width={130}
                  height={84}
                  className="w-[130px]"
                />
              </div>
              <div className="rotate-[10deg] opacity-70 [filter:grayscale(100%)] dark:invert">
                <Image
                  src="/images/stamps/bali.svg"
                  alt={t('stamps.bali')}
                  width={100}
                  height={100}
                  className="w-[100px]"
                />
              </div>
            </div>

            <div className="text-center mt-6">
              <Image
                src="/dobby-symbol.svg"
                alt={t('stamps.dobbyLogo')}
                width={16}
                height={13}
                className="inline-block opacity-20 dark:invert"
              />
            </div>
          </div>

          <div className="hidden md:grid grid-cols-2 border border-foreground/10 rounded-sm">
            <div className="relative border-r border-foreground/10 p-6 flex flex-col aspect-[3/4]">
              <div className="text-center mb-4">
                <span className="text-xs uppercase tracking-[0.3em] text-foreground/40 font-medium">
                  {t('visasLabel')}
                </span>
              </div>

              <div className="relative flex-1">
                <div className="absolute left-[5%] top-[2%] rotate-[-12deg] opacity-60 hover:opacity-90 transition-all duration-300 [filter:grayscale(100%)] dark:[filter:grayscale(100%)_invert(1)] hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(320deg)_saturate(300%)_brightness(0.9)] dark:hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(320deg)_saturate(300%)_brightness(1.1)_invert(1)]">
                  <Image
                    src="/images/stamps/bg.svg"
                    alt={t('stamps.belgrade')}
                    width={160}
                    height={104}
                    className="w-[160px]"
                  />
                </div>
                <div className="absolute right-[0%] top-[0%] rotate-[15deg] opacity-65 hover:opacity-95 transition-all duration-300 [filter:grayscale(100%)] dark:[filter:grayscale(100%)_invert(1)] hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(90deg)_saturate(400%)_brightness(0.85)] dark:hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(90deg)_saturate(400%)_brightness(1.1)_invert(1)]">
                  <Image
                    src="/images/stamps/lisbon.svg"
                    alt={t('stamps.lisbon')}
                    width={145}
                    height={94}
                    className="w-[145px]"
                  />
                </div>
                <div className="absolute left-[0%] bottom-[25%] rotate-[-7deg] opacity-70 hover:opacity-100 transition-all duration-300 z-10 [filter:grayscale(100%)] dark:[filter:grayscale(100%)_invert(1)] hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(130deg)_saturate(500%)_brightness(0.85)] dark:hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(130deg)_saturate(500%)_brightness(1.1)_invert(1)]">
                  <Image
                    src="/images/stamps/nyc.svg"
                    alt={t('stamps.nyc')}
                    width={175}
                    height={114}
                    className="w-[175px]"
                  />
                </div>
                <div className="absolute right-[0%] bottom-[0%] rotate-[8deg] opacity-65 hover:opacity-95 transition-all duration-300 [filter:grayscale(100%)] dark:[filter:grayscale(100%)_invert(1)] hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(180deg)_saturate(400%)_brightness(0.9)] dark:hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(180deg)_saturate(400%)_brightness(1.1)_invert(1)]">
                  <Image
                    src="/images/stamps/sf.svg"
                    alt={t('stamps.sanFrancisco')}
                    width={150}
                    height={97}
                    className="w-[150px]"
                  />
                </div>
              </div>

              <div className="text-center mt-4">
                <Image
                  src="/dobby-symbol.svg"
                  alt={t('stamps.dobbyLogo')}
                  width={16}
                  height={13}
                  className="inline-block opacity-20 dark:invert"
                />
              </div>
            </div>

            <div className="relative p-6 flex flex-col aspect-[3/4]">
              <div className="text-center mb-4">
                <span className="text-xs uppercase tracking-[0.3em] text-foreground/40 font-medium">
                  {t('visasLabel')}
                </span>
              </div>

              <div className="relative flex-1">
                <div className="absolute left-[0%] top-[0%] rotate-[11deg] opacity-60 hover:opacity-90 transition-all duration-300 [filter:grayscale(100%)] dark:[filter:grayscale(100%)_invert(1)] hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(330deg)_saturate(350%)_brightness(0.9)] dark:hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(330deg)_saturate(350%)_brightness(1.1)_invert(1)]">
                  <Image
                    src="/images/stamps/london.svg"
                    alt={t('stamps.london')}
                    width={150}
                    height={97}
                    className="w-[150px]"
                  />
                </div>
                <div className="absolute right-[-5%] top-[12%] rotate-[-14deg] opacity-65 hover:opacity-95 transition-all duration-300 [filter:grayscale(100%)] dark:[filter:grayscale(100%)_invert(1)] hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(350deg)_saturate(400%)_brightness(0.95)] dark:hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(350deg)_saturate(400%)_brightness(1.1)_invert(1)]">
                  <Image
                    src="/images/stamps/malaga.svg"
                    alt={t('stamps.malaga')}
                    width={170}
                    height={110}
                    className="w-[170px]"
                  />
                </div>
                <div className="absolute left-[15%] bottom-[8%] rotate-[13deg] opacity-60 hover:opacity-90 transition-all duration-300 [filter:grayscale(100%)] dark:[filter:grayscale(100%)_invert(1)] hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(30deg)_saturate(350%)_brightness(0.95)] dark:hover:[filter:grayscale(0%)_sepia(100%)_hue-rotate(30deg)_saturate(350%)_brightness(1.1)_invert(1)]">
                  <Image
                    src="/images/stamps/bali.svg"
                    alt={t('stamps.bali')}
                    width={130}
                    height={130}
                    className="w-[130px]"
                  />
                </div>
              </div>

              <div className="text-center mt-4">
                <Image
                  src="/dobby-symbol.svg"
                  alt={t('stamps.dobbyLogo')}
                  width={16}
                  height={13}
                  className="inline-block opacity-20 dark:invert"
                />
              </div>
            </div>
          </div>
        </div>
      </article>

      <SimpleFooter />
    </main>
  );
}
