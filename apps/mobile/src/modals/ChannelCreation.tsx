// RN port of funspot/lib/modals/Funzy/create_channel_modal.dart — as a MODAL.
//
// Faithful to the Flutter source's two-stage flow:
//   1. Fetch all user profiles + all channels in parallel, and attach
//      each user's channel-membership history so the tile can show
//      "in N channels · role · points".
//   2. Admin picks a name + at least one member, then POSTs to create
//      the channel via @funspot/core's createChannel.
//
// The core createChannel service passes `members` through to the POST
// body verbatim, so whatever shape we send is what the server receives.
// CreateChannelParams declares `{ id, username }` per member, so that's
// what we send. If the backend ends up needing snake_case `user_id`,
// the fix belongs in comrade-service.ts, not here.
//
// NOTE: @funspot/core does NOT export getAllProfiles / getAllChannels
// (it exports getProfile and getChannel, both single-record lookups).
// The two local fetchers below hit the same raw endpoints the Flutter
// source does. Only `createChannel` is imported from the core barrel.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    FlatList,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    Modal,
} from 'react-native';
import {
    X,
    UserPlus,
    Users,
    Search,
    Eye,
    EyeOff,
    Check,
    Plus,
    AlertCircle,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { createChannel } from '@funspot/core';
import { colors } from '@/theme';

// ── Palette accents not in the design tokens ─────────────────────
const ADMIN_ACCENT = '#F59E0B';
const MEMBER_ACCENT = '#10B981';
const DANGER = '#EF4444';

// ── Local fetchers ───────────────────────────────────────────────
// getAllProfiles / getAllChannels are not exported by @funspot/core,
// so these call the raw endpoints directly. Same URLs the Flutter
// CreateChannelModal hits — GET /api/profile/profiles and
// GET /api/channels/all.
const API_BASE = 'https://clash-api-m5mr.onrender.com/api';

function authHeaders(authToken?: string | null): HeadersInit {
    return {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };
}

async function fetchAllProfiles(authToken?: string | null): Promise<any[]> {
    try {
        const res = await fetch(`${API_BASE}/profile/profiles`, {
            headers: authHeaders(authToken),
        });
        if (!res.ok) return [];
        const body: unknown = await res.json();
        return Array.isArray(body) ? body : [];
    } catch (e) {
        console.warn('fetchAllProfiles failed:', e);
        return [];
    }
}

async function fetchAllChannels(authToken?: string | null): Promise<any[]> {
    try {
        const res = await fetch(`${API_BASE}/channels/all`, {
            headers: authHeaders(authToken),
        });
        if (!res.ok) return [];
        const body: unknown = await res.json();
        if (Array.isArray(body)) return body;
        const asObj = body as { channels?: unknown } | null;
        if (asObj && Array.isArray(asObj.channels)) {
            return asObj.channels as any[];
        }
        return [];
    } catch (e) {
        console.warn('fetchAllChannels failed:', e);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface ChannelMembership {
    channelId: string;
    channelName: string;
    role: 'admin' | 'member';
    joinedAt: string | null;
    seasonPoints: number;
    correctVotes: number;
    totalVotes: number;
    msgCount: number;
    lastActiveAt: string | null;
    likesCount: number;
}

interface UserProfile {
    id: string;
    userId: string;
    username: string;
    nickname: string;
    clubFan: string;
    countryFan: string;
    phone: string;
    balance: number;
    numberOfBets: number;
    channelHistory: ChannelMembership[];
}

// ── JSON parsers ─────────────────────────────────────────────────
function membershipFromJson(
    json: any,
    channelId: string,
    channelName: string,
): ChannelMembership {
    return {
        channelId,
        channelName,
        role: (json?.role?.toString() ?? 'member') as 'admin' | 'member',
        joinedAt: json?.joined_at?.toString() ?? null,
        seasonPoints: Number(json?.season_points ?? 0),
        correctVotes: Number(json?.correct_votes ?? 0),
        totalVotes: Number(json?.total_votes ?? 0),
        msgCount: Number(json?.msg_count ?? 0),
        lastActiveAt: json?.last_active_at?.toString() ?? null,
        likesCount: Number(json?.likes_count ?? 0),
    };
}

function userProfileFromJson(json: any): UserProfile {
    return {
        id: json?._id?.toString() ?? json?.id?.toString() ?? '',
        userId: json?.user_id?.toString() ?? '',
        username: json?.username?.toString() ?? '',
        nickname:
            json?.nickname?.toString() ??
            json?.username?.toString() ??
            'User',
        clubFan: json?.club_fan?.toString() ?? 'Football Fan',
        countryFan: json?.country_fan?.toString() ?? 'World',
        phone: json?.phone?.toString() ?? '',
        balance: Number(json?.balance ?? 0),
        numberOfBets: Number(json?.number_of_bets ?? 0),
        channelHistory: [],
    };
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CreateChannelModal({
    visible,
    onClose,
    onChannelCreated,
}: {
    visible: boolean;
    onClose: () => void;
    onChannelCreated: () => void;
}) {
    const { userId, username, authToken } = useAuth();
    const toast = useToast();

    const [channelName, setChannelName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

    // ── Reset on open ────────────────────────────────────────────
    useEffect(() => {
        if (!visible) return;
        setChannelName('');
        setSearchQuery('');
        setSelectedMembers([]);
        setShowOnlyAvailable(false);
    }, [visible]);

    // ── Load users + channel history ─────────────────────────────
    const loadUsers = useCallback(async () => {
        if (!visible || !userId) return;
        setLoading(true);

        try {
            const [profiles, channels] = await Promise.all([
                fetchAllProfiles(authToken),
                fetchAllChannels(authToken),
            ]);

            const users = (Array.isArray(profiles) ? profiles : [])
                .map((p: any) => userProfileFromJson(p))
                .filter((u: UserProfile) => u.userId && u.userId !== userId);

            // Build userId → memberships map from every channel's members[]
            // Build userId → memberships map from every channel's members[].
            // fetchAllChannels already normalizes { channels: [...] } to a
            // bare array, so `channels` is always an array here.
            const historyByUserId: Record<string, ChannelMembership[]> = {};
            const channelList = channels;

            for (const rawChannel of channelList) {
                if (!rawChannel || typeof rawChannel !== 'object') continue;
                const channelId =
                    rawChannel.channel_id?.toString() ??
                    rawChannel._id?.toString() ??
                    '';
                const channelName =
                    rawChannel.name?.toString() ?? 'Channel';
                const members = Array.isArray(rawChannel.members)
                    ? rawChannel.members
                    : [];

                for (const rawMember of members) {
                    if (!rawMember || typeof rawMember !== 'object') continue;
                    const memberUserId = rawMember.user_id?.toString() ?? '';
                    if (!memberUserId) continue;
                    if (!historyByUserId[memberUserId]) {
                        historyByUserId[memberUserId] = [];
                    }
                    historyByUserId[memberUserId].push(
                        membershipFromJson(rawMember, channelId, channelName),
                    );
                }
            }

            // Attach history to each user
            for (const u of users) {
                u.channelHistory = historyByUserId[u.userId] ?? [];
            }

            setAllUsers(users);
        } catch (e: any) {
            toast.showError(
                `Error loading users: ${e?.message ?? String(e)}`,
            );
        } finally {
            setLoading(false);
        }
    }, [visible, userId, authToken, toast]);

    useEffect(() => {
        if (!visible) return;
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, userId]);

    // ── Filter ───────────────────────────────────────────────────
    const filteredUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const selectedIds = new Set(selectedMembers.map((m) => m.userId));

        return allUsers.filter((u) => {
            const matchesSearch =
                q.length === 0 ||
                u.nickname.toLowerCase().includes(q) ||
                u.username.toLowerCase().includes(q) ||
                u.clubFan.toLowerCase().includes(q) ||
                u.countryFan.toLowerCase().includes(q);

            const isAvailable = !selectedIds.has(u.userId);

            return matchesSearch && (showOnlyAvailable ? isAvailable : true);
        });
    }, [allUsers, searchQuery, selectedMembers, showOnlyAvailable]);

    // ── Selection ────────────────────────────────────────────────
    function toggleMember(user: UserProfile) {
        setSelectedMembers((prev) => {
            const exists = prev.some((m) => m.userId === user.userId);
            return exists
                ? prev.filter((m) => m.userId !== user.userId)
                : [...prev, user];
        });
    }

    // ── Create ───────────────────────────────────────────────────
    async function handleCreate() {
        const name = channelName.trim();
        if (!name) {
            toast.showError('Please enter a channel name');
            return;
        }
        if (selectedMembers.length === 0) {
            toast.showError('Please select at least one member');
            return;
        }
        if (!authToken) {
            toast.showError('You must be logged in to create a channel');
            return;
        }

        setCreating(true);
        try {
            // CreateChannelParams.members expects { id, username } — camelCase
            // `id`, not `user_id`. The service passes this array through to
            // the POST body verbatim, so whatever shape we pass is what the
            // server receives.
            const members = selectedMembers.map((u) => ({
                id: u.userId,
                username: u.username,
            }));

            const result = await createChannel({
                name,
                createdBy: userId ?? '',
                createdByUsername: username ?? '',
                season: '2024',
                members,
                authToken,
            });

            if (result.success) {
                // The raw server response is passed through as `result.data`,
                // and the backend's invite field is snake_case.
                const inviteCode = result.data?.invite_code;
                const invite = inviteCode ? ` Invite: ${inviteCode}` : '';
                toast.showSuccess(`✅ Channel created!${invite}`);
                onChannelCreated();
                onClose();
            } else {
                toast.showError(result.message ?? 'Failed to create channel');
            }
        } catch (e: any) {
            toast.showError(`Error: ${e?.message ?? String(e)}`);
        } finally {
            setCreating(false);
        }
    }

    // ─────────────────────────────────────────────────────────────

    const canCreate =
        channelName.trim().length > 0 && selectedMembers.length > 0;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.handleWrap}>
                        <View style={styles.handle} />
                    </View>

                    {/* Header */}
                    <View style={styles.headerRow}>
                        <View style={styles.headerIcon}>
                            <UserPlus size={20} color={MEMBER_ACCENT} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.headerTitle}>Create Channel</Text>
                            <Text style={styles.headerSub}>Add members to your group</Text>
                        </View>
                        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                            <X size={16} color={colors.textMuted} />
                        </Pressable>
                    </View>

                    {/* Channel name */}
                    <View style={styles.inputWrap}>
                        <Users size={16} color={colors.textMuted} />
                        <TextInput
                            value={channelName}
                            onChangeText={setChannelName}
                            placeholder="Enter channel name…"
                            placeholderTextColor={colors.textMuted}
                            style={styles.input}
                            editable={!creating}
                        />
                    </View>

                    {/* Member count + available toggle */}
                    <View style={styles.subHeaderRow}>
                        <Text style={styles.subHeaderText}>
                            Add Members ({selectedMembers.length})
                        </Text>
                        <Pressable
                            onPress={() => setShowOnlyAvailable((v) => !v)}
                            style={[
                                styles.availableToggle,
                                showOnlyAvailable && styles.availableToggleActive,
                            ]}
                        >
                            {showOnlyAvailable ? (
                                <Eye size={14} color={MEMBER_ACCENT} />
                            ) : (
                                <EyeOff size={14} color={colors.textMuted} />
                            )}
                            <Text
                                style={[
                                    styles.availableToggleText,
                                    {
                                        color: showOnlyAvailable
                                            ? MEMBER_ACCENT
                                            : colors.textMuted,
                                    },
                                ]}
                            >
                                {showOnlyAvailable ? 'Available' : 'All'}
                            </Text>
                        </Pressable>
                    </View>

                    {/* Search */}
                    <View style={styles.inputWrap}>
                        <Search size={16} color={colors.textMuted} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search by name, club, or country…"
                            placeholderTextColor={colors.textMuted}
                            style={styles.input}
                            editable={!creating}
                        />
                    </View>

                    {/* User list */}
                    <View style={styles.listWrap}>
                        {loading ? (
                            <View style={styles.center}>
                                <ActivityIndicator color={MEMBER_ACCENT} />
                                <Text style={styles.centerText}>Loading users…</Text>
                            </View>
                        ) : filteredUsers.length === 0 ? (
                            <View style={styles.center}>
                                <AlertCircle size={32} color={colors.textMuted} />
                                <Text style={styles.centerTitle}>
                                    {searchQuery
                                        ? 'No matching users found'
                                        : 'No users available'}
                                </Text>
                                <Text style={styles.centerText}>
                                    {searchQuery
                                        ? 'Try a different search term'
                                        : 'Check back later'}
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredUsers}
                                keyExtractor={(u) => u.userId}
                                contentContainerStyle={styles.listContent}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <UserTile
                                        user={item}
                                        isSelected={selectedMembers.some(
                                            (m) => m.userId === item.userId,
                                        )}
                                        onToggle={() => toggleMember(item)}
                                    />
                                )}
                            />
                        )}
                    </View>

                    {/* Selected members chips */}
                    {selectedMembers.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chipsRow}
                            style={styles.chipsScroll}
                        >
                            {selectedMembers.map((u) => (
                                <View key={u.userId} style={styles.chip}>
                                    <Text style={styles.chipText} numberOfLines={1}>
                                        {u.nickname}
                                    </Text>
                                    <Pressable
                                        onPress={() => toggleMember(u)}
                                        hitSlop={4}
                                        style={styles.chipClose}
                                    >
                                        <X size={12} color={colors.textMuted} />
                                    </Pressable>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {/* Action buttons */}
                    <View style={styles.actionsRow}>
                        <Pressable
                            onPress={onClose}
                            disabled={creating}
                            style={[styles.actionBtn, styles.cancelBtn]}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleCreate}
                            disabled={creating || !canCreate}
                            style={[
                                styles.actionBtn,
                                styles.createBtn,
                                !canCreate && { backgroundColor: colors.textMuted },
                            ]}
                        >
                            {creating ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.createBtnText}>
                                    {selectedMembers.length === 0
                                        ? 'Select Members'
                                        : `Create Channel (${selectedMembers.length})`}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════
//  USER TILE
// ═══════════════════════════════════════════════════════════════

function UserTile({
    user,
    isSelected,
    onToggle,
}: {
    user: UserProfile;
    isSelected: boolean;
    onToggle: () => void;
}) {
    const history = user.channelHistory;
    const isAnyAdmin = history.some((m) => m.role === 'admin');
    const totalPoints = history.reduce((s, m) => s + m.seasonPoints, 0);
    const totalVotes = history.reduce((s, m) => s + m.totalVotes, 0);
    const totalCorrect = history.reduce((s, m) => s + m.correctVotes, 0);
    const accuracy = totalVotes > 0 ? (totalCorrect / totalVotes) * 100 : 0;
    const accent = isAnyAdmin ? ADMIN_ACCENT : MEMBER_ACCENT;

    const statusLabel =
        history.length === 0
            ? 'NEW'
            : isAnyAdmin
                ? 'ADMIN ELSEWHERE'
                : 'MEMBER ELSEWHERE';
    const statusBg =
        history.length === 0 ? withAlpha(colors.textMuted, 0.6) : accent;

    return (
        <Pressable
            onPress={onToggle}
            style={[
                styles.userTile,
                isSelected
                    ? {
                        backgroundColor: withAlpha(MEMBER_ACCENT, 0.08),
                        borderColor: withAlpha(MEMBER_ACCENT, 0.3),
                    }
                    : {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                    },
            ]}
        >
            {/* Header: avatar + name + toggle */}
            <View style={styles.userHeader}>
                <View
                    style={[
                        styles.avatar,
                        {
                            borderColor: isSelected ? MEMBER_ACCENT : colors.border,
                        },
                    ]}
                >
                    <Text style={[styles.avatarText, { color: MEMBER_ACCENT }]}>
                        {(user.nickname?.[0] ?? '?').toUpperCase()}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.userName} numberOfLines={1}>
                        {user.nickname}
                    </Text>
                    <Text style={styles.userHandle} numberOfLines={1}>
                        @{user.username}
                    </Text>
                </View>
                <View
                    style={[
                        styles.toggleBtn,
                        isSelected
                            ? { backgroundColor: MEMBER_ACCENT, borderColor: MEMBER_ACCENT }
                            : {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                            },
                    ]}
                >
                    {isSelected ? (
                        <Check size={14} color="#FFFFFF" />
                    ) : (
                        <Plus size={14} color={colors.textMuted} />
                    )}
                </View>
            </View>

            {/* Stat rows */}
            <View style={styles.statGrid}>
                <StatRow
                    label="Club"
                    value={user.clubFan}
                    valueStyle={styles.statValue}
                />
                <StatRow
                    label="Country"
                    value={user.countryFan}
                    valueStyle={styles.statValue}
                />
                {history.length > 0 && (
                    <>
                        <StatRow
                            label="Channels"
                            value={`${history.length}`}
                            valueStyle={styles.statValue}
                        />
                        <StatRow
                            label="Points"
                            value={`${totalPoints}`}
                            valueStyle={[styles.statValue, { color: MEMBER_ACCENT }]}
                        />
                    </>
                )}
            </View>

            {/* Bottom: status pill + accuracy bar */}
            <View style={styles.tileFooter}>
                <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                    <Text style={styles.statusPillText}>{statusLabel}</Text>
                </View>
                {history.length > 0 && (
                    <View style={styles.accuracyTrack}>
                        <View
                            style={[
                                styles.accuracyFill,
                                {
                                    width: `${Math.max(0, Math.min(100, accuracy))}%`,
                                    backgroundColor: accent,
                                },
                            ]}
                        />
                    </View>
                )}
            </View>
        </Pressable>
    );
}

function StatRow({
    label,
    value,
    valueStyle,
}: {
    label: string;
    value: string;
    valueStyle?: any;
}) {
    return (
        <View style={styles.statRow}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={valueStyle ?? styles.statValue} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function withAlpha(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    if (c.length !== 6) return hex;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        maxHeight: '92%',
        minHeight: '85%',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        backgroundColor: colors.bg,
        overflow: 'hidden',
    },
    handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },

    // Header
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(MEMBER_ACCENT, 0.12),
        borderWidth: 1,
        borderColor: withAlpha(MEMBER_ACCENT, 0.3),
    },
    headerTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
    headerSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: colors.border,
    },

    // Input
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 20,
        marginVertical: 6,
        paddingHorizontal: 14,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    input: {
        flex: 1,
        color: 'white',
        fontSize: 13,
        paddingVertical: 8,
    },

    // Sub-header (member count + available toggle)
    subHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    subHeaderText: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: '600',
    },
    availableToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 'auto',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: 'transparent',
    },
    availableToggleActive: {
        backgroundColor: withAlpha(MEMBER_ACCENT, 0.12),
        borderColor: withAlpha(MEMBER_ACCENT, 0.35),
    },
    availableToggleText: {
        fontSize: 10,
        fontWeight: '600',
    },

    // List
    listWrap: { flex: 1, minHeight: 200 },
    listContent: { paddingHorizontal: 16, paddingBottom: 8 },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 8,
    },
    centerTitle: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
    },
    centerText: {
        color: colors.textMuted,
        fontSize: 12,
        textAlign: 'center',
    },

    // User tile
    userTile: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginBottom: 8,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(MEMBER_ACCENT, 0.1),
        borderWidth: 1,
    },
    avatarText: { fontSize: 16, fontWeight: '700' },
    userName: { color: 'white', fontSize: 13, fontWeight: '600' },
    userHandle: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
    toggleBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },

    // Stat grid
    statGrid: { marginTop: 8 },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2,
    },
    statLabel: { color: colors.textMuted, fontSize: 9 },
    statValue: { color: 'white', fontSize: 10 },

    // Footer
    tileFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    statusPillText: {
        color: 'white',
        fontSize: 7,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    accuracyTrack: {
        flex: 1,
        height: 4,
        borderRadius: 3,
        backgroundColor: colors.border,
        overflow: 'hidden',
    },
    accuracyFill: { height: 4, borderRadius: 3 },

    // Selected chips
    chipsScroll: { maxHeight: 40 },
    chipsRow: {
        paddingHorizontal: 20,
        paddingVertical: 6,
        gap: 6,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: withAlpha(MEMBER_ACCENT, 0.1),
        borderWidth: 0.5,
        borderColor: withAlpha(MEMBER_ACCENT, 0.35),
        maxWidth: 180,
    },
    chipText: { color: 'white', fontSize: 11 },
    chipClose: {
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Action buttons
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    actionBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelBtnText: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: '600',
    },
    createBtn: {
        backgroundColor: MEMBER_ACCENT,
    },
    createBtnText: {
        color: '#000',
        fontSize: 13,
        fontWeight: '700',
    },
});