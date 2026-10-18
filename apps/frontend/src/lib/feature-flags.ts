function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export const featureFlags = {
  /**
   * When true, hide any mobile app download / install advertising across the web app.
   *
   * Default: false (shown)
   * Set NEXT_PUBLIC_DISABLE_MOBILE_ADVERTISING=true to hide.
   */
  disableMobileAdvertising: parseEnvBoolean(
    process.env.NEXT_PUBLIC_DISABLE_MOBILE_ADVERTISING,
    false,
  ),
  /**
   * QQ bot linking. Off by default: QQ only allows 4 replies per 55 minutes.
   * Set NEXT_PUBLIC_QQ_BOT_ENABLED=true together with backend QQ_BOT_ENABLED.
   */
  qqBotEnabled: parseEnvBoolean(process.env.NEXT_PUBLIC_QQ_BOT_ENABLED, false),
} as const;

// Helpful during development/debugging; kept out of production logs.
if (process.env.NODE_ENV !== 'production') {
  console.log('[featureFlags]', featureFlags);
}

