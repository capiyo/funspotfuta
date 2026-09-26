// apps/mobile/src/modals/ProfileModal/index.tsx
//
// RN port of funspot/lib/modals/profile/swipeable_profile_modal.dart —
// the "Profile" modal opened from the AppHeader menu.
//
// The Flutter source opens another profile on top of this one when you
// tap a member inside the channel leaderboard tabs. On RN, stacked
// <Modal>s are unreliable on Android (second modal renders behind the
// first, or taps don't reach it). This port swaps the modal's content
// in place instead — the same component re-renders against a different
// userId, with a back arrow to return to your own profile. Every other
// behavior matches the Flutter source.
//
// Deviations from the Flutter source, all deliberate:
//   1. No TransactionLocalStorage balance cache. The balance comes from
//      getUserBalance() on mount and after every transaction, held in
//      component state. The Flutter version cached it to SharedPreferences;
//      the RN payment-service.ts explicitly does not port that.
//   2. No Firebase sign-out. useAuth().logout() is the RN equivalent.
//   3. No AppCache.profile fast path. The profile is fetched directly.
//   4. In-place content swap instead of stacked modals for member
//      profiles (see header).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    Modal,
    Keyboard,
} from 'react-native';
import {
    X,
    ArrowLeft,
    User as UserIcon,
    Shield,
    Globe2,
    Phone,
    Pencil,
    LogOut,
    CheckCircle2,
    Plus,
    Minus,
    Wallet,
} from 'lucide-react-native';
import {
    FAN_SPACING,
    FAN_RADIUS,
    getUserBalance,
    getSavedPhone,
    type Channel,
    type ChannelMember,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import {
    UserData,
    UsersCollectionSnapshot,
    EMPTY_USERS_COLLECTION_SNAPSHOT,
    userDataFromJson,
} from './types';
import { DepositDialog, WithdrawDialog } from './paymentsDialogs';
import { ChannelLeaderboard } from './ChannelLeaderboard';

type FanColors = ReturnType<typeof useFanColors>;

const API_BASE = 'https://clash-api-m5mr.onrender.com/api';

function hexWithAlpha(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    if (c.length !== 6) return hex;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════
//  PROFILE MODAL
// ═══════════════════════════════════════════════════════════════

export interface ProfileModalProps {
    visible: boolean;
    onClose: () => void;
    /** Channels the current user belongs to — shown as leaderboard tabs. */
    channels?: Channel[];
}

export default function ProfileModal({
    visible,
    onClose,
    channels = [],
}: ProfileModalProps) {
    const colors = useFanColors();
    const styles = createStyles(colors);
    const { userId, username, authToken, logout } = useAuth();
    const toast = useToast();

    // Which profile is being viewed. Non-null = viewing another member
    // (tapped inside a channel leaderboard). Content swaps in place; a
    // back arrow returns to the current user.
    const [viewingMember, setViewingMember] = useState<ChannelMember | null>(
        null,
    );

    // Data
    const [profile, setProfile] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileExists, setProfileExists] = useState(false);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const [balance, setBalance] = useState(0);
    const [balanceLoading, setBalanceLoading] = useState(true);
    const [paymentVisible, setPaymentVisible] = useState(true);

    const [savedTopupPhone, setSavedTopupPhone] = useState<string | null>(null);
    const [savedWithdrawPhone, setSavedWithdrawPhone] = useState<string | null>(
        null,
    );

    const [dialog, setDialog] = useState<'deposit' | 'withdraw' | null>(null);

    // Edit form
    const [editNickname, setEditNickname] = useState('');
    const [editClub, setEditClub] = useState('');
    const [editCountry, setEditCountry] = useState('');

    const pendingSnapshot = useRef<UsersCollectionSnapshot | null>(null);

    const isCurrentUser = viewingMember === null;
    const targetUserId = viewingMember?.userId ?? userId ?? '';
    const targetUsername = viewingMember?.username ?? username ?? '';

    // Reset on open
    useEffect(() => {
        if (!visible) return;
        setViewingMember(null);
        setEditing(false);
    }, [visible]);

    // Load profile whenever target changes
    useEffect(() => {
        if (!visible || !targetUserId) return;
        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `${API_BASE}/profile/profile/${targetUserId}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        },
                    },
                );

                if (cancelled) return;

                if (res.status === 200) {
                    const decoded = await res.json();
                    const raw =
                        Array.isArray(decoded) && decoded.length > 0
                            ? decoded[0]
                            : decoded;
                    if (raw && typeof raw === 'object') {
                        const u = userDataFromJson(raw);
                        if (cancelled) return;
                        setProfile(u);
                        setProfileExists(true);
                        setEditNickname(u.nickname);
                        setEditClub(u.clubFan);
                        setEditCountry(u.countryFan);
                        setBalance(u.balance);
                        setEditing(false);
                        setLoading(false);
                        return;
                    }
                }

                if (cancelled) return;
                setProfile(null);
                setProfileExists(false);
                setEditing(true);
                setLoading(false);
                if (isCurrentUser && userId) {
                    const snap = await fetchUsersCollectionSnapshot();
                    if (cancelled) return;
                    pendingSnapshot.current = snap;
                    if (snap.balance > 0) {
                        setBalance(snap.balance);
                        setBalanceLoading(false);
                    }
                }
            } catch {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [visible, targetUserId, authToken, isCurrentUser, userId]);

    // Balance + saved phones (self only)
    const refreshBalance = useCallback(async () => {
        if (!userId) return;
        setBalanceLoading(true);
        const bal = await getUserBalance(userId, authToken ?? undefined, true);
        setBalance(bal);
        setBalanceLoading(false);
    }, [userId, authToken]);

    useEffect(() => {
        if (!visible || !isCurrentUser || !userId) return;
        let cancelled = false;
        (async () => {
            const [bal, topupPhone, withdrawPhone] = await Promise.all([
                getUserBalance(userId, authToken ?? undefined, true),
                getSavedPhone(userId, 'topup', authToken ?? undefined),
                getSavedPhone(userId, 'withdraw', authToken ?? undefined),
            ]);
            if (cancelled) return;
            setBalance(bal);
            setSavedTopupPhone(topupPhone);
            setSavedWithdrawPhone(withdrawPhone);
            setBalanceLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [visible, isCurrentUser, userId, authToken]);

    // Payment visibility gate (self only)
    useEffect(() => {
        if (!visible || !isCurrentUser) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/visibility/votes_button_show`, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    },
                });
                if (cancelled) return;
                if (res.status === 200) {
                    const data = await res.json();
                    setPaymentVisible(data.value !== false);
                } else {
                    setPaymentVisible(false);
                }
            } catch {
                if (!cancelled) setPaymentVisible(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [visible, isCurrentUser, authToken]);

    async function fetchUsersCollectionSnapshot(): Promise<UsersCollectionSnapshot> {
        if (!userId) return EMPTY_USERS_COLLECTION_SNAPSHOT;
        try {
            const res = await fetch(`${API_BASE}/auth/user/id/${userId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
            });
            if (!res.ok) return EMPTY_USERS_COLLECTION_SNAPSHOT;
            const data = await res.json();
            if (data?.success === true && data?.user) {
                return {
                    phone: data.user.phone?.toString().trim() ?? '',
                    balance: Number(data.user.balance ?? 0),
                    totalVotes: Number(data.user.total_votes ?? 0),
                };
            }
            return EMPTY_USERS_COLLECTION_SNAPSHOT;
        } catch {
            return EMPTY_USERS_COLLECTION_SNAPSHOT;
        }
    }

    async function handleSave() {
        if (!isCurrentUser || !userId) return;
        const nickname = editNickname.trim();
        const club = editClub.trim();
        const country = editCountry.trim();

        if (!nickname) {
            toast.showError('Nickname is required');
            return;
        }
        if (!club) {
            toast.showError('Favorite club is required');
            return;
        }
        if (!country) {
            toast.showError('Country is required');
            return;
        }

        setSaving(true);
        try {
            let phoneForSave: string;
            let balanceForSave: number;
            let betsForSave: number;

            if (profileExists && profile && profile.phone) {
                phoneForSave = profile.phone;
                balanceForSave = balance;
                betsForSave = profile.numberOfBets;
            } else {
                const snap =
                    pendingSnapshot.current ?? (await fetchUsersCollectionSnapshot());
                phoneForSave = snap.phone;
                balanceForSave = snap.balance;
                betsForSave = snap.totalVotes;
            }

            if (!phoneForSave) {
                toast.showError('No phone number found on your account');
                setSaving(false);
                return;
            }

            const body = {
                user_id: userId,
                username: username ?? '',
                phone: phoneForSave,
                nickname,
                club_fan: club,
                country_fan: country,
                balance: balanceForSave,
                number_of_bets: betsForSave,
            };

            const isNew = profile === null;
            const url = isNew
                ? `${API_BASE}/profile/create_profile`
                : `${API_BASE}/profile/profiles/${userId}`;

            const res = await fetch(url, {
                method: isNew ? 'POST' : 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify(body),
            });

            if (res.status !== 200 && res.status !== 201) {
                toast.showError(`Save failed (${res.status})`);
                setSaving(false);
                return;
            }

            const decoded = await res.json();
            const raw =
                Array.isArray(decoded) && decoded.length > 0 ? decoded[0] : decoded;
            const saved = userDataFromJson(raw);

            setProfile(saved);
            setProfileExists(true);
            setEditing(false);
            setBalance(saved.balance);
            toast.showSuccess('Profile saved!');
            Keyboard.dismiss();
        } catch (e: any) {
            toast.showError(`Network error: ${e?.message ?? e}`);
        } finally {
            setSaving(false);
        }
    }

    async function handleLogout() {
        if (!isCurrentUser || loggingOut) return;
        setLoggingOut(true);
        try {
            await logout();
            onClose();
            toast.showSuccess('Logged out');
        } catch {
            toast.showError('Logout failed');
        } finally {
            setLoggingOut(false);
        }
    }

    function handleViewMember(member: ChannelMember) {
        setViewingMember(member);
    }

    function handleBackToSelf() {
        setViewingMember(null);
        setEditing(false);
    }

    // ═══════════════════════════════════════════════════════════
    //  RENDER HELPERS
    // ═══════════════════════════════════════════════════════════

    function renderBalanceCard() {
        if (!isCurrentUser || !paymentVisible) return null;
        return (
            <View
                style={[
                    styles.balanceCard,
                    {
                        backgroundColor: colors.surface,
                        borderColor: colors.borderActive,
                    },
                ]}
            >
                <View
                    style={[styles.balanceIcon, { backgroundColor: colors.primaryDim }]}
                >
                    <Wallet size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.balanceLabel, { color: colors.textTertiary }]}>
                        Balance
                    </Text>
                    <Text style={[styles.balanceValue, { color: colors.textPrimary }]}>
                        {balanceLoading ? 'Loading…' : `KES ${balance.toFixed(2)}`}
                    </Text>
                </View>
                <View style={styles.balanceActions}>
                    <Pressable
                        onPress={() => setDialog('deposit')}
                        style={[styles.actionChip, { backgroundColor: colors.primary }]}
                    >
                        <Plus size={10} color="#FFFFFF" />
                        <Text style={styles.actionChipTextPrimary}>Deposit</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setDialog('withdraw')}
                        style={[
                            styles.actionChip,
                            {
                                backgroundColor: colors.surfaceSunken,
                                borderWidth: 0.5,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Minus size={10} color={colors.textSecondary} />
                        <Text
                            style={[styles.actionChipText, { color: colors.textSecondary }]}
                        >
                            Withdraw
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    function renderInfoRow({
        Icon,
        label,
        value,
    }: {
        Icon: typeof UserIcon;
        label: string;
        value: string;
    }) {
        return (
            <View
                style={[styles.infoRow, { backgroundColor: colors.surfaceSunken }]}
            >
                <Icon size={12} color={colors.primary} />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                        {label}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                        {value}
                    </Text>
                </View>
            </View>
        );
    }

    function renderProfileView() {
        if (!profile) return null;
        return (
            <View style={{ gap: FAN_SPACING.sm }}>
                {renderInfoRow({
                    Icon: UserIcon,
                    label: 'Username',
                    value: `@${profile.username}`,
                })}
                {renderInfoRow({
                    Icon: Shield,
                    label: 'Team Nickname',
                    value: profile.nickname || 'Not set',
                })}
                {renderInfoRow({
                    Icon: Shield,
                    label: 'Favorite Club',
                    value: profile.clubFan || 'Not set',
                })}
                {renderInfoRow({
                    Icon: Globe2,
                    label: 'Country',
                    value: profile.countryFan || 'Not set',
                })}
                {renderInfoRow({
                    Icon: Phone,
                    label: 'Phone',
                    value: profile.phone || 'Not set',
                })}

                {isCurrentUser && (
                    <View style={styles.actionRow}>
                        <Pressable
                            onPress={() => setEditing(true)}
                            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                        >
                            <Pencil size={11} color="#FFFFFF" />
                            <Text style={styles.actionBtnTextPrimary}>Edit</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleLogout}
                            disabled={loggingOut}
                            style={[
                                styles.actionBtn,
                                {
                                    backgroundColor: colors.surfaceSunken,
                                    borderWidth: 0.5,
                                    borderColor: colors.border,
                                },
                            ]}
                        >
                            {loggingOut ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <>
                                    <LogOut size={11} color={colors.textSecondary} />
                                    <Text
                                        style={[
                                            styles.actionBtnText,
                                            { color: colors.textSecondary },
                                        ]}
                                    >
                                        Logout
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                )}
            </View>
        );
    }

    function renderEditField({
        label,
        value,
        onChange,
        placeholder,
        Icon,
    }: {
        label: string;
        value: string;
        onChange: (v: string) => void;
        placeholder: string;
        Icon: typeof UserIcon;
    }) {
        return (
            <View style={{ marginBottom: FAN_SPACING.md }}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>
                    {label}
                </Text>
                <View
                    style={[
                        styles.fieldWrap,
                        {
                            backgroundColor: colors.surfaceSunken,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <Icon size={12} color={colors.textTertiary} />
                    <TextInput
                        value={value}
                        onChangeText={onChange}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textTertiary}
                        editable={!saving}
                        style={[styles.fieldInput, { color: colors.textPrimary }]}
                    />
                </View>
            </View>
        );
    }

    function renderNoProfileView() {
        return (
            <View style={{ gap: FAN_SPACING.md }}>
                <View style={{ alignItems: 'center' }}>
                    <View
                        style={[
                            styles.noProfileIcon,
                            { backgroundColor: colors.primaryDim },
                        ]}
                    >
                        <UserIcon size={24} color={colors.primary} />
                    </View>
                    <Text style={[styles.noProfileTitle, { color: colors.textPrimary }]}>
                        Complete Your Profile
                    </Text>
                    <Text style={[styles.noProfileHint, { color: colors.textTertiary }]}>
                        Tell us about yourself
                    </Text>
                </View>

                {renderEditField({
                    label: 'TEAM NICKNAME',
                    value: editNickname,
                    onChange: setEditNickname,
                    placeholder: 'e.g., Red Devils, The Gunners',
                    Icon: Shield,
                })}
                {renderEditField({
                    label: 'FAVORITE CLUB',
                    value: editClub,
                    onChange: setEditClub,
                    placeholder: 'Which club do you support?',
                    Icon: Shield,
                })}
                {renderEditField({
                    label: 'COUNTRY',
                    value: editCountry,
                    onChange: setEditCountry,
                    placeholder: 'Country you support?',
                    Icon: Globe2,
                })}

                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <CheckCircle2 size={11} color="#FFFFFF" />
                            <Text style={styles.actionBtnTextPrimary}>
                                Complete Profile
                            </Text>
                        </>
                    )}
                </Pressable>
            </View>
        );
    }

    function renderEditMode() {
        return (
            <View style={{ gap: FAN_SPACING.md }}>
                <View style={{ alignItems: 'center' }}>
                    <View
                        style={[
                            styles.noProfileIcon,
                            { backgroundColor: colors.primaryDim, width: 48, height: 48 },
                        ]}
                    >
                        <UserIcon size={20} color={colors.primary} />
                    </View>
                </View>

                {renderEditField({
                    label: 'TEAM NICKNAME',
                    value: editNickname,
                    onChange: setEditNickname,
                    placeholder: 'e.g., Red Devils, The Gunners',
                    Icon: Shield,
                })}
                {renderEditField({
                    label: 'FAVORITE CLUB',
                    value: editClub,
                    onChange: setEditClub,
                    placeholder: 'Which club do you support?',
                    Icon: Shield,
                })}
                {renderEditField({
                    label: 'COUNTRY',
                    value: editCountry,
                    onChange: setEditCountry,
                    placeholder: 'Where are you from?',
                    Icon: Globe2,
                })}

                <View style={styles.actionRow}>
                    <Pressable
                        onPress={() => {
                            setEditing(false);
                            Keyboard.dismiss();
                        }}
                        style={[
                            styles.actionBtn,
                            {
                                backgroundColor: colors.surfaceSunken,
                                borderWidth: 0.5,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <X size={11} color={colors.textSecondary} />
                        <Text
                            style={[styles.actionBtnText, { color: colors.textSecondary }]}
                        >
                            Cancel
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <CheckCircle2 size={11} color="#FFFFFF" />
                                <Text style={styles.actionBtnTextPrimary}>Save</Text>
                            </>
                        )}
                    </Pressable>
                </View>
            </View>
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  MAIN RENDER
    // ═══════════════════════════════════════════════════════════

    return (
        <>
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
                            {!isCurrentUser && (
                                <Pressable
                                    onPress={handleBackToSelf}
                                    hitSlop={8}
                                    style={styles.backBtn}
                                >
                                    <ArrowLeft size={16} color={colors.textSecondary} />
                                </Pressable>
                            )}
                            <View
                                style={[
                                    styles.headerAvatar,
                                    {
                                        backgroundColor: colors.primaryDim,
                                        borderColor: colors.borderActive,
                                    },
                                ]}
                            >
                                <Text
                                    style={[styles.headerAvatarText, { color: colors.primary }]}
                                >
                                    {(profile?.nickname || targetUsername || '?')
                                        .charAt(0)
                                        .toUpperCase()}
                                </Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: FAN_SPACING.md }}>
                                <Text
                                    style={[styles.headerTitle, { color: colors.textPrimary }]}
                                    numberOfLines={1}
                                >
                                    {profile?.nickname || targetUsername || 'Profile'}
                                </Text>
                                <Text
                                    style={[styles.headerSub, { color: colors.textTertiary }]}
                                    numberOfLines={1}
                                >
                                    {isCurrentUser
                                        ? channels.length === 0
                                            ? 'No channels'
                                            : `${channels.length} ${channels.length === 1 ? 'Channel' : 'Channels'
                                            }`
                                        : 'Member'}
                                </Text>
                            </View>
                            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                                <X size={14} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        {/* Scrollable body */}
                        <ScrollView
                            style={styles.scroll}
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {loading ? (
                                <View style={styles.center}>
                                    <ActivityIndicator color={colors.primary} />
                                </View>
                            ) : (
                                <>
                                    {isCurrentUser && profileExists && renderBalanceCard()}
                                    {profile === null
                                        ? renderNoProfileView()
                                        : editing
                                            ? renderEditMode()
                                            : renderProfileView()}
                                </>
                            )}
                        </ScrollView>

                        {/* Channel leaderboard tabs */}
                        {channels.length > 0 && isCurrentUser && (
                            <View style={styles.leaderboardSection}>
                                <ChannelLeaderboard
                                    channels={channels}
                                    currentUserId={userId ?? ''}
                                    onViewMember={handleViewMember}
                                />
                            </View>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Deposit / Withdraw */}
            {isCurrentUser && userId && (
                <DepositDialog
                    visible={dialog === 'deposit'}
                    userId={userId}
                    username={username ?? ''}
                    authToken={authToken}
                    balance={balance}
                    isBalanceLoading={balanceLoading}
                    savedPhone={savedTopupPhone}
                    onClose={() => setDialog(null)}
                    onSuccess={(newBal) => {
                        setBalance(newBal);
                        void refreshBalance();
                    }}
                />
            )}
            {isCurrentUser && userId && (
                <WithdrawDialog
                    visible={dialog === 'withdraw'}
                    userId={userId}
                    username={username ?? ''}
                    authToken={authToken}
                    balance={balance}
                    isBalanceLoading={balanceLoading}
                    savedPhone={savedWithdrawPhone}
                    onClose={() => setDialog(null)}
                    onSuccess={(newBal) => {
                        setBalance(newBal);
                        void refreshBalance();
                    }}
                />
            )}
        </>
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
            maxHeight: '88%',
            borderTopLeftRadius: FAN_RADIUS.xl,
            borderTopRightRadius: FAN_RADIUS.xl,
            backgroundColor: colors.background,
            overflow: 'hidden',
        },

        handleWrap: {
            alignItems: 'center',
            paddingTop: FAN_SPACING.md,
            paddingBottom: FAN_SPACING.sm,
        },
        handle: {
            width: 32,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.border,
        },

        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: FAN_SPACING.lg,
            paddingVertical: FAN_SPACING.md,
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
        headerAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
        },
        headerAvatarText: { fontSize: 14, fontWeight: '700' },
        headerTitle: { fontSize: 14, fontWeight: '700' },
        headerSub: { fontSize: 10, marginTop: 2 },
        closeBtn: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceSunken,
        },

        scroll: { flexGrow: 0 },
        scrollContent: {
            paddingHorizontal: FAN_SPACING.lg,
            paddingBottom: FAN_SPACING.lg,
        },
        center: {
            paddingVertical: 60,
            alignItems: 'center',
            justifyContent: 'center',
        },

        // Balance card
        balanceCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            padding: FAN_SPACING.base,
            borderRadius: FAN_RADIUS.lg,
            borderWidth: 1,
            marginBottom: FAN_SPACING.md,
        },
        balanceIcon: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        balanceLabel: { fontSize: 10 },
        balanceValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
        balanceActions: { flexDirection: 'row', gap: FAN_SPACING.xs },
        actionChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: FAN_SPACING.sm,
            borderRadius: FAN_RADIUS.pill,
        },
        actionChipText: { fontSize: 9, fontWeight: '600' },
        actionChipTextPrimary: {
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: '600',
        },

        // Info rows
        infoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            paddingHorizontal: FAN_SPACING.base,
            paddingVertical: FAN_SPACING.md,
            borderRadius: FAN_RADIUS.md,
        },
        infoLabel: { fontSize: 9 },
        infoValue: { fontSize: 11, fontWeight: '500', marginTop: 1 },

        // Action buttons
        actionRow: { flexDirection: 'row', gap: FAN_SPACING.md },
        actionBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: FAN_SPACING.sm,
            paddingVertical: FAN_SPACING.md,
            borderRadius: FAN_RADIUS.md,
        },
        actionBtnText: { fontSize: 10, fontWeight: '600' },
        actionBtnTextPrimary: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '600',
        },

        // No-profile / edit
        noProfileIcon: {
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: FAN_SPACING.md,
        },
        noProfileTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
        noProfileHint: { fontSize: 10 },

        fieldLabel: {
            fontSize: 8,
            fontWeight: '700',
            letterSpacing: 1,
            marginBottom: 4,
        },
        fieldWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: FAN_SPACING.sm,
            borderRadius: FAN_RADIUS.md,
            borderWidth: 0.5,
        },
        fieldInput: { flex: 1, fontSize: 12, paddingVertical: 4 },

        // Leaderboard section
        leaderboardSection: {
            borderTopWidth: 0.5,
            borderTopColor: colors.border,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: FAN_SPACING.md,
            maxHeight: 340,
        },
    });
}