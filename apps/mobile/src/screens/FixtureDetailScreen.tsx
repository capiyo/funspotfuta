// RN port of funspot-next/app/(app)/fixture/[matchId]/page.tsx.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getAllFixtures,
  getUserChannels,
  castVote,
  postComment,
  Fixture,
  hasScores,
  scoreDisplay,
  SubFixture,
  getOpenBets,
  getChannelBettors,
  createBetWithVoteId,
  Bet,
  getSubFixtures,
  submitSubFixtureVote,
} from '@funspot/core';
import { useToast } from '@/lib/toast/toast-context';
import { colors } from '@/theme';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'FixtureDetail'>;

export default function FixtureDetailScreen() {
  const { params } = useRoute<Route>();
  const matchId = params.matchId;
  const { userId, username, authToken } = useAuth();
  const toast = useToast();

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [voteSelection, setVoteSelection] = useState<'home_team' | 'draw' | 'away_team' | null>(null);
  const [voted, setVoted] = useState(false);

  const [openBets, setOpenBets] = useState<Bet[]>([]);
  const [matchedBets, setMatchedBets] = useState<Bet[]>([]);
  const [pledgeAmount, setPledgeAmount] = useState('50');
  const [placingBet, setPlacingBet] = useState(false);

  const [subFixtures, setSubFixtures] = useState<SubFixture[]>([]);
  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [fixtures, channels] = await Promise.all([
        getAllFixtures(),
        userId && authToken ? getUserChannels(userId, authToken) : Promise.resolve([]),
      ]);
      const f = fixtures.find((fx) => fx.matchId === matchId || fx.id === matchId) ?? null;
      setFixture(f);
      const cid = channels[0]?.id ?? null;
      setChannelId(cid);
      if (f) {
        setSubFixtures(await getSubFixtures(f.matchId || f.id));
        if (cid) {
          const [open, matched] = await Promise.all([
            getOpenBets(cid, f.matchId || f.id, authToken ?? undefined),
            getChannelBettors(cid, f.matchId || f.id, authToken ?? undefined),
          ]);
          setOpenBets(open);
          setMatchedBets(matched);
        }
      }
      setLoading(false);
    })();
  }, [matchId, userId, authToken]);

  async function handleVote(sel: 'home_team' | 'draw' | 'away_team') {
    if (!fixture || !channelId || !userId || !authToken) return;
    setVoteSelection(sel);
    const ok = await castVote({ channelId, fixtureId: fixture.matchId || fixture.id, userId, selection: sel, authToken });
    if (ok) setVoted(true);
  }

  async function handlePlaceBet() {
    if (!fixture || !channelId || !userId || !username || !voteSelection) return;
    const amount = Number(pledgeAmount);
    if (!amount || amount <= 0) return;
    setPlacingBet(true);
    await createBetWithVoteId({
      fixtureId: fixture.matchId || fixture.id,
      starterId: userId,
      starterName: username,
      starterSelection: voteSelection,
      amount,
      channelId,
      voteId: '',
      authToken: authToken ?? undefined,
    });
    setPlacingBet(false);
    const [open, matched] = await Promise.all([
      getOpenBets(channelId, fixture.matchId || fixture.id, authToken ?? undefined),
      getChannelBettors(channelId, fixture.matchId || fixture.id, authToken ?? undefined),
    ]);
    setOpenBets(open);
    setMatchedBets(matched);
  }

  async function handlePostComment() {
    if (!fixture || !userId || !username || !comment.trim()) return;
    setPostingComment(true);
    const result = await postComment({
      userId,
      username,
      fixtureId: fixture.matchId || fixture.id,
      comment,
      selection: voteSelection ?? '',
      authToken: authToken ?? undefined,
    });
    setPostingComment(false);
    if (result.success) {
      setComment('');
      toast.showSuccess(result.message);
    } else {
      toast.showError(result.message);
    }
  }

  if (loading) return <ActivityIndicator color={colors.green} style={{ marginTop: 60 }} />;
  if (!fixture) return <Text style={styles.empty}>Fixture not found.</Text>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.league}>{fixture.league}</Text>
      <Text style={styles.title}>
        {fixture.homeTeam} vs {fixture.awayTeam}
      </Text>
      {hasScores(fixture) && <Text style={styles.score}>{scoreDisplay(fixture)}</Text>}

      <Text style={styles.sectionTitle}>Vote</Text>
      {voted ? (
        <Text style={styles.voted}>✓ Vote recorded — back it with a pledge below.</Text>
      ) : (
        <View style={styles.row}>
          {(
            [
              ['home_team', fixture.homeTeam],
              ['draw', 'Draw'],
              ['away_team', fixture.awayTeam],
            ] as const
          ).map(([sel, label]) => (
            <Pressable key={sel} onPress={() => handleVote(sel)} style={[styles.pill, voteSelection === sel && styles.pillActive]}>
              <Text style={[styles.pillText, voteSelection === sel && styles.pillTextActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {voteSelection && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Back your vote with a pledge</Text>
          <View style={styles.row}>
            <TextInput
              value={pledgeAmount}
              onChangeText={setPledgeAmount}
              keyboardType="number-pad"
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable style={styles.smallButton} disabled={placingBet} onPress={handlePlaceBet}>
              <Text style={styles.smallButtonText}>{placingBet ? 'Placing…' : 'Pledge'}</Text>
            </Pressable>
          </View>
          {openBets.map((b) => (
            <View key={b.id} style={styles.betRow}>
              <Text style={styles.betText}>{b.starterName}</Text>
              <Text style={styles.betText}>{b.starterAmount}</Text>
            </View>
          ))}
          {matchedBets.map((b) => (
            <View key={b.id} style={styles.betRow}>
              <Text style={styles.betText}>{b.starterName} vs {b.finisherName}</Text>
              <Text style={styles.betText}>{b.starterAmount + (b.finisherAmount ?? 0)}</Text>
            </View>
          ))}
        </View>
      )}

      {subFixtures.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Prop Markets</Text>
          {subFixtures.map((sf) => (
            <SubFixtureRow key={sf.id} sf={sf} userId={userId} username={username} matchId={fixture.matchId || fixture.id} />
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Comments</Text>
      <View style={styles.row}>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Say something…"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { flex: 1 }]}
        />
        <Pressable style={styles.smallButton} disabled={postingComment} onPress={handlePostComment}>
          <Text style={styles.smallButtonText}>Post</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SubFixtureRow({ sf, userId, username, matchId }: { sf: SubFixture; userId: string | null; username: string | null; matchId: string }) {
  const [voted, setVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  async function vote(selection: 'a' | 'b') {
    if (!userId || !username) return;
    setVoting(true);
    try {
      await submitSubFixtureVote({ voterId: userId, username, subFixtureId: sf.id, parentFixtureId: matchId, selection });
      setVoted(true);
    } finally {
      setVoting(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.propQuestion}>{sf.question}</Text>
      {voted ? (
        <Text style={styles.voted}>✓ Voted</Text>
      ) : (
        <View style={styles.row}>
          <Pressable disabled={voting} style={[styles.pill, { flex: 1 }]} onPress={() => vote('a')}>
            <Text style={styles.pillText}>{sf.optionA}</Text>
          </Pressable>
          <Pressable disabled={voting} style={[styles.pill, { flex: 1 }]} onPress={() => vote('b')}>
            <Text style={styles.pillText}>{sf.optionB}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48 },
  league: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginBottom: 4 },
  title: { color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  score: { color: 'white', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  sectionTitle: { color: '#d1d5db', fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pill: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 10, alignItems: 'center' },
  pillActive: { borderColor: colors.green, backgroundColor: 'rgba(16,185,129,0.2)' },
  pillText: { color: '#d1d5db', fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: colors.green },
  voted: { color: colors.green, fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: 'white' },
  smallButton: { backgroundColor: colors.green, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  smallButtonText: { color: '#000', fontWeight: '700', fontSize: 12 },
  betRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  betText: { color: '#d1d5db', fontSize: 11 },
  propQuestion: { color: 'white', fontSize: 12, fontWeight: '600', marginBottom: 8 },
});
