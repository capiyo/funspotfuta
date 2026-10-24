// RN port of funspot-next/app/(app)/comrades/page.tsx — as a MODAL.

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getUserComrades,
  getComradeStats,
  addComrade,
  removeComrade,
  searchPotentialComrades,
  getUserChannels,
  addMembersToChannel,
  Channel,
  ComradeStats,
} from '@funspot/core';
import { colors } from '@/theme';
import AdCarousel from '@/components/AdCarousel';

export default function ComradesScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { userId, username, authToken } = useAuth();
  const [comrades, setComrades] = useState<Record<string, any>[]>([]);
  const [stats, setStats] = useState<ComradeStats | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [notice, setNotice] = useState('');
  const swipeStartY = useRef<number | null>(null);
  const handleSheetTouchEnd = (y: number) => {
    const start = swipeStartY.current;
    swipeStartY.current = null;
    if (start !== null && y - start > 90) onClose();
  };

  async function refresh() {
    if (!userId) return;
    setLoading(true);
    const [list, s] = await Promise.all([
      getUserComrades(userId, authToken ?? undefined),
      getComradeStats(userId, authToken ?? undefined),
    ]);
    setComrades(list);
    setStats(s);
    setLoading(false);
  }

  useEffect(() => {
    if (!visible) return;
    refresh();
    if (userId && authToken) {
      getUserChannels(userId, authToken).then((items) => {
        setChannels(items);
        setSelectedChannelId((current) => current || items.find((item) => item.isAdmin)?.channelId || items[0]?.channelId || '');
      }).catch(() => setChannels([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);

  async function handleSearch() {
    if (!userId || !query.trim()) {
      setResults([]);
      return;
    }
    setResults(
      await searchPotentialComrades(query.trim(), userId, authToken ?? undefined),
    );
  }

  async function handleAdd(candidate: Record<string, any>) {
    if (!userId || !username || !authToken) return;
    const id = candidate.id ?? candidate._id ?? candidate.user_id ?? candidate.userId;
    setBusyId(id);
    await addComrade({
      userId,
      comradeId: id,
      username,
      comradeUsername: candidate.username ?? 'Unknown',
      comradeNickname: candidate.nickname ?? candidate.username ?? 'Unknown',
      comradeClub: candidate.club ?? '',
      comradeCountry: candidate.country ?? '',
      authToken,
    });
    setBusyId(null);
    setResults((prev) => prev.filter((r) => (r.id ?? r._id) !== id));
    refresh();
  }

  async function handleAddToChannel(candidate: Record<string, any>) {
    if (!authToken || !selectedChannelId) { setNotice('Choose a channel first.'); return; }
    const channel = channels.find((item) => item.channelId === selectedChannelId);
    if (!channel?.isAdmin) { setNotice('Only channel admins can add members.'); return; }
    const id = String(candidate.id ?? candidate._id ?? candidate.user_id ?? candidate.userId ?? '');
    const name = String(candidate.username ?? candidate.user_name ?? '');
    if (!id || !name) { setNotice('This profile is missing its ID or username.'); return; }
    setBusyId(id);
    try {
      const ok = await addMembersToChannel(selectedChannelId, [{ id, username: name }], authToken);
      setNotice(ok ? `Added @${name} to ${channel.name}.` : 'Could not add this user to the channel.');
    } catch { setNotice('Could not add this user to the channel.'); }
    finally { setBusyId(null); }
  }

  async function handleRemove(comradeId: string) {
    if (!userId || !authToken) return;
    setBusyId(comradeId);
    await removeComrade(userId, comradeId, authToken);
    setBusyId(null);
    refresh();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          onTouchStart={(event) => { swipeStartY.current = event.nativeEvent.pageY; }}
          onTouchEnd={(event) => handleSheetTouchEnd(event.nativeEvent.pageY)}
        >
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Comrades</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={14} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
          >
            <AdCarousel />
            {stats && (
              <Text style={styles.stats}>
                {stats.count}/{stats.max_comrades} · {stats.remaining} remaining
              </Text>
            )}

            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                placeholder="Search by username…"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable style={styles.searchButton} onPress={handleSearch}>
                <Text style={styles.searchButtonText}>Search</Text>
              </Pressable>
            </View>

            {channels.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.sectionLabel}>Add profiles to channel</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {channels.map((channel) => (
                    <Pressable key={channel.channelId} onPress={() => setSelectedChannelId(channel.channelId)} style={{ marginRight: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: selectedChannelId === channel.channelId ? colors.primaryDim : colors.surface, borderWidth: 1, borderColor: selectedChannelId === channel.channelId ? colors.primary : colors.border }}>
                      <Text style={{ color: selectedChannelId === channel.channelId ? colors.primary : colors.textPrimary, fontSize: 11 }}>{channel.name}{channel.isAdmin ? ' · Admin' : ''}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {notice ? <Text style={{ color: colors.green, fontSize: 11, marginBottom: 10 }}>{notice}</Text> : null}

            {results.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.sectionLabel}>Results</Text>
                {results.map((r) => {
                  const id = r.id ?? r._id;
                  return (
                    <View key={id} style={styles.row}>
                      <Text style={styles.rowText}>{r.username}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Pressable style={styles.addButton} disabled={busyId === id} onPress={() => handleAdd(r)}>
                          <Text style={styles.addButtonText}>Comrade</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.addButton, { backgroundColor: colors.surfaceSunken, opacity: channels.some((channel) => channel.channelId === selectedChannelId && channel.isAdmin) ? 1 : 0.45 }]}
                          disabled={busyId === id || !channels.some((channel) => channel.channelId === selectedChannelId && channel.isAdmin)}
                          onPress={() => handleAddToChannel(r)}
                        >
                          <Text style={[styles.addButtonText, { color: colors.textPrimary }]}>Add to channel</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.sectionLabel}>Your comrades</Text>
            {loading ? (
              <ActivityIndicator color={colors.green} style={{ marginTop: 20 }} />
            ) : comrades.length === 0 ? (
              <Text style={styles.empty}>
                No comrades yet — search above to add some.
              </Text>
            ) : (
              comrades.map((c) => {
                const id = c.comrade_id ?? c.id;
                return (
                  <View key={id} style={styles.row}>
                    <View>
                      <Text style={styles.rowText}>
                        {c.comrade_username ?? c.username}
                      </Text>
                      {c.comrade_nickname && (
                        <Text style={styles.rowSubtext}>{c.comrade_nickname}</Text>
                      )}
                    </View>
                    <Pressable
                      style={styles.removeButton}
                      disabled={busyId === id}
                      onPress={() => handleRemove(id)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTitle: { color: 'white', fontSize: 15, fontWeight: '700' },
  closeBtn: {
    borderRadius: 999,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  screen: { backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  stats: { color: colors.textMuted, fontSize: 11, marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: 'white',
  },
  searchButton: {
    backgroundColor: colors.green,
    borderRadius: 999,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: { color: '#000', fontWeight: '700', fontSize: 12 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 8 },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowText: { color: 'white', fontSize: 13 },
  rowSubtext: { color: colors.textMuted, fontSize: 11 },
  addButton: {
    backgroundColor: colors.green,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  addButtonText: { color: '#000', fontWeight: '700', fontSize: 11 },
  removeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  removeButtonText: { color: '#f87171', fontWeight: '700', fontSize: 11 },
});