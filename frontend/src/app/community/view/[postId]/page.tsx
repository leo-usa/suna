"use client";
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCommunityPost } from '@/lib/api';
import { Link } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';
import { detectLanguageFromPost, detectLanguageFromPostWithHTML } from '@/lib/language-detection';

// Separate component for floating window to ensure re-render on language change
function FloatingAttributionBar({ currentLanguage, i18n }: { currentLanguage: string; i18n: any }) {
  const { t } = useTranslation();
  
  // Force re-render when language changes
  const [renderKey, setRenderKey] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    setRenderKey(prev => prev + 1);
    // Change i18n language when currentLanguage changes
    if (currentLanguage === 'zh-CN') {
      i18n.changeLanguage('zh');
    } else {
      i18n.changeLanguage(currentLanguage);
    }
  }, [currentLanguage]);
  
  // Get translations with proper language detection
  const getTranslation = (key: string) => {
    // For Chinese content, always use hardcoded translations
    if (currentLanguage === 'zh-CN' || currentLanguage === 'zh') {
      const hardcodedTranslations: { [key: string]: string } = {
        'communityPost.floatingBar.researchReport': '本研究报告由Dobby智能体做研究和生成',
        'communityPost.floatingBar.tagline': 'Dobby，你的AI打工狗',
        'communityPost.floatingBar.description': '帮你做研究，写报告，建网站，做PPT',
        'communityPost.floatingBar.visitHomepage': '点我到Dobby主页',
        'communityPost.floatingBar.website': '网址：https://dobby.now'
      };
      
      return hardcodedTranslations[key] || i18n.t(key, { lng: 'zh' });
    }
    
    // For other languages, use i18n
    return i18n.t(key, { lng: currentLanguage });
  };

  // Show a small "Show Dobby" button when closed
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
        aria-label="Show Dobby"
        title="Show Dobby"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
      </button>
    );
  }
  
  return (
    <div
      key={`floating-bar-${currentLanguage}-${renderKey}`}
      className="fixed bottom-6 right-6 z-50 bg-white/90 backdrop-blur-sm border border-red-200/50 rounded-xl shadow-lg p-4 max-w-sm hover:shadow-xl transition-all duration-300 hover:scale-105"
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        lineHeight: '1.4',
        color: '#374151'
      }}
    >
      {/* Close Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(false);
        }}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-200"
        aria-label="Close"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* Content */}
      <a
        href="https://dobby.now"
        target="_blank"
        rel="noopener noreferrer"
        className="block no-underline"
        style={{ color: 'inherit' }}
      >
        <div className="flex items-center mb-3">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mr-2 shadow-sm">
              <span className="text-white text-xs font-bold">D</span>
            </div>
            <span className="font-bold text-red-600">DOBBY</span>
          </div>
        </div>
        
        <div className="text-sm mb-3 text-gray-700">
          {getTranslation('communityPost.floatingBar.researchReport')}
        </div>
        
        <div className="text-sm font-medium mb-2 text-red-600">
          {getTranslation('communityPost.floatingBar.tagline')}
        </div>
        
        <div className="text-sm mb-3 text-gray-600">
          {getTranslation('communityPost.floatingBar.description')}
        </div>
        
        <div className="text-sm text-blue-600 hover:text-blue-800 underline hover:no-underline mb-2 transition-colors duration-200">
          {getTranslation('communityPost.floatingBar.visitHomepage')}
        </div>
        
        <div className="text-xs text-gray-500">
          {getTranslation('communityPost.floatingBar.website')}
        </div>
      </a>
    </div>
  );
}

export default function CommunityPostEmbedPage() {
  const { t, i18n } = useTranslation();
  const { postId } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [forceRender, setForceRender] = useState(0);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    getCommunityPost(postId as string)
      .then(async (postData) => {
        setPost(postData);
        
        // Detect language from post content and change i18n language
        if (postData) {
          const htmlUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/public-html/${postId}`;
          const detectedLang = await detectLanguageFromPostWithHTML(postData, htmlUrl);
          setCurrentLanguage(detectedLang);
          setForceRender(prev => prev + 1);
        }
      })
      .finally(() => setLoading(false));
  }, [postId, i18n]);

  // Listen for language changes to force re-render
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      console.log('Language changed to:', lng);
      setCurrentLanguage(lng);
      setForceRender(prev => prev + 1);
    };
    
    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  if (!postId) return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!post) return <div className="p-8 text-center">{t('communityPost.postNotFound')}</div>;

  const htmlUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/public-html/${postId}`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const handleCopy = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t('communityShare.linkCopiedSuccess'));
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
            {post.description && (
              <div className="text-sm text-gray-600 truncate max-w-xs sm:max-w-md" title={post.description}>
                {post.description}
              </div>
            )}
            <div className="text-xs text-gray-500">{createdAt}</div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCopy}
                    className="rounded h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"
                    aria-label={t('communityPost.copyLink')}
                  >
                    <Link className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('communityPost.copyLink')}</TooltipContent>
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
        sandbox="allow-scripts allow-same-origin allow-popups allow-top-navigation"
        allowFullScreen
      />
      {/* Floating Attribution Bar */}
      <FloatingAttributionBar currentLanguage={currentLanguage} i18n={i18n} />
    </div>
  );
} 