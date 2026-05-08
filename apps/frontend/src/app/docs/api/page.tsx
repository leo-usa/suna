'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PUBLIC_SITE = 'https://dobby.now';

/** Public docs always show production URLs so local `.env` does not rewrite examples to localhost. */
const API_V1 = `${PUBLIC_SITE}/v1`;

/** Same-origin app URL from env (see `.env.example`) so links like API Settings work locally. */
function publicAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    '';
  return raw.replace(/\/+$/, '');
}

function settingsApiKeysHref(): string {
  const origin = publicAppOrigin();
  return origin ? `${origin}/settings/api-keys` : '/settings/api-keys';
}

export default function ApiDocsPage() {
  const t = useTranslations('docs.apiPage');
  const v1Base = API_V1;
  const swaggerUrl = `${PUBLIC_SITE}/docs`;
  const openapiUrl = `${PUBLIC_SITE}/openapi.json`;

  const threadsMessagesExample = `curl -sS -X POST "${v1Base}/threads/THREAD_ID_HERE/messages" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: pk_your_public_key:sk_your_secret_key" \\
  -d '{
    "type": "user",
    "content": "Hello from my integration.",
    "is_llm_message": true
  }'`;

  const fetchExample = `const apiBase = "${v1Base}";
const apiKey = process.env.DOBBY_API_KEY; // "pk_...:sk_..."

const res = await fetch(\`\${apiBase}/threads\`, {
  method: "GET",
  headers: {
    "X-API-Key": apiKey,
    // Or: "Authorization": \`Bearer \${accessToken}\`
  },
});

const data = await res.json();
if (!res.ok) {
  throw new Error(JSON.stringify(data));
}`;

  const createThreadFormExample = `curl -sS -X POST "${v1Base}/threads" \\
  -H "X-API-Key: pk_your_public_key:sk_your_secret_key" \\
  -F 'name=My new conversation'`;

  return (
    <div className="container mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-8 md:py-12">
      <Button
        variant="ghost"
        className="mb-4 -ml-2 h-auto px-2 py-2 text-muted-foreground hover:text-foreground"
        asChild
      >
        <Link
          href={settingsApiKeysHref()}
          className="inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {t('backToApiSettings')}
        </Link>
      </Button>

      <header className="space-y-2 sm:space-y-3 mb-8 sm:mb-10">
        <div className="flex flex-wrap items-center gap-3">
          <Terminal className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" aria-hidden />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight text-foreground">
            {t('title')}
          </h1>
        </div>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          {t('introBeforeLink')}{' '}
          <a
            href={PUBLIC_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            {PUBLIC_SITE}
          </a>
          {t('introAfterLink')}{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground">/v1</code>{' '}
          {t('introPrefixSuffix')}
        </p>
      </header>

      <div className="space-y-10">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">{t('sectionBaseUrl')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('baseUrlLead')}</p>
          <code className="block w-fit rounded-lg bg-muted px-3 py-2 text-sm font-mono text-foreground">
            {v1Base}
          </code>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('baseUrlComparePart')}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              https://api.openai.com/v1
            </code>
            {t('baseUrlAppendPart')}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/threads</code>{' '}
            {t('baseUrlOr')}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/threads/…/messages</code>.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('baseUrlLocalLead')}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/v1</code>{' '}
            {t('baseUrlLocalMiddle')}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              http://localhost:8000/v1
            </code>
            {t('baseUrlLocalTail')}{' '}
            <span className="font-medium text-foreground">{PUBLIC_SITE}</span>{' '}
            {t('baseUrlLocalClosing')}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">{t('sectionAuth')}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t('authLeadBefore')}{' '}
            <strong className="text-foreground font-medium">{t('authLeadStrong')}</strong>{' '}
            {t('authLeadAfter')}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left p-3 font-medium text-foreground">{t('authTableUseCase')}</th>
                  <th className="text-left p-3 font-medium text-foreground">{t('authTableHeader')}</th>
                  <th className="text-left p-3 font-medium text-foreground">{t('authTableValue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-3 text-muted-foreground">{t('authRowScripts')}</td>
                  <td className="p-3 font-mono text-sm text-foreground">X-API-Key</td>
                  <td className="p-3 text-muted-foreground">
                    <code className="font-mono text-sm text-foreground">pk_…:sk_…</code>{' '}
                    {t('authRowScriptsFormat')}
                  </td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">{t('authRowSession')}</td>
                  <td className="p-3 font-mono text-sm text-foreground">Authorization</td>
                  <td className="p-3 text-muted-foreground">
                    <code className="font-mono text-sm text-foreground">Bearer &lt;access_token&gt;</code>{' '}
                    {t('authRowSessionFormat')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('authFooterBefore')}{' '}
            <a
              href={PUBLIC_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              {PUBLIC_SITE}
            </a>
            {t('authFooterMiddle')}{' '}
            <Link href="/settings/api-keys" className="text-primary hover:underline font-medium">
              {t('settingsApiKeysLink')}
            </Link>
            {t('authFooterAfter')}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">DOBBY_API_KEY</code>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">{t('sectionRequestFormat')}</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li>{t('rqMethods')}</li>
            <li>{t('rqJson')}</li>
            <li>{t('rqForm')}</li>
            <li>{t('rqSuccess')}</li>
          </ul>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">{t('sectionExamples')}</h2>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">{t('exListThreads')}</h3>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono text-foreground leading-relaxed border border-border">
              {`curl -sS -H "X-API-Key: pk_your_public_key:sk_your_secret_key" \\
  "${v1Base}/threads"`}
            </pre>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">{t('exCreateMessage')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('exCreateMessageLead')}</p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono text-foreground leading-relaxed border border-border">
              {threadsMessagesExample}
            </pre>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">{t('exCreateThread')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('exCreateThreadLead')}</p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono text-foreground leading-relaxed border border-border">
              {createThreadFormExample}
            </pre>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">{t('exFetch')}</h3>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono text-foreground leading-relaxed border border-border whitespace-pre-wrap">
              {fetchExample}
            </pre>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">{t('sectionErrors')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('errorsLead')}</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li>
              <code className="font-mono text-sm text-foreground">{`{ "detail": "…" }`}</code>
            </li>
            <li>
              <code className="font-mono text-sm text-foreground">
                {`{ "detail": { "message": "…", "error_code": "…" } }`}
              </code>{' '}
              {t('errorsStructuredHint')}
            </li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">{t('errorsFootnote')}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">{t('sectionSwagger')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('swaggerLead')}</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>
              <a
                href={swaggerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium break-all"
              >
                {swaggerUrl}
              </a>
            </li>
            <li>
              <a
                href={openapiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium break-all"
              >
                {openapiUrl}
              </a>{' '}
              {t('openapiJsonSuffix')}
            </li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">{t('swaggerFootnote')}</p>
        </section>
      </div>
    </div>
  );
}
