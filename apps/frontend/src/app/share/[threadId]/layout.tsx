import { Metadata } from 'next';
import { getThread } from '@/lib/api/threads';
import { getProject } from '@/lib/api/threads';
import { pageUrl } from '@/lib/site-url';

export async function generateMetadata({ params }): Promise<Metadata> {
  const { threadId } = await params;
  const shareUrl = pageUrl(`/share/${threadId}`);
  const fallbackImage = pageUrl('/share-page/og-fallback.png');
  const fallbackMetaData = {
    title: 'Shared Conversation | Dobby',
    description: 'Replay this Worker conversation on Dobby',
    alternates: {
      canonical: shareUrl,
    },
    openGraph: {
      title: 'Shared Conversation | Dobby',
      description: 'Replay this Worker conversation on Dobby',
      images: [fallbackImage],
    },
  };

  try {
    const threadData = await getThread(threadId);
    const projectData = await getProject(threadData.project_id);

    if (!threadData || !projectData) {
      return fallbackMetaData;
    }

    const isDevelopment =
      // process.env.NODE_ENV === 'development' ||
      process.env.NEXT_PUBLIC_ENV_MODE === 'LOCAL' ||
      process.env.NEXT_PUBLIC_ENV_MODE === 'local';

    const title = projectData.name || 'Shared Conversation | Dobby';
    const description =
      projectData.description ||
      'Replay this Worker conversation on Dobby';
    const ogImage = isDevelopment
      ? fallbackImage
      : pageUrl(`/api/share-page/og-image?title=${projectData.name}`);

    return {
      title,
      description,
      alternates: {
        canonical: shareUrl,
      },
      openGraph: {
        title,
        description,
        images: [ogImage],
      },
      twitter: {
        title,
        description,
        images: ogImage,
        card: 'summary_large_image',
      },
    };
  } catch (error) {
    return fallbackMetaData;
  }
}

export default async function ThreadLayout({ children }) {
  return (
    <>
      {children}
    </>
  );
}
