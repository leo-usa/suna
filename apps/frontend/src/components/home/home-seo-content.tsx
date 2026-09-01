import Link from 'next/link';

const FAQ = [
  {
    q: 'What is Dobby?',
    a: 'Dobby is an AI worker that completes real work — slides, research, documents, video, and more — instead of only chatting. You describe the outcome; Dobby uses tools, files, and the browser to ship it.',
  },
  {
    q: 'Can Dobby run on my computer?',
    a: 'Yes. The Dobby desktop app can work with files and apps on your Mac. Download it from the download page, then start a task with “this computer.”',
  },
  {
    q: 'Does Dobby work in WeChat?',
    a: 'Yes. You can bind WeChat and talk to Dobby there. Alipay and WeChat Pay are available for prepaid credits.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. You can start on the free plan with weekly credits, then upgrade if you need more runs, a dedicated computer, or more custom workers.',
  },
];

export function HomeSeoContent() {
  return (
    <div className="relative z-10 bg-background border-t border-border/40">
      <section className="max-w-3xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
          What Dobby can do
        </h2>
        <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          Most AI tools stop at thinking. Dobby acts. It builds slides and documents,
          runs research, edits data, generates images and video, and follows through
          on multi-step work in the cloud or on this computer.
        </p>
        <ul className="mt-8 grid sm:grid-cols-2 gap-3 text-sm md:text-base text-foreground/80">
          <li>Slides and decks</li>
          <li>Research briefs</li>
          <li>Docs and reports</li>
          <li>Data and charts</li>
          <li>Images and video</li>
          <li>Canvas and sites</li>
        </ul>
      </section>

      <section className="max-w-3xl mx-auto px-6 md:px-10 pb-16 md:pb-24">
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
          Browser, desktop, or WeChat
        </h2>
        <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          Start in the chat above. Install the desktop app to work with local files
          and apps. Or bind WeChat and keep going from your phone.
        </p>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          <Link href="/download" className="text-foreground underline underline-offset-4">
            Download for Mac and Windows
          </Link>
          <Link href="/works" className="text-foreground underline underline-offset-4">
            See published works
          </Link>
          <Link href="/pricing" className="text-foreground underline underline-offset-4">
            Pricing
          </Link>
          <Link href="/cn" className="text-foreground underline underline-offset-4">
            中文介绍
          </Link>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 md:px-10 pb-20 md:pb-28">
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
          Questions
        </h2>
        <dl className="mt-8 space-y-8">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="text-base md:text-lg font-medium text-foreground">{item.q}</dt>
              <dd className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-3">
          <Link href="/about" className="hover:text-foreground">About</Link>
          <Link href="/tutorials" className="hover:text-foreground">Tutorials</Link>
          <Link href="/legal?tab=privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/legal?tab=terms" className="hover:text-foreground">Terms</Link>
          <Link href="/support" className="hover:text-foreground">Support</Link>
        </div>
        <p>© {new Date().getFullYear()} Dobby</p>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
    </div>
  );
}
