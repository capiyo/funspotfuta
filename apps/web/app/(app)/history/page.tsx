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

// ── Mock filler pool (mirrors Flutter's _sampleUsernames) ────────
export const SAMPLE_USERNAMES = [
  '⚽ GoalMachine',
  '🔥 FireStriker',
  '🛡️ DefenseWall',
  '🎯 Sniper',
  '💪 PowerShot',
  '✨ MagicFeet',
  '🏃 SpeedDemon',
  '🧠 TacticalGenius',
  '🌟 StarPlayer',
  '🎭 FalseNine',
  '⚡ LightningBolt',
  '🎨 Playmaker',
  '🔒 CleanSheet',
  '🎪 CircusSave',
  '🏆 ChampionMind',
  '📊 AnalystPro',
];

// Deterministic PRNG — same input → same sequence of numbers.
// Mirrors Flutter's `Random(fixtureId.hashCode)` so the same fixture
// always shows the same three mock people across renders.
export function seededRandom(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return h;
}

// ── Adapter: HistoryGame → HistoryCardData ───────────────────────
export function toCardData(
  g: HistoryGame,
  opts: { canComment: boolean } = { canComment: false },
): HistoryCardData {
  
  const homeScore = g.homeScore ?? 0;
  const awayScore = g.awayScore ?? 0;

  // Relative-time string
  const timeAgo = (() => {
    const raw =
      (g as unknown as { dateIso?: string; lastActivity?: string }).dateIso ??
      (g as unknown as { lastActivity?: string }).lastActivity;
    if (!raw) return '—';
    const then = new Date(raw).getTime();
    if (Number.isNaN(then)) return '—';
    const diffMs = Date.now() - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d`;
    return new Date(then).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  })();

  // ── People row — Flutter's 4-tier fallback ─────────────────────
  const voters =
    (
      g as unknown as {
        voters?: Array<{
          id: string;
          name: string;
          selection: 'home_team' | 'away_team' | 'draw' | string;
        }>;
      }
    ).voters ?? [];

  const pledges =
    (
      g as unknown as {
        pledges?: Array<{
          userId?: string;
          userName?: string;
          selection?: string;
        }>;
      }
    ).pledges ?? [];

  const commentsList =
    (
      g as unknown as {
        comments?: Array<{
          id?: string;
          userId?: string;
          username?: string;
          selection?: string;
        }>;
      }
    ).comments ?? [];

  const pickKindOf = (
    selection: string | undefined,
  ): 'home' | 'away' | 'draw' =>
    selection === 'home_team' || selection === 'home'
      ? 'home'
      : selection === 'away_team' || selection === 'away'
        ? 'away'
        : 'draw';

  const pickLabelOf = (kind: 'home' | 'away' | 'draw') =>
    kind === 'home' ? g.homeTeam : kind === 'away' ? g.awayTeam : 'Draw';

  const people: VoterMini[] = [];

  // Tier 1 — voters
  if (voters.length > 0) {
    for (const v of voters.slice(0, 3)) {
      const kind = pickKindOf(v.selection);
      people.push({
        id: v.id,
        name: v.name,
        role: 'voted',
        pick: pickLabelOf(kind),
        pickKind: kind,
      });
    }
  }

  // Tier 2 — pledges
  if (people.length === 0 && pledges.length > 0) {
    for (const p of pledges.slice(0, 3)) {
      const kind = pickKindOf(p.selection);
      people.push({
        id: p.userId ?? `pledge-${people.length}`,
        name: p.userName ?? 'Fan',
        role: 'pledged',
        pick: pickLabelOf(kind),
        pickKind: kind,
      });
    }
  }

  // Tier 3 — comments
  if (people.length === 0 && commentsList.length > 0) {
    for (const c of commentsList.slice(0, 3)) {
      const kind = pickKindOf(c.selection);
      people.push({
        id: c.id ?? c.userId ?? `comment-${people.length}`,
        name: c.username ?? 'Anonymous',
        role: 'commented',
        pick: pickLabelOf(kind),
        pickKind: kind,
      });
    }
  }

  // Tier 4 — top up to 3 with deterministic mocks
  if (people.length < 3) {
    const rand = seededRandom(hashCode(g.id));
    const picks: Array<'home' | 'away' | 'draw'> = ['home', 'away', 'draw'];
    const needed = 3 - people.length;
    for (let i = 0; i < needed; i++) {
      const name =
        SAMPLE_USERNAMES[Math.floor(rand() * SAMPLE_USERNAMES.length)];
      const kind = picks[Math.floor(rand() * picks.length)];
      people.push({
        id: `mock-${g.id}-${i}`,
        name,
        role: 'fan',
        pick: pickLabelOf(kind),
        pickKind: kind,
      });
    }
  }

  const latest =
    (
      g as unknown as {
        latestComment?: { username: string; text: string } | null;
      }
    ).latestComment ?? null;

  return {
    id: g.id,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore,
    awayScore,
    timeAgo,
    unread: (g as unknown as { unread?: boolean }).unread,
    people,
    latestComment: latest,
    commentCount:
      (g as unknown as { commentCount?: number }).commentCount ?? 0,
    canComment: opts.canComment,
  };
}

export default function HistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('history');

  // History tab state
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [league, setLeague] = useState('');

  // Live tab state
  const [liveFixtures, setLiveFixtures] = useState<Fixture[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  async function loadPage(skip: number, replace: boolean) {
    const page = await fetchHistoryGames({
      limit: PAGE_SIZE,
      skip,
      league: league || undefined,
    });
    setHasMore(page.length === PAGE_SIZE);
    setGames((prev) => (replace ? page : [...prev, ...page]));
  }

  useEffect(() => {
    if (tab !== 'history') return;
    setLoading(true);
    loadPage(0, true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league, tab]);

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
          <input
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            placeholder="Filter by league…"
            className="mb-fan-lg w-full rounded-fan-pill border border-fan-border bg-fan-inputSurface px-fan-lg py-fan-md text-fan-body text-fan-textPrimary outline-none focus:border-fan-borderFocus"
          />

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
                  onOpen={() => openChat(g)}
                  onOpenResults={() => openResults(g)}
                  onOpenChat={() => openChat(g)}
                  onSubmitComment={() => {
                    /* wire to your existing comment mutation */
                  }}
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