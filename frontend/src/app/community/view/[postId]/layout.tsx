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
    
    // Fetch the rich HTML content to extract clean metadata
    let htmlTitle = post.title || 'Community Post';
    let htmlDescription = post.description || `Check out this community post: ${htmlTitle}`;
    let imageUrl = `${domain}/dobby-logo.svg`; // Default fallback
    
    try {
      // Fetch the HTML content from our backend proxy
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const htmlResponse = await fetch(`${backendUrl}/public-html/${postId}`, {
        next: { revalidate: 3600 }, // Cache for 1 hour
      });
      
      if (htmlResponse.ok) {
        const htmlContent = await htmlResponse.text();
        
        // Extract clean metadata from HTML content
        const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          htmlTitle = titleMatch[1].trim();
        }
        
        // Extract first image for thumbnail
        const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (imgMatch && imgMatch[1]) {
          const src = imgMatch[1];
          if (src.startsWith('http')) {
            imageUrl = src;
          } else if (src.startsWith('/')) {
            imageUrl = `${domain}${src}`;
          } else {
            imageUrl = `${domain}/${src}`;
          }
        }
        
        // Extract first paragraph for description (clean, without file markers)
        const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch && bodyMatch[1]) {
          let bodyContent = bodyMatch[1];
          
          // Remove script and style tags
          bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
          bodyContent = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
          
          // Remove headings and other structural elements
          bodyContent = bodyContent.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');
          bodyContent = bodyContent.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
          
          // Remove file upload markers
          bodyContent = bodyContent.replace(/\[Uploaded File:[^\]]+\]/g, '');
          
          // Extract text content
          const textContent = bodyContent.replace(/<[^>]+>/g, ' ').trim();
          
          if (textContent) {
            // Clean up whitespace and get first sentence
            const cleanText = textContent.replace(/\s+/g, ' ').trim();
            const sentences = cleanText.split(/[.!?]+/);
            if (sentences[0]) {
              const firstSentence = sentences[0].trim();
              if (firstSentence.length > 50) {
                htmlDescription = `${htmlTitle}. ${firstSentence.substring(0, 100)}...`;
              } else {
                htmlDescription = `${htmlTitle}. ${firstSentence}`;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching HTML content for metadata:', error);
      // Fall back to post metadata if HTML fetch fails
    }
    
    // Use thumbnail if available, otherwise use extracted image
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
      title: htmlTitle,
      description: htmlDescription,
      openGraph: {
        title: htmlTitle,
        description: htmlDescription,
        url: postUrl,
        siteName: 'Dobby.now AI 智能体',
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: htmlTitle,
          },
        ],
        type: 'article',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title: htmlTitle,
        description: htmlDescription,
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
        'wechat:title': htmlTitle,
        'wechat:description': htmlDescription,
        'wechat:image': imageUrl,
        // WeChat brand display tags
        'wechat:site_name': 'Dobby.now AI 智能体',
        'wechat:site_icon': `${domain}/dobby-logo.svg`,
        'wechat:author': 'Dobby.now AI 智能体',
        'wechat:copyright': '© 2025 Dobby.now AI 智能体',
        // Additional Open Graph tags for better compatibility
        'og:image:width': '1200',
        'og:image:height': '630',
        'og:image:type': 'image/png',
        'og:image:alt': htmlTitle,
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
