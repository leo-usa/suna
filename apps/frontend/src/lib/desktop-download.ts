export type DesktopPlatform = 'windows' | 'mac';

export const DESKTOP_DOWNLOAD_LINKS = {
  windows:
    'https://tsdrmlnyclxwkryqrjic.supabase.co/storage/v1/object/public/Desktop%20App/Dobby%20Setup%202.0.2.exe',
  /** Apple Silicon (M1/M2/M3) */
  macArm:
    'https://tsdrmlnyclxwkryqrjic.supabase.co/storage/v1/object/public/Desktop%20App/Dobby-2.0.2-arm64.dmg',
  /** Intel Mac DMG — hidden when unset */
  macIntel:
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_MAC_INTEL) || '',
} as const;

export function detectDesktopPlatform(): DesktopPlatform {
  if (typeof window === 'undefined') return 'mac';

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform?.toLowerCase() || '';

  if (platform.includes('win') || userAgent.includes('windows')) {
    return 'windows';
  }

  return 'mac';
}

export function getPrimaryDesktopDownloadUrl(platform: DesktopPlatform): string {
  return platform === 'windows'
    ? DESKTOP_DOWNLOAD_LINKS.windows
    : DESKTOP_DOWNLOAD_LINKS.macArm;
}
