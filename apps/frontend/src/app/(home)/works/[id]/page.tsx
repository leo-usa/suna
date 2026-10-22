'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, Download, Heart, Loader2, Share2 } from 'lucide-react';
import { SimpleFooter } from '@/components/home/simple-footer';
import { getWork, likeWork, publicHtmlUrl, workPath, type WorkFile, type WorkPost } from '@/lib/api/works';
import { cn } from '@/lib/utils';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v'];

function extOf(path: string) {
  const idx = path.lastIndexOf('.');
  return idx >= 0 ? path.slice(idx).toLowerCase() : '';
}

function filesOfType(files: WorkFile[], exts: string[]) {
  return files.filter((file) => exts.includes(extOf(file.path)));
}

const TYPE_KEYS = {
  site: 'typeSite',
  slides: 'typeSlides',
  images: 'typeImages',
  video: 'typeVideo',
  sheet: 'typeSheet',
  docs: 'typeDocs',
  mixed: 'typeMixed',
} as const;

function typeLabel(t: ReturnType<typeof useTranslations>, artifactType: string) {
  const key = TYPE_KEYS[artifactType as keyof typeof TYPE_KEYS] ?? 'typeMixed';
  return t(key);
}

function usesHtmlFrame(post: WorkPost) {
  const files = post.files || [];
  const kind = post.artifact_type || 'site';
  if (kind === 'images' && filesOfType(files, IMAGE_EXTS).length > 0) return false;
  if (kind === 'video' && filesOfType(files, VIDEO_EXTS).length > 0) return false;
  if ((kind === 'sheet' || kind === 'docs') && files.length > 0) return false;
  return true;
}

function WorkActions({
  likeCount,
  liked,
  liking,
  copied,
  onLike,
  onShare,
  t,
}: {
  likeCount: number;
  liked: boolean;
  liking: boolean;
  copied: boolean;
  onLike: () => void;
  onShare: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={onLike}
        disabled={liking || liked}
        className={cn(
          'inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-sm',
          liked ? 'bg-muted' : 'hover:bg-muted',
        )}
      >
        <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
        {liked ? t('liked') : t('like')}
        <span className="text-muted-foreground">{likeCount || 0}</span>
      </button>
      <button
        onClick={onShare}
        className={cn(
          'inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-sm hover:bg-muted',
          copied && 'bg-muted',
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {copied ? t('linkCopied') : t('share')}
      </button>
    </div>
  );
}

function HtmlWorkFrame({ src, title }: { src: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const fit = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const top = frame.getBoundingClientRect().top;
      setHeight(Math.max(320, Math.round(window.innerHeight - top - 12)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={title}
      style={{ height: height ?? 'calc(100vh - 8.5rem)' }}
      className="block w-full rounded-xl border border-border bg-background"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      referrerPolicy="no-referrer"
    />
  );
}

function WorkViewer({ post }: { post: WorkPost }) {
  const files = post.files || [];
  const images = filesOfType(files, IMAGE_EXTS);
  const videos = filesOfType(files, VIDEO_EXTS);
  const iframeSrc = publicHtmlUrl(post.id);
  const kind = post.artifact_type || 'site';

  if (kind === 'images' && images.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {images.map((file) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={file.path} src={file.url} alt={file.path} className="w-full rounded-xl border border-border" />
        ))}
      </div>
    );
  }

  if (kind === 'video' && videos.length > 0) {
    return (
      <div className="space-y-6">
        {videos.map((file) => (
          <video key={file.path} src={file.url} controls className="w-full rounded-xl border border-border bg-black" />
        ))}
      </div>
    );
  }

  if ((kind === 'sheet' || kind === 'docs') && files.length > 0) {
    const pdfs = files.filter((file) => extOf(file.path) === '.pdf');
    return (
      <div className="space-y-6">
        {pdfs.map((file) => (
          <iframe
            key={file.path}
            src={file.url}
            title={file.path}
            className="w-full h-[70vh] rounded-xl border border-border bg-background"
          />
        ))}
        <div className="space-y-2">
          {files.map((file) => (
            <a
              key={file.path}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              {file.path}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return <HtmlWorkFrame src={iframeSrc} title={post.title} />;
}

export default function WorkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = decodeURIComponent(String(params?.id || ''));
  const t = useTranslations('works');
  const [post, setPost] = useState<WorkPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    setLoading(true);
    getWork(postId)
      .then((data) => {
        if (cancelled) return;
        setPost(data);
        if (data.slug && data.slug !== postId) {
          router.replace(workPath(data));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('notFound'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, t]);

  const created = useMemo(() => {
    if (!post?.created_at) return '';
    try {
      return new Date(post.created_at).toLocaleDateString();
    } catch {
      return '';
    }
  }, [post?.created_at]);

  const handleLike = async () => {
    if (!post || liking || liked) return;
    setLiking(true);
    try {
      const count = await likeWork(post.id);
      setPost({ ...post, like_count: count });
      setLiked(true);
    } catch {
      // Auth required; ignore here
    } finally {
      setLiking(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const url = window.location.href;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: post.title, url });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const actions = post ? (
    <WorkActions
      likeCount={post.like_count}
      liked={liked}
      liking={liking}
      copied={copied}
      onLike={handleLike}
      onShare={handleShare}
      t={t}
    />
  ) : null;

  if (post && usesHtmlFrame(post)) {
    return (
      <main className="bg-background">
        <div className="flex flex-col px-2 pb-3 sm:px-3">
          <div className="flex shrink-0 items-center gap-3 px-1 py-2">
            <Link
              href="/works"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('backToWorks')}</span>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">{post.title}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {t('publishedBy', { name: post.user_name || '—' })}
              </p>
            </div>
            {actions}
          </div>
          <WorkViewer post={post} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-28 md:pt-32 pb-16">
        <Link
          href="/works"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToWorks')}
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error || !post ? (
          <p className="text-center text-muted-foreground py-24">{error || t('notFound')}</p>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                    {typeLabel(t, post.artifact_type)}
                  </span>
                  {created && <span className="text-xs text-muted-foreground">{created}</span>}
                </div>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{post.title}</h1>
                {post.description && (
                  <p className="mt-3 text-muted-foreground leading-relaxed">{post.description}</p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('publishedBy', { name: post.user_name || '—' })}
                </p>
              </div>
              {actions}
            </div>
            <WorkViewer post={post} />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">{t('enjoyedThis')}</p>
              {actions}
            </div>
          </div>
        )}
      </div>
      <SimpleFooter />
    </main>
  );
}
