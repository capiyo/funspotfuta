// SwipeableVotePledgeModal.tsx
//
// Full RN port of swipeable_vote_pledge_modal.dart, rewritten.
//
// What changed vs the previous version:
//   - In-modal toast banner. An RN <Modal> is its own native window, so the
//     app-root toast provider renders UNDER it. Every rejected action used to
//     look like "nothing happened". Toasts now also render inside the sheet.
//   - KeyboardAvoidingView so the amount field / Pledge button stay visible.
//   - Balance: real errors (no silent 0), tap-to-retry, and refreshBalance()
//     returns the fresh number so shortfall checks never read a stale closure.
//   - onVote / onPledge may return boolean OR { success, message } so the
//     server's own reason is shown.
//   - FundsDialog: no silent returns, waits visibly, shows the real error.
//   - Every loader / action has a catch.
//   - Team names appear once (match header); pills say Home / Away.
//   - Sub-fixture titles/icons/settled results and the bet card restored.

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
    StyleSheet,
    ActivityIndicator,
    Share,
    Platform,
    KeyboardAvoidingView,
    useWindowDimensions,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';

import { FAN_SPACING, FAN_RADIUS, FanColorPalette } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { useToast } from '@/lib/toast/toast-context';
import { ICON, PRESSED_OPACITY } from '@/theme/layout';
import NotificationService from '@/lib/api/notification-service';

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

type Selection = 'home' | 'away';
type BannerKind = 'success' | 'error' | 'warning' | 'info';

export type ActionResult = { success: boolean; message?: string; newBalance?: number };
type MaybeResult = boolean | ActionResult;
const asResult = (r: MaybeResult): ActionResult =>
    typeof r === 'boolean' ? { success: r } : r ?? { success: false };

type PayResult = { success: boolean; newBalance?: number; error?: string; message?: string };

