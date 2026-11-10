import { AlertCircle, CircleDot } from 'lucide-react';
import { FAN_SPACING } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { Fixture } from '../../../../../packages/core/src/types/fixture';
import type { LineupsData } from '../../../../../packages/core/src/types/matchDetails';
import { PitchView } from './pitchView';

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function EmptyState({ icon, message }: { icon: 'error' | 'soccer'; message: string }) {
  const colors = useFanColors();
  const Icon = icon === 'error' ? AlertCircle : CircleDot;
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <Icon size={48} color={hexWithAlpha(colors.textTertiary, 0.5)} />
      <div style={{ height: FAN_SPACING.md }} />
      <p style={fanText('body', colors, colors.textSecondary)}>{message}</p>
    </div>
  );
}

export interface LineupsTabProps {
  fixture: Fixture;
  lineups: LineupsData | null;
  loading: boolean;
  error: string;
}

export function LineupsTab({ fixture, lineups, loading, error }: LineupsTabProps) {
  const colors = useFanColors();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span
          className="h-6 w-6 rounded-full border-2 border-transparent"
          style={{ borderTopColor: colors.primary }}
          aria-label="Loading lineups"
        />
      </div>
    );
  }

  if (error) return <EmptyState icon="error" message={error} />;
  if (!lineups) return <EmptyState icon="soccer" message="No lineup available" />;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
      <PitchView
        homeTeam={fixture.homeTeam}
        awayTeam={fixture.awayTeam}
        homeFormation={lineups.homeFormation}
        awayFormation={lineups.awayFormation}
        homePlayers={lineups.homeStartingXI}
        awayPlayers={lineups.awayStartingXI}
      />
    </div>
  );
}
