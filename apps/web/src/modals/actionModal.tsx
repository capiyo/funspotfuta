// Port of modals/Funzy/swipeable_vote_pledge_modal.dart — REDESIGN v4.
//
// Same architecture as the Dart file:
//   • Handle bar → header → match header → tab bar → swipable tab body → share button
//   • Tabs are derived from what's enabled (Votes always, Pledges / Sub-Fixtures / Bets
//     conditional on the caller's flags and on the fixture not being live).
//   • Live match ⇒ everything disabled (live overlay on the whole body).
//   • No draw: home / away only for the main vote + pledges.
//   • Channel validation: if channelId is empty, show the "Join a Group" screen.
//   • Balance insufficiency → top-up dialog → retry original action on success.
//
// Visual language reuses the Next.js design tokens (fan-*, rounded-fan-*,
// FooterPill shape) so this modal reads as the same product as MatchCard /
// PostCard / FixtureDetailPage. Behaviour is ported 1:1.

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fixture, Voter, Bet } from '@funspot/core';
import { FooterPill } from '@/components/FooterPill';

// ── Types (mirror the Dart models) ──────────────────────────────
type Selection = 'home' | 'away';

export interface SubFixturePledge {
    id: string;
    userId: string;
    userName: string;
    selection: string;
    amount: number;
    status: string; // 'open' | 'settled' | ...
}

export interface SubFixtureMarket {
    id: string;
    matchId: string;
    marketType: string;
    options: string[];
    line?: number;
    status: string; // 'open' | 'locked' | 'settled'
    lockAt?: string;
    pledgeCounts: Record<string, number>;
    pledgeTotals: Record<string, number>;
    result?: string;
    isVisible: boolean;
}

export interface Bettor {
    betId: string;
    userId: string;
    userName: string;
    selection: string;      // 'home' | 'away' | 'draw'
    selectionDisplay: string;
    amount: number;
    isOpen: boolean;
}

interface Props {
    fixture: Fixture;
    userId: string;
    username: string;
    authToken?: string | null;
    isLoggedIn: boolean;
    hasUserVoted: boolean;
    userVoteSelection?: string | null;
    channelId: string;
    showPledgesTab?: boolean;
    showSubFixturesTab?: boolean;
    showBetsTab?: boolean;
    onClose: () => void;
    onVote: (selection: Selection) => Promise<boolean>;
    onPledge: (selection: Selection, amount: number) => Promise<boolean>;
    onShowJoinGroups?: () => void;

    // Data fetchers — the parent wires these to the same service layer the
    // rest of the app uses. Everything else in the modal is self-contained.
    fetchVoters: (fixtureId: string, authToken?: string | null) => Promise<Voter[]>;
    fetchPledges: (
        channelId: string,
        fixtureId: string,
        authToken?: string | null,
    ) => Promise<Bettor[]>;
    fetchSubFixtures: (
        fixtureId: string,
        authToken?: string | null,
    ) => Promise<SubFixtureMarket[]>;
    fetchSubFixturePledges: (
        marketId: string,
        fixtureId: string,
        authToken?: string | null,
    ) => Promise<SubFixturePledge[]>;
    fetchBets: (
        channelId: string,
        fixtureId: string,
        authToken?: string | null,
    ) => Promise<Bet[]>;
    fetchBalance: (
        userId: string,
        authToken?: string | null,
        opts?: { forceRefresh?: boolean },
    ) => Promise<number>;
    topUp: (
        amount: number,
        phone: string,
        purpose: string,
    ) => Promise<{ success: boolean; newBalance?: number; error?: string }>;
    withdraw: (
        amount: number,
        phone: string,
    ) => Promise<{ success: boolean; newBalance?: number; error?: string }>;
    getSavedPhone: (kind: 'topup' | 'withdraw') => Promise<string | null>;
    savePhone: (kind: 'topup' | 'withdraw', phone: string) => Promise<boolean>;
    getUserPhone: () => Promise<string>;

    // Sub-fixture + main-fixture pledge execution
    placeSubFixturePledge: (args: {
        fixtureId: string;
        marketId: string;
        starterId: string;
        starterName: string;
        selection: string;
        amount: number;
    }) => Promise<{ success: boolean; message?: string }>;

    matchSubFixturePledge: (args: {
        betId: string;
        matchId: string;
        marketId: string;
        finisherId: string;
        finisherName: string;
        selection: string;
        amount: number;
    }) => Promise<{ success: boolean; message?: string }>;

    matchMainPledge: (args: {
        betId: string;
        finisherId: string;
        finisherName: string;
        finisherSelection: Selection;
        amount: number;
    }) => Promise<{ success: boolean; message?: string }>;
}

// ── Small helpers ───────────────────────────────────────────────
function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function displayVote(sel: string): string {
    if (sel === 'home_team' || sel === 'home') return 'Home';
    if (sel === 'away_team' || sel === 'away') return 'Away';
    return sel;
}

const VOTE_COLOR: Record<string, string> = {
    home_team: 'text-fan-primary',
    home: 'text-fan-primary',
    away_team: 'text-fan-away',
    away: 'text-fan-away',
    draw: 'text-fan-draw',
    over: 'text-fan-primary',
    under: 'text-fan-away',
    none: 'text-fan-textTertiary',
};

function voteColorClass(sel: string): string {
    return VOTE_COLOR[sel] ?? 'text-fan-textTertiary';
}

