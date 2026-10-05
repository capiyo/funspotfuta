import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  castVote,
  createBetWithVoteId,
  getAllFixtures,
  getChannelBettors,
  getOpenBets,
  getSubFixtures,
  getUserChannels,
  hasScores,
  scoreDisplay,
  submitSubFixtureVote,
  type Bet,
  type Fixture,
  type SubFixture,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { FAN_RADIUS, FAN_SPACING, type FanColorPalette } from '@funspot/core';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Selection = 'home_team' | 'draw' | 'away_team';

export default function FixtureDetailScreen() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const matchId = String(route.params?.matchId ?? '');
  const { userId, username, authToken } = useAuth();

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [subFixtures, setSubFixtures] = useState<SubFixture[]>([]);
  const [openBets, setOpenBets] = useState<Bet[]>([]);
  const [matchedBets, setMatchedBets] = useState<Bet[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [amount, setAmount] = useState('50');
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [votedSubFixtures, setVotedSubFixtures] = useState<Set<string>>(new Set());

  async function reloadBets(cid: string, fid: string) {
    const [open, matched] = await Promise.all([
      getOpenBets(cid, fid, authToken ?? undefined),
      getChannelBettors(cid, fid, authToken ?? undefined),
    ]);
    setOpenBets(open);
    setMatchedBets(matched);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [fixtures, channels] = await Promise.all([
        getAllFixtures(),
        userId && authToken ? getUserChannels(userId, authToken) : Promise.resolve([]),
      ]);
      const found = fixtures.find((f) => f.id === matchId || f.matchId === matchId) ?? null;
      if (cancelled) return;
      setFixture(found);
      const cid = channels[0]?.channelId ?? null;
      setChannelId(cid);
      if (found) {
        const fid = found.matchId || found.id;
        setSubFixtures(await getSubFixtures(fid));
        if (cid) await reloadBets(cid, fid);
      }
      if (!cancelled) setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [matchId, userId, authToken]);

  async function vote(next: Selection) {
    if (!fixture || !channelId || !userId || !authToken) return;
    setSelection(next);
    setVoting(true);
    try {
      const ok = await castVote({
        channelId,
        fixtureId: fixture.matchId || fixture.id,
        userId,
        selection: next,
        authToken,
      });
      if (!ok) setSelection(null);
    } finally {
      setVoting(false);
    }
  }

  async function pledge() {
    if (!fixture || !channelId || !userId || !username || !selection) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setPlacing(true);
    try {
      const result = await createBetWithVoteId({
        fixtureId: fixture.matchId || fixture.id,
        starterId: userId,
        starterName: username,
        starterSelection: selection,
        amount: value,
        channelId,
        voteId: '',
        authToken: authToken ?? undefined,
      });
      if (result?.success !== false) await reloadBets(channelId, fixture.matchId || fixture.id);
    } finally {
      setPlacing(false);
    }
  }

  async function voteSubFixture(sf: SubFixture, choice: 'a' | 'b') {
    if (!userId || !username || !fixture) return;
    await submitSubFixtureVote({
      voterId: userId,
      username,
      subFixtureId: sf.id,
      parentFixtureId: fixture.matchId || fixture.id,
      selection: choice,
    });
    setVotedSubFixtures((prev) => new Set(prev).add(sf.id));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={fanText('body', colors, colors.textTertiary)}>Loading fixture…</Text>
      </View>
    );
  }

  if (!fixture) {
    return (
      <View style={styles.center}>
        <Text style={fanText('headline', colors, colors.textPrimary)}>Fixture not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.primaryButton}>
          <Text style={fanText('button', colors, colors.textInverse)}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={fanText('body', colors, colors.textSecondary)}>← Back</Text>
      </Pressable>

      <Text style={fanText('caption', colors, colors.textTertiary)}>{fixture.league}</Text>
      <View style={styles.hero}>
        <Text style={fanText('title', colors, colors.textPrimary)}>{fixture.homeTeam}</Text>
        <Text style={fanText('headline', colors, colors.textPrimary)}>
          {hasScores(fixture) ? scoreDisplay(fixture) : 'vs'}
        </Text>
        <Text style={fanText('title', colors, colors.textPrimary)}>{fixture.awayTeam}</Text>
      </View>

      <Text style={fanText('tag', colors, colors.textTertiary)}>Vote</Text>
      {!channelId ? (
        <Text style={fanText('body', colors, colors.textTertiary)}>Join a channel to vote on this fixture.</Text>
      ) : (
        <View style={styles.options}>
          {([
            ['home_team', fixture.homeTeam],
            ['draw', 'Draw'],
            ['away_team', fixture.awayTeam],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              disabled={voting}
              onPress={() => void vote(value)}
              style={[styles.option, selection === value && styles.selected]}
            >
              <Text style={fanText('caption', colors, colors.textSecondary)}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {selection && (
        <View style={styles.section}>
          <Text style={fanText('tag', colors, colors.textTertiary)}>Back your vote</Text>
          <View style={styles.pledgeRow}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={styles.input}
              placeholder="Amount"
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable disabled={placing} onPress={() => void pledge()} style={styles.primaryButton}>
              <Text style={fanText('button', colors, colors.textInverse)}>
                {placing ? 'Placing…' : 'Pledge'}
              </Text>
            </Pressable>
          </View>
          <Text style={fanText('caption', colors, colors.textTertiary)}>
            {openBets.length} open bets · {matchedBets.length} matched
          </Text>
        </View>
      )}

      {subFixtures.length > 0 && (
        <View style={styles.section}>
          <Text style={fanText('tag', colors, colors.textTertiary)}>Prop Markets</Text>
          {subFixtures.map((sf) => {
            const voted = votedSubFixtures.has(sf.id);
            return (
              <View key={sf.id} style={styles.market}>
                <Text style={fanText('body', colors, colors.textPrimary)}>{sf.question}</Text>
                {voted ? (
                  <Text style={fanText('caption', colors, colors.primary)}>✓ Vote recorded</Text>
                ) : (
                  <View style={styles.options}>
                    <Pressable onPress={() => void voteSubFixture(sf, 'a')} style={styles.option}>
                      <Text style={fanText('caption', colors, colors.textSecondary)}>{sf.optionA}</Text>
                    </Pressable>
                    <Pressable onPress={() => void voteSubFixture(sf, 'b')} style={styles.option}>
                      <Text style={fanText('caption', colors, colors.textSecondary)}>{sf.optionB}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: FAN_SPACING.lg, gap: FAN_SPACING.lg, paddingBottom: FAN_SPACING.xxl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: FAN_SPACING.md, backgroundColor: colors.background },
    hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: FAN_SPACING.sm },
    section: { gap: FAN_SPACING.sm },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: FAN_SPACING.sm },
    option: { flexGrow: 1, minWidth: 90, padding: FAN_SPACING.md, borderRadius: FAN_RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    selected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
    market: { gap: FAN_SPACING.sm, padding: FAN_SPACING.md, borderRadius: FAN_RADIUS.md, backgroundColor: colors.surface },
    pledgeRow: { flexDirection: 'row', gap: FAN_SPACING.sm },
    input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: FAN_RADIUS.md, paddingHorizontal: FAN_SPACING.md, color: colors.textPrimary, backgroundColor: colors.surface },
    primaryButton: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: FAN_RADIUS.pill, paddingHorizontal: FAN_SPACING.lg, paddingVertical: FAN_SPACING.sm },
  });
}
