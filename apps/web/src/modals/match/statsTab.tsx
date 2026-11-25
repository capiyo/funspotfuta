import { FAN_SPACING } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { MatchStatistics } from '../../../../../packages/core/src/types/matchDetails';

interface StatItem {
  label: string;
  home: number;
  away: number;
  suffix: string;
}

function StatRow({ stat }: { stat: StatItem }) {
  const colors = useFanColors();
  const total = stat.home + stat.away;
  const homePercent = total > 0 ? stat.home / total : 0.5;
  const homeFlex = Math.max(Math.round(homePercent * 100), 1);
  const awayFlex = Math.max(100 - homeFlex, 1);

  return (
    <div className="mb-4">
      <div className="flex items-center">
        <span style={{ ...fanText('statValue', colors), width: 48, textAlign: 'right', color: stat.home > stat.away ? colors.primary : colors.textSecondary }}>
          {stat.home}{stat.suffix}
        </span>
        <span className="flex-1 text-center" style={fanText('caption', colors, colors.textTertiary)}>{stat.label}</span>
        <span style={{ ...fanText('statValue', colors), width: 48, color: stat.away > stat.home ? colors.away : colors.textSecondary }}>
          {stat.away}{stat.suffix}
        </span>
      </div>
      <div className="mt-1.5 flex h-1 overflow-hidden rounded">
        <div style={{ flex: homeFlex, backgroundColor: colors.primary }} />
        <div style={{ flex: awayFlex, backgroundColor: colors.away }} />
      </div>
    </div>
  );
}

export interface StatsTabProps {
  homeTeam: string;
  awayTeam: string;
  statistics: MatchStatistics | null;
}

export function StatsTab({ homeTeam, awayTeam, statistics }: StatsTabProps) {
  const colors = useFanColors();
  if (!statistics) return null;

  const statsItems: StatItem[] = [
    { label: 'Possession', home: statistics.ballPossessionHome, away: statistics.ballPossessionAway, suffix: '%' },
    { label: 'Total Shots', home: statistics.totalShotsHome, away: statistics.totalShotsAway, suffix: '' },
    { label: 'Shots on Target', home: statistics.shotsOnTargetHome, away: statistics.shotsOnTargetAway, suffix: '' },
    { label: 'Pass Accuracy', home: statistics.passAccuracyHome, away: statistics.passAccuracyAway, suffix: '%' },
    { label: 'Corners', home: statistics.cornersHome, away: statistics.cornersAway, suffix: '' },
    { label: 'Fouls', home: statistics.foulsHome, away: statistics.foulsAway, suffix: '' },
    { label: 'Yellow Cards', home: statistics.yellowCardsHome, away: statistics.yellowCardsAway, suffix: '' },
  ];

  return (
    <div className="overflow-y-auto p-4">
      <div className="mb-4 flex items-center">
        <span className="flex-1 text-center" style={{ ...fanText('title', colors), color: colors.primary }}>{homeTeam}</span>
        <div style={{ width: FAN_SPACING.base }} />
        <span className="flex-1 text-center" style={{ ...fanText('title', colors), color: colors.away }}>{awayTeam}</span>
      </div>
      {statsItems.map((stat) => <StatRow key={stat.label} stat={stat} />)}
    </div>
  );
}
