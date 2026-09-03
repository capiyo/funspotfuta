'use client';

// Ported from funspot/lib/widgets/match_card.dart:
// - formatDate()/isLive getter logic reproduced exactly (±2h window = LIVE,
//   future = "In Nh", past = HH:MM).
// - Vote selection + submit flow reproduced; original used a bet-stake input
//   tied to bet_service.dart, this Phase-1 port wires the simpler
//   comrade_service.castVote() channel-vote endpoint (see README for scope).

import { useState } from 'react';
import Link from 'next/link';
import {
  Fixture,
  scoreDisplay,
  hasScores,
  winnerColorHex,
  winner as fixtureWinner,
  castVote,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / 36e5;

    if (diffHours <= 2 && diffHours >= -2) return 'LIVE';
    if (date.getTime() > now.getTime()) return `In ${Math.round(diffHours)}h`;
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return 'TBD';
  }
}

export function MatchCard({ fixture, channelId }: { fixture: Fixture; channelId?: string }) {
  const { userId, username, authToken, isLoggedIn } = useAuth();
  const [selection, setSelection] = useState<'home_team' | 'draw' | 'away_team' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badge = formatDate(fixture.date);
  const isLive = badge === 'LIVE';
  const totalOdds = fixture.homeWin + fixture.draw + fixture.awayWin || 1;
  const pct = (v: number) => Math.round((v / totalOdds) * 100);

  async function handleVote(sel: 'home_team' | 'draw' | 'away_team') {
    setError(null);
    if (!isLoggedIn || !userId || !authToken) {
      setError('Log in to vote');
      return;
    }
    if (!channelId) {
      setError('Select a channel to vote in');
      return;
    }
    setSelection(sel);
    setSubmitting(true);
    const ok = await castVote({
      channelId,
      fixtureId: fixture.matchId || fixture.id,
      userId,
      selection: sel,
      authToken,
    });
    setSubmitting(false);
    if (ok) setVoted(true);
    else setError('Vote failed — try again');
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-funspot-surface p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-gray-400">{fixture.league || 'Unknown League'}</span>
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            isLive ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-gray-300'
          }`}
        >
          {isLive && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
          {badge}
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex-1 text-center">
          <p className="truncate text-sm font-semibold text-white">{fixture.homeTeam}</p>
        </div>
        <div className="px-3 text-center">
          {hasScores(fixture) ? (
            <p className="text-lg font-bold" style={{ color: winnerColorHex(fixture) }}>
              {scoreDisplay(fixture)}
            </p>
          ) : (
            <p className="text-sm text-gray-500">vs</p>
          )}
        </div>
        <div className="flex-1 text-center">
          <p className="truncate text-sm font-semibold text-white">{fixture.awayTeam}</p>
        </div>
      </div>

      {fixture.status === 'completed' ? (
        <p className="text-center text-xs text-gray-400">Winner: {fixtureWinner(fixture)}</p>
      ) : voted ? (
        <p className="text-center text-sm font-medium text-funspot-green">✓ Vote recorded</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['home_team', 'Home', fixture.homeWin],
              ['draw', 'Draw', fixture.draw],
              ['away_team', 'Away', fixture.awayWin],
            ] as const
          ).map(([sel, label, odds]) => (
            <button
              key={sel}
              disabled={submitting || !fixture.availableForVoting}
              onClick={() => handleVote(sel)}
              className={`rounded-xl border py-2 text-xs font-medium transition disabled:opacity-50 ${
                selection === sel
                  ? 'border-funspot-green bg-funspot-green/20 text-funspot-green'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
              }`}
            >
              <div>{label}</div>
              <div className="text-[10px] text-gray-500">{pct(odds)}%</div>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}

      <div className="mt-3 flex justify-between text-[11px] text-gray-500">
        <span>{fixture.votes} votes</span>
        <span>{fixture.date}</span>
      </div>

      <Link
        href={`/fixture/${fixture.matchId || fixture.id}`}
        className="mt-2 block text-center text-[11px] font-medium text-funspot-green"
      >
        View markets & pledges →
      </Link>
    </div>
  );
}
