// apps/web/src/modals/profile/ProfileContent.tsx
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
//      getUserBalance() on mount and after every transaction, with the
//      value held in component state. The Flutter version cached it to
//      SharedPreferences; the RN payment-service.ts explicitly does not
//      port that, so this file honors that decision.
//   2. No Firebase sign-out. useAuth().logout() is the RN equivalent.
//   3. No AppCache.profile fast path. React-query is used instead where
//      applicable; here the profile is fetched directly on mount.
//   4. In-place content swap instead of stacked modals for member
//      profiles (see header).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
const dismissKeyboard = () => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };
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
} from 'lucide-react';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import {
  getUserBalance,
  getSavedPhone,
  useCachedProfile,
  queryKeys,
  memberVoteAccuracy,
  type Channel,
  type ChannelMember,
} from '@funspot/core';
//import type { Channel } from '@funspot/core';       // ← what I wrote
import type { Channel as UserChannel } from '@funspot/core/src/api/channels-service';
import {
  UserData,
  UsersCollectionSnapshot,
  EMPTY_USERS_COLLECTION_SNAPSHOT,
  userDataFromJson,
} from './types';
import { DepositDialog, WithdrawDialog } from './paymentsDialogs';
import { ChannelLeaderboard } from './ChannelLeaderboard';
import './profile.css';

type FanColors = ReturnType<typeof useFanColors>;

const API_BASE = 'https://clash-api-m5mr.onrender.com/api';
const TIMEOUT_MS = 15000;

const rn = (s: CSSProperties): CSSProperties => ({
  ...(('flexDirection' in s || 'alignItems' in s || 'justifyContent' in s || 'gap' in s) && !s.display ? { display: 'flex' } : {}),
  ...(s.display === 'flex' && !s.flexDirection ? { flexDirection: 'column' } : {}),
  ...(('borderWidth' in s || 'borderTopWidth' in s) && !s.borderStyle ? { borderStyle: 'solid' } : {}),
  boxSizing: 'border-box', minWidth: 0,
  ...s,
});

// ═══════════════════════════════════════════════════════════════
//  PROFILE MODAL
// ═══════════════════════════════════════════════════════════════

export interface ProfileContentProps {
  variant: 'modal' | 'sidebar';
  onClose?: () => void;
  onViewProfile?: () => void;
  onSelectChannel?: (channelId: string) => void;
  onSelectChats?: () => void;
  channels?: Channel[];
}

