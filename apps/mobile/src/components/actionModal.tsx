// components/SwipeableVotePledgeModal.tsx
//
// React Native port of modals/Funzy/swipeable_vote_pledge_modal.dart.
//
// Same architecture:
//   handle bar → header → match header → tab bar → swipable tab body → share button
//   Tabs derived from what's enabled; live ⇒ everything disabled.
//   No draw: home / away only.
//   Channel validation: no channel ⇒ "Join a Group" screen.
//   Balance insufficiency → top-up dialog → retry on success.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    View,
    Text,
    Pressable,
    TextInput,
    Modal,
    ScrollView,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Share,
    Platform,
    useWindowDimensions,
    Animated,
} from 'react-native';

// ── Types (mirror Dart) ────────────────────────────────────────
type Selection = 'home' | 'away';

export interface SubFixturePledge {
    id: string;
    userId: string;
    userName: string;
    selection: string;
    amount: number;
    status: string;
}

export interface SubFixtureMarket {
    id: string;
    matchId: string;
    marketType: string;
    options: string[];
    line?: number;
    status: string;
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
    selection: string;
    selectionDisplay: string;
    amount: number;
    isOpen: boolean;
}

export interface FixtureLite {
    id: string;
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    league: string;
    isLive?: boolean;
}

interface Props {
    visible: boolean;
    fixture: FixtureLite;
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

    fetchVoters: (fixtureId: string, authToken?: string | null) => Promise<any[]>;
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
    ) => Promise<any[]>;
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

// ── Theme tokens — swap for your RN design system ──────────────
const C = {
    background: '#0B1410',
    surface: '#101E18',
    surfaceSunken: '#0E1A15',
    surfaceElevated: '#13241C',
    primary: '#34D399',
    primaryDim: 'rgba(52,211,153,0.10)',
    primaryMuted: 'rgba(52,211,153,0.15)',
    away: '#FF6B6B',
    awayDim: 'rgba(255,107,107,0.10)',
    draw: '#F5B841',
    textPrimary: '#F1F5F9',
    textSecondary: '#A0AEC0',
    textTertiary: '#6B7280',
    border: 'rgba(255,255,255,0.08)',
    borderActive: 'rgba(52,211,153,0.35)',
    white: '#FFFFFF',
};

// ── Helpers ────────────────────────────────────────────────────
function voteColor(sel: string): string {
    if (sel === 'home' || sel === 'home_team') return C.primary;
    if (sel === 'away' || sel === 'away_team') return C.away;
    if (sel === 'over') return C.primary;
    if (sel === 'under') return C.away;
    if (sel === 'draw') return C.draw;
    return C.textTertiary;
}

function displayVote(sel: string): string {
    if (sel === 'home' || sel === 'home_team') return 'Home';
    if (sel === 'away' || sel === 'away_team') return 'Away';
    return sel;
}

