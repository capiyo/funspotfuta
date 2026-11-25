'use client';
// Web port of RN src/modals/match/lineupsTab.tsx.


import { AlertCircle, CircleDot } from 'lucide-react';
import type { Fixture } from '@funspot/core';
import type { LineupsData } from '@funspot/core/src/types/matchDetails';
import { useFanColors, hexWithAlpha } from '@/lib/theme/use-fan-colors';
import { PitchView } from './PitchView';

function EmptyState({ icon, message }: { icon: 'error' | 'soccer'; message: string }) {
  const c = useFanColors();
  const Icon = icon === 'error' ? AlertCircle : CircleDot;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
      <Icon size={48} color={hexWithAlpha(c.textTertiary, 0.5)} />
      <p className="text-fan-body text-fan-textSecondary">{message}</p>
    </div>
  );
}

export function LineupsTab({ fixture, lineups, loading, error }: { fixture: Fixture; lineups: LineupsData | null; loading: boolean; error: string }) {
  const c = useFanColors();

  if (loading) return <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" /></div>;
  if (error) return <EmptyState icon="error" message={error} />;
  if (!lineups) return <EmptyState icon="soccer" message="No lineup available" />;


  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-0">
        <PitchView
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
          homeFormation={lineups.homeFormation}
          awayFormation={lineups.awayFormation}
          homePlayers={lineups.homeStartingXI}
          awayPlayers={lineups.awayStartingXI}
        />
      </div>
    </div>
  );
}
