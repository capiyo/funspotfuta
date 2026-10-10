'use client';

// Web port of RN src/modals/LeaderboardModal.tsx.
//  - LEADERBOARD tab: champion card (rank 1) + member cards (rank 2+)
//  - VOTES tab (only when a `fixture` is passed): vote summary bar, All/Home/Draw/Away
//    chips, voters list filtered to comrades + you
//  - Tapping a member opens their Activity History sheet
// <LeaderboardPanel/> is the content (used inline by app/(app)/leaderboard/page.tsx);
// the default export wraps it in a bottom-sheet/centered modal like the RN one.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Trophy, Star, Flame, Target, Users, Vote, MessageCircle, Heart, Inbox } from 'lucide-react';
import {
    Fixture,
    Channel,
    ComradeWithStats,
    comradeWithStatsFromChannelMember,
    getUserChannels,
    getChannelLeaderboard,
    getUserComrades,
} from '@funspot/core';
// Same deep import RN uses. The local lib/api/vote-modal-shims.ts is an older copy
// that has no fetchUserActivityHistory.
import { fetchVoters, fetchUserActivityHistory } from '@funspot/core/src/api/vote-modal-shims';
import { useAuth } from '@/lib/auth/auth-context';

// ── helpers ────────────────────────────────────────────────────────────────
const C = {
    primary: 'var(--fan-primary)',
    away: 'var(--fan-away)',
    draw: 'var(--fan-draw)',
    t1: 'var(--fan-text-primary)',
    t2: 'var(--fan-text-secondary)',
    t3: 'var(--fan-text-tertiary)',
    border: 'var(--fan-border)',
    surface: 'var(--fan-surface)',
};
/** Alpha for any CSS color, including var(...) tokens. */
const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const RANK_COLORS = { gold: '#FFD700', silver: '#B0B0B0', bronze: '#CD7F32' };
const rankColor = (r: number) => (r === 1 ? RANK_COLORS.gold : r === 2 ? RANK_COLORS.silver : r === 3 ? RANK_COLORS.bronze : C.t3);
const rankLabel = (r: number) => (r === 1 ? 'CHAMPION' : r === 2 ? 'RUNNER UP' : r === 3 ? '3RD PLACE' : `#${r}`);
const medalFor = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null);

function initials(name: string): string {
    const parts = (name?.trim() ?? '').split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
}

function timeAgo(date: Date): string {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const Spinner = () => (
    <div className="flex justify-center py-12">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
    </div>
);

const YouPill = ({ text = 'YOU' }: { text?: string }) => (
    <span className="rounded-fan-pill px-1.5 py-px text-[8px] font-bold tracking-wider text-fan-primary" style={{ background: mix(C.primary, 15) }}>
        {text}
    </span>
);

// ── cards ──────────────────────────────────────────────────────────────────
function ChampionCard({ row, isMe, onClick }: { row: ComradeWithStats; isMe: boolean; onClick: () => void }) {
    const accent = rankColor(row.rank);
    const name = row.nickname || row.username;
    const stat = (icon: React.ReactNode, value: string, label: string) => (
        <div className="flex flex-1 flex-col items-center gap-0.5">
            {icon}
            <span className="font-condensed text-fan-statValue text-fan-textPrimary">{value}</span>
            <span className="text-[8px] font-bold tracking-wider text-fan-textTertiary">{label}</span>
        </div>
    );
    return (
        <button
            type="button"
            onClick={onClick}
            className="mb-3 w-full rounded-fan-lg border p-3 text-left transition-opacity hover:opacity-80"
            style={{ background: mix(accent, 6), borderColor: mix(accent, 25) }}
        >
            <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-fan-pill px-2 py-0.5 text-[9px] font-bold tracking-wider" style={{ background: mix(accent, 15), color: accent }}>
                    <Trophy size={11} color={accent} /> {rankLabel(row.rank)}
                </span>
                <span className="rounded-fan-pill px-2 py-0.5 text-[10px] font-bold" style={{ background: mix(accent, 10), color: accent }}>#{row.rank}</span>
            </div>
            <div className="mb-3 flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-fan-title font-bold" style={{ background: mix(accent, 8), borderColor: mix(accent, 35), color: accent }}>
                    {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate font-condensed text-fan-headline text-fan-textPrimary">{name}</span>
                        {isMe && <YouPill />}
                    </div>
                    <p className="truncate text-fan-caption text-fan-textSecondary">@{row.username}</p>
                    {!!row.clubFan && <p className="truncate text-fan-caption text-fan-textTertiary">{row.clubFan}</p>}
                </div>
            </div>
            <div className="flex">
                {stat(<Target size={12} color={C.primary} />, `${row.accuracyPercentage.toFixed(1)}%`, 'ACCURACY')}
                {stat(<Star size={12} color={C.primary} />, `${row.totalPoints}`, 'POINTS')}
                {stat(<Flame size={12} color={C.draw} />, `${row.currentStreak}`, 'STREAK')}
            </div>
        </button>
    );
}

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-1">
            <span className="text-fan-caption text-fan-textSecondary">{label}</span>
            <span className="flex items-center gap-1">{children}</span>
        </div>
    );
}