export interface SubFixturePledge {
    id: string;
    userId: string;
    userName: string;
    selection: string;
    amount: number;
    status: string;
    selectionColor?: string;
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
    onVote: (selection: Selection) => Promise<MaybeResult>;
    onPledge: (selection: Selection, amount: number) => Promise<MaybeResult>;
    onShowJoinGroups?: () => void;
    fetchVoters: (fixtureId: string, authToken?: string | null) => Promise<any[]>;
    fetchPledges: (channelId: string, fixtureId: string, authToken?: string | null) => Promise<Bettor[]>;
    fetchSubFixtures: (fixtureId: string, authToken?: string | null) => Promise<SubFixtureMarket[]>;
    fetchSubFixturePledges: (marketId: string, fixtureId: string, authToken?: string | null) => Promise<SubFixturePledge[]>;
    fetchBets: (channelId: string, fixtureId: string, authToken?: string | null) => Promise<any[]>;
    /** Must THROW on failure (not return 0) so the modal can show the reason. */
    fetchBalance: (userId: string, authToken?: string | null, opts?: { forceRefresh?: boolean }) => Promise<number>;
    topUp: (amount: number, phone: string, purpose: string) => Promise<PayResult>;
    withdraw: (amount: number, phone: string) => Promise<PayResult>;
    getSavedPhone: (kind: 'topup' | 'withdraw') => Promise<string | null>;
    savePhone: (kind: 'topup' | 'withdraw', phone: string) => Promise<boolean>;
    getUserPhone: () => Promise<string>;
    placeSubFixturePledge: (args: { fixtureId: string; marketId: string; starterId: string; starterName: string; selection: string; amount: number }) => Promise<{ success: boolean; message?: string }>;
    matchSubFixturePledge: (args: { betId: string; matchId: string; marketId: string; finisherId: string; finisherName: string; selection: string; amount: number }) => Promise<{ success: boolean; message?: string }>;
    matchMainPledge: (args: { betId: string; finisherId: string; finisherName: string; finisherSelection: Selection; amount: number }) => Promise<{ success: boolean; message?: string }>;
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

const isHomeSel = (s?: string | null) => s === 'home' || s === 'home_team';
const isAwaySel = (s?: string | null) => s === 'away' || s === 'away_team';

function voteColorOf(sel: string, colors: FanColorPalette): string {
    if (isHomeSel(sel) || sel === 'over') return colors.primary;
    if (isAwaySel(sel) || sel === 'under') return colors.away;
    if (sel === 'draw') return colors.draw;
    return colors.textTertiary;
}

function dimOf(color: string, colors: FanColorPalette): string {
    if (color === colors.primary) return colors.primaryDim;
    if (color === colors.away) return colors.awayDim;
    if (color === colors.draw) return colors.drawDim;
    if (color === colors.secondary) return colors.secondaryDim;
    const m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return colors.inputSurface;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.12)`;
}

function displayVote(sel: string): string {
    if (isHomeSel(sel)) return 'Home';
    if (isAwaySel(sel)) return 'Away';
    return sel;
}

function timeAgo(value?: string | Date | null): string {
    if (!value) return '';
    const t = (value instanceof Date ? value : new Date(value)).getTime();
    if (Number.isNaN(t)) return '';
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

// Kenyan mobile numbers: 07xx / 01xx / 2547xx / 2541xx / +254...
function isValidPhone(phone: string): boolean {
    const cleaned = phone.replace(/[^0-9]/g, '');
    return /^(0|254)?[17][0-9]{8}$/.test(cleaned);
}

function marketTitle(m: SubFixtureMarket): string {
    switch (m.marketType) {
        case 'first_goal': return 'First Goal';
        case 'first_card': return 'First Card';
        case 'first_corner': return 'First Corner';
        case 'over_under_2_5': return `Total Goals O/U ${(m.line ?? 2.5).toFixed(1)}`;
        default: return m.marketType.split('_').join(' ').toUpperCase();
    }
}

function marketIcon(m: SubFixtureMarket): string {
    switch (m.marketType) {
        case 'first_goal': return '⚽';
        case 'first_card': return '🟨';
        case 'first_corner': return '🚩';
        case 'over_under_2_5': return '📈';
        default: return '🎲';
    }
}

// ─────────────────────────────────────────────────────────────
//  PRIMITIVES
// ─────────────────────────────────────────────────────────────

function Card({
    children, colors, styles, style, tone = 'surface',
}: {
    children: React.ReactNode;
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
    style?: any;
    tone?: 'surface' | 'sunken';
}) {
    return (
        <View
            style={[
                styles.card,
                tone === 'sunken' && { backgroundColor: colors.inputSurface },
                style,
            ]}
        >
            {children}
        </View>
    );
}

function CTA({
    label, onPress, loading, disabled, tone = 'primary', colors, styles, small,
}: {
    label: string;
    onPress?: () => void;
    loading?: boolean;
    disabled?: boolean;
    tone?: 'primary' | 'ghost' | 'danger';
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
    small?: boolean;
}) {
    const isDisabled = disabled || loading;
    const bg =
        tone === 'primary' ? colors.primary :
            tone === 'danger' ? colors.away :
                'transparent';
    const fg = tone === 'ghost' ? colors.textPrimary : colors.background;
    return (
        <Pressable
            onPress={isDisabled ? undefined : onPress}
            disabled={isDisabled}
            style={({ pressed }) => [
                small ? styles.ctaSmall : styles.cta,
                { backgroundColor: bg },
                tone === 'ghost' && {
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    backgroundColor: colors.inputSurface,
                },
                isDisabled && { opacity: 0.5 },
                pressed && !isDisabled && { opacity: PRESSED_OPACITY },
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={fg} />
            ) : (
                <Text style={[small ? styles.ctaSmallText : styles.ctaText, { color: fg }]}>
                    {label}
                </Text>
            )}
        </Pressable>
    );
}

function OutcomePill({
    label, sublabel, selected, locked, accent, onPress, colors, styles,
}: {
    label: string;
    sublabel?: string;
    selected: boolean;
    locked: boolean;
    accent: string;
    onPress?: () => void;
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <Pressable
            onPress={locked ? undefined : onPress}
            disabled={locked}
            style={({ pressed }) => [
                styles.outcomeCard,
                {
                    backgroundColor: selected ? dimOf(accent, colors) : colors.surface,
                    borderColor: selected ? accent : colors.border,
                    borderWidth: selected ? 1.2 : StyleSheet.hairlineWidth,
                },
                pressed && !locked && { opacity: PRESSED_OPACITY },
            ]}
        >
            <Text
                numberOfLines={1}
                style={[
                    fanText('caption', colors, selected ? accent : colors.textPrimary),
                    { fontWeight: '700' },
                ]}
            >
                {label}
            </Text>
            {sublabel && (
                <Text
                    style={[
                        fanText('tag', colors, selected ? accent : colors.textTertiary),
                        { marginTop: 2 },
                    ]}
                >
                    {sublabel}
                </Text>
            )}
            {selected && locked && (
                <View style={[styles.checkDot, { backgroundColor: accent }]}>
                    <Text style={styles.checkDotText}>✓</Text>
                </View>
            )}
        </Pressable>
    );
}

function ActionRow({
    label, trailing, colors, styles,
}: {
    label: string;
    trailing: React.ReactNode;
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <View style={styles.actionRow}>
            <Text style={fanText('caption', colors, colors.textTertiary)}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm }}>
                {trailing}
            </View>
        </View>
    );
}

function SectionHeader({
    title, count, loading, colors, styles,
}: {
    title: string;
    count?: number;
    loading?: boolean;
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={fanText('caption', colors, colors.textSecondary)}>
                {title}
                {typeof count === 'number' ? ` · ${count}` : ''}
            </Text>
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
    );
}

function Chip({
    label, active, onPress, colors, styles,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.filterChip,
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
                pressed && { opacity: PRESSED_OPACITY },
            ]}
        >
            <Text style={fanText('tag', colors, active ? colors.background : colors.textSecondary)}>
                {label}
            </Text>
        </Pressable>
    );
}

function BalanceBar({
    loading, balance, error, processing, onRetry, onTopUp, onWithdraw, colors, styles,
}: {
    loading: boolean;
    balance: number;
    error: string | null;
    processing: boolean;
    onRetry: () => void;
    onTopUp: () => void;
    onWithdraw: () => void;
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <View style={styles.balanceBar}>
            <Text style={{ fontSize: ICON.md }}>💰</Text>
            <Pressable
                style={{ flex: 1, minWidth: 0 }}
                onPress={error ? onRetry : undefined}
            >
                <Text style={fanText('tag', colors, colors.textTertiary)}>Balance</Text>
                <Text
                    numberOfLines={1}
                    style={[
                        fanText('caption', colors, error ? colors.away : colors.textPrimary),
                        { fontWeight: '700' },
                    ]}
                >
                    {loading ? '—' : error ? 'Tap to retry' : `KES ${balance.toFixed(2)}`}
                </Text>
            </Pressable>
            <CTA label="Add" onPress={onTopUp} disabled={processing} small colors={colors} styles={styles} />
            <CTA label="Withdraw" onPress={onWithdraw} disabled={processing} small tone="danger" colors={colors} styles={styles} />
        </View>
    );
}

function PersonTile({
    name, subtitle, accent, isMe, badge, badgeColor, amountLabel, trailing, progress,
    colors, styles,
}: {
    name: string;
    subtitle: string;
    accent: string;
    isMe?: boolean;
    badge?: string;
    badgeColor?: string;
    amountLabel?: string;
    trailing?: React.ReactNode;
    progress?: number; // 0..1
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
}) {
    const initial = name?.[0]?.toUpperCase() ?? '?';
    return (
        <View
            style={[
                styles.personTile,
                isMe && { backgroundColor: colors.primaryDim, borderColor: colors.primary },
            ]}
        >
            <View style={styles.personRow}>
                <View style={[styles.avatar, { backgroundColor: dimOf(accent, colors), borderColor: accent }]}>
                    <Text style={[styles.avatarText, { color: accent }]}>{initial}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.xs }}>
                        <Text
                            numberOfLines={1}
                            style={[
                                fanText('caption', colors, isMe ? colors.primary : colors.textPrimary),
                                { fontWeight: '700' },
                            ]}
                        >
                            {name}
                        </Text>
                        {badge && (
                            <Text style={[fanText('tag', colors, badgeColor ?? colors.primary), styles.miniPill]}>
                                {badge}
                            </Text>
                        )}
                    </View>
                    <Text style={fanText('tag', colors, colors.textTertiary)}>{subtitle}</Text>
                </View>
                {amountLabel && !trailing && (
                    <Text style={[fanText('caption', colors, colors.textPrimary), { fontWeight: '700' }]}>
                        {amountLabel}
                    </Text>
                )}
                {trailing}
            </View>
            {typeof progress === 'number' && (
                <View style={[styles.progressTrack, { backgroundColor: colors.background }]}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                width: `${Math.min(100, Math.max(0, progress * 100))}%` as any,
                                backgroundColor: accent,
                            },
                        ]}
                    />
                </View>
            )}
        </View>
    );
}

function TabBar({
    tabs, active, onChange, colors, styles,
}: {
    tabs: string[];
    active: number;
    onChange: (i: number) => void;
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
}) {
    const widthPct = 100 / tabs.length;
    return (
        <View style={styles.tabBar}>
            <View
                pointerEvents="none"
                style={[
                    styles.tabIndicator,
                    {
                        width: `${widthPct}%` as any,
                        left: `${active * widthPct}%` as any,
                        backgroundColor: colors.primary,
                    },
                ]}
            />
            {tabs.map((label, i) => {
                const on = i === active;
                return (
                    <Pressable
                        key={label}
                        onPress={() => onChange(i)}
                        style={({ pressed }) => [styles.tabButton, pressed && { opacity: PRESSED_OPACITY }]}
                    >
                        <Text
                            numberOfLines={1}
                            style={fanText('caption', colors, on ? colors.background : colors.textSecondary)}
                        >
                            {label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function HandleBar({ colors, styles }: { colors: FanColorPalette; styles: ReturnType<typeof createStyles> }) {
    return (
        <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
    );
}

function Spinner({ label, colors, styles }: { label: string; colors: FanColorPalette; styles: ReturnType<typeof createStyles> }) {
    return (
        <View style={styles.spinnerWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={fanText('tag', colors, colors.textTertiary)}>{label}</Text>
        </View>
    );
}

function Empty({
    icon, label, actionLabel, onAction, colors, styles,
}: {
    icon: string;
    label: string;
    actionLabel?: string;
    onAction?: () => void;
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>{icon}</Text>
            <Text style={fanText('caption', colors, colors.textTertiary)}>{label}</Text>
            {actionLabel && onAction && (
                <Pressable
                    onPress={onAction}
                    style={({ pressed }) => [styles.emptyCta, pressed && { opacity: PRESSED_OPACITY }]}
                >
                    <Text style={fanText('tag', colors, colors.primary)}>{actionLabel}</Text>
                </Pressable>
            )}
        </View>
    );
}

function LiveOverlay({ colors, styles }: { colors: FanColorPalette; styles: ReturnType<typeof createStyles> }) {
    return (
        <View style={styles.liveOverlay} pointerEvents="auto">
            <Text style={{ fontSize: 44 }}>⚽</Text>
            <Text style={[fanText('title', colors, colors.textPrimary), { marginTop: FAN_SPACING.sm }]}>
                Match is live
            </Text>
            <Text style={fanText('caption', colors, colors.textSecondary)}>
                Voting &amp; betting are disabled
            </Text>
            <View style={[styles.liveBadgeLg, { backgroundColor: colors.awayDim, borderColor: colors.away }]}>
                <View style={[styles.liveDotLg, { backgroundColor: colors.away }]} />
                <Text style={[fanText('tag', colors, colors.away), { fontWeight: '700' }]}>LIVE</Text>
            </View>
        </View>
    );
}

/** In-modal toast. Needed because the app-level toast renders UNDER a native Modal. */
function ToastBanner({
    banner, colors, styles,
}: {
    banner: { kind: BannerKind; text: string } | null;
    colors: FanColorPalette;
    styles: ReturnType<typeof createStyles>;
}) {
    if (!banner) return null;
    const tone =
        banner.kind === 'success' ? colors.primary :
            banner.kind === 'error' ? colors.away :
                banner.kind === 'warning' ? colors.draw : colors.textSecondary;
    return (
        <View pointerEvents="none" style={[styles.banner, { borderColor: tone }]}>
            <View style={[styles.bannerDot, { backgroundColor: tone }]} />
            <Text style={[fanText('caption', colors, colors.textPrimary), { flex: 1 }]}>
                {banner.text}
            </Text>
        </View>
    );
}

function DialogShell({
    children, onCancel, styles,
}: {
    children: React.ReactNode;
    onCancel: () => void;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <Pressable style={styles.dialogBackdrop} onPress={onCancel}>
            <Pressable style={styles.dialogCard} onPress={() => { }}>
                {children}
            </Pressable>
        </Pressable>
    );
}

// ─────────────────────────────────────────────────────────────
//  DIALOGS
// ─────────────────────────────────────────────────────────────

function ShortfallDialog({
    shortfall, balance, onCancel, onTopUp, colors, styles,
}: {
    shortfall: number; balance: number; onCancel: () => void; onTopUp: () => void;
    colors: FanColorPalette; styles: ReturnType<typeof createStyles>;
}) {
    return (
        <DialogShell onCancel={onCancel} styles={styles}>
            <Text style={[fanText('title', colors, colors.textPrimary), { marginBottom: FAN_SPACING.md }]}>
                Insufficient balance
            </Text>
            <View style={styles.dialogSummary}>
                <Text style={fanText('caption', colors, colors.textPrimary)}>
                    Your balance: KES {balance.toFixed(2)}
                </Text>
                <Text style={[fanText('caption', colors, colors.draw), { fontWeight: '700' }]}>
                    Shortfall: KES {shortfall.toFixed(2)}
                </Text>
            </View>
            <Text style={fanText('caption', colors, colors.textSecondary)}>
                Top up at least KES {shortfall.toFixed(2)} to continue. The action will retry automatically.
            </Text>
            <View style={styles.dialogActions}>
                <CTA label="Cancel" tone="ghost" onPress={onCancel} colors={colors} styles={styles} />
                <CTA label="Top up & retry" onPress={onTopUp} colors={colors} styles={styles} />
            </View>
        </DialogShell>
    );
}

function MatchMainDialog({
    fixture, pledge, selection, busy, onCancel, onConfirm, colors, styles,
}: {
    fixture: FixtureLite; pledge: Bettor; selection: Selection; busy: boolean;
    onCancel: () => void; onConfirm: () => void;
    colors: FanColorPalette; styles: ReturnType<typeof createStyles>;
}) {
    const label = selection === 'home' ? fixture.homeTeam : fixture.awayTeam;
    const accent = selection === 'home' ? colors.primary : colors.away;
    return (
        <DialogShell onCancel={busy ? () => { } : onCancel} styles={styles}>
            <Text style={[fanText('title', colors, colors.textPrimary), { marginBottom: FAN_SPACING.md }]}>
                Match pledge
            </Text>
            <View style={styles.dialogSummary}>
                <Text style={fanText('caption', colors, colors.textPrimary)}>
                    {pledge.userName} · picked {pledge.selectionDisplay}
                </Text>
                <Text style={[fanText('caption', colors, colors.primary), { fontWeight: '700' }]}>
                    KES {pledge.amount.toFixed(2)}
                </Text>
            </View>
            <View
                style={[
                    styles.outcomeCard,
                    { backgroundColor: dimOf(accent, colors), borderColor: accent, marginBottom: FAN_SPACING.sm },
                ]}
            >
                <Text style={[fanText('caption', colors, accent), { fontWeight: '700' }]}>{label}</Text>
            </View>
            <Text style={fanText('tag', colors, colors.away)}>Cannot pick {pledge.selectionDisplay}</Text>
            <View style={styles.dialogActions}>
                <CTA label="Cancel" tone="ghost" onPress={onCancel} disabled={busy} colors={colors} styles={styles} />
                <CTA label="Match" onPress={onConfirm} loading={busy} colors={colors} styles={styles} />
            </View>
        </DialogShell>
    );
}

function MatchSubDialog({
    fixture, market, pledge, selection, onSelectionChange, onCancel, onConfirm, colors, styles,
}: {
    fixture: FixtureLite; market: SubFixtureMarket; pledge: SubFixturePledge;
    selection: string; onSelectionChange: (s: string) => void;
    onCancel: () => void; onConfirm: () => void;
    colors: FanColorPalette; styles: ReturnType<typeof createStyles>;
}) {
    const isLine = market.marketType === 'over_under_2_5';
    const all = isLine ? ['over', 'under'] : ['home', 'away', 'none'];
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
        <DialogShell onCancel={onCancel} styles={styles}>
            <Text style={[fanText('title', colors, colors.textPrimary), { marginBottom: FAN_SPACING.md }]}>
                Match pledge
            </Text>
            <View style={styles.dialogSummary}>
                <Text style={fanText('caption', colors, colors.textPrimary)}>
                    {pledge.userName} · picked {labelFor(pledge.selection)}
                </Text>
                <Text style={[fanText('caption', colors, colors.primary), { fontWeight: '700' }]}>
                    KES {pledge.amount.toFixed(2)}
                </Text>
            </View>
            <Text style={[fanText('tag', colors, colors.textTertiary), { marginBottom: FAN_SPACING.xs }]}>
                Your pick
            </Text>
            <View style={{ flexDirection: 'row', gap: FAN_SPACING.sm, marginBottom: FAN_SPACING.sm }}>
                {available.map((k) => (
                    <OutcomePill
                        key={k}
                        label={labelFor(k)}
                        selected={selection === k}
                        locked={false}
                        accent={voteColorOf(k, colors)}
                        onPress={() => onSelectionChange(k)}
                        colors={colors}
                        styles={styles}
                    />
                ))}
            </View>
            <Text style={fanText('tag', colors, colors.primary)}>
                Stake must match: KES {pledge.amount.toFixed(2)}
            </Text>
            <View style={styles.dialogActions}>
                <CTA label="Cancel" tone="ghost" onPress={onCancel} colors={colors} styles={styles} />
                <CTA label="Match" onPress={onConfirm} colors={colors} styles={styles} />
            </View>
        </DialogShell>
    );
}

function FundsDialog({
    mode, balance, processing, initialAmount, onSubmit, onInvalid, onClose,
    getSavedPhone, getUserPhone, colors, styles,
}: {
    mode: 'topup' | 'withdraw'; balance: number; processing: boolean;
    initialAmount?: number;
    onSubmit: (amount: number, phone: string, save?: boolean) => Promise<{ ok: boolean; error?: string }>;
    onInvalid: (msg: string) => void;
    onClose: () => void;
    getSavedPhone: (kind: 'topup' | 'withdraw') => Promise<string | null>;
    getUserPhone: () => Promise<string>;
    colors: FanColorPalette; styles: ReturnType<typeof createStyles>;
}) {
    const [amount, setAmount] = useState(initialAmount ? String(Math.ceil(initialAmount)) : '');
    const [phone, setPhone] = useState('');
    const [useSaved, setUseSaved] = useState(true);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const isWithdraw = mode === 'withdraw';

    useEffect(() => {
        let alive = true;
        void (async () => {
            try {
                const saved = await getSavedPhone(mode);
                if (!alive) return;
                if (saved) { setPhone(saved); return; }
                const up = await getUserPhone();
                if (alive && up) setPhone(up);
            } catch { /* phone stays empty; submit will say so */ }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const working = busy || processing;

    return (
        <DialogShell onCancel={working ? () => { } : onClose} styles={styles}>
            <Text style={[fanText('title', colors, colors.textPrimary), { marginBottom: FAN_SPACING.md }]}>
                {isWithdraw ? 'Withdraw funds' : 'Top up balance'}
            </Text>
            <View style={styles.dialogSummary}>
                <Text style={fanText('caption', colors, colors.textPrimary)}>
                    Balance: KES {balance.toFixed(2)}
                </Text>
            </View>
            <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount (KES)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                editable={!working}
                style={[styles.input, { marginBottom: FAN_SPACING.sm, color: colors.textPrimary }]}
            />
            <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={isWithdraw ? 'Registered phone number' : 'M-Pesa phone number'}
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                editable={!isWithdraw && !working}
                style={[
                    styles.input,
                    {
                        marginBottom: FAN_SPACING.sm,
                        color: colors.textPrimary,
                        opacity: isWithdraw ? 0.7 : 1,
                    },
                ]}
            />
            {!isWithdraw && (
                <Pressable
                    onPress={() => setUseSaved((v) => !v)}
                    style={({ pressed }) => [
                        { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm, marginBottom: FAN_SPACING.sm },
                        pressed && { opacity: PRESSED_OPACITY },
                    ]}
                >
                    <View
                        style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: useSaved ? colors.primary : colors.border,
                            backgroundColor: useSaved ? colors.primary : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {useSaved && <Text style={{ color: colors.background, fontSize: 10 }}>✓</Text>}
                    </View>
                    <Text style={fanText('tag', colors, colors.textTertiary)}>
                        Save this number for future top-ups
                    </Text>
                </Pressable>
            )}
            {!!status && (
                <Text
                    style={[
                        fanText(
                            'caption',
                            colors,
                            status.startsWith('✅') ? colors.primary
                                : status.startsWith('⏳') ? colors.textSecondary : colors.away,
                        ),
                        { marginBottom: FAN_SPACING.sm },
                    ]}
                >
                    {status}
                </Text>
            )}
            <View style={styles.dialogActions}>
                <CTA label="Cancel" tone="ghost" onPress={onClose} disabled={working} colors={colors} styles={styles} />
                <CTA
                    label={isWithdraw ? 'Withdraw' : 'Pay via M-Pesa'}
                    loading={working}
                    tone={isWithdraw ? 'danger' : 'primary'}
                    colors={colors}
                    styles={styles}
                    onPress={async () => {
                        const a = Number(amount);
                        if (!Number.isFinite(a) || a <= 0) { onInvalid('Please enter a valid amount'); return; }
                        if (!phone) {
                            onInvalid(isWithdraw ? 'No registered phone number found' : 'Enter your M-Pesa number');
                            return;
                        }
                        if (!isValidPhone(phone)) { onInvalid('Please enter a valid phone number'); return; }
                        if (isWithdraw && a > balance) { onInvalid('Insufficient balance'); return; }
                        setBusy(true);
                        setStatus(
                            isWithdraw
                                ? '⏳ Sending withdrawal…'
                                : '⏳ Check your phone and enter your M-Pesa PIN. This can take up to 3 minutes. Keep this open.',
                        );
                        const r = await onSubmit(a, phone, useSaved);
                        setBusy(false);
                        setStatus(r.ok ? '✅ Done' : `❌ ${r.error ?? 'Failed'}`);
                    }}
                />
            </View>
        </DialogShell>
    );
}

// ─────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────

export function SwipeableVotePledgeModal(props: Props) {
    const {
        visible, fixture, userId, username, authToken, isLoggedIn,
        hasUserVoted, userVoteSelection, channelId,
        showPledgesTab = true, showSubFixturesTab = true, showBetsTab = false,
        onClose, onVote, onPledge, onShowJoinGroups,
        fetchVoters, fetchPledges, fetchSubFixtures, fetchSubFixturePledges,
        fetchBets, fetchBalance, topUp, withdraw,
        getSavedPhone, savePhone, getUserPhone,
        placeSubFixturePledge, matchSubFixturePledge, matchMainPledge,
    } = props;

    const colors = useFanColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { height: screenH, width: screenW } = useWindowDimensions();

    // ── Toast: banner inside the sheet + global toast (visible after close) ──
    const globalToast = useToast();
    const globalToastRef = useRef(globalToast);
    globalToastRef.current = globalToast;
    const [banner, setBanner] = useState<{ kind: BannerKind; text: string } | null>(null);
    const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

    // Stable identity on purpose: callbacks below list `toast` in their deps.
    const toast = useMemo(() => {
        const show = (kind: BannerKind, text: string) => {
            setBanner({ kind, text });
            if (bannerTimer.current) clearTimeout(bannerTimer.current);
            bannerTimer.current = setTimeout(() => setBanner(null), 3600);
            try {
                const g: any = globalToastRef.current;
                const fn =
                    kind === 'success' ? g?.showSuccess :
                        kind === 'error' ? g?.showError :
                            kind === 'warning' ? g?.showWarning : g?.showInfo;
                fn?.call(g, text);
            } catch { /* global toast is best-effort */ }
        };
        return {
            showSuccess: (t: string) => show('success', t),
            showError: (t: string) => show('error', t),
            showWarning: (t: string) => show('warning', t),
            showInfo: (t: string) => show('info', t),
        };
    }, []);

    const isLive = fixture.isLive === true;
    const showPledges = showPledgesTab && !isLive;
    const showSubFixtures = showSubFixturesTab && !isLive;
    const showBets = showBetsTab && !isLive;

    const tabs = useMemo(() => {
        const l: string[] = ['Votes'];
        if (showPledges) l.push('Pledges');
        if (showSubFixtures) l.push('Sub-Fixtures');
        if (showBets) l.push('Bets');
        return l;
    }, [showPledges, showSubFixtures, showBets]);

    const [tab, setTab] = useState(0);
    const pagerRef = useRef<ScrollView>(null);
    const pendingRetryRef = useRef<(() => void) | null>(null);

    // Vote
    const [selectedVote, setSelectedVote] = useState<Selection | null>(null);
    const [voting, setVoting] = useState(false);
    const [voters, setVoters] = useState<any[]>([]);
    const [votersLoading, setVotersLoading] = useState(true);
    const [voterFilter, setVoterFilter] = useState<'all' | 'home' | 'away'>('all');

    // Pledges
    const [pledges, setPledges] = useState<Bettor[]>([]);
    const [pledgesLoading, setPledgesLoading] = useState(true);
    const [selectedPledgeOption, setSelectedPledgeOption] = useState<Selection | null>(null);
    const [pledgeAmount, setPledgeAmount] = useState('');
    const [pledging, setPledging] = useState(false);
    const [matchingMain, setMatchingMain] = useState(false);

    // Balance
    const [balance, setBalance] = useState(0);
    const [balanceLoading, setBalanceLoading] = useState(true);
    const [balanceError, setBalanceError] = useState<string | null>(null);
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

    // Dialog
    const [dialog, setDialog] = useState<
        | { kind: 'none' }
        | { kind: 'topup'; amount?: number }
        | { kind: 'withdraw' }
        | { kind: 'shortfall'; shortfall: number; retry: () => void }
        | { kind: 'match-main'; bettor: Bettor; opposite: Selection }
        | { kind: 'match-sub'; market: SubFixtureMarket; pledge: SubFixturePledge; selection: string }
    >({ kind: 'none' });

    const fixtureKey = fixture.matchId || fixture.id;

    // ── Loaders ─────────────────────────────────────────────────
    const loadVoters = useCallback(async () => {
        setVotersLoading(true);
        try {
            setVoters(await fetchVoters(fixtureKey, authToken));
        } catch (e: any) {
            toast.showWarning(`Couldn't load votes: ${e?.message ?? e}`);
        } finally { setVotersLoading(false); }
    }, [fixtureKey, authToken, fetchVoters, toast]);

    const loadPledges = useCallback(async () => {
        setPledgesLoading(true);
        try {
            const p = await fetchPledges(channelId, fixtureKey, authToken);
            setPledges(p);
            const mine = p.find((x) => x.userId === userId);
            if (mine) {
                // Only fill in what the user hasn't already typed, so a push
                // refresh doesn't overwrite their input.
                setSelectedPledgeOption((prev) =>
                    prev ?? (isHomeSel(mine.selection) ? 'home' : isAwaySel(mine.selection) ? 'away' : null),
                );
                setPledgeAmount((prev) => prev || String(mine.amount));
            }
        } catch (e: any) {
            toast.showWarning(`Couldn't load pledges: ${e?.message ?? e}`);
        } finally { setPledgesLoading(false); }
    }, [fixtureKey, channelId, authToken, fetchPledges, userId, toast]);

    const loadSubFixtures = useCallback(async () => {
        setSubFixturesLoading(true);
        setSubFixturesError(null);
        try {
            const m = await fetchSubFixtures(fixtureKey, authToken);
            setSubFixtures(m.filter((x) => x.isVisible));
        } catch (e: any) {
            setSubFixturesError(`Could not load sub-fixtures: ${e?.message ?? e}`);
        } finally { setSubFixturesLoading(false); }
    }, [fixtureKey, authToken, fetchSubFixtures]);

    const loadSubPledges = useCallback(async (marketId: string, force = false) => {
        if (!force && subPledges[marketId]) return;
        if (subPledgesLoading[marketId]) return;
        setSubPledgesLoading((s) => ({ ...s, [marketId]: true }));
        setSubPledgesError((s) => ({ ...s, [marketId]: null }));
        try {
            const p = await fetchSubFixturePledges(marketId, fixtureKey, authToken);
            setSubPledges((s) => ({ ...s, [marketId]: p }));
        } catch (e: any) {
            setSubPledgesError((s) => ({ ...s, [marketId]: e?.message ?? 'Failed' }));
        } finally {
            setSubPledgesLoading((s) => ({ ...s, [marketId]: false }));
        }
    }, [subPledges, subPledgesLoading, fetchSubFixturePledges, fixtureKey, authToken]);

    const loadBets = useCallback(async () => {
        setBetsLoading(true);
        try {
            setBets(await fetchBets(channelId, fixtureKey, authToken));
        } catch (e: any) {
            toast.showWarning(`Couldn't load bets: ${e?.message ?? e}`);
        } finally { setBetsLoading(false); }
    }, [fixtureKey, channelId, authToken, fetchBets, toast]);

    /** Returns the fresh balance (or null on failure) so callers never read a stale closure. */
    const refreshBalance = useCallback(async (force = false): Promise<number | null> => {
        if (!isLoggedIn || !userId) {
            setBalanceLoading(false);
            setBalanceError(!isLoggedIn ? 'Sign in to see your balance' : 'Missing user id');
            return null;
        }
        setBalanceLoading(true);
        setBalanceError(null);
        try {
            const b = await fetchBalance(userId, authToken, { forceRefresh: force });
            setBalance(b);
            return b;
        } catch (e: any) {
            const msg = e?.message ?? 'Could not load balance';
            setBalanceError(msg);
            toast.showError(`Couldn't load balance: ${msg}`);
            return null;
        } finally { setBalanceLoading(false); }
    }, [isLoggedIn, userId, authToken, fetchBalance, toast]);

    // ── Open loaders ────────────────────────────────────────────
    useEffect(() => {
        if (!visible) return;
        void refreshBalance(false);
        void loadVoters();
        void loadPledges();
        if (showSubFixtures) void loadSubFixtures();
        if (showBets) void loadBets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    // ── FCM badge subscription (guarded: method may not exist) ──
    useEffect(() => {
        if (!visible) return;
        const sub = (NotificationService as any)?.onBadge;
        if (typeof sub !== 'function') return;
        const unsub = sub.call(NotificationService, (event: any) => {
            const fid = event?.fixture_id ?? event?.fixtureId;
            if (fid === fixtureKey) {
                void loadVoters();
                void loadPledges();
                if (showSubFixtures) void loadSubFixtures();
                if (showBets) void loadBets();
            }
        });
        return typeof unsub === 'function' ? unsub : undefined;
    }, [
        visible, fixtureKey, showSubFixtures, showBets,
        loadVoters, loadPledges, loadSubFixtures, loadBets,
    ]);

    // ── Derived ─────────────────────────────────────────────────
    const voteStats = useMemo(() => {
        let home = 0, away = 0;
        for (const v of voters) {
            if (isHomeSel(v.selection)) home++;
            else if (isAwaySel(v.selection)) away++;
        }
        const total = home + away;
        return {
            homeCount: home, awayCount: away, total,
            homePct: total ? (home / total) * 100 : 0,
            awayPct: total ? (away / total) * 100 : 0,
        };
    }, [voters]);

    const filteredVoters = useMemo(() => {
        if (voterFilter === 'home') return voters.filter((v) => isHomeSel(v.selection));
        if (voterFilter === 'away') return voters.filter((v) => isAwaySel(v.selection));
        return voters;
    }, [voters, voterFilter]);

    const hasUserPledged = pledges.some((p) => p.userId === userId);

    // ── Handlers ────────────────────────────────────────────────
    function requireChannel(): boolean {
        if (channelId.length > 0) return true;
        toast.showWarning('Please join a group to continue');
        onClose();
        onShowJoinGroups?.();
        return false;
    }

    function openShortfall(shortfall: number, retry: () => void) {
        setDialog({ kind: 'shortfall', shortfall, retry });
    }

    async function handleVote() {
        if (!requireChannel()) return;
        if (isLive) { toast.showWarning('Voting is disabled during live matches'); return; }
        if (!selectedVote) { toast.showWarning('Please select a pick first'); return; }
        if (hasUserVoted) { toast.showInfo('You have already voted'); return; }
        setVoting(true);
        try {
            const r = asResult(await onVote(selectedVote));
            if (r.success) {
                toast.showSuccess(r.message ?? 'Vote submitted!');
                onClose();
            } else if (r.message?.toLowerCase().includes('already voted')) {
                toast.showInfo('You have already voted');
                onClose();
            } else {
                toast.showError(r.message ?? 'Vote failed. Please try again.');
            }
        } catch (e: any) {
            toast.showError(`Vote failed: ${e?.message ?? e}`);
        } finally { setVoting(false); }
    }

    async function handlePledge() {
        if (!requireChannel()) return;
        if (isLive) { toast.showWarning('Betting is disabled during live matches'); return; }
        if (!selectedPledgeOption) { toast.showWarning('Please select a pick first'); return; }
        const amount = Number(pledgeAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.showWarning('Please enter a valid amount'); return;
        }
        const selection = selectedPledgeOption;
        setPledging(true);
        try {
            const bal = await refreshBalance(true);
            if (bal == null) return; // error already shown
            if (bal < amount) {
                const short = amount - bal;
                toast.showInfo(`Insufficient balance. You need KES ${short.toFixed(2)} more.`);
                openShortfall(short, () => { void executePledge(selection, amount); });
                return;
            }
        } finally { setPledging(false); }
        await executePledge(selection, amount);
    }

    async function executePledge(selection: Selection, amount: number) {
        setPledging(true);
        try {
            const r = asResult(await onPledge(selection, amount));
            if (r.success) {
                toast.showSuccess(r.message ?? 'Pledge created! 🎉');
                await refreshBalance(true);
                await loadPledges();
                onClose();
            } else {
                toast.showError(r.message ?? 'Failed to create pledge');
                if (r.message?.toLowerCase().includes('balance')) await refreshBalance(true);
            }
        } catch (e: any) {
            toast.showError(`Network error: ${e?.message ?? e}`);
        } finally { setPledging(false); }
    }

    async function handleSubFixturePledge(market: SubFixtureMarket) {
        if (!requireChannel()) return;
        if (isLive) { toast.showWarning('Betting is disabled during live matches'); return; }
        const selection = subSelections[market.id];
        if (!selection) { toast.showWarning('Please select a pick first'); return; }
        const amount = Number(subAmounts[market.id] ?? '');
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.showWarning('Please enter a valid amount'); return;
        }
        const bal = await refreshBalance(true);
        if (bal == null) return;
        if (bal < amount) {
            const short = amount - bal;
            toast.showInfo(`Insufficient balance. You need KES ${short.toFixed(2)} more.`);
            openShortfall(short, () => { void executeSubFixturePledge(market, selection, amount); });
            return;
        }
        await executeSubFixturePledge(market, selection, amount);
    }

    async function executeSubFixturePledge(
        market: SubFixtureMarket, selection: string, amount: number,
    ) {
        if (pledgingSubIds.has(market.id)) return;
        setPledgingSubIds((s) => new Set(s).add(market.id));
        try {
            const res = await placeSubFixturePledge({
                fixtureId: fixtureKey,
                marketId: market.id,
                starterId: userId,
                starterName: username,
                selection,
                amount,
            });
            if (res.success) {
                toast.showSuccess('Pledge placed! 🎉');
                await refreshBalance(true);
                await loadSubFixtures();
                setSubSelections((s) => ({ ...s, [market.id]: '' }));
                setSubAmounts((s) => ({ ...s, [market.id]: '' }));
            } else {
                toast.showError(res.message ?? 'Failed to place pledge');
                if (res.message?.toLowerCase().includes('balance')) await refreshBalance(true);
            }
        } catch (e: any) {
            toast.showError(`Network error: ${e?.message ?? e}`);
        } finally {
            setPledgingSubIds((s) => { const n = new Set(s); n.delete(market.id); return n; });
        }
    }

    function oppositeOf(p: Bettor): Selection {
        return isHomeSel(p.selection) ? 'away' : 'home';
    }

    async function startMatchMain(pledge: Bettor) {
        if (!requireChannel()) return;
        if (isLive) { toast.showWarning('Betting is disabled during live matches'); return; }
        const bal = await refreshBalance(true);
        if (bal == null) return;
        const opposite = oppositeOf(pledge);
        if (bal < pledge.amount) {
            const short = pledge.amount - bal;
            toast.showInfo(`Insufficient balance. You need KES ${short.toFixed(2)} more.`);
            openShortfall(short, () => setDialog({ kind: 'match-main', bettor: pledge, opposite }));
            return;
        }
        setDialog({ kind: 'match-main', bettor: pledge, opposite });
    }

    async function executeMatchMain(pledge: Bettor, selection: Selection) {
        if (matchingMain) return;
        setMatchingMain(true);
        try {
            toast.showInfo('🔄 Matching pledge…');
            const res = await matchMainPledge({
                betId: pledge.betId, finisherId: userId, finisherName: username,
                finisherSelection: selection, amount: pledge.amount,
            });
            if (res.success) {
                toast.showSuccess('✅ Bet matched! 🎉');
                await refreshBalance(true);
                await loadPledges();
                await loadBets();
                onClose();
            } else {
                toast.showError(res.message ?? 'Match failed');
            }
        } catch (e: any) {
            toast.showError(`Error: ${e?.message ?? e}`);
        } finally { setMatchingMain(false); }
    }

    async function startMatchSub(market: SubFixtureMarket, pledge: SubFixturePledge) {
        if (!requireChannel()) return;
        if (isLive) { toast.showWarning('Betting is disabled during live matches'); return; }
        if (matchingSubIds.has(pledge.id)) return;
        const bal = await refreshBalance(true);
        if (bal == null) return;
        const all = market.marketType === 'over_under_2_5' ? ['over', 'under'] : ['home', 'away', 'none'];
        const available = all.filter((k) => k !== pledge.selection);
        const open = () => setDialog({ kind: 'match-sub', market, pledge, selection: available[0] });
        if (bal < pledge.amount) {
            const short = pledge.amount - bal;
            toast.showInfo(`Insufficient balance. You need KES ${short.toFixed(2)} more.`);
            openShortfall(short, open);
            return;
        }
        open();
    }

    async function executeMatchSub(
        market: SubFixtureMarket, pledge: SubFixturePledge, selection: string,
    ) {
        if (matchingSubIds.has(pledge.id)) return;
        setMatchingSubIds((s) => new Set(s).add(pledge.id));
        try {
            const res = await matchSubFixturePledge({
                betId: pledge.id,
                matchId: fixtureKey,
                marketId: market.id,
                finisherId: userId,
                finisherName: username,
                selection,
                amount: pledge.amount,
            });
            if (res.success) {
                toast.showSuccess('✅ Pledge matched! 🎉');
                await refreshBalance(true);
                setSubPledges((s) => { const n = { ...s }; delete n[market.id]; return n; });
                await loadSubPledges(market.id, true);
            } else {
                toast.showError(res.message ?? 'Failed to match pledge');
            }
        } catch (e: any) {
            toast.showError(`Network error: ${e?.message ?? e}`);
        } finally {
            setMatchingSubIds((s) => { const n = new Set(s); n.delete(pledge.id); return n; });
        }
    }

    // ── Payments ────────────────────────────────────────────────
    async function submitTopUp(amount: number, phone: string, save?: boolean) {
        setProcessingPayment(true);
        try {
            const res = await topUp(amount, phone, 'Top up balance');
            if (res.success) {
                if (save) { try { await savePhone('topup', phone); } catch { /* non-fatal */ } }
                await refreshBalance(true);
                toast.showSuccess('Balance updated');
                setDialog({ kind: 'none' });
                const r = pendingRetryRef.current;
                pendingRetryRef.current = null;
                if (r) setTimeout(r, 0);
                return { ok: true };
            }
            const err = res.error ?? res.message ?? 'Payment failed';
            toast.showError(err);
            return { ok: false, error: err };
        } catch (e: any) {
            const err = e?.message ?? String(e);
            toast.showError(err);
            return { ok: false, error: err };
        } finally { setProcessingPayment(false); }
    }

    async function submitWithdraw(amount: number, phone: string) {
        setProcessingPayment(true);
        try {
            const res = await withdraw(amount, phone);
            if (res.success) {
                await refreshBalance(true);
                toast.showSuccess('Withdrawal submitted');
                setDialog({ kind: 'none' });
                return { ok: true };
            }
            const err = res.error ?? res.message ?? 'Withdrawal failed';
            toast.showError(err);
            return { ok: false, error: err };
        } catch (e: any) {
            const err = e?.message ?? String(e);
            toast.showError(err);
            return { ok: false, error: err };
        } finally { setProcessingPayment(false); }
    }

    // ── Tab swipe ───────────────────────────────────────────────
    function onPagerEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
        const i = Math.round(e.nativeEvent.contentOffset.x / screenW);
        if (i !== tab) setTab(i);
    }
    function jumpTo(i: number) {
        setTab(i);
        pagerRef.current?.scrollTo({ x: i * screenW, animated: true });
    }

    const kavBehavior = Platform.OS === 'ios' ? 'padding' : 'height';

    // ── No-channel gate ─────────────────────────────────────────
    if (channelId.length === 0) {
        return (
            <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
                <Pressable style={styles.backdrop} onPress={onClose}>
                    <Pressable style={[styles.sheet, { height: screenH * 0.72 }]} onPress={() => { }}>
                        <HandleBar colors={colors} styles={styles} />
                        <View style={styles.joinGroupBox}>
                            <View style={styles.joinGroupIconWrap}>
                                <Text style={styles.joinGroupEmoji}>🔒</Text>
                            </View>
                            <Text style={fanText('title', colors, colors.textPrimary)}>
                                Join a group first
                            </Text>
                            <Text
                                style={[
                                    fanText('body', colors, colors.textSecondary),
                                    { textAlign: 'center', marginTop: FAN_SPACING.sm },
                                ]}
                            >
                                You need to join a group to vote, pledge and interact with this match.
                            </Text>
                            <CTA
                                label="Join a group"
                                onPress={() => { onClose(); onShowJoinGroups?.(); }}
                                colors={colors}
                                styles={styles}
                            />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    }

    // ── Main render ─────────────────────────────────────────────
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={kavBehavior}>
                <Pressable style={styles.backdrop} onPress={onClose}>
                    <Pressable
                        style={[styles.sheet, { height: screenH * 0.82, maxHeight: '100%' }]}
                        onPress={() => { }}
                    >
                        <HandleBar colors={colors} styles={styles} />

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerIcon}>
                                <Text style={{ fontSize: ICON.md }}>
                                    {tab === 0 ? '🗳' : tab === 1 ? '💰' : tab === 2 ? '🎲' : '🏆'}
                                </Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                    style={fanText('title', colors, colors.textPrimary)}
                                    numberOfLines={1}
                                >
                                    {tabs[tab] ?? 'Votes'}
                                </Text>
                                <Text
                                    style={fanText('competition', colors, colors.textTertiary)}
                                    numberOfLines={1}
                                >
                                    {fixture.league || 'Match'}
                                </Text>
                            </View>
                            <Pressable
                                onPress={onClose}
                                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: PRESSED_OPACITY }]}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                            >
                                <Text style={styles.closeBtnText}>✕</Text>
                            </Pressable>
                        </View>

                        {/* Match header — the ONLY place both team names appear together */}
                        <View style={styles.matchHeader}>
                            <View style={styles.matchHeaderSide}>
                                <Text
                                    style={[fanText('caption', colors, colors.primary), { fontWeight: '700' }]}
                                    numberOfLines={1}
                                >
                                    {fixture.homeTeam}
                                </Text>
                            </View>
                            <View style={styles.matchHeaderCenter}>
                                <Text style={fanText('tag', colors, colors.textTertiary)}>VS</Text>
                                {isLive && (
                                    <View style={styles.liveBadge}>
                                        <View style={styles.liveDot} />
                                        <Text style={styles.liveText}>LIVE</Text>
                                    </View>
                                )}
                            </View>
                            <View style={[styles.matchHeaderSide, { alignItems: 'flex-end' }]}>
                                <Text
                                    style={[fanText('caption', colors, colors.away), { fontWeight: '700' }]}
                                    numberOfLines={1}
                                >
                                    {fixture.awayTeam}
                                </Text>
                            </View>
                        </View>

                        {/* Tab bar */}
                        {tabs.length > 1 && (
                            <TabBar tabs={tabs} active={tab} onChange={jumpTo} colors={colors} styles={styles} />
                        )}

                        {/* Body */}
                        <View style={{ flex: 1, overflow: 'hidden' }}>
                            <ScrollView
                                ref={pagerRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={onPagerEnd}
                                keyboardShouldPersistTaps="handled"
                                style={{ flex: 1 }}
                            >
                                {tabs.map((_, i) => (
                                    <View key={i} style={{ width: screenW, flex: 1 }}>
                                        <ScrollView
                                            contentContainerStyle={{
                                                paddingBottom: FAN_SPACING.xl,
                                                paddingTop: FAN_SPACING.xs,
                                            }}
                                            keyboardShouldPersistTaps="handled"
                                            showsVerticalScrollIndicator={false}
                                        >
                                            {i === 0 && renderVotesTab()}
                                            {i === 1 && showPledges && renderPledgesTab()}
                                            {i === 2 && showSubFixtures && renderSubFixturesTab()}
                                            {i === 3 && showBets && renderBetsTab()}
                                        </ScrollView>
                                    </View>
                                ))}
                            </ScrollView>

                            {isLive && <LiveOverlay colors={colors} styles={styles} />}
                        </View>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <Pressable
                                onPress={async () => {
                                    const message =
                                        `⚔️ Join the voting on Funzy!\n\n` +
                                        `📊 Vote on: ${fixture.homeTeam} vs ${fixture.awayTeam}\n` +
                                        `🏆 ${fixture.league}\n\n` +
                                        `Download the app and vote now!`;
                                    try { await Share.share({ message }); } catch { }
                                }}
                                style={({ pressed }) => [styles.shareBtn, pressed && { opacity: PRESSED_OPACITY }]}
                            >
                                <Text style={styles.shareIcon}>↗</Text>
                                <Text style={styles.shareText}>Share match</Text>
                            </Pressable>
                        </View>

                        {/* Dialogs */}
                        {dialog.kind === 'shortfall' && (
                            <ShortfallDialog
                                colors={colors}
                                styles={styles}
                                shortfall={dialog.shortfall}
                                balance={balance}
                                onCancel={() => setDialog({ kind: 'none' })}
                                onTopUp={() => {
                                    pendingRetryRef.current = dialog.retry;
                                    setDialog({ kind: 'topup', amount: dialog.shortfall });
                                }}
                            />
                        )}

                        {dialog.kind === 'topup' && (
                            <FundsDialog
                                mode="topup"
                                colors={colors}
                                styles={styles}
                                balance={balance}
                                processing={processingPayment}
                                initialAmount={dialog.amount}
                                getSavedPhone={getSavedPhone}
                                getUserPhone={getUserPhone}
                                onInvalid={(m) => toast.showWarning(m)}
                                onClose={() => { pendingRetryRef.current = null; setDialog({ kind: 'none' }); }}
                                onSubmit={submitTopUp}
                            />
                        )}

                        {dialog.kind === 'withdraw' && (
                            <FundsDialog
                                mode="withdraw"
                                colors={colors}
                                styles={styles}
                                balance={balance}
                                processing={processingPayment}
                                getSavedPhone={getSavedPhone}
                                getUserPhone={getUserPhone}
                                onInvalid={(m) => toast.showWarning(m)}
                                onClose={() => setDialog({ kind: 'none' })}
                                onSubmit={(a, p) => submitWithdraw(a, p)}
                            />
                        )}

                        {dialog.kind === 'match-main' && (
                            <MatchMainDialog
                                colors={colors}
                                styles={styles}
                                fixture={fixture}
                                pledge={dialog.bettor}
                                selection={dialog.opposite}
                                busy={matchingMain}
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
                                colors={colors}
                                styles={styles}
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

                        <ToastBanner banner={banner} colors={colors} styles={styles} />
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );

    // ───────────────────────────────────────────────────────────
    //  TAB RENDERS
    // ───────────────────────────────────────────────────────────

    function renderBalanceBar() {
        return (
            <BalanceBar
                colors={colors}
                styles={styles}
                loading={balanceLoading}
                balance={balance}
                error={balanceError}
                processing={processingPayment}
                onRetry={() => void refreshBalance(true)}
                onTopUp={() => setDialog({ kind: 'topup' })}
                onWithdraw={() => setDialog({ kind: 'withdraw' })}
            />
        );
    }

    function renderVotesTab() {
        const locked = hasUserVoted || isLive;
        const mine = hasUserVoted ? userVoteSelection : selectedVote;

        return (
            <View style={styles.tabBody}>
                {/* Hero — vote split (no team names: they're in the match header) */}
                <Card colors={colors} styles={styles} tone="sunken">
                    <View style={styles.heroRow}>
                        <Text style={[styles.heroPct, { color: colors.primary }]}>
                            {voteStats.homePct.toFixed(0)}%
                        </Text>
                        <Text style={fanText('tag', colors, colors.textTertiary)}>
                            {voteStats.total} {voteStats.total === 1 ? 'vote' : 'votes'}
                        </Text>
                        <Text style={[styles.heroPct, { color: colors.away, textAlign: 'right' }]}>
                            {voteStats.awayPct.toFixed(0)}%
                        </Text>
                    </View>
                    <View style={styles.splitBar}>
                        <View
                            style={[
                                styles.splitHome,
                                {
                                    flex: Math.max(voteStats.homeCount, 0.0001),
                                    backgroundColor: colors.primary,
                                },
                            ]}
                        />
                        <View
                            style={[
                                styles.splitAway,
                                {
                                    flex: Math.max(voteStats.awayCount, 0.0001),
                                    backgroundColor: colors.away,
                                },
                            ]}
                        />
                    </View>
                </Card>

                {/* Pick */}
                <View style={{ flexDirection: 'row', gap: FAN_SPACING.sm }}>
                    <OutcomePill
                        label="Home"
                        sublabel={`${voteStats.homeCount} picks`}
                        selected={isHomeSel(mine)}
                        locked={locked}
                        accent={colors.primary}
                        onPress={() => setSelectedVote('home')}
                        colors={colors}
                        styles={styles}
                    />
                    <OutcomePill
                        label="Away"
                        sublabel={`${voteStats.awayCount} picks`}
                        selected={isAwaySel(mine)}
                        locked={locked}
                        accent={colors.away}
                        onPress={() => setSelectedVote('away')}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                {selectedVote && !hasUserVoted && !isLive && (
                    <CTA
                        label={voting ? 'Confirming…' : 'Confirm vote'}
                        onPress={handleVote}
                        loading={voting}
                        colors={colors}
                        styles={styles}
                    />
                )}

                <SectionHeader title="Votes" count={voteStats.total} loading={votersLoading} colors={colors} styles={styles} />

                <View style={styles.filterRow}>
                    <Chip
                        label={`All${voteStats.total ? `  ${voteStats.total}` : ''}`}
                        active={voterFilter === 'all'}
                        onPress={() => setVoterFilter('all')}
                        colors={colors}
                        styles={styles}
                    />
                    <Chip
                        label={`Home${voteStats.homeCount ? `  ${voteStats.homeCount}` : ''}`}
                        active={voterFilter === 'home'}
                        onPress={() => setVoterFilter('home')}
                        colors={colors}
                        styles={styles}
                    />
                    <Chip
                        label={`Away${voteStats.awayCount ? `  ${voteStats.awayCount}` : ''}`}
                        active={voterFilter === 'away'}
                        onPress={() => setVoterFilter('away')}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                {votersLoading && voters.length === 0 ? (
                    <Spinner colors={colors} styles={styles} label="Loading votes…" />
                ) : filteredVoters.length === 0 ? (
                    <Empty
                        colors={colors}
                        styles={styles}
                        icon="🗳"
                        label={voterFilter === 'all' ? 'No votes yet' : 'No votes for this selection'}
                        actionLabel={voterFilter !== 'all' ? 'Show all' : undefined}
                        onAction={voterFilter !== 'all' ? () => setVoterFilter('all') : undefined}
                    />
                ) : (
                    filteredVoters.map((v: any, i) => {
                        const isMe = v.userId === userId;
                        const accent = voteColorOf(v.selection, colors);
                        const pct = isHomeSel(v.selection) ? voteStats.homePct / 100 : voteStats.awayPct / 100;
                        return (
                            <PersonTile
                                key={v.userId ?? i}
                                colors={colors}
                                styles={styles}
                                name={isMe ? 'You' : v.userName}
                                subtitle={v.isComrade && !isMe ? 'comrade' : 'voter'}
                                accent={accent}
                                isMe={isMe}
                                badge={displayVote(v.selection).toUpperCase()}
                                badgeColor={accent}
                                progress={pct}
                            />
                        );
                    })
                )}
            </View>
        );
    }

    function renderPledgesTab() {
        return (
            <View style={styles.tabBody}>
                {renderBalanceBar()}

                <Text
                    style={[
                        fanText('caption', colors, colors.textSecondary),
                        { marginTop: FAN_SPACING.sm },
                    ]}
                >
                    {hasUserPledged
                        ? 'You can pledge multiple times on different picks.'
                        : 'Pick a side, then enter the amount to pledge.'}
                </Text>

                <View style={{ flexDirection: 'row', gap: FAN_SPACING.sm, marginTop: FAN_SPACING.sm }}>
                    <OutcomePill
                        label="Home"
                        selected={selectedPledgeOption === 'home'}
                        locked={isLive}
                        accent={colors.primary}
                        onPress={() => setSelectedPledgeOption('home')}
                        colors={colors}
                        styles={styles}
                    />
                    <OutcomePill
                        label="Away"
                        selected={selectedPledgeOption === 'away'}
                        locked={isLive}
                        accent={colors.away}
                        onPress={() => setSelectedPledgeOption('away')}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                <View
                    style={{
                        flexDirection: 'row',
                        gap: FAN_SPACING.sm,
                        alignItems: 'center',
                        marginTop: FAN_SPACING.sm,
                    }}
                >
                    <TextInput
                        value={pledgeAmount}
                        onChangeText={setPledgeAmount}
                        placeholder="Amount (KES)"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        editable={!!selectedPledgeOption && !isLive}
                        style={[
                            styles.input,
                            { flex: 1, color: colors.textPrimary },
                            !selectedPledgeOption && { opacity: 0.5 },
                        ]}
                    />
                    <CTA
                        label={pledging ? '…' : 'Pledge'}
                        onPress={handlePledge}
                        loading={pledging}
                        disabled={!selectedPledgeOption || !pledgeAmount || isLive}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                <SectionHeader
                    title="Pledges"
                    count={pledges.length}
                    loading={pledgesLoading}
                    colors={colors}
                    styles={styles}
                />

                {pledgesLoading && pledges.length === 0 ? (
                    <Spinner colors={colors} styles={styles} label="Loading pledges…" />
                ) : pledges.length === 0 ? (
                    <Empty colors={colors} styles={styles} icon="💰" label="No pledges yet" />
                ) : (
                    pledges.map((p) => {
                        const isMe = p.userId === userId;
                        const accent = voteColorOf(p.selection, colors);
                        const canMatch = !isMe && p.isOpen && !isLive;
                        return (
                            <PersonTile
                                key={p.betId}
                                colors={colors}
                                styles={styles}
                                name={isMe ? 'You' : p.userName}
                                subtitle={isMe ? 'your pledge' : 'pledged'}
                                accent={accent}
                                isMe={isMe}
                                badge={p.isOpen ? 'OPEN' : 'MATCHED'}
                                badgeColor={p.isOpen ? colors.primary : colors.textTertiary}
                                amountLabel={`KES ${p.amount.toFixed(2)}`}
                                trailing={
                                    canMatch ? (
                                        <CTA
                                            label="MATCH"
                                            onPress={() => startMatchMain(p)}
                                            small
                                            colors={colors}
                                            styles={styles}
                                        />
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
            return <Spinner colors={colors} styles={styles} label="Loading sub-fixtures…" />;
        if (subFixturesError && subFixtures.length === 0)
            return (
                <Empty
                    colors={colors}
                    styles={styles}
                    icon="⚠"
                    label={subFixturesError}
                    actionLabel="Retry"
                    onAction={() => void loadSubFixtures()}
                />
            );
        if (subFixtures.length === 0)
            return <Empty colors={colors} styles={styles} icon="🎲" label="No sub-fixture markets for this match" />;

        return (
            <View style={styles.tabBody}>
                {renderBalanceBar()}

                {subFixtures.map((market) => {
                    const isLine = market.marketType === 'over_under_2_5';
                    const outcomes = isLine
                        ? [
                            { key: 'over', label: `Over ${market.line ?? 2.5}` },
                            { key: 'under', label: `Under ${market.line ?? 2.5}` },
                        ]
                        : [
                            { key: 'home', label: fixture.homeTeam },
                            { key: 'away', label: fixture.awayTeam },
                            { key: 'none', label: 'None' },
                        ];
                    const isSettled = market.status === 'settled';
                    const isOpen = market.status === 'open';
                    const selected = isSettled ? market.result : subSelections[market.id];
                    const locked = isLive || !isOpen || isSettled;
                    const expanded = expandedSubs[market.id] ?? false;
                    const list = subPledges[market.id] ?? [];
                    const isLoading = subPledgesLoading[market.id] ?? false;
                    const error = subPledgesError[market.id];
                    const filter = subPledgeFilters[market.id] ?? 'all';
                    const filtered =
                        filter === 'all' ? list : list.filter((p) => p.selection === filter);
                    const isPledging = pledgingSubIds.has(market.id);
                    const title = marketTitle(market);
                    const totalPledges = Object.values(market.pledgeCounts ?? {}).reduce((a, b) => a + b, 0);
                    const statusTone = isSettled ? colors.secondary : isOpen ? colors.primary : colors.draw;

                    return (
                        <Card key={market.id} colors={colors} styles={styles} tone="sunken" style={{ marginBottom: FAN_SPACING.sm }}>
                            <Pressable
                                onPress={() => {
                                    setExpandedSubs((s) => ({ ...s, [market.id]: !expanded }));
                                    if (!expanded) void loadSubPledges(market.id);
                                }}
                                style={({ pressed }) => [
                                    { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm },
                                    pressed && { opacity: PRESSED_OPACITY },
                                ]}
                            >
                                <Text style={{ fontSize: ICON.sm }}>{marketIcon(market)}</Text>
                                <Text
                                    style={[
                                        fanText('caption', colors, colors.textPrimary),
                                        { flex: 1, fontWeight: '700' },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {title}
                                </Text>
                                <Text style={[fanText('tag', colors, statusTone), styles.miniPill]}>
                                    {market.status.toUpperCase()}
                                </Text>
                                <Text style={fanText('caption', colors, colors.textTertiary)}>
                                    {expanded ? '▲' : '▼'}
                                </Text>
                            </Pressable>

                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: FAN_SPACING.sm,
                                    marginTop: FAN_SPACING.sm,
                                }}
                            >
                                {outcomes.map((o) => (
                                    <OutcomePill
                                        key={o.key}
                                        label={o.label}
                                        selected={selected === o.key}
                                        locked={locked}
                                        accent={voteColorOf(o.key, colors)}
                                        onPress={() => setSubSelections((s) => ({ ...s, [market.id]: o.key }))}
                                        colors={colors}
                                        styles={styles}
                                    />
                                ))}
                            </View>

                            {totalPledges > 0 && (
                                <Text style={fanText('tag', colors, colors.textTertiary)}>
                                    {totalPledges} pledge{totalPledges === 1 ? '' : 's'}
                                    {isSettled && market.result
                                        ? ` · won by ${outcomes.find((o) => o.key === market.result)?.label ?? market.result}`
                                        : ''}
                                </Text>
                            )}

                            {isOpen && !isLive && (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        gap: FAN_SPACING.sm,
                                        alignItems: 'center',
                                        marginTop: FAN_SPACING.sm,
                                    }}
                                >
                                    <TextInput
                                        value={subAmounts[market.id] ?? ''}
                                        onChangeText={(v) => setSubAmounts((s) => ({ ...s, [market.id]: v }))}
                                        placeholder="Amount (KES)"
                                        placeholderTextColor={colors.textTertiary}
                                        keyboardType="numeric"
                                        editable={!!selected}
                                        style={[
                                            styles.input,
                                            { flex: 1, color: colors.textPrimary },
                                            !selected && { opacity: 0.5 },
                                        ]}
                                    />
                                    <CTA
                                        label={isPledging ? '…' : 'Pledge'}
                                        onPress={() => handleSubFixturePledge(market)}
                                        loading={isPledging}
                                        disabled={!selected}
                                        colors={colors}
                                        styles={styles}
                                    />
                                </View>
                            )}

                            {expanded && (
                                <View style={styles.subExpanded}>
                                    {list.length > 0 && (
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            style={{ marginBottom: FAN_SPACING.sm }}
                                        >
                                            <View style={{ flexDirection: 'row', gap: FAN_SPACING.xs }}>
                                                <Chip
                                                    label={`All ${list.length}`}
                                                    active={filter === 'all'}
                                                    onPress={() => setSubPledgeFilters((s) => ({ ...s, [market.id]: 'all' }))}
                                                    colors={colors}
                                                    styles={styles}
                                                />
                                                {outcomes.map((o) => (
                                                    <Chip
                                                        key={o.key}
                                                        label={`${o.label} ${list.filter((p) => p.selection === o.key).length}`}
                                                        active={filter === o.key}
                                                        onPress={() => setSubPledgeFilters((s) => ({ ...s, [market.id]: o.key }))}
                                                        colors={colors}
                                                        styles={styles}
                                                    />
                                                ))}
                                            </View>
                                        </ScrollView>
                                    )}

                                    {isLoading ? (
                                        <Spinner colors={colors} styles={styles} label="Loading pledges…" />
                                    ) : error ? (
                                        <Empty
                                            colors={colors}
                                            styles={styles}
                                            icon="⚠"
                                            label="Failed to load pledges"
                                            actionLabel="Retry"
                                            onAction={() => void loadSubPledges(market.id, true)}
                                        />
                                    ) : filtered.length === 0 ? (
                                        <Empty
                                            colors={colors}
                                            styles={styles}
                                            icon="💰"
                                            label={filter === 'all' ? 'No pledges yet' : 'No pledges for this selection'}
                                        />
                                    ) : (
                                        filtered.map((p) => {
                                            const isMe = p.userId === userId;
                                            const canMatch =
                                                !isMe && p.status === 'open' && isOpen && !isLive;
                                            const matching = matchingSubIds.has(p.id);
                                            return (
                                                <PersonTile
                                                    key={p.id}
                                                    colors={colors}
                                                    styles={styles}
                                                    name={p.userName}
                                                    subtitle={`Pledged ${p.amount.toFixed(2)} KES`}
                                                    accent={voteColorOf(p.selection, colors)}
                                                    isMe={isMe}
                                                    badge={p.status === 'settled' ? 'WON' : isMe ? 'YOU' : undefined}
                                                    badgeColor={colors.primary}
                                                    amountLabel={p.selection.toUpperCase()}
                                                    trailing={
                                                        canMatch ? (
                                                            <CTA
                                                                label={matching ? '…' : 'MATCH'}
                                                                onPress={() => startMatchSub(market, p)}
                                                                loading={matching}
                                                                small
                                                                colors={colors}
                                                                styles={styles}
                                                            />
                                                        ) : undefined
                                                    }
                                                />
                                            );
                                        })
                                    )}
                                </View>
                            )}
                        </Card>
                    );
                })}
            </View>
        );
    }

    function renderBetsTab() {
        if (betsLoading)
            return <Spinner colors={colors} styles={styles} label="Loading bets…" />;
        if (bets.length === 0)
            return <Empty colors={colors} styles={styles} icon="🏆" label="No active bets" />;

        const bet = bets[Math.min(betIndex, bets.length - 1)];
        const pick = (s?: string | null) => (isHomeSel(s) ? 'Home' : isAwaySel(s) ? 'Away' : s ?? '?');
        const isStarter = bet.starterId === userId;
        const isFinisher = bet.finisherId === userId;
        const heading = isStarter
            ? `You vs ${bet.finisherName ?? '?'}`
            : isFinisher
                ? `${bet.starterName} vs You`
                : `${bet.starterName} vs ${bet.finisherName ?? '?'}`;
        const pot = bet.totalPot ?? Number(bet.starterAmount ?? 0) + Number(bet.finisherAmount ?? 0);
        const statusColor =
            bet.status === 'open' || bet.status === 'matched' ? colors.primary
                : bet.status === 'settled' ? colors.secondary : colors.away;

        return (
            <View style={styles.tabBody}>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 4,
                        marginBottom: FAN_SPACING.sm,
                    }}
                >
                    {bets.map((_, i) => (
                        <Pressable
                            key={i}
                            onPress={() => setBetIndex(i)}
                            style={{
                                height: 4,
                                width: i === betIndex ? 18 : 6,
                                borderRadius: 2,
                                backgroundColor: i === betIndex ? colors.primary : colors.border,
                            }}
                        />
                    ))}
                </View>
                <Card colors={colors} styles={styles} tone="sunken">
                    <Text
                        numberOfLines={1}
                        style={[fanText('caption', colors, colors.textPrimary), { fontWeight: '700' }]}
                    >
                        {heading}
                    </Text>
                    <Text style={fanText('tag', colors, colors.textTertiary)}>
                        Bet #{String(bet.id ?? '').slice(0, 8)} · {timeAgo(bet.createdAt)}
                    </Text>
                    <ActionRow
                        label={bet.starterName}
                        colors={colors}
                        styles={styles}
                        trailing={
                            <Text style={[fanText('caption', colors, colors.primary), { fontWeight: '700' }]}>
                                {pick(bet.starterSelection)} · KES {Number(bet.starterAmount ?? 0).toFixed(2)}
                            </Text>
                        }
                    />
                    <ActionRow
                        label={bet.finisherName ?? 'Waiting'}
                        colors={colors}
                        styles={styles}
                        trailing={
                            <Text style={[fanText('caption', colors, colors.secondary), { fontWeight: '700' }]}>
                                {pick(bet.finisherSelection)} · KES {Number(bet.finisherAmount ?? 0).toFixed(2)}
                            </Text>
                        }
                    />
                    <ActionRow
                        label="Pot"
                        colors={colors}
                        styles={styles}
                        trailing={
                            <Text style={[fanText('caption', colors, colors.primary), { fontWeight: '700' }]}>
                                KES {Number(pot).toFixed(2)}
                            </Text>
                        }
                    />
                    <Text
                        style={[
                            fanText('tag', colors, statusColor),
                            styles.miniPill,
                            { alignSelf: 'flex-start' },
                        ]}
                    >
                        {String(bet.status ?? '').toUpperCase()}
                    </Text>
                </Card>
            </View>
        );
    }
}

// ─────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────

function createStyles(colors: FanColorPalette) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'flex-end',
        },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: FAN_RADIUS.xl,
            borderTopRightRadius: FAN_RADIUS.xl,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            borderBottomWidth: 0,
        },
        handleWrap: {
            alignItems: 'center',
            paddingTop: FAN_SPACING.sm,
            paddingBottom: FAN_SPACING.xs,
        },
        handle: { width: 36, height: 4, borderRadius: 2 },

        // In-modal toast
        banner: {
            position: 'absolute',
            top: FAN_SPACING.md,
            left: FAN_SPACING.lg,
            right: FAN_SPACING.lg,
            zIndex: 30,
            elevation: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.sm,
            padding: FAN_SPACING.md,
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.inputSurface,
            borderWidth: 1,
        },
        bannerDot: { width: 8, height: 8, borderRadius: 4 },

        // Header
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: FAN_SPACING.lg,
            paddingTop: FAN_SPACING.xs,
            paddingBottom: FAN_SPACING.md,
            gap: FAN_SPACING.sm,
        },
        headerIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.inputSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        closeBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.inputSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        closeBtnText: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: '700',
        },

        // Match header
        matchHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: FAN_SPACING.lg,
            marginBottom: FAN_SPACING.sm,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: FAN_SPACING.sm,
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.inputSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            gap: FAN_SPACING.sm,
        },
        matchHeaderSide: { flex: 1, minWidth: 0 },
        matchHeaderCenter: { alignItems: 'center', gap: 2 },
        liveBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.awayDim,
            paddingHorizontal: FAN_SPACING.sm,
            paddingVertical: 2,
            borderRadius: 6,
            gap: 4,
        },
        liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.away },
        liveText: { fontSize: 8, fontWeight: '700', color: colors.away },

        // Tab bar
        tabBar: {
            flexDirection: 'row',
            position: 'relative',
            marginHorizontal: FAN_SPACING.lg,
            marginBottom: FAN_SPACING.sm,
            padding: 3,
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.inputSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },
        tabIndicator: {
            position: 'absolute',
            top: 3,
            bottom: 3,
            borderRadius: FAN_RADIUS.md - 3,
            opacity: 0.9,
        },
        tabButton: {
            flex: 1,
            alignItems: 'center',
            paddingVertical: FAN_SPACING.sm,
            zIndex: 1,
        },

        // Layout
        tabBody: {
            paddingHorizontal: FAN_SPACING.lg,
            paddingTop: FAN_SPACING.xs,
            gap: FAN_SPACING.sm,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: FAN_SPACING.md,
            marginBottom: FAN_SPACING.xs,
        },
        actionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 4,
        },

        // Card primitive
        card: {
            borderRadius: FAN_RADIUS.lg,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            padding: FAN_SPACING.md,
            gap: FAN_SPACING.sm,
        },

        // Hero
        heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        heroPct: { flex: 1, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
        splitBar: {
            flexDirection: 'row',
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
            backgroundColor: colors.background,
        },
        splitHome: { height: '100%' },
        splitAway: { height: '100%' },

        // Outcome pill
        outcomeCard: {
            flex: 1,
            paddingVertical: FAN_SPACING.sm + 2,
            paddingHorizontal: FAN_SPACING.sm,
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            position: 'relative',
        },
        checkDot: {
            position: 'absolute',
            top: -6,
            right: -6,
            width: 18,
            height: 18,
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkDotText: { color: '#fff', fontSize: 10, fontWeight: '800' },

        // Filter chip
        filterRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: FAN_SPACING.xs,
        },
        filterChip: {
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: 6,
            borderRadius: FAN_RADIUS.pill,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },

        // Inputs & CTA
        input: {
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.inputSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: Platform.OS === 'ios' ? 11 : 8,
            fontSize: 13,
        },
        cta: {
            paddingVertical: FAN_SPACING.md,
            borderRadius: FAN_RADIUS.pill,
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 96,
        },
        ctaText: {
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 0.3,
        },
        ctaSmall: {
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: 7,
            borderRadius: FAN_RADIUS.pill,
            alignItems: 'center',
            justifyContent: 'center',
        },
        ctaSmallText: {
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.4,
        },

        // Balance bar
        balanceBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.sm,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: FAN_SPACING.sm,
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.inputSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },

        // Sub-fixture card
        subExpanded: {
            marginTop: FAN_SPACING.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            paddingTop: FAN_SPACING.sm,
        },

        // Person tile
        personTile: {
            paddingHorizontal: FAN_SPACING.sm,
            paddingVertical: FAN_SPACING.sm,
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            marginBottom: FAN_SPACING.xs,
            gap: FAN_SPACING.sm,
        },
        personRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.sm,
        },
        avatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: StyleSheet.hairlineWidth,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarText: { fontSize: 12, fontWeight: '800' },
        miniPill: {
            fontSize: 8,
            fontWeight: '800',
            letterSpacing: 0.4,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            overflow: 'hidden',
            backgroundColor: colors.background,
        },
        progressTrack: {
            height: 3,
            borderRadius: 2,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
        },

        // Live overlay
        liveOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            gap: FAN_SPACING.xs,
        },
        liveBadgeLg: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.xs,
            marginTop: FAN_SPACING.md,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: FAN_SPACING.sm,
            borderRadius: FAN_RADIUS.pill,
            borderWidth: StyleSheet.hairlineWidth,
        },
        liveDotLg: { width: 6, height: 6, borderRadius: 3 },

        // Empty / spinner
        emptyWrap: {
            alignItems: 'center',
            paddingVertical: FAN_SPACING.xl,
            gap: FAN_SPACING.sm,
        },
        emptyIcon: { fontSize: 36, opacity: 0.35 },
        emptyCta: {
            marginTop: FAN_SPACING.sm,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: 6,
            borderRadius: FAN_RADIUS.pill,
            backgroundColor: colors.inputSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },
        spinnerWrap: {
            alignItems: 'center',
            paddingVertical: FAN_SPACING.xl,
            gap: FAN_SPACING.sm,
        },

        // Footer
        footer: {
            paddingHorizontal: FAN_SPACING.lg,
            paddingTop: FAN_SPACING.sm,
            paddingBottom: FAN_SPACING.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
        },
        shareBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: FAN_SPACING.sm,
            paddingVertical: FAN_SPACING.sm,
            borderRadius: FAN_RADIUS.pill,
            backgroundColor: colors.inputSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },
        shareIcon: { fontSize: 14, color: colors.primary, fontWeight: '700' },
        shareText: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.textPrimary,
            letterSpacing: 0.3,
        },

        // Dialogs
        dialogBackdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: FAN_SPACING.xl,
            zIndex: 20,
        },
        dialogCard: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.inputSurface,
            borderRadius: FAN_RADIUS.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            padding: FAN_SPACING.lg,
        },
        dialogSummary: {
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: FAN_SPACING.sm,
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.background,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            marginBottom: FAN_SPACING.md,
            gap: 2,
        },
        dialogActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: FAN_SPACING.sm,
            marginTop: FAN_SPACING.md,
        },

        // Join group
        joinGroupBox: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: FAN_SPACING.xl,
            gap: FAN_SPACING.sm,
        },
        joinGroupIconWrap: {
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: colors.inputSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: FAN_SPACING.md,
        },
        joinGroupEmoji: { fontSize: 40 },
    });
}