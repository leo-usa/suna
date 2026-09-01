/** Public origin Google should index. Apex is the live host (www 301s here). */
export const CANONICAL_ORIGIN = 'https://dobby.now';

function originFrom(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return CANONICAL_ORIGIN;
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (url.hostname === 'www.dobby.now' || url.hostname === 'dobby.now') {
      return CANONICAL_ORIGIN;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return CANONICAL_ORIGIN;
  }
}

/** Absolute site origin for metadata. Production always uses the apex host. */
export function getSiteUrl(): string {
  return originFrom(process.env.NEXT_PUBLIC_APP_URL || CANONICAL_ORIGIN);
}

export function pageUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
