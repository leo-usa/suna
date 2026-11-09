import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import { fetchPublicWork, type WorkFile, type WorkPost } from '@/lib/api/works';
import { siteMetadata } from '@/lib/site-metadata';

export const runtime = 'edge';
export const revalidate = 3600;

const SAFE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const MAX_BYTES = 2 * 1024 * 1024;

const TYPE_LABELS: Record<string, string> = {
  site: 'Site',
  slides: 'Slides',
  images: 'Images',
  video: 'Video',
  sheet: 'Sheet',
  docs: 'Docs',
  mixed: 'Work',
};

function extOf(url: string) {
  const path = url.split('?')[0].toLowerCase();
  const idx = path.lastIndexOf('.');
  return idx >= 0 ? path.slice(idx) : '';
}

function pickShareImage(post: WorkPost): string | null {
  const candidates = [post.thumbnail_path, ...(post.files || []).map((file: WorkFile) => file.url)].filter(
    Boolean,
  ) as string[];
  for (const url of candidates) {
    if (SAFE_EXTS.includes(extOf(url))) return url;
  }
  return null;
}

async function fetchImage(url: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/') || contentType.includes('svg')) return null;
    const body = await response.arrayBuffer();
    if (!body.byteLength || body.byteLength > MAX_BYTES) return null;
    return { body, contentType: contentType.split(';')[0] };
  } catch {
    return null;
  }
}

/** Stable pastel pair from a string — unique per site, not purple-default. */
function paletteFromKey(key: string): { from: string; to: string; accent: string } {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const palettes = [
    { from: '#0f172a', to: '#134e4a', accent: '#5eead4' },
    { from: '#1c1917', to: '#7c2d12', accent: '#fdba74' },
    { from: '#0c1222', to: '#1e3a5f', accent: '#93c5fd' },
    { from: '#14120b', to: '#3f3f16', accent: '#d9f99d' },
    { from: '#1a1025', to: '#4a1942', accent: '#f9a8d4' },
    { from: '#111827', to: '#1e293b', accent: '#a5b4fc' },
    { from: '#0b1324', to: '#0e4d4d', accent: '#67e8f9' },
    { from: '#1a1208', to: '#5c3d1e', accent: '#fcd34d' },
  ];
  return palettes[hash % palettes.length];
}

function coverCard(post: Pick<WorkPost, 'title' | 'description' | 'artifact_type' | 'user_name' | 'id' | 'slug'>) {
  const key = post.slug || post.id || post.title || 'work';
  const { from, to, accent } = paletteFromKey(key);
  const title = (post.title || 'Untitled work').slice(0, 80);
  const typeLabel = TYPE_LABELS[post.artifact_type] || 'Work';
  const byline = post.user_name ? `by ${post.user_name}` : siteMetadata.name;
  const description = (post.description || '').trim().slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: `linear-gradient(145deg, ${from} 0%, ${to} 100%)`,
          color: '#f8fafc',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.05) 0%, transparent 40%)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 999,
              padding: '8px 16px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: `1px solid ${accent}55`,
              color: accent,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 0.4,
            }}
          >
            {typeLabel}
          </div>
          <div style={{ fontSize: 22, color: 'rgba(248,250,252,0.55)' }}>{siteMetadata.name}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 980 }}>
          <div
            style={{
              fontSize: title.length > 42 ? 54 : 64,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1.2,
            }}
          >
            {title}
          </div>
          {description ? (
            <div style={{ fontSize: 26, lineHeight: 1.35, color: 'rgba(248,250,252,0.72)' }}>
              {description}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            color: 'rgba(248,250,252,0.6)',
          }}
        >
          <div>{byline}</div>
          <div style={{ color: accent }}>dobby.now</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = decodeURIComponent(id);
  const post = await fetchPublicWork(postId);

  if (post) {
    const source = pickShareImage(post);
    if (source) {
      const image = await fetchImage(source);
      if (image) {
        return new NextResponse(image.body, {
          status: 200,
          headers: {
            'Content-Type': image.contentType,
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        });
      }
    }
    return coverCard(post);
  }

  return coverCard({
    id: postId,
    title: 'Dobby Work',
    description: siteMetadata.description,
    artifact_type: 'mixed',
    user_name: '',
    slug: postId,
  });
}
