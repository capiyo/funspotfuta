'use client';

// HistoryCard — visual parity with the Flutter HistoryPage card
// (Screenshot 2 / "Logs"). Presentation only: data loading, mutations,
// websocket wiring, auth, etc. all live in the parent / service layer.
//
// Layout:
//   ✈️  Home vs Away                              Yesterday
//
//        Home          X : Y          Away
//
//     (P)            (P)            (P)
//   Playmaker      FireStriker    CircusSave
//   commented        voted            fan
//   Home             Away            Draw
//
//   🧠 Playmaker   Can't believe that result!
//
//   Write a comment…
//
//   💬 2                              Results   Chat

export interface VoterMini {
    id: string;
    name: string;
    role: 'voted' | 'commented' | 'pledged' | 'fan';
    pick: string; // team name or "Draw"
    pickKind: 'home' | 'away' | 'draw';
}

export interface HistoryCardData {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    timeAgo: string;
    unread?: boolean;
    people?: VoterMini[];
    latestComment?: { username: string; text: string } | null;
    commentCount?: number;
}

interface HistoryCardProps {
    data: HistoryCardData;
    onOpen?: (id: string) => void;
    onOpenResults?: (id: string) => void;
    onOpenChat?: (id: string) => void;
}

const PICK_COLOR: Record<VoterMini['pickKind'], string> = {
    home: 'text-fan-primary',
    away: 'text-fan-away',
    draw: 'text-fan-draw',
};


export function HistoryCard({
    data,
    onOpen,
    onOpenResults,
    onOpenChat,
}: HistoryCardProps) {
    const {
        id,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        timeAgo,
        unread,
        people = [],
        latestComment,
        commentCount = 0,
    } = data;

    const matchup = `${homeTeam} vs ${awayTeam}`;
    const homeWon = homeScore > awayScore;
    const awayWon = awayScore > homeScore;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen?.(id)}
            onKeyDown={(e) => e.key === 'Enter' && onOpen?.(id)}
            // No bg / border / radius — sits directly on the page background,
            // same as the Flutter design. Only vertical rhythm separates items.
            className="flex w-full cursor-pointer flex-col py-fan-md"
        >
            {/* ── Header row: ✈️ + matchup … timeAgo ──────────────── */}
            <div className="flex items-center gap-fan-sm">
                <span className="text-fan-caption leading-none">✈️</span>

                <span
                    className={`truncate text-fan-caption tracking-[0.1px] ${unread
                            ? 'font-semibold text-fan-textPrimary'
                            : 'font-medium text-fan-textSecondary'
                        }`}
                >
                    {matchup}
                </span>

                <span className="ml-auto shrink-0 text-[10px] font-medium text-fan-textTertiary">
                    {timeAgo}
                </span>
            </div>

            {/* ── Score line: Home   X : Y   Away ─────────────────── */}
            <div className="mt-fan-sm flex items-center">
                <span
                    className={`flex-1 truncate text-right text-fan-caption ${homeWon
                            ? 'font-bold text-fan-textPrimary'
                            : 'font-medium text-fan-textSecondary'
                        }`}
                >
                    {homeTeam}
                </span>

                <span className="px-fan-md text-[16px] font-bold tracking-[0.2px] text-fan-textPrimary">
                    {homeScore} : {awayScore}
                </span>

                <span
                    className={`flex-1 truncate text-left text-fan-caption ${awayWon
                            ? 'font-bold text-fan-textPrimary'
                            : 'font-medium text-fan-textSecondary'
                        }`}
                >
                    {awayTeam}
                </span>
            </div>

            {/* ── Top-3 people row ────────────────────────────────── */}
            {people.length > 0 && (
                <div className="mt-fan-sm flex items-start">
                    {people.slice(0, 3).map((p, i) => (
                        <div key={p.id} className="flex flex-1 items-start">
                            {i > 0 && <span className="w-[14px] shrink-0" />}
                            <MiniPersonColumn person={p} />
                        </div>
                    ))}
                    {Array.from({
                        length: Math.max(0, 3 - people.length),
                    }).map((_, i) => (
                        <div key={`empty-${i}`} className="flex flex-1" />
                    ))}
                </div>
            )}

            {/* ── Latest comment: bold username + regular text ────── */}
            {latestComment && (
                <p className="mt-fan-sm line-clamp-2 text-fan-body leading-snug">
                    <span className="font-bold text-fan-textSecondary">
                        {latestComment.username}
                        {'  '}
                    </span>
                    <span className="font-normal text-fan-textPrimary">
                        {latestComment.text}
                    </span>
                </p>
            )}

            {/* ── Inline comment field (underline only) ───────────── */}
            <InlineCommentField
                enabled={canComment && !isPosting}
                isPosting={isPosting}
                onSubmit={(text) => onSubmitComment?.(id, text)}
            />

            {/* ── Footer: 💬 count … Results / Chat ───────────────── */}
            <div className="mt-fan-sm flex items-center">
                {commentCount > 0 && (
                    <span className="flex items-center gap-fan-xs text-[10.5px] font-semibold text-fan-textTertiary">
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {commentCount}
                    </span>
                )}

                <div className="ml-auto flex items-center gap-fan-md">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenResults?.(id);
                        }}
                        className="text-[11.5px] font-semibold text-fan-primary"
                    >
                        Results
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenChat?.(id);
                        }}
                        className="text-[11.5px] font-semibold text-fan-primary"
                    >
                        Chat
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// MiniPersonColumn — avatar, name, role, pick
// Mirrors Flutter's _MiniPersonColumn.
// ─────────────────────────────────────────────────────────────
function MiniPersonColumn({ person }: { person: VoterMini }) {
    const initial = person.name?.charAt(0).toUpperCase() ?? '?';
    const color = PICK_COLOR[person.pickKind];

    return (
        <div className="flex min-w-0 flex-1 flex-col items-center">
            <div
                className={`flex h-[26px] w-[26px] items-center justify-center `}
            >
                <span className={`text-[10.5px] font-bold ${color}`}>
                    {initial}
                </span>
            </div>

            <span className="mt-[3px] w-full truncate text-center text-[9px] font-semibold text-fan-textSecondary">
                {person.name}
            </span>

            <span className="text-[7px] text-fan-textTertiary">
                {person.role}
            </span>

            <span
                className={`w-full truncate text-center text-[8px] font-bold ${color}`}
            >
                {person.pick}
            </span>
        </div>
    );
}

