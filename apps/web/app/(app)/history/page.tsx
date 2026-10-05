'use client';

// Same history-service.ts data layer as before, now rendering through
// <HistoryCard> (restyled to match the Flutter HistoryPage / "Logs"
// screenshot: no card container, no dividers, plane-emoji header,
// centred score, 3-person row, inline comment field, footer links).
// Adds the History | Live sub-tab — Live reuses getAllFixtures().
//
// The people row in <HistoryCard> mirrors the Flutter 4-tier fallback:
//   1. voters
//   2. pledges
//   3. comments
//   4. deterministic mock "fan" fillers (seeded off fixture id)
// so the row is never empty — same behaviour as _buildTopThreeForHistoryItem.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchHistoryGames,
  getAllFixtures,
  hasScores,
  scoreDisplay,
  Fixture,
  HistoryGame,
} from '@funspot/core';
import { HistoryCard, HistoryCardData, VoterMini } from '../../../components/HistoryCard';

const PAGE_SIZE = 20;

type Tab = 'history' | 'live';

// Backend-provided people are preferred. When the history API fails or returns
// no usable people data, retain the existing deterministic mock presentation as
// a visual fallback; never send these mock identities back to the backend.
const SAMPLE_USERNAMES = [
  '⚽ GoalMachine', '🔥 FireStriker', '🛡️ DefenseWall', '🎯 Sniper',
  '💪 PowerShot', '✨ MagicFeet', '🏃 SpeedDemon', '🧠 TacticalGenius',
  '🌟 StarPlayer', '🎭 FalseNine', '⚡ LightningBolt', '🎨 Playmaker',
  '🔒 CleanSheet', '🎪 CircusSave', '🏆 ChampionMind', '📊 AnalystPro',
];
function seededRandom(seed: number) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; }; }
function hashCode(str: string) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }
function fallbackPeople(g: HistoryGame, people: VoterMini[]): VoterMini[] {
  if (people.length >= 3) return people;
  const rand = seededRandom(hashCode(g.id));
  const picks: Array<'home' | 'away' | 'draw'> = ['home', 'away', 'draw'];
  const result = [...people];
  while (result.length < 3) {
    const kind = picks[Math.floor(rand() * picks.length)];
    result.push({ id: `mock-${g.id}-${result.length}`, name: SAMPLE_USERNAMES[Math.floor(rand() * SAMPLE_USERNAMES.length)], role: 'fan', pick: kind === 'home' ? g.homeTeam : kind === 'away' ? g.awayTeam : 'Draw', pickKind: kind });
  }
  return result;
}

