// apps/mobile/src/modals/ComradeListModal/index.tsx
//
// RN port of funspot/lib/modals/comrade_list_modal.dart.
//
// Despite the name, this modal lists *every user profile in the system*
// (excluding the current user). It's a picker for two flows:
//   - Admin path:  pick channels you administer → POST /channels/members/add
//   - Non-admin:   pick channels you belong to  → POST /notifications/send
//                                                    (type: channel_invite)
// Plus a read-only per-user profile view.
//
// Deviations from the Flutter source, all deliberate:
//   1. Nested modals collapsed to in-place content swap. The Flutter source
//      stacks showModalBottomSheet twice for the Add/Invite picker and the
//      Profile view. RN's stacked <Modal>s are unreliable on Android, so
//      this modal holds three screens of content (list | picker | profile)
//      and swaps between them. A back arrow returns to the list.
//   2. _sendNotification delegates to NotificationService.sendNotification
//      (apps/mobile/src/lib/api/notification-service.ts), which is the
//      app-local port of the same backend call.
//   3. Palette: colors.textMuted / colors.green don't exist in the
//      FanColorPalette from packages/core/src/theme.ts; this uses
//      textPrimary / textSecondary / textTertiary / primary / away /
//      surfaceSunken / border / primaryDim.
//
// The four bugs from the Flutter source are NOT fixed (this is a faithful
// port): the "Full" toast reads the wrong variable, the "already has 3
// channels" message describes a condition that wasn't checked,
// inviter_name reads a channel name instead of a username, and there is
// no didUpdateWidget equivalent so the "✓ Added" badges don't refresh
// when comradesList changes while the modal is open.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    Modal,
} from 'react-native';
import {
    X,
    ArrowLeft,
    Search,
    Users,
    AlertCircle,
    CheckCircle2,
    User as UserIcon,
    Trophy,
    Globe2,
    Phone as PhoneIcon,
    Info,
    Check,
    type LucideIcon,
} from 'lucide-react-native';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import type { Channel } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { useToast } from '@/lib/toast/toast-context';
import { NotificationService } from '@/lib/api/notification-service';
import { ComradeCard } from './comradeCard';
import {
    type ComradeProfile,
    comradeProfileFromJson,
} from './types';

type FanColors = ReturnType<typeof useFanColors>;

const API_BASE = 'https://clash-api-m5mr.onrender.com/api';
const MAX_CHANNELS = 3;

