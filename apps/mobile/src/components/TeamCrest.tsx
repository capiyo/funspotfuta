import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { MOBILE_TEAM_CRESTS } from './team-crest-catalog.generated';

type Props = { name: string; fixture: Record<string, unknown>; side: 'home' | 'away'; size?: number };

function normalize(value: string): string {
  let normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const suffixes = [' football club', ' athletic club', ' association football club', ' fc', ' cf', ' sc', ' afc', ' ac', ' fk', ' sk', ' sv', ' ks', ' club', ' football'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (normalized.endsWith(suffix) && normalized.length > suffix.length + 1) {
        normalized = normalized.slice(0, -suffix.length).trim();
        changed = true;
        break;
      }
    }
  }
  return normalized;
}

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
  const local = MOBILE_TEAM_CRESTS[normalize(name)] ?? null;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [name, supplied, local]);

  return <View accessibilityLabel={name + ' crest'}
    style={[styles.circle, { width: size, height: size, borderRadius: size / 2,
      borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}>
    {local && !failed
      ? <Image source={local} resizeMode="contain" onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', padding: 2 }} />
      : supplied && !failed
        ? <Image source={{ uri: supplied }} resizeMode="contain" onError={() => setFailed(true)}
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
