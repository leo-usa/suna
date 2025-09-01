import { ThemeProvider } from '@/components/home/theme-provider';
import { siteConfig } from '@/lib/site';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';
import ClientI18nSync from '@/components/ClientI18nSync';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: 'black',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description:
    'Dobby is a fully open source AI assistant that helps you accomplish real-world tasks with ease. Through natural conversation, Dobby becomes your digital companion for research, data analysis, and everyday challenges.',
  keywords: [
    'AI',
    'artificial intelligence',
    'browser automation',
    'web scraping',
    'file management',
    'AI assistant',
    'open source',
    'research',
    'data analysis',
  ],
  authors: [{ name: 'Dr.Pang.AI Team', url: 'https://dobby.now' }],
  creator:
    'Dr.Pang.AI Team',
  publisher:
    'Dr.Pang.AI Team',
  category: 'Technology',
  applicationName: 'Dobby',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: 'Dobby - Open Source Generalist AI Agent',
    description:
      'Dobby is a fully open source AI assistant that helps you accomplish real-world tasks with ease through natural conversation.',
    url: siteConfig.url,
    siteName: 'Dobby',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 630,
        alt: 'Dobby - Open Source Generalist AI Agent',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dobby - Open Source Generalist AI Agent',
    description:
      'Dobby is a fully open source AI assistant that helps you accomplish real-world tasks with ease through natural conversation.',
    creator: '@drpangai',
    site: '@drpangai',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 630,
        alt: 'Dobby - Open Source Generalist AI Agent',
      },
    ],
  },
  icons: {
    icon: [{ url: '/favicon.png', sizes: 'any' }],
    shortcut: '/favicon.png',
  },
  // manifest: "/manifest.json",
  alternates: {
    canonical: siteConfig.url,
  },
  // Additional meta tags for better social media sharing
  other: {
    // WeChat specific meta tags for homepage
    'wechat:title': 'Dobby - 通用人工智能助手',
    'wechat:description': 'Dobby是一个通用AI助手，通过自然对话帮助您轻松完成现实世界的任务，包括做研究写报告、数据分析和生成PPT等。',
    'wechat:image': `${siteConfig.url}/banner.png`,
    // WeChat brand display tags
    'wechat:site_name': 'Dobby.now AI 智能体',
    'wechat:site_icon': `${siteConfig.url}/dobby-logo.svg`,
    'wechat:author': 'Dobby.now AI 智能体',
    'wechat:copyright': '© 2025 Dobby.now AI 智能体',
    // Alternative WeChat meta tag variations (for better compatibility)
    'wechat:app_name': 'Dobby.now AI 智能体',
    'wechat:app_id': 'dobby_ai',
    'wechat:channel': 'homepage',
    // Additional meta tags that WeChat might recognize
    'msapplication-TileColor': '#2563eb',
    'msapplication-config': '/browserconfig.xml',
    'apple-mobile-web-app-title': 'Dobby.now AI 智能体',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'mobile-web-app-capable': 'yes',
    'application-name': 'Dobby.now AI 智能体',
    // Additional Open Graph tags for better compatibility
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:type': 'image/png',
    'og:image:alt': 'Dobby - Open Source Generalist AI Agent',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-PCHSN4M2');`}
        </Script>
        <Script async src="https://cdn.tolt.io/tolt.js" data-tolt={process.env.NEXT_PUBLIC_TOLT_REFERRAL_ID}></Script>
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans bg-background`}
      >
        <ClientI18nSync />
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PCHSN4M2"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            {children}
            <Toaster />
          </Providers>
          <Analytics />
          <GoogleAnalytics gaId="G-6ETJFB3PT3" />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
