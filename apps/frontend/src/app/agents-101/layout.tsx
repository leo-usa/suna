import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Workers 101',
  description: 'An introduction to AI workers. Learn what they are, how they work, and how to build them.',
  path: '/agents-101',
});

export default function Agents101Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
