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
        href="https://dobby.now"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-50 border border-primary rounded-xl px-3 py-2 shadow-md flex flex-col items-center gap-0.5 text-xs font-bold hover:bg-primary hover:text-white transition-all duration-500 max-w-xs w-48 backdrop-blur-sm dobby-bounce dobby-color"
        style={{ pointerEvents: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <img src="/dobby-logo.svg" alt="Dobby Logo" className="h-16 w-16 mb-0.5" />
        <span className="text-center leading-tight">本研究报告由Robby智能体做研究和生成</span>
        <span className="text-center leading-tight">Dobby，你的AI打工狗</span>
        <span className="text-center leading-tight">帮你做研究，写报告，建网站，做PPT</span>
        <span className="text-center leading-tight underline">点我到Dobby主页</span>
        <span className="text-center text-[10px] font-normal mt-0.5">网址：https://dobby.now</span>
        <style jsx>{`
          .dobby-bounce {
            animation: dobby-bounce-keyframes 3.5s cubic-bezier(0.4,0,0.6,1) infinite;
          }
          @keyframes dobby-bounce-keyframes {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          .dobby-color {
            animation: dobby-color-keyframes 10s linear infinite;
          }
          @keyframes dobby-color-keyframes {
            0% { background-color: rgba(255,255,255,0.7); color: #2563eb; }
            25% { background-color: rgba(236, 254, 255, 0.7); color: #f59e42; }
            50% { background-color: rgba(255,255,255,0.7); color: #10b981; }
            75% { background-color: rgba(236, 254, 255, 0.7); color: #2563eb; }
            100% { background-color: rgba(255,255,255,0.7); color: #2563eb; }
          }
        `}</style>
      </a>
    </div>
  );
} 