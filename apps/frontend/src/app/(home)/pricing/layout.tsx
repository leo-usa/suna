import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Dobby Pricing — Credits, Plans, and Token Rates',
  description:
    'Free and paid Dobby plans with monthly credits, concurrent runs, custom workers, and model token pricing.',
  path: '/pricing',
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
