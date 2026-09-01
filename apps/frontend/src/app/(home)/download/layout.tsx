import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Download Dobby for Mac and Windows',
  description:
    'Install the Dobby desktop app to run an AI worker with files and apps on this computer.',
  path: '/download',
});

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