// ── Main modal ──────────────────────────────────────────────────
export function SwipeableVotePledgeModal({
    fixture,
    userId,
    username,
    authToken,
    isLoggedIn,
    hasUserVoted,
    userVoteSelection,
    channelId,
    showPledgesTab = true,
    showSubFixturesTab = true,
    showBetsTab = false,
    onClose,
    onVote,
    onPledge,
    onShowJoinGroups,
    fetchVoters,
    fetchPledges,
    fetchSubFixtures,
    fetchSubFixturePledges,
    fetchBets,
    fetchBalance,
    topUp,
    withdraw,
    getSavedPhone,
    savePhone,
    getUserPhone,
    placeSubFixturePledge,
    matchSubFixturePledge,
    matchMainPledge,
}: Props) {
    // ── Derived ──────────────────────────────────────────────────
    const isLive = fixture.isLive === true;
    const showPledges = showPledgesTab && !isLive;
    const showSubFixtures = showSubFixturesTab && !isLive;
    const showBets = showBetsTab && !isLive;

    const tabLabels = useMemo(() => {
        const labels: string[] = ['Votes'];
        if (showPledges) labels.push('Pledges');
        if (showSubFixtures) labels.push('Sub-Fixtures');
        if (showBets) labels.push('Bets');
        return labels;
    }, [showPledges, showSubFixtures, showBets]);

    const [tab, setTab] = useState(0);

    // ── State ────────────────────────────────────────────────────
    // Vote
    const [selectedVote, setSelectedVote] = useState<Selection | null>(null);
    const [voting, setVoting] = useState(false);

    // Voters list
    const [voters, setVoters] = useState<Voter[]>([]);
    const [votersLoading, setVotersLoading] = useState(true);
    const [voterFilter, setVoterFilter] = useState<'all' | 'home' | 'away'>('all');

    // Main pledge
    const [pledges, setPledges] = useState<Bettor[]>([]);
    const [pledgesLoading, setPledgesLoading] = useState(true);
    const [selectedPledgeOption, setSelectedPledgeOption] =
        useState<Selection | null>(null);
    const [pledgeAmount, setPledgeAmount] = useState('');
    const [pledging, setPledging] = useState(false);

    // Balance
    const [balance, setBalance] = useState(0);
    const [balanceLoading, setBalanceLoading] = useState(true);
    const [processingPayment, setProcessingPayment] = useState(false);

    // Sub-fixtures
    const [subFixtures, setSubFixtures] = useState<SubFixtureMarket[]>([]);
    const [subFixturesLoading, setSubFixturesLoading] = useState(true);
    const [subFixturesError, setSubFixturesError] = useState<string | null>(null);
    const [subSelections, setSubSelections] = useState<Record<string, string>>({});
    const [subAmounts, setSubAmounts] = useState<Record<string, string>>({});
    const [pledgingSubIds, setPledgingSubIds] = useState<Set<string>>(new Set());
    const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
    const [subPledges, setSubPledges] = useState<
        Record<string, SubFixturePledge[]>
    >({});
    const [subPledgesLoading, setSubPledgesLoading] = useState<
        Record<string, boolean>
    >({});
    const [subPledgesError, setSubPledgesError] = useState<
        Record<string, string | null>
    >({});
    const [subPledgeFilters, setSubPledgeFilters] = useState<
        Record<string, string>
    >({});
    const [matchingSubIds, setMatchingSubIds] = useState<Set<string>>(new Set());

    // Bets
    const [bets, setBets] = useState<Bet[]>([]);
    const [betsLoading, setBetsLoading] = useState(true);
    const [betIndex, setBetIndex] = useState(0);

    // Dialog state
    const [dialog, setDialog] = useState<
        | { kind: 'none' }
        | { kind: 'topup' | 'withdraw' }
        | {
            kind: 'match-main';
            bettor: Bettor;
            opposite: Selection;
        }
        | {
            kind: 'match-sub';
            market: SubFixtureMarket;
            pledge: SubFixturePledge;
            selection: string;
        }
    >({ kind: 'none' });

    // ── Loaders ──────────────────────────────────────────────────
    const loadVoters = useCallback(async () => {
        setVotersLoading(true);
        try {
            const v = await fetchVoters(fixture.matchId || fixture.id, authToken);
            setVoters(v);
        } finally {
            setVotersLoading(false);
        }
    }, [fixture, authToken, fetchVoters]);

    const loadPledges = useCallback(async () => {
        setPledgesLoading(true);
        try {
            const p = await fetchPledges(
                channelId,
                fixture.matchId || fixture.id,
                authToken,
            );
            setPledges(p);
        } finally {
            setPledgesLoading(false);
        }
    }, [fixture, channelId, authToken, fetchPledges]);

    const loadSubFixtures = useCallback(async () => {
        setSubFixturesLoading(true);
        setSubFixturesError(null);
        try {
            const markets = await fetchSubFixtures(
                fixture.matchId || fixture.id,
                authToken,
            );
            setSubFixtures(markets.filter((m) => m.isVisible));
        } catch {
            setSubFixturesError('Could not load sub-fixtures');
        } finally {
            setSubFixturesLoading(false);
        }
    }, [fixture, authToken, fetchSubFixtures]);

    const loadSubPledges = useCallback(
        async (marketId: string) => {
            if (subPledges[marketId]) return;
            if (subPledgesLoading[marketId]) return;
            setSubPledgesLoading((s) => ({ ...s, [marketId]: true }));
            setSubPledgesError((s) => ({ ...s, [marketId]: null }));
            try {
                const p = await fetchSubFixturePledges(
                    marketId,
                    fixture.matchId || fixture.id,
                    authToken,
                );
                setSubPledges((s) => ({ ...s, [marketId]: p }));
            } catch (e) {
                setSubPledgesError((s) => ({
                    ...s,
                    [marketId]: e instanceof Error ? e.message : 'Failed to load',
                }));
            } finally {
                setSubPledgesLoading((s) => ({ ...s, [marketId]: false }));
            }
        },
        [subPledges, subPledgesLoading, fetchSubFixturePledges, fixture, authToken],
    );

    const loadBets = useCallback(async () => {
        setBetsLoading(true);
        try {
            const b = await fetchBets(
                channelId,
                fixture.matchId || fixture.id,
                authToken,
            );
            setBets(b);
        } finally {
            setBetsLoading(false);
        }
    }, [fixture, channelId, authToken, fetchBets]);

    const refreshBalance = useCallback(
        async (force = false) => {
            if (!isLoggedIn) {
                setBalanceLoading(false);
                return;
            }
            setBalanceLoading(true);
            try {
                const b = await fetchBalance(userId, authToken, {
                    forceRefresh: force,
                });
                setBalance(b);
            } finally {
                setBalanceLoading(false);
            }
        },
        [isLoggedIn, userId, authToken, fetchBalance],
    );

    useEffect(() => {
        void refreshBalance(false);
        void loadVoters();
        void loadPledges();
        if (showSubFixtures) void loadSubFixtures();
        if (showBets) void loadBets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Vote ─────────────────────────────────────────────────────
    const voteStats = useMemo(() => {
        let home = 0;
        let away = 0;
        for (const v of voters) {
            if (v.selection === 'home_team' || v.selection === 'home') home++;
            else if (v.selection === 'away_team' || v.selection === 'away') away++;
        }
        const total = home + away;
        return {
            homeCount: home,
            awayCount: away,
            total,
            homePct: total > 0 ? (home / total) * 100 : 0,
            awayPct: total > 0 ? (away / total) * 100 : 0,
        };
    }, [voters]);

    const filteredVoters = useMemo(() => {
        if (voterFilter === 'home') {
            return voters.filter(
                (v) => v.selection === 'home_team' || v.selection === 'home',
            );
        }
        if (voterFilter === 'away') {
            return voters.filter(
                (v) => v.selection === 'away_team' || v.selection === 'away',
            );
        }
        return voters;
    }, [voters, voterFilter]);

    async function handleVote() {
        if (channelId.length === 0) {
            onShowJoinGroups?.();
            onClose();
            return;
        }
        if (isLive) return;
        if (!selectedVote || hasUserVoted) return;
        setVoting(true);
        try {
            const ok = await onVote(selectedVote);
            if (ok) onClose();
        } finally {
            setVoting(false);
        }
    }

    // ── Main pledge ──────────────────────────────────────────────
    const hasUserPledged = pledges.some((p) => p.userId === userId);

    async function handlePledge() {
        if (channelId.length === 0) {
            onShowJoinGroups?.();
            onClose();
            return;
        }
        if (isLive || !selectedPledgeOption) return;
        const amount = Number(pledgeAmount);
        if (!Number.isFinite(amount) || amount <= 0) return;

        if (balance < amount) {
            setDialog({ kind: 'topup' });
            return;
        }
        setPledging(true);
        try {
            const ok = await onPledge(selectedPledgeOption, amount);
            if (ok) {
                await refreshBalance(true);
                await loadPledges();
                onClose();
            }
        } finally {
            setPledging(false);
        }
    }

    // ── Sub-fixture pledge ───────────────────────────────────────
    async function handleSubFixturePledge(market: SubFixtureMarket) {
        if (channelId.length === 0) {
            onShowJoinGroups?.();
            onClose();
            return;
        }
        if (isLive) return;
        const selection = subSelections[market.id];
        if (!selection) return;
        const amount = Number(subAmounts[market.id] ?? '');
        if (!Number.isFinite(amount) || amount <= 0) return;

        if (balance < amount) {
            setDialog({ kind: 'topup' });
            return;
        }
        if (pledgingSubIds.has(market.id)) return;

        setPledgingSubIds((s) => new Set(s).add(market.id));
        try {
            const res = await placeSubFixturePledge({
                fixtureId: fixture.matchId || fixture.id,
                marketId: market.id,
                starterId: userId,
                starterName: username,
                selection,
                amount,
            });
            if (res.success) {
                await refreshBalance(true);
                await loadSubFixtures();
                setSubSelections((s) => ({ ...s, [market.id]: '' }));
                setSubAmounts((s) => ({ ...s, [market.id]: '' }));
            }
        } finally {
            setPledgingSubIds((s) => {
                const n = new Set(s);
                n.delete(market.id);
                return n;
            });
        }
    }

    // ── Match a main pledge ─────────────────────────────────────
    async function startMatchMain(pledge: Bettor) {
        if (channelId.length === 0) {
            onShowJoinGroups?.();
            onClose();
            return;
        }
        if (isLive) return;
        await refreshBalance(true);
        if (balance < pledge.amount) {
            setDialog({ kind: 'topup' });
            return;
        }
        const opposite: Selection =
            pledge.selection === 'home' || pledge.selection === 'home_team'
                ? 'away'
                : 'home';
        setDialog({ kind: 'match-main', bettor: pledge, opposite });
    }

    async function executeMatchMain(pledge: Bettor, selection: Selection) {
        const res = await matchMainPledge({
            betId: pledge.betId,
            finisherId: userId,
            finisherName: username,
            finisherSelection: selection,
            amount: pledge.amount,
        });
        if (res.success) {
            await refreshBalance(true);
            await loadPledges();
            await loadBets();
            onClose();
        }
    }

    // ── Match a sub-fixture pledge ──────────────────────────────
    async function startMatchSub(
        market: SubFixtureMarket,
        pledge: SubFixturePledge,
    ) {
        if (channelId.length === 0) {
            onShowJoinGroups?.();
            onClose();
            return;
        }
        if (isLive) return;
        await refreshBalance(true);
        if (balance < pledge.amount) {
            setDialog({ kind: 'topup' });
            return;
        }
        // Default to the first available opposite selection.
        const all =
            market.marketType === 'over_under_2_5'
                ? ['over', 'under']
                : ['home', 'away', 'none'];
        const available = all.filter((k) => k !== pledge.selection);
        setDialog({
            kind: 'match-sub',
            market,
            pledge,
            selection: available[0],
        });
    }

    async function executeMatchSub(
        market: SubFixtureMarket,
        pledge: SubFixturePledge,
        selection: string,
    ) {
        if (matchingSubIds.has(pledge.id)) return;
        setMatchingSubIds((s) => new Set(s).add(pledge.id));
        try {
            const res = await matchSubFixturePledge({
                betId: pledge.id,
                matchId: fixture.matchId || fixture.id,
                marketId: market.id,
                finisherId: userId,
                finisherName: username,
                selection,
                amount: pledge.amount,
            });
            if (res.success) {
                await refreshBalance(true);
                setSubPledges((s) => {
                    const n = { ...s };
                    delete n[market.id];
                    return n;
                });
                await loadSubPledges(market.id);
            }
        } finally {
            setMatchingSubIds((s) => {
                const n = new Set(s);
                n.delete(pledge.id);
                return n;
            });
        }
    }

    // ── Live overlay ────────────────────────────────────────────
    const liveOverlay = isLive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-fan-md text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-fan-surface">
                    <span className="text-[32px]">⚽</span>
                </div>
                <p className="text-fan-title font-bold text-white">⛔ Match is Live</p>
                <p className="text-fan-caption text-white/70">
                    Voting &amp; betting are disabled
                </p>
                <span className="rounded-fan-pill bg-fan-away px-fan-md py-fan-xs text-fan-tag font-bold text-white">
                    ● LIVE
                </span>
            </div>
        </div>
    );

    // ── Render ──────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="relative flex h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-t-[18px] bg-fan-background shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-2 pb-1">
                    <div className="h-[3px] w-8 rounded-full bg-fan-border" />
                </div>

                {/* Header */}
                <div className="flex items-center gap-fan-sm px-4 pt-1.5 pb-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fan-primaryDim">
                        <span className="text-[16px]">
                            {tab === 0
                                ? '🗳'
                                : tab === 1
                                    ? '💰'
                                    : tab === 2
                                        ? '🎲'
                                        : '🏆'}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-fan-title font-bold text-fan-textPrimary">
                            {tabLabels[tab] ?? 'Votes'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full bg-fan-surfaceSunken p-1.5"
                        aria-label="Close"
                    >
                        <span className="block h-3.5 w-3.5 text-center text-[14px] leading-[14px] text-fan-textSecondary">
                            ✕
                        </span>
                    </button>
                </div>

                {/* Match header */}
                <div className="mx-4 mb-1 flex items-center justify-center gap-fan-sm rounded-fan-lg border border-fan-border/30 bg-fan-surface px-fan-md py-fan-sm">
                    <span className="rounded-fan-md bg-fan-primary/10 px-fan-sm py-[3px] text-fan-caption font-bold text-fan-primary">
                        {fixture.homeTeam}
                    </span>
                    <span className="text-fan-tag font-bold text-fan-textTertiary">
                        VS
                    </span>
                    <span className="rounded-fan-md bg-fan-away/10 px-fan-sm py-[3px] text-fan-caption font-bold text-fan-away">
                        {fixture.awayTeam}
                    </span>
                    {isLive && (
                        <span className="flex items-center gap-1 rounded-fan-md bg-fan-away/15 px-fan-sm py-[2px] text-fan-tag font-bold text-fan-away">
                            <span className="h-1.5 w-1.5 rounded-full bg-fan-away" />
                            LIVE
                        </span>
                    )}
                </div>

                {/* Tab bar */}
                {tabLabels.length > 1 && (
                    <div className="mx-4 my-1 flex gap-0.5 rounded-fan-lg border-[0.5px] border-fan-border bg-fan-surfaceSunken p-0.5">
                        {tabLabels.map((label, i) => {
                            const active = i === tab;
                            return (
                                <button
                                    key={label}
                                    onClick={() => setTab(i)}
                                    className="relative flex-1 rounded-fan-md px-fan-sm py-1.5 text-fan-tag font-semibold text-fan-textTertiary"
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="vote-modal-tab-indicator"
                                            className="absolute inset-0 rounded-fan-md bg-fan-surface shadow-sm"
                                            transition={{
                                                type: 'tween',
                                                duration: 0.22,
                                                ease: 'easeOut',
                                            }}
                                        />
                                    )}
                                    <span
                                        className={`relative z-10 ${active ? 'text-fan-textPrimary' : ''
                                            }`}
                                    >
                                        {label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Body — swipable tabs */}
                <div className="relative flex-1 overflow-hidden">
                    {liveOverlay}
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={tab}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="absolute inset-0 overflow-y-auto"
                        >
                            {tab === 0 && renderVotesTab()}
                            {tab === 1 && showPledges && renderPledgesTab()}
                            {tab === 2 && showSubFixtures && renderSubFixturesTab()}
                            {tab === 3 && showBets && renderBetsTab()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Share */}
                <div className="border-t border-fan-border/20 px-fan-lg pt-fan-sm pb-fan-md">
                    <button
                        onClick={() => {
                            const text = `⚔️ Join the voting on Funzy!\n\n📊 Vote on: ${fixture.homeTeam} vs ${fixture.awayTeam}\n🏆 ${fixture.league}\n\nDownload the app and vote now!`;
                            if (navigator.share) {
                                navigator.share({ text, title: 'Funzy' }).catch(() => { });
                            } else {
                                navigator.clipboard?.writeText(text);
                            }
                        }}
                        className="flex w-full items-center justify-center gap-fan-xs rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken py-fan-sm text-fan-tag font-bold text-fan-textSecondary"
                    >
                        <span>↗</span>
                        <span>Share Match</span>
                    </button>
                </div>

                {/* Dialogs — top-up / withdraw / match-main / match-sub */}
                {dialog.kind === 'topup' && (
                    <FundsDialog
                        mode="topup"
                        balance={balance}
                        processing={processingPayment}
                        getSavedPhone={getSavedPhone}
                        savePhone={savePhone}
                        getUserPhone={getUserPhone}
                        onClose={() => setDialog({ kind: 'none' })}
                        onSubmit={async (amount, phone, save) => {
                            setProcessingPayment(true);
                            const res = await topUp(amount, phone, 'Top up balance');
                            setProcessingPayment(false);
                            if (res.success) {
                                if (save) await savePhone('topup', phone);
                                await refreshBalance(true);
                                setDialog({ kind: 'none' });
                            }
                            return res.success;
                        }}
                    />
                )}

                {dialog.kind === 'withdraw' && (
                    <FundsDialog
                        mode="withdraw"
                        balance={balance}
                        processing={processingPayment}
                        getSavedPhone={getSavedPhone}
                        savePhone={savePhone}
                        getUserPhone={getUserPhone}
                        onClose={() => setDialog({ kind: 'none' })}
                        onSubmit={async (amount, phone) => {
                            setProcessingPayment(true);
                            const res = await withdraw(amount, phone);
                            setProcessingPayment(false);
                            if (res.success) {
                                await refreshBalance(true);
                                setDialog({ kind: 'none' });
                            }
                            return res.success;
                        }}
                    />
                )}

                {dialog.kind === 'match-main' && (
                    <MatchMainDialog
                        fixture={fixture}
                        pledge={dialog.bettor}
                        selection={dialog.opposite}
                        onCancel={() => setDialog({ kind: 'none' })}
                        onConfirm={() => {
                            const { bettor, opposite } = dialog;
                            setDialog({ kind: 'none' });
                            void executeMatchMain(bettor, opposite);
                        }}
                    />
                )}

                {dialog.kind === 'match-sub' && (
                    <MatchSubDialog
                        fixture={fixture}
                        market={dialog.market}
                        pledge={dialog.pledge}
                        selection={dialog.selection}
                        onSelectionChange={(sel) =>
                            setDialog((d) =>
                                d.kind === 'match-sub' ? { ...d, selection: sel } : d,
                            )
                        }
                        onCancel={() => setDialog({ kind: 'none' })}
                        onConfirm={() => {
                            const { market, pledge, selection } = dialog;
                            setDialog({ kind: 'none' });
                            void executeMatchSub(market, pledge, selection);
                        }}
                    />
                )}
            </div>
        </div>
    );

    // ── Tab renders ─────────────────────────────────────────────
    function renderVotesTab() {
        const effectiveSelection = hasUserVoted ? userVoteSelection : selectedVote;
        const locked = hasUserVoted || isLive;

        const outcomes: Array<{
            key: Selection;
            label: string;
            color: string;
            count: number;
        }> = [
                {
                    key: 'home',
                    label: fixture.homeTeam,
                    color: 'primary',
                    count: voteStats.homeCount,
                },
                {
                    key: 'away',
                    label: fixture.awayTeam,
                    color: 'away',
                    count: voteStats.awayCount,
                },
            ];

        return (
            <div className="flex flex-col">
                <div className="px-4 pt-2 pb-1">
                    <div className="flex gap-fan-sm">
                        {outcomes.map((o) => {
                            const selected =
                                effectiveSelection === o.key ||
                                effectiveSelection === `${o.key}_team`;
                            const colorClass =
                                o.color === 'primary' ? 'text-fan-primary' : 'text-fan-away';
                            const bgClass =
                                o.color === 'primary' ? 'bg-fan-primaryDim' : 'bg-fan-awayDim';
                            return (
                                <button
                                    key={o.key}
                                    onClick={() =>
                                        !locked && setSelectedVote(o.key as Selection)
                                    }
                                    disabled={locked}
                                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-fan-md border px-fan-sm py-fan-sm text-center transition ${selected
                                            ? `${bgClass} border-transparent`
                                            : 'border-fan-border/30 bg-fan-surface'
                                        } disabled:opacity-100`}
                                >
                                    <span
                                        className={`truncate text-fan-caption font-semibold ${selected ? colorClass : 'text-fan-textPrimary'
                                            }`}
                                    >
                                        {o.label}
                                    </span>
                                    <span className={`text-fan-tag font-bold ${colorClass}`}>
                                        {o.count}
                                    </span>
                                    {locked && selected && (
                                        <span className="text-[10px] text-fan-primary">✓</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {selectedVote && !hasUserVoted && !isLive && (
                        <button
                            onClick={handleVote}
                            disabled={voting}
                            className="mt-fan-sm w-full rounded-fan-pill bg-fan-primary py-fan-sm text-fan-tag font-bold text-fan-textInverse disabled:opacity-60"
                        >
                            {voting ? '…' : 'Confirm Vote'}
                        </button>
                    )}
                </div>

                {/* Filter chips */}
                <div className="flex gap-1 px-4 py-1">
                    {(
                        [
                            ['all', 'All', voteStats.total],
                            ['home', 'Home', voteStats.homeCount],
                            ['away', 'Away', voteStats.awayCount],
                        ] as const
                    ).map(([key, label, count]) => {
                        const selected = voterFilter === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setVoterFilter(key)}
                                className={`rounded-fan-pill px-fan-sm py-[3px] text-fan-tag font-semibold ${selected
                                        ? 'bg-fan-primary text-fan-textInverse'
                                        : 'bg-fan-primary/10 text-fan-primary'
                                    }`}
                            >
                                {label} {count > 0 ? count : ''}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-1">
                    {votersLoading && voters.length === 0 ? (
                        <Spinner label="Loading votes…" />
                    ) : filteredVoters.length === 0 ? (
                        <Empty
                            icon="🗳"
                            label={
                                voterFilter === 'all'
                                    ? 'No votes yet'
                                    : 'No votes for this selection'
                            }
                        />
                    ) : (
                        filteredVoters.map((v) => {
                            const isMe = v.userId === userId;
                            const color = voteColorClass(v.selection);
                            const pickLabel = displayVote(v.selection);
                            return (
                                <PersonTile
                                    key={v.userId}
                                    name={isMe ? 'You' : v.userName}
                                    subtitle={v.isComrade && !isMe ? 'comrade' : 'voter'}
                                    accentClass={color}
                                    isMe={isMe}
                                    badge={pickLabel.toUpperCase()}
                                    badgeColorClass={color}
                                    amountLabel={`${pickLabel}`}
                                />
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    function renderPledgesTab() {
        return (
            <div className="flex h-full flex-col gap-fan-sm p-3">
                <BalanceBar
                    loading={balanceLoading}
                    balance={balance}
                    processing={processingPayment}
                    onTopUp={() => setDialog({ kind: 'topup' })}
                    onWithdraw={() => setDialog({ kind: 'withdraw' })}
                />

                <p className="text-fan-tag text-fan-textTertiary">
                    {hasUserPledged
                        ? '💰 You can pledge multiple times on different picks'
                        : 'Select your pick and enter amount to pledge'}
                </p>

                <div className="flex gap-fan-sm">
                    {(
                        [
                            ['home', fixture.homeTeam, 'primary'],
                            ['away', fixture.awayTeam, 'away'],
                        ] as const
                    ).map(([key, label, color]) => {
                        const selected = selectedPledgeOption === key;
                        return (
                            <button
                                key={key}
                                onClick={() => !isLive && setSelectedPledgeOption(key)}
                                disabled={isLive}
                                className={`flex-1 rounded-fan-md border px-fan-sm py-fan-sm text-center transition ${selected
                                        ? color === 'primary'
                                            ? 'border-transparent bg-fan-primaryDim text-fan-primary'
                                            : 'border-transparent bg-fan-awayDim text-fan-away'
                                        : 'border-fan-border/30 bg-fan-surface text-fan-textPrimary'
                                    }`}
                            >
                                <span className="block truncate text-fan-caption font-semibold">
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-fan-sm">
                    <input
                        type="number"
                        min={1}
                        value={pledgeAmount}
                        onChange={(e) => setPledgeAmount(e.target.value)}
                        placeholder="Amount (KES)"
                        disabled={!selectedPledgeOption || isLive}
                        className="w-full rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken px-fan-sm py-fan-sm text-fan-caption text-fan-textPrimary outline-none disabled:opacity-50"
                    />
                    <button
                        onClick={handlePledge}
                        disabled={
                            pledging ||
                            !selectedPledgeOption ||
                            !pledgeAmount ||
                            isLive
                        }
                        className="shrink-0 rounded-fan-pill bg-fan-primary px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-textInverse disabled:opacity-60"
                    >
                        {pledging ? '…' : 'Pledge'}
                    </button>
                </div>

                <div className="h-[0.5px] bg-fan-border" />

                <div className="flex items-center justify-between">
                    <span className="text-fan-caption font-bold text-fan-textPrimary">
                        Pledges ({pledges.length})
                    </span>
                    {pledgesLoading && (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {pledgesLoading && pledges.length === 0 ? (
                        <Spinner label="Loading pledges…" />
                    ) : pledges.length === 0 ? (
                        <Empty icon="💰" label="No pledges yet" />
                    ) : (
                        pledges.map((p) => {
                            const isMe = p.userId === userId;
                            const color = voteColorClass(p.selection);
                            const canMatch = !isMe && p.isOpen && !isLive;
                            return (
                                <PersonTile
                                    key={p.betId}
                                    name={isMe ? 'You' : p.userName}
                                    subtitle={isMe ? 'your pledge' : 'pledged'}
                                    accentClass={color}
                                    isMe={isMe}
                                    badge={p.isOpen ? 'OPEN' : 'MATCHED'}
                                    badgeColorClass={
                                        p.isOpen ? 'text-fan-primary' : 'text-fan-textTertiary'
                                    }
                                    amountLabel={`KES ${p.amount.toFixed(2)}`}
                                    trailing={
                                        canMatch ? (
                                            <button
                                                onClick={() => startMatchMain(p)}
                                                className="rounded-fan-pill bg-fan-primary px-fan-sm py-[3px] text-fan-tag font-bold text-fan-textInverse"
                                            >
                                                MATCH
                                            </button>
                                        ) : undefined
                                    }
                                />
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    function renderSubFixturesTab() {
        if (subFixturesLoading && subFixtures.length === 0) {
            return <Spinner label="Loading sub-fixtures…" />;
        }
        if (subFixturesError && subFixtures.length === 0) {
            return (
                <Empty
                    icon="⚠"
                    label={subFixturesError}
                    actionLabel="Retry"
                    onAction={() => void loadSubFixtures()}
                />
            );
        }
        if (subFixtures.length === 0) return null;

        return (
            <div className="flex h-full flex-col gap-fan-sm p-3">
                <BalanceBar
                    loading={balanceLoading}
                    balance={balance}
                    processing={processingPayment}
                    onTopUp={() => setDialog({ kind: 'topup' })}
                    onWithdraw={() => setDialog({ kind: 'withdraw' })}
                />

                <div className="flex-1 overflow-y-auto">
                    {subFixtures.map((market) => {
                        const isLineMarket = market.marketType === 'over_under_2_5';
                        const outcomes: Array<{ key: string; label: string }> =
                            isLineMarket
                                ? [
                                    { key: 'over', label: `Over ${market.line ?? 2.5}` },
                                    { key: 'under', label: `Under ${market.line ?? 2.5}` },
                                ]
                                : [
                                    { key: 'home', label: fixture.homeTeam },
                                    { key: 'away', label: fixture.awayTeam },
                                    { key: 'none', label: 'None' },
                                ];
                        const selected = subSelections[market.id];
                        const locked =
                            isLive || market.status !== 'open';
                        const expanded = expandedSubs[market.id] ?? false;
                        const pledges = subPledges[market.id] ?? [];
                        const isLoading = subPledgesLoading[market.id] ?? false;
                        const error = subPledgesError[market.id];
                        const filter = subPledgeFilters[market.id] ?? 'all';
                        const filtered =
                            filter === 'all'
                                ? pledges
                                : pledges.filter((p) => p.selection === filter);
                        const isPledging = pledgingSubIds.has(market.id);
                        const title = market.marketType
                            .replaceAll('_', ' ')
                            .toUpperCase();

                        return (
                            <div
                                key={market.id}
                                className="mb-fan-sm rounded-fan-lg border-[0.5px] border-fan-border/30 bg-fan-surface p-fan-md"
                            >
                                <button
                                    onClick={() =>
                                        setExpandedSubs((s) => ({
                                            ...s,
                                            [market.id]: !expanded,
                                        })) ??
                                        (!expanded && void loadSubPledges(market.id))
                                    }
                                    className="flex w-full items-center gap-fan-sm"
                                >
                                    <span className="text-[14px]">🎲</span>
                                    <span className="flex-1 truncate text-left text-fan-caption font-bold text-fan-textPrimary">
                                        {title}
                                    </span>
                                    <span
                                        className={`rounded-fan-pill px-fan-sm py-[1px] text-fan-tag font-bold ${market.status === 'settled'
                                                ? 'bg-fan-primaryDim text-fan-primary'
                                                : market.status === 'open'
                                                    ? 'bg-fan-primaryDim text-fan-primary'
                                                    : 'bg-fan-surfaceSunken text-fan-draw'
                                            }`}
                                    >
                                        {market.status.toUpperCase()}
                                    </span>
                                    <span className="text-fan-textTertiary">
                                        {expanded ? '▲' : '▼'}
                                    </span>
                                </button>

                                <div className="mt-fan-sm flex gap-fan-sm">
                                    {outcomes.map((o) => {
                                        const on = selected === o.key;
                                        return (
                                            <button
                                                key={o.key}
                                                onClick={() =>
                                                    !locked &&
                                                    setSubSelections((s) => ({
                                                        ...s,
                                                        [market.id]: o.key,
                                                    }))
                                                }
                                                disabled={locked}
                                                className={`flex-1 truncate rounded-fan-md border px-fan-sm py-fan-xs text-fan-tag font-semibold transition ${on
                                                        ? voteColorClass(o.key) +
                                                        ' border-transparent bg-fan-primaryDim'
                                                        : 'border-fan-border/30 bg-fan-surface text-fan-textPrimary'
                                                    }`}
                                            >
                                                {o.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {market.status === 'open' && !isLive && (
                                    <div className="mt-fan-sm flex items-center gap-fan-sm">
                                        <input
                                            type="number"
                                            min={1}
                                            value={subAmounts[market.id] ?? ''}
                                            onChange={(e) =>
                                                setSubAmounts((s) => ({
                                                    ...s,
                                                    [market.id]: e.target.value,
                                                }))
                                            }
                                            placeholder="Amount (KES)"
                                            disabled={!selected}
                                            className="w-full rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken px-fan-sm py-fan-sm text-fan-caption text-fan-textPrimary outline-none disabled:opacity-50"
                                        />
                                        <button
                                            onClick={() => handleSubFixturePledge(market)}
                                            disabled={isPledging || !selected}
                                            className="shrink-0 rounded-fan-pill bg-fan-primary px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-textInverse disabled:opacity-60"
                                        >
                                            {isPledging ? '…' : 'Pledge'}
                                        </button>
                                    </div>
                                )}

                                {expanded && (
                                    <div className="mt-fan-sm border-t-[0.5px] border-fan-border pt-fan-sm">
                                        {isLoading ? (
                                            <Spinner label="Loading pledges…" />
                                        ) : error ? (
                                            <Empty
                                                icon="⚠"
                                                label="Failed to load pledges"
                                                actionLabel="Retry"
                                                onAction={() => {
                                                    setSubPledges((s) => {
                                                        const n = { ...s };
                                                        delete n[market.id];
                                                        return n;
                                                    });
                                                    void loadSubPledges(market.id);
                                                }}
                                            />
                                        ) : filtered.length === 0 ? (
                                            <Empty
                                                icon="💰"
                                                label="No pledges yet"
                                            />
                                        ) : (
                                            <>
                                                <div className="mb-fan-xs flex gap-fan-xs overflow-x-auto">
                                                    {(
                                                        [
                                                            ['all', 'All', pledges.length],
                                                            ...(isLineMarket
                                                                ? ([
                                                                    [
                                                                        'over',
                                                                        'Over',
                                                                        pledges.filter((p) => p.selection === 'over')
                                                                            .length,
                                                                    ],
                                                                    [
                                                                        'under',
                                                                        'Under',
                                                                        pledges.filter((p) => p.selection === 'under')
                                                                            .length,
                                                                    ],
                                                                ] as const)
                                                                : ([
                                                                    [
                                                                        'home',
                                                                        fixture.homeTeam,
                                                                        pledges.filter((p) => p.selection === 'home')
                                                                            .length,
                                                                    ],
                                                                    [
                                                                        'away',
                                                                        fixture.awayTeam,
                                                                        pledges.filter((p) => p.selection === 'away')
                                                                            .length,
                                                                    ],
                                                                    [
                                                                        'none',
                                                                        'None',
                                                                        pledges.filter((p) => p.selection === 'none')
                                                                            .length,
                                                                    ],
                                                                ] as const)),
                                                        ] as const).map(([key, label, count]) => {
                                                            const on = filter === key;
                                                            return (
                                                                <button
                                                                    key={key}
                                                                    onClick={() =>
                                                                        setSubPledgeFilters((s) => ({
                                                                            ...s,
                                                                            [market.id]: key,
                                                                        }))
                                                                    }
                                                                    className={`shrink-0 rounded-fan-pill px-fan-sm py-[2px] text-fan-tag font-semibold ${on
                                                                            ? 'bg-fan-primary/10 text-fan-primary'
                                                                            : 'text-fan-textTertiary'
                                                                        }`}
                                                                >
                                                                    {label} {count}
                                                                </button>
                                                            );
                                                        })}
                                                </div>
                                                {filtered.map((p) => {
                                                    const isMe = p.userId === userId;
                                                    const canMatch =
                                                        !isMe &&
                                                        p.status === 'open' &&
                                                        market.status === 'open' &&
                                                        !isLive;
                                                    const matching = matchingSubIds.has(p.id);
                                                    return (
                                                        <PersonTile
                                                            key={p.id}
                                                            name={p.userName}
                                                            subtitle={`Pledged ${p.amount.toFixed(2)} KES`}
                                                            accentClass={voteColorClass(p.selection)}
                                                            isMe={isMe}
                                                            badge={isMe ? 'YOU' : undefined}
                                                            badgeColorClass="text-fan-primary"
                                                            amountLabel={p.selection.toUpperCase()}
                                                            trailing={
                                                                canMatch ? (
                                                                    <button
                                                                        onClick={() => startMatchSub(market, p)}
                                                                        disabled={matching}
                                                                        className="rounded-fan-pill bg-fan-primary px-fan-sm py-[3px] text-fan-tag font-bold text-fan-textInverse disabled:opacity-60"
                                                                    >
                                                                        {matching ? '…' : 'MATCH'}
                                                                    </button>
                                                                ) : undefined
                                                            }
                                                        />
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    function renderBetsTab() {
        if (betsLoading) return <Spinner label="Loading bets…" />;
        if (bets.length === 0) {
            return <Empty icon="🏆" label="No active bets" />;
        }
        const bet = bets[Math.min(betIndex, bets.length - 1)];
        return (
            <div className="flex h-full flex-col">
                <div className="flex justify-center gap-1 py-2">
                    {bets.map((_, i) => (
                        <span
                            key={i}
                            className={`h-1 rounded-full transition-all ${i === betIndex
                                    ? 'w-4 bg-fan-primary'
                                    : 'w-1.5 bg-fan-border'
                                }`}
                        />
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto px-3">
                    <div className="rounded-fan-lg border-[0.5px] border-fan-border/30 bg-fan-surface p-fan-md">
                        <p className="text-fan-caption font-bold text-fan-textPrimary">
                            {bet.starterName} vs {bet.finisherName ?? 'Waiting'}
                        </p>
                        <p className="mt-fan-xs text-fan-tag text-fan-textTertiary">
                            Pot: KES {( 0).toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>
        );
    }
}

// ── Sub-components ─────────────────────────────────────────────
function Spinner({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center gap-fan-sm py-fan-xxl">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
            <p className="text-fan-caption text-fan-textTertiary">{label}</p>
        </div>
    );
}

function Empty({
    icon,
    label,
    actionLabel,
    onAction,
}: {
    icon: string;
    label: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-fan-xs py-fan-lg">
            <span className="text-[32px] opacity-40">{icon}</span>
            <p className="text-fan-caption text-fan-textTertiary">{label}</p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="mt-fan-xs rounded-fan-pill bg-fan-primaryDim px-fan-sm py-[3px] text-fan-tag font-semibold text-fan-primary"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}

function BalanceBar({
    loading,
    balance,
    processing,
    onTopUp,
    onWithdraw,
}: {
    loading: boolean;
    balance: number;
    processing: boolean;
    onTopUp: () => void;
    onWithdraw: () => void;
}) {
    return (
        <div className="flex items-center gap-fan-sm rounded-fan-md border-[0.5px] border-fan-borderActive bg-fan-primaryDim px-fan-md py-fan-sm">
            <span className="text-[14px]">💰</span>
            <span className="flex-1 text-fan-caption font-bold text-fan-textPrimary">
                {loading ? 'Loading…' : `KES ${balance.toFixed(2)}`}
            </span>
            <button
                onClick={onTopUp}
                disabled={processing}
                className="rounded-fan-pill bg-fan-primary px-fan-sm py-[3px] text-fan-tag font-semibold text-fan-textInverse disabled:opacity-60"
            >
                Add
            </button>
            <button
                onClick={onWithdraw}
                disabled={processing}
                className="rounded-fan-pill bg-fan-away px-fan-sm py-[3px] text-fan-tag font-semibold text-fan-textInverse disabled:opacity-60"
            >
                Withdraw
            </button>
        </div>
    );
}

function PersonTile({
    name,
    subtitle,
    accentClass,
    isMe,
    badge,
    badgeColorClass,
    amountLabel,
    trailing,
}: {
    name: string;
    subtitle: string;
    accentClass: string;
    isMe?: boolean;
    badge?: string;
    badgeColorClass?: string;
    amountLabel?: string;
    trailing?: React.ReactNode;
}) {
    const initial = name?.[0]?.toUpperCase() ?? '?';
    return (
        <div
            className={`mb-fan-xs flex items-center gap-fan-sm rounded-fan-md border-[0.5px] px-fan-sm py-fan-xs ${isMe
                    ? 'border-fan-borderActive bg-fan-primaryDim'
                    : 'border-fan-border/20 bg-fan-surface'
                }`}
        >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-fan-surfaceSunken ring-1 ring-fan-border/30">
                <span className={`text-fan-tag font-bold ${accentClass}`}>
                    {initial}
                </span>
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-fan-xs">
                    <span
                        className={`truncate text-fan-caption font-semibold ${isMe ? 'text-fan-primary' : 'text-fan-textPrimary'
                            }`}
                    >
                        {name}
                    </span>
                    {badge && (
                        <span
                            className={`rounded-fan-pill bg-fan-primary/10 px-fan-sm py-[1px] text-fan-tag font-bold ${badgeColorClass ?? ''}`}
                        >
                            {badge}
                        </span>
                    )}
                </div>
                <span className="text-fan-tag text-fan-textTertiary">{subtitle}</span>
            </div>
            {amountLabel && !trailing && (
                <span className="text-fan-caption font-bold text-fan-textPrimary">
                    {amountLabel}
                </span>
            )}
            {trailing}
        </div>
    );
}

function MatchMainDialog({
    fixture,
    pledge,
    selection,
    onCancel,
    onConfirm,
}: {
    fixture: Fixture;
    pledge: Bettor;
    selection: Selection;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const label =
        selection === 'home' ? fixture.homeTeam : fixture.awayTeam;
    const colorClass =
        selection === 'home' ? 'text-fan-primary' : 'text-fan-away';
    const bgClass =
        selection === 'home' ? 'bg-fan-primaryDim' : 'bg-fan-awayDim';
    return (
        <DialogShell onCancel={onCancel}>
            <p className="mb-fan-md text-fan-title font-bold text-fan-textPrimary">
                Match Pledge
            </p>
            <div className="mb-fan-sm rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-sm">
                <p className="text-fan-caption text-fan-textPrimary">
                    {pledge.userName} · Picked {pledge.selectionDisplay}
                </p>
                <p className="text-fan-caption font-bold text-fan-primary">
                    KES {pledge.amount.toFixed(2)}
                </p>
            </div>
            <div
                className={`mb-fan-sm rounded-fan-md border px-fan-md py-fan-sm text-center ${bgClass} border-transparent`}
            >
                <p className={`text-fan-caption font-bold ${colorClass}`}>{label}</p>
            </div>
            <p className="text-fan-tag text-fan-away">
                Cannot pick {pledge.selectionDisplay}
            </p>
            <div className="mt-fan-md flex justify-end gap-fan-sm">
                <button
                    onClick={onCancel}
                    className="rounded-fan-pill px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-textSecondary"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="rounded-fan-pill bg-fan-primary px-fan-md py-fan-xs text-fan-tag font-bold text-fan-textInverse"
                >
                    Match
                </button>
            </div>
        </DialogShell>
    );
}

function MatchSubDialog({
    fixture,
    market,
    pledge,
    selection,
    onSelectionChange,
    onCancel,
    onConfirm,
}: {
    fixture: Fixture;
    market: SubFixtureMarket;
    pledge: SubFixturePledge;
    selection: string;
    onSelectionChange: (s: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const isLineMarket = market.marketType === 'over_under_2_5';
    const all = isLineMarket
        ? ['over', 'under']
        : ['home', 'away', 'none'];
    const available = all.filter((k) => k !== pledge.selection);
    const labelFor = (k: string) => {
        if (k === 'home') return fixture.homeTeam;
        if (k === 'away') return fixture.awayTeam;
        if (k === 'none') return 'None';
        if (k === 'over') return `Over ${market.line ?? 2.5}`;
        if (k === 'under') return `Under ${market.line ?? 2.5}`;
        return k;
    };
    return (
        <DialogShell onCancel={onCancel}>
            <p className="mb-fan-md text-fan-title font-bold text-fan-textPrimary">
                Match Pledge
            </p>
            <div className="mb-fan-sm rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-sm">
                <p className="text-fan-caption text-fan-textPrimary">
                    {pledge.userName} · Picked {labelFor(pledge.selection)}
                </p>
                <p className="text-fan-caption font-bold text-fan-primary">
                    KES {pledge.amount.toFixed(2)}
                </p>
            </div>
            <p className="mb-fan-xs text-fan-tag text-fan-textTertiary">
                Your pick
            </p>
            <div className="mb-fan-sm flex gap-fan-sm">
                {available.map((k) => {
                    const on = selection === k;
                    return (
                        <button
                            key={k}
                            onClick={() => onSelectionChange(k)}
                            className={`flex-1 rounded-fan-md border px-fan-sm py-fan-xs text-fan-tag font-semibold transition ${on
                                    ? 'border-transparent bg-fan-primaryDim text-fan-primary'
                                    : 'border-fan-border/30 bg-fan-surface text-fan-textPrimary'
                                }`}
                        >
                            {labelFor(k)}
                        </button>
                    );
                })}
            </div>
            <p className="text-fan-tag text-fan-primary">
                Stake must match: KES {pledge.amount.toFixed(2)}
            </p>
            <div className="mt-fan-md flex justify-end gap-fan-sm">
                <button
                    onClick={onCancel}
                    className="rounded-fan-pill px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-textSecondary"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="rounded-fan-pill bg-fan-primary px-fan-md py-fan-xs text-fan-tag font-bold text-fan-textInverse"
                >
                    Match
                </button>
            </div>
        </DialogShell>
    );
}

function FundsDialog({
    mode,
    balance,
    processing,
    onSubmit,
    onClose,
    getSavedPhone,
    savePhone,
    getUserPhone,
}: {
    mode: 'topup' | 'withdraw';
    balance: number;
    processing: boolean;
    onSubmit: (amount: number, phone: string, save?: boolean) => Promise<boolean>;
    onClose: () => void;
    getSavedPhone: (kind: 'topup' | 'withdraw') => Promise<string | null>;
    savePhone: (kind: 'topup' | 'withdraw', phone: string) => Promise<boolean>;
    getUserPhone: () => Promise<string>;
}) {
    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [useSaved, setUseSaved] = useState(true);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const isWithdraw = mode === 'withdraw';
    const accent = isWithdraw ? 'away' : 'primary';

    useEffect(() => {
        void (async () => {
            const saved = await getSavedPhone(mode);
            if (saved) setPhone(saved);
            if (!saved && !isWithdraw) {
                const userPhone = await getUserPhone();
                if (userPhone) setPhone(userPhone);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <DialogShell onCancel={onClose}>
            <p className="mb-fan-md text-fan-title font-bold text-fan-textPrimary">
                {isWithdraw ? 'Withdraw Funds' : 'Top Up Balance'}
            </p>
            <div className="mb-fan-sm rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-sm">
                <p className="text-fan-caption text-fan-textPrimary">
                    Balance: KES {balance.toFixed(2)}
                </p>
            </div>
            <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount (KES)"
                className="mb-fan-sm w-full rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken px-fan-sm py-fan-sm text-fan-caption text-fan-textPrimary outline-none"
            />
            <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="M-Pesa Phone Number"
                disabled={isWithdraw}
                className="mb-fan-sm w-full rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken px-fan-sm py-fan-sm text-fan-caption text-fan-textPrimary outline-none disabled:opacity-70"
            />
            {!isWithdraw && (
                <label className="mb-fan-sm flex items-center gap-fan-xs text-fan-tag text-fan-textTertiary">
                    <input
                        type="checkbox"
                        checked={useSaved}
                        onChange={(e) => setUseSaved(e.target.checked)}
                    />
                    Save this number for future top-ups
                </label>
            )}
            {status && (
                <p
                    className={`mb-fan-sm text-fan-caption ${status.startsWith('✅') ? 'text-fan-primary' : 'text-fan-away'
                        }`}
                >
                    {status}
                </p>
            )}
            <div className="flex justify-end gap-fan-sm">
                <button
                    onClick={onClose}
                    disabled={busy || processing}
                    className="rounded-fan-pill px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-textSecondary disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    onClick={async () => {
                        const a = Number(amount);
                        if (!Number.isFinite(a) || a <= 0) return;
                        if (!phone) return;
                        setBusy(true);
                        setStatus('⏳ Processing…');
                        const ok = await onSubmit(a, phone, useSaved);
                        setBusy(false);
                        setStatus(ok ? '✅ Payment successful' : '❌ Payment failed');
                    }}
                    disabled={busy || processing}
                    className={`rounded-fan-pill px-fan-md py-fan-xs text-fan-tag font-bold text-fan-textInverse disabled:opacity-60 ${accent === 'away' ? 'bg-fan-away' : 'bg-fan-primary'
                        }`}
                >
                    {busy || processing
                        ? '…'
                        : isWithdraw
                            ? 'Withdraw'
                            : 'Pay via M-Pesa'}
                </button>
            </div>
        </DialogShell>
    );
}

function DialogShell({
    children,
    onCancel,
}: {
    children: React.ReactNode;
    onCancel: () => void;
}) {
    return (
        <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-fan-lg"
            onClick={onCancel}
        >
            <div
                className="w-full max-w-sm rounded-fan-lg bg-fan-surface p-fan-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}