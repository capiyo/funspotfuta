// screens/FeedScreen.tsx
//
// Laid out like ArenaScreen:
//   - no horizontal padding on the list: FeedItem owns the gutter
//   - composer is a FeedItem card with the same rows as MatchCard
//     (meta / input / one-line footer flush with the card floor)
//   - loading shows composer + skeleton, rendered outside the list
//   - pull to refresh (progressViewOffset = topInset) and ErrorBanner
//   - scroll via useHomeList().scrollProps, content padded by topInset
//   - last card clears the floating tab bar (LIST_BOTTOM_INSET)
//   - query gated on activeTab === 'Feed'; cached data still renders
//   - placeholderData + isError so offline shows cached posts or an
//     explicit offline state

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { ImagePlus, Paperclip } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
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
import { useHome, useHomeList } from './home/home-context';

const PAGE_SIZE = 10;
const FEED_KEY = ['feed'] as const;
// Keep in sync with MatchCard's FOOTER_BLEED.
const FOOTER_BLEED = 12;

type FeedPage = { posts: Post[] };

export default function FeedScreen() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const { userId, username, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const { activeTab } = useHome();
  const { scrollProps, topInset } = useHomeList();

  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [posting, setPosting] = useState(false);
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
    () => data?.pages.flatMap((p) => p.posts) ?? [],
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

  async function handlePickImage() {
    if (!isLoggedIn) return requireLogin(handlePickImage);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) setImage(result.assets[0]);
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
        image: image
          ? {
            uri: image.uri,
            name:
              image.fileName ??
              `photo.${image.mimeType?.split('/')[1] ?? 'jpg'}`,
            type: image.mimeType ?? 'image/jpeg',
          }
          : undefined,
      });
      setCaption('');
      setImage(null);
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
      (prev) =>
        prev && {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p.id === post.id
                ? {
                  ...p,
                  likedBy: wasLiked
                    ? (p.likedBy ?? []).filter((id) => id !== userId)
                    : [...(p.likedBy ?? []), userId],
                  likesCount: (p.likesCount ?? 0) + (wasLiked ? -1 : 1),
                }
                : p,
            ),
          })),
        },
    );

    try {
      await toggleLikePost(post.id, userId, username);
    } catch {
      queryClient.invalidateQueries({ queryKey: FEED_KEY });
    }
  }

  const canPost = !!caption.trim() || !!image;

  // Same rows as MatchCard: meta / content / one-line footer.
  const composer = (
    <FeedItem colors={colors}>
      <View style={styles.metaRow}>
        <View style={[styles.author, styles.grow]}>
          <MiniAvatar colors={colors} label={username ?? '?'} />
          <Text
            style={[
              fanText('competition', colors, '#FFFFFF'),
              styles.authorName,
              styles.grow,
            ]}
            numberOfLines={1}
          >
            {username ?? 'Fan'}
          </Text>
        </View>
      </View>

      <Input
        colors={colors}
        variant="plain"
        value={caption}
        onChangeText={setCaption}
        placeholder={
          isLoggedIn
            ? `What's on your mind, ${username ?? 'fan'}?`
            : 'Log in to post'
        }
        multiline
        editable={isLoggedIn}
      />

      {image && (
        <View style={styles.attachment}>
          <Paperclip size={ICON.sm} color={colors.textSecondary} />
          <Text
            style={[fanText('caption', colors, colors.textSecondary), styles.grow]}
            numberOfLines={1}
          >
            {image.fileName ?? 'Image'}
          </Text>
        </View>
      )}

      <View style={styles.bottomRow}>
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
      </View>
    </FeedItem>
  );

  const listHeader = (
    <View>
      {composer}
      {loadError && (
        <View style={styles.banner}>
          <ErrorBanner colors={colors} message={loadError} />
        </View>
      )}
    </View>
  );

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
          keyExtractor={(post, i) => post.id ?? String(i)}
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
                hint="Be the first to post."
              />
            )
          }
          ListFooterComponent={
            <PagingFooter colors={colors} loading={isFetchingNextPage} />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          renderItem={({ item: post, index }) => (
            <PostCard
              post={post}
              index={index}
              currentUserId={userId}
              onLike={(p) => handleLike(p)}
              onOpenComments={() => { }}
              onRepost={() => { }}
              onShare={() => { }}
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
    grow: { flex: 1 },
    banner: { paddingHorizontal: FAN_SPACING.lg, paddingVertical: FAN_SPACING.md },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    author: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
    },
    authorName: { fontWeight: 'normal' },
    attachment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.xs,
      marginTop: FAN_SPACING.sm,
    },
    // Flush with the card floor, same trick as MatchCard.
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: -FOOTER_BLEED,
    },
  });
}