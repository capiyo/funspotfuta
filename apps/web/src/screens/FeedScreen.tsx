// screens/FeedScreen.tsx
//
// Web port of the mobile FeedScreen. The query, cache behavior, auth gates,
// optimistic likes, composer state, validation, and user-facing copy mirror
// the mobile implementation. Native list/picker controls are browser controls.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import { ImagePlus, Paperclip, X } from 'lucide-react';
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import {
  getPosts,
  toggleLikePost,
  type Post,
  isLikedBy,
  FAN_SPACING,
} from '@funspot/core';
import { createPost } from '@/lib/api/posts-create';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { ICON, LIST_BOTTOM_INSET } from '@/theme/layout';
import { PostCard } from '@/components/PostCard';
import { FeedItem } from '@/components/ui/FeedItem';
import { ActionButton } from '@/components/ui/ActionButton';
import { MiniAvatar } from '@/components/ui/miniAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  EmptyState,
  ErrorBanner,
  PagingFooter,
  SkeletonRows,
} from '@/components/ui/ListsStates';
import { useHomeList } from './home/home-context';

const PAGE_SIZE = 10;
const FEED_KEY = ['feed'] as const;
type FeedPage = { posts: Post[] };

export default function FeedScreen() {
  const colors = useFanColors();
  const queryClient = useQueryClient();

  const { userId, username, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const { scrollProps, topInset } = useHomeList();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    placeholderData: (previous) => previous,
    retry: 1,
    enabled: true,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const posts = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data],
  );

  const loadError =
    isError && posts.length === 0
      ? 'Could not load posts. Try again.'
      : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  function handlePickImage() {
    if (!isLoggedIn) return requireLogin(handlePickImage);
    fileInputRef.current?.click();
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setImage(file);
    // Allow selecting the same image again after removing it.
    event.target.value = '';
  }

  function handleRemoveImage() {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handlePost() {
    if (!isLoggedIn) return requireLogin(handlePost);
    if (!userId || !username) return;
    if (!caption.trim() && !image) return;

    setPosting(true);
    try {
      await createPost({
        userId,
        userName: username,
        caption: caption.trim() || undefined,
        image: image ?? undefined,
      });
      setCaption('');
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await queryClient.invalidateQueries({ queryKey: FEED_KEY });
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(post: Post) {
    if (!isLoggedIn) return requireLogin(() => handleLike(post));
    if (!userId || !username || !post.id) return;
    const wasLiked = isLikedBy(post, userId);

    queryClient.setQueryData<InfiniteData<FeedPage>>(
      FEED_KEY,
      (previous) =>
        previous && ({
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
        }),
    );

    try {
      await toggleLikePost(post.id, userId, username);
    } catch {
      await queryClient.invalidateQueries({ queryKey: FEED_KEY });
    }
  }

  const canPost = !!caption.trim() || !!image;
  const composerStyles: Record<string, CSSProperties> = {
    metaRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    author: {
      display: 'flex',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      flex: 1,
      minWidth: 0,
    },
    grow: { flex: 1, minWidth: 0 },
    attachment: {
      display: 'flex',
      alignItems: 'center',
      gap: FAN_SPACING.xs,
      marginTop: FAN_SPACING.sm,
    },
    bottomRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: FAN_SPACING.sm,
      marginTop: 12,
    },
    banner: {
      padding: `${FAN_SPACING.md}px ${FAN_SPACING.lg}px`,
    },
  };

  // Same rows as MatchCard: meta / content / one-line footer.
  const composer = (
    <FeedItem colors={colors}>
      <div style={composerStyles.metaRow}>
        <div style={composerStyles.author}>
          <MiniAvatar colors={colors} label={username ?? '?'} />
          <span
            style={{
              ...fanText('competition', colors, colors.textPrimary),
              ...composerStyles.grow,
              fontWeight: 'normal',
            }}
          >
            {username ?? 'Fan'}
          </span>
        </div>
      </div>

      <Input
        colors={colors}
        variant="plain"
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        placeholder={
          isLoggedIn
            ? `What's on your mind, ${username ?? 'fan'}?`
            : 'Log in to post'
        }
        multiline
        disabled={!isLoggedIn}
      />

      {image && (
        <div style={composerStyles.attachment}>
          <Paperclip size={ICON.sm} color={colors.textSecondary} />
          <span
            style={{
              ...fanText('caption', colors, colors.textSecondary),
              ...composerStyles.grow,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {image.name || 'Image'}
          </span>
          <button
            type="button"
            onClick={handleRemoveImage}
            aria-label="Remove attached image"
            title="Remove attached image"
            style={{
              border: 0,
              background: 'transparent',
              color: colors.textSecondary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={ICON.sm} />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        aria-label="Choose an image"
        style={{ display: 'none' }}
      />

      <div style={composerStyles.bottomRow}>
        <ActionButton
          icon={ImagePlus}
          label="Add image"
          colors={colors}
          onPress={handlePickImage}
        />
        <Button
          label="Post"
          colors={colors}
          variant="primary"
          disabled={!canPost}
          loading={posting}
          onPress={handlePost}
        />
      </div>
    </FeedItem>
  );

  const listHeader = (
    <div>
      {isLoggedIn && composer}
      {loadError && (
        <div style={composerStyles.banner}>
          <ErrorBanner colors={colors} message={loadError} />
        </div>
      )}
    </div>
  );

  const listStyle: CSSProperties = {
    minHeight: 0,
    overflowY: 'auto',
    paddingTop: topInset,
    paddingBottom: LIST_BOTTOM_INSET,
  };

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    if (node.scrollHeight - node.scrollTop - node.clientHeight < 240) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div
      ref={scrollRef}
      className="feed-screen no-scrollbar"
      style={{
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        background: colors.background,
        ...listStyle,
      }}
      onScroll={(event) => {
        scrollProps.onScroll(event);
        handleScroll();
      }}
    >
      {isPending ? (
        <div style={{ paddingTop: 0 }}>
          {listHeader}
          <SkeletonRows colors={colors} />
        </div>
      ) : (
        <>
          {listHeader}

          {posts.length === 0 ? (
            isError ? (
              <EmptyState
                colors={colors}
                title="You're offline"
                hint="Tap Refresh once you're back online."
              />
            ) : (
              <EmptyState
                colors={colors}
                title="No posts yet"
                hint="Be the first to post."
              />
            )
          ) : (
            posts.map((post, index) => (
              <PostCard
                key={post.id ?? index}
                post={post}
                index={index}
                currentUserId={userId}
                onLike={(item) => handleLike(item)}
                onOpenComments={() => {}}
                onRepost={() => {}}
                onShare={() => {}}
              />
            ))
          )}

          <div style={{ textAlign: 'center', padding: FAN_SPACING.lg }}>
            <PagingFooter colors={colors} loading={isFetchingNextPage} />
            {hasNextPage && (
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                Load more
              </button>
            )}
            {(isError || posts.length === 0) && (
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
