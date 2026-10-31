import { useEffect, useState } from 'react';
import { resolveTeamCrest } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

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
    void resolveTeamCrest(name, '/.netlify/functions/team-crest', country).then((url) => {
      if (active) setSource(url);
    });
    return () => { active = false; };
  }, [name, country]);

  return <span className="match-card-team-logo" role="img" aria-label={name + ' crest'} title={name}
    style={{ display: 'inline-flex', flex: '0 0 ' + size + 'px', width: size, height: size,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '50%',
      border: '1px solid ' + colors.border, background: colors.surfaceSunken, boxSizing: 'border-box' }}>
    {source && !failed
      ? <img className="match-card-team-logo-image" src={source} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, boxSizing: 'border-box' }} />
      : <span className="match-card-team-fallback" aria-hidden="true" style={{ color: colors.primary, fontSize: Math.max(9, size * .42), fontWeight: 800 }}>
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>}
  </span>;
}
