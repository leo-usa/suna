import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'REST API reference',
  description:
    'How to call the Dobby API at dobby.now: authentication, JSON requests, and examples.',
};

const PUBLIC_SITE = 'https://dobby.now';

/** Public docs always show production URLs so local `.env` does not rewrite examples to localhost. */
const API_V1 = `${PUBLIC_SITE}/v1`;

export default function ApiDocsPage() {
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
      <Button variant="ghost" className="mb-4 -ml-2 h-auto px-2 py-2 text-muted-foreground hover:text-foreground" asChild>
        <Link href="/help" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back to Help Center
        </Link>
      </Button>

      <header className="space-y-2 sm:space-y-3 mb-8 sm:mb-10">
        <div className="flex flex-wrap items-center gap-3">
          <Terminal className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" aria-hidden />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight text-foreground">
            Using the Dobby API
          </h1>
        </div>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          The production web app lives at{' '}
          <a
            href={PUBLIC_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            {PUBLIC_SITE}
          </a>
          . Call the HTTP API like other REST services (for example OpenAI): HTTPS, a stable base URL,
          an authentication header on each request, and JSON responses. Paths below use the{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground">/v1</code>{' '}
          prefix.
        </p>
      </header>

      <div className="space-y-10">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Base URL for requests</h2>
          <p className="text-muted-foreground leading-relaxed">
            Use production integrations against:
          </p>
          <code className="block w-fit rounded-lg bg-muted px-3 py-2 text-sm font-mono text-foreground">
            {v1Base}
          </code>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Same idea as OpenAI’s{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">https://api.openai.com/v1</code>
            : append paths such as{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/threads</code> or{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/threads/…/messages</code>.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Developing locally with Docker or uvicorn? Point requests at your machine’s{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/v1</code> URL (often{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              http://localhost:8000/v1
            </code>
            ). The snippets here stay on{' '}
            <span className="font-medium text-foreground">{PUBLIC_SITE}</span> so copied examples match
            production.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Authentication</h2>
          <p className="text-muted-foreground leading-relaxed">
            Send <strong className="text-foreground font-medium">exactly one</strong> of these on each
            request:
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left p-3 font-medium text-foreground">Use case</th>
                  <th className="text-left p-3 font-medium text-foreground">Header</th>
                  <th className="text-left p-3 font-medium text-foreground">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-3 text-muted-foreground">Scripts, servers, integrations</td>
                  <td className="p-3 font-mono text-sm text-foreground">X-API-Key</td>
                  <td className="p-3 text-muted-foreground">
                    <code className="font-mono text-sm text-foreground">pk_…:sk_…</code> — one string:
                    public key, colon, secret key.
                  </td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">Signed-in session</td>
                  <td className="p-3 font-mono text-sm text-foreground">Authorization</td>
                  <td className="p-3 text-muted-foreground">
                    <code className="font-mono text-sm text-foreground">Bearer &lt;access_token&gt;</code>{' '}
                    — token from signing in to the web app.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sign in at{' '}
            <a
              href={PUBLIC_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              {PUBLIC_SITE}
            </a>
            , then create keys under{' '}
            <Link href="/settings/api-keys" className="text-primary hover:underline font-medium">
              Settings → API keys
            </Link>
            . Store the combined key in a secret such as{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">DOBBY_API_KEY</code>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Request format</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li>
              Use <code className="font-mono text-sm text-foreground">GET</code>,{' '}
              <code className="font-mono text-sm text-foreground">POST</code>,{' '}
              <code className="font-mono text-sm text-foreground">PATCH</code>,{' '}
              <code className="font-mono text-sm text-foreground">PUT</code>, or{' '}
              <code className="font-mono text-sm text-foreground">DELETE</code> as documented for each
              endpoint.
            </li>
            <li>
              JSON bodies: set{' '}
              <code className="font-mono text-sm text-foreground">Content-Type: application/json</code>{' '}
              and send UTF-8 JSON.
            </li>
            <li>
              Some endpoints use form fields instead (for example{' '}
              <code className="font-mono text-sm text-foreground">POST /threads</code> with field{' '}
              <code className="font-mono text-sm text-foreground">name</code>) — use{' '}
              <code className="font-mono text-sm text-foreground">multipart/form-data</code> or{' '}
              <code className="font-mono text-sm text-foreground">-F</code> in curl.
            </li>
            <li>
              Successful responses are usually JSON with HTTP{' '}
              <code className="font-mono text-sm text-foreground">200</code> or{' '}
              <code className="font-mono text-sm text-foreground">201</code>.
            </li>
          </ul>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Examples</h2>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">List threads (GET)</h3>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono text-foreground leading-relaxed border border-border">
              {`curl -sS -H "X-API-Key: pk_your_public_key:sk_your_secret_key" \\
  "${v1Base}/threads"`}
            </pre>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Create a message (POST JSON)</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Fields: <code className="font-mono text-xs text-foreground">type</code>,{' '}
              <code className="font-mono text-xs text-foreground">content</code>, optionally{' '}
              <code className="font-mono text-xs text-foreground">is_llm_message</code> (boolean).
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono text-foreground leading-relaxed border border-border">
              {threadsMessagesExample}
            </pre>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Create a thread (POST form)</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Uses form field <code className="font-mono text-xs text-foreground">name</code>, not JSON.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono text-foreground leading-relaxed border border-border">
              {createThreadFormExample}
            </pre>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">
              JavaScript <code className="font-mono font-normal text-sm">fetch</code> with API key
            </h3>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono text-foreground leading-relaxed border border-border whitespace-pre-wrap">
              {fetchExample}
            </pre>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Errors</h2>
          <p className="text-muted-foreground leading-relaxed">
            Errors return JSON with HTTP 4xx or 5xx. Common shapes:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li>
              <code className="font-mono text-sm text-foreground">{`{ "detail": "…" }`}</code>
            </li>
            <li>
              <code className="font-mono text-sm text-foreground">
                {`{ "detail": { "message": "…", "error_code": "…" } }`}
              </code>{' '}
              for limits or billing-related responses.
            </li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Check the status code before treating the body as success data.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Interactive reference (Swagger)</h2>
          <p className="text-muted-foreground leading-relaxed">
            When available on the API host:
          </p>
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
              (OpenAPI JSON)
            </li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If those URLs do not load, only <code className="font-mono text-xs">/v1</code> routes may be
            public — the examples above still apply.
          </p>
        </section>
      </div>
    </div>
  );
}
