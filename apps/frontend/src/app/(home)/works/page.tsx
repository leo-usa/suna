'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Heart, Loader2 } from 'lucide-react';
import { SimpleFooter } from '@/components/home/simple-footer';
import { DobbyLogo } from '@/components/sidebar/dobby-logo';
import { listWorks, workPath, worksLangFromLocale, type WorkPost } from '@/lib/api/works';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

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

function WorkCard({ post, t }: { post: WorkPost; t: ReturnType<typeof useTranslations> }) {
  const thumb = post.thumbnail_path;
  return (
    <Link
      href={workPath(post)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card hover:border-foreground/20 transition-colors"
    >
      <div className="relative aspect-[16/10] bg-muted/40 overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <DobbyLogo size={40} variant="symbol" className="opacity-40" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium">
          {typeLabel(t, post.artifact_type)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-base font-semibold leading-snug line-clamp-2">{post.title}</h2>
        {post.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{post.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span className="truncate">{t('publishedBy', { name: post.user_name || '—' })}</span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <Heart className="h-3 w-3" />
            {post.like_count || 0}
          </span>
        </div>
      </div>
    </Link>
  );
}

function visiblePageItems(current: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | '...')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) items.push('...');
  for (let i = start; i <= end; i++) items.push(i);
  if (end < totalPages - 1) items.push('...');
  items.push(totalPages);
  return items;
}

function WorksPageContent() {
  const t = useTranslations('works');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const lang = useMemo(() => worksLangFromLocale(locale), [locale]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const [posts, setPosts] = useState<WorkPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listWorks({ lang, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        setPosts(data.posts || []);
        setTotal(data.total || 0);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, page, t]);

  const goToPage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), Math.max(1, totalPages));
    const params = new URLSearchParams(searchParams.toString());
    if (clamped <= 1) params.delete('page');
    else params.set('page', String(clamped));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!loading && total > 0 && page > totalPages) {
      goToPage(totalPages);
    }
  }, [loading, page, total, totalPages]);

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-10 pt-28 md:pt-32 pb-12">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground mb-4">
              {t('heading')}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">{t('description')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-16">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-muted-foreground py-24">{error}</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-24">{t('empty')}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <WorkCard key={post.id} post={post} t={t} />
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="flex flex-wrap items-center justify-center gap-1.5 mt-10" aria-label={t('pagination')}>
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className={cn(
                    'inline-flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors',
                    page <= 1 && 'opacity-40 pointer-events-none',
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {tCommon('previous')}
                </button>
                {visiblePageItems(page, totalPages).map((item, index) =>
                  item === '...' ? (
                    <span key={`dots-${index}`} className="px-2 text-sm text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => goToPage(item)}
                      className={cn(
                        'h-9 min-w-9 px-2 rounded-lg text-sm font-medium border transition-colors',
                        item === page
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className={cn(
                    'inline-flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors',
                    page >= totalPages && 'opacity-40 pointer-events-none',
                  )}
                >
                  {tCommon('next')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
      <SimpleFooter />
    </main>
  );
}

export default function WorksPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </main>
      }
    >
      <WorksPageContent />
    </Suspense>
  );
}
