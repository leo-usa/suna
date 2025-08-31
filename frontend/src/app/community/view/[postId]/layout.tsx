import { Metadata } from 'next';
import { getCommunityPost } from '@/lib/api';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  try {
    const { postId } = await params;
    const post = await getCommunityPost(postId);
    
    if (!post) {
      return {
        title: 'Post Not Found - Dobby',
        description: 'The requested community post could not be found.',
      };
    }

    // Get the current domain for absolute URLs
    const domain = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://dobby.now';
    const postUrl = `${domain}/community/view/${postId}`;
    
    // Use thumbnail if available, otherwise fallback to Dobby logo
    let imageUrl = `${domain}/dobby-logo.svg`; // Default fallback
    
    if (post.thumbnail_path) {
      if (post.thumbnail_path.startsWith('http')) {
        imageUrl = post.thumbnail_path;
      } else if (post.thumbnail_path.startsWith('/')) {
        imageUrl = `${domain}${post.thumbnail_path}`;
      } else {
        imageUrl = `${domain}/${post.thumbnail_path}`;
      }
    }
    
    // Ensure image URL is absolute and accessible
    if (!imageUrl.startsWith('http')) {
      imageUrl = `${domain}${imageUrl}`;
    }

    return {
      title: post.title,
      description: post.description || `Check out this community post on Dobby: ${post.title}`,
      openGraph: {
        title: post.title,
        description: post.description || `Check out this community post on Dobby: ${post.title}`,
        url: postUrl,
        siteName: 'Dobby',
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: post.title,
          },
        ],
        type: 'article',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description: post.description || `Check out this community post on Dobby: ${post.title}`,
        images: [imageUrl],
        creator: '@dobby_ai',
        site: '@dobby_ai',
      },
      alternates: {
        canonical: postUrl,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      // Additional meta tags for better social media sharing
      other: {
        // WeChat specific meta tags
        'wechat:title': post.title,
        'wechat:description': post.description || `Check out this community post on Dobby: ${post.title}`,
        'wechat:image': imageUrl,
        // Additional Open Graph tags for better compatibility
        'og:image:width': '1200',
        'og:image:height': '630',
        'og:image:type': 'image/png',
        'og:image:alt': post.title,
        // Article specific meta tags
        'article:published_time': post.created_at,
        'article:author': post.user_name || 'Dobby User',
        'article:section': 'Community Post',
        'article:tag': 'AI, Research, Community',
      },
    };
  } catch (error) {
    console.error('Error generating metadata for community post:', error);
    return {
      title: 'Community Post - Dobby',
      description: 'View community posts and research reports on Dobby.',
    };
  }
}

export default function CommunityPostLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