function MemberCard({ row, isMe, onClick }: { row: ComradeWithStats; isMe: boolean; onClick: () => void }) {
    const accent = rankColor(row.rank);
    const medal = medalFor(row.rank);
    const name = row.nickname || row.username;
    const correctPct = row.totalVotes > 0 ? (row.correctVotes / row.totalVotes) * 100 : 0;
    const wrongPct = row.totalVotes > 0 ? 100 - correctPct : 0;
    const val = 'text-fan-statValue text-fan-textPrimary font-condensed';
    const muted = 'text-fan-caption';
    return (
        <button
            type="button"
            onClick={onClick}
            className="mb-2 w-full rounded-fan-lg border p-3 text-left transition-opacity hover:opacity-80"
            style={{ borderColor: isMe ? mix(C.primary, 50) : C.border, background: isMe ? mix(C.primary, 6) : C.surface }}
        >
            <div className="mb-2 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fan-badge font-bold text-fan-primary" style={{ background: mix(C.primary, 12) }}>
                    {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-fan-title text-fan-textPrimary">{name}</span>
                        {isMe && <YouPill />}
                    </div>
                    <p className="truncate text-fan-caption text-fan-textTertiary">#{row.rank}{row.clubFan ? ` · ${row.clubFan}` : ''}</p>
                </div>
                {medal ? (
                    <span className="text-xl">{medal}</span>
                ) : (
                    <span className="rounded-fan-pill px-2 py-0.5 text-[10px] font-bold text-fan-textTertiary" style={{ background: mix(C.t3, 10) }}>#{row.rank}</span>
                )}
            </div>

            <StatRow label="Rating">
                {Array.from({ length: 5 }).map((_, i) => {
                    const filled = row.accuracyPercentage / 20 > i;
                    return <Star key={i} size={11} color={filled ? accent : C.border} fill={filled ? accent : 'transparent'} />;
                })}
                <span className={`${muted} text-fan-textTertiary`}>({row.totalPoints})</span>
            </StatRow>
            <StatRow label="Votes">
                <span className={val}>{row.totalVotes}</span>
                <span className={muted} style={{ color: row.accuracyPercentage >= 70 ? C.primary : C.t3 }}>{row.accuracyPercentage.toFixed(0)}%</span>
            </StatRow>
            <StatRow label="Accuracy">
                <span className={val}>{row.correctVotes}</span>
                <span className={`${muted} text-fan-primary`}>{correctPct.toFixed(0)}%</span>
                <span className={`${muted} text-fan-away`}>/{wrongPct.toFixed(0)}%</span>
            </StatRow>
            <StatRow label="Streak">
                <span className={val}>{row.currentStreak}</span>
                <span className={`${muted} text-fan-textTertiary`}>best {row.bestStreak}</span>
            </StatRow>

            <div className="mt-2 flex items-center gap-2">
                <span className="rounded-fan-pill px-2 py-0.5 text-[8px] font-bold tracking-wider text-white" style={{ background: row.isOnline ? C.primary : mix(C.t3, 50) }}>
                    {row.isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-fan-surfaceSunken">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, row.accuracyPercentage))}%`, background: accent }} />
                </span>
            </div>
        </button>
    );
}

// ── votes tab ──────────────────────────────────────────────────────────────
interface VoterRow { userId: string; username: string; selection: string; isComrade: boolean }
type VoteFilter = 'all' | 'home' | 'draw' | 'away';

function VotersTab({ fixture, userId, channelId, authToken }: { fixture: Fixture; userId: string | null; channelId: string | null; authToken: string | null }) {
    const [voters, setVoters] = useState<VoterRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<VoteFilter>('all');
    const seq = useRef(0);
    const fixtureId = fixture.matchId || fixture.id;

    const load = useCallback(async (spinner: boolean) => {
        if (!userId) return;
        const my = ++seq.current;
        if (spinner) setLoading(true);
        try {
            const [raw, comrades] = await Promise.all([fetchVoters(fixtureId), getUserComrades(userId, authToken ?? undefined)]);
            if (my !== seq.current) return;
            const set = new Set(comrades.map((c: any) => c.comrade_id));
            const list: VoterRow[] = (Array.isArray(raw) ? raw : [])
                .map((v: any) => ({
                    userId: v.userId ?? v.user_id ?? '',
                    username: v.username ?? v.userName ?? 'Anonymous',
                    selection: v.selection ?? '',
                    isComrade: set.has(v.userId ?? v.user_id ?? ''),
                }))
                .filter((v) => v.isComrade || v.userId === userId)
                .sort((a, b) => (a.userId === userId ? -1 : b.userId === userId ? 1 : a.username.localeCompare(b.username)));
            setVoters(list);
        } catch {
            if (my === seq.current) setVoters([]);
        } finally {
            if (my === seq.current) { setLoading(false); setRefreshing(false); }
        }
    }, [fixtureId, userId, authToken]);

    useEffect(() => { load(true); }, [load, channelId]);

    const stats = useMemo(() => {
        let home = 0, away = 0, draw = 0;
        for (const v of voters) {
            if (v.selection === 'home_team') home++;
            else if (v.selection === 'away_team') away++;
            else if (v.selection === 'draw') draw++;
        }
        const total = home + away + draw;
        const p = (n: number) => (total > 0 ? (n / total) * 100 : 0);
        return { home, away, draw, total, homePct: p(home), awayPct: p(away), drawPct: p(draw) };
    }, [voters]);

    const filtered = useMemo(() => {
        const want = { all: null, home: 'home_team', away: 'away_team', draw: 'draw' }[filter];
        return want ? voters.filter((v) => v.selection === want) : voters;
    }, [voters, filter]);

    const voteColor = (s: string) => (s === 'home_team' ? C.primary : s === 'away_team' ? C.away : s === 'draw' ? C.draw : C.t3);
    const displayVote = (s: string) => (s === 'home_team' ? fixture.homeTeam : s === 'away_team' ? fixture.awayTeam : s === 'draw' ? 'Draw' : s);

    if (loading) return <Spinner />;

    const Summary = ({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) => (
        <div className="flex min-w-0 flex-1 flex-col items-center">
            <span className="font-condensed text-fan-scoreCompact" style={{ color }}>{count}</span>
            <span className="max-w-full truncate text-fan-caption" style={{ color }}>{label}</span>
            <span className="text-fan-caption" style={{ color: mix(color, 70) }}>{pct.toFixed(0)}%</span>
        </div>
    );
    const Chip = ({ id, label, count, color }: { id: VoteFilter; label: string; count: number; color: string }) => {
        const active = filter === id;
        return (
            <button
                type="button"
                onClick={() => setFilter(id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-fan-pill border px-3 py-1 text-fan-caption font-semibold transition-opacity hover:opacity-80"
                style={{ background: active ? color : mix(color, 6), borderColor: active ? 'transparent' : mix(color, 15), color: active ? '#fff' : color }}
            >
                <span className="max-w-[110px] truncate">{label}</span>
                {count > 0 && <span style={{ opacity: 0.85 }}>{count}</span>}
            </button>
        );
    };

    return (
        <div>
            <div className="mb-3 rounded-fan-lg border border-fan-border bg-fan-surface p-3">
                <div className="mb-2 flex">
                    <Summary label={fixture.homeTeam} count={stats.home} pct={stats.homePct} color={C.primary} />
                    <Summary label="Draw" count={stats.draw} pct={stats.drawPct} color={C.draw} />
                    <Summary label={fixture.awayTeam} count={stats.away} pct={stats.awayPct} color={C.away} />
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-fan-border">
                    {stats.home > 0 && <span style={{ flex: Math.max(stats.homePct, 1), background: C.primary }} />}
                    {stats.draw > 0 && <span style={{ flex: Math.max(stats.drawPct, 1), background: C.draw }} />}
                    {stats.away > 0 && <span style={{ flex: Math.max(stats.awayPct, 1), background: C.away }} />}
                </div>
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto">
                <Chip id="all" label="All" count={stats.total} color={C.primary} />
                <Chip id="home" label={fixture.homeTeam} count={stats.home} color={C.primary} />
                <Chip id="draw" label="Draw" count={stats.draw} color={C.draw} />
                <Chip id="away" label={fixture.awayTeam} count={stats.away} color={C.away} />
                <button type="button" onClick={() => { setRefreshing(true); load(false); }} className="ml-auto shrink-0 px-2 text-fan-caption text-fan-textTertiary">
                    {refreshing ? '…' : 'Refresh'}
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12">
                    <Users size={32} color={mix(C.t3, 40)} />
                    <p className="text-fan-body text-fan-textTertiary">{filter === 'all' ? 'No votes yet' : 'No votes for this selection'}</p>
                </div>
            ) : (
                filtered.map((v) => {
                    const isMe = v.userId === userId;
                    const vc = voteColor(v.selection);
                    return (
                        <div key={v.userId} className="flex items-center gap-3 border-b border-fan-border/30 py-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fan-badge font-bold" style={{ background: mix(vc, 10), color: vc }}>{initials(v.username)}</span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="truncate text-fan-title" style={{ color: isMe ? C.primary : C.t1 }}>{isMe ? 'You' : v.username}</span>
                                    {v.isComrade && !isMe && <YouPill text="COMRADE" />}
                                </div>
                                <p className="text-fan-caption text-fan-textTertiary">Voted for {displayVote(v.selection)}</p>
                            </div>
                            <span className="rounded-fan-pill px-2 py-0.5 text-fan-caption font-semibold" style={{ background: mix(vc, 10), color: vc }}>{displayVote(v.selection)}</span>
                        </div>
                    );
                })
            )}
        </div>
    );
}

// ── activity history sheet ─────────────────────────────────────────────────
interface ActivityHistoryParams { userId: string; userName: string; displayName: string; clubFan: string; authToken: string | null }
interface ArchiveActivity {
    id: string; fixtureId: string; homeTeam: string; awayTeam: string;
    activityType: 'vote' | 'comment' | 'like'; selectedTeam: string; comment?: string; timestamp: Date;
}

function ActivityHistorySheet({ params, onClose }: { params: ActivityHistoryParams; onClose: () => void }) {
    const [activities, setActivities] = useState<ArchiveActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'All' | 'Votes' | 'Comments' | 'Likes'>('All');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const raw = await fetchUserActivityHistory(params.userId, params.authToken ?? undefined);
                if (cancelled) return;
                const list: ArchiveActivity[] = (Array.isArray(raw) ? raw : []).map((item: any) => ({
                    id: item._id?.toString() ?? `${item.fixture_id}-${item.timestamp}-${item.activity_type}`,
                    fixtureId: item.fixture_id?.toString() ?? '',
                    homeTeam: item.home_team?.toString() ?? '',
                    awayTeam: item.away_team?.toString() ?? '',
                    activityType: (item.activity_type?.toString() ?? 'vote') as ArchiveActivity['activityType'],
                    selectedTeam: item.selection === 'home_team' ? item.home_team ?? 'Home' : item.selection === 'away_team' ? item.away_team ?? 'Away' : 'Draw',
                    comment: item.comment?.toString(),
                    timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
                }));
                list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                setActivities(list);
            } catch {
                if (!cancelled) setActivities([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [params]);

    const filtered = useMemo(() => {
        if (filter === 'All') return activities;
        const want = filter === 'Votes' ? 'vote' : filter === 'Comments' ? 'comment' : 'like';
        return activities.filter((a) => a.activityType === want);
    }, [activities, filter]);

    return (
        <Sheet onClose={onClose} z={60}>
            <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fan-badge font-bold text-fan-primary" style={{ background: mix(C.primary, 12) }}>{initials(params.displayName)}</span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-fan-title text-fan-textPrimary">{params.displayName}</p>
                    <p className="truncate text-fan-caption text-fan-textTertiary">@{params.userName}{params.clubFan ? ` · ${params.clubFan}` : ''}</p>
                </div>
                <CloseBtn onClick={onClose} />
            </div>
            <div className="mb-3 flex gap-4">
                {(['All', 'Votes', 'Comments', 'Likes'] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFilter(f)} className="text-fan-body" style={{ color: filter === f ? C.primary : C.t3, fontWeight: filter === f ? 600 : 400 }}>{f}</button>
                ))}
            </div>
            {loading ? <Spinner /> : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12">
                    <Inbox size={32} color={mix(C.t3, 40)} />
                    <p className="text-fan-body text-fan-textTertiary">No activities yet</p>
                </div>
            ) : (
                filtered.map((a) => {
                    const accent = a.activityType === 'vote' ? C.primary : a.activityType === 'comment' ? C.draw : C.t3;
                    const Icon = a.activityType === 'vote' ? Vote : a.activityType === 'comment' ? MessageCircle : Heart;
                    return (
                        <div key={a.id} className="mb-2 rounded-fan-lg border border-fan-border bg-fan-surface p-3">
                            <div className="mb-1 flex items-center gap-1.5 text-fan-caption">
                                <Icon size={12} color={accent} />
                                <span className="font-bold tracking-wider" style={{ color: accent }}>{a.activityType.toUpperCase()}</span>
                                <span className="text-fan-textTertiary">•</span>
                                <span className="text-fan-textTertiary">{timeAgo(a.timestamp)}</span>
                            </div>
                            <div className="mb-1 flex items-center gap-1.5 text-fan-body text-fan-textPrimary">
                                <span className="truncate">{a.homeTeam}</span><span className="text-fan-textTertiary">vs</span><span className="truncate">{a.awayTeam}</span>
                            </div>
                            <div className="flex items-stretch gap-2">
                                <span className="w-0.5 rounded-full" style={{ background: accent }} />
                                <p className="line-clamp-2 text-fan-body" style={{ color: a.activityType === 'comment' ? C.t1 : a.activityType === 'vote' ? C.primary : C.t3 }}>
                                    {a.activityType === 'comment' ? a.comment ?? 'No comment' : a.activityType === 'vote' ? a.selectedTeam : 'Showed support'}
                                </p>
                            </div>
                        </div>
                    );
                })
            )}
        </Sheet>
    );
}

// ── shell bits ─────────────────────────────────────────────────────────────
function CloseBtn({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full bg-fan-surfaceSunken">
            <X size={14} color={C.t2} />
        </button>
    );
}

function Sheet({ children, onClose, z = 50 }: { children: React.ReactNode; onClose: () => void; z?: number }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div className="fixed inset-0 flex items-end justify-center bg-black/50 sm:items-center" style={{ zIndex: z }} onClick={onClose}>
            <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-fan-xl border border-fan-border bg-fan-background p-4 sm:rounded-fan-xl" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}

// ── main panel ─────────────────────────────────────────────────────────────
export function LeaderboardPanel({
    fixture = null,
    channelId,
    channelName,
    onClose,
}: {
    /** When provided, the VOTES tab is shown. */
    fixture?: Fixture | null;
    /** Lock to a channel (hides the channel picker). */
    channelId?: string;
    channelName?: string;
    onClose?: () => void;
}) {
    const { userId, authToken } = useAuth();
    const [channels, setChannels] = useState<Channel[]>([]);
    const [activeChannelId, setActiveChannelId] = useState<string | null>(channelId ?? null);
    const [rows, setRows] = useState<ComradeWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'leaderboard' | 'votes'>('leaderboard');
    const [history, setHistory] = useState<ActivityHistoryParams | null>(null);
    const hasFixture = !!fixture;

    useEffect(() => { if (channelId) setActiveChannelId(channelId); }, [channelId]);

    useEffect(() => {
        if (!userId || !authToken) return;
        getUserChannels(userId, authToken).then((c) => {
            setChannels(c);
            setActiveChannelId((prev) => prev ?? c[0]?.channelId ?? null);
        });
    }, [userId, authToken]);

    useEffect(() => {
        if (!activeChannelId || !authToken || !userId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            const [board, comrades] = await Promise.all([getChannelLeaderboard(activeChannelId, authToken), getUserComrades(userId, authToken)]);
            if (cancelled) return;
            const set = new Set(comrades.map((c: any) => c.comrade_id));
            const list: any[] = board?.leaderboard ?? [];
            setRows(list.map((item) => comradeWithStatsFromChannelMember(item, set)).sort((a, b) => a.rank - b.rank));
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [activeChannelId, authToken, userId]);

    const openHistory = (r: ComradeWithStats) =>
        setHistory({ userId: r.id, userName: r.username, displayName: r.nickname || r.username, clubFan: r.clubFan, authToken });

    const title = channelName ?? channels.find((c) => c.channelId === activeChannelId)?.name ?? 'Leaderboard';
    const champion = rows[0] ?? null;
    const members = rows.slice(1);

    return (
        <div>
            <div className="mb-3 flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: mix(C.primary, 12) }}><Trophy size={16} color={C.primary} /></span>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-condensed text-fan-headline uppercase text-fan-textPrimary">{title}</p>
                    <p className="text-fan-caption text-fan-textTertiary">{rows.length} members</p>
                </div>
                {onClose && <CloseBtn onClick={onClose} />}
            </div>

            {!channelId && channels.length > 0 && (
                <select
                    value={activeChannelId ?? ''}
                    onChange={(e) => setActiveChannelId(e.target.value)}
                    className="mb-3 w-full rounded-fan-md border border-fan-border bg-fan-surface px-3 py-2 text-fan-body text-fan-textPrimary"
                >
                    {channels.map((c) => <option key={c.channelId} value={c.channelId}>{c.name}</option>)}
                </select>
            )}

            {hasFixture && (
                <div className="mb-3 flex rounded-fan-md bg-fan-surfaceSunken p-0.5">
                    {(['leaderboard', 'votes'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setTab(t)}
                            className={`flex-1 rounded-fan-md py-1.5 text-fan-tag font-bold tracking-wider ${tab === t ? 'bg-fan-surfaceElevated text-fan-textPrimary' : 'text-fan-textTertiary'}`}>
                            {t.toUpperCase()}
                        </button>
                    ))}
                </div>
            )}

            {channels.length === 0 && !loading ? (
                <p className="py-12 text-center text-fan-body text-fan-textTertiary">Join or create a channel to see its leaderboard.</p>
            ) : tab === 'leaderboard' || !hasFixture ? (
                loading ? <Spinner /> : rows.length === 0 ? (
                    <p className="py-12 text-center text-fan-body text-fan-textTertiary">No leaderboard data yet.</p>
                ) : (
                    <>
                        {champion && <ChampionCard row={champion} isMe={champion.id === userId} onClick={() => openHistory(champion)} />}
                        {members.map((r) => <MemberCard key={r.id} row={r} isMe={r.id === userId} onClick={() => openHistory(r)} />)}
                    </>
                )
            ) : (
                <VotersTab fixture={fixture!} userId={userId} channelId={activeChannelId} authToken={authToken} />
            )}

            {history && <ActivityHistorySheet params={history} onClose={() => setHistory(null)} />}
        </div>
    );
}

export default function LeaderboardModal({
    visible,
    onClose,
    ...rest
}: { visible: boolean; onClose: () => void; fixture?: Fixture | null; channelId?: string; channelName?: string }) {
    // Remount on open so the tab resets to LEADERBOARD, same as RN.
    if (!visible) return null;
    return (
        <Sheet onClose={onClose}>
            <LeaderboardPanel {...rest} onClose={onClose} />
        </Sheet>
    );
}