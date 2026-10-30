import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { resolveTeamCrest } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

type Props = { name: string; fixture: Record<string, unknown>; side: 'home' | 'away'; size?: number };

function teamCountry(fixture: Record<string, unknown>, side: 'home' | 'away'): string | undefined {
  for (const key of [side + 'Country', side + 'TeamCountry', side + '_country', side + '_team_country']) {
    const value = fixture[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function TeamCrest({ name, fixture, side, size = 24 }: Props) {
  const colors = useFanColors();
  const country = teamCountry(fixture, side);
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSource(null);
    setFailed(false);
    void resolveTeamCrest(name, 'https://funspot.co.ke/.netlify/functions/team-crest', country).then((url) => {
      if (active) setSource(url);
    });
    return () => { active = false; };
  }, [name, country]);

  return <View accessibilityLabel={name + ' crest'}
    style={[styles.circle, { width: size, height: size, borderRadius: size / 2,
      borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}>
    {source && !failed
      ? <Image source={{ uri: source }} resizeMode="contain" onError={() => setFailed(true)}
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
