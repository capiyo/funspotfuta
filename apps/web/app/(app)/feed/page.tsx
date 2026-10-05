'use client';

// Same data flow as before (posts-service.ts: paginated feed, create post,
// like toggle) — now rendering through the restyled <PostCard>, which adds
// the follow button, media-type tag, and comment/repost/share footer row
// that were missing from the old inline card markup.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getPosts, toggleLikePost, Post, isLikedBy } from '@funspot/core';
import { createPost } from '@/lib/api/posts-create';
import { PostCard } from '@/components/PostCard';

export default function FeedPage() {
  const { userId, username } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
    setLoadError(false);
  }

  useEffect(() => {
    setLoading(true);
    loadPage(1, true)
      .catch((error) => {
        console.error('Failed to load feed', error);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLoadMore() {
    const next = page + 1;
    try {
      await loadPage(next, false);
      setPage(next);
    } catch (error) {
      console.error('Failed to load more feed posts', error);
      setLoadError(true);
    }
  }

  async function handleRetry() {
    setLoading(true);
    try {
      await loadPage(1, true);
      setPage(1);
    } catch (error) {
      console.error('Failed to retry feed load', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
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
    try {
      const result = await toggleLikePost(post.id, userId, username);
      if (result.success && result.likesCount != null) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likesCount: result.likesCount! } : p)));
      }
    } catch {
      // Match mobile: restore authoritative backend state if the optimistic like fails.
      await loadPage(page, true).catch((error) => console.error('Failed to refresh feed after like error', error));
    }
  }

  // These actions are intentionally no-ops, matching FeedScreen/PostCard on mobile.
  // Do not imply backend support until the mobile implementation adds it.

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
      ) : loadError && posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-fan-body text-fan-textSecondary">Couldn’t load the feed. Check your connection and try again.</p>
          <button onClick={handleRetry} className="mt-fan-md rounded-fan-pill border border-fan-border px-fan-lg py-fan-sm text-fan-body font-semibold text-fan-primary">Try again</button>
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
                onOpenComments={() => {}}
                onRepost={() => {}}
                onShare={() => {}}
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