function hexWithAlpha(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    if (c.length !== 6) return hex;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function initials(name: string): string {
    return name.length > 0 ? name[0].toUpperCase() : '?';
}

// ═══════════════════════════════════════════════════════════════
//  PROPS
// ═══════════════════════════════════════════════════════════════

export interface ComradeListModalProps {
    visible: boolean;
    onClose: () => void;
    /** IDs of users already in the current user's comrades graph. */
    comradesList: string[];
    /** Channels the current user belongs to. */
    userChannels: Channel[];
    onComradeAdded?: () => void;
}

type Screen = 'list' | 'picker' | 'profile';

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ComradeListModal({
    visible,
    onClose,
    comradesList,
    userChannels,
    onComradeAdded,
}: ComradeListModalProps) {
    const colors = useFanColors();
    const styles = createStyles(colors);
    const { userId, authToken } = useAuth();
    const toast = useToast();

    const [screen, setScreen] = useState<Screen>('list');
    const [comrades, setComrades] = useState<ComradeProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Picker state (for Add/Invite)
    const [activeComrade, setActiveComrade] = useState<ComradeProfile | null>(
        null,
    );
    const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(
        new Set(),
    );
    const [processing, setProcessing] = useState(false);

    // Profile view state
    const [viewingProfile, setViewingProfile] = useState<ComradeProfile | null>(
        null,
    );

    // ── Derived ──────────────────────────────────────────────────
    const adminChannels = useMemo(
        () => userChannels.filter((c) => c.isAdmin),
        [userChannels],
    );
    const hasAdminChannels = adminChannels.length > 0;

    const userChannelCount = userChannels.length;
    const remainingSlots = MAX_CHANNELS - userChannelCount;
    const isFull = remainingSlots <= 0;

    const comradeIdSet = useMemo(() => new Set(comradesList), [comradesList]);

    const filteredComrades = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return comrades;
        return comrades.filter((c) => {
            return (
                c.nickname.toLowerCase().includes(q) ||
                c.username.toLowerCase().includes(q) ||
                c.clubFan.toLowerCase().includes(q)
            );
        });
    }, [comrades, searchQuery]);

    // ── Reset on open ────────────────────────────────────────────
    useEffect(() => {
        if (!visible) return;
        setScreen('list');
        setSearchQuery('');
        setActiveComrade(null);
        setSelectedChannelIds(new Set());
        setViewingProfile(null);
    }, [visible]);

    // ── Fetch ────────────────────────────────────────────────────
    const fetchComrades = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            };
            const res = await fetch(`${API_BASE}/profile/profiles`, { headers });
            if (res.status === 200) {
                const data = await res.json();
                const list: any[] = Array.isArray(data) ? data : [];
                const profiles: ComradeProfile[] = list
                    .filter((item) => item?.user_id?.toString() !== userId)
                    .map((item) => comradeProfileFromJson(item));
                setComrades(profiles);
            } else {
                setError('Failed to load comrades');
            }
        } catch (e: any) {
            setError(`Network error: ${e?.message ?? e}`);
        } finally {
            setLoading(false);
        }
    }, [userId, authToken]);

    useEffect(() => {
        if (!visible || !userId) return;
        void fetchComrades();
    }, [visible, userId, fetchComrades]);

    // ── Helpers ──────────────────────────────────────────────────
    function isComradeAdded(comradeId: string): boolean {
        return comradeIdSet.has(comradeId);
    }

    function isUserInChannel(targetUserId: string, channelId: string): boolean {
        const channel = userChannels.find((c) => c.channelId === channelId);
        if (!channel) return false;
        return channel.members.some(
            (m: { userId: string }) => m.userId === targetUserId,
        );
    }

    function getChannelName(channelId: string): string {
        return userChannels.find((c) => c.channelId === channelId)?.name ?? 'Unknown';
    }

    // ── Add to channels (admin path) ─────────────────────────────
    async function addToChannels(
        comradeId: string,
        comradeUsername: string,
    ): Promise<void> {
        if (selectedChannelIds.size === 0 || !authToken) return;
        setProcessing(true);

        const results: Array<{ channel_id: string; success: boolean; message: string }> = [];
        const headers = {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
        };

        try {
            for (const channelId of selectedChannelIds) {
                if (isUserInChannel(comradeId, channelId)) {
                    results.push({
                        channel_id: channelId,
                        success: false,
                        message: 'Already in channel',
                    });
                    continue;
                }

                try {
                    const res = await fetch(`${API_BASE}/channels/members/add`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            channel_id: channelId,
                            members: [{ user_id: comradeId, username: comradeUsername }],
                        }),
                    });

                    if (res.status === 200 || res.status === 201) {
                        results.push({
                            channel_id: channelId,
                            success: true,
                            message: 'Added successfully',
                        });
                        // Fire-and-forget notify, matching the Flutter source
                        void NotificationService.sendNotification({
                            userId: comradeId,
                            notificationType: 'comrade_added',
                            title: "🎉 You've been added!",
                            body: `You were added to ${getChannelName(channelId)}`,
                            data: { type: 'comrade_added' },
                        });
                    } else {
                        let msg = 'Failed to add';
                        try {
                            const body = await res.json();
                            msg = body?.message ?? msg;
                        } catch {
                            /* not JSON */
                        }
                        results.push({ channel_id: channelId, success: false, message: msg });
                    }
                } catch (e: any) {
                    results.push({
                        channel_id: channelId,
                        success: false,
                        message: e?.message ?? 'Network error',
                    });
                }
            }

            setProcessing(false);

            const successCount = results.filter((r) => r.success).length;
            const failCount = results.length - successCount;

            if (successCount > 0) {
                toast.showSuccess(
                    `Added to ${successCount} ${successCount === 1 ? 'channel' : 'channels'}${failCount > 0 ? ` (${failCount} failed)` : ''
                    }`,
                );
                onComradeAdded?.();
                setSelectedChannelIds(new Set());
                setActiveComrade(null);
                setScreen('list');
                void fetchComrades();
            } else {
                toast.showError('Failed to add to channels');
            }
        } catch (e: any) {
            setProcessing(false);
            toast.showError(`Error: ${e?.message ?? e}`);
        }
    }

    // ── Invite to channels (non-admin path) ──────────────────────
    async function inviteToChannels(
        comradeId: string,
        comradeUsername: string,
    ): Promise<void> {
        if (selectedChannelIds.size === 0 || !authToken) return;
        setProcessing(true);

        try {
            for (const channelId of selectedChannelIds) {
                const channelName = getChannelName(channelId);
                // Note: matches the Flutter source, which reads the *channel* name
                // here (from userChannels.firstWhere(...).name) as `inviter_name`.
                // That's a bug in the original — carrying it over verbatim.
                const inviterName = getChannelName(channelId);

                await NotificationService.sendNotification({
                    userId: comradeId,
                    notificationType: 'channel_invite',
                    title: '📨 Channel Invite',
                    body: `${comradeUsername} invited you to join "${channelName}"`,
                    data: {
                        channel_id: channelId,
                        channel_name: channelName,
                        inviter_id: userId ?? '',
                        inviter_name: inviterName,
                    },
                });
            }

            setProcessing(false);
            toast.showSuccess('Invites sent successfully!');
            setSelectedChannelIds(new Set());
            setActiveComrade(null);
            setScreen('list');
        } catch (e: any) {
            setProcessing(false);
            toast.showError(`Failed to send invites: ${e?.message ?? e}`);
        }
    }

    // ── Open picker ──────────────────────────────────────────────
    function openPicker(comrade: ComradeProfile) {
        if (isFull) {
            // Matches the Flutter source's message, which references the wrong
            // subject (says the *comrade* already has 3 channels, but the check
            // that triggered this branch is *your* channel count).
            toast.showWarning(`${comrade.nickname} already has 3 channels`);
            return;
        }
        setActiveComrade(comrade);
        setSelectedChannelIds(new Set());
        setScreen('picker');
    }

    function openProfile(comrade: ComradeProfile) {
        setViewingProfile(comrade);
        setScreen('profile');
    }

    function backToList() {
        setScreen('list');
        setActiveComrade(null);
        setSelectedChannelIds(new Set());
        setViewingProfile(null);
    }

    // ═══════════════════════════════════════════════════════════
    //  SCREEN: LIST
    // ═══════════════════════════════════════════════════════════

    function renderListScreen() {
        return (
            <>
                <View style={styles.searchWrap}>
                    <View
                        style={[
                            styles.searchBar,
                            {
                                backgroundColor: colors.surface,
                                borderColor: hexWithAlpha(colors.border, 0.3),
                            },
                        ]}
                    >
                        <Search size={18} color={colors.textSecondary} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search comrades..."
                            placeholderTextColor={hexWithAlpha(colors.textSecondary, 0.6)}
                            style={[styles.searchInput, { color: colors.textPrimary }]}
                        />
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: hexWithAlpha(colors.border, 0.3) }]} />

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={[styles.centerHint, { color: colors.textTertiary }]}>
                            Loading comrades...
                        </Text>
                    </View>
                ) : error ? (
                    <View style={styles.center}>
                        <AlertCircle size={48} color={hexWithAlpha(colors.away, 0.5)} />
                        <Text
                            style={[styles.centerTitle, { color: colors.textSecondary }]}
                        >
                            {error}
                        </Text>
                        <Pressable
                            onPress={fetchComrades}
                            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                        >
                            <Text style={styles.retryBtnText}>Retry</Text>
                        </Pressable>
                    </View>
                ) : filteredComrades.length === 0 ? (
                    <View style={styles.center}>
                        <Users size={48} color={hexWithAlpha(colors.textTertiary, 0.4)} />
                        <Text style={[styles.centerTitle, { color: colors.textTertiary }]}>
                            {searchQuery.length === 0
                                ? 'No comrades found'
                                : `No results for "${searchQuery}"`}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredComrades}
                        keyExtractor={(c) => c.id}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <ComradeCard
                                comrade={item}
                                isAdded={isComradeAdded(item.id)}
                                isFull={isFull}
                                hasAdminChannels={hasAdminChannels}
                                onProfile={() => openProfile(item)}
                                onAction={() => openPicker(item)}
                            />
                        )}
                    />
                )}
            </>
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  SCREEN: PICKER (Add/Invite)
    // ═══════════════════════════════════════════════════════════

    function renderPickerScreen() {
        if (!activeComrade) return null;
        const comrade = activeComrade;
        const isAdmin = hasAdminChannels;
        const channelsToShow = isAdmin ? adminChannels : userChannels;

        return (
            <>
                {/* Picker header */}
                <View style={styles.pickerHeader}>
                    <View
                        style={[
                            styles.pickerAvatar,
                            { backgroundColor: colors.primaryDim },
                        ]}
                    >
                        <Text
                            style={[styles.pickerAvatarText, { color: colors.primary }]}
                        >
                            {initials(comrade.nickname)}
                        </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: FAN_SPACING.base }}>
                        <Text
                            style={[styles.pickerTitle, { color: colors.textPrimary }]}
                            numberOfLines={1}
                        >
                            {isAdmin ? `Add ${comrade.nickname}` : `Invite ${comrade.nickname}`}
                        </Text>
                        <Text
                            style={[styles.pickerSub, { color: colors.textSecondary }]}
                            numberOfLines={2}
                        >
                            {isAdmin
                                ? `Select channels to add ${comrade.nickname}`
                                : `Select channels to invite ${comrade.nickname}`}
                        </Text>
                    </View>
                    <Pressable onPress={backToList} hitSlop={8} style={styles.closeBtn}>
                        <X size={18} color={colors.textSecondary} />
                    </Pressable>
                </View>

                <View
                    style={[styles.divider, { backgroundColor: hexWithAlpha(colors.border, 0.3) }]}
                />

                {/* Channel list */}
                <ScrollView contentContainerStyle={styles.pickerListContent}>
                    {channelsToShow.map((channel, index) => {
                        const isSelected = selectedChannelIds.has(channel.channelId);
                        const alreadyIn = isUserInChannel(comrade.id, channel.channelId);
                        return (
                            <View key={channel.channelId}>
                                {index > 0 && (
                                    <View
                                        style={[
                                            styles.divider,
                                            { backgroundColor: hexWithAlpha(colors.border, 0.3) },
                                        ]}
                                    />
                                )}
                                <Pressable
                                    onPress={() => {
                                        if (alreadyIn) return;
                                        setSelectedChannelIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(channel.channelId)) {
                                                next.delete(channel.channelId);
                                            } else {
                                                next.add(channel.channelId);
                                            }
                                            return next;
                                        });
                                    }}
                                    disabled={alreadyIn}
                                    style={styles.pickerRow}
                                >
                                    {/* Checkbox */}
                                    <View
                                        style={[
                                            styles.checkbox,
                                            isSelected
                                                ? {
                                                    backgroundColor: colors.primary,
                                                    borderColor: colors.primary,
                                                }
                                                : {
                                                    backgroundColor: 'transparent',
                                                    borderColor: colors.border,
                                                },
                                        ]}
                                    >
                                        {isSelected && <Check size={12} color="#FFFFFF" />}
                                    </View>
                                    <View style={{ width: FAN_SPACING.base }} />

                                    {/* Channel avatar */}
                                    <View
                                        style={[
                                            styles.channelAvatar,
                                            { backgroundColor: colors.primaryDim },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.channelAvatarText,
                                                { color: colors.primary },
                                            ]}
                                        >
                                            {(channel.name?.[0] ?? '?').toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={{ width: FAN_SPACING.base }} />

                                    {/* Channel info */}
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={[styles.channelName, { color: colors.textPrimary }]}
                                            numberOfLines={1}
                                        >
                                            {channel.name}
                                        </Text>
                                        <View style={styles.channelMetaRow}>
                                            <Users size={11} color={colors.textTertiary} />
                                            <View style={{ width: 3 }} />
                                            <Text
                                                style={[
                                                    styles.channelMetaText,
                                                    { color: colors.textTertiary },
                                                ]}
                                            >
                                                {channel.memberCount} members
                                            </Text>
                                        </View>
                                    </View>

                                    {alreadyIn && (
                                        <View
                                            style={[
                                                styles.inPill,
                                                { backgroundColor: colors.primaryDim },
                                            ]}
                                        >
                                            <Text
                                                style={[styles.inPillText, { color: colors.primary }]}
                                            >
                                                ✓ In
                                            </Text>
                                        </View>
                                    )}
                                </Pressable>
                            </View>
                        );
                    })}
                </ScrollView>

                {/* Picker action button */}
                <View
                    style={[
                        styles.pickerFooter,
                        {
                            backgroundColor: colors.background,
                            borderTopColor: hexWithAlpha(colors.border, 0.3),
                        },
                    ]}
                >
                    <Pressable
                        onPress={() => {
                            if (selectedChannelIds.size === 0 || processing) return;
                            if (isAdmin) {
                                void addToChannels(comrade.id, comrade.username);
                            } else {
                                void inviteToChannels(comrade.id, comrade.username);
                            }
                        }}
                        disabled={selectedChannelIds.size === 0 || processing}
                        style={[
                            styles.pickerFooterBtn,
                            {
                                backgroundColor:
                                    selectedChannelIds.size === 0
                                        ? colors.surface
                                        : colors.primary,
                            },
                        ]}
                    >
                        {processing ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text
                                style={[
                                    styles.pickerFooterBtnText,
                                    {
                                        color:
                                            selectedChannelIds.size === 0
                                                ? colors.textSecondary
                                                : '#FFFFFF',
                                    },
                                ]}
                            >
                                {selectedChannelIds.size === 0
                                    ? 'Select Channels'
                                    : `${isAdmin ? 'Add' : 'Invite'} to ${selectedChannelIds.size
                                    } ${selectedChannelIds.size === 1 ? 'Channel' : 'Channels'}`}
                            </Text>
                        )}
                    </Pressable>
                </View>
            </>
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  SCREEN: PROFILE VIEW
    // ═══════════════════════════════════════════════════════════

    function renderProfileScreen() {
        if (!viewingProfile) return null;
        const comrade = viewingProfile;

        return (
            <>
                {/* Profile header */}
                <View style={styles.profileHeader}>
                    <View
                        style={[
                            styles.profileAvatar,
                            {
                                backgroundColor: colors.primaryDim,
                                borderColor: hexWithAlpha(colors.primary, 0.3),
                            },
                        ]}
                    >
                        <Text
                            style={[styles.profileAvatarText, { color: colors.primary }]}
                        >
                            {initials(comrade.nickname)}
                        </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text
                            style={[styles.profileTitle, { color: colors.textPrimary }]}
                            numberOfLines={1}
                        >
                            {comrade.nickname}
                        </Text>
                        <Text
                            style={[styles.profileSub, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            @{comrade.username}
                        </Text>
                    </View>
                    <Pressable onPress={backToList} hitSlop={8} style={styles.closeBtn}>
                        <X size={18} color={colors.textSecondary} />
                    </Pressable>
                </View>

                <View
                    style={[styles.divider, { backgroundColor: hexWithAlpha(colors.border, 0.3) }]}
                />

                <ScrollView contentContainerStyle={styles.profileContent}>
                    {/* Stats row */}
                    <View style={styles.profileStatsRow}>
                        <ProfileStat
                            colors={colors}
                            value={`${comrade.numberOfBets}`}
                            label="Bets"
                            color={colors.primary}
                        />
                        <ProfileStat
                            colors={colors}
                            value={comrade.numberOfBets > 0 ? '✅' : '📭'}
                            label="Status"
                            color={colors.primary}
                        />
                    </View>

                    <View style={{ height: FAN_SPACING.lg }} />

                    <ProfileInfoRow
                        colors={colors}
                        label="Club"
                        value={comrade.clubFan}
                        Icon={Trophy}
                    />
                    <View style={{ height: FAN_SPACING.md }} />
                    <ProfileInfoRow
                        colors={colors}
                        label="Country"
                        value={comrade.countryFan}
                        Icon={Globe2}
                    />
                    <View style={{ height: FAN_SPACING.md }} />
                    <ProfileInfoRow
                        colors={colors}
                        label="Phone"
                        value={comrade.phone}
                        Icon={PhoneIcon}
                    />

                    <View style={{ height: FAN_SPACING.lg }} />

                    <View
                        style={[
                            styles.profileInfoBanner,
                            {
                                backgroundColor: colors.surfaceSunken,
                                borderColor: hexWithAlpha(colors.border, 0.3),
                            },
                        ]}
                    >
                        <Info size={14} color={colors.textTertiary} />
                        <View style={{ width: FAN_SPACING.md }} />
                        <Text
                            style={[
                                styles.profileInfoBannerText,
                                {
                                    color: isComradeAdded(comrade.id)
                                        ? colors.primary
                                        : colors.textTertiary,
                                },
                            ]}
                        >
                            {isComradeAdded(comrade.id)
                                ? '✅ Already in your comrades list'
                                : '📨 Not in your comrades list'}
                        </Text>
                    </View>
                </ScrollView>

                <View style={styles.profileFooter}>
                    <Pressable
                        onPress={backToList}
                        style={[
                            styles.profileCloseBtn,
                            { borderColor: colors.border },
                        ]}
                    >
                        <Text
                            style={[styles.profileCloseBtnText, { color: colors.textPrimary }]}
                        >
                            Close
                        </Text>
                    </Pressable>
                </View>
            </>
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  MAIN RENDER
    // ═══════════════════════════════════════════════════════════

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

                    {/* Header — back arrow only when not on list */}
                    <View style={styles.headerRow}>
                        {screen !== 'list' && (
                            <Pressable
                                onPress={backToList}
                                hitSlop={8}
                                style={styles.backBtn}
                            >
                                <ArrowLeft size={16} color={colors.textSecondary} />
                            </Pressable>
                        )}
                        <View
                            style={[
                                styles.headerIcon,
                                { backgroundColor: colors.primaryDim },
                            ]}
                        >
                            <Users size={22} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text
                                style={[styles.headerTitle, { color: colors.textPrimary }]}
                                numberOfLines={1}
                            >
                                Comrades
                            </Text>
                            <Text
                                style={[styles.headerSub, { color: colors.textSecondary }]}
                                numberOfLines={1}
                            >
                                {screen === 'list'
                                    ? `${filteredComrades.length} available`
                                    : screen === 'picker'
                                        ? 'Select channels'
                                        : 'Profile'}
                            </Text>
                        </View>
                        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                            <X size={18} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    {/* Body */}
                    <View style={styles.body}>
                        {screen === 'list' && renderListScreen()}
                        {screen === 'picker' && renderPickerScreen()}
                        {screen === 'profile' && renderProfileScreen()}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════
//  PROFILE SCREEN SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════

function ProfileStat({
    colors,
    value,
    label,
    color,
}: {
    colors: FanColors;
    value: string;
    label: string;
    color: string;
}) {
    return (
        <View
            style={{
                flex: 1,
                paddingVertical: FAN_SPACING.md,
                backgroundColor: colors.surfaceSunken,
                borderRadius: FAN_RADIUS.md,
                alignItems: 'center',
            }}
        >
            <Text style={{ fontSize: 16, fontWeight: '700', color }}>{value}</Text>
            <Text
                style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}
            >
                {label}
            </Text>
        </View>
    );
}

function ProfileInfoRow({
    colors,
    label,
    value,
    Icon,
}: {
    colors: FanColors;
    label: string;
    value: string;
    Icon: LucideIcon;
}) {
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: FAN_SPACING.base,
                paddingVertical: FAN_SPACING.md,
                backgroundColor: colors.surfaceSunken,
                borderRadius: FAN_RADIUS.md,
            }}
        >
            <Icon size={14} color={colors.textSecondary} />
            <View style={{ width: FAN_SPACING.md }} />
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{label}</Text>
            <View style={{ width: FAN_SPACING.md }} />
            <Text
                style={{
                    flex: 1,
                    fontSize: 12,
                    color: colors.textPrimary,
                    fontWeight: '500',
                }}
                numberOfLines={1}
            >
                {value.length > 0 ? value : 'Not set'}
            </Text>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

function createStyles(colors: FanColors) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        sheet: {
            height: '75%',
            backgroundColor: colors.background,
            borderTopLeftRadius: FAN_RADIUS.xl,
            borderTopRightRadius: FAN_RADIUS.xl,
            overflow: 'hidden',
        },
        handleWrap: {
            alignItems: 'center',
            paddingTop: 10,
            paddingBottom: 6,
        },
        handle: {
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: hexWithAlpha(colors.border, 0.3),
        },

        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: FAN_SPACING.xl,
            paddingTop: FAN_SPACING.md,
            paddingBottom: FAN_SPACING.base,
        },
        backBtn: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceSunken,
            marginRight: FAN_SPACING.sm,
        },
        headerIcon: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerTitle: { fontSize: 17, fontWeight: '700' },
        headerSub: { fontSize: 12, marginTop: 1 },
        closeBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
        },

        body: { flex: 1 },

        // Search
        searchWrap: {
            paddingHorizontal: FAN_SPACING.xl,
            paddingVertical: FAN_SPACING.md,
        },
        searchBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            borderRadius: FAN_RADIUS.lg,
            borderWidth: 1,
            paddingHorizontal: FAN_SPACING.lg,
            paddingVertical: FAN_SPACING.md,
        },
        searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },

        divider: { height: 1 },

        // List screen
        listContent: { paddingBottom: FAN_SPACING.lg },
        center: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: FAN_SPACING.md,
            padding: FAN_SPACING.xl,
        },
        centerTitle: { fontSize: 14, textAlign: 'center' },
        centerHint: { fontSize: 13, marginTop: FAN_SPACING.sm },
        retryBtn: {
            paddingHorizontal: FAN_SPACING.xl,
            paddingVertical: FAN_SPACING.md,
            borderRadius: 20,
            marginTop: FAN_SPACING.sm,
        },
        retryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },

        // Picker screen
        pickerHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: FAN_SPACING.xl,
            paddingTop: FAN_SPACING.md,
            paddingBottom: FAN_SPACING.base,
        },
        pickerAvatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
        },
        pickerAvatarText: { fontSize: 16, fontWeight: '700' },
        pickerTitle: { fontSize: 16, fontWeight: '700' },
        pickerSub: { fontSize: 12, marginTop: 1 },
        pickerListContent: { paddingBottom: FAN_SPACING.lg },
        pickerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: FAN_SPACING.xl,
            paddingVertical: FAN_SPACING.base,
        },
        checkbox: {
            width: 18,
            height: 18,
            borderRadius: FAN_RADIUS.sm,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        channelAvatar: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        channelAvatarText: { fontSize: 11, fontWeight: '700' },
        channelName: { fontSize: 13, fontWeight: '600' },
        channelMetaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 2,
        },
        channelMetaText: { fontSize: 10 },
        inPill: {
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 10,
        },
        inPillText: { fontSize: 9, fontWeight: '600' },
        pickerFooter: {
            paddingHorizontal: FAN_SPACING.xl,
            paddingTop: FAN_SPACING.base,
            paddingBottom: FAN_SPACING.xl,
            borderTopWidth: 1,
        },
        pickerFooterBtn: {
            height: 48,
            borderRadius: FAN_RADIUS.lg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        pickerFooterBtnText: { fontSize: 14, fontWeight: '600' },

        // Profile screen
        profileHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: FAN_SPACING.xl,
            paddingTop: FAN_SPACING.md,
            paddingBottom: FAN_SPACING.base,
        },
        profileAvatar: {
            width: 50,
            height: 50,
            borderRadius: 25,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
        },
        profileAvatarText: { fontSize: 20, fontWeight: '700' },
        profileTitle: { fontSize: 17, fontWeight: '700' },
        profileSub: { fontSize: 13, marginTop: 1 },
        profileContent: {
            padding: FAN_SPACING.xl,
            paddingBottom: FAN_SPACING.xxl,
        },
        profileStatsRow: {
            flexDirection: 'row',
            gap: FAN_SPACING.md,
        },
        profileInfoBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: FAN_SPACING.base,
            borderRadius: FAN_RADIUS.md,
            borderWidth: 1,
        },
        profileInfoBannerText: { fontSize: 11, flex: 1 },
        profileFooter: {
            padding: FAN_SPACING.lg,
        },
        profileCloseBtn: {
            height: 44,
            borderRadius: FAN_RADIUS.lg,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        profileCloseBtnText: { fontSize: 14, fontWeight: '600' },
    });
}