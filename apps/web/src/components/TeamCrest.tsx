import { build365ScoresCompetitorImageUrl } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

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

  return <span className="match-card-team-logo" role="img" aria-label={name + ' crest'} title={name}
    style={{ display: 'inline-flex', flex: '0 0 ' + size + 'px', width: size, height: size,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '50%',
      border: '1px solid ' + colors.border, background: colors.surfaceSunken, boxSizing: 'border-box' }}>
    {source
      ? <img className="match-card-team-logo-image" src={source} alt="" loading="lazy" decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, boxSizing: 'border-box' }} />
      : <span className="match-card-team-fallback" aria-hidden="true" style={{ color: colors.primary, fontSize: Math.max(9, size * .42), fontWeight: 800 }}>
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>}
  </span>;
}
