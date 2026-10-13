// Browser feed: post creation lives in the dedicated AddPostModal, not in the feed column.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { isLikedBy, postFromJson, toggleLikePost, type Post, FAN_SPACING } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { LIST_BOTTOM_INSET } from '@/theme/layout';
import { PostCard } from '@/components/PostCard';
import { EmptyState, PagingFooter, SkeletonRows } from '@/components/ui/ListsStates';
import { useHomeList, useHome } from './home/home-context';
import { apiFetch, apiUrl } from '@/lib/api/api-client';

const PAGE_SIZE = 10;
const FEED_KEY = ['feed'] as const;
type FeedPage = { posts: Post[] };

async function fetchPostsPage(page: number, signal?: AbortSignal): Promise<FeedPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), _: String(Date.now()) });
  const path = `posts?${params.toString()}`;
  const url = apiUrl(path);
  let status: number | undefined;
  try {
    const response = await apiFetch(path, { signal });
    status = response.status;
    if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status} ${response.statusText}`.trim());
    const payload: unknown = await response.json();
    const record = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : null;
    const rawPosts = Array.isArray(payload)
      ? payload
      : Array.isArray(record?.posts) ? record.posts
        : Array.isArray(record?.data) ? record.data : null;
    if (!rawPosts) throw new Error('Invalid posts response: expected an array, posts, or data array');
    return { posts: rawPosts.map((post) => postFromJson(post as Record<string, unknown>)) };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[FeedScreen] GET posts failed', {
        url, status,
        message: error instanceof Error ? error.message : String(error),
        error,
      });
    }
    throw error;
  }
}

export default function FeedScreen() {
  const colors = useFanColors();
  const queryClient = useQueryClient();
  const { userId, username, isLoggedIn } = useAuth();
  const { activeTab } = useHome();
  const { scrollProps, topInset } = useHomeList();
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    data, isPending, isFetching, isError, isFetchingNextPage, hasNextPage,
    fetchNextPage, refetch,
  } = useInfiniteQuery({
    queryKey: FEED_KEY,
    queryFn: ({ pageParam, signal }) => fetchPostsPage(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.posts.length === PAGE_SIZE ? allPages.length + 1 : undefined,
    placeholderData: (previous) => previous,
    refetchOnMount: true,
  });

  const posts = useMemo(() => data?.pages.flatMap((page) => page.posts) ?? [], [data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleLike = useCallback(async (post: Post) => {
    if (!isLoggedIn || !userId || !username || !post.id) return;
    const wasLiked = isLikedBy(post, userId);
    queryClient.setQueryData<InfiniteData<FeedPage>>(FEED_KEY, (previous) => previous && ({
      ...previous,
      pages: previous.pages.map((page) => ({
        ...page,
        posts: page.posts.map((item) => item.id === post.id ? {
          ...item,
          likedBy: wasLiked
            ? (item.likedBy ?? []).filter((id) => id !== userId)
            : [...(item.likedBy ?? []), userId],
          likesCount: (item.likesCount ?? 0) + (wasLiked ? -1 : 1),
        } : item),
      })),
    }));
    try {
      await toggleLikePost(post.id, userId, username);
    } catch {
      await queryClient.invalidateQueries({ queryKey: FEED_KEY });
    }
  }, [isLoggedIn, userId, username, queryClient]);

  // Retry an empty feed periodically while its column is actually visible.
  useEffect(() => {
    if (posts.length > 0) return;
    const retryIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const desktop = window.matchMedia('(min-width: 651px)').matches;
      if (!desktop && activeTab !== 'Feed') return;
      void refetch();
    };
    const timer = window.setInterval(retryIfVisible, 10_000);
    return () => window.clearInterval(timer);
  }, [posts.length, activeTab, refetch]);

  const listStyle: CSSProperties = {
    minHeight: 0,
    overflowY: 'auto',
    paddingTop: topInset,
    paddingBottom: LIST_BOTTOM_INSET,
  };
  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    if (node.scrollHeight - node.scrollTop - node.clientHeight < 240) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const showLoading = posts.length === 0 && (isPending || isFetching);

  return (
    <div
      ref={scrollRef}
      className="feed-screen no-scrollbar"
      style={{ height: '100%', minHeight: 0, overflowY: 'auto', background: colors.background, ...listStyle }}
      onScroll={(event) => {
        scrollProps.onScroll(event);
        handleScroll();
      }}
    >
      {showLoading ? (
        <SkeletonRows colors={colors} />
      ) : posts.length === 0 ? (
        <div role="status" style={{ padding: FAN_SPACING.lg }}>
          <EmptyState
            colors={colors}
            title={isError ? "You're offline" : 'No posts yet'}
            hint={isError ? 'Could not load posts. Tap Refresh to try again.' : 'Posts will appear here.'}
          />
          <div style={{ textAlign: 'center', paddingTop: FAN_SPACING.md }}>
            <button type="button" onClick={() => void onRefresh()} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {posts.map((post, index) => (
            <PostCard
              key={post.id ?? index}
              post={post}
              index={index}
              currentUserId={userId}
              onLike={(item) => void handleLike(item)}
              onOpenComments={() => {}}
              onRepost={() => {}}
              onShare={() => {}}
            />
          ))}
          <div style={{ textAlign: 'center', padding: FAN_SPACING.lg }}>
            <PagingFooter colors={colors} loading={isFetchingNextPage} />
            {hasNextPage && (
              <button type="button" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                Load more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
