// Web port of RN src/modals/match/statsTab.tsx.

import type { MatchStatistics } from '@funspot/core/src/types/matchDetails';

interface StatItem { label: string; home: number; away: number; suffix: string }

function StatRow({ stat }: { stat: StatItem }) {
  const total = stat.home + stat.away;
  const homePercent = total > 0 ? stat.home / total : 0.5;
  const homeFlex = Math.max(Math.round(homePercent * 100), 1);
  const awayFlex = Math.max(100 - homeFlex, 1);
  return (
    <div className="mb-4">
      <div className="flex items-center">
        <span className={`w-12 text-right font-condensed text-fan-statValue ${stat.home > stat.away ? 'text-fan-primary' : 'text-fan-textSecondary'}`}>{stat.home}{stat.suffix}</span>
        <span className="flex-1 text-center text-fan-caption text-fan-textTertiary">{stat.label}</span>
        <span className={`w-12 font-condensed text-fan-statValue ${stat.away > stat.home ? 'text-fan-away' : 'text-fan-textSecondary'}`}>{stat.away}{stat.suffix}</span>
      </div>
      <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        <span className="bg-fan-primary" style={{ flex: homeFlex }} />
        <span className="bg-fan-away" style={{ flex: awayFlex }} />
      </div>
    </div>
  );
}

export function StatsTab({ homeTeam, awayTeam, statistics }: { homeTeam: string; awayTeam: string; statistics: MatchStatistics | null }) {
  if (!statistics) return null;
  const items: StatItem[] = [
    { label: 'Possession', home: statistics.ballPossessionHome, away: statistics.ballPossessionAway, suffix: '%' },
    { label: 'Total Shots', home: statistics.totalShotsHome, away: statistics.totalShotsAway, suffix: '' },
    { label: 'Shots on Target', home: statistics.shotsOnTargetHome, away: statistics.shotsOnTargetAway, suffix: '' },
    { label: 'Pass Accuracy', home: statistics.passAccuracyHome, away: statistics.passAccuracyAway, suffix: '%' },
    { label: 'Corners', home: statistics.cornersHome, away: statistics.cornersAway, suffix: '' },
    { label: 'Fouls', home: statistics.foulsHome, away: statistics.foulsAway, suffix: '' },
    { label: 'Yellow Cards', home: statistics.yellowCardsHome, away: statistics.yellowCardsAway, suffix: '' },
  ];
  return (
    <div className="p-4">
      <div className="mb-4 flex gap-4">
        <span className="flex-1 text-center text-fan-title text-fan-primary">{homeTeam}</span>
        <span className="flex-1 text-center text-fan-title text-fan-away">{awayTeam}</span>
      </div>
      {items.map((s) => <StatRow key={s.label} stat={s} />)}
    </div>
  );
}
