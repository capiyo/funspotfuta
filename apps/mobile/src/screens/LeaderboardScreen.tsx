// RN port of funspot-next/app/(app)/leaderboard/page.tsx.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserChannels, getChannelLeaderboard, getUserComrades, Channel, ComradeWithStats, comradeWithStatsFromChannelMember } from '@funspot/core';
import { colors } from '@/theme';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const { userId, authToken } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [rows, setRows] = useState<ComradeWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !authToken) return;
    getUserChannels(userId, authToken).then((c) => {
      setChannels(c);
      setActiveChannelId((prev) => prev ?? c[0]?.id ?? null);
    });
  }, [userId, authToken]);

  useEffect(() => {
    if (!activeChannelId || !authToken || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [board, comrades] = await Promise.all([
        getChannelLeaderboard(activeChannelId, authToken),
        getUserComrades(userId, authToken),
      ]);
      if (cancelled) return;
      const comradesList = new Set(comrades.map((c) => c.comrade_id));
      const list: any[] = board?.leaderboard ?? [];
      setRows(list.map((item) => comradeWithStatsFromChannelMember(item, comradesList)).sort((a, b) => a.rank - b.rank));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChannelId, authToken, userId]);

  if (channels.length === 0 && !loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Join or create a channel to see its leaderboard.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {channels.length > 0 && (
        <View style={styles.pickerWrap}>
          <Picker selectedValue={activeChannelId} onValueChange={(v) => setActiveChannelId(v)} style={{ color: 'white' }}>
            {channels.map((c) => (
              <Picker.Item key={c.id} label={c.name} value={c.id} />
            ))}
          </Picker>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No leaderboard data yet.</Text>
      ) : (
        rows.map((row, i) => (
          <View key={row.id} style={[styles.row, row.id === userId && styles.rowMe]}>
            <Text style={styles.medal}>{MEDAL[i] ?? `#${row.rank || i + 1}`}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.username}>{row.username}</Text>
              <Text style={styles.sub}>
                {row.correctVotes}/{row.totalVotes} correct · {row.accuracyPercentage.toFixed(0)}% accuracy
              </Text>
            </View>
            <Text style={styles.points}>{row.totalPoints} pts</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 24 },
  pickerWrap: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  rowMe: { borderColor: 'rgba(16,185,129,0.5)', backgroundColor: 'rgba(16,185,129,0.1)' },
  medal: { width: 32, textAlign: 'center', fontWeight: '700', color: colors.textMuted },
  username: { color: 'white', fontSize: 13, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 11 },
  points: { color: colors.green, fontWeight: '700', fontSize: 13 },
});
