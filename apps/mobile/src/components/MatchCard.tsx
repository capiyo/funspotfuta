// RN port of the same component as funspot-next/components/MatchCard.tsx
// (itself ported from lib/widgets/match_card.dart) — identical badge/vote
// logic, native View/Pressable instead of web divs/buttons.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Fixture,
  scoreDisplay,
  hasScores,
  winnerColorHex,
  winner as fixtureWinner,
  castVote,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { colors } from '@/theme';
import { RootStackParamList } from '@/navigation/RootNavigator';

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / 36e5;

    if (diffHours <= 2 && diffHours >= -2) return 'LIVE';
    if (date.getTime() > now.getTime()) return `In ${Math.round(diffHours)}h`;
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return 'TBD';
  }
}

export function MatchCard({ fixture, channelId }: { fixture: Fixture; channelId?: string }) {
  const { userId, authToken, isLoggedIn } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selection, setSelection] = useState<'home_team' | 'draw' | 'away_team' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badge = formatDate(fixture.date);
  const isLive = badge === 'LIVE';
  const totalOdds = fixture.homeWin + fixture.draw + fixture.awayWin || 1;
  const pct = (v: number) => Math.round((v / totalOdds) * 100);

  async function handleVote(sel: 'home_team' | 'draw' | 'away_team') {
    setError(null);
    if (!isLoggedIn || !userId || !authToken) {
      setError('Log in to vote');
      return;
    }
    if (!channelId) {
      setError('Select a channel to vote in');
      return;
    }
    setSelection(sel);
    setSubmitting(true);
    const ok = await castVote({ channelId, fixtureId: fixture.matchId || fixture.id, userId, selection: sel, authToken });
    setSubmitting(false);
    if (ok) setVoted(true);
    else setError('Vote failed — try again');
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.league}>{fixture.league || 'Unknown League'}</Text>
        <View style={[styles.badge, isLive && styles.badgeLive]}>
          <Text style={[styles.badgeText, isLive && styles.badgeTextLive]}>{badge}</Text>
        </View>
      </View>

      <View style={styles.teamsRow}>
        <Text style={styles.teamName} numberOfLines={1}>
          {fixture.homeTeam}
        </Text>
        {hasScores(fixture) ? (
          <Text style={[styles.score, { color: winnerColorHex(fixture) }]}>{scoreDisplay(fixture)}</Text>
        ) : (
          <Text style={styles.vs}>vs</Text>
        )}
        <Text style={[styles.teamName, { textAlign: 'right' }]} numberOfLines={1}>
          {fixture.awayTeam}
        </Text>
      </View>

      {fixture.status === 'completed' ? (
        <Text style={styles.winnerText}>Winner: {fixtureWinner(fixture)}</Text>
      ) : voted ? (
        <Text style={styles.votedText}>✓ Vote recorded</Text>
      ) : (
        <View style={styles.voteRow}>
          {(
            [
              ['home_team', 'Home', fixture.homeWin],
              ['draw', 'Draw', fixture.draw],
              ['away_team', 'Away', fixture.awayWin],
            ] as const
          ).map(([sel, label, odds]) => (
            <Pressable
              key={sel}
              disabled={submitting || !fixture.availableForVoting}
              onPress={() => handleVote(sel)}
              style={[styles.voteButton, selection === sel && styles.voteButtonActive]}
            >
              <Text style={[styles.voteLabel, selection === sel && styles.voteLabelActive]}>{label}</Text>
              <Text style={styles.votePct}>{pct(odds)}%</Text>
            </Pressable>
          ))}
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>{fixture.votes} votes</Text>
        <Text style={styles.footerText}>{fixture.date}</Text>
      </View>

      <Pressable onPress={() => navigation.navigate('FixtureDetail', { matchId: fixture.matchId || fixture.id })}>
        <Text style={styles.detailLink}>View markets & pledges →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  league: { color: colors.textMuted, fontSize: 11 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  badgeLive: { backgroundColor: 'rgba(239,68,68,0.2)' },
  badgeText: { color: '#d1d5db', fontSize: 10, fontWeight: '700' },
  badgeTextLive: { color: '#f87171' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  teamName: { flex: 1, color: 'white', fontSize: 13, fontWeight: '600' },
  score: { fontSize: 18, fontWeight: '800', marginHorizontal: 12 },
  vs: { color: colors.textMuted, fontSize: 13, marginHorizontal: 12 },
  winnerText: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
  votedText: { color: colors.green, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  voteRow: { flexDirection: 'row', gap: 8 },
  voteButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  voteButtonActive: { borderColor: colors.green, backgroundColor: 'rgba(16,185,129,0.2)' },
  voteLabel: { color: '#d1d5db', fontSize: 12, fontWeight: '600' },
  voteLabelActive: { color: colors.green },
  votePct: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  errorText: { color: '#f87171', fontSize: 11, textAlign: 'center', marginTop: 8 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  footerText: { color: colors.textMuted, fontSize: 11 },
  detailLink: { color: colors.green, fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});
