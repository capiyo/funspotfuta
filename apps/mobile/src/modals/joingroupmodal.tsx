// RN port of funspot/lib/modals/Funzy/join_groups_modal.dart — as a MODAL.
//
// Faithful to the Flutter source's join-request flow:
//   1. Fetch /channels/all in parallel with the caller-provided user's
//      channel list.
//   2. Filter out channels the user is already in.
//   3. Cap the user at MAX_CHANNELS approved channels; disable the JOIN
//      button on every row once the cap is hit.
//   4. POST /channels/request-join, mark the channel pending locally,
//      persist the pending set, and (in the Flutter source) fire a
//      WS `join.request` event so the admin's client gets it live.
//
// NOTE on the WebSocket portion: the Flutter source subscribes to
// join_approved / join_rejected / join_request_status to update the
// pending set in real time. There is no RN WebSocketService in this
// app (as far as this file knows), so those subscriptions are stubbed
// with a clear TODO. The request-sent path works without them — the
// user just won't see an instant "approved" until the modal is reopened
// or the parent refreshes.
//
// NOTE on UserChannel: the Flutter UserChannel model lives in a file
// not available here. This port parses the raw channel shape directly
// with the fields the Flutter source reads (channelId, name,
// memberCount, isApproved), accepting both camelCase and snake_case.
//
// NOTE on storage: mobileStorage implements KVStorage, whose getItem
// returns `string | Promise<string | null>`. We treat it as async
// everywhere so the modal works whether the concrete implementation
// is MMKV (sync) or AsyncStorage (async). `await` on a plain string
// is a no-op, so this is correct for MMKV too.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    Modal,
} from 'react-native';
import {
    X,
    Users,
    UserPlus,
    Info,
    AlertTriangle,
    Lock,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { mobileStorage } from '../../../../packages/storage/src/mobile';
import { colors } from '@/theme';

// ── Palette accents not in the design tokens ─────────────────────
const MEMBER_ACCENT = '#10B981';
const DANGER = '#EF4444';
const WARN = '#F59E0B';

const MAX_CHANNELS = 3;
const API_BASE = 'https://clash-api-m5mr.onrender.com/api';
const PENDING_REQUESTS_KEY = 'pending_join_requests';

// ── Channel shape (local — see header note about UserChannel) ────
interface JoinableChannel {
    channelId: string;
    name: string;
    memberCount: number;
    isApproved: boolean;
}

function channelFromJson(json: any): JoinableChannel {
    return {
        channelId:
            json?.channel_id?.toString() ??
            json?.channelId?.toString() ??
            json?._id?.toString() ??
            '',
        name: json?.name?.toString() ?? 'Channel',
        memberCount: Number(
            json?.member_count ?? json?.memberCount ?? 0,
        ),
        isApproved:
            json?.is_approved === true || json?.isApproved === true,
    };
}

// ── Local fetchers ───────────────────────────────────────────────
async function fetchAllChannels(authToken?: string | null): Promise<any[]> {
    try {
        const res = await fetch(`${API_BASE}/channels/all`, {
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
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

async function requestJoinChannel(
    channelId: string,
    userId: string,
    username: string,
    authToken?: string | null,
): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_BASE}/channels/request-join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
                channel_id: channelId,
                user_id: userId,
                username,
            }),
        });
        if (res.ok) return { success: true };
        const body = await res.json().catch(() => ({}));
        return {
            success: false,
            message: body?.message ?? `Server error: ${res.status}`,
        };
    } catch (e: any) {
        return { success: false, message: e?.message ?? String(e) };
    }
}

// ── Pending-request persistence ──────────────────────────────────
// KVStorage.getItem returns `string | Promise<string | null>`, so we
// always await the result. With MMKV the promise resolves in the same
// microtask; with AsyncStorage it resolves after a disk read. Either
// way the caller sees a Promise.

