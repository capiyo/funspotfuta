// RN port of funspot-next/app/(app)/feed/page.tsx.

import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth/auth-context';
import { getPosts, toggleLikePost, Post, displayCaption, bestImageUrl, formattedDate, isLikedBy } from '@funspot/core';
import { createPost } from '@/lib/api/posts-create';
import { colors } from '@/theme';

export default function FeedScreen() {
  const { userId, username } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [posting, setPosting] = useState(false);

  async function loadPage(p: number, replace: boolean) {
    const result = await getPosts({ page: p, limit: 10 });
    setHasMore(result.posts.length === 10);
    setPosts((prev) => (replace ? result.posts : [...prev, ...result.posts]));
  }

  useEffect(() => {
    setLoading(true);
    loadPage(1, true).finally(() => setLoading(false));
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.composer}>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={`What's on your mind, ${username ?? 'fan'}?`}
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.composerInput}
        />
        {image && <Text style={styles.pickedFile}>📎 {image.fileName ?? 'image'}</Text>}
        <View style={styles.composerRow}>
          <Pressable onPress={handlePickImage}>
            <Text style={{ color: '#d1d5db' }}>📷 Add image</Text>
          </Pressable>
          <Pressable style={styles.postButton} disabled={posting || (!caption.trim() && !image)} onPress={handlePost}>
            <Text style={styles.postButtonText}>{posting ? 'Posting…' : 'Post'}</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      ) : posts.length === 0 ? (
        <Text style={styles.empty}>No posts yet — be the first.</Text>
      ) : (
        <>
          {posts.map((post, i) => {
            const liked = userId ? isLikedBy(post, userId) : false;
            const img = bestImageUrl(post);
            return (
              <View key={post.id ?? i} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Text style={styles.postUser}>{post.userName ?? 'Anonymous'}</Text>
                  <Text style={styles.postDate}>{formattedDate(post)}</Text>
                </View>
                {displayCaption(post) ? <Text style={styles.postCaption}>{displayCaption(post)}</Text> : null}
                {img && <Image source={{ uri: img }} style={styles.postImage} />}
                <Pressable style={styles.likeRow} onPress={() => handleLike(post, i)}>
                  <Text style={{ color: liked ? '#f87171' : colors.textMuted }}>{liked ? '❤️' : '🤍'} {post.likesCount ?? 0}</Text>
                </Pressable>
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
              <Text style={{ color: '#d1d5db' }}>Load more</Text>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  composer: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, marginBottom: 16 },
  composerInput: { color: 'white', fontSize: 14, minHeight: 44 },
  pickedFile: { color: colors.textMuted, fontSize: 11, marginBottom: 8 },
  composerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  postButton: { backgroundColor: colors.green, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  postButtonText: { color: '#000', fontWeight: '700', fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48 },
  postCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, marginBottom: 12 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  postUser: { color: 'white', fontSize: 13, fontWeight: '700' },
  postDate: { color: colors.textMuted, fontSize: 11 },
  postCaption: { color: '#e5e7eb', fontSize: 13, marginBottom: 8 },
  postImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 8 },
  likeRow: { flexDirection: 'row' },
  loadMore: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 12, alignItems: 'center', marginTop: 8 },
});
