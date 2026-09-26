import { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useAftermatch } from '@funspot/core';
import type {
    AftermatchData,
    AftermatchVoter,
    AftermatchPledge,
    AftermatchBet,
    AftermatchSubFixture,
    Fixture,
} from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

type TabKey = 'votes' | 'pledges' | 'bets' | 'subfixtures';
type VoterFilter = 'all' | 'home' | 'draw' | 'away';

export function AftermatchReviewModal({
    visible,
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
}: {
    visible: boolean;
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
}) {
    const colors = useFanColors();
    const styles = createStyles(colors);

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
        if (showSubFixturesTab) labels.push({ key: 'subfixtures', label: 'Subs' });
        return labels;
    }, [showPledgesTab, showBetsTab, showSubFixturesTab]);

    const [tab, setTab] = useState<TabKey>('votes');

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={() => { }}>
                    {/* Handle */}
                    <View style={styles.handleWrap}>
                        <View style={styles.handle} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerIcon}>
                            <Text style={{ fontSize: 16 }}>🏆</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.headerTitle}>Match Review</Text>
                            <Text style={styles.headerSub} numberOfLines={1}>
                                {fixture.homeTeam} vs {fixture.awayTeam}
                            </Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeBtnText}>✕</Text>
                        </Pressable>
                    </View>

                    {isLoading ? (
                        <LoadingState styles={styles} />
                    ) : isError || !data ? (
                        <ErrorState styles={styles} onRetry={() => refetch()} />
                    ) : (
                        <>
                            <ResultBanner fixture={fixture} data={data} styles={styles} />

                            {/* Tabs */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.tabBar}
                            >
                                {tabLabels.map(({ key, label }) => {
                                    const active = tab === key;
                                    return (
                                        <Pressable
                                            key={key}
                                            onPress={() => setTab(key)}
                                            style={[styles.tab, active && styles.tabActive]}
                                        >
                                            <Text
                                                style={[styles.tabText, active && styles.tabTextActive]}
                                            >
                                                {label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>

                            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
                                {tab === 'votes' && (
                                    <VotesTab voters={data.voters} userId={userId} styles={styles} colors={colors} />
                                )}
                                {tab === 'pledges' && (
                                    <PledgesTab pledges={data.pledges} userId={userId} styles={styles} colors={colors} />
                                )}
                                {tab === 'bets' && (
                                    <BetsTab bets={data.bets} userId={userId} styles={styles} colors={colors} />
                                )}
                                {tab === 'subfixtures' && (
                                    <SubFixturesTab markets={data.subFixtures} fixture={fixture} userId={userId} styles={styles} colors={colors} />
                                )}
                            </ScrollView>

                            {/* Share */}
                            <View style={styles.shareWrap}>
                                <Pressable onPress={() => shareResults(fixture, data)} style={styles.shareBtn}>
                                    <Text style={styles.shareIcon}>↗</Text>
                                    <Text style={styles.shareText}>Share Results</Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ── Result banner ──────────────────────────────────────────────
function ResultBanner({
    fixture,
    data,
    styles,
}: {
    fixture: Fixture;
    data: AftermatchData;
    styles: any;
}) {
    const winner = data.winner;
    const tone =
        winner === 'home'
            ? 'primary'
            : winner === 'away'
                ? 'away'
                : winner === 'draw'
                    ? 'draw'
                    : 'muted';
    const label =
        winner === 'home'
            ? `🏠 ${fixture.homeTeam} Won!`
            : winner === 'away'
                ? `✈️ ${fixture.awayTeam} Won!`
                : winner === 'draw'
                    ? '🤝 Draw!'
                    : '⏳ Match Pending';

    return (
        <View style={[styles.banner, styles[`banner_${tone}`]]}>
            <Text style={[styles.bannerLabel, styles[`bannerLabel_${tone}`]]}>
                {label}
            </Text>
            <View style={[styles.bannerScore, styles[`bannerScore_${tone}`]]}>
                <Text style={[styles.bannerScoreText, styles[`bannerLabel_${tone}`]]}>
                    {data.homeScore} - {data.awayScore}
                </Text>
            </View>
        </View>
    );
}

// ── Votes tab ──────────────────────────────────────────────────
function VotesTab({
    voters,
    userId,
    styles,
    colors,
}: {
    voters: AftermatchVoter[];
    userId: string;
    styles: any;
    colors: any;
}) {
    const [filter, setFilter] = useState<VoterFilter>('all');

    const stats = useMemo(() => {
        let home = 0, away = 0, draw = 0;
        for (const v of voters) {
            if (v.selection === 'home') home++;
            else if (v.selection === 'away') away++;
            else if (v.selection === 'draw') draw++;
        }
        return { home, away, draw };
    }, [voters]);

    const correct = voters.filter((v) => v.result === 'won').length;
    const accuracy = voters.length > 0 ? Math.round((correct / voters.length) * 100) : 0;
    const filtered = filter === 'all' ? voters : voters.filter((v) => v.selection === filter);

    if (voters.length === 0) {
        return <Empty styles={styles} icon="🗳" label="No votes recorded" />;
    }

    return (
        <View>
            <View style={styles.chipsRow}>
                <StatChip styles={styles} label="Total" value={voters.length} tone="neutral" />
                <StatChip styles={styles} label="✅ Won" value={correct} tone="primary" />
                <StatChip styles={styles} label={`🎯 ${accuracy}%`} tone="draw" />
            </View>
            <View style={styles.chipsRow}>
                <FilterChip styles={styles} label="All" count={stats.home + stats.away + stats.draw} active={filter === 'all'} onPress={() => setFilter('all')} />
                <FilterChip styles={styles} label="🏠" count={stats.home} active={filter === 'home'} onPress={() => setFilter('home')} />
                <FilterChip styles={styles} label="🤝" count={stats.draw} active={filter === 'draw'} onPress={() => setFilter('draw')} />
                <FilterChip styles={styles} label="✈️" count={stats.away} active={filter === 'away'} onPress={() => setFilter('away')} />
            </View>
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {filtered.map((v) => (
                    <VoterTile key={v.userId} voter={v} isMe={v.userId === userId} styles={styles} colors={colors} />
                ))}
            </View>
        </View>
    );
}

function VoterTile({
    voter,
    isMe,
    styles,
    colors,
}: {
    voter: AftermatchVoter;
    isMe: boolean;
    styles: any;
    colors: any;
}) {
    const won = voter.result === 'won';
    const lost = voter.result === 'lost';
    const selColor =
        voter.selection === 'home'
            ? colors.primary
            : voter.selection === 'away'
                ? colors.away
                : colors.draw;

    return (
        <View style={[styles.tile, isMe && styles.tileMe]}>
            <View style={[styles.avatar, { borderColor: won ? colors.primary : selColor }]}>
                <Text style={[styles.avatarText, { color: won ? colors.primary : selColor }]}>
                    {(isMe ? 'Y' : voter.userName).charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.tileName, isMe && { color: colors.primary }]} numberOfLines={1}>
                        {isMe ? 'You' : voter.userName}
                    </Text>
                    {won && <Badge styles={styles} label="✅ Won" tone="primary" />}
                    {lost && <Badge styles={styles} label="❌ Lost" tone="away" />}
                </View>
                <Text style={[styles.tileSub, { color: selColor }]}>
                    Voted {voter.selection === 'home' ? 'Home' : voter.selection === 'away' ? 'Away' : 'Draw'}
                </Text>
            </View>
            <Badge styles={styles} label={won ? 'Won' : lost ? 'Lost' : '—'} tone={won ? 'primary' : lost ? 'away' : 'muted'} />
        </View>
    );
}

// ── Pledges tab ────────────────────────────────────────────────
function PledgesTab({
    pledges,
    userId,
    styles,
    colors,
}: {
    pledges: AftermatchPledge[];
    userId: string;
    styles: any;
    colors: any;
}) {
    if (pledges.length === 0) return <Empty styles={styles} icon="💰" label="No pledges" />;

    const totalPledged = pledges.reduce((s, p) => s + p.amount, 0);
    const wonCount = pledges.filter((p) => p.result === 'won').length;
    const totalPayout = pledges
        .filter((p) => p.result === 'won')
        .reduce((s, p) => s + (p.payout ?? p.amount * 2), 0);

    return (
        <View>
            <View style={styles.chipsRow}>
                <StatChip styles={styles} label="💰 Total" value={Math.round(totalPledged)} tone="primary" />
                <StatChip styles={styles} label="✅ Won" value={wonCount} tone="primary" />
                <StatChip styles={styles} label="💸 Payout" value={Math.round(totalPayout)} tone="draw" />
            </View>
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {pledges.map((p, i) => (
                    <PledgeTile key={`${p.userId}-${i}`} pledge={p} isMe={p.userId === userId} styles={styles} colors={colors} />
                ))}
            </View>
        </View>
    );
}

function PledgeTile({
    pledge,
    isMe,
    styles,
    colors,
}: {
    pledge: AftermatchPledge;
    isMe: boolean;
    styles: any;
    colors: any;
}) {
    const won = pledge.result === 'won';
    const lost = pledge.result === 'lost';
    const open = pledge.status === 'open';
    const selColor =
        pledge.selection === 'home'
            ? colors.primary
            : pledge.selection === 'away'
                ? colors.away
                : colors.draw;

    return (
        <View style={[styles.tile, isMe && styles.tileMe]}>
            <View style={[styles.avatar, { borderColor: won ? colors.primary : selColor }]}>
                <Text style={[styles.avatarText, { color: won ? colors.primary : selColor }]}>
                    {(isMe ? 'Y' : pledge.userName).charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.tileName, isMe && { color: colors.primary }]} numberOfLines={1}>
                        {isMe ? 'You' : pledge.userName}
                    </Text>
                    {won && <Badge styles={styles} label="✅ Won" tone="primary" />}
                    {lost && <Badge styles={styles} label="❌ Lost" tone="away" />}
                    {open && <Badge styles={styles} label="Open" tone="draw" />}
                </View>
                <Text style={styles.tileSub}>
                    Picked {pledge.selection} · KES {pledge.amount.toFixed(2)}
                </Text>
            </View>
            {pledge.payout != null && (
                <Text style={[styles.payout, { color: colors.primary }]}>
                    💸 KES {pledge.payout.toFixed(2)}
                </Text>
            )}
        </View>
    );
}

// ── Bets tab ───────────────────────────────────────────────────
function BetsTab({
    bets,
    userId,
    styles,
    colors,
}: {
    bets: AftermatchBet[];
    userId: string;
    styles: any;
    colors: any;
}) {
    if (bets.length === 0) return <Empty styles={styles} icon="🏅" label="No bets" />;
    const settled = bets.filter((b) => b.status === 'settled').length;

    return (
        <View>
            <View style={styles.chipsRow}>
                <StatChip styles={styles} label="🏅 Total" value={bets.length} tone="primary" />
                <StatChip styles={styles} label="✅ Settled" value={settled} tone="primary" />
            </View>
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {bets.map((b) => (
                    <BetCard key={b.id} bet={b} userId={userId} styles={styles} colors={colors} />
                ))}
            </View>
        </View>
    );
}

function BetCard({
    bet,
    userId,
    styles,
    colors,
}: {
    bet: AftermatchBet;
    userId: string;
    styles: any;
    colors: any;
}) {
    const isStarter = bet.starterId === userId;
    const isFinisher = bet.finisherId === userId;
    const settled = bet.status === 'settled';
    const starterWon = bet.result === 'starter_won';
    const finisherWon = bet.result === 'finisher_won';

    return (
        <View style={styles.betCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.betId}>Bet #{bet.id.slice(0, 8)}</Text>
                <View style={{ flex: 1 }} />
                <Badge styles={styles} label={settled ? 'Settled' : 'Active'} tone={settled ? 'primary' : 'draw'} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BetSide
                    styles={styles}
                    colors={colors}
                    label={isStarter ? 'YOU' : bet.starterName.toUpperCase()}
                    pick={bet.starterSelection}
                    amount={bet.starterAmount}
                    highlight={isStarter || starterWon}
                    isWinner={starterWon}
                />
                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.vs}>VS</Text>
                    <View style={styles.potPill}>
                        <Text style={styles.potText}>KES {bet.totalPot.toFixed(2)}</Text>
                    </View>
                </View>
                <BetSide
                    styles={styles}
                    colors={colors}
                    label={isFinisher ? 'YOU' : (bet.finisherName ?? '?').toUpperCase()}
                    pick={bet.finisherSelection ?? '?'}
                    amount={bet.finisherAmount ?? 0}
                    highlight={isFinisher || finisherWon}
                    isWinner={finisherWon}
                />
            </View>
            {settled && bet.result && (
                <View style={styles.betResult}>
                    <Text style={[styles.betResultText, { color: colors.primary }]}>
                        🏆 {starterWon ? `${bet.starterName} won` : finisherWon ? `${bet.finisherName ?? 'Finisher'} won` : 'Void'}
                    </Text>
                    {bet.winnerPayout != null && (
                        <Text style={[styles.betResultText, { color: colors.primary }]}>
                            · 💰 KES {bet.winnerPayout.toFixed(2)}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}

function BetSide({
    styles,
    colors,
    label,
    pick,
    amount,
    highlight,
    isWinner,
}: {
    styles: any;
    colors: any;
    label: string;
    pick: string;
    amount: number;
    highlight: boolean;
    isWinner: boolean;
}) {
    return (
        <View style={[styles.betSide, isWinner && styles.betSideWinner]}>
            <Text style={[styles.betSideLabel, { color: highlight ? colors.primary : colors.textTertiary }]} numberOfLines={1}>
                {label}
            </Text>
            <Text style={[styles.betSidePick, { color: isWinner ? colors.primary : colors.textPrimary }]} numberOfLines={1}>
                {pick}
            </Text>
            <Text style={styles.betSideAmount}>KES {amount.toFixed(2)}</Text>
        </View>
    );
}

// ── Sub-fixtures tab ───────────────────────────────────────────
function SubFixturesTab({
    markets,
    fixture,
    userId,
    styles,
    colors,
}: {
    markets: AftermatchSubFixture[];
    fixture: Fixture;
    userId: string;
    styles: any;
    colors: any;
}) {
    if (markets.length === 0) return <Empty styles={styles} icon="🎲" label="No sub-fixtures" />;

    return (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {markets.map((m) => (
                <SubFixtureCard key={m.id} market={m} fixture={fixture} userId={userId} styles={styles} colors={colors} />
            ))}
        </View>
    );
}

function SubFixtureCard({
    market,
    fixture,
    userId,
    styles,
    colors,
}: {
    market: AftermatchSubFixture;
    fixture: Fixture;
    userId: string;
    styles: any;
    colors: any;
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

    return (
        <View style={styles.subCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 14 }}>🎲</Text>
                <Text style={styles.subTitle} numberOfLines={1}>{title}</Text>
                <Badge styles={styles} label={settled ? 'Settled' : 'Pending'} tone={settled ? 'primary' : 'draw'} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {outcomes.map((o) => {
                    const won = market.result === o.key;
                    return (
                        <View key={o.key} style={[styles.outcomeChip, won && styles.outcomeChipWin]}>
                            <Text style={[styles.outcomeText, won && { color: colors.primary, fontWeight: '700' }]}>
                                {o.label} {won && '✅'}
                            </Text>
                        </View>
                    );
                })}
            </View>
            {market.pledges.length > 0 && (
                <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border + '30', paddingTop: 8 }}>
                    {market.pledges.map((p, i) => {
                        const isMe = p.userId === userId;
                        const won = market.result === p.selection;
                        return (
                            <View key={`${p.userId}-${i}`} style={[styles.subPledgeRow, isMe && { backgroundColor: colors.primaryDim }]}>
                                <Text style={{ fontSize: 12 }}>{won ? '🏆' : '•'}</Text>
                                <Text style={[styles.subPledgeName, isMe && { color: colors.primary }]} numberOfLines={1}>
                                    {isMe ? 'You' : p.userName}
                                </Text>
                                <Text style={[styles.subPledgeAmount, { color: colors.primary }]}>
                                    KES {p.amount.toFixed(2)}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

// ── Shared small pieces ────────────────────────────────────────
function StatChip({
    styles,
    label,
    value,
    tone = 'neutral',
}: {
    styles: any;
    label: string;
    value?: number;
    tone?: 'neutral' | 'primary' | 'draw' | 'away';
}) {
    return (
        <View style={[styles.statChip, styles[`statChip_${tone}`]]}>
            <Text style={[styles.statChipText, styles[`statChipText_${tone}`]]}>
                {label}
                {value != null ? ` ${value}` : ''}
            </Text>
        </View>
    );
}

function FilterChip({
    styles,
    label,
    count,
    active,
    onPress,
}: {
    styles: any;
    label: string;
    count: number;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {label} {count}
            </Text>
        </Pressable>
    );
}

function Badge({
    styles,
    label,
    tone,
}: {
    styles: any;
    label: string;
    tone: 'primary' | 'away' | 'draw' | 'muted';
}) {
    return (
        <View style={[styles.badge, styles[`badge_${tone}`]]}>
            <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{label}</Text>
        </View>
    );
}

function Empty({ styles, icon, label }: { styles: any; icon: string; label: string }) {
    return (
        <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{icon}</Text>
            <Text style={styles.emptyLabel}>{label}</Text>
        </View>
    );
}

function LoadingState({ styles }: { styles: any }) {
    return (
        <View style={styles.empty}>
            <Text style={styles.emptyLabel}>Loading match review…</Text>
        </View>
    );
}

function ErrorState({ styles, onRetry }: { styles: any; onRetry: () => void }) {
    return (
        <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⚠</Text>
            <Text style={styles.emptyLabel}>Failed to load match review</Text>
            <Pressable onPress={onRetry} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
            </Pressable>
        </View>
    );
}

function shareResults(fixture: Fixture, data: AftermatchData) {
    // Use react-native Share if you want; skipping for now.
}

// ── Styles ─────────────────────────────────────────────────────
function createStyles(colors: any) {
    return StyleSheet.create({
        backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            height: '78%',
            overflow: 'hidden',
        },
        handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
        handle: { width: 32, height: 3, borderRadius: 2, backgroundColor: colors.border },
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
        headerIcon: {
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.primaryDim,
            alignItems: 'center', justifyContent: 'center',
        },
        headerTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
        headerSub: { fontSize: 11, color: colors.textTertiary },
        closeBtn: {
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: colors.surfaceSunken,
            alignItems: 'center', justifyContent: 'center',
        },
        closeBtnText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

        // Result banner
        banner: {
            marginHorizontal: 16, marginVertical: 6,
            paddingHorizontal: 12, paddingVertical: 8,
            borderRadius: 10, borderWidth: 1,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        },
        banner_primary: { backgroundColor: colors.primaryDim, borderColor: colors.primary + '30' },
        banner_away: { backgroundColor: colors.awayDim ?? colors.primaryDim, borderColor: colors.away + '30' },
        banner_draw: { backgroundColor: colors.surfaceSunken, borderColor: colors.draw + '30' },
        banner_muted: { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
        bannerLabel: { fontSize: 12, fontWeight: '700' },
        bannerLabel_primary: { color: colors.primary },
        bannerLabel_away: { color: colors.away },
        bannerLabel_draw: { color: colors.draw },
        bannerLabel_muted: { color: colors.textTertiary },
        bannerScore: {
            paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
        },
        bannerScore_primary: { backgroundColor: colors.primary + '20' },
        bannerScore_away: { backgroundColor: colors.away + '20' },
        bannerScore_draw: { backgroundColor: colors.draw + '20' },
        bannerScore_muted: { backgroundColor: colors.border + '20' },
        bannerScoreText: { fontSize: 11, fontWeight: '700' },

        // Tabs
        tabBar: { paddingHorizontal: 16, paddingVertical: 6, gap: 4 },
        tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
        tabActive: { backgroundColor: colors.surface },
        tabText: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },
        tabTextActive: { color: colors.textPrimary },

        // Chips
        chipsRow: {
            flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
            gap: 6, paddingHorizontal: 16, paddingVertical: 6,
        },
        statChip: {
            flexDirection: 'row', alignItems: 'center',
            borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
            borderWidth: 1,
        },
        statChip_neutral: { backgroundColor: colors.surfaceSunken, borderColor: colors.border + '30' },
        statChip_primary: { backgroundColor: colors.primaryDim, borderColor: colors.primary + '30' },
        statChip_draw: { backgroundColor: colors.surfaceSunken, borderColor: colors.draw + '30' },
        statChip_away: { backgroundColor: colors.primaryDim, borderColor: colors.away + '30' },
        statChipText: { fontSize: 11, fontWeight: '600' },
        statChipText_neutral: { color: colors.textSecondary },
        statChipText_primary: { color: colors.primary },
        statChipText_draw: { color: colors.draw },
        statChipText_away: { color: colors.away },

        filterChip: {
            borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
            borderWidth: 1, borderColor: colors.border + '30',
        },
        filterChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary + '30' },
        filterChipText: { fontSize: 10, color: colors.textTertiary },
        filterChipTextActive: { color: colors.primary, fontWeight: '600' },

        // Tiles
        tile: {
            flexDirection: 'row', alignItems: 'center', gap: 8,
            borderRadius: 8, borderWidth: 1, borderColor: colors.border + '30',
            backgroundColor: colors.surface,
            paddingHorizontal: 10, paddingVertical: 8,
            marginBottom: 4,
        },
        tileMe: { backgroundColor: colors.primaryDim, borderColor: colors.primary + '40' },
        avatar: {
            width: 24, height: 24, borderRadius: 12,
            borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.surfaceSunken,
        },
        avatarText: { fontSize: 10, fontWeight: '700' },
        tileName: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
        tileSub: { fontSize: 9, color: colors.textTertiary, marginTop: 2 },
        payout: { fontSize: 11, fontWeight: '700' },

        badge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
        badge_primary: { backgroundColor: colors.primaryDim },
        badge_away: { backgroundColor: colors.primaryDim },
        badge_draw: { backgroundColor: colors.surfaceSunken },
        badge_muted: { backgroundColor: colors.surfaceSunken },
        badgeText: { fontSize: 9, fontWeight: '700' },
        badgeText_primary: { color: colors.primary },
        badgeText_away: { color: colors.away },
        badgeText_draw: { color: colors.draw },
        badgeText_muted: { color: colors.textTertiary },

        // Bets
        betCard: {
            borderRadius: 10, borderWidth: 1, borderColor: colors.border + '30',
            backgroundColor: colors.surface,
            padding: 10, marginBottom: 8,
        },
        betId: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
        betSide: {
            flex: 1, alignItems: 'center',
            borderRadius: 6, backgroundColor: colors.surfaceSunken,
            padding: 6,
        },
        betSideWinner: {
            backgroundColor: colors.primaryDim,
            borderWidth: 1, borderColor: colors.primary + '40',
        },
        betSideLabel: { fontSize: 9, fontWeight: '700' },
        betSidePick: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        betSideAmount: { fontSize: 9, color: colors.textTertiary, marginTop: 2 },
        vs: { fontSize: 9, fontWeight: '700', color: colors.textTertiary },
        potPill: {
            backgroundColor: colors.primaryDim, borderRadius: 4,
            paddingHorizontal: 6, paddingVertical: 2, marginTop: 2,
        },
        potText: { fontSize: 9, fontWeight: '700', color: colors.primary },
        betResult: {
            marginTop: 8, paddingTop: 8,
            borderTopWidth: 1, borderTopColor: colors.border + '30',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        },
        betResultText: { fontSize: 10, fontWeight: '600' },

        // Subs
        subCard: {
            borderRadius: 10, borderWidth: 1, borderColor: colors.border + '30',
            backgroundColor: colors.surface,
            padding: 10, marginBottom: 8,
        },
        subTitle: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.textPrimary },
        outcomeChip: {
            borderRadius: 8, backgroundColor: colors.surfaceSunken,
            paddingHorizontal: 8, paddingVertical: 3,
        },
        outcomeChipWin: {
            backgroundColor: colors.primaryDim,
            borderWidth: 1, borderColor: colors.primary + '40',
        },
        outcomeText: { fontSize: 10, color: colors.textSecondary },
        subPledgeRow: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
            marginBottom: 2,
        },
        subPledgeName: { flex: 1, fontSize: 10, color: colors.textPrimary },
        subPledgeAmount: { fontSize: 10, fontWeight: '700' },

        // Empty / loading
        empty: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center', gap: 6 },
        emptyIcon: { fontSize: 40, color: colors.textTertiary, opacity: 0.4 },
        emptyLabel: { fontSize: 11, color: colors.textTertiary },
        retryBtn: {
            marginTop: 8, borderRadius: 8,
            backgroundColor: colors.primary,
            paddingHorizontal: 16, paddingVertical: 6,
        },
        retryText: { fontSize: 11, fontWeight: '600', color: '#fff' },

        // Share
        shareWrap: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border + '20' },
        shareBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 8, paddingVertical: 8,
            backgroundColor: colors.surfaceSunken,
        },
        shareIcon: { fontSize: 12, color: colors.textSecondary },
        shareText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    });
}