function toCardData(g: HistoryGame, opts: { canComment: boolean } = { canComment: false }): HistoryCardData {
  const raw = g as unknown as { dateIso?: string; lastActivity?: string; voters?: Array<{ id: string; name: string; selection: string }>; pledges?: Array<{ userId?: string; userName?: string; selection?: string }>; comments?: Array<{ id?: string; userId?: string; username?: string; selection?: string }>; latestComment?: { username: string; text: string } | null; unread?: boolean; commentCount?: number };
  const pickKind = (s?: string): 'home' | 'away' | 'draw' => s === 'home_team' || s === 'home' ? 'home' : s === 'away_team' || s === 'away' ? 'away' : 'draw';
  const label = (k: 'home' | 'away' | 'draw') => k === 'home' ? g.homeTeam : k === 'away' ? g.awayTeam : 'Draw';
  const people: VoterMini[] = [];
  for (const v of (raw.voters ?? []).slice(0, 3)) people.push({ id: v.id, name: v.name, role: 'voted', pick: label(pickKind(v.selection)), pickKind: pickKind(v.selection) });
  if (!people.length) for (const p of (raw.pledges ?? []).slice(0, 3)) people.push({ id: p.userId ?? `pledge-${people.length}`, name: p.userName ?? 'Fan', role: 'pledged', pick: label(pickKind(p.selection)), pickKind: pickKind(p.selection) });
  if (!people.length) for (const cm of (raw.comments ?? []).slice(0, 3)) people.push({ id: cm.id ?? cm.userId ?? `comment-${people.length}`, name: cm.username ?? 'Anonymous', role: 'commented', pick: label(pickKind(cm.selection)), pickKind: pickKind(cm.selection) });
  const rawDate = raw.dateIso ?? raw.lastActivity; const then = rawDate ? new Date(rawDate).getTime() : NaN; const mins = Number.isNaN(then) ? NaN : Math.floor((Date.now() - then) / 60000);
  const timeAgo = Number.isNaN(mins) ? '—' : mins < 1 ? 'now' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : mins < 10080 ? (Math.floor(mins / 1440) === 1 ? 'Yesterday' : `${Math.floor(mins / 1440)}d`) : new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { id: g.id, homeTeam: g.homeTeam, awayTeam: g.awayTeam, homeScore: g.homeScore ?? 0, awayScore: g.awayScore ?? 0, timeAgo, unread: raw.unread, people: fallbackPeople(g, people), latestComment: raw.latestComment ?? null, commentCount: raw.commentCount ?? 0, canComment: opts.canComment };
}
export default function HistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('history');

  // History tab state
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Live tab state
  const [liveFixtures, setLiveFixtures] = useState<Fixture[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  async function loadPage(skip: number, replace: boolean) {
    const page = await fetchHistoryGames({
      limit: PAGE_SIZE,
      skip,
    });
    setHasMore(page.length === PAGE_SIZE);
    setGames((prev) => (replace ? page : [...prev, ...page]));
  }

  useEffect(() => {
    if (tab !== 'history') return;
    setLoading(true);
    loadPage(0, true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== 'live') return;
    setLiveLoading(true);
    getAllFixtures()
      .then((all) =>
        setLiveFixtures(
          all.filter(
            (f) => f.status === 'live' || f.status === 'half_time',
          ),
        ),
      )
      .finally(() => setLiveLoading(false));
  }, [tab]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadPage(games.length, false);
    setLoadingMore(false);
  }

  function openResults(game: HistoryGame) {
    router.push(`/fixture/${game.id}`);
  }

  function openChat(game: HistoryGame) {
    router.push(`/fixture/${game.id}#chat`);
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl pb-10">
      <h1 className="mb-fan-lg font-condensed text-fan-headline text-fan-textPrimary">
        Match History
      </h1>

      {/* History | Live sub-tabs */}
      <div className="mb-fan-lg flex rounded-fan-pill bg-fan-surfaceSunken p-fan-xs">
        {(
          [
            ['history', 'History'],
            ['live', 'Live'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-fan-pill py-fan-sm text-fan-caption font-semibold transition ${tab === key
                ? 'bg-fan-primary text-fan-textInverse'
                : 'text-fan-textSecondary'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' ? (
        <>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
            </div>
          ) : games.length === 0 ? (
            <p className="py-16 text-center text-fan-body text-fan-textTertiary">
              No history found.
            </p>
          ) : (
            <>
              {games.map((g) => (
                <HistoryCard
                  key={g.id}
                  data={toCardData(g, { canComment: true })}
                  onOpenResults={() => openResults(g)}
                  onOpenChat={() => openChat(g)}
                  onSubmitComment={() => {}}
                />
              ))}

              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="mt-fan-md w-full rounded-fan-lg border border-fan-border bg-fan-surfaceSunken py-fan-md text-fan-body text-fan-textSecondary disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </>
      ) : liveLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
        </div>
      ) : liveFixtures.length === 0 ? (
        <p className="py-16 text-center text-fan-body text-fan-textTertiary">
          Nothing live right now.
        </p>
      ) : (
        liveFixtures.map((f) => (
          <button
            key={f.matchId || f.id}
            onClick={() => router.push(`/fixture/${f.matchId || f.id}`)}
            className="mb-fan-md flex w-full items-center justify-between rounded-fan-xl bg-fan-surface p-fan-lg text-left shadow-lg shadow-black/10 ring-1 ring-fan-border/[0.06]"
          >
            <div className="min-w-0">
              <p className="mb-fan-xs flex items-center gap-fan-xs text-fan-tag font-bold text-fan-away">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fan-live" />
                LIVE · {f.league}
              </p>
              <p className="truncate text-fan-title text-fan-textPrimary">
                {f.homeTeam} vs {f.awayTeam}
              </p>
            </div>
            {hasScores(f) && (
              <span className="font-condensed text-fan-scoreCompact font-bold text-fan-textPrimary">
                {scoreDisplay(f)}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
}