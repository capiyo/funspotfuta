import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getAllFixtures, Fixture, formattedDateTime, hasScores, scoreDisplay } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

export default function FixtureDetailScreen({ route }: any) {
  const colors = useFanColors();
  const matchId = route.params?.matchId as string;
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getAllFixtures()
      .then((fixtures) => {
        if (!mounted) return;
        setFixture(fixtures.find((f) => f.matchId === matchId || f.id === matchId) ?? null);
      })
      .catch(() => { if (mounted) setFixture(null); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [matchId]);

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!fixture) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.textPrimary }}>Fixture not found</Text></View>;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.league, { color: colors.textTertiary }]}>{fixture.league}</Text>
      <View style={styles.teams}>
        <Text style={[styles.team, { color: colors.textPrimary }]}>{fixture.homeTeam}</Text>
        <Text style={[styles.score, { color: colors.textPrimary }]}>{hasScores(fixture) ? scoreDisplay(fixture) : 'vs'}</Text>
        <Text style={[styles.team, { color: colors.textPrimary }]}>{fixture.awayTeam}</Text>
      </View>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>{formattedDateTime(fixture)}</Text>
      <Text style={[styles.meta, { color: colors.textTertiary }]}>{fixture.status}</Text>
      {fixture.subFixtures.length > 0 && (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Prop Markets</Text>
          {fixture.subFixtures.map((sub) => (
            <View key={sub.id} style={styles.market}>
              <Text style={{ color: colors.textPrimary }}>{sub.question}</Text>
              <Text style={{ color: colors.textSecondary }}>{sub.optionA} · {sub.optionB}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  league: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  teams: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  team: { flex: 1, fontSize: 20, fontWeight: '700' },
  score: { fontSize: 24, fontWeight: '800' },
  meta: { fontSize: 13 },
  section: { borderTopWidth: 1, paddingTop: 16, marginTop: 12 },
  heading: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  market: { paddingVertical: 10, gap: 4 },
});
