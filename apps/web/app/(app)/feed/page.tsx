'use client';

// New UI (the original spreads this across posts_page.dart, 1000+ lines of
// card-state/caching logic) on top of the fully-ported posts-service.ts:
// paginated feed, create a post (caption + optional image), like toggle.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getPosts, toggleLikePost, Post, displayCaption, bestImageUrl, formattedDate, isLikedBy } from '@funspot/core';
import { createPost } from '@/lib/api/posts-create';
import { Heart } from 'lucide-react';

export default function FeedPage() {
  const { userId, username } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [caption, setCaption] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadPage(p: number, replace: boolean) {
    const result = await getPosts({ page: p, limit: 10 });
    setHasMore(result.posts.length === 10);
    setPosts((prev) => (replace ? result.posts : [...prev, ...result.posts]));
  }

  useEffect(() => {
    setLoading(true);
    loadPage(1, true).finally(() => setLoading(false));
  }, []);

  async function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    await loadPage(next, false);
  }

  async function handlePost() {
    if (!userId || !username) return;
    if (!caption.trim() && !imageFile) return;
    setPosting(true);
    try {
      await createPost({ userId, userName: username, caption: caption.trim() || undefined, image: imageFile ?? undefined });
      setCaption('');
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPage(1);
      await loadPage(1, true);
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(post: Post, index: number) {
    if (!userId || !username || !post.id) return;
    const wasLiked = isLikedBy(post, userId);
    setPosts((prev) =>
      prev.map((p, i) =>
        i === index
          ? { ...p, likedBy: wasLiked ? (p.likedBy ?? []).filter((id) => id !== userId) : [...(p.likedBy ?? []), userId], likesCount: (p.likesCount ?? 0) + (wasLiked ? -1 : 1) }
          : p
      )
    );
    const result = await toggleLikePost(post.id, userId, username);
    if (result.success && result.likesCount != null) {
      setPosts((prev) => prev.map((p, i) => (i === index ? { ...p, likesCount: result.likesCount! } : p)));
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-10">
      <h1 className="mb-4 text-lg font-bold text-white">Feed</h1>

      <div className="mb-6 rounded-2xl border border-white/10 bg-funspot-surface p-3">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={`What's on your mind, ${username ?? 'fan'}?`}
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
        />
        {imageFile && <p className="mb-2 text-xs text-gray-400">📎 {imageFile.name}</p>}
        <div className="flex items-center justify-between">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="text-xs text-gray-400"
          />
          <button
            onClick={handlePost}
            disabled={posting || (!caption.trim() && !imageFile)}
            className="rounded-full bg-funspot-green px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-funspot-green border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">No posts yet — be the first.</p>
      ) : (
        <>
          <div className="space-y-4">
            {posts.map((post, i) => {
              const liked = userId ? isLikedBy(post, userId) : false;
              const img = bestImageUrl(post);
              return (
                <div key={post.id ?? i} className="rounded-2xl border border-white/10 bg-funspot-surface p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{post.userName ?? 'Anonymous'}</span>
                    <span className="text-[11px] text-gray-500">{formattedDate(post)}</span>
                  </div>
                  {displayCaption(post) && <p className="mb-2 text-sm text-gray-200">{displayCaption(post)}</p>}
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="mb-2 max-h-80 w-full rounded-xl object-cover" />
                  )}
                  <button onClick={() => handleLike(post, i)} className="flex items-center gap-1 text-xs">
                    <Heart size={14} className={liked ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
                    <span className={liked ? 'text-red-400' : 'text-gray-400'}>{post.likesCount ?? 0}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={handleLoadMore}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-gray-300"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
