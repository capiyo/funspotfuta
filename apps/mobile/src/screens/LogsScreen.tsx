// RN "Logs" tab — History/Live sub-tabs (matching screenshot), Results/
// Chat links per history item, real data throughout.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  fetchHistoryGames,
  getAllFixtures,
  historyResultDisplay,
  historyResultOutcome,
  historyScoreDisplay,
  scoreDisplay,
  sourceIcon,
  sourceLabel,
  HistoryGame,
  Fixture,
  outcomeColor,
  FanColorPalette,
  FAN_SPACING,
  FAN_RADIUS,
} from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { AppHeader } from '@/components/AppHeader';
import { fanText } from '@/theme/use-fan-typography';

const PAGE_SIZE = 20;

export default function LogsScreen() {
  const colors = useFanColors();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();

  const [tab, setTab] = useState<'history' | 'live'>('history');
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [liveFixtures, setLiveFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function loadHistory(skip: number, replace: boolean) {
    const page = await fetchHistoryGames({ limit: PAGE_SIZE, skip });
    setHasMore(page.length === PAGE_SIZE);
    setGames((prev) => (replace ? page : [...prev, ...page]));
  }

  useEffect(() => {
    setLoading(true);
    if (tab === 'history') {
      loadHistory(0, true).finally(() => setLoading(false));
    } else {
      getAllFixtures()
        .then((f) => setLiveFixtures(f.filter((x) => x.isLive || x.status === 'live')))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader />
      <View style={styles.tabRow}>
        <Pressable onPress={() => setTab('history')}>
          <Text style={fanText('body', colors, tab === 'history' ? colors.textPrimary : colors.textTertiary)}>
            History {games.length > 0 ? games.length : ''}
          </Text>
        </Pressable>
        <Pressable onPress={() => setTab('live')}>
          <Text style={fanText('body', colors, tab === 'live' ? colors.textPrimary : colors.textTertiary)}>
            Live {liveFixtures.length > 0 ? liveFixtures.length : ''}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: FAN_SPACING.xxxl }} />
        ) : tab === 'history' ? (
          games.length === 0 ? (
            <Text style={[fanText('body', colors), styles.empty]}>No history found.</Text>
          ) : (
            <>
              {games.map((g) => (
                <View key={g.id} style={styles.card}>
                  <View style={styles.metaRow}>
                    <Text style={fanText('caption', colors)}>
                      {sourceIcon(g)} {sourceLabel(g)} · {g.league}
                    </Text>
                    <Text style={fanText('caption', colors)}>{g.date}</Text>
                  </View>
                  <View style={styles.scoreRow}>
                    <Text style={[fanText('title', colors), { flex: 1 }]} numberOfLines={1}>
                      {g.homeTeam}
                    </Text>
                    <Text style={[fanText('scoreDash', colors, outcomeColor(historyResultOutcome(g), colors)), styles.score]}>
                      {historyScoreDisplay(g)}
                    </Text>
                    <Text style={[fanText('title', colors), { flex: 1, textAlign: 'right' }]} numberOfLines={1}>
                      {g.awayTeam}
                    </Text>
                  </View>
                  <Text style={[fanText('caption', colors), { textAlign: 'center', marginBottom: FAN_SPACING.sm }]}>
                    {historyResultDisplay(g)}
                  </Text>
                  <View style={styles.linkRow}>
                    <Pressable onPress={() => navigation.navigate('FixtureDetail', { matchId: g.matchId })}>
                      <Text style={fanText('caption', colors, colors.primary)}>Results</Text>
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate('Chat', {})}>
                      <Text style={fanText('caption', colors, colors.primary)}>Chat</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {hasMore && (
                <Pressable
                  style={styles.loadMore}
                  disabled={loadingMore}
                  onPress={async () => {
                    setLoadingMore(true);
                    await loadHistory(games.length, false);
                    setLoadingMore(false);
                  }}
                >
                  <Text style={fanText('title', colors, colors.textSecondary)}>{loadingMore ? 'Loading…' : 'Load more'}</Text>
                </Pressable>
              )}
            </>
          )
        ) : liveFixtures.length === 0 ? (
          <Text style={[fanText('body', colors), styles.empty]}>No live matches right now.</Text>
        ) : (
          liveFixtures.map((f) => (
            <View key={f.id} style={styles.card}>
              <View style={styles.metaRow}>
                <Text style={fanText('caption', colors)}>{f.league}</Text>
                <Text style={fanText('caption', colors, colors.away)}>🔴 LIVE</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={[fanText('title', colors), { flex: 1 }]} numberOfLines={1}>
                  {f.homeTeam}
                </Text>
                <Text style={[fanText('scoreDash', colors), styles.score]}>{scoreDisplay(f) || 'vs'}</Text>
                <Text style={[fanText('title', colors), { flex: 1, textAlign: 'right' }]} numberOfLines={1}>
                  {f.awayTeam}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: FAN_SPACING.lg, paddingBottom: FAN_SPACING.xxxl },
    tabRow: { flexDirection: 'row', gap: FAN_SPACING.lg, paddingHorizontal: FAN_SPACING.lg, paddingBottom: FAN_SPACING.sm },
    empty: { textAlign: 'center', marginTop: FAN_SPACING.xxxl },
    card: {
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingVertical: FAN_SPACING.base,
    },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: FAN_SPACING.sm },
    scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: FAN_SPACING.xs },
    score: { marginHorizontal: FAN_SPACING.md },
    linkRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: FAN_SPACING.base },
    loadMore: {
      borderRadius: FAN_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSunken,
      paddingVertical: FAN_SPACING.base,
      alignItems: 'center',
      marginTop: FAN_SPACING.md,
    },
  });
}
