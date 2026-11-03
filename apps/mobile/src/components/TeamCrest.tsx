import { Image, StyleSheet, Text, View } from 'react-native';
import { build365ScoresCompetitorImageUrl } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

type Props = { name: string; fixture: Record<string, unknown>; side: 'home' | 'away'; size?: number };

export function TeamCrest({ name, fixture, side, size = 24 }: Props) {
  const colors = useFanColors();
  const imageField = side === 'home' ? 'homeTeamImageUrl' : 'awayTeamImageUrl';
  const idField = side === 'home' ? 'homeCompetitorId' : 'awayCompetitorId';
  const snakeIdField = side === 'home' ? 'home_competitor_id' : 'away_competitor_id';
  const supplied = fixture[imageField];
  const rawId = fixture[idField] ?? fixture[snakeIdField];
  const competitorId = typeof rawId === 'number' || typeof rawId === 'string' ? rawId : null;
  const source = typeof supplied === 'string' && supplied.startsWith('https://imagecache.365scores.com/')
    ? supplied
    : build365ScoresCompetitorImageUrl(competitorId);

  return <View accessibilityLabel={name + ' crest'}
    style={[styles.circle, { width: size, height: size, borderRadius: size / 2,
      borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}>
    {source
      ? <Image source={{ uri: source }} resizeMode="contain"
          style={{ width: '100%', height: '100%', padding: 2 }} />
      : <Text style={[fanText('tag', colors, colors.primary),
            { fontSize: Math.max(9, size * .42), fontWeight: '800' }]}>
            {name.trim().charAt(0).toUpperCase() || '?'}
          </Text>}
  </View>;
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, flexShrink: 0 },
});
