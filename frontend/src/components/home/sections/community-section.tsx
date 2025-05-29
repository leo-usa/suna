import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { API_URL } from '@/lib/api';
import { useTranslation } from 'react-i18next';

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
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/community?limit=12&order=desc`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts || []))
      .finally(() => setLoading(false));
  }, []);

  const handleLike = async (postId: string) => {
    setLiking(postId);
    await fetch(`${API_URL}/community/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId }),
    });
    // Optimistically update like count
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, like_count: p.like_count + 1 } : p
      )
    );
    setLiking(null);
  };

  return (
    <section className="w-full py-16 bg-muted/50">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center">{t('community.gallery', 'Community Gallery')}</h2>
        {loading ? (
          <div className="text-center text-muted-foreground">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-muted-foreground">No community posts yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {posts.map((post) => (
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
                  <div className="w-full h-40 bg-gray-200 rounded-t-lg flex items-center justify-center text-gray-400">
                    No Image
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
} 