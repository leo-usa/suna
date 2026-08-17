import { NextResponse } from 'next/server';
import { fetchPublicWork, type WorkFile, type WorkPost } from '@/lib/api/works';
import { siteMetadata } from '@/lib/site-metadata';

export const revalidate = 3600;

const SAFE_EXTS = ['.png', '.jpg', '.jpeg', '.gif'];
const MAX_BYTES = 2 * 1024 * 1024;

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const post = await fetchPublicWork(decodeURIComponent(id));
  const fallbackUrl = `${siteMetadata.url}/banner.png`;
  const source = (post && pickShareImage(post)) || fallbackUrl;
  const image = (await fetchImage(source)) || (await fetchImage(fallbackUrl));

  if (!image) {
    return new NextResponse('Image not found', { status: 404 });
  }

  return new NextResponse(image.body, {
    status: 200,
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
