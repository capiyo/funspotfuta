import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { fetchHistoryGames, HistoryGame, historyResultDisplay, historyScoreDisplay } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { useHomeList } from './home/home-context';

export default function HistoryScreen() {
  const colors = useFanColors();
  const { scrollProps, topInset } = useHomeList();
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchHistoryGames({ limit: 50 })
      .then((data) => { if (mounted) setGames(data); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={games}
        keyExtractor={(item) => item.matchId || item.id}
        {...scrollProps}
        contentContainerStyle={[styles.content, { paddingTop: topInset + 12, paddingBottom: 120 }]}
        ListEmptyComponent={
          loading
            ? <Text style={{ color: colors.textTertiary }}>Loading history…</Text>
            : <Text style={{ color: colors.textTertiary }}>No history yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.main}>
              <Text style={[styles.league, { color: colors.textTertiary }]}>{item.league}</Text>
              <Text style={[styles.teams, { color: colors.textPrimary }]}>{item.homeTeam} vs {item.awayTeam}</Text>
              <Text style={[styles.result, { color: colors.textSecondary }]}>{historyResultDisplay(item)}</Text>
            </View>
            <Text style={[styles.score, { color: colors.textPrimary }]}>{historyScoreDisplay(item)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, gap: 4 },
  league: { fontSize: 10, textTransform: 'uppercase' },
  teams: { fontSize: 15, fontWeight: '700' },
  result: { fontSize: 12 },
  score: { fontSize: 18, fontWeight: '800', marginLeft: 12 },
});
