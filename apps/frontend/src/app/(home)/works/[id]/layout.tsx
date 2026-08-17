import type { Metadata } from 'next';
import { fetchPublicWork, workOgImagePath, workPath } from '@/lib/api/works';
import { siteMetadata } from '@/lib/site-metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const postId = decodeURIComponent(id);
  const post = await fetchPublicWork(postId);
  if (!post) {
    return {
      title: 'Work',
      description: siteMetadata.description,
    };
  }

  const title = post.title || 'Work';
  const description = (post.description || title).slice(0, 240);
  const url = `${siteMetadata.url}${workPath(post)}`;
  const image = `${siteMetadata.url}${workOgImagePath(post.slug || post.id)}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: siteMetadata.name,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function WorkDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
