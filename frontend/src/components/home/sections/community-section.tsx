import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { API_URL } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthProvider';
import React from "react";

interface CommunityPost {
  id: string;
  title: string;
  user_name: string;
  like_count: number;
  description: string;
  thumbnail_path: string;
  created_at: string;
  html_url: string;
}

export default function CommunitySection() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const [total, setTotal] = useState(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/community?limit=${pageSize}&offset=${page * pageSize}&order=desc`)
      .then((res) => res.json())
      .then((data) => {
        setPosts(data.posts || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const handleLike = async (postId: string) => {
    if (!session || !session.access_token) {
      window.location.href = '/auth';
      return;
    }
    setLiking(postId);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const resp = await fetch(`${API_URL}/community/like`, {
      method: "POST",
      headers,
      body: JSON.stringify({ post_id: postId }),
    });
    let newLikeCount = null;
    if (resp.ok) {
      const data = await resp.json();
      newLikeCount = data.like_count;
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, like_count: newLikeCount !== null ? newLikeCount : p.like_count + 1 }
          : p
      )
    );
    setLiking(null);
  };

  const totalPages = Math.ceil(total / pageSize);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setTimeout(() => {
      const section = document.getElementById("community");
      if (section) section.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <section id="community" className="w-full py-16 bg-muted/50" ref={sectionRef}>
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center">{t('community.gallery', 'Community Gallery')}</h2>
        {loading ? (
          <div className="text-center text-muted-foreground">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-muted-foreground">No community posts yet.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              {posts.map((post) => {
                // Generate a random hue for the logo fallback
                const randomHue = Math.floor(Math.random() * 360);
                return (
                  <div
                    key={post.id}
                    className="bg-background rounded-lg shadow hover:shadow-lg transition cursor-pointer flex flex-col"
                    onClick={() => window.open(`/community/view/${post.id}`, "_blank")}
                  >
                    {post.thumbnail_path ? (
                      <img
                        src={post.thumbnail_path}
                        alt={post.title}
                        className="w-full h-40 object-cover rounded-t-lg"
                      />
                    ) : (
                      <div className="w-full h-40 bg-gray-200 rounded-t-lg flex items-center justify-center">
                        <img
                          src="/dobby-logo.svg"
                          alt="Dobby Logo"
                          className="h-32 w-32 opacity-80"
                          style={{ filter: `hue-rotate(${randomHue}deg)` }}
                        />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-lg font-semibold mb-1 line-clamp-2">{post.title}</h3>
                      <div className="text-sm text-muted-foreground mb-2 line-clamp-2">{post.description}</div>
                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('community.by', 'By {{name}}', { name: post.user_name || t('community.anonymous', 'Anonymous') })}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(post.id);
                          }}
                          disabled={liking === post.id}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5 text-pink-500"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.676 0-3.163.936-3.937 2.344C11.163 4.686 9.676 3.75 8 3.75 5.401 3.75 3.3 5.765 3.3 8.25c0 7.22 8.25 11.25 8.25 11.25s8.25-4.03 8.25-11.25z"
                            />
                          </svg>
                          <span>{post.like_count}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center mt-8 gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => handlePageChange(page - 1)}>
                  {t('pagination.prev')}
                </Button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <Button
                    key={idx}
                    variant={idx === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(idx)}
                  >
                    {idx + 1}
                  </Button>
                ))}
                <Button variant="outline" size="sm" disabled={page === totalPages - 1} onClick={() => handlePageChange(page + 1)}>
                  {t('pagination.next')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
} 