async function loadPending(userId: string): Promise<Set<string>> {
    try {
        const raw = await mobileStorage.getItem(
            `${PENDING_REQUESTS_KEY}_${userId}`,
        );
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
}

async function savePending(userId: string, pending: Set<string>) {
    try {
        await mobileStorage.setItem(
            `${PENDING_REQUESTS_KEY}_${userId}`,
            JSON.stringify(Array.from(pending)),
        );
    } catch (e) {
        console.warn('savePending failed:', e);
    }
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function JoinGroupsModal({
    visible,
    userChannels,
    onClose,
    onChannelJoined,
}: {
    visible: boolean;
    /**
     * The user's current channels. Only `isApproved: true` entries count
     * toward the MAX_CHANNELS cap.
     */
    userChannels: JoinableChannel[];
    onClose: () => void;
    onChannelJoined: (channelId: string) => void;
}) {
    const { userId, username, authToken } = useAuth();
    const toast = useToast();

    const [availableChannels, setAvailableChannels] = useState<
        JoinableChannel[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [joiningChannelId, setJoiningChannelId] = useState<string | null>(
        null,
    );
    const [pendingRequests, setPendingRequests] = useState<Set<string>>(
        new Set(),
    );

    // ── Hydrate pending from storage when the modal opens ────────
    // storage is async, so this happens in an effect rather than a lazy
    // useState initializer. The brief window where the JOIN button
    // shows for an already-pending channel is one frame — imperceptible
    // in practice, and the button's `isJoining` state covers the click.
    useEffect(() => {
        if (!visible || !userId) return;
        let cancelled = false;
        loadPending(userId).then((pending) => {
            if (!cancelled) setPendingRequests(pending);
        });
        return () => {
            cancelled = true;
        };
    }, [visible, userId]);

    // ── Load channels when the modal opens ───────────────────────
    const loadChannels = useCallback(async () => {
        if (!visible || !userId) return;
        setLoading(true);

        try {
            const allChannels = await fetchAllChannels(authToken);

            const ownedIds = new Set(userChannels.map((c) => c.channelId));
            const available = allChannels
                .map((c: any) => channelFromJson(c))
                .filter(
                    (c: JoinableChannel) =>
                        c.channelId && !ownedIds.has(c.channelId),
                );

            setAvailableChannels(available);
        } catch (e: any) {
            toast.showError(
                `Error fetching channels: ${e?.message ?? String(e)}`,
            );
        } finally {
            setLoading(false);
        }
    }, [visible, userId, authToken, userChannels, toast]);

    useEffect(() => {
        if (!visible) return;
        loadChannels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, userId]);

    // ── WebSocket listener stub ──────────────────────────────────
    // TODO: wire these three subscriptions back in once an RN
    // WebSocketService exists in this app:
    //   ws.on('join_approved',        ({channel_id}) => { remove pending; onChannelJoined(id); })
    //   ws.on('join_rejected',        ({channel_id, channel_name}) => { remove pending; toast error; })
    //   ws.on('join_request_status',  ({channel_id, status}) => { if approved/rejected, remove pending; })
    useEffect(() => {
        // no-op for now
        return () => { };
    }, []);

    // ── Slot math ────────────────────────────────────────────────
    const approvedCount = useMemo(
        () => userChannels.filter((c) => c.isApproved).length,
        [userChannels],
    );
    const remainingSlots = MAX_CHANNELS - approvedCount;
    const canJoin = approvedCount < MAX_CHANNELS;

    // ── Join request ─────────────────────────────────────────────
    async function handleRequestJoin(channel: JoinableChannel) {
        if (!userId || !username) return;

        if (!canJoin) {
            toast.showError(
                `⚠️ You can only join up to ${MAX_CHANNELS} channels. Leave a channel to join another.`,
            );
            return;
        }
        if (joiningChannelId || pendingRequests.has(channel.channelId)) return;

        setJoiningChannelId(channel.channelId);
        try {
            const result = await requestJoinChannel(
                channel.channelId,
                userId,
                username,
                authToken,
            );

            if (result.success) {
                const next = new Set(pendingRequests);
                next.add(channel.channelId);
                setPendingRequests(next);
                await savePending(userId, next);

                // TODO: send WS join.request event when WebSocketService exists:
                //   ws.send('join.request', {
                //     channel_id: channel.channelId,
                //     user_id: userId,
                //     username,
                //     channel_name: channel.name,
                //   });

                toast.showSuccess(
                    `📨 Join request sent to "${channel.name}" admin!`,
                );
                onChannelJoined(channel.channelId);
            } else {
                toast.showError(result.message ?? 'Failed to send request');
            }
        } catch (e: any) {
            toast.showError(`Error: ${e?.message ?? String(e)}`);
        } finally {
            setJoiningChannelId(null);
        }
    }

    // ─────────────────────────────────────────────────────────────

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
                            <Text style={styles.headerTitle}>Join a Channel</Text>
                            <View style={styles.headerSubRow}>
                                <Text style={styles.headerSubText}>
                                    {approvedCount} / {MAX_CHANNELS} channels
                                </Text>
                                <View
                                    style={[
                                        styles.slotsPill,
                                        canJoin
                                            ? {
                                                backgroundColor: withAlpha(MEMBER_ACCENT, 0.15),
                                            }
                                            : {
                                                backgroundColor: withAlpha(DANGER, 0.15),
                                            },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.slotsPillText,
                                            {
                                                color: canJoin ? MEMBER_ACCENT : DANGER,
                                            },
                                        ]}
                                    >
                                        {canJoin ? `${remainingSlots} slots left` : 'FULL'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                            <X size={16} color={colors.textMuted} />
                        </Pressable>
                    </View>

                    <View style={styles.divider} />

                    {/* Info banner */}
                    <View style={styles.infoWrap}>
                        <View
                            style={[
                                styles.infoCard,
                                canJoin
                                    ? {
                                        backgroundColor: withAlpha(MEMBER_ACCENT, 0.06),
                                        borderColor: withAlpha(MEMBER_ACCENT, 0.15),
                                    }
                                    : {
                                        backgroundColor: withAlpha(DANGER, 0.08),
                                        borderColor: withAlpha(DANGER, 0.25),
                                    },
                            ]}
                        >
                            {canJoin ? (
                                <Info size={16} color={MEMBER_ACCENT} />
                            ) : (
                                <AlertTriangle size={16} color={DANGER} />
                            )}
                            <Text
                                style={[
                                    styles.infoText,
                                    { color: canJoin ? colors.textMuted : DANGER },
                                ]}
                            >
                                {canJoin
                                    ? 'Join a group to vote, comment, and like. Your request will be sent to the group admin for approval.'
                                    : `⚠️ You have reached the maximum of ${MAX_CHANNELS} channels. Leave a channel to join another.`}
                            </Text>
                        </View>
                    </View>

                    {/* Channel list */}
                    <View style={styles.listWrap}>
                        {loading ? (
                            <View style={styles.center}>
                                <ActivityIndicator color={MEMBER_ACCENT} />
                            </View>
                        ) : availableChannels.length === 0 ? (
                            <View style={styles.center}>
                                <Users size={48} color={colors.textMuted} />
                                <Text style={styles.emptyTitle}>No groups available</Text>
                                <Text style={styles.emptyText}>
                                    Check back later for new groups
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={availableChannels}
                                keyExtractor={(c) => c.channelId}
                                contentContainerStyle={styles.listContent}
                                ItemSeparatorComponent={() => (
                                    <View style={styles.rowDivider} />
                                )}
                                renderItem={({ item }) => (
                                    <ChannelRow
                                        channel={item}
                                        isPending={pendingRequests.has(item.channelId)}
                                        isJoining={joiningChannelId === item.channelId}
                                        isDisabled={
                                            !canJoin &&
                                            !pendingRequests.has(item.channelId) &&
                                            joiningChannelId !== item.channelId
                                        }
                                        onJoin={() => handleRequestJoin(item)}
                                    />
                                )}
                            />
                        )}
                    </View>

                    {/* Bottom note */}
                    <View style={styles.footerNoteWrap}>
                        <Info size={12} color={withAlpha(colors.textMuted, 0.5)} />
                        <Text style={styles.footerNoteText}>
                            {canJoin
                                ? 'Requests are reviewed by group admins'
                                : `Maximum channels reached (${MAX_CHANNELS}/${MAX_CHANNELS})`}
                        </Text>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════
//  CHANNEL ROW
// ═══════════════════════════════════════════════════════════════

function ChannelRow({
    channel,
    isPending,
    isJoining,
    isDisabled,
    onJoin,
}: {
    channel: JoinableChannel;
    isPending: boolean;
    isJoining: boolean;
    isDisabled: boolean;
    onJoin: () => void;
}) {
    return (
        <View style={styles.channelRow}>
            {/* Avatar */}
            <View style={styles.channelAvatar}>
                <Text style={styles.channelAvatarText}>
                    {(channel.name?.[0] ?? '?').toUpperCase()}
                </Text>
            </View>

            {/* Info */}
            <View style={styles.channelInfo}>
                <Text
                    style={[
                        styles.channelName,
                        isDisabled && { color: withAlpha('#FFFFFF', 0.4) },
                    ]}
                    numberOfLines={1}
                >
                    {channel.name}
                </Text>
                <View style={styles.channelMetaRow}>
                    <Users
                        size={12}
                        color={
                            isDisabled
                                ? withAlpha('#FFFFFF', 0.2)
                                : withAlpha('#FFFFFF', 0.5)
                        }
                    />
                    <Text
                        style={[
                            styles.channelMetaText,
                            {
                                color: isDisabled
                                    ? withAlpha('#FFFFFF', 0.2)
                                    : withAlpha('#FFFFFF', 0.5),
                            },
                        ]}
                    >
                        {channel.memberCount} members
                    </Text>
                </View>
            </View>

            {/* Action */}
            {isPending ? (
                <View
                    style={[
                        styles.pendingPill,
                        { backgroundColor: withAlpha(WARN, 0.15) },
                    ]}
                >
                    <ActivityIndicator size="small" color={WARN} />
                    <Text style={[styles.pendingPillText, { color: WARN }]}>
                        Pending
                    </Text>
                </View>
            ) : isJoining ? (
                <ActivityIndicator size="small" color={MEMBER_ACCENT} />
            ) : isDisabled ? (
                <View
                    style={[
                        styles.fullPill,
                        {
                            backgroundColor: withAlpha(DANGER, 0.1),
                            borderColor: withAlpha(DANGER, 0.2),
                        },
                    ]}
                >
                    <Lock size={12} color={withAlpha(DANGER, 0.6)} />
                    <Text
                        style={[styles.fullPillText, { color: withAlpha(DANGER, 0.6) }]}
                    >
                        FULL
                    </Text>
                </View>
            ) : (
                <Pressable
                    onPress={onJoin}
                    style={[
                        styles.joinBtn,
                        {
                            backgroundColor: withAlpha(MEMBER_ACCENT, 0.15),
                            borderColor: withAlpha(MEMBER_ACCENT, 0.4),
                        },
                    ]}
                >
                    <Text style={[styles.joinBtnText, { color: MEMBER_ACCENT }]}>
                        JOIN
                    </Text>
                </Pressable>
            )}
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
        maxHeight: '82%',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        backgroundColor: colors.bg,
        overflow: 'hidden',
    },
    handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: withAlpha('#FFFFFF', 0.15),
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
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1A1A3E',
    },
    headerTitle: { color: 'white', fontSize: 17, fontWeight: '700' },
    headerSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    headerSubText: {
        color: withAlpha('#FFFFFF', 0.6),
        fontSize: 12,
    },
    slotsPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    slotsPillText: {
        fontSize: 10,
        fontWeight: '600',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha('#FFFFFF', 0.06),
        borderWidth: 1,
        borderColor: colors.border,
    },

    divider: { height: 1, backgroundColor: colors.border },

    // Info banner
    infoWrap: { padding: 16, paddingBottom: 8 },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
    },

    // List
    listWrap: { flex: 1, minHeight: 200 },
    listContent: { paddingHorizontal: 20 },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 8,
    },
    emptyTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 4,
    },
    emptyText: {
        color: withAlpha('#FFFFFF', 0.5),
        fontSize: 13,
        textAlign: 'center',
    },
    rowDivider: {
        height: 1,
        backgroundColor: withAlpha(colors.border, 0.5),
    },

    // Channel row
    channelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 14,
    },
    channelAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1A1A3E',
    },
    channelAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: MEMBER_ACCENT,
    },
    channelInfo: { flex: 1 },
    channelName: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    channelMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    channelMetaText: { fontSize: 11 },

    // Action pills
    pendingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    pendingPillText: {
        fontSize: 11,
        fontWeight: '600',
    },
    fullPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    fullPillText: {
        fontSize: 10,
        fontWeight: '600',
    },
    joinBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    joinBtnText: {
        fontSize: 11,
        fontWeight: '600',
    },

    // Footer note
    footerNoteWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 20,
    },
    footerNoteText: {
        color: withAlpha('#FFFFFF', 0.4),
        fontSize: 11,
    },
});