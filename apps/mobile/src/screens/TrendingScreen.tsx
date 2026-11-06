import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getTrendingSubFixtures, submitSubFixtureVote } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';

type TrendingItem = {
  id?: string;
  sub_fixture_id?: string;
  parent_fixture_id?: string;
  question?: string;
  option_a?: string;
  option_b?: string;
  optionA?: string;
  optionB?: string;
  total_votes?: number;
};

export default function TrendingScreen() {
  const colors = useFanColors();
  const { userId, username } = useAuth();
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getTrendingSubFixtures(20)
      .then((data) => { if (mounted) setItems(data as TrendingItem[]); })
      .catch(() => { if (mounted) setItems([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function vote(item: TrendingItem, selection: 'a' | 'b') {
    const id = item.sub_fixture_id ?? item.id ?? '';
    if (!id || !userId || !username) return;
    await submitSubFixtureVote({
      voterId: userId,
      username,
      subFixtureId: id,
      parentFixtureId: item.parent_fixture_id ?? '',
      selection,
    });
    setVoted((prev) => new Set(prev).add(id));
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => item.sub_fixture_id ?? item.id ?? String(index)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={[styles.title, { color: colors.textPrimary }]}>🔥 Trending Markets</Text>}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.textTertiary }}>No trending markets right now.</Text>}
        renderItem={({ item }) => {
          const id = item.sub_fixture_id ?? item.id ?? '';
          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.question, { color: colors.textPrimary }]}>{item.question ?? 'Untitled market'}</Text>
              <Text style={[styles.meta, { color: colors.textTertiary }]}>{item.total_votes ?? 0} votes</Text>
              {voted.has(id) ? (
                <Text style={{ color: colors.primary }}>✓ Vote recorded</Text>
              ) : (
                <View style={styles.options}>
                  <Pressable onPress={() => void vote(item, 'a')} style={[styles.option, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.textSecondary }}>{item.option_a ?? item.optionA ?? 'Option A'}</Text>
                  </Pressable>
                  <Pressable onPress={() => void vote(item, 'b')} style={[styles.option, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.textSecondary }}>{item.option_b ?? item.optionB ?? 'Option B'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  question: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  meta: { fontSize: 12, marginBottom: 12 },
  options: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
});
