// components/AppHeader.tsx
//
// Shared header across Arena/Feed/Logs. Brand + bell + avatar on row 1,
// channel indicator on row 2. Bell opens NotificationsModal. Avatar:
//   • logged in  → shows the profile image, opens the menu
//   • logged out → shows a "Log in" pill, opens LoginModal
//
// Menu items (Create Post / Profile / Comrades / Leaderboard / Admin /
// Logout) are gated behind requireLogin so a session that expires while
// the menu is open can't slip through.

import { useState } from 'react';
import { type Channel } from '@funspot/core';
import {
    View,
    Text,
    Pressable,
    Image,
    StyleSheet,
    Modal,
} from 'react-native';
import { Bell, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '../../modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { FanColorPalette, FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useHome } from './home-context';
import NotificationsModal from '@/modals/NotificationsModal';
import ProfileModal from '@/modals/profile/ProfileModal';
import ComradesModal from '@/modals/ComradesModal';
import LeaderboardModal from '@/modals/LeaderboardModal';
import AdminModal from '@/modals/AdminModal';
import AddPostModal from '@/modals/addPostModal';

export function AppHeader({ onAddChannel }: { onAddChannel?: () => void }) {
    const colors = useFanColors();
    const insets = useSafeAreaInsets();
    const styles = createStyles(colors, insets.top);
    const { username, userId, isLoggedIn, logout } = useAuth();
    const { requireLogin } = useLoginModal();
    const { activeChannel, activeChannelId, channels } = useHome();
    const queryClient = useQueryClient();

    const [notifOpen, setNotifOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [comradesOpen, setComradesOpen] = useState(false);
    const [leaderboardOpen, setLeaderboardOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const [postOpen, setPostOpen] = useState(false);

    function pick(action: () => void) {
        setMenuOpen(false);
        // defer so the menu Modal finishes dismissing before the next one mounts
        setTimeout(action, 0);
    }

    const points =
        activeChannel?.members?.find?.((m: any) => m.userId === userId)
            ?.seasonPoints ?? 0;

    const avatarUri = `https://i.pravatar.cc/150?u=${userId ?? 'guest'}`;

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
                            onPress={() => setMenuOpen(true)}
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
                            accessibilityLabel="Log in"
                            style={styles.loginPill}
                        >
                            <Text style={fanText('tag', colors, colors.primary)}>
                                Log in
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {activeChannel && isLoggedIn && (
                <View style={styles.channelRow}>
                    <Text style={fanText('caption', colors, colors.draw)}>👑</Text>
                    <Text style={fanText('caption', colors, colors.primary)}>
                        {' '}{activeChannel.name}
                    </Text>
                    <Text style={fanText('caption', colors)}>
                        {'  '}{username} ({points}pts)
                    </Text>
                    {onAddChannel && (
                        <Pressable
                            onPress={onAddChannel}
                            style={{ marginLeft: FAN_SPACING.md }}
                            hitSlop={8}
                        >
                            <Plus size={14} color={colors.textTertiary} />
                        </Pressable>
                    )}
                </View>
            )}

            <NotificationsModal
                visible={notifOpen}
                onClose={() => setNotifOpen(false)}
            />

            <Modal
                visible={menuOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuOpen(false)}
            >
                <Pressable
                    style={styles.menuOverlay}
                    onPress={() => setMenuOpen(false)}
                >
                    <View style={styles.menuSheet}>
                        <MenuItem
                            label="Create Post"
                            colors={colors}
                            onPress={() =>
                                pick(() =>
                                    requireLogin(() => setPostOpen(true)),
                                )
                            }
                        />
                        <View style={styles.menuDivider} />
                        <MenuItem
                            label="Profile"
                            colors={colors}
                            onPress={() =>
                                pick(() =>
                                    requireLogin(() => setProfileOpen(true)),
                                )
                            }
                        />
                        <MenuItem
                            label="Comrades"
                            colors={colors}
                            onPress={() =>
                                pick(() =>
                                    requireLogin(() => setComradesOpen(true)),
                                )
                            }
                        />
                        <MenuItem
                            label="Leaderboard"
                            colors={colors}
                            onPress={() =>
                                pick(() =>
                                    requireLogin(() => setLeaderboardOpen(true)),
                                )
                            }
                        />
                        {activeChannelId && (
                            <MenuItem
                                label="Admin Dashboard"
                                colors={colors}
                                onPress={() =>
                                    pick(() =>
                                        requireLogin(() => setAdminOpen(true)),
                                    )
                                }
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
            <ComradesModal
                visible={comradesOpen}
                onClose={() => setComradesOpen(false)}
            />
            <LeaderboardModal
                visible={leaderboardOpen}
                onClose={() => setLeaderboardOpen(false)}
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
                    // Matches the Flutter parent's `_postsPageKey++` refresh:
                    // invalidate the posts feed so react-query refetches on
                    // the next focus of the Feed tab.
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
                paddingVertical: FAN_SPACING.base,
                paddingHorizontal: FAN_SPACING.lg,
            }}
        >
            <Text
                style={fanText(
                    'title',
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
            backgroundColor: colors.background,
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
        loginPill: {
            borderRadius: FAN_RADIUS.pill,
            borderWidth: 1,
            borderColor: colors.primary,
            paddingHorizontal: FAN_SPACING.base,
            paddingVertical: 3,
        },
        channelRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: FAN_SPACING.sm,
        },
        menuOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'flex-end',
            paddingTop: 80,
            paddingRight: FAN_SPACING.lg,
        },
        menuSheet: {
            width: 190,
            borderRadius: FAN_RADIUS.md,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: FAN_SPACING.xs,
        },
        menuDivider: {
            height: 1,
            backgroundColor: colors.border,
            marginVertical: FAN_SPACING.sm,
        },
    });
}