// Web port of modals/Funzy/swipeable_aftermatch_review_modal.dart.
// Data comes from useAftermatch(fixture, channelId, authToken); the modal
// is presentation + local filter/tab state only.

import { useMemo, useState } from 'react';
import { useAftermatch } from '@funspot/core';
import type {
    AftermatchData,
    AftermatchVoter,
    AftermatchPledge,
    AftermatchBet,
    AftermatchSubFixture,
} from '@funspot/core';
import type { Fixture } from '@funspot/core';

interface Props {
    fixture: Fixture;
    userId: string;
    username: string;
    authToken: string | null;
    channelId: string;
    isLoggedIn: boolean;
    showPledgesTab?: boolean;
    showBetsTab?: boolean;
    showSubFixturesTab?: boolean;
    onClose: () => void;
}

type TabKey = 'votes' | 'pledges' | 'bets' | 'subfixtures';
type VoterFilter = 'all' | 'home' | 'draw' | 'away';

const SELECTION_COLOR: Record<string, string> = {
    home: 'text-fan-primary',
    home_team: 'text-fan-primary',
    away: 'text-fan-away',
    away_team: 'text-fan-away',
    draw: 'text-fan-draw',
};

function selectionColorClass(sel: string): string {
    return SELECTION_COLOR[sel] ?? 'text-fan-textTertiary';
}

function displayName(sel: string): string {
    if (sel === 'home' || sel === 'home_team') return 'Home';
    if (sel === 'away' || sel === 'away_team') return 'Away';
    if (sel === 'draw') return 'Draw';
    if (sel === 'over') return 'Over';
    if (sel === 'under') return 'Under';
    if (sel === 'none') return 'None';
    return sel;
}

