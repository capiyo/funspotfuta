// screens/FeedScreen.tsx
//
// Feed-only list, matching the web Home feed column:
//   - post creation is handled by the dedicated AddPostModal / Post action
//   - FeedItem owns horizontal gutters
//   - pull to refresh and paginated loading
//   - cached posts remain visible after a failed refresh
//   - the last card clears the floating tab bar
//   - feed requests are enabled only while the Feed tab is active

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '../modals/Login-modal-context';
import {
  getPosts,
  toggleLikePost,
  Post,
  isLikedBy,
  FAN_SPACING,
} from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { ICON, LIST_BOTTOM_INSET } from '@/theme/layout';
import { PostCard } from '@/components/PostCard';
import {
  EmptyState,
  ErrorBanner,
  PagingFooter,
  SkeletonRows,
} from '@/components/ui/ListsStates';
import { useHome, useHomeList } from './home/home-context';

const PAGE_SIZE = 10;
const FEED_KEY = ['feed'] as const;

type FeedPage = { posts: Post[] };

export default function FeedScreen() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const { userId, username, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const { activeTab } = useHome();
  const { scrollProps, topInset } = useHomeList();

  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    isPending,
    isError,
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
    // A failed refetch must not wipe the feed.
    placeholderData: (prev) => prev,
    retry: 1,
    enabled: activeTab === 'Feed',
  });

  const posts = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data],
  );

  const loadError =
    isError && posts.length === 0
      ? 'Could not load posts. Pull down to try again.'
      : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  async function handleLike(post: Post) {
    if (!isLoggedIn) return requireLogin(() => handleLike(post));
    if (!userId || !username || !post.id) return;
    const wasLiked = isLikedBy(post, userId);

    queryClient.setQueryData<InfiniteData<FeedPage>>(
      FEED_KEY,
      (previous) =>
        previous && {
          ...previous,
          pages: previous.pages.map((page) => ({
            ...page,
            posts: page.posts.map((item) =>
              item.id === post.id
                ? {
                    ...item,
                    likedBy: wasLiked
                      ? (item.likedBy ?? []).filter((id) => id !== userId)
                      : [...(item.likedBy ?? []), userId],
                    likesCount: (item.likesCount ?? 0) + (wasLiked ? -1 : 1),
                  }
                : item,
            ),
          })),
        },
    );

    try {
      await toggleLikePost(post.id, userId, username);
    } catch {
      void queryClient.invalidateQueries({ queryKey: FEED_KEY });
    }
  }

  const listHeader = loadError ? (
    <View style={styles.banner}>
      <ErrorBanner colors={colors} message={loadError} />
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      {isPending ? (
        <View style={{ paddingTop: topInset }}>
          {listHeader}
          <SkeletonRows colors={colors} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={posts}
          keyExtractor={(post, index) => post.id ?? String(index)}
          contentContainerStyle={[styles.content, { paddingTop: topInset }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
          scrollIndicatorInsets={{ top: topInset }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              progressViewOffset={topInset}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            isError ? (
              <EmptyState
                colors={colors}
                title="You're offline"
                hint="Pull down to retry once you're back online."
              />
            ) : (
              <EmptyState
                colors={colors}
                title="No posts yet"
                hint="Posts will appear here."
              />
            )
          }
          ListFooterComponent={
            <PagingFooter colors={colors} loading={isFetchingNextPage} />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          renderItem={({ item: post, index }) => (
            <PostCard
              post={post}
              index={index}
              currentUserId={userId}
              onLike={(item) => void handleLike(item)}
              onOpenComments={() => {}}
              onRepost={() => {}}
              onShare={() => {}}
            />
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useFanColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    list: { flex: 1 },
    content: { paddingBottom: LIST_BOTTOM_INSET },
    banner: { paddingHorizontal: FAN_SPACING.lg, paddingVertical: FAN_SPACING.md },
  });
}
