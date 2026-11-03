'use client';
// Web port of RN src/modals/match/matchDetailsModals.tsx.
// Lineups and statistics load independently, each with the same two-tier fallback
// URLs as RN. The STATS tab only appears once valid statistics exist.

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, type Fixture } from '@funspot/core';
import { parseMatchStatistics, parseLineupsData } from '@funspot/core/src/types/matchDetails';
import type { MatchStatistics, LineupsData } from '@funspot/core/src/types/matchDetails';
import { LineupsTab } from './LineupsTab';
import { StatsTab } from './StatsTab';

export interface MatchDetailsModalProps {
  visible: boolean;
  fixture: Fixture;
  userId?: string;
  username?: string;
  authToken?: string | null;
  onClose: () => void;
}

function formatTime(dateTime: string): string {
  const d = new Date(dateTime);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function hasValidStatistics(data: any): boolean {
  const stats = data?.data ?? data;
  if (Array.isArray(stats?.statistics)) {
    if (stats.statistics.length === 0) return false;
    const latest = stats.statistics[stats.statistics.length - 1];
    const s = latest?.statistics ?? latest;
    const home = s?.home ?? {}, away = s?.away ?? {};
    return (home?.possession ?? 0) > 0 || (away?.possession ?? 0) > 0 || (home?.shots ?? 0) > 0 || (away?.shots ?? 0) > 0;
  }
  return (stats?.ball_possession_home ?? 0) > 0 || (stats?.ball_possession_away ?? 0) > 0 || (stats?.total_shots_home ?? 0) > 0 || (stats?.total_shots_away ?? 0) > 0;
}

export function MatchDetailsModal({ visible, fixture, authToken, onClose }: MatchDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'lineups' | 'stats'>('lineups');
  const [statistics, setStatistics] = useState<MatchStatistics | null>(null);
  const [lineups, setLineups] = useState<LineupsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLineups, setLoadingLineups] = useState(true);
  const [lineupsError, setLineupsError] = useState('');
  const [hasStats, setHasStats] = useState(false);

  const matchId = fixture?.matchId;

  const fetchLineups = useCallback(async () => {
    const headers: HeadersInit | undefined = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
    setLoadingLineups(true);
    setLineupsError('');
    try {
      for (const path of ['lineups', 'lineups/simplified']) {
        const res = await fetch(`${API_BASE}/games/${matchId}/${path}`, { headers });
        if (res.status === 200) {
          const data = await res.json();
          if (data?.success === true && data?.data != null) {
            setLineups(parseLineupsData(data.data));
            setLoadingLineups(false);
            return;
          }
        }
      }
      setLineupsError('No lineup available');
    } catch (e) {
      console.warn('Error fetching lineups:', e);
      setLineupsError('No network error');
    }
    setLoadingLineups(false);
  }, [matchId, authToken]);

  const fetchStatistics = useCallback(async () => {
    const headers: HeadersInit | undefined = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_BASE}/games/${matchId}/statistics/latest`, { headers });
      if (res.status === 200) {
        const data = await res.json();
        if (hasValidStatistics(data)) {
          setStatistics(parseMatchStatistics(data));
          setHasStats(true);
          setLoadingStats(false);
          return;
        }
      }
      const full = await fetch(`${API_BASE}/games/${matchId}/statistics`, { headers });
      if (full.status === 200) {
        const data = await full.json();
        if (data?.success === true) {
          const stats = data?.data ?? data;
          if (hasValidStatistics(stats)) {
            setStatistics(parseMatchStatistics(stats));
            setHasStats(true);
            setLoadingStats(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching statistics:', e);
    }
    setHasStats(false);
    setStatistics(null);
    setLoadingStats(false);
  }, [matchId, authToken]);

  useEffect(() => {
    if (!visible) return;
    // Reset so a reopened modal doesn't flash the previous match's data.
    setActiveTab('lineups');
    setStatistics(null);
    setLineups(null);
    setHasStats(false);
    fetchLineups();
    fetchStatistics();
  }, [visible, matchId, fetchLineups, fetchStatistics]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible || !fixture) return null;

  const isLive = fixture.status === 'live';
  const tab = (id: 'lineups' | 'stats', label: string) => (
    <button key={id} type="button" onClick={() => setActiveTab(id)} className="flex flex-1 flex-col items-center pt-2">
      <span className={`text-fan-button tracking-wider ${activeTab === id ? 'text-fan-primary' : 'text-fan-textSecondary'}`}>{label}</span>
      <span className={`mt-1.5 h-0.5 w-full ${activeTab === id ? 'bg-fan-primary' : 'bg-transparent'}`} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="flex h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-fan-xl border border-fan-border bg-fan-surface sm:rounded-fan-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center py-2"><span className="h-1 w-10 rounded-full bg-fan-borderActive" /></div>

        <div className="flex items-start gap-2 px-3 pb-3">
          <div className="flex flex-1 flex-col items-center">
            <span className="line-clamp-2 text-center text-fan-title text-fan-textPrimary">{fixture.homeTeam}</span>
            {isLive && <span className="mt-1 rounded-fan-pill bg-fan-live px-1.5 py-px text-[8px] font-bold text-white">LIVE</span>}
          </div>
          <div className="rounded-fan-md bg-fan-background px-3 py-1">
            <span className="font-condensed text-fan-scoreHero text-fan-textPrimary">{fixture.homeScore ?? 0} - {fixture.awayScore ?? 0}</span>
          </div>
          <div className="flex flex-1 flex-col items-center">
            <span className="line-clamp-2 text-center text-fan-title text-fan-textPrimary">{fixture.awayTeam}</span>
            {fixture.date && <span className="mt-1 text-fan-caption text-fan-textSecondary">{formatTime(fixture.date)}</span>}
          </div>
        </div>

        {hasStats && <div className="flex border-b border-fan-border">{tab('lineups', 'LINEUPS')}{tab('stats', 'STATS')}</div>}

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'lineups' || !hasStats ? (
            <LineupsTab fixture={fixture} lineups={lineups} loading={loadingLineups} error={lineupsError} />
          ) : statistics ? (
            <StatsTab homeTeam={fixture.homeTeam} awayTeam={fixture.awayTeam} statistics={statistics} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default MatchDetailsModal;