export default function ProfileContent({
  variant,
  onClose = () => undefined,
  onViewProfile,
  onSelectChannel,
  onSelectChats,
  channels = [],
}: ProfileContentProps) {
  const inline = variant === 'sidebar';
  const visible = true;
  const colors = useFanColors();
  const styles = createStyles(colors);
  const { isInitialized, isLoggedIn, userId, username, phone, authToken, logout } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  // ── Which profile is being viewed ───────────────────────────
  // When non-null, we're viewing another user's profile (member
  // tapped inside a channel leaderboard). Content swaps in place;
  // a back arrow returns to the current user.
  const [viewingMember, setViewingMember] = useState<ChannelMember | null>(null);

  // ── Data ────────────────────────────────────────────────────
  const [profile, setProfile] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [paymentVisible, setPaymentVisible] = useState(true);

  // Saved phones
  const [savedTopupPhone, setSavedTopupPhone] = useState<string | null>(null);
  const [savedWithdrawPhone, setSavedWithdrawPhone] = useState<string | null>(null);

  // Which dialog is open
  const [dialog, setDialog] = useState<'deposit' | 'withdraw' | null>(null);

  // Edit form
  const [editNickname, setEditNickname] = useState('');
  const [editClub, setEditClub] = useState('');
  const [editCountry, setEditCountry] = useState('');

  // Snapshot of /auth/user/id for first-time profile creation.
  const pendingSnapshot = useRef<UsersCollectionSnapshot | null>(null);

  const isCurrentUser = viewingMember === null;
  const targetUserId = viewingMember?.userId ?? userId ?? '';
  const targetUsername = viewingMember?.username ?? username ?? '';

  const currentUserChannelMembers = channels
    .map((channel) => channel.members?.find((member) => member.userId === userId))
    .filter((member): member is ChannelMember => Boolean(member));
  const totalSeasonPoints = currentUserChannelMembers.reduce(
    (total, member) => total + member.seasonPoints,
    0,
  );
  const profileAccuracy = currentUserChannelMembers.length
    ? Math.round(
        currentUserChannelMembers.reduce(
          (total, member) => total + memberVoteAccuracy(member),
          0,
        ) / currentUserChannelMembers.length,
      )
    : 0;

  // ── Reset on open ───────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setViewingMember(null);
    setEditing(false);
  }, [visible]);

  // Profile is shared query data: restored cache renders immediately, while
  // React Query refreshes it in the background. Transient errors must not be
  // mistaken for a missing profile and trigger the create-profile flow.
  const profileQuery = useCachedProfile(
    isInitialized && isLoggedIn && targetUserId ? targetUserId : undefined,
    authToken,
  );

  useEffect(() => {
    if (!visible || !isInitialized || !isLoggedIn || !targetUserId) return;
    if (profileQuery.isPending && profileQuery.data === undefined) {
      setLoading(true);
      return;
    }

    if (profileQuery.isError && profileQuery.data === undefined) {
      setLoading(false);
      return;
    }

    if (profileQuery.data && typeof profileQuery.data === 'object') {
      const source = profileQuery.data;
      const u: UserData = {
        userId: source.userId,
        username: source.username,
        phone: source.phone,
        nickname: source.nickname,
        clubFan: source.clubFan,
        countryFan: source.countryFan,
        numberOfBets: source.numberOfBets,
        balance: source.balance,
      };
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

    // A successful null means 404/no profile. A failed query is handled above
    // and deliberately does not open profile creation.
    if (profileQuery.data === null && !profileQuery.isError) {
      setProfile(null);
      setProfileExists(false);
      setEditing(true);
      setLoading(false);
      if (isCurrentUser) {
        void fetchUsersCollectionSnapshot().then((snapshot) => {
          pendingSnapshot.current = snapshot;
          if (snapshot.balance > 0) {
            setBalance(snapshot.balance);
            setBalanceLoading(false);
          }
        }).catch(() => {
          // Keep the profile editor available if the optional account snapshot
          // endpoint is unavailable; do not overwrite cached profile data.
        });
      }
    }
  }, [
    visible,
    isInitialized,
    isLoggedIn,
    targetUserId,
    isCurrentUser,
    profileQuery.data,
    profileQuery.isError,
    profileQuery.isPending,
  ]);

  // ── Balance + saved phones (self only) ──────────────────────
  const refreshBalance = useCallback(async () => {
    if (!userId) return;
    setBalanceLoading(true);
    const bal = await getUserBalance(
      userId,
      authToken ?? undefined,
      true,
    );
    setBalance(bal);
    queryClient.setQueryData(queryKeys.profile(userId), (previous) => previous ? { ...previous, balance: bal } : previous);
    setBalanceLoading(false);
  }, [userId, authToken, queryClient]);

  useEffect(() => {
    if (!visible || !isInitialized || !isLoggedIn || !isCurrentUser || !userId) return;
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
  }, [visible, isInitialized, isLoggedIn, isCurrentUser, userId, authToken]);

  // ── Payment visibility gate (self only) ─────────────────────
  useEffect(() => {
    if (!visible || !isInitialized || !isLoggedIn || !isCurrentUser) return;
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
  }, [visible, isInitialized, isLoggedIn, isCurrentUser, authToken]);

  // ── Snapshot fetch ──────────────────────────────────────────
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

  // ── Save profile ────────────────────────────────────────────
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
        Array.isArray(decoded) && decoded.length > 0
          ? decoded[0]
          : decoded;
      const saved = userDataFromJson(raw);

      setProfile(saved);
      queryClient.setQueryData(queryKeys.profile(userId), {
        userId: saved.userId,
        username: saved.username,
        phone: saved.phone,
        nickname: saved.nickname,
        clubFan: saved.clubFan,
        countryFan: saved.countryFan,
        numberOfBets: saved.numberOfBets,
        balance: saved.balance,
      });
      setProfileExists(true);
      setEditing(false);
      setBalance(saved.balance);
      toast.showSuccess('Profile saved!');
      dismissKeyboard();
    } catch (e: any) {
      toast.showError(`Network error: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Logout ──────────────────────────────────────────────────
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

  // ── In-place member view ────────────────────────────────────
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
      <div
        style={{ ...Object.assign({}, 
          styles.balanceCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderActive,
          },
        ) }}
      >
        <div
          style={{ ...Object.assign({}, 
            styles.balanceIcon,
            { backgroundColor: colors.primaryDim },
          ) }}
        >
          <Wallet size={16} color={colors.primary} />
        </div>
        <div style={rn({ flex: 1, flexDirection: 'column' })}>
          <span style={{ ...Object.assign({}, styles.balanceLabel, { color: colors.textTertiary }) }}>
            Balance
          </span>
          <span style={{ ...Object.assign({}, styles.balanceValue, { color: colors.textPrimary }) }}>
            {balanceLoading ? 'Loading…' : `KES ${balance.toFixed(2)}`}
          </span>
        </div>
        <div style={styles.balanceActions}>
          <button type="button"
            onClick={() => setDialog('deposit')}
            style={{ ...Object.assign({}, 
              styles.actionChip,
              { backgroundColor: colors.primary },
            ) }}
          >
            <Plus size={10} color={colors.textInverse} />
            <span style={styles.actionChipTextPrimary}>Deposit</span>
          </button>
          <button type="button"
            onClick={() => setDialog('withdraw')}
            style={{ ...Object.assign({}, 
              styles.actionChip,
              {
                backgroundColor: colors.surfaceSunken,
                borderWidth: 0.5,
                borderColor: colors.border,
              },
            ) }}
          >
            <Minus size={10} color={colors.textSecondary} />
            <span
              style={{ ...Object.assign({}, 
                styles.actionChipText,
                { color: colors.textSecondary },
              ) }}
            >
              Withdraw
            </span>
          </button>
        </div>
      </div>
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
      <div
        style={{ ...Object.assign({}, 
          styles.infoRow,
          { backgroundColor: colors.surfaceSunken },
        ) }}
      >
        <Icon size={12} color={colors.primary} />
        <div style={{ flex: 1 }}>
          <span style={{ ...Object.assign({}, styles.infoLabel, { color: colors.textTertiary }) }}>
            {label}
          </span>
          <span style={{ ...Object.assign({}, styles.infoValue, { color: colors.textPrimary }) }}>
            {value}
          </span>
        </div>
      </div>
    );
  }

  function renderProfileView() {
    if (!profile) return null;
    return (
      <div style={rn({ display: 'flex', flexDirection: 'row', gap: FAN_SPACING.sm })}>
        {isCurrentUser && (
          <div style={styles.statsGrid}>
            <div style={{ ...Object.assign({}, styles.statCard, { backgroundColor: colors.surfaceSunken }) }}>
              <span style={{ ...Object.assign({}, styles.statLabel, { color: colors.textTertiary }) }}>Bets</span>
              <span style={{ ...Object.assign({}, styles.statValue, { color: colors.textPrimary }) }}>{profile.numberOfBets}</span>
            </div>
            <div style={{ ...Object.assign({}, styles.statCard, { backgroundColor: colors.surfaceSunken }) }}>
              <span style={{ ...Object.assign({}, styles.statLabel, { color: colors.textTertiary }) }}>Points</span>
              <span style={{ ...Object.assign({}, styles.statValue, { color: colors.textPrimary }) }}>{totalSeasonPoints}</span>
            </div>
            <div style={{ ...Object.assign({}, styles.statCard, { backgroundColor: colors.surfaceSunken }) }}>
              <span style={{ ...Object.assign({}, styles.statLabel, { color: colors.textTertiary }) }}>Accuracy</span>
              <span style={{ ...Object.assign({}, styles.statValue, { color: colors.textPrimary }) }}>{profileAccuracy}%</span>
            </div>
          </div>
        )}
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
          <div style={styles.actionRow}>
            <button type="button"
              onClick={() => setEditing(true)}
              style={{ ...Object.assign({}, 
                styles.actionBtn,
                { backgroundColor: colors.primary },
              ) }}
            >
              <Pencil size={11} color={colors.textInverse} />
              <span style={styles.actionBtnTextPrimary}>Edit</span>
            </button>
            <button type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              style={{ ...Object.assign({}, 
                styles.actionBtn,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                },
              ) }}
            >
              {loggingOut ? (
                <span className="profile-loading-indicator" aria-label="Loading" />
              ) : (
                <>
                  <LogOut size={11} color={colors.textSecondary} />
                  <span
                    style={{ ...Object.assign({}, 
                      styles.actionBtnText,
                      { color: colors.textSecondary },
                    ) }}
                  >
                    Logout
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
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
      <div style={{ marginBottom: FAN_SPACING.md }}>
        <span style={{ ...Object.assign({}, styles.fieldLabel, { color: colors.textTertiary }) }}>
          {label}
        </span>
        <div
          style={{ ...Object.assign({}, 
            styles.fieldWrap,
            {
              backgroundColor: colors.surfaceSunken,
              borderColor: colors.border,
            },
          ) }}
        >
          <Icon size={12} color={colors.textTertiary} />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            
            disabled={saving}
            style={{ ...Object.assign({}, styles.fieldInput, { color: colors.textPrimary }) }}
          />
        </div>
      </div>
    );
  }

  function renderNoProfileView() {
    return (
      <div style={rn({ display: 'flex', flexDirection: 'column', gap: FAN_SPACING.md })}>
        <div style={rn({ display: 'flex', flexDirection: 'column', alignItems: 'center' })}>
          <div
            style={{ ...Object.assign({}, 
              styles.noProfileIcon,
              { backgroundColor: colors.primaryDim },
            ) }}
          >
            <UserIcon size={24} color={colors.primary} />
          </div>
          <span
            style={{ ...Object.assign({}, styles.noProfileTitle, { color: colors.textPrimary }) }}
          >
            Complete Your Profile
          </span>
          <span
            style={{ ...Object.assign({}, styles.noProfileHint, { color: colors.textTertiary }) }}
          >
            Tell us about yourself
          </span>
        </div>

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

        <button type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ ...Object.assign({}, 
            styles.actionBtn,
            { backgroundColor: colors.primary },
          ) }}
        >
          {saving ? (
            <span className="profile-loading-indicator" aria-label="Saving" />
          ) : (
            <>
              <CheckCircle2 size={11} color={colors.textInverse} />
              <span style={styles.actionBtnTextPrimary}>Complete Profile</span>
            </>
          )}
        </button>
      </div>
    );
  }

  function renderEditMode() {
    return (
      <div style={{ gap: FAN_SPACING.md }}>
        <div style={{ alignItems: 'center' }}>
          <div
            style={{ ...Object.assign({}, 
              styles.noProfileIcon,
              { backgroundColor: colors.primaryDim, width: 48, height: 48 },
            ) }}
          >
            <UserIcon size={20} color={colors.primary} />
          </div>
        </div>

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

        <div style={styles.actionRow}>
          <button type="button"
            onClick={() => {
              setEditing(false);
              dismissKeyboard();
            }}
            style={{ ...Object.assign({}, 
              styles.actionBtn,
              {
                backgroundColor: colors.surfaceSunken,
                borderWidth: 0.5,
                borderColor: colors.border,
              },
            ) }}
          >
            <X size={11} color={colors.textSecondary} />
            <span
              style={{ ...Object.assign({}, 
                styles.actionBtnText,
                { color: colors.textSecondary },
              ) }}
            >
              Cancel
            </span>
          </button>
          <button type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ ...Object.assign({}, 
              styles.actionBtn,
              { backgroundColor: colors.primary },
            ) }}
          >
            {saving ? (
              <span className="profile-loading-indicator" aria-label="Saving" />
            ) : (
              <>
                <CheckCircle2 size={11} color={colors.textInverse} />
                <span style={styles.actionBtnTextPrimary}>Save</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ═══════════════════════════════════════════════════════════

  const guestProfile: UserData = {
    userId: 'guest_fan',
    username: '@guest_fan',
    phone: 'Not set',
    nickname: 'Guest Fan',
    clubFan: 'Arsenal',
    countryFan: 'Kenya',
    numberOfBets: 18,
    balance: 0,
  };
  const guestChannels = [
    {
      channelId: 'preview-premier-league',
      name: 'Premier League',
      isAdmin: false,
      members: [
        { userId: 'guest_john', username: 'john_w', totalVotes: 42, msgCount: 16, seasonPoints: 760, correctVotes: 29, isAdmin: false },
        { userId: 'guest_mary', username: 'mary_ochieng', totalVotes: 35, msgCount: 23, seasonPoints: 640, correctVotes: 25, isAdmin: false },
      ],
    },
    {
      channelId: 'preview-world-cup',
      name: 'World Cup',
      isAdmin: false,
      members: [
        { userId: 'guest_mary', username: 'mary_ochieng', totalVotes: 35, msgCount: 23, seasonPoints: 640, correctVotes: 25, isAdmin: false },
        { userId: 'guest_john', username: 'john_w', totalVotes: 42, msgCount: 16, seasonPoints: 760, correctVotes: 29, isAdmin: false },
      ],
    },
    {
      channelId: 'preview-local-derbies',
      name: 'Local Derbies',
      isAdmin: false,
      members: [
        { userId: 'guest_john', username: 'john_w', totalVotes: 42, msgCount: 16, seasonPoints: 760, correctVotes: 29, isAdmin: false },
        { userId: 'guest_mary', username: 'mary_ochieng', totalVotes: 35, msgCount: 23, seasonPoints: 640, correctVotes: 25, isAdmin: false },
      ],
    },
  ] as unknown as Channel[];
  const visibleChannels = isLoggedIn && channels.length > 0 ? channels.slice(0, 3) : guestChannels;
  const isPreviewChannels = !isLoggedIn || channels.length === 0;
  const visibleProfile = isLoggedIn ? profile : guestProfile;
  const openLogin = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('funspot:open-login'));
  };
  const renderGuestFields = () => (
    <div className="profile-guest-fields">
      {[
        ['Username', guestProfile.username],
        ['Team nickname', guestProfile.nickname],
        ['Favorite club', guestProfile.clubFan],
        ['Country', guestProfile.countryFan],
        ['Phone', guestProfile.phone],
      ].map(([label, value]) => (
        <div className="profile-guest-field" key={label}>
          <span style={{ color: colors.textTertiary }}>{label}</span>
          <strong style={{ color: colors.textPrimary }}>{value}</strong>
        </div>
      ))}
    </div>
  );

  const profileBody = (
    <>
            {!inline && (
              <div style={styles.handleWrap}>
                <div style={styles.handle} />
              </div>
            )}

            {/* Header */}
            <div style={styles.headerRow} className="profile-header-row">
              {!isCurrentUser && (
                <button type="button"
                  onClick={handleBackToSelf}
                  
                  style={styles.backBtn}
                >
                  <ArrowLeft size={16} color={colors.textSecondary} />
                </button>
              )}
              <div
                className="home-avatar"
                style={{ ...Object.assign({}, 
                  styles.headerAvatar,
                  {
                    backgroundColor: colors.primaryDim,
                    borderColor: colors.borderActive,
                  },
                ) }}
              >
                <span style={{ ...Object.assign({}, styles.headerAvatarText, { color: colors.primary }) }}>
                  {(visibleProfile?.nickname || targetUsername || '?')
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>
              <div style={rn({ flex: 1, minWidth: 0, marginLeft: FAN_SPACING.md })} className="profile-header-name-column">
                <span
                  style={{ ...Object.assign({}, styles.headerTitle, { color: colors.textPrimary }) }}
                  className="profile-ellipsis"
                >
                  {visibleProfile?.nickname || targetUsername || 'Profile'}
                </span>
                <span
                  style={{ ...Object.assign({}, styles.headerSub, { color: colors.textTertiary }) }}
                  className="profile-ellipsis"
                >
                  {!isLoggedIn ? '@guest_fan' : isCurrentUser
                    ? channels.length === 0
                      ? 'No channels'
                      : `${channels.length} ${channels.length === 1 ? 'Channel' : 'Channels'}`
                    : 'Member'}
                </span>
              </div>
              {inline ? (
                <button type="button" onClick={onViewProfile}  style={styles.viewProfileBtn}>
                  <span style={{ ...Object.assign({}, styles.viewProfileText, { color: colors.primary }) }} className="profile-header-view-link">View profile</span>
                </button>
              ) : (
                <button type="button" onClick={onClose}  style={styles.closeBtn}>
                  <X size={14} color={colors.textSecondary} />
                </button>
              )}
            </div>

            {/* Scrollable body */}
            <div
              className="no-scrollbar"
              style={styles.scroll}
            >
              {!isInitialized ? (
                <div style={styles.center}><span>Loading profile…</span></div>
              ) : !isLoggedIn ? (
                <div className="profile-guest-preview">
                  <div className="profile-guest-banner">Preview data - log in to see your own profile</div>
                  {!isLoggedIn && renderGuestFields()}
                  {!isLoggedIn && <button type="button" className="profile-guest-login" onClick={openLogin}>Log In</button>}
                  <div className="profile-guest-channels-heading">
                    <strong>Channels (preview)</strong><span>{visibleChannels.length}</span>
                  </div>
                  <ChannelLeaderboard channels={visibleChannels} currentUserId={isLoggedIn ? (userId ?? '') : 'guest_fan'} onViewMember={isLoggedIn ? handleViewMember : () => undefined} />
                </div>
              ) : loading ? (
                <div style={styles.center}>
                  <span className="profile-loading-indicator" aria-label="Loading" />
                </div>
              ) : (
                <>
                  {/* Balance card (self only, when visibility allows) */}
                  {isCurrentUser && renderBalanceCard()}

                  {/* Profile section */}
                  {profile === null
                    ? renderNoProfileView()
                    : editing
                      ? renderEditMode()
                      : renderProfileView()}
                </>
              )}
            </div>

            {(isLoggedIn ? channels : []).length > 0 && isCurrentUser && (
              <div style={styles.channelsSection}>
                <span style={{ ...Object.assign({}, styles.sectionHeading, { color: colors.textTertiary }) }}>YOUR CHANNELS</span>
                {channels.slice(0, 3).map((channel) => {
                  const member = channel.members?.find((item) => item.userId === userId);
                  return (
                    <button type="button"
                      key={channel.channelId}
                      onClick={() => {
                        onSelectChannel?.(channel.channelId);
                        onSelectChats?.();
                        onClose();
                      }}
                      style={{ ...Object.assign({}, 
                        styles.channelRow,
                        { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
                      ) }}
                    >
                      <div style={{ ...Object.assign({}, styles.channelAvatarSmall, { backgroundColor: colors.primaryDim }) }}>
                        <span style={{ ...Object.assign({}, styles.channelAvatarSmallText, { color: colors.primary }) }}>
                          {(channel.name?.[0] ?? 'C').toUpperCase()}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ ...Object.assign({}, styles.channelRowName, { color: colors.textPrimary }) }} className="profile-ellipsis">
                          {channel.name}
                        </span>
                        <span style={{ ...Object.assign({}, styles.channelRowMeta, { color: colors.textTertiary }) }}>
                          {channel.isAdmin ? 'Admin' : 'Member'} · {member?.seasonPoints ?? 0} points
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Channel leaderboard tabs (below the profile section) */}
            {isLoggedIn && channels.length > 0 && isCurrentUser && (
              <div style={styles.leaderboardSection}>
                <ChannelLeaderboard
                  channels={channels.slice(0, 3)}
                  currentUserId={userId ?? ''}
                  onViewMember={handleViewMember}
                />
              </div>
            )}

    </>
  );

  return (
    <>
      {profileBody}
      {isLoggedIn && isCurrentUser && userId && (
        <DepositDialog visible={dialog === 'deposit'} userId={userId} username={username ?? ''} authToken={authToken} balance={balance} isBalanceLoading={balanceLoading} savedPhone={savedTopupPhone} onClose={() => setDialog(null)} onSuccess={(newBal) => { setBalance(newBal); void refreshBalance(); }} />
      )}
      {isLoggedIn && isCurrentUser && userId && (
        <WithdrawDialog visible={dialog === 'withdraw'} userId={userId} username={username ?? ''} authToken={authToken} balance={balance} isBalanceLoading={balanceLoading} savedPhone={savedWithdrawPhone} onClose={() => setDialog(null)} onSuccess={(newBal) => { setBalance(newBal); void refreshBalance(); }} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

function createStyles(colors: FanColors): Record<string, CSSProperties> {
  const raw: Record<string, CSSProperties> = {
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
    inlineSheet: {
      maxHeight: 'none',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      backgroundColor: 'transparent',
      overflow: 'visible',
    },
    statsGrid: { flexDirection: 'row', gap: FAN_SPACING.sm, marginBottom: FAN_SPACING.sm },
    statCard: { flex: 1, minWidth: 0, borderRadius: FAN_RADIUS.md, padding: FAN_SPACING.md },
    statLabel: { fontSize: 10, marginBottom: 3 },
    statValue: { fontSize: 15, fontWeight: '700' },
    viewProfileBtn: { paddingInline: FAN_SPACING.sm, paddingBlock: FAN_SPACING.xs },
    viewProfileText: { fontSize: 12, fontWeight: '700' },
    channelsSection: { paddingInline: FAN_SPACING.lg, paddingTop: FAN_SPACING.md, paddingBottom: FAN_SPACING.md },
    sectionHeading: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: FAN_SPACING.sm },
    channelRow: { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.md, borderWidth: 1, borderRadius: FAN_RADIUS.md, padding: FAN_SPACING.md, marginBottom: FAN_SPACING.sm },
    channelAvatarSmall: { width: 30, height: 30, borderRadius: FAN_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    channelAvatarSmallText: { fontSize: 13, fontWeight: '800' },
    channelRowName: { fontSize: 13, fontWeight: '700' },
    channelRowMeta: { fontSize: 11, marginTop: 3 },


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
      paddingInline: FAN_SPACING.lg,
      paddingBlock: FAN_SPACING.md,
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
      paddingInline: FAN_SPACING.lg,
      paddingBottom: FAN_SPACING.lg,
    },
    center: {
      paddingBlock: 60,
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
      paddingInline: FAN_SPACING.md,
      paddingBlock: FAN_SPACING.sm,
      borderRadius: FAN_RADIUS.pill,
    },
    actionChipText: { fontSize: 9, fontWeight: '600' },
    actionChipTextPrimary: {
      color: colors.textPrimary,
      fontSize: 9,
      fontWeight: '600',
    },

    // Info rows
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.md,
      paddingInline: FAN_SPACING.base,
      paddingBlock: FAN_SPACING.md,
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
      paddingBlock: FAN_SPACING.md,
      borderRadius: FAN_RADIUS.md,
    },
    actionBtnText: { fontSize: 10, fontWeight: '600' },
    actionBtnTextPrimary: {
      color: colors.textPrimary,
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
    noProfileTitle: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2,
    },
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
      paddingInline: FAN_SPACING.md,
      paddingBlock: FAN_SPACING.sm,
      borderRadius: FAN_RADIUS.md,
      borderWidth: 0.5,
    },
    fieldInput: { flex: 1, fontSize: 12, paddingBlock: 4 },

    // Leaderboard section
    leaderboardSection: {
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
      paddingInline: FAN_SPACING.md,
      paddingBlock: FAN_SPACING.md,
      maxHeight: 340,
    },
  };
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, rn(value)]));
}