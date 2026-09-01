import { HelpLayoutClient } from '@/components/help/help-layout-client';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Dobby Help',
  description: 'Help center for Dobby credits, billing, and product questions.',
  path: '/help',
});

interface HelpLayoutProps {
  children: React.ReactNode;
}

export default function HelpLayout({
  children,
}: HelpLayoutProps) {
  return <HelpLayoutClient>{children}</HelpLayoutClient>;
}
