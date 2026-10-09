// Arena match card.
//
// Behaviors:
//   • Card body tap  → onOpen() — parent renders ChatModal over the list
//   • 👥 votes pill  → onOpenVoteModal(fixture) — live/upcoming
//                    → onOpenResults(fixture)   — completed (aftermatch)
//   • ♡ likes pill   → onLike() — posts a like to backend
//   • 💬 comments    → onOpenChat() — same as card body
//   • Inline text input → onSubmitComment(text) on Enter — posts a
//                        fixture comment without opening chat
//   • 3-voter row    → onOpenVoteModal(fixture)
//
// Chat input gating (matches Flutter):
//   - requires login
//   - for upcoming/soon: requires a vote first
//   - completed matches: always open

import { useState } from 'react';
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
  liked = false,
  onOpen,
  onOpenDetails,
  onWatchClick,
  onChatClick,
  onOpenVoteModal,
  onOpenResults,
  onLike,
  onSubmitComment,
}: {
  fixture: Fixture;
  channelId?: string;
  latestComment?: LatestComment;
  liveCommentary?: LiveCommentaryEntry;
  commentsCount?: number;
  likesCount?: number;
  liked?: boolean;
  onOpen?: (fixture: Fixture) => void;
  onOpenDetails?: (fixture: Fixture) => void;
  onWatchClick?: () => void;
  onChatClick?: () => void;
  onOpenVoteModal?: (fixture: Fixture) => void;
  onOpenResults?: (fixture: Fixture) => void;
  onLike?: (fixture: Fixture) => void;
  onSubmitComment?: (fixture: Fixture, text: string) => void;
}) {
  const { userId, isLoggedIn } = useAuth();
  const [draft, setDraft] = useState('');

  const badge = formatDate(fixture.date);
  const isLive = badge === 'LIVE';
  const isCompleted =
    fixture.status === 'completed' || fixture.status === 'finished';
  const requiresVote =
    fixture.status === 'upcoming' || fixture.status === 'soon';
  const hasVoted = fixture.voters.some((v) => v.userId === userId);

  const canChat = isLoggedIn && (isCompleted || hasVoted || !requiresVote);
  const chatLockReason = !isLoggedIn
    ? 'Log in to comment'
    : requiresVote && !hasVoted
      ? 'Vote to chat 💬'
      : 'Write a comment...';

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
  }

  function handleVotePill() {
    if (isCompleted) onOpenResults?.(fixture);
    else onOpenVoteModal?.(fixture);
  }

  function submitComment() {
    const text = draft.trim();
    if (!text || !canChat) return;
    onSubmitComment?.(fixture, text);
    setDraft('');
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(fixture)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(fixture);
        }
      }}
      className="flex w-full cursor-pointer flex-col bg-fan-background px-fan-md py-fan-lg outline-none focus-visible:ring-2 focus-visible:ring-fan-primary/50"
    >
      {/* Header */}
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

          {isCompleted && (
            <span className="rounded-fan-pill bg-fan-primaryDim px-fan-sm py-[1px] text-fan-tag font-bold text-fan-primary">
              FT
            </span>
          )}

          {onWatchClick && !isLive && !isCompleted && (
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                onWatchClick();
              }}
              className="text-fan-tag font-semibold text-fan-primary"
            >
              watch
            </button>
          )}
        </div>
      </div>

      {/* Caption */}
      <button
        type="button"
        onClick={(event) => {
          stop(event);
          onOpenDetails?.(fixture);
        }}
        aria-label={`Open match details: ${fixture.homeTeam} vs ${fixture.awayTeam}`}
        className="mt-fan-sm w-full pl-[40px] text-left text-fan-body italic leading-snug text-fan-textTertiary"
      >
        {isLive && liveCommentary
          ? liveCommentary.text
          : latestComment
            ? latestComment.comment
            : hintFor(fixture)}
      </button>

      {/* Scoreboard */}
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

      {isLive && liveCommentary && (
        <p className="mt-fan-xs pl-[40px] text-fan-tag text-fan-textTertiary">
          {liveCommentary.minute}&apos;
          {liveCommentary.timestamp ? ` · ${liveCommentary.timestamp}` : ''}
        </p>
      )}

      {isCompleted ? (
        <p className="mt-fan-xs pl-[40px] text-fan-caption text-fan-textSecondary">
          Winner: {fixtureWinner(fixture)}
        </p>
      ) : hasVoted ? (
        <p className="mt-fan-xs pl-[40px] text-fan-caption text-fan-primary">
          ✓ Vote recorded
        </p>
      ) : null}

      {/* 3-voter row */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          stop(e);
          handleVotePill();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleVotePill();
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

      {/* Inline comment input — does NOT open chat. Posts a comment on submit. */}
      <div
        onClick={stop}
        className="mt-fan-md pl-[40px]"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitComment();
            }
          }}
          disabled={!canChat}
          placeholder={chatLockReason}
          className={`w-full bg-transparent pb-[6px] text-fan-body outline-none placeholder:text-fan-textTertiary/60 ${canChat
              ? 'text-fan-textPrimary'
              : 'italic text-fan-textTertiary/60'
            }`}
        />
      </div>

      {/* Footer */}
      <div className="mt-fan-sm flex items-center gap-fan-md pl-[40px]">
        <FooterPill
          icon={<span>👥</span>}
          label={fixture.votes}
          ariaLabel={`${fixture.votes} votes`}
          onClick={() => handleVotePill()}
        />
        <FooterPill
          icon={<span>{liked ? '❤' : '♡'}</span>}
          label={likesCount}
          active={liked}
          activeColor="text-fan-away"
          ariaLabel={`${likesCount} likes`}
          onClick={() => onLike?.(fixture)}
        />
        <FooterPill
          icon={<span>💬</span>}
          label={commentsCount}
          ariaLabel={`${commentsCount} comments`}
          onClick={() => onChatClick?.()}
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