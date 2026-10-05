// screens/FeedScreen.tsx
//
// OVERHAUL.
//   - FlatList instead of ScrollView + posts.map(): the feed is virtualised
//     and pages on scroll (onEndReached) instead of a "Load more" button
//   - composer has an avatar and lines up with the post column below it
//   - PostCard owns its gutter, so the screen adds no horizontal padding
//     (previously the screen's padding stacked with the card's padding)
//   - shared skeleton / empty states, sentence-case labels, lucide icons
// Data, like handling and posting logic are unchanged.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
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
import { GUTTER, HIT_SLOP, ICON, LIST_BOTTOM_INSET, PRESSED_OPACITY } from '@/theme/layout';
import { PostCard } from '@/components/PostCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PagingFooter, SkeletonRows } from '@/components/ui/ListsStates';

const PAGE_SIZE = 10;
const FEED_KEY = ['feed'] as const;

type FeedPage = { posts: Post[] };

export default function FeedScreen() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const { userId, username, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();

  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [posting, setPosting] = useState(false);

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: FEED_KEY,
      queryFn: ({ pageParam }) => getPosts({ page: pageParam, limit: PAGE_SIZE }),
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.posts.length === PAGE_SIZE ? allPages.length + 1 : undefined,
    });

  const posts = useMemo(
    () => data?.pages.flatMap((p) => p.posts) ?? [],
    [data],
  );

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
            name: image.fileName ?? 'image.jpg',
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

    queryClient.setQueryData<InfiniteData<FeedPage>>(FEED_KEY, (prev) =>
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

  const composer = (
    <View style={styles.composer}>
      <Avatar
        colors={colors}
        size="lg"
        label={(username ?? '?').charAt(0).toUpperCase()}
      />
      <View style={styles.composerBody}>
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
            <Text style={fanText('caption', colors, colors.textSecondary)} numberOfLines={1}>
              {image.fileName ?? 'Image'}
            </Text>
          </View>
        )}
        <View style={styles.composerRow}>
          <Pressable
            onPress={handlePickImage}
            hitSlop={HIT_SLOP}
            style={({ pressed }) => [styles.addImage, pressed && { opacity: PRESSED_OPACITY }]}
          >
            <ImagePlus size={ICON.md} color={colors.textSecondary} />
            <Text style={fanText('button', colors, colors.textSecondary)}>Add image</Text>
          </Pressable>
          <Button
            label="Post"
            colors={colors}
            variant="primary"
            disabled={!caption.trim() && !image}
            loading={posting}
            onPress={handlePost}
          />
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      data={posts}
      keyExtractor={(post, i) => post.id ?? String(i)}
      contentContainerStyle={{ paddingBottom: LIST_BOTTOM_INSET }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={composer}
      ListEmptyComponent={
        isPending ? (
          <SkeletonRows colors={colors} />
        ) : (
          <EmptyState colors={colors} title="No posts yet" hint="Be the first to post." />
        )
      }
      ListFooterComponent={<PagingFooter colors={colors} loading={isFetchingNextPage} />}
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
  );
}

function createStyles(colors: ReturnType<typeof useFanColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    composer: {
      flexDirection: 'row',
      gap: FAN_SPACING.md,
      paddingHorizontal: GUTTER,
      paddingVertical: FAN_SPACING.lg,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    composerBody: { flex: 1, gap: FAN_SPACING.md },
    attachment: { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.xs },
    composerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    addImage: { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm },
  });
}