import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { normalizeTeamCrestName, resolveTeamCrest } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { MOBILE_TEAM_CRESTS } from './team-crest-catalog.generated';

type Props = { name: string; fixture: Record<string, unknown>; side: 'home' | 'away'; size?: number };

function direct(fixture: Record<string, unknown>, side: 'home' | 'away'): string | null {
  const capitalized = side === 'home' ? 'Home' : 'Away';
  for (const key of [side + 'Logo', side + 'TeamLogo', side + 'LogoUrl', side + 'TeamLogoUrl',
    side + '_logo', side + '_team_logo', side + '_logo_url', side + '_team_logo_url',
    side + 'Crest', side + 'TeamCrest', side + 'CrestUrl', side + 'TeamCrestUrl',
    side + 'Badge', side + 'TeamBadge', capitalized + 'TeamLogo']) {
    const value = fixture[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function TeamCrest({ name, fixture, side, size = 24 }: Props) {
  const colors = useFanColors();
  const supplied = direct(fixture, side);
  const local = MOBILE_TEAM_CRESTS[normalizeTeamCrestName(name)] ?? null;
  const [failed, setFailed] = useState(false);
  const [useSupplied, setUseSupplied] = useState(false);
  const [remote, setRemote] = useState<string | null>(null);
  const imageSource = local && !useSupplied ? local
    : supplied ? { uri: supplied }
    : remote ? { uri: remote }
    : null;

  useEffect(() => {
    let active = true;
    setFailed(false);
    setUseSupplied(false);
    setRemote(null);
    if (!local && !supplied) {
      void resolveTeamCrest(name, 'https://funspot.co.ke/.netlify/functions/team-crest').then((url) => {
        if (active) setRemote(url);
      });
    }
    return () => { active = false; };
  }, [name, supplied, local]);

  return <View accessibilityLabel={name + ' crest'}
    style={[styles.circle, { width: size, height: size, borderRadius: size / 2,
      borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}>
    {imageSource && !failed
      ? <Image source={imageSource} resizeMode="contain" onError={() => {
          if (local && !useSupplied && supplied) setUseSupplied(true);
          else setFailed(true);
        }} style={{ width: '100%', height: '100%', padding: 2 }} />
      : <Text style={[fanText('tag', colors, colors.primary),
            { fontSize: Math.max(9, size * .42), fontWeight: '800' }]}>
            {name.trim().charAt(0).toUpperCase() || '?'}
          </Text>}
  </View>;
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, flexShrink: 0 },
});