// ── Main component ─────────────────────────────────────────────
export function SwipeableVotePledgeModal(props: Props) {
    const {
        visible,
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
    } = props;

    const { height: screenH } = useWindowDimensions();
    const isLive = fixture.isLive === true;
    const showPledges = showPledgesTab && !isLive;
    const showSubFixtures = showSubFixturesTab && !isLive;
    const showBets = showBetsTab && !isLive;

    const tabs = useMemo(() => {
        const labels: string[] = ['Votes'];
        if (showPledges) labels.push('Pledges');
        if (showSubFixtures) labels.push('Sub-Fixtures');
        if (showBets) labels.push('Bets');
        return labels;
    }, [showPledges, showSubFixtures, showBets]);

    const [tab, setTab] = useState(0);

    // Vote
    const [selectedVote, setSelectedVote] = useState<Selection | null>(null);
    const [voting, setVoting] = useState(false);
    const [voters, setVoters] = useState<any[]>([]);
    const [votersLoading, setVotersLoading] = useState(true);
    const [voterFilter, setVoterFilter] = useState<'all' | 'home' | 'away'>('all');

    // Pledge
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
    const [subPledges, setSubPledges] = useState<Record<string, SubFixturePledge[]>>({});
    const [subPledgesLoading, setSubPledgesLoading] = useState<Record<string, boolean>>({});
    const [subPledgesError, setSubPledgesError] = useState<Record<string, string | null>>({});
    const [subPledgeFilters, setSubPledgeFilters] = useState<Record<string, string>>({});
    const [matchingSubIds, setMatchingSubIds] = useState<Set<string>>(new Set());

    // Bets
    const [bets, setBets] = useState<any[]>([]);
    const [betsLoading, setBetsLoading] = useState(true);
    const [betIndex, setBetIndex] = useState(0);

    // Dialogs
    const [dialog, setDialog] = useState<
        | { kind: 'none' }
        | { kind: 'topup' | 'withdraw' }
        | { kind: 'match-main'; bettor: Bettor; opposite: Selection }
        | { kind: 'match-sub'; market: SubFixtureMarket; pledge: SubFixturePledge; selection: string }
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
            const p = await fetchPledges(channelId, fixture.matchId || fixture.id, authToken);
            setPledges(p);
        } finally {
            setPledgesLoading(false);
        }
    }, [fixture, channelId, authToken, fetchPledges]);

    const loadSubFixtures = useCallback(async () => {
        setSubFixturesLoading(true);
        setSubFixturesError(null);
        try {
            const markets = await fetchSubFixtures(fixture.matchId || fixture.id, authToken);
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
                const p = await fetchSubFixturePledges(marketId, fixture.matchId || fixture.id, authToken);
                setSubPledges((s) => ({ ...s, [marketId]: p }));
            } catch (e: any) {
                setSubPledgesError((s) => ({ ...s, [marketId]: e?.message ?? 'Failed' }));
            } finally {
                setSubPledgesLoading((s) => ({ ...s, [marketId]: false }));
            }
        },
        [subPledges, subPledgesLoading, fetchSubFixturePledges, fixture, authToken],
    );

    const loadBets = useCallback(async () => {
        setBetsLoading(true);
        try {
            const b = await fetchBets(channelId, fixture.matchId || fixture.id, authToken);
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
                const b = await fetchBalance(userId, authToken, { forceRefresh: force });
                setBalance(b);
            } finally {
                setBalanceLoading(false);
            }
        },
        [isLoggedIn, userId, authToken, fetchBalance],
    );

    useEffect(() => {
        if (!visible) return;
        void refreshBalance(false);
        void loadVoters();
        void loadPledges();
        if (showSubFixtures) void loadSubFixtures();
        if (showBets) void loadBets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    // ── Vote ─────────────────────────────────────────────────────
    const voteStats = useMemo(() => {
        let home = 0, away = 0;
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
        if (voterFilter === 'home')
            return voters.filter((v) => v.selection === 'home_team' || v.selection === 'home');
        if (voterFilter === 'away')
            return voters.filter((v) => v.selection === 'away_team' || v.selection === 'away');
        return voters;
    }, [voters, voterFilter]);

    async function handleVote() {
        if (channelId.length === 0) {
            onShowJoinGroups?.();
            onClose();
            return;
        }
        if (isLive || !selectedVote || hasUserVoted) return;
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

    // ── Match main pledge ────────────────────────────────────────
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
            pledge.selection === 'home' || pledge.selection === 'home_team' ? 'away' : 'home';
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
        } else {
            Alert.alert('Match failed', res.message ?? 'Please try again');
        }
    }

    // ── Match sub pledge ─────────────────────────────────────────
    async function startMatchSub(market: SubFixtureMarket, pledge: SubFixturePledge) {
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
        const all =
            market.marketType === 'over_under_2_5'
                ? ['over', 'under']
                : ['home', 'away', 'none'];
        const available = all.filter((k) => k !== pledge.selection);
        setDialog({ kind: 'match-sub', market, pledge, selection: available[0] });
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

    // ── Channel validation screen ────────────────────────────────
    if (channelId.length === 0) {
        return (
            <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
                <Pressable style={styles.backdrop} onPress={onClose}>
                    <Pressable
                        style={[styles.sheet, { height: screenH * 0.78 }]}
                        onPress={() => { }}
                    >
                        <HandleBar />
                        <View style={styles.joinGroupBox}>
                            <Text style={styles.joinGroupEmoji}>🚫</Text>
                            <Text style={styles.joinGroupTitle}>Join a Group First</Text>
                            <Text style={styles.joinGroupBody}>
                                You need to join a group to vote, pledge, and interact with this match
                            </Text>
                            <Pressable
                                onPress={() => {
                                    onClose();
                                    onShowJoinGroups?.();
                                }}
                                style={styles.joinGroupBtn}
                            >
                                <Text style={styles.joinGroupBtnText}>Join a Group</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    }

    // ── Main render ──────────────────────────────────────────────
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable
                    style={[styles.sheet, { height: screenH * 0.78 }]}
                    onPress={() => { }}
                >
                    <HandleBar />

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerIcon}>
                            <Text style={{ fontSize: 16 }}>
                                {tab === 0 ? '🗳' : tab === 1 ? '💰' : tab === 2 ? '🎲' : '🏆'}
                            </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>{tabs[tab] ?? 'Votes'}</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeBtnText}>✕</Text>
                        </Pressable>
                    </View>

                    {/* Match header */}
                    <View style={styles.matchHeader}>
                        <Text style={[styles.teamChip, styles.teamChipHome]}>
                            {fixture.homeTeam}
                        </Text>
                        <Text style={styles.vsText}>VS</Text>
                        <Text style={[styles.teamChip, styles.teamChipAway]}>
                            {fixture.awayTeam}
                        </Text>
                        {isLive && (
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                        )}
                    </View>

                    {/* Tab bar */}
                    {tabs.length > 1 && (
                        <TabBar tabs={tabs} active={tab} onChange={setTab} />
                    )}

                    {/* Body */}
                    <View style={{ flex: 1, overflow: 'hidden' }}>
                        {isLive && <LiveOverlay />}
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingBottom: 12 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            {tab === 0 && renderVotesTab()}
                            {tab === 1 && showPledges && renderPledgesTab()}
                            {tab === 2 && showSubFixtures && renderSubFixturesTab()}
                            {tab === 3 && showBets && renderBetsTab()}
                        </ScrollView>
                    </View>

                    {/* Share */}
                    <View style={styles.backdrop}>
                        <Pressable
                            onPress={async () => {
                                const message =
                                    `⚔️ Join the voting on Funzy!\n\n` +
                                    `📊 Vote on: ${fixture.homeTeam} vs ${fixture.awayTeam}\n` +
                                    `🏆 ${fixture.league}\n\n` +
                                    `Download the app and vote now!`;
                                try {
                                    await Share.share({ message });
                                } catch { }
                            }}
                            style={styles.closeBtn}
                        >
                            <Text style={styles.closeBtnText}>↗</Text>
                            <Text style={styles.closeBtn}>Share Match</Text>
                        </Pressable>
                    </View>

                    {/* Dialogs */}
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
                                setDialog((d) => (d.kind === 'match-sub' ? { ...d, selection: sel } : d))
                            }
                            onCancel={() => setDialog({ kind: 'none' })}
                            onConfirm={() => {
                                const { market, pledge, selection } = dialog;
                                setDialog({ kind: 'none' });
                                void executeMatchSub(market, pledge, selection);
                            }}
                        />
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );

    // ── Tab renders ──────────────────────────────────────────────
    function renderVotesTab() {
        const effectiveSelection = hasUserVoted ? userVoteSelection : selectedVote;
        const locked = hasUserVoted || isLive;
        const outcomes: Array<{ key: Selection; label: string; isHome: boolean; count: number }> = [
            { key: 'home', label: fixture.homeTeam, isHome: true, count: voteStats.homeCount },
            { key: 'away', label: fixture.awayTeam, isHome: false, count: voteStats.awayCount },
        ];

        return (
            <View>
                <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 8 }}>
                    {outcomes.map((o) => {
                        const selected =
                            effectiveSelection === o.key || effectiveSelection === `${o.key}_team`;
                        const accent = o.isHome ? C.primary : C.away;
                        const dim = o.isHome ? C.primaryDim : C.awayDim;
                        return (
                            <Pressable
                                key={o.key}
                                onPress={() => !locked && setSelectedVote(o.key)}
                                disabled={locked}
                                style={[
                                    styles.outcomeCard,
                                    selected && { backgroundColor: dim, borderColor: 'transparent' },
                                ]}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.outcomeLabel,
                                        { color: selected ? accent : C.textPrimary },
                                    ]}
                                >
                                    {o.label}
                                </Text>
                                <Text style={[styles.outcomeCount, { color: accent }]}>{o.count}</Text>
                                {locked && selected && (
                                    <Text style={{ fontSize: 10, color: accent }}>✓</Text>
                                )}
                            </Pressable>
                        );
                    })}
                </View>

                {selectedVote && !hasUserVoted && !isLive && (
                    <Pressable
                        onPress={handleVote}
                        disabled={voting}
                        style={[styles.primaryBtn, { marginHorizontal: 16, marginTop: 10 }]}
                    >
                        <Text style={styles.primaryBtnText}>
                            {voting ? '…' : 'Confirm Vote'}
                        </Text>
                    </Pressable>
                )}

                {/* Filter chips */}
                <View style={styles.filterRow}>
                    {(
                        [
                            ['all', 'All', voteStats.total],
                            ['home', 'Home', voteStats.homeCount],
                            ['away', 'Away', voteStats.awayCount],
                        ] as const
                    ).map(([key, label, count]) => {
                        const selected = voterFilter === key;
                        return (
                            <Pressable
                                key={key}
                                onPress={() => setVoterFilter(key)}
                                style={[
                                    styles.filterChip,
                                    selected && { backgroundColor: C.primary },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        selected && { color: C.white },
                                    ]}
                                >
                                    {label} {count > 0 ? count : ''}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {votersLoading && voters.length === 0 ? (
                    <Spinner label="Loading votes…" />
                ) : filteredVoters.length === 0 ? (
                    <Empty
                        icon="🗳"
                        label={voterFilter === 'all' ? 'No votes yet' : 'No votes for this selection'}
                    />
                ) : (
                    filteredVoters.map((v: any, i) => {
                        const isMe = v.userId === userId;
                        const accent = voteColor(v.selection);
                        const pick = displayVote(v.selection);
                        return (
                            <PersonTile
                                key={v.userId ?? i}
                                name={isMe ? 'You' : v.userName}
                                subtitle={v.isComrade && !isMe ? 'comrade' : 'voter'}
                                accent={accent}
                                isMe={isMe}
                                badge={pick.toUpperCase()}
                                badgeColor={accent}
                                amountLabel={pick}
                            />
                        );
                    })
                )}
            </View>
        );
    }

    function renderPledgesTab() {
        return (
            <View style={{ padding: 12, gap: 8 }}>
                <BalanceBar
                    loading={balanceLoading}
                    balance={balance}
                    processing={processingPayment}
                    onTopUp={() => setDialog({ kind: 'topup' })}
                    onWithdraw={() => setDialog({ kind: 'withdraw' })}
                />

                <Text style={styles.hintText}>
                    {hasUserPledged
                        ? '💰 You can pledge multiple times on different picks'
                        : 'Select your pick and enter amount to pledge'}
                </Text>

                <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(
                        [
                            ['home', fixture.homeTeam, true],
                            ['away', fixture.awayTeam, false],
                        ] as const
                    ).map(([key, label, isHome]) => {
                        const selected = selectedPledgeOption === key;
                        const accent = isHome ? C.primary : C.away;
                        const dim = isHome ? C.primaryDim : C.awayDim;
                        return (
                            <Pressable
                                key={key}
                                onPress={() => !isLive && setSelectedPledgeOption(key)}
                                disabled={isLive}
                                style={[
                                    styles.outcomeCard,
                                    selected && { backgroundColor: dim, borderColor: 'transparent' },
                                ]}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.outcomeLabel,
                                        { color: selected ? accent : C.textPrimary },
                                    ]}
                                >
                                    {label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                        value={pledgeAmount}
                        onChangeText={setPledgeAmount}
                        placeholder="Amount (KES)"
                        placeholderTextColor={C.textTertiary}
                        keyboardType="numeric"
                        editable={!!selectedPledgeOption && !isLive}
                        style={styles.input}
                    />
                    <Pressable
                        onPress={handlePledge}
                        disabled={pledging || !selectedPledgeOption || !pledgeAmount || isLive}
                        style={[styles.pillBtn, { opacity: pledging ? 0.6 : 1 }]}
                    >
                        <Text style={styles.pillBtnText}>{pledging ? '…' : 'Pledge'}</Text>
                    </Pressable>
                </View>

                <View style={styles.hairline} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.sectionLabel}>Pledges ({pledges.length})</Text>
                    {pledgesLoading && <ActivityIndicator size="small" color={C.primary} />}
                </View>

                {pledgesLoading && pledges.length === 0 ? (
                    <Spinner label="Loading pledges…" />
                ) : pledges.length === 0 ? (
                    <Empty icon="💰" label="No pledges yet" />
                ) : (
                    pledges.map((p) => {
                        const isMe = p.userId === userId;
                        const accent = voteColor(p.selection);
                        const canMatch = !isMe && p.isOpen && !isLive;
                        return (
                            <PersonTile
                                key={p.betId}
                                name={isMe ? 'You' : p.userName}
                                subtitle={isMe ? 'your pledge' : 'pledged'}
                                accent={accent}
                                isMe={isMe}
                                badge={p.isOpen ? 'OPEN' : 'MATCHED'}
                                badgeColor={p.isOpen ? C.primary : C.textTertiary}
                                amountLabel={`KES ${p.amount.toFixed(2)}`}
                                trailing={
                                    canMatch ? (
                                        <Pressable
                                            onPress={() => startMatchMain(p)}
                                            style={styles.matchBtn}
                                        >
                                            <Text style={styles.matchBtnText}>MATCH</Text>
                                        </Pressable>
                                    ) : undefined
                                }
                            />
                        );
                    })
                )}
            </View>
        );
    }

    function renderSubFixturesTab() {
        if (subFixturesLoading && subFixtures.length === 0)
            return <Spinner label="Loading sub-fixtures…" />;
        if (subFixturesError && subFixtures.length === 0)
            return (
                <Empty
                    icon="⚠"
                    label={subFixturesError}
                    actionLabel="Retry"
                    onAction={() => void loadSubFixtures()}
                />
            );
        if (subFixtures.length === 0) return null;

        return (
            <View style={{ padding: 12, gap: 8 }}>
                <BalanceBar
                    loading={balanceLoading}
                    balance={balance}
                    processing={processingPayment}
                    onTopUp={() => setDialog({ kind: 'topup' })}
                    onWithdraw={() => setDialog({ kind: 'withdraw' })}
                />

                {subFixtures.map((market) => {
                    const isLineMarket = market.marketType === 'over_under_2_5';
                    const outcomes = isLineMarket
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
                    const locked = isLive || market.status !== 'open';
                    const expanded = expandedSubs[market.id] ?? false;
                    const pledges = subPledges[market.id] ?? [];
                    const isLoading = subPledgesLoading[market.id] ?? false;
                    const error = subPledgesError[market.id];
                    const filter = subPledgeFilters[market.id] ?? 'all';
                    const filtered =
                        filter === 'all' ? pledges : pledges.filter((p) => p.selection === filter);
                    const isPledging = pledgingSubIds.has(market.id);
                    const title = market.marketType.replaceAll('_', ' ').toUpperCase();

                    return (
                        <View key={market.id} style={styles.subCard}>
                            <Pressable
                                onPress={() => {
                                    setExpandedSubs((s) => ({ ...s, [market.id]: !expanded }));
                                    if (!expanded) void loadSubPledges(market.id);
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                            >
                                <Text style={{ fontSize: 14 }}>🎲</Text>
                                <Text style={[styles.sectionLabel, { flex: 1 }]} numberOfLines={1}>
                                    {title}
                                </Text>
                                <Text
                                    style={[
                                        styles.smallPill,
                                        {
                                            backgroundColor:
                                                market.status === 'open' ? C.primaryDim : C.surfaceSunken,
                                            color: market.status === 'open' ? C.primary : C.draw,
                                        },
                                    ]}
                                >
                                    {market.status.toUpperCase()}
                                </Text>
                                <Text style={{ color: C.textTertiary }}>{expanded ? '▲' : '▼'}</Text>
                            </Pressable>

                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                                {outcomes.map((o) => {
                                    const on = selected === o.key;
                                    return (
                                        <Pressable
                                            key={o.key}
                                            onPress={() =>
                                                !locked && setSubSelections((s) => ({ ...s, [market.id]: o.key }))
                                            }
                                            disabled={locked}
                                            style={[
                                                styles.outcomeCard,
                                                on && { backgroundColor: C.primaryDim, borderColor: 'transparent' },
                                            ]}
                                        >
                                            <Text
                                                numberOfLines={1}
                                                style={[styles.outcomeLabel, { color: on ? voteColor(o.key) : C.textPrimary }]}
                                            >
                                                {o.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            {market.status === 'open' && !isLive && (
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
                                    <TextInput
                                        value={subAmounts[market.id] ?? ''}
                                        onChangeText={(v) => setSubAmounts((s) => ({ ...s, [market.id]: v }))}
                                        placeholder="Amount (KES)"
                                        placeholderTextColor={C.textTertiary}
                                        keyboardType="numeric"
                                        editable={!!selected}
                                        style={styles.input}
                                    />
                                    <Pressable
                                        onPress={() => handleSubFixturePledge(market)}
                                        disabled={isPledging || !selected}
                                        style={[styles.pillBtn, { opacity: isPledging || !selected ? 0.6 : 1 }]}
                                    >
                                        <Text style={styles.pillBtnText}>{isPledging ? '…' : 'Pledge'}</Text>
                                    </Pressable>
                                </View>
                            )}

                            {expanded && (
                                <View style={{ marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingTop: 10 }}>
                                    {isLoading ? (
                                        <Spinner label="Loading pledges…" />
                                    ) : error ? (
                                        <Empty icon="⚠" label="Failed to load pledges" actionLabel="Retry" onAction={() => void loadSubPledges(market.id)} />
                                    ) : filtered.length === 0 ? (
                                        <Empty icon="💰" label="No pledges yet" />
                                    ) : (
                                        filtered.map((p) => {
                                            const isMe = p.userId === userId;
                                            const canMatch = !isMe && p.status === 'open' && market.status === 'open' && !isLive;
                                            const matching = matchingSubIds.has(p.id);
                                            return (
                                                <PersonTile
                                                    key={p.id}
                                                    name={p.userName}
                                                    subtitle={`Pledged ${p.amount.toFixed(2)} KES`}
                                                    accent={voteColor(p.selection)}
                                                    isMe={isMe}
                                                    badge={isMe ? 'YOU' : undefined}
                                                    badgeColor={C.primary}
                                                    amountLabel={p.selection.toUpperCase()}
                                                    trailing={
                                                        canMatch ? (
                                                            <Pressable onPress={() => startMatchSub(market, p)} disabled={matching} style={styles.matchBtn}>
                                                                <Text style={styles.matchBtnText}>{matching ? '…' : 'MATCH'}</Text>
                                                            </Pressable>
                                                        ) : undefined
                                                    }
                                                />
                                            );
                                        })
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        );
    }

    function renderBetsTab() {
        if (betsLoading) return <Spinner label="Loading bets…" />;
        if (bets.length === 0) return <Empty icon="🏆" label="No active bets" />;
        const bet = bets[Math.min(betIndex, bets.length - 1)];
        return (
            <View style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
                    {bets.map((_, i) => (
                        <View
                            key={i}
                            style={{
                                height: 4,
                                width: i === betIndex ? 16 : 6,
                                borderRadius: 2,
                                backgroundColor: i === betIndex ? C.primary : C.border,
                            }}
                        />
                    ))}
                </View>
                <View style={styles.subCard}>
                    <Text style={styles.sectionLabel}>
                        {bet.starterName} vs {bet.finisherName ?? 'Waiting'}
                    </Text>
                    <Text style={[styles.hintText, { marginTop: 4 }]}>
                        Pot: KES {(bet.totalPot ?? 0).toFixed(2)}
                    </Text>
                </View>
            </View>
        );
    }
}

// ── Sub-components ─────────────────────────────────────────────
function HandleBar() {
    return (
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
            <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: C.border }} />
        </View>
    );
}

function Spinner({ label }: { label: string }) {
    return (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <ActivityIndicator size="small" color={C.primary} />
            <Text style={{ fontSize: 11, color: C.textTertiary }}>{label}</Text>
        </View>
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
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 6 }}>
            <Text style={{ fontSize: 32, opacity: 0.4 }}>{icon}</Text>
            <Text style={{ fontSize: 11, color: C.textTertiary }}>{label}</Text>
            {actionLabel && onAction && (
                <Pressable
                    onPress={onAction}
                    style={{
                        marginTop: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor: C.primaryDim,
                    }}
                >
                    <Text style={{ fontSize: 9, fontWeight: '600', color: C.primary }}>
                        {actionLabel}
                    </Text>
                </Pressable>
            )}
        </View>
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
        <View style={styles.balanceBar}>
            <Text style={{ fontSize: 14 }}>💰</Text>
            <Text style={[styles.sectionLabel, { flex: 1 }]}>
                {loading ? 'Loading…' : `KES ${balance.toFixed(2)}`}
            </Text>
            <Pressable onPress={onTopUp} disabled={processing} style={styles.smallPrimary}>
                <Text style={styles.smallPrimaryText}>Add</Text>
            </Pressable>
            <Pressable onPress={onWithdraw} disabled={processing} style={styles.smallAway}>
                <Text style={styles.smallPrimaryText}>Withdraw</Text>
            </Pressable>
        </View>
    );
}

function PersonTile({
    name,
    subtitle,
    accent,
    isMe,
    badge,
    badgeColor,
    amountLabel,
    trailing,
}: {
    name: string;
    subtitle: string;
    accent: string;
    isMe?: boolean;
    badge?: string;
    badgeColor?: string;
    amountLabel?: string;
    trailing?: React.ReactNode;
}) {
    const initial = name?.[0]?.toUpperCase() ?? '?';
    return (
        <View
            style={[
                styles.personTile,
                isMe && { backgroundColor: C.primaryDim, borderColor: C.borderActive },
            ]}
        >
            <View style={styles.avatar}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: accent }}>{initial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text
                        numberOfLines={1}
                        style={[styles.personName, { color: isMe ? C.primary : C.textPrimary }]}
                    >
                        {name}
                    </Text>
                    {badge && (
                        <Text
                            style={[
                                styles.smallPill,
                                { backgroundColor: C.primaryDim, color: badgeColor ?? C.primary },
                            ]}
                        >
                            {badge}
                        </Text>
                    )}
                </View>
                <Text style={{ fontSize: 8.5, color: C.textTertiary }}>{subtitle}</Text>
            </View>
            {amountLabel && !trailing && (
                <Text style={{ fontSize: 10, fontWeight: '700', color: C.textPrimary }}>
                    {amountLabel}
                </Text>
            )}
            {trailing}
        </View>
    );
}

function TabBar({
    tabs,
    active,
    onChange,
}: {
    tabs: string[];
    active: number;
    onChange: (i: number) => void;
}) {
    const anim = useRef(new Animated.Value(active)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: active,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [active, anim]);

    return (
        <View style={styles.tabBar}>
            {tabs.map((label, i) => {
                const on = i === active;
                return (
                    <Pressable key={label} onPress={() => onChange(i)} style={styles.tabButton}>
                        <Text
                            style={[
                                styles.tabText,
                                { color: on ? C.textPrimary : C.textTertiary },
                            ]}
                        >
                            {label}
                        </Text>
                        {on && <View style={styles.tabUnderline} />}
                    </Pressable>
                );
            })}
        </View>
    );
}

function LiveOverlay() {
    return (
        <View style={styles.liveOverlay} pointerEvents="auto">
            <Text style={{ fontSize: 32 }}>⚽</Text>
            <Text style={styles.liveOverlayTitle}>⛔ Match is Live</Text>
            <Text style={styles.liveOverlaySub}>Voting &amp; betting are disabled</Text>
            <View style={styles.liveBadgeLg}>
                <Text style={styles.liveText}>● LIVE</Text>
            </View>
        </View>
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
        <Pressable style={styles.dialogBackdrop} onPress={onCancel}>
            <Pressable style={styles.dialogCard} onPress={() => { }}>
                {children}
            </Pressable>
        </Pressable>
    );
}

function MatchMainDialog({
    fixture,
    pledge,
    selection,
    onCancel,
    onConfirm,
}: {
    fixture: FixtureLite;
    pledge: Bettor;
    selection: Selection;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const label = selection === 'home' ? fixture.homeTeam : fixture.awayTeam;
    const accent = selection === 'home' ? C.primary : C.away;
    const dim = selection === 'home' ? C.primaryDim : C.awayDim;
    return (
        <DialogShell onCancel={onCancel}>
            <Text style={styles.dialogTitle}>Match Pledge</Text>
            <View style={styles.dialogSummary}>
                <Text style={{ fontSize: 10, color: C.textPrimary }}>
                    {pledge.userName} · Picked {pledge.selectionDisplay}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary }}>
                    KES {pledge.amount.toFixed(2)}
                </Text>
            </View>
            <View style={[styles.outcomeCard, { backgroundColor: dim, borderColor: 'transparent', marginBottom: 8 }]}>
                <Text style={[styles.outcomeLabel, { color: accent }]}>{label}</Text>
            </View>
            <Text style={{ fontSize: 8, color: C.away }}>
                Cannot pick {pledge.selectionDisplay}
            </Text>
            <View style={styles.dialogActions}>
                <Pressable onPress={onCancel} style={styles.dialogCancel}>
                    <Text style={styles.dialogCancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={onConfirm} style={styles.dialogConfirm}>
                    <Text style={styles.dialogConfirmText}>Match</Text>
                </Pressable>
            </View>
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
    fixture: FixtureLite;
    market: SubFixtureMarket;
    pledge: SubFixturePledge;
    selection: string;
    onSelectionChange: (s: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const isLineMarket = market.marketType === 'over_under_2_5';
    const all = isLineMarket ? ['over', 'under'] : ['home', 'away', 'none'];
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
            <Text style={styles.dialogTitle}>Match Pledge</Text>
            <View style={styles.dialogSummary}>
                <Text style={{ fontSize: 10, color: C.textPrimary }}>
                    {pledge.userName} · Picked {labelFor(pledge.selection)}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary }}>
                    KES {pledge.amount.toFixed(2)}
                </Text>
            </View>
            <Text style={{ fontSize: 8, color: C.textTertiary, marginBottom: 4 }}>Your pick</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {available.map((k) => {
                    const on = selection === k;
                    return (
                        <Pressable
                            key={k}
                            onPress={() => onSelectionChange(k)}
                            style={[
                                styles.outcomeCard,
                                on && { backgroundColor: C.primaryDim, borderColor: 'transparent' },
                            ]}
                        >
                            <Text style={[styles.outcomeLabel, { color: on ? C.primary : C.textPrimary }]}>
                                {labelFor(k)}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
            <Text style={{ fontSize: 8, color: C.primary }}>
                Stake must match: KES {pledge.amount.toFixed(2)}
            </Text>
            <View style={styles.dialogActions}>
                <Pressable onPress={onCancel} style={styles.dialogCancel}>
                    <Text style={styles.dialogCancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={onConfirm} style={styles.dialogConfirm}>
                    <Text style={styles.dialogConfirmText}>Match</Text>
                </Pressable>
            </View>
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
    const accent = isWithdraw ? C.away : C.primary;

    useEffect(() => {
        void (async () => {
            const saved = await getSavedPhone(mode);
            if (saved) setPhone(saved);
            if (!saved && !isWithdraw) {
                const up = await getUserPhone();
                if (up) setPhone(up);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <DialogShell onCancel={onClose}>
            <Text style={styles.dialogTitle}>
                {isWithdraw ? 'Withdraw Funds' : 'Top Up Balance'}
            </Text>
            <View style={styles.dialogSummary}>
                <Text style={{ fontSize: 10, color: C.textPrimary }}>
                    Balance: KES {balance.toFixed(2)}
                </Text>
            </View>
            <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount (KES)"
                placeholderTextColor={C.textTertiary}
                keyboardType="numeric"
                style={[styles.input, { marginBottom: 8 }]}
            />
            <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="M-Pesa Phone Number"
                placeholderTextColor={C.textTertiary}
                keyboardType="phone-pad"
                editable={!isWithdraw}
                style={[styles.input, { marginBottom: 8, opacity: isWithdraw ? 0.7 : 1 }]}
            />
            {!isWithdraw && (
                <Pressable
                    onPress={() => setUseSaved((v) => !v)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}
                >
                    <View
                        style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            borderWidth: 1,
                            borderColor: C.border,
                            backgroundColor: useSaved ? C.primary : 'transparent',
                        }}
                    />
                    <Text style={{ fontSize: 9, color: C.textTertiary }}>
                        Save this number for future top-ups
                    </Text>
                </Pressable>
            )}
            {!!status && (
                <Text
                    style={{
                        fontSize: 10,
                        color: status.startsWith('✅') ? C.primary : C.away,
                        marginBottom: 8,
                    }}
                >
                    {status}
                </Text>
            )}
            <View style={styles.dialogActions}>
                <Pressable
                    onPress={onClose}
                    disabled={busy || processing}
                    style={styles.dialogCancel}
                >
                    <Text style={styles.dialogCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                    onPress={async () => {
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
                    style={[styles.dialogConfirm, { backgroundColor: accent }]}
                >
                    <Text style={styles.dialogConfirmText}>
                        {busy || processing ? '…' : isWithdraw ? 'Withdraw' : 'Pay via M-Pesa'}
                    </Text>
                </Pressable>
            </View>
        </DialogShell>
    );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: C.background,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 10,
        gap: 8,
    },
    headerIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: C.primaryDim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: C.textPrimary,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: C.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
    matchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 16,
        marginBottom: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: C.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.border,
        gap: 8,
    },
    teamChip: {
        fontSize: 11,
        fontWeight: '700',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        overflow: 'hidden',
    },
    teamChipHome: { backgroundColor: C.primaryDim, color: C.primary },
    teamChipAway: { backgroundColor: C.awayDim, color: C.away },
    vsText: { fontSize: 10, fontWeight: '700', color: C.textTertiary },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.awayDim,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.away },
    liveText: { fontSize: 7, fontWeight: '700', color: C.away },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginVertical: 4,
        padding: 3,
        borderRadius: 10,
        backgroundColor: C.surfaceSunken,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.border,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: 8,
    },
    tabText: { fontSize: 10, fontWeight: '600' },
    tabUnderline: {
        position: 'absolute',
        bottom: 0,
        left: '25%',
        right: '25%',
        height: 2,
        borderRadius: 1,
        backgroundColor: C.primary,
    },
    outcomeCard: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: C.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.border,
        alignItems: 'center',
        gap: 2,
    },
    outcomeLabel: { fontSize: 11, fontWeight: '600' },
    outcomeCount: { fontSize: 10, fontWeight: '700' },
    filterRow: {
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    filterChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 14,
        backgroundColor: C.primaryDim,
    },
    filterChipText: { fontSize: 8, fontWeight: '600', color: C.primary },
    hintText: { fontSize: 9, color: C.textTertiary },
    input: {
        flex: 1,
        borderRadius: 8,
        backgroundColor: C.surfaceSunken,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.border,
        paddingHorizontal: 10,
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        fontSize: 12,
        color: C.textPrimary,
    },
    pillBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: C.primary,
    },
    pillBtnText: { fontSize: 11, fontWeight: '700', color: C.white },
    primaryBtn: {
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: C.primary,
        alignItems: 'center',
    },
    primaryBtnText: { fontSize: 11, fontWeight: '700', color: C.white },
    hairline: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: C.border,
        marginVertical: 6,
    },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textPrimary },
    smallPill: {
        fontSize: 8,
        fontWeight: '700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        overflow: 'hidden',
    },
    subCard: {
        borderRadius: 10,
        backgroundColor: C.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.border,
        padding: 10,
        marginBottom: 8,
    },
    balanceBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: C.primaryDim,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.borderActive,
    },
    smallPrimary: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: C.primary,
    },
    smallAway: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: C.away,
    },
    smallPrimaryText: { fontSize: 9, fontWeight: '700', color: C.white },
    personTile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: C.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.border,
        marginBottom: 4,
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: C.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    personName: { fontSize: 10, fontWeight: '600' },
    matchBtn: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: C.primary,
    },
    matchBtnText: { fontSize: 8, fontWeight: '700', color: C.white },
    liveOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        gap: 6,
    },
    liveOverlayTitle: { fontSize: 18, fontWeight: '700', color: C.white },
    liveOverlaySub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
    liveBadgeLg: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: C.away,
    },
    dialogBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 20,
    },
    dialogCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 16,
    },
    dialogTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary, marginBottom: 10 },
    dialogSummary: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: C.surfaceSunken,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.border,
        marginBottom: 10,
        gap: 2,
    },
    dialogActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 12,
    },
    dialogCancel: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    dialogCancelText: { fontSize: 11, fontWeight: '600', color: C.textSecondary },
    dialogConfirm: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: C.primary,
    },
    dialogConfirmText: { fontSize: 11, fontWeight: '700', color: C.white },
    joinGroupBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 10,
    },
    joinGroupEmoji: { fontSize: 56, color: C.textTertiary },
    joinGroupTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
    joinGroupBody: {
        fontSize: 13,
        color: C.textTertiary,
        textAlign: 'center',
    },
    joinGroupBtn: {
        marginTop: 12,
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: C.primary,
    },
    joinGroupBtnText: { fontSize: 14, fontWeight: '600', color: C.white },
});