export function AftermatchReviewModal({
    fixture,
    userId,
    username,
    authToken,
    channelId,
    isLoggedIn,
    showPledgesTab = true,
    showBetsTab = true,
    showSubFixturesTab = true,
    onClose,
}: Props) {
    const { data, isLoading, isError, refetch } = useAftermatch(
        fixture,
        channelId,
        authToken,
    );

    const tabLabels = useMemo(() => {
        const labels: { key: TabKey; label: string }[] = [
            { key: 'votes', label: 'Votes' },
        ];
        if (showPledgesTab) labels.push({ key: 'pledges', label: 'Pledges' });
        if (showBetsTab) labels.push({ key: 'bets', label: 'Bets' });
        if (showSubFixturesTab)
            labels.push({ key: 'subfixtures', label: 'Sub-Fixtures' });
        return labels;
    }, [showPledgesTab, showBetsTab, showSubFixturesTab]);

    const [tab, setTab] = useState<TabKey>('votes');

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="flex h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-t-[18px] bg-fan-background shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-2 pb-1">
                    <div className="h-[3px] w-8 rounded-full bg-fan-border" />
                </div>

                {/* Header */}
                <div className="flex items-center gap-fan-sm px-4 pt-1.5 pb-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fan-primaryDim">
                        <span className="text-[16px]">🏆</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-fan-title font-bold text-fan-textPrimary">
                            Match Review
                        </p>
                        <p className="truncate text-fan-tag text-fan-textTertiary">
                            {fixture.homeTeam} vs {fixture.awayTeam}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full bg-fan-surfaceSunken p-1.5 text-[14px] leading-[14px] text-fan-textSecondary"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {isLoading ? (
                    <LoadingState />
                ) : isError || !data ? (
                    <ErrorState onRetry={() => refetch()} />
                ) : (
                    <>
                        <ResultBanner fixture={fixture} data={data} />

                        {/* Tab bar */}
                        <div className="mx-4 my-1 flex gap-0.5 overflow-x-auto rounded-fan-lg border-[0.5px] border-fan-border bg-fan-surfaceSunken p-0.5">
                            {tabLabels.map(({ key, label }) => {
                                const active = tab === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setTab(key)}
                                        className={`flex-1 whitespace-nowrap rounded-fan-md px-fan-sm py-1.5 text-fan-tag font-semibold ${active
                                                ? 'bg-fan-surface text-fan-textPrimary shadow-sm'
                                                : 'text-fan-textTertiary'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto">
                            {tab === 'votes' && (
                                <VotesTab voters={data.voters} userId={userId} />
                            )}
                            {tab === 'pledges' && (
                                <PledgesTab pledges={data.pledges} userId={userId} />
                            )}
                            {tab === 'bets' && <BetsTab bets={data.bets} userId={userId} />}
                            {tab === 'subfixtures' && (
                                <SubFixturesTab
                                    markets={data.subFixtures}
                                    fixture={fixture}
                                    userId={userId}
                                />
                            )}
                        </div>

                        {/* Share */}
                        <div className="border-t border-fan-border/20 px-fan-lg pt-fan-sm pb-fan-md">
                            <button
                                onClick={() => shareResults(fixture, data)}
                                className="flex w-full items-center justify-center gap-fan-xs rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken py-fan-sm text-fan-tag font-bold text-fan-textSecondary"
                            >
                                <span>↗</span>
                                <span>Share Results</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Result banner ──────────────────────────────────────────────
function ResultBanner({
    fixture,
    data,
}: {
    fixture: Fixture;
    data: AftermatchData;
}) {
    const winner = data.winner;
    const colorClass =
        winner === 'home'
            ? 'text-fan-primary border-fan-primary/30 bg-fan-primaryDim'
            : winner === 'away'
                ? 'text-fan-away border-fan-away/30 bg-fan-awayDim'
                : winner === 'draw'
                    ? 'text-fan-draw border-fan-draw/30 bg-fan-draw/10'
                    : 'text-fan-textTertiary border-fan-border/30 bg-fan-surfaceSunken';

    const label =
        winner === 'home'
            ? `🏠 ${fixture.homeTeam} Won!`
            : winner === 'away'
                ? `✈️ ${fixture.awayTeam} Won!`
                : winner === 'draw'
                    ? '🤝 Draw!'
                    : '⏳ Match Pending';

    return (
        <div
            className={`mx-4 my-1.5 flex items-center justify-center gap-fan-sm rounded-fan-lg border px-fan-md py-fan-sm ${colorClass}`}
        >
            <span className="text-fan-caption font-bold">{label}</span>
            <span className="rounded-fan-md bg-black/10 px-fan-sm py-[2px] text-fan-caption font-bold">
                {data.homeScore} - {data.awayScore}
            </span>
        </div>
    );
}

// ── Votes tab ──────────────────────────────────────────────────
function VotesTab({
    voters,
    userId,
}: {
    voters: AftermatchVoter[];
    userId: string;
}) {
    const [filter, setFilter] = useState<VoterFilter>('all');

    const stats = useMemo(() => {
        let home = 0,
            away = 0,
            draw = 0;
        for (const v of voters) {
            if (v.selection === 'home') home++;
            else if (v.selection === 'away') away++;
            else if (v.selection === 'draw') draw++;
        }
        return { home, away, draw };
    }, [voters]);

    const correct = voters.filter((v) => v.result === 'won').length;
    const accuracy =
        voters.length > 0
            ? Math.round((correct / voters.length) * 100)
            : 0;

    const filtered =
        filter === 'all' ? voters : voters.filter((v) => v.selection === filter);

    if (voters.length === 0) {
        return <EmptyState icon="🗳" label="No votes recorded" />;
    }

    return (
        <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-fan-xs px-4 py-2">
                <StatChip label="Total" value={voters.length} tone="neutral" />
                <StatChip label="✅ Won" value={correct} tone="primary" />
                <StatChip label={`🎯 ${accuracy}%`} tone="draw" />
                <span className="ml-auto text-fan-tag text-fan-textTertiary">
                    Filter:
                </span>
                <FilterChip
                    label="All"
                    count={stats.home + stats.away + stats.draw}
                    active={filter === 'all'}
                    onClick={() => setFilter('all')}
                />
                <FilterChip
                    label="🏠"
                    count={stats.home}
                    active={filter === 'home'}
                    onClick={() => setFilter('home')}
                />
                <FilterChip
                    label="🤝"
                    count={stats.draw}
                    active={filter === 'draw'}
                    onClick={() => setFilter('draw')}
                />
                <FilterChip
                    label="✈️"
                    count={stats.away}
                    active={filter === 'away'}
                    onClick={() => setFilter('away')}
                />
            </div>

            <div className="flex-1 px-4 pb-2">
                {filtered.map((v) => (
                    <VoterTile key={v.userId} voter={v} isMe={v.userId === userId} />
                ))}
            </div>
        </div>
    );
}

function VoterTile({ voter, isMe }: { voter: AftermatchVoter; isMe: boolean }) {
    const color = selectionColorClass(voter.selection);
    const won = voter.result === 'won';
    const lost = voter.result === 'lost';

    return (
        <div
            className={`mb-fan-xs flex items-center gap-fan-sm rounded-fan-md border-[0.5px] px-fan-sm py-fan-xs ${isMe
                    ? 'border-fan-borderActive bg-fan-primaryDim'
                    : 'border-fan-border/20 bg-fan-surface'
                }`}
        >
            <Avatar name={isMe ? 'You' : voter.userName} tone={won ? 'primary' : color} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-fan-xs">
                    <span
                        className={`truncate text-fan-caption font-semibold ${isMe ? 'text-fan-primary' : 'text-fan-textPrimary'
                            }`}
                    >
                        {isMe ? 'You' : voter.userName}
                    </span>
                    {voter.isComrade && !isMe && <Badge label="comrade" tone="primary" />}
                    {won && <Badge label="✅ Won" tone="primary" />}
                    {lost && <Badge label="❌ Lost" tone="away" />}
                </div>
                <p className={`text-fan-tag ${color}`}>
                    Voted {displayName(voter.selection)}
                </p>
            </div>
            <span
                className={`rounded-fan-pill px-fan-sm py-[2px] text-fan-tag font-bold ${won
                        ? 'bg-fan-primaryDim text-fan-primary'
                        : lost
                            ? 'bg-fan-awayDim text-fan-away'
                            : 'bg-fan-surfaceSunken text-fan-textTertiary'
                    }`}
            >
                {won ? 'Won' : lost ? 'Lost' : '—'}
            </span>
        </div>
    );
}

// ── Pledges tab ────────────────────────────────────────────────
function PledgesTab({
    pledges,
    userId,
}: {
    pledges: AftermatchPledge[];
    userId: string;
}) {
    const totalPledged = pledges.reduce((sum, p) => sum + p.amount, 0);
    const wonCount = pledges.filter((p) => p.result === 'won').length;
    const totalPayout = pledges
        .filter((p) => p.result === 'won')
        .reduce((sum, p) => sum + (p.payout ?? p.amount * 2), 0);

    if (pledges.length === 0) {
        return <EmptyState icon="💰" label="No pledges" />;
    }

    return (
        <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-fan-xs px-4 py-2">
                <StatChip label="💰 Total" value={Math.round(totalPledged)} tone="primary" />
                <StatChip label="✅ Won" value={wonCount} tone="primary" />
                <StatChip label="💸 Payout" value={Math.round(totalPayout)} tone="draw" />
                <span className="ml-auto text-fan-tag text-fan-textTertiary">
                    {pledges.length} pledges
                </span>
            </div>

            <div className="flex-1 px-4 pb-2">
                {pledges.map((p, i) => (
                    <PledgeTile
                        key={`${p.userId}-${i}`}
                        pledge={p}
                        isMe={p.userId === userId}
                    />
                ))}
            </div>
        </div>
    );
}

function PledgeTile({
    pledge,
    isMe,
}: {
    pledge: AftermatchPledge;
    isMe: boolean;
}) {
    const color = selectionColorClass(pledge.selection);
    const won = pledge.result === 'won';
    const lost = pledge.result === 'lost';
    const open = pledge.status === 'open';

    return (
        <div
            className={`mb-fan-xs flex items-center gap-fan-sm rounded-fan-md border-[0.5px] px-fan-sm py-fan-xs ${isMe
                    ? 'border-fan-borderActive bg-fan-primaryDim'
                    : 'border-fan-border/20 bg-fan-surface'
                }`}
        >
            <Avatar name={isMe ? 'You' : pledge.userName} tone={won ? 'primary' : color} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-fan-xs">
                    <span
                        className={`truncate text-fan-caption font-semibold ${isMe ? 'text-fan-primary' : 'text-fan-textPrimary'
                            }`}
                    >
                        {isMe ? 'You' : pledge.userName}
                    </span>
                    {won && <Badge label="✅ Won" tone="primary" />}
                    {lost && <Badge label="❌ Lost" tone="away" />}
                    {open && <Badge label="Open" tone="draw" />}
                </div>
                <p className="text-fan-tag text-fan-textTertiary">
                    Picked {displayName(pledge.selection)} · KES{' '}
                    {pledge.amount.toFixed(2)}
                </p>
            </div>
            <div className="flex flex-col items-end gap-[2px]">
                <span
                    className={`rounded-fan-pill px-fan-sm py-[2px] text-fan-tag font-bold ${won
                            ? 'bg-fan-primaryDim text-fan-primary'
                            : lost
                                ? 'bg-fan-awayDim text-fan-away'
                                : 'bg-fan-surfaceSunken text-fan-textTertiary'
                        }`}
                >
                    {won ? 'Won' : lost ? 'Lost' : 'Open'}
                </span>
                {pledge.payout != null && (
                    <span className="text-fan-tag font-semibold text-fan-primary">
                        💸 KES {pledge.payout.toFixed(2)}
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Bets tab ───────────────────────────────────────────────────
function BetsTab({ bets, userId }: { bets: AftermatchBet[]; userId: string }) {
    const [index, setIndex] = useState(0);

    if (bets.length === 0) {
        return <EmptyState icon="🏅" label="No bets" />;
    }

    const settledCount = bets.filter((b) => b.status === 'settled').length;
    const bet = bets[Math.min(index, bets.length - 1)];

    return (
        <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-fan-xs px-4 py-2">
                <StatChip label="🏅 Total" value={bets.length} tone="primary" />
                <StatChip label="✅ Settled" value={settledCount} tone="primary" />
                <span className="ml-auto text-fan-tag text-fan-textTertiary">
                    {bets.length} bets
                </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4">
                <BetCard bet={bet} userId={userId} />
            </div>

            {bets.length > 1 && (
                <div className="flex justify-center gap-[6px] py-2">
                    {bets.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIndex(i)}
                            className={`h-1 rounded-full transition-all ${i === index ? 'w-4 bg-fan-primary' : 'w-1.5 bg-fan-border'
                                }`}
                            aria-label={`Bet ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function BetCard({ bet, userId }: { bet: AftermatchBet; userId: string }) {
    const isStarter = bet.starterId === userId;
    const isFinisher = bet.finisherId === userId;
    const settled = bet.status === 'settled';
    const starterWon = bet.result === 'starter_won';
    const finisherWon = bet.result === 'finisher_won';

    return (
        <div className="mb-fan-md rounded-fan-lg border-[0.5px] border-fan-border/30 bg-fan-surface p-fan-md">
            <div className="mb-fan-sm flex items-center justify-between">
                <span className="text-fan-tag font-bold text-fan-textPrimary">
                    Bet #{bet.id.slice(0, 8)}
                </span>
                <Badge
                    label={settled ? 'Settled' : 'Active'}
                    tone={settled ? 'primary' : 'draw'}
                />
            </div>

            <div className="flex items-center gap-fan-sm">
                <BetSide
                    label={isStarter ? 'YOU' : bet.starterName.toUpperCase()}
                    pick={displayName(bet.starterSelection)}
                    amount={bet.starterAmount}
                    highlight={isStarter || starterWon}
                    isWinner={starterWon}
                />
                <div className="flex flex-col items-center">
                    <span className="text-fan-tag font-bold text-fan-textTertiary">
                        VS
                    </span>
                    <span className="mt-[2px] rounded-fan-sm bg-fan-primaryDim px-fan-sm py-[1px] text-fan-tag font-bold text-fan-primary">
                        KES {bet.totalPot.toFixed(2)}
                    </span>
                </div>
                <BetSide
                    label={isFinisher ? 'YOU' : (bet.finisherName ?? '?').toUpperCase()}
                    pick={bet.finisherSelection ? displayName(bet.finisherSelection) : '?'}
                    amount={bet.finisherAmount ?? 0}
                    highlight={isFinisher || finisherWon}
                    isWinner={finisherWon}
                />
            </div>

            {settled && bet.result && (
                <div className="mt-fan-sm flex items-center justify-center gap-fan-xs border-t-[0.5px] border-fan-border pt-fan-sm">
                    <span className="text-[11px] text-fan-primary">🏆</span>
                    <span className="text-fan-tag font-semibold text-fan-primary">
                        {starterWon
                            ? `${bet.starterName} won`
                            : finisherWon
                                ? `${bet.finisherName ?? 'Finisher'} won`
                                : 'Void'}
                    </span>
                    {bet.winnerPayout != null && (
                        <span className="text-fan-tag text-fan-primary">
                            · 💰 KES {bet.winnerPayout.toFixed(2)}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

function BetSide({
    label,
    pick,
    amount,
    highlight,
    isWinner,
}: {
    label: string;
    pick: string;
    amount: number;
    highlight: boolean;
    isWinner: boolean;
}) {
    return (
        <div
            className={`flex-1 rounded-fan-sm p-fan-xs text-center ${isWinner
                    ? 'border border-fan-primary/30 bg-fan-primaryDim'
                    : 'bg-fan-surfaceSunken'
                }`}
        >
            <p
                className={`truncate text-fan-tag font-bold ${highlight ? 'text-fan-primary' : 'text-fan-textTertiary'
                    }`}
            >
                {label}
            </p>
            <p
                className={`text-fan-caption font-bold ${isWinner ? 'text-fan-primary' : 'text-fan-textPrimary'
                    }`}
            >
                {pick}
            </p>
            <p className="text-fan-tag text-fan-textTertiary">
                KES {amount.toFixed(2)}
            </p>
        </div>
    );
}

// ── Sub-fixtures tab ───────────────────────────────────────────
function SubFixturesTab({
    markets,
    fixture,
    userId,
}: {
    markets: AftermatchSubFixture[];
    fixture: Fixture;
    userId: string;
}) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [filter, setFilter] = useState<Record<string, string>>({});

    if (markets.length === 0) {
        return <EmptyState icon="🎲" label="No sub-fixtures" />;
    }

    return (
        <div className="px-4 py-2">
            {markets.map((m) => (
                <SubFixtureCard
                    key={m.id}
                    market={m}
                    fixture={fixture}
                    userId={userId}
                    expanded={!!expanded[m.id]}
                    onToggle={() =>
                        setExpanded((s) => ({ ...s, [m.id]: !s[m.id] }))
                    }
                    filter={filter[m.id] ?? 'all'}
                    onFilterChange={(k) => setFilter((s) => ({ ...s, [m.id]: k }))}
                />
            ))}
        </div>
    );
}

function SubFixtureCard({
    market,
    fixture,
    userId,
    expanded,
    onToggle,
    filter,
    onFilterChange,
}: {
    market: AftermatchSubFixture;
    fixture: Fixture;
    userId: string;
    expanded: boolean;
    onToggle: () => void;
    filter: string;
    onFilterChange: (k: string) => void;
}) {
    const settled = market.result != null;

    const outcomes = useMemo(() => {
        if (market.marketType === 'over_under_2_5') {
            const line = market.line ?? 2.5;
            return [
                { key: 'over', label: `Over ${line}` },
                { key: 'under', label: `Under ${line}` },
            ];
        }
        return market.options.map((opt) => {
            let label = opt;
            if (opt === 'home') label = fixture.homeTeam;
            else if (opt === 'away') label = fixture.awayTeam;
            else if (opt === 'none') label = 'None';
            return { key: opt, label };
        });
    }, [market, fixture]);

    const title =
        market.marketType === 'first_goal'
            ? 'First Goal'
            : market.marketType === 'first_card'
                ? 'First Card'
                : market.marketType === 'first_corner'
                    ? 'First Corner'
                    : market.marketType === 'over_under_2_5'
                        ? `Total Goals O/U ${market.line ?? 2.5}`
                        : market.marketType.replace(/_/g, ' ').toUpperCase();

    const filteredPledges =
        filter === 'all'
            ? market.pledges
            : market.pledges.filter((p) => p.selection === filter);

    return (
        <div className="mb-fan-sm rounded-fan-lg border-[0.5px] border-fan-border/30 bg-fan-surface p-fan-md">
            <button
                onClick={onToggle}
                className="flex w-full items-center gap-fan-sm"
            >
                <span className="text-[14px]">🎲</span>
                <span className="flex-1 truncate text-left text-fan-caption font-bold text-fan-textPrimary">
                    {title}
                </span>
                <Badge
                    label={settled ? '✅ Settled' : '⏳ Pending'}
                    tone={settled ? 'primary' : 'draw'}
                />
                <span className="text-fan-textTertiary">{expanded ? '▲' : '▼'}</span>
            </button>

            <div className="mt-fan-sm flex flex-wrap gap-fan-xs">
                {outcomes.map((o) => {
                    const won = market.result === o.key;
                    return (
                        <span
                            key={o.key}
                            className={`rounded-fan-md px-fan-sm py-[3px] text-fan-tag font-semibold ${won
                                    ? 'bg-fan-primaryDim text-fan-primary ring-1 ring-fan-primary'
                                    : 'bg-fan-surfaceSunken text-fan-textSecondary'
                                }`}
                        >
                            {o.label} {won && '✅'}
                        </span>
                    );
                })}
            </div>

            {expanded && (
                <div className="mt-fan-sm border-t-[0.5px] border-fan-border pt-fan-sm">
                    <div className="mb-fan-xs flex flex-wrap items-center gap-fan-xs">
                        <span className="text-fan-tag font-semibold text-fan-textTertiary">
                            Pledges
                        </span>
                        <FilterChip
                            label="All"
                            count={market.pledges.length}
                            active={filter === 'all'}
                            onClick={() => onFilterChange('all')}
                        />
                        {outcomes.map((o) => {
                            const count = market.pledges.filter(
                                (p) => p.selection === o.key,
                            ).length;
                            return (
                                <FilterChip
                                    key={o.key}
                                    label={o.label}
                                    count={count}
                                    active={filter === o.key}
                                    onClick={() => onFilterChange(o.key)}
                                />
                            );
                        })}
                    </div>

                    {filteredPledges.length === 0 ? (
                        <p className="py-fan-md text-center text-fan-tag text-fan-textTertiary">
                            No pledges for this selection
                        </p>
                    ) : (
                        filteredPledges.map((p, i) => {
                            const isMe = p.userId === userId;
                            const won = market.result === p.selection;
                            return (
                                <div
                                    key={`${p.userId}-${i}`}
                                    className={`mb-[2px] flex items-center gap-fan-xs rounded-fan-sm px-fan-sm py-fan-xs ${isMe ? 'bg-fan-primaryDim' : 'bg-fan-surfaceSunken'
                                        }`}
                                >
                                    <span className="text-[14px]">{won ? '🏆' : '•'}</span>
                                    <span
                                        className={`flex-1 truncate text-fan-caption ${isMe ? 'text-fan-primary' : 'text-fan-textPrimary'
                                            }`}
                                    >
                                        {isMe ? 'You' : p.userName}
                                    </span>
                                    <span className="text-fan-caption font-bold text-fan-primary">
                                        KES {p.amount.toFixed(2)}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

// ── Shared UI pieces ───────────────────────────────────────────
function StatChip({
    label,
    value,
    tone = 'neutral',
}: {
    label: string;
    value?: number;
    tone?: 'neutral' | 'primary' | 'draw' | 'away';
}) {
    const toneClass =
        tone === 'primary'
            ? 'bg-fan-primaryDim text-fan-primary border-fan-primary/20'
            : tone === 'draw'
                ? 'bg-fan-draw/10 text-fan-draw border-fan-draw/20'
                : tone === 'away'
                    ? 'bg-fan-awayDim text-fan-away border-fan-away/20'
                    : 'bg-fan-surfaceSunken text-fan-textSecondary border-fan-border/20';

    return (
        <span
            className={`flex items-center gap-fan-xs rounded-fan-pill border px-fan-sm py-[2px] text-fan-tag font-semibold ${toneClass}`}
        >
            {label}
            {value != null && <span className="font-bold">{value}</span>}
        </span>
    );
}

function FilterChip({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-fan-sm border-[0.5px] px-fan-sm py-[2px] text-fan-tag font-semibold ${active
                    ? 'border-fan-primary/30 bg-fan-primaryDim text-fan-primary'
                    : 'border-fan-border/30 text-fan-textTertiary'
                }`}
        >
            {label} {count}
        </button>
    );
}

function Badge({
    label,
    tone,
}: {
    label: string;
    tone: 'primary' | 'away' | 'draw';
}) {
    const toneClass =
        tone === 'primary'
            ? 'bg-fan-primaryDim text-fan-primary'
            : tone === 'away'
                ? 'bg-fan-awayDim text-fan-away'
                : 'bg-fan-draw/10 text-fan-draw';
    return (
        <span
            className={`shrink-0 rounded-fan-pill px-fan-sm py-[1px] text-fan-tag font-bold ${toneClass}`}
        >
            {label}
        </span>
    );
}

function Avatar({ name, tone }: { name: string; tone: string }) {
    const initial = name?.[0]?.toUpperCase() ?? '?';
    return (
        <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-fan-border/30 bg-fan-surfaceSunken`}
        >
            <span className={`text-fan-tag font-bold ${tone}`}>{initial}</span>
        </div>
    );
}

function EmptyState({ icon, label }: { icon: string; label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-fan-xxl">
            <span className="text-[40px] opacity-40">{icon}</span>
            <p className="mt-fan-sm text-fan-caption text-fan-textTertiary">
                {label}
            </p>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-fan-sm">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
            <p className="text-fan-caption text-fan-textTertiary">
                Loading match review…
            </p>
        </div>
    );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-fan-sm px-fan-lg text-center">
            <span className="text-[40px] opacity-40">⚠</span>
            <p className="text-fan-body font-semibold text-fan-textPrimary">
                Failed to load match review
            </p>
            <button
                onClick={onRetry}
                className="mt-fan-sm rounded-fan-md bg-fan-primary px-fan-lg py-fan-xs text-fan-tag font-semibold text-fan-textInverse"
            >
                Retry
            </button>
        </div>
    );
}

// ── Share ──────────────────────────────────────────────────────
function shareResults(fixture: Fixture, data: AftermatchData) {
    const title = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
    const resultText = data.winner
        ? `🏆 Result: ${data.homeScore} - ${data.awayScore}`
        : '⏳ Match Pending';

    const correct = data.voters.filter((v) => v.result === 'won').length;
    const total = data.voters.length;

    const lines = [
        `⚔️ Match Review: ${title}`,
        '',
        resultText,
        '',
        `📊 Votes: ${total} total`,
        `✅ Correct: ${correct}`,
        `❌ Incorrect: ${total - correct}`,
        '',
        `💰 Pledges: ${data.pledges.length}`,
        `🏅 Bets: ${data.bets.length}`,
        '',
        '📱 Funzy — Vote, Pledge & Bet!',
    ];
    const text = lines.join('\n');

    if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({ title: `Funzy Match Review — ${title}`, text }).catch(() => { });
    } else if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
    ) {
        navigator.clipboard.writeText(text).catch(() => { });
    }
}