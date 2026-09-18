'use client';

// Arena match card — reworked to use the same visual language as PostCard:
// avatar header row (league initial + league name + pills + inline action),
// scoreboard as the "media" block, a fan-zone caption indented under the
// avatar, the 3-voter row indented, an inline comment prompt, and the
// shared FooterPill primitive.
//
// The 👥 votes FooterPill and the 3-voter row both fire `onOpenVoteModal(fixture)`
// so the parent can render <SwipeableVotePledgeModal> for that fixture.
//
// The empty caption fallback now picks a phrase from HINT_TEXTS seeded off
// the fixture id, so each card shows a different line instead of the same
// one repeated everywhere. Same fixture → same phrase, no jitter on render.

import {
  Fixture,
  scoreDisplay,
  hasScores,
  winnerOutcome,
  winner as fixtureWinner,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { FooterPill } from './FooterPill';

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / 36e5;

    if (diffHours <= 2 && diffHours >= -2) return 'LIVE';
    if (date.getTime() > now.getTime()) return `In ${Math.round(diffHours)}h`;
    return `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  } catch {
    return 'TBD';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Deterministic "fan" fillers — seeded off the fixture id so the same
// fixture always shows the same fillers.
const SAMPLE_FAN_NAMES = [
  '⚡ LightningBolt',
  '🔥 FireStriker',
  '🛡️ DefenseWall',
  '🎯 Sniper',
  '💪 PowerShot',
  '✨ MagicFeet',
  '🏃 SpeedDemon',
  '🧠 TacticalGenius',
  '🌟 StarPlayer',
  '🎭 FalseNine',
  '🎪 CircusSave',
  '🏆 ChampionMind',
  '📊 AnalystPro',
];

// Empty-caption phrases. One is picked per fixture (seeded, stable) so a
// list of matches doesn't read as the same sentence repeated N times.
const HINT_TEXTS = [
  'Say something about this match 💬',
  'Who takes this one? 🎯',
  'Drop your hot take 🔥',
  'What do you reckon? ⚽',
  'Fan zone is open 💭',
  'Call it before kickoff 🏆',
  'Talk your side up 📣',
  'Any predictions? 🧠',
  'First instinct — go 📈',
  'Settle it in the comments 👇',
];

function hintFor(fixture: Fixture): string {
  const seedStr = fixture.matchId || fixture.id || '';
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
  }
  return HINT_TEXTS[Math.abs(seed) % HINT_TEXTS.length];
}

const EMOJI_RE = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u;
function splitFanName(username: string): { icon: string; name: string } {
  const match = username.match(EMOJI_RE);
  if (match) {
    return {
      icon: match[1],
      name: username.slice(match[0].length).trim() || username,
    };
  }
  return { icon: '', name: username };
}

function seededHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface DisplayVoter {
  userId: string;
  userName: string;
  selection: 'home_team' | 'away_team' | 'draw' | string;
}

function fillVotersTo3(fixture: Fixture): DisplayVoter[] {
  const real: DisplayVoter[] = fixture.voters.slice(0, 3);
  if (real.length >= 3) return real;

  const seed = fixture.matchId || fixture.id;
  const base = seededHash(seed);
  const picks = ['home_team', 'away_team', 'draw'] as const;
  const needed = 3 - real.length;

  const fillers: DisplayVoter[] = Array.from({ length: needed }, (_, i) => ({
    userId: `mock_${seed}_${i}`,
    userName: SAMPLE_FAN_NAMES[(base + i * 7) % SAMPLE_FAN_NAMES.length],
    selection: picks[(base + i * 13) % picks.length],
  }));

  return [...real, ...fillers];
}

const OUTCOME_TEXT_CLASS: Record<string, string> = {
  home: 'text-fan-primary',
  away: 'text-fan-scoreAway',
  draw: 'text-fan-draw',
  unknown: 'text-fan-textTertiary',
};

export interface LatestComment {
  username: string;
  comment: string;
}

export interface LiveCommentaryEntry {
  text: string;
  minute: number;
  timestamp?: string;
}

export function MatchCard({
  fixture,
  latestComment,
  liveCommentary,
  commentsCount = 0,
  likesCount = 0,
  onWatchClick,
  onChatClick,
  onOpenVoteModal,
}: {
  fixture: Fixture;
  channelId?: string;
  latestComment?: LatestComment;
  liveCommentary?: LiveCommentaryEntry;
  commentsCount?: number;
  likesCount?: number;
  onWatchClick?: () => void;
  onChatClick?: () => void;
  /** Fires when the user taps the votes pill or the 3-voter row. Parent
   *  owns the modal instance and passes the fixture back in. */
  onOpenVoteModal?: (fixture: Fixture) => void;
}) {
  const { userId, isLoggedIn } = useAuth();

  const badge = formatDate(fixture.date);
  const isLive = badge === 'LIVE';
  const hasVoted = fixture.voters.some((v) => v.userId === userId);

  return (
    <div className="bg-fan-background px-fan-md py-fan-lg">
      {/* Header — same shape as PostCard */}
      <div className="flex items-center gap-fan-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
          <span className="text-fan-tag font-bold text-fan-primary">
            {(fixture.league || '?').charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-fan-xs">
          <span className="text-fan-tag font-bold text-fan-textPrimary">
            {(fixture.league || 'Unknown League').toUpperCase()}
          </span>

          {isLive ? (
            <span className="flex items-center gap-fan-xs rounded-fan-pill bg-fan-awayDim px-fan-sm py-[1px] text-fan-tag font-bold text-fan-live">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fan-live" />
              LIVE
            </span>
          ) : (
            <span className="rounded-fan-pill bg-fan-surfaceSunken px-fan-sm py-[1px] text-fan-tag text-fan-textTertiary">
              {badge}
            </span>
          )}

          {fixture.status === 'completed' && (
            <span className="rounded-fan-pill bg-fan-primaryDim px-fan-sm py-[1px] text-fan-tag font-bold text-fan-primary">
              FT
            </span>
          )}

          {onWatchClick && !isLive && fixture.status !== 'completed' && (
            <button
              onClick={onWatchClick}
              className="text-fan-tag font-semibold text-fan-primary"
            >
              watch
            </button>
          )}
        </div>
      </div>

      {/* Caption line — smaller / italic / tertiary when it's the empty
          fallback so it reads as a hint, not as content. */}
      <p className="mt-fan-sm pl-[40px] text-fan-body italic leading-snug text-fan-textTertiary">
        {isLive && liveCommentary
          ? liveCommentary.text
          : latestComment
            ? latestComment.comment
            : hintFor(fixture)}
      </p>

      {/* Scoreboard — plays the role of PostCard's media block. Full width,
          no border, no pill backgrounds. */}
      <div className="mt-fan-sm flex items-center justify-center gap-fan-md">
        <span className="flex-1 truncate text-right text-fan-caption font-medium text-fan-textPrimary">
          {fixture.homeTeam}
        </span>
        <span
          className={`shrink-0 font-condensed text-[16px] font-bold tracking-[0.2px] ${hasScores(fixture)
              ? OUTCOME_TEXT_CLASS[winnerOutcome(fixture)]
              : 'text-fan-textTertiary'
            }`}
        >
          {hasScores(fixture) ? scoreDisplay(fixture) : 'VS'}
        </span>
        <span className="flex-1 truncate text-left text-fan-caption font-medium text-fan-textPrimary">
          {fixture.awayTeam}
        </span>
      </div>

      {/* Live commentary minute / result line — indented, same as PostCard's
          caption continuation. */}
      {isLive && liveCommentary && (
        <p className="mt-fan-xs pl-[40px] text-fan-tag text-fan-textTertiary">
          {liveCommentary.minute}&apos;
          {liveCommentary.timestamp ? ` · ${liveCommentary.timestamp}` : ''}
        </p>
      )}

      {fixture.status === 'completed' ? (
        <p className="mt-fan-xs pl-[40px] text-fan-caption text-fan-textSecondary">
          Winner: {fixtureWinner(fixture)}
        </p>
      ) : hasVoted ? (
        <p className="mt-fan-xs pl-[40px] text-fan-caption text-fan-primary">
          ✓ Vote recorded
        </p>
      ) : null}

      {/* 3-voter row — indented under the avatar. Whole row is tappable and
          opens the vote modal. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenVoteModal?.(fixture)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenVoteModal?.(fixture);
          }
        }}
        className="mt-fan-sm flex cursor-pointer gap-fan-md pl-[40px] outline-none focus-visible:ring-2 focus-visible:ring-fan-primary/50"
      >
        {fillVotersTo3(fixture).map((v) => {
          const { icon, name } = splitFanName(v.userName);
          const kind =
            v.selection === 'home_team'
              ? 'home'
              : v.selection === 'away_team'
                ? 'away'
                : 'draw';
          return (
            <div key={v.userId} className="min-w-0 flex-1 text-center">
              <div className="mx-auto mb-fan-xs flex h-8 w-8 items-center justify-center">
                {icon ? (
                  <span className="text-fan-body">{icon}</span>
                ) : (
                  <span className="text-fan-tag font-bold text-fan-primary">
                    {initials(name)}
                  </span>
                )}
              </div>
              <p className="truncate text-fan-tag font-semibold text-fan-textPrimary">
                {name}
              </p>
              <p className="text-fan-tag text-fan-textTertiary">fan</p>
              <p
                className={`truncate text-fan-tag font-bold ${OUTCOME_TEXT_CLASS[kind]
                  }`}
              >
                {kind === 'home'
                  ? fixture.homeTeam
                  : kind === 'away'
                    ? fixture.awayTeam
                    : 'draw'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Inline comment prompt — indented like PostCard's footer. */}
      <button
        type="button"
        onClick={onChatClick}
        disabled={!isLoggedIn}
        className="mt-fan-md flex w-full items-center gap-fan-sm pl-[40px] text-left disabled:opacity-60"
      >
        <span className="shrink-0 text-fan-tag text-fan-textTertiary">
          {isLoggedIn ? '💬' : '🔒'}
        </span>
        <span className="truncate text-fan-body italic text-fan-textTertiary">
          {isLoggedIn ? 'Write a comment...' : 'Log in to comment'}
        </span>
      </button>

      {/* Footer — shared FooterPill primitive, indented like PostCard's.
          👥 votes pill opens the vote/pledge/sub-fixtures modal. */}
      <div className="mt-fan-sm flex items-center gap-fan-md pl-[40px]">
        <FooterPill
          icon={<span>👥</span>}
          label={fixture.votes}
          ariaLabel={`${fixture.votes} votes`}
          onClick={() => onOpenVoteModal?.(fixture)}
        />
        <FooterPill icon={<span>♡</span>} label={likesCount} />
        <FooterPill
          icon={<span>💬</span>}
          label={commentsCount}
          onClick={onChatClick}
        />
        {isLive && (
          <span className="ml-auto rounded-fan-pill bg-fan-awayDim px-fan-sm py-[1px] text-fan-tag font-bold text-fan-live">
            live
          </span>
        )}
      </div>
    </div>
  );
}