import { ThemeProvider } from "@/components/home/theme-provider";
import { siteConfig } from "@/lib/site";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getDictionary } from './getDictionary';
import { AuthProvider } from '@/components/AuthProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "black",
};

export async function generateMetadata(props: { params: { locale: string } }): Promise<Metadata> {
  const params = await props.params;
  const dict = await getDictionary(params.locale);
  return {
    title: dict["welcome"] || siteConfig.name,
    description: "Suna is a fully open source AI assistant that helps you accomplish real-world tasks with ease. Through natural conversation, Suna becomes your digital companion for research, data analysis, and everyday challenges.",
    // ... other metadata fields as before ...
  };
}

export default async function LocaleLayout(props: { children: React.ReactNode; params: { locale: string } }) {
  const { children } = props;
  const params = await props.params;
  const dict = await getDictionary(params.locale);
  const t = (key: string) => dict[key] || key;

  return (
    <AuthProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <header>
          {/* <h1>{t('welcome')}</h1> */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            {/* Navigation can use static or server-side translations only */}
            {/* <LanguageSwitcher locale={params.locale} /> */}
          </nav>
        </header>
        {children}
        <Toaster />
        <Analytics />
        <GoogleAnalytics gaId="G-6ETJFB3PT3" />
        <SpeedInsights />
      </ThemeProvider>
    </AuthProvider>
  );
} 