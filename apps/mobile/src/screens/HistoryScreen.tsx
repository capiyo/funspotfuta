// RN port of funspot-next/app/(app)/history/page.tsx.

import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import {
  fetchHistoryGames,
  historyResultDisplay,
  historyResultColorHex,
  historyScoreDisplay,
  sourceIcon,
  sourceLabel,
  HistoryGame,
} from '@funspot/core';
import { colors } from '@/theme';

const PAGE_SIZE = 20;

export default function HistoryScreen() {
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [league, setLeague] = useState('');

  async function loadPage(skip: number, replace: boolean) {
    const page = await fetchHistoryGames({ limit: PAGE_SIZE, skip, league: league || undefined });
    setHasMore(page.length === PAGE_SIZE);
    setGames((prev) => (replace ? page : [...prev, ...page]));
  }

  useEffect(() => {
    setLoading(true);
    loadPage(0, true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TextInput
        value={league}
        onChangeText={setLeague}
        placeholder="Filter by league…"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      ) : games.length === 0 ? (
        <Text style={styles.empty}>No history found.</Text>
      ) : (
        <>
          {games.map((g) => (
            <View key={g.id} style={styles.card}>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {sourceIcon(g)} {sourceLabel(g)} · {g.league}
                </Text>
                <Text style={styles.meta}>{g.date}</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.team} numberOfLines={1}>{g.homeTeam}</Text>
                <Text style={[styles.score, { color: historyResultColorHex(g) }]}>{historyScoreDisplay(g)}</Text>
                <Text style={[styles.team, { textAlign: 'right' }]} numberOfLines={1}>{g.awayTeam}</Text>
              </View>
              <Text style={styles.result}>{historyResultDisplay(g)}</Text>
            </View>
          ))}
          {hasMore && (
            <Pressable
              style={styles.loadMore}
              disabled={loadingMore}
              onPress={async () => {
                setLoadingMore(true);
                await loadPage(games.length, false);
                setLoadingMore(false);
              }}
            >
              <Text style={{ color: '#d1d5db' }}>{loadingMore ? 'Loading…' : 'Load more'}</Text>
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
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, color: 'white', marginBottom: 16 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48 },
  card: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  meta: { color: colors.textMuted, fontSize: 11 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  team: { flex: 1, color: 'white', fontSize: 13 },
  score: { fontSize: 14, fontWeight: '800', marginHorizontal: 8 },
  result: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  loadMore: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 12, alignItems: 'center', marginTop: 8 },
});
