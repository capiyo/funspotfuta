// RN port of funspot-next/app/(app)/chat/page.tsx.

import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Image, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserChannels, Channel } from '@funspot/core';
import { useChannelChat } from '@/lib/api/use-channel-chat';
import { useToast } from '@/lib/toast/toast-context';
import { colors } from '@/theme';

export default function ChatScreen() {
  const { userId, username, authToken } = useAuth();
  const toast = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!userId || !authToken) return;
    getUserChannels(userId, authToken).then((c) => {
      setChannels(c);
      setActiveChannelId((prev) => prev ?? c[0]?.id ?? null);
    });
  }, [userId, authToken]);

  const { messages, connected, loadingHistory, uploadingImage, send, sendImage } = useChannelChat({
    channelId: activeChannelId,
    userId,
    username,
    authToken,
  });

  async function handleSend() {
    if (!draft.trim()) return;
    await send(draft.trim());
    setDraft('');
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.showError('Photo library access is needed to send images');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      await sendImage({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, fileSize: asset.fileSize });
    } catch (e: any) {
      toast.showError(e?.message ?? 'Failed to send image');
    }
  }

  if (channels.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Join or create a channel to start chatting.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={activeChannelId} onValueChange={(v) => setActiveChannelId(v)} dropdownIconColor="white" style={{ color: 'white' }}>
            {channels.map((c) => (
              <Picker.Item key={c.id} label={c.name} value={c.id} />
            ))}
          </Picker>
        </View>
        <Text style={connected ? styles.live : styles.connecting}>{connected ? '● live' : '○ connecting…'}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: m }) => (
          <View style={[styles.bubbleRow, m.userId === userId ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
            <View style={[styles.bubble, m.userId === userId ? styles.bubbleMine : styles.bubbleTheirs, m.isPending && { opacity: 0.6 }]}>
              {m.userId !== userId && <Text style={styles.bubbleName}>{m.username}</Text>}
              {m.isImage && m.imageUrl && <Image source={{ uri: m.imageUrl }} style={styles.bubbleImage} />}
              {m.text ? <Text style={m.userId === userId ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{m.text}</Text> : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{loadingHistory ? 'Loading messages…' : 'No messages yet — say something.'}</Text>
        }
      />

      <View style={styles.inputRow}>
        <Pressable style={styles.imageButton} disabled={uploadingImage} onPress={handlePickImage}>
          <Text style={{ color: '#d1d5db' }}>📷</Text>
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={uploadingImage ? 'Uploading image…' : 'Message…'}
          placeholderTextColor={colors.textMuted}
          style={styles.textInput}
          onSubmitEditing={handleSend}
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  pickerWrap: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  live: { color: colors.green, fontSize: 11, marginLeft: 8 },
  connecting: { color: colors.textMuted, fontSize: 11, marginLeft: 8 },
  list: { padding: 12, gap: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  bubbleMine: { backgroundColor: colors.green },
  bubbleTheirs: { backgroundColor: 'rgba(255,255,255,0.1)' },
  bubbleName: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  bubbleTextMine: { color: '#000', fontSize: 14 },
  bubbleTextTheirs: { color: 'white', fontSize: 14 },
  bubbleImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
  imageButton: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  textInput: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 10, color: 'white' },
  sendButton: { backgroundColor: colors.green, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  sendButtonText: { color: '#000', fontWeight: '700', fontSize: 13 },
});
