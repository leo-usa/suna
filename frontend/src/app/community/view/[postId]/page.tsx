"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CommunityPostViewer() {
  const { postId } = useParams();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!postId) return;
    console.log('Community viewer postId:', postId);
    fetch(`/api/community/post/${postId}`)
      .then(async res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch post: ${res.status}`);
        }
        return res.json();
      })
      .then(async data => {
        setMeta(data);
        const htmlRes = await fetch(data.html_url);
        const htmlText = await htmlRes.text();
        setHtml(htmlText);
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
        setHtml(`<div style='color:red'>Error loading post: ${err.message}</div>`);
        setMeta(null);
        console.error(err);
      });
  }, [postId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <div className="flex flex-col items-center pt-8 pb-2">
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="flex items-center">
            <Image src="/drpang-logo.svg" alt="DrPang.AI Logo" width={96} height={48} priority />
          </Link>
          <button
            className="rounded-full p-2 bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center ml-2"
            onClick={handleCopy}
            title={t('sidebar.copyLink', '复制链接')}
          >
            <Copy className="w-5 h-5" />
            <span className="sr-only">{t('sidebar.copyLink', '复制链接')}</span>
          </button>
          {copied && <span className="ml-2 text-xs text-green-600">{t('sidebar.copyLinkSuccess', '链接已复制')}</span>}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center">
        <div className="max-w-5xl w-full px-4 py-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">{meta?.title || 'Community Post'}</h1>
            <p className="text-muted-foreground mb-2">{t('community.by', 'By {{name}}', { name: meta?.user_name || t('community.anonymous', 'Anonymous') })}</p>
          </div>
          <section className="w-full bg-white p-6 rounded shadow" style={{ minHeight: 400 }} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
} 