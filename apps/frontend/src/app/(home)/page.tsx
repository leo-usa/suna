import type { Metadata } from 'next';
import { HomeClient } from '@/components/home/home-client';
import { HomeSeoContent } from '@/components/home/home-seo-content';
import { pageMetadata } from '@/lib/seo';
import { siteMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata({
  title: siteMetadata.title,
  description: siteMetadata.description,
  path: '/',
  absoluteTitle: true,
});

export default function Home() {
  return (
    <>
      <h1 className="sr-only">
        Dobby is an autonomous AI worker for slides, research, docs, and tasks on your computer
      </h1>
      <HomeClient />
      <HomeSeoContent />
    </>
  );
}
