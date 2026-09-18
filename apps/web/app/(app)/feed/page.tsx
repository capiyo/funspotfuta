'use client';

// Same data flow as before (posts-service.ts: paginated feed, create post,
// like toggle) — now rendering through the restyled <PostCard>, which adds
// the follow button, media-type tag, and comment/repost/share footer row
// that were missing from the old inline card markup.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getPosts, toggleLikePost, Post, isLikedBy } from '@funspot/core';
import { createPost } from '@/lib/api/posts-create';
import { useToast } from '@/lib/toast/toast-context';
import { PostCard } from '@/components/PostCard';

export default function FeedPage() {
  const { userId, username } = useAuth();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [caption, setCaption] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [lastViewedAt] = useState(() => Date.now() / 1000);
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

  function handleOpenComments(post: Post, index: number) {
    // Wire this up to your existing PostComments modal/sheet.
    console.log('open comments for', post.id, index);
  }

  function handleRepost(_post: Post) {
    toast.showInfo('Repost coming soon');
  }

  function handleShare(_post: Post) {
    toast.showInfo('Share coming soon');
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl pb-10">
      <h1 className="mb-fan-lg font-condensed text-fan-headline text-fan-textPrimary">Feed</h1>

      <div className="mb-fan-xxl rounded-fan-xl border border-fan-border bg-fan-surface p-fan-base">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={`What's on your mind, ${username ?? 'fan'}?`}
          rows={2}
          className="w-full resize-none bg-transparent text-fan-body text-fan-textPrimary outline-none placeholder:text-fan-textTertiary"
        />
        {imageFile && <p className="mb-fan-md text-fan-caption text-fan-textTertiary">📎 {imageFile.name}</p>}
        <div className="flex items-center justify-between">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="text-fan-caption text-fan-textTertiary"
          />
          <button
            onClick={handlePost}
            disabled={posting || (!caption.trim() && !imageFile)}
            className="rounded-fan-pill bg-fan-primary px-fan-lg py-fan-sm.5 text-fan-caption font-semibold text-fan-textInverse disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <p className="py-16 text-center text-fan-body text-fan-textTertiary">No posts yet — be the first.</p>
      ) : (
        <>
          <div>
            {posts.map((post, i) => (
              <PostCard
                key={post.id ?? i}
                post={post}
                index={i}
                currentUserId={userId}
                isNew={(post.timestamp ?? 0) > lastViewedAt}
                onLike={handleLike}
                onOpenComments={handleOpenComments}
                onRepost={handleRepost}
                onShare={handleShare}
              />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={handleLoadMore}
              className="mt-fan-lg w-full rounded-fan-lg border border-fan-border bg-fan-surfaceSunken py-fan-md text-fan-body text-fan-textSecondary"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}