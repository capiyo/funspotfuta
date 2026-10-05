// components/AppHeader.tsx
//
// Shared header across Chats/Feed: brand + bell + avatar on row 1,
// channel chip row on row 2. HomeScreen renders this as an overlay that fades
// out while the user scrolls down (see HomeScreen / home-context).
//
// CHIP GESTURES:
//   tap        → open leaderboard for that channel
//   long-press → open chat for that channel
// Chips have no background; channel names are gray (textSecondary), the
// selected channel is primary, and the channel leader shows as a small primary
// "name (Npts)" tag. Browsable channels show "Name join".
//
// MENU: The avatar opens a small dropdown. The menu is anchored to the
// avatar's measured window position (measureInWindow), so it sits just below
// the avatar regardless of insets, font scaling or header layout. No border,
// smaller type. Leaderboard is gone — the channel chip's tap gesture opens it
// directly. History is new, and opens the HistoryModal (same content as the
// old Logs tab, now a bottom sheet). Create Channel opens the member-picker
// modal (funspot/lib/modals/Funzy/create_channel_modal.dart port).

import { useRef, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    Image,
    ScrollView,
    StyleSheet,
    Modal,
} from 'react-native';
import { Bell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Channel, FanColorPalette, FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '../../modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { GUTTER } from '@/theme/layout';
import { useHome, MAX_CHANNELS } from './home-context';
import NotificationsModal from '@/modals/NotificationsModal';
import ProfileModal from '@/modals/profile/ProfileModal';
import ComradeListModal from '@/modals/comradelist/index';
import LeaderboardModal from '@/modals/LeaderboardModal';
import AdminModal from '@/modals/AdminModal';
import AddPostModal from '@/modals/addPostModal';
import HistoryModal from '@/modals/HistoryModal';
import CreateChannelModal from '@/modals/ChannelCreation';

function topMember(channel: Channel) {
    if (!channel.members?.length) return undefined;
    return [...channel.members].sort((a, b) => b.seasonPoints - a.seasonPoints)[0];
}

export function AppHeader({ onAddChannel }: { onAddChannel?: () => void }) {
    const colors = useFanColors();
    const insets = useSafeAreaInsets();
    const styles = createStyles(colors, insets.top);
    const navigation = useNavigation<any>();
    const { userId, username, authToken, isLoggedIn, logout } = useAuth();
    const { requireLogin } = useLoginModal();
    const {
        activeChannel,
        activeChannelId,
        channels,
        allChannels,
        setActiveChannelId,
        joiningChannelIds,
        joinChannel,
    } = useHome();
    const queryClient = useQueryClient();

    const [notifOpen, setNotifOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [comradesOpen, setComradesOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const [postOpen, setPostOpen] = useState(false);
    const [createChannelOpen, setCreateChannelOpen] = useState(false);
    const [chipLeaderboardChannel, setChipLeaderboardChannel] = useState<Channel | null>(null);

    // Menu anchor: measured from the avatar so the dropdown sits right below it.
    const avatarRef = useRef<View>(null);
    const [menuTop, setMenuTop] = useState(0);

    function openMenu() {
        avatarRef.current?.measureInWindow((_x, y, _w, h) => {
            setMenuTop(y + h + 4); // 4px gap below the avatar
            setMenuOpen(true);
        });
    }

    function pick(action: () => void) {
        setMenuOpen(false);
        setTimeout(action, 0);
    }

    const points =
        activeChannel?.members?.find?.((m: any) => m.userId === userId)
            ?.seasonPoints ?? 0;

    const comradesList: string[] =
        queryClient.getQueryData<string[]>(['comrades']) ?? [];

    const avatarUri = `https://i.pravatar.cc/150?u=${userId ?? 'guest'}`;
    const hasJoinedChannels = channels.length > 0;

    function openChat(channel: Channel) {
        navigation.navigate('Chat', {
            channelId: channel.channelId,
            channelName: channel.name,
            userId,
            username,
            authToken,
        });
    }

    return (
        <View style={styles.wrap}>
            <View style={styles.row}>
                <Text style={styles.brand}>Funspot😂</Text>
                <View style={styles.actions}>
                    <Pressable
                        onPress={() => setNotifOpen(true)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Notifications"
                    >
                        <Bell size={18} color={colors.textSecondary} />
                    </Pressable>

                    {isLoggedIn ? (
                        <Pressable
                            ref={avatarRef}
                            collapsable={false}
                            onPress={openMenu}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Menu"
                            style={styles.avatar}
                        >
                            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={() => requireLogin()}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Join"
                        >
                            <Text style={styles.brand}>Join</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Channel chip row */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipRow}
                contentContainerStyle={styles.chipRowContent}
            >
                {isLoggedIn && hasJoinedChannels
                    ? channels.map((channel) => {
                        const isActive = activeChannelId === channel.channelId;
                        const leader = topMember(channel);
                        return (
                            <Pressable
                                key={channel.channelId}
                                style={[styles.chip, isActive && styles.chipActive]}
                                onPress={() => {
                                    setActiveChannelId(channel.channelId);
                                    setChipLeaderboardChannel(channel);
                                }}
                                onLongPress={() => {
                                    setActiveChannelId(channel.channelId);
                                    openChat(channel);
                                }}
                            >
                                {channel.isAdmin && <Text style={styles.crown}>👑 </Text>}
                                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                    {channel.name}
                                    {leader ? (
                                        <Text style={styles.leaderText}>
                                            {`  ${leader.username} (${leader.seasonPoints}pts)`}
                                        </Text>
                                    ) : null}
                                </Text>
                            </Pressable>
                        );
                    })
                    : (allChannels.length > 0 ? allChannels : channels).map((channel) => {
                        const isJoining = joiningChannelIds.has(channel.channelId);
                        return (
                            <Pressable
                                key={channel.channelId}
                                style={styles.chip}
                                onPress={() => {
                                    if (!isLoggedIn) {
                                        requireLogin(() => void joinChannel(channel));
                                        return;
                                    }
                                    void joinChannel(channel);
                                }}
                            >
                                <Text style={styles.chipText}>{channel.name}</Text>
                                <Text style={styles.joinLabel}>{isJoining ? '…' : 'join'}</Text>
                            </Pressable>
                        );
                    })}

                {(isLoggedIn && hasJoinedChannels ? channels.length : 0) < MAX_CHANNELS && (
                    <Pressable
                        style={styles.chip}
                        onPress={() => requireLogin(() => onAddChannel?.())}
                    >
                        <Text style={styles.chipText}>create channel</Text>
                    </Pressable>
                )}
            </ScrollView>

            <NotificationsModal
                visible={notifOpen}
                onClose={() => setNotifOpen(false)}
            />

            <Modal
                visible={menuOpen}
                transparent
                statusBarTranslucent
                animationType="fade"
                onRequestClose={() => setMenuOpen(false)}
            >
                <Pressable
                    style={[styles.menuOverlay, { paddingTop: menuTop }]}
                    onPress={() => setMenuOpen(false)}
                >
                    <View style={styles.menuSheet}>
                        <MenuItem
                            label="Create Post"
                            colors={colors}
                            onPress={() => pick(() => requireLogin(() => setPostOpen(true)))}
                        />
                        <MenuItem
                            label="Create Channel"
                            colors={colors}
                            onPress={() =>
                                pick(() => requireLogin(() => setCreateChannelOpen(true)))
                            }
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            label="Profile"
                            colors={colors}
                            onPress={() => pick(() => requireLogin(() => setProfileOpen(true)))}
                        />
                        <MenuItem
                            label="Comrades"
                            colors={colors}
                            onPress={() => pick(() => requireLogin(() => setComradesOpen(true)))}
                        />
                        <MenuItem
                            label="History"
                            colors={colors}
                            onPress={() => pick(() => requireLogin(() => setHistoryOpen(true)))}
                        />
                        {activeChannelId && (
                            <MenuItem
                                label="Admin Dashboard"
                                colors={colors}
                                onPress={() => pick(() => requireLogin(() => setAdminOpen(true)))}
                            />
                        )}
                        <View style={styles.menuDivider} />
                        <MenuItem
                            label="Logout"
                            destructive
                            colors={colors}
                            onPress={() => pick(() => logout())}
                        />
                    </View>
                </Pressable>
            </Modal>

            <ProfileModal
                visible={profileOpen}
                onClose={() => setProfileOpen(false)}
                channels={channels ?? (activeChannel ? [activeChannel] : [])}
            />
            <ComradeListModal
                visible={comradesOpen}
                onClose={() => setComradesOpen(false)}
                comradesList={comradesList}
                userChannels={channels ?? (activeChannel ? [activeChannel] : [])}
                onComradeAdded={() => {
                    queryClient.invalidateQueries({ queryKey: ['comrades'] });
                }}
            />
            <HistoryModal
                visible={historyOpen}
                onClose={() => setHistoryOpen(false)}
            />
            <CreateChannelModal
                visible={createChannelOpen}
                onClose={() => setCreateChannelOpen(false)}
                onChannelCreated={() => {
                    queryClient.invalidateQueries({ queryKey: ['channels'] });
                }}
            />
            <LeaderboardModal
                visible={!!chipLeaderboardChannel}
                channelId={chipLeaderboardChannel?.channelId}
                onClose={() => setChipLeaderboardChannel(null)}
            />
            {activeChannelId && (
                <AdminModal
                    visible={adminOpen}
                    channelId={activeChannelId}
                    onClose={() => setAdminOpen(false)}
                />
            )}
            <AddPostModal
                visible={postOpen}
                onClose={() => setPostOpen(false)}
                onPostCreated={() => {
                    queryClient.invalidateQueries({ queryKey: ['posts'] });
                }}
            />
        </View>
    );
}

function MenuItem({
    label,
    onPress,
    destructive,
    colors,
}: {
    label: string;
    onPress: () => void;
    destructive?: boolean;
    colors: FanColorPalette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{
                paddingVertical: FAN_SPACING.md,
                paddingHorizontal: FAN_SPACING.md,
            }}
        >
            <Text
                style={fanText(
                    'caption',
                    colors,
                    destructive ? colors.away : colors.textPrimary,
                )}
            >
                {label}
            </Text>
        </Pressable>
    );
}

function createStyles(colors: FanColorPalette, topInset: number) {
    return StyleSheet.create({
        wrap: {
            backgroundColor: colors.surfaceElevated,
            paddingHorizontal: FAN_SPACING.lg,
            paddingTop: topInset + FAN_SPACING.md,
            paddingBottom: FAN_SPACING.sm,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        brand: {
            fontFamily: 'SairaCondensed_600SemiBold',
            fontSize: 15,
            letterSpacing: -0.3,
            color: colors.primary,
        },
        actions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.base,
        },
        avatar: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.primaryMuted,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        avatarImg: {
            width: 28,
            height: 28,
            borderRadius: 14,
        },
        chipRow: {
            flexGrow: 0,
            marginTop: FAN_SPACING.sm,
        },
        chipRowContent: {
            alignItems: 'center',
            gap: FAN_SPACING.sm,
            paddingHorizontal: GUTTER,
        },
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 6,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: 'transparent',
        },
        chipActive: { borderBottomColor: colors.primary, borderBottomWidth: 1.5 },
        chipText: { fontSize: 10, fontWeight: '500', color: colors.textSecondary },
        chipTextActive: { color: colors.primary },
        leaderText: { fontSize: 8, fontWeight: '400', color: colors.primary },
        crown: { fontSize: 9 },
        joinLabel: {
            marginLeft: 4,
            fontSize: 8,
            fontWeight: '700',
            color: colors.primary,
        },
        menuOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'flex-end',
            // paddingTop is set at render time from the measured avatar
            // position (see openMenu), so the menu sits just below it.
            paddingRight: FAN_SPACING.lg,
        },
        menuSheet: {
            width: 170,
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.surfaceElevated,
            paddingVertical: FAN_SPACING.xs,
            // No border — flat surface against the dimmed backdrop.
        },
        menuDivider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            marginVertical: FAN_SPACING.xs,
            // Remove the visual weight: keep it as a hairline only.
            opacity: 0.5,
        },
    });
}