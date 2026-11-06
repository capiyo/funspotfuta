import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { getPosts, toggleLikePost, Post, isLikedBy } from '@funspot/core';
import { createPost } from '@/lib/api/posts-create';
import { useToast } from '@/lib/toast/toast-context';
import { PostCard } from '@/components/PostCard';

const PAGE_SIZE = 10;
const FEED_KEY = ['feed'] as const;

export default function FeedPage() {
  const { userId, username, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [lastViewedAt] = useState(() => Date.now() / 1000);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data,
    isPending,
    isError,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: FEED_KEY,
    queryFn: ({ pageParam }) => getPosts({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.posts.length === PAGE_SIZE ? allPages.length + 1 : undefined,
    placeholderData: (previous) => previous,
    retry: 1,
  });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];
  const loadError = isError && posts.length === 0;

  useEffect(() => {
    if (isError && posts.length > 0) {
      toast.showInfo('Could not refresh posts. Showing saved posts.');
    }
  }, [isError, posts.length]);

  async function handleLoadMore() {
    try {
      await fetchNextPage();
    } catch {
      toast.showError('Could not load more posts. Please try again.');
    }
  }

  async function handlePost() {
    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent('/home?tab=feed')}`);
      return;
    }
    if (!userId || !username || (!caption.trim() && !imageFile)) return;
    setPosting(true);
    try {
      await createPost({
        userId,
        userName: username,
        caption: caption.trim() || undefined,
        image: imageFile ?? undefined,
      });
      setCaption('');
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await queryClient.invalidateQueries({ queryKey: FEED_KEY });
    } catch (error) {
      console.error(error);
      toast.showError('Could not publish your post. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(post: Post) {
    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent('/home?tab=feed')}`);
      return;
    }
    if (!userId || !username || !post.id) return;
    const wasLiked = isLikedBy(post, userId);
    queryClient.setQueryData<InfiniteData<{ posts: Post[] }>>(FEED_KEY, (previous) =>
      previous && {
        ...previous,
        pages: previous.pages.map((page) => ({
          ...page,
          posts: page.posts.map((item) => item.id === post.id
            ? {
                ...item,
                likedBy: wasLiked
                  ? (item.likedBy ?? []).filter((id) => id !== userId)
                  : [...(item.likedBy ?? []), userId],
                likesCount: Math.max(0, (item.likesCount ?? 0) + (wasLiked ? -1 : 1)),
              }
            : item),
        })),
      },
    );
    try {
      const result = await toggleLikePost(post.id, userId, username);
      if (result.success && result.likesCount != null) {
        queryClient.setQueryData<InfiniteData<{ posts: Post[] }>>(FEED_KEY, (previous) =>
          previous && {
            ...previous,
            pages: previous.pages.map((page) => ({
              ...page,
              posts: page.posts.map((item) => item.id === post.id ? { ...item, likesCount: result.likesCount! } : item),
            })),
          },
        );
      } else {
        await queryClient.invalidateQueries({ queryKey: FEED_KEY });
      }
    } catch {
      await queryClient.invalidateQueries({ queryKey: FEED_KEY });
      toast.showError('Could not update your like. Please try again.');
    }
  }

  function handleOpenComments(post: Post) {
    // The mobile Feed currently has the same placeholder interaction.
    toast.showInfo(`Comments for ${post.userName ?? 'this user'}'s post are not available yet.`);
  }

  function handleRepost() {
    toast.showInfo('Repost coming soon');
  }

  async function handleShare(post: Post) {
    const shareUrl = post.id ? `${window.location.origin}/feed?post=${encodeURIComponent(post.id)}` : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Funspot post', text: post.caption ?? '', url: shareUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.showSuccess('Post link copied');
      } else {
        toast.showInfo(shareUrl);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast.showError('Could not share this post.');
    }
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl pb-10">
      <div className="mb-fan-md flex items-center justify-between gap-fan-md">
        <h1 className="font-condensed text-fan-headline text-fan-textPrimary">Feed</h1>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Refresh feed"
          className="rounded-fan-pill border border-fan-border px-fan-base py-fan-sm text-fan-caption font-semibold text-fan-textSecondary disabled:opacity-50"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="mb-fan-xxl rounded-fan-xl border border-fan-border bg-fan-surface p-fan-base">
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder={`What's on your mind, ${username ?? 'fan'}?`}
          rows={2}
          className="w-full resize-none bg-transparent text-fan-body text-fan-textPrimary outline-none placeholder:text-fan-textTertiary"
        />
        {imageFile && <p className="mb-fan-md text-fan-caption text-fan-textTertiary">📎 {imageFile.name}</p>}
        <div className="flex items-center justify-between gap-fan-sm">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            className="min-w-0 text-fan-caption text-fan-textTertiary"
            aria-label="Attach an image"
          />
          <button
            onClick={handlePost}
            disabled={posting || (!caption.trim() && !imageFile)}
            className="shrink-0 rounded-fan-pill bg-fan-primary px-fan-lg py-fan-sm.5 text-fan-caption font-semibold text-fan-textInverse disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16" role="status" aria-label="Loading posts">
          <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
        </div>
      ) : loadError ? (
        <div className="py-16 text-center text-fan-body text-fan-textTertiary">
          <p>No posts could be loaded.</p>
          <button onClick={() => void refetch()} className="mt-fan-md underline">Retry</button>
        </div>
      ) : posts.length === 0 ? (
        <p className="py-16 text-center text-fan-body text-fan-textTertiary">No posts yet — be the first.</p>
      ) : (
        <>
          <div>
            {posts.map((post, index) => (
              <PostCard
                key={post.id ?? index}
                post={post}
                index={index}
                currentUserId={userId}
                isNew={(post.timestamp ?? 0) > lastViewedAt}
                onLike={(item) => void handleLike(item)}
                onOpenComments={(item) => handleOpenComments(item)}
                onRepost={() => handleRepost()}
                onShare={(item) => void handleShare(item)}
              />
            ))}
          </div>
          {hasNextPage && (
            <button
              onClick={() => void handleLoadMore()}
              disabled={isFetchingNextPage}
              className="mt-fan-lg w-full rounded-fan-lg border border-fan-border bg-fan-surfaceSunken py-fan-md text-fan-body text-fan-textSecondary disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
