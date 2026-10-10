'use client';
// Web port of RN src/modals/match/lineupsTab.tsx.

import { useState } from 'react';
import { AlertCircle, CircleDot, X, ArrowLeftRight } from 'lucide-react';
import type { Fixture } from '@funspot/core';
import type { LineupsData } from '@funspot/core/src/types/matchDetails';
import { useFanColors, hexWithAlpha } from '@/components/modals/use-fan-colors';
import { BenchColumn, PitchView } from './PitchView';

function FormationPill({ teamName, formation, color, alignRight = false }: { teamName: string; formation: string; color: string; alignRight?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
      <span className="max-w-[120px] truncate text-fan-tag" style={{ color }}>{teamName}</span>
      <span className="mt-[3px] rounded-fan-pill border px-2 py-px text-[11px] font-bold" style={{ background: hexWithAlpha(color, 0.12), borderColor: hexWithAlpha(color, 0.3), color }}>{formation}</span>
    </div>
  );
}

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
  const [showBench, setShowBench] = useState(false);

  if (loading) return <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" /></div>;
  if (error) return <EmptyState icon="error" message={error} />;
  if (!lineups) return <EmptyState icon="soccer" message="No lineup available" />;

  const hasBench = lineups.homeBench.length > 0 || lineups.awayBench.length > 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <FormationPill teamName={fixture.homeTeam} formation={lineups.homeFormation} color={c.primary} />
        {hasBench && (
          <button
            type="button"
            onClick={() => setShowBench((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-fan-pill border px-3 py-1.5"
            style={{ background: showBench ? c.primary : c.background, borderColor: showBench ? c.primary : c.borderActive }}
          >
            {showBench ? <X size={15} color="#fff" /> : <ArrowLeftRight size={15} color={c.textSecondary} />}
            <span className="text-fan-button" style={{ color: showBench ? '#fff' : c.textSecondary }}>Bench</span>
          </button>
        )}
        <FormationPill teamName={fixture.awayTeam} formation={lineups.awayFormation} color={c.away} alignRight />
      </div>

      {/* Bench drawer — height/opacity transition mirrors the RN/Flutter SizeTransition */}
      <div
        className="grid transition-all duration-[280ms] ease-in-out"
        style={{ gridTemplateRows: showBench ? '1fr' : '0fr', opacity: showBench ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <div className="border-b px-3 pb-3 pt-2" style={{ background: c.background, borderColor: hexWithAlpha(c.primary, 0.25) }}>
            <div className="mb-2.5 flex items-center gap-[7px]">
              <span className="h-3 w-[3px] rounded-full" style={{ background: c.primary }} />
              <span className="text-fan-tag tracking-[1px]" style={{ color: c.primary }}>BENCH</span>
            </div>
            <div className="flex gap-2.5">
              <div className="flex-1"><BenchColumn players={lineups.homeBench} color={c.primary} /></div>
              <span className="w-px self-stretch" style={{ background: c.borderActive }} />
              <div className="flex-1"><BenchColumn players={lineups.awayBench} color={c.away} /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3">
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
