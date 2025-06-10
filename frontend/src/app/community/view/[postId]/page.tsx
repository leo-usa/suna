"use client";
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCommunityPost } from '@/lib/api';
import { Link } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';

export default function CommunityPostEmbedPage() {
  const { postId } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    getCommunityPost(postId as string)
      .then(setPost)
      .finally(() => setLoading(false));
  }, [postId]);

  if (!postId) return <div className="p-8 text-center">Loading...</div>;
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!post) return <div className="p-8 text-center">Post not found.</div>;

  const htmlUrl = `/api/public-html/${postId}`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const handleCopy = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    }
  };
  const createdAt = post.created_at ? new Date(post.created_at).toLocaleString() : '';

  return (
    <div className="relative min-h-screen bg-[#fafbfc]">
      {/* Header */}
      <div className="w-full flex flex-col items-center border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-10 sticky top-0">
        <div className="max-w-4xl w-full flex items-center justify-between px-4 py-3 mx-auto">
          <div className="flex flex-col gap-0.5">
            <div className="text-lg font-semibold truncate max-w-xs sm:max-w-md" title={post.title}>{post.title}</div>
            <div className="text-xs text-gray-500">{createdAt}</div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCopy}
                    className="rounded h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"
                    aria-label="Copy link"
                  >
                    <Link className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('communityPost.copyLink', '复制链接')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      {/* Iframe */}
      <iframe
        src={htmlUrl}
        style={{ width: '100vw', height: 'calc(100vh - 64px)', border: 'none' }}
        title="Community Post"
        sandbox="allow-scripts allow-same-origin"
        allowFullScreen
      />
      {/* Floating Attribution Bar */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-50 bg-white/90 border border-gray-200 rounded-full px-4 py-2 shadow flex items-center gap-2 text-xs text-gray-700 hover:bg-gray-100 transition"
        style={{ pointerEvents: 'auto' }}
      >
        <span role="img" aria-label="robot">🤖</span> {t('communityPost.attribution', '由Dobby生成')}
      </a>
    </div>
  );
} 