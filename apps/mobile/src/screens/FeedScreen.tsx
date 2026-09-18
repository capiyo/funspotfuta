// RN "Feed" tab. Corrected against real screenshots of the live app:
// posts have NO border and NO shadow — background matches the screen
// background, list items separated by a hairline bottom border, not a
// boxed container. FAN_SPACING/FAN_RADIUS for layout, fanText() for
// every text role.

import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getPosts,
  toggleLikePost,
  Post,
  displayCaption,
  bestImageUrl,
  formattedDate,
  isLikedBy,
  postTypeDisplay,
  followUser,
  FanColorPalette,
  FAN_SPACING,
  FAN_RADIUS,
} from '@funspot/core';
import { createPost } from '@/lib/api/posts-create';
import { useFanColors } from '@/theme/use-fan-colors';
import { AppHeader } from '@/components/AppHeader';
import { fanText } from '@/theme/use-fan-typography';

export default function FeedScreen() {
  const colors = useFanColors();
  const styles = createStyles(colors);

  const { userId, username } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [posting, setPosting] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  async function handleFollow(post: Post) {
    if (!userId || !post.userId) return;
    setFollowingIds((prev) => new Set(prev).add(post.userId!));
    await followUser(userId, post.userId);
  }

  async function loadPage(p: number, replace: boolean) {
    const result = await getPosts({ page: p, limit: 10 });
    setHasMore(result.posts.length === 10);
    setPosts((prev) => (replace ? result.posts : [...prev, ...result.posts]));
  }

  useEffect(() => {
    setLoading(true);
    loadPage(1, true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) setImage(result.assets[0]);
  }

  async function handlePost() {
    if (!userId || !username) return;
    if (!caption.trim() && !image) return;
    setPosting(true);
    try {
      await createPost({
        userId,
        userName: username,
        caption: caption.trim() || undefined,
        image: image ? { uri: image.uri, fileName: image.fileName, mimeType: image.mimeType, fileSize: image.fileSize } : undefined,
      });
      setCaption('');
      setImage(null);
      setPage(1);
      await loadPage(1, true);
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
    await toggleLikePost(post.id, userId, username);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.composer}>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={`What's on your mind, ${username ?? 'fan'}?`}
          placeholderTextColor={colors.textTertiary}
          multiline
          style={[fanText('body', colors), styles.composerInput]}
        />
        {image && <Text style={[fanText('caption', colors), { marginBottom: FAN_SPACING.md }]}>📎 {image.fileName ?? 'image'}</Text>}
        <View style={styles.composerRow}>
          <Pressable onPress={handlePickImage}>
            <Text style={fanText('body', colors, colors.textSecondary)}>📷 Add image</Text>
          </Pressable>
          <Pressable style={styles.postButton} disabled={posting || (!caption.trim() && !image)} onPress={handlePost}>
            <Text style={[fanText('button', colors), { letterSpacing: 0.4 }]}>{posting ? 'POSTING…' : 'POST'}</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: FAN_SPACING.xxxl }} />
      ) : posts.length === 0 ? (
        <Text style={[fanText('body', colors), styles.empty]}>No posts yet — be the first.</Text>
      ) : (
        <>
          {posts.map((post, i) => {
            const liked = userId ? isLikedBy(post, userId) : false;
            const img = bestImageUrl(post);
            return (
              <View key={post.id ?? i} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm }}>
                    <Text style={fanText('body', colors, colors.textPrimary)}>{post.userName ?? 'Anonymous'}</Text>
                    <Text style={fanText('caption', colors)}>{formattedDate(post)}</Text>
                    <Text style={fanText('caption', colors)}>{postTypeDisplay(post)}</Text>
                  </View>
                  {post.userId && post.userId !== userId && !followingIds.has(post.userId) && (
                    <Pressable onPress={() => handleFollow(post)}>
                      <Text style={fanText('caption', colors, colors.primary)}>follow</Text>
                    </Pressable>
                  )}
                </View>
                {displayCaption(post) ? (
                  <Text style={[fanText('body', colors), { marginBottom: FAN_SPACING.md }]}>{displayCaption(post)}</Text>
                ) : null}
                {img && <Image source={{ uri: img }} style={styles.postImage} />}
                <View style={{ flexDirection: 'row', gap: FAN_SPACING.base }}>
                  <Pressable onPress={() => handleLike(post, i)}>
                    <Text style={fanText('caption', colors, liked ? colors.away : colors.textTertiary)}>
                      {liked ? '❤️' : '🤍'} {post.likesCount ?? 0}
                    </Text>
                  </Pressable>
                  <Text style={fanText('caption', colors)}>💬 {post.commentsCount ?? 0}</Text>
                </View>
              </View>
            );
          })}
          {hasMore && (
            <Pressable
              style={styles.loadMore}
              onPress={() => {
                const next = page + 1;
                setPage(next);
                loadPage(next, false);
              }}
            >
              <Text style={fanText('title', colors, colors.textSecondary)}>Load more</Text>
            </Pressable>
          )}
        </>
      )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: FAN_SPACING.lg, paddingBottom: FAN_SPACING.xxxl },
    composer: {
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingVertical: FAN_SPACING.base,
    },
    composerInput: { minHeight: 44 },
    composerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: FAN_SPACING.md },
    postButton: {
      backgroundColor: colors.primary,
      borderRadius: FAN_RADIUS.pill,
      paddingHorizontal: FAN_SPACING.lg,
      paddingVertical: FAN_SPACING.md,
    },
    empty: { textAlign: 'center', marginTop: FAN_SPACING.xxxl },
    postCard: {
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingVertical: FAN_SPACING.base,
    },
    postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: FAN_SPACING.md },
    postImage: { width: '100%', height: 220, borderRadius: FAN_RADIUS.md, marginBottom: FAN_SPACING.md },
    likeRow: { flexDirection: 'row' },
    loadMore: {
      borderRadius: FAN_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSunken,
      paddingVertical: FAN_SPACING.base,
      alignItems: 'center',
      marginTop: FAN_SPACING.md,
    },
  });
}
