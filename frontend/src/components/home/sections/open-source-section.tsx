import { SectionHeader } from '@/components/home/section-header';
import { siteConfig } from '@/lib/home';
import { Github } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export function OpenSourceSection() {
  const { t } = useTranslation();
  
  return (
    <section
      id="open-source"
      className="flex flex-col items-center justify-center w-full relative pb-18"
    >
      <div className="w-full max-w-6xl mx-auto px-6">
        <SectionHeader>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tighter text-center text-balance pb-1">
            {t('openSource.title', '100% Open Source')}
          </h2>
          <p className="text-muted-foreground text-center text-balance font-medium">
            {t('openSource.subtitle', 'Dobby is fully open source. Join our community and help shape the future of AI.')}
          </p>
        </SectionHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-12">
          <div className="rounded-xl bg-[#F3F4F6] dark:bg-[#F9FAFB]/[0.02] border border-border p-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Github className="h-5 w-5" />
                <span>kortix-ai/suna</span>
              </div>
              <div className="relative">
                <h3 className="text-2xl font-semibold tracking-tight">
                  {t('openSource.mainTitle', 'The Generalist AI Agent')}
                </h3>
                <p className="text-muted-foreground mt-2">
                  {t('openSource.mainDesc', 'Explore, contribute, or fork our repository. Dobby is built with transparency and collaboration at its core.')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary/10 border-secondary/20 text-secondary">
                  TypeScript
                </span>
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary/10 border-secondary/20 text-secondary">
                  Python
                </span>
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary/10 border-secondary/20 text-secondary">
                  {t('openSource.licenseSub', 'Apache 2.0 License')}
                </span>
              </div>
              <Link
                href="https://github.com/Kortix-ai/Suna"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex h-10 items-center justify-center gap-2 text-sm font-medium tracking-wide rounded-full text-primary-foreground dark:text-black px-6 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_3px_-1.5px_rgba(16,24,40,0.06),0_1px_1px_rgba(16,24,40,0.08)] bg-primary dark:bg-white hover:bg-primary/90 dark:hover:bg-white/90 transition-all duration-200 w-fit"
              >
                <span>{t('openSource.viewOnGithub', 'View on GitHub')}</span>
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-white/20 dark:bg-black/10 group-hover:bg-white/30 dark:group-hover:bg-black/20 transition-colors duration-200">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-primary-foreground dark:text-black"
                  >
                    <path
                      d="M7 17L17 7M17 7H8M17 7V16"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </Link>
            </div>
          </div>

          <div className="rounded-xl bg-[#F3F4F6] dark:bg-[#F9FAFB]/[0.02] border border-border p-6">
            <div className="flex flex-col gap-6">
              <h3 className="text-xl md:text-2xl font-medium tracking-tight">
                {t('openSource.transparencyTitle', 'Transparency & Trust')}
              </h3>
              <p className="text-muted-foreground">
                {t('openSource.transparencyDesc', 'We believe AI should be open and accessible to everyone. Our open source approach ensures accountability, innovation, and community collaboration.')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-secondary/10 p-2 mt-0.5">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-secondary"
                    >
                      <path
                        d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium">{t('openSource.transparency', 'Transparency')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('openSource.transparencySub', 'All code is public and auditable.')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-secondary/10 p-2 mt-0.5">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-secondary"
                    >
                      <path
                        d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C23 18.1137 22.6485 17.2628 22.0213 16.6366C21.3941 16.0104 20.5431 15.659 19.65 15.659C18.7569 15.659 17.9059 16.0104 17.2787 16.6366C16.6515 17.2628 16.3 18.1137 16.3 19V21M16.3 11.659C18.7569 11.659 20.7 9.7159 20.7 7.259C20.7 4.8021 18.7569 2.859 16.3 2.859C13.8431 2.859 11.9 4.8021 11.9 7.259C11.9 9.7159 13.8431 11.659 16.3 11.659ZM9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium">{t('openSource.community', 'Community')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('openSource.communitySub', 'Join our growing open source community.')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-secondary/10 p-2 mt-0.5">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-secondary"
                    >
                      <path
                        d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L19.7071 9.70711C19.8946 9.89464 20 10.149 20 10.4142V19C20 20.1046 19.1046 21 18 21H17ZM17 21V10H12V5H7V19H17Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium">{t('openSource.license', 'License')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('openSource.licenseSub', 'Apache 2.0 License for maximum freedom.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
