import { useState } from 'react';
import { AlertCircle, CircleDot } from 'lucide-react';
import { FAN_SPACING } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { Fixture } from '../../../../../packages/core/src/types/fixture';
import type { LineupsData } from '../../../../../packages/core/src/types/matchDetails';
import { BenchColumn, PitchView } from './pitchView';
import { TeamCrest } from '@/components/TeamCrest';

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
  const [showSquads, setShowSquads] = useState(false);
  const crestFixture = { homeTeamImageUrl: fixture.homeTeamImageUrl, awayTeamImageUrl: fixture.awayTeamImageUrl };

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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 justify-end px-2 pb-2">
        <button
          type="button"
          onClick={() => setShowSquads((current) => !current)}
          aria-expanded={showSquads}
          className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
          style={{ backgroundColor: hexWithAlpha(colors.primary, 0.14), color: colors.primary }}
        >
          {showSquads ? 'Less' : 'More'}
        </button>
      </div>
      {!showSquads && (
        <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <TeamCrest name={fixture.homeTeam} fixture={crestFixture} side="home" size={20} />
            <div className="min-w-0"><div className="truncate text-xs font-semibold" style={{ color: colors.textPrimary }}>{fixture.homeTeam}</div><div className="text-[10px]" style={{ color: colors.textSecondary }}>{lineups.homeFormation}</div></div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 text-right"><div className="truncate text-xs font-semibold" style={{ color: colors.textPrimary }}>{fixture.awayTeam}</div><div className="text-[10px]" style={{ color: colors.textSecondary }}>{lineups.awayFormation}</div></div>
            <TeamCrest name={fixture.awayTeam} fixture={crestFixture} side="away" size={20} />
          </div>
        </div>
      )}
      {showSquads ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto px-2 pb-3">
          <section className="min-w-0">
            <h3 className="mb-2 flex min-w-0 items-center gap-2 text-sm font-semibold" style={fanText('body', colors, colors.textPrimary)}><TeamCrest name={fixture.homeTeam} fixture={crestFixture} side="home" size={20} /><span className="truncate">{fixture.homeTeam}</span></h3>
            <p className="mb-2 text-xs" style={fanText('caption', colors, colors.textSecondary)}>Coach: {lineups.homeCoach}</p>
            <BenchColumn players={lineups.homeBench} color={colors.primary} />
          </section>
          <section className="min-w-0">
            <h3 className="mb-2 flex min-w-0 items-center gap-2 text-sm font-semibold" style={fanText('body', colors, colors.textPrimary)}><TeamCrest name={fixture.awayTeam} fixture={crestFixture} side="away" size={20} /><span className="truncate">{fixture.awayTeam}</span></h3>
            <p className="mb-2 text-xs" style={fanText('caption', colors, colors.textSecondary)}>Coach: {lineups.awayCoach}</p>
            <BenchColumn players={lineups.awayBench} color={colors.away} />
          </section>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <PitchView
            homeTeam={fixture.homeTeam}
            awayTeam={fixture.awayTeam}
            homeFormation={lineups.homeFormation}
            awayFormation={lineups.awayFormation}
            homePlayers={lineups.homeStartingXI}
            awayPlayers={lineups.awayStartingXI}
          />
        </div>
      )}
    </div>
  );
}
