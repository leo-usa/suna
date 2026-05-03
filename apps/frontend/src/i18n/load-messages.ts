import type { Locale } from './config';

import de from '../../translations/de.json';
import en from '../../translations/en.json';
import es from '../../translations/es.json';
import fr from '../../translations/fr.json';
import it from '../../translations/it.json';
import ja from '../../translations/ja.json';
import pt from '../../translations/pt.json';
import zh from '../../translations/zh.json';

/**
 * Static imports so bundlers resolve every locale at compile time.
 * Dynamic `import(\`.../${locale}.json\`)` breaks Turbopack HMR with errors like
 * "Expected module to match pattern: .../zh.json".
 *
 * Locale files intentionally diverge slightly; they are typed as English shape for next-intl.
 */
const messagesByLocale = {
  en,
  de,
  it,
  zh,
  ja,
  pt,
  fr,
  es,
} as unknown as Record<Locale, typeof en>;

export function loadMessages(locale: Locale): typeof en {
  return messagesByLocale[locale] ?? en;
}
