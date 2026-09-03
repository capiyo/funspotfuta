// RN port of funspot-next/app/(app)/trending/page.tsx.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { getTrendingSubFixtures, submitSubFixtureVote } from '@funspot/core';
import { colors } from '@/theme';

interface TrendingItem {
  sub_fixture_id?: string;
  id?: string;
  question?: string;
  option_a?: string;
  option_b?: string;
  optionA?: string;
  optionB?: string;
  parent_fixture_id?: string;
  parentFixtureId?: string;
  total_votes?: number;
  [key: string]: any;
}

export default function TrendingScreen() {
  const { userId, username } = useAuth();
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voting, setVoting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setItems(await getTrendingSubFixtures(20));
      setLoading(false);
    })();
  }, []);

  async function handleVote(item: TrendingItem, selection: 'a' | 'b') {
    if (!userId || !username) return;
    const id = item.sub_fixture_id ?? item.id ?? '';
    setVoting(id);
    try {
      await submitSubFixtureVote({
        voterId: userId,
        username,
        subFixtureId: id,
        parentFixtureId: item.parent_fixture_id ?? item.parentFixtureId ?? '',
        selection,
      });
      setVotedIds((prev) => new Set(prev).add(id));
    } finally {
      setVoting(null);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🔥 Trending Markets</Text>
      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No trending markets right now.</Text>
      ) : (
        items.map((item, i) => {
          const id = item.sub_fixture_id ?? item.id ?? String(i);
          const voted = votedIds.has(id);
          return (
            <View key={id} style={styles.card}>
              <Text style={styles.question}>{item.question ?? 'Untitled market'}</Text>
              <Text style={styles.votes}>{item.total_votes ?? 0} votes</Text>
              {voted ? (
                <Text style={styles.voted}>✓ Vote recorded</Text>
              ) : (
                <View style={styles.row}>
                  <Pressable disabled={voting === id} style={styles.optionButton} onPress={() => handleVote(item, 'a')}>
                    <Text style={styles.optionText}>{item.option_a ?? item.optionA ?? 'Option A'}</Text>
                  </Pressable>
                  <Pressable disabled={voting === id} style={styles.optionButton} onPress={() => handleVote(item, 'b')}>
                    <Text style={styles.optionText}>{item.option_b ?? item.optionB ?? 'Option B'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, marginBottom: 10 },
  question: { color: 'white', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  votes: { color: colors.textMuted, fontSize: 11, marginBottom: 10 },
  voted: { color: colors.green, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  optionButton: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 8, alignItems: 'center' },
  optionText: { color: '#d1d5db', fontSize: 11, fontWeight: '600' },
});
