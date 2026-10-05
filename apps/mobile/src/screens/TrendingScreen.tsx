import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { getTrendingSubFixtures, submitSubFixtureVote } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { FAN_RADIUS, FAN_SPACING, type FanColorPalette } from '@funspot/core';

type TrendingItem = {
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
};

export default function TrendingScreen() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userId, username } = useAuth();
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voting, setVoting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await getTrendingSubFixtures(20);
      if (!cancelled) {
        setItems(data as TrendingItem[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function vote(item: TrendingItem, selection: 'a' | 'b') {
    if (!userId || !username) return;
    const id = item.sub_fixture_id ?? item.id ?? '';
    if (!id) return;
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
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => item.sub_fixture_id ?? item.id ?? String(index)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Text style={fanText('headline', colors, colors.textPrimary)}>
            🔥 Trending Markets
          </Text>
        }
        ListEmptyComponent={
          loading ? (
            <Text style={fanText('body', colors, colors.textTertiary)}>Loading…</Text>
          ) : (
            <Text style={fanText('body', colors, colors.textTertiary)}>
              No trending markets right now.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const id = item.sub_fixture_id ?? item.id ?? '';
          const voted = votedIds.has(id);
          return (
            <View style={styles.card}>
              <Text style={fanText('body', colors, colors.textPrimary)}>
                {item.question ?? 'Untitled market'}
              </Text>
              <Text style={fanText('caption', colors, colors.textTertiary)}>
                {item.total_votes ?? 0} votes
              </Text>
              {voted ? (
                <Text style={fanText('caption', colors, colors.primary)}>✓ Vote recorded</Text>
              ) : (
                <View style={styles.options}>
                  <Pressable
                    disabled={voting === id}
                    onPress={() => void vote(item, 'a')}
                    style={styles.option}
                  >
                    <Text style={fanText('caption', colors, colors.textSecondary)}>
                      {item.option_a ?? item.optionA ?? 'Option A'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={voting === id}
                    onPress={() => void vote(item, 'b')}
                    style={styles.option}
                  >
                    <Text style={fanText('caption', colors, colors.textSecondary)}>
                      {item.option_b ?? item.optionB ?? 'Option B'}
                    </Text>
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

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: FAN_SPACING.lg, gap: FAN_SPACING.md },
    card: {
      gap: FAN_SPACING.sm,
      padding: FAN_SPACING.lg,
      borderRadius: FAN_RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    options: { flexDirection: 'row', gap: FAN_SPACING.sm },
    option: {
      flex: 1,
      padding: FAN_SPACING.md,
      borderRadius: FAN_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSunken,
    },
  });
}
