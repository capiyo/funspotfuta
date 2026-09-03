// RN port of funspot-next/components/ChannelCreationModal.tsx (itself a
// simplified port of lib/modals/homepage/channel_creation.dart).

import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { createChannel } from '@funspot/core';
import { colors } from '@/theme';

export function ChannelCreationModal({ onClose }: { onClose: () => void }) {
  const { userId, username, authToken } = useAuth();
  const [name, setName] = useState('');
  const [season, setSeason] = useState('2025/26');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Give your channel a name');
      return;
    }
    if (!userId || !username || !authToken) {
      setError('Log in to create a channel');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createChannel({
      name: name.trim(),
      createdBy: userId,
      createdByUsername: username,
      season,
      members: [{ id: userId, username }],
      authToken,
    });
    setSubmitting(false);
    if (result.success) onClose();
    else setError(result.message ?? 'Failed to create channel');
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Create Channel</Text>

          <Text style={styles.label}>Channel name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sunday League Squad"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Season</Text>
          <TextInput value={season} onChangeText={setSeason} style={styles.input} />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.button} disabled={submitting} onPress={handleCreate}>
            <Text style={styles.buttonText}>{submitting ? 'Creating…' : 'Create Channel'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#4b5563', alignSelf: 'center', marginBottom: 16 },
  title: { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { color: colors.textMuted, fontSize: 11, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'white',
    marginBottom: 12,
  },
  error: { color: '#f87171', fontSize: 11, marginBottom: 12 },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
