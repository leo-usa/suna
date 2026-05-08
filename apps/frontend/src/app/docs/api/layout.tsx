import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'REST API reference',
  description:
    'How to call the Dobby API at dobby.now: authentication, JSON requests, and examples.',
};

export default function DocsApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
