import { useEffect, useState } from 'react';
import { normalizeTeamCrestName, resolveTeamCrest } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { WEB_TEAM_CRESTS } from './team-crest-catalog.generated';

type Props = { name: string; fixture: Record<string, unknown>; side: 'home' | 'away'; size?: number };

function directCountry(fixture: Record<string, unknown>, side: 'home' | 'away'): string | undefined {\n  for (const key of [side + 'Country', side + 'TeamCountry', side + '_country', side + '_team_country']) {\n    const value = fixture[key];\n    if (typeof value === 'string' && value.trim()) return value.trim();\n  }\n  return undefined;\n}\n\nfunction direct(fixture: Record<string, unknown>, side: 'home' | 'away'): string | null {
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
  const supplied = direct(fixture, side);\n  const country = directCountry(fixture, side);
  const local = WEB_TEAM_CRESTS[normalizeTeamCrestName(name)] ?? null;
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState<string | null>(local ?? supplied);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSource(local ?? supplied);
    if (!local && !supplied) {
      void resolveTeamCrest(name, '/.netlify/functions/team-crest', country).then((url) => {
        if (active) setSource(url);
      });
    }
    return () => { active = false; };
  }, [name, local, supplied, country]);

  return <span className="match-card-team-logo" role="img" aria-label={name + ' crest'} title={name}
    style={{ display: 'inline-flex', flex: '0 0 ' + size + 'px', width: size, height: size,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '50%',
      border: '1px solid ' + colors.border, background: colors.surfaceSunken, boxSizing: 'border-box' }}>
    {source && !failed
      ? <img className="match-card-team-logo-image" src={source} alt="" loading="lazy" decoding="async" onError={() => {
          if (local && source === local && supplied && supplied !== local) setSource(supplied);
          else setFailed(true);
        }}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, boxSizing: 'border-box' }} />
      : <span className="match-card-team-fallback" aria-hidden="true" style={{ color: colors.primary, fontSize: Math.max(9, size * .42), fontWeight: 800 }}>
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>}
  </span>;
}
