// RN port of funspot-next/app/(app)/home/page.tsx (itself simplified from
// lib/screens/home_page.dart): fetch real fixtures, channel selector,
// filter tabs. The "+create channel" tab press opens the same modal
// (ChannelCreationModal) inline here via route params, matching the
// bottom-nav "+" behaviour in RootNavigator.
//
// Verified in sync with upstream @ fe28d33 (2026-09-02) — see /SYNC.md.
// home_page.dart changed upstream (UI only, zero endpoint diffs) since
// this was written, but this screen was always a simplified original
// rewrite, not a literal port, so nothing here needed updating.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/auth/auth-context';
import { getAllFixtures, getUserChannels, Channel, Fixture } from '@funspot/core';
import { MatchCard } from '@/components/MatchCard';
import { ChannelCreationModal } from '@/components/ChannelCreationModal';
import { colors } from '@/theme';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Filter = 'all' | 'live' | 'upcoming' | 'completed';

export default function HomeScreen() {
  const { userId, authToken, username } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [f, c] = await Promise.all([
      getAllFixtures(),
      userId && authToken ? getUserChannels(userId, authToken) : Promise.resolve([]),
    ]);
    setFixtures(f);
    setChannels(c);
    setActiveChannelId((prev) => prev ?? c[0]?.id);
    setLoading(false);
  }, [userId, authToken]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.openCreateChannel) {
        setShowCreateChannel(true);
        navigation.setParams({ openCreateChannel: undefined } as never);
      }
    }, [route.params, navigation])
  );

  const filtered = fixtures.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'live') return f.isLive || f.status === 'live';
    if (filter === 'upcoming') return f.status === 'upcoming' || f.status === 'soon';
    if (filter === 'completed') return f.status === 'completed';
    return true;
  });

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.username}>{username ?? 'Fan'} 👋</Text>
          </View>
          <Pressable style={styles.feedButton} onPress={() => navigation.navigate('Feed')}>
            <Text style={styles.feedButtonText}>📰 Feed</Text>
          </Pressable>
        </View>

        {channels.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {channels.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setActiveChannelId(c.id)}
                style={[styles.chip, activeChannelId === c.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, activeChannelId === c.id && styles.chipTextActive]}>{c.name}</Text>
              </Pressable>
            ))}
            {activeChannel && activeChannel.created_by === userId && (
              <Pressable style={styles.chip} onPress={() => navigation.navigate('Admin', { channelId: activeChannelId! })}>
                <Text style={styles.chipText}>⚙ Admin</Text>
              </Pressable>
            )}
          </ScrollView>
        )}

        <View style={styles.filterRow}>
          {(['all', 'live', 'upcoming', 'completed'] as const).map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>No fixtures right now — check back soon.</Text>
        ) : (
          filtered.map((fixture) => (
            <MatchCard key={fixture.id || fixture.matchId} fixture={fixture} channelId={activeChannelId} />
          ))
        )}
      </ScrollView>

      {showCreateChannel && (
        <ChannelCreationModal
          onClose={() => {
            setShowCreateChannel(false);
            load();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  welcome: { color: colors.textMuted, fontSize: 11 },
  username: { color: 'white', fontSize: 18, fontWeight: '700' },
  feedButton: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6 },
  feedButtonText: { color: '#d1d5db', fontSize: 11 },
  chipRow: { marginBottom: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: '#d1d5db', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.05)' },
  filterChipActive: { backgroundColor: 'white' },
  filterText: { color: colors.textMuted, fontSize: 11, textTransform: 'capitalize' },
  filterTextActive: { color: '#000' },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 48 },
});