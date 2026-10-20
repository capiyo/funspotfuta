// Browser feed: post creation lives in the dedicated AddPostModal, not in the feed column.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { isLikedBy, toggleLikePost, queryKeys, useFeed, type FeedPage, type Post, FAN_SPACING } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { LIST_BOTTOM_INSET } from '@/theme/layout';
import { PostCard } from '@/components/PostCard';
import { EmptyState, PagingFooter, SkeletonRows } from '@/components/ui/ListsStates';
import { useHomeList, useHome } from './home/home-context';
import './feed-layout.css';

const FEED_KEY = queryKeys.feed();

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
  } = useFeed();

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
          <div className="feed-list feed-list-masonry" data-feed-post-list>
            {[0, 1].map((columnIndex) => (
              <div className="feed-post-column" key={columnIndex}>
                {posts.map((post, index) => (
                  index % 2 === columnIndex ? (
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
                  ) : null
                ))}
              </div>
            ))}
          </div>
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
