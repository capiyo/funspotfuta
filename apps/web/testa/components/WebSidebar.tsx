'use client';

// Ported 1:1 from lib/WebView/Hompage/web_profile_panel.dart.
// Width 280, FanColors.surfaceElevated background, mock preview when no
// userId, balance card, info-row stat chips, channel tabs, and
// _WebLeaderboardMemberCard-equivalent member cards.
//
// The channel tab strip is a swipeable, animated TabBarView equivalent
// (framer-motion) — tapping slides the indicator and content, dragging
// the content area horizontally switches tabs.
//
// FALLBACK: if the signed-in API returns no channels (or the fetch fails),
// the sidebar falls back to MOCK_CHANNELS so the channels section is
// never blank. When that happens, the "Channels (preview)" label shows.

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth/auth-context';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://clash-api-m5mr.onrender.com/api';

// ── Types ──────────────────────────────────────────────────────
interface ChannelMember {
  userId: string;
  username: string;
  correctVotes: number;
  totalVotes: number;
  msgCount: number;
  seasonPoints: number;
}

interface Channel {
  name: string;
  memberCount: number;
  season: string;
  isAdmin: boolean;
  members: ChannelMember[];
}

// ── Mock data ──────────────────────────────────────────────────
const MOCK_PROFILE = {
  username: 'guest_fan',
  nickname: 'Guest Fan',
  clubFan: 'Arsenal',
  countryFan: 'Kenya',
  phone: '',
};

const FIRST_NAMES = [
  'Kip', 'Brenda', 'The', 'Ngugi', 'Faith', 'Samuel', 'Wanjiru', 'Derek', 'Coach', 'Zawadi',
  'Amos', 'Grace', 'Peter', 'Mary', 'John', 'Esther', 'David', 'Sarah', 'James', 'Ruth',
  'Michael', 'Rachel', 'Joseph', 'Hannah', 'Daniel', 'Rebekah', 'Joshua', 'Deborah', 'Nathan', 'Miriam',
];
const LAST_NAMES = [
  'Ochieng', 'W', 'Gooner', 'J', 'M', 'K', 'A', 'O', 'Otieno', 'N',
  'Kimani', 'Njoroge', 'Kamau', 'Mwangi', 'Odhiambo', 'Akinyi', 'Omondi', 'Achieng', 'Ouma', 'Awino',
  'Otieno', 'Adhiambo', 'Ochieng', 'Atieno',
];

function mockMembers(count: number, prefix: string): ChannelMember[] {
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 3 + 7) % LAST_NAMES.length];
    const correctVotes = 15 + (i * 3) % 40;
    const totalVotes = correctVotes + (5 + (i % 15));
    return {
      userId: `m${i + 1}_${prefix}`,
      username: `${first}_${last}`.toLowerCase(),
      correctVotes,
      totalVotes,
      msgCount: 10 + (i * 7) % 150,
      seasonPoints: 200 + (i * 35) % 900,
    };
  });
}

const MOCK_CHANNELS: Channel[] = [
  { name: 'Premier League', memberCount: 15, season: '3', isAdmin: true, members: mockMembers(15, 'pl') },
  { name: 'World Cup Warriors', memberCount: 15, season: '1', isAdmin: false, members: mockMembers(15, 'wc') },
  { name: 'Local Derby Crew', memberCount: 15, season: '2', isAdmin: false, members: mockMembers(15, 'ld') },
];

// ── API ────────────────────────────────────────────────────────
async function fetchUserChannels(userId: string, authToken?: string | null): Promise<Channel[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/channels/user/${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: any[] = data?.channels ?? [];
    return raw.map((c) => ({
      name: c.name ?? '',
      memberCount: c.memberCount ?? c.member_count ?? 0,
      season: String(c.season ?? ''),
      isAdmin: Boolean(c.isAdmin ?? c.is_admin),
      members: (c.members ?? []).map((m: any) => ({
        userId: m.userId ?? m.user_id ?? '',
        username: m.username ?? '',
        correctVotes: m.correctVotes ?? m.correct_votes ?? 0,
        totalVotes: m.totalVotes ?? m.total_votes ?? 0,
        msgCount: m.msgCount ?? m.msg_count ?? 0,
        seasonPoints: m.seasonPoints ?? m.season_points ?? 0,
      })),
    }));
  } catch {
    return [];
  }
}

async function fetchUserProfile(userId: string, authToken?: string | null) {
  try {
    const res = await fetch(`${API_BASE_URL}/profile/profile/${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
    if (!res.ok) return null;
    const decoded = await res.json();
    const userMap = Array.isArray(decoded) ? decoded[0] : decoded;
    if (!userMap) return null;
    return {
      userId: userMap.user_id?.toString() ?? userMap.userId?.toString() ?? '',
      username: userMap.username?.toString() ?? '',
      phone: userMap.phone?.toString() ?? '',
      nickname: userMap.nickname?.toString() ?? '',
      clubFan: userMap.club_fan?.toString() ?? '',
      countryFan: userMap.country_fan?.toString() ?? '',
      numberOfBets: userMap.number_of_bets ?? 0,
      balance: Number(userMap.balance ?? 0),
    };
  } catch {
    return null;
  }
}

async function fetchBalance(userId: string, authToken?: string | null): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/payment/balance/${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Number(data.balance ?? data.wallet_balance ?? 0);
  } catch {
    return null;
  }
}

async function saveProfileFields(
  userId: string,
  username: string,
  phone: string,
  fields: { nickname: string; clubFan: string; countryFan: string },
  balance: number,
  numberOfBets: number,
  isNew: boolean,
  authToken?: string | null,
): Promise<boolean> {
  const body = {
    user_id: userId,
    username,
    phone,
    nickname: fields.nickname,
    club_fan: fields.clubFan,
    country_fan: fields.countryFan,
    balance,
    number_of_bets: numberOfBets,
  };
  const url = isNew
    ? `${API_BASE_URL}/profile/create_profile`
    : `${API_BASE_URL}/profile/profiles/${userId}`;
  try {
    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Info row ───────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center rounded-[8px] border-[0.5px] border-fan-border bg-fan-surfaceSunken px-[10px] py-[6px]">
      <span className="text-[12px] leading-none" aria-hidden>{icon}</span>
      <div className="ml-2 flex flex-col">
        <span className="text-[10px] leading-tight text-fan-textTertiary">{label}</span>
        <span className="text-[11px] font-medium leading-tight text-fan-textPrimary">
          {value}
        </span>
      </div>
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────
function ActionButton({
  label,
  icon,
  onClick,
  primary = true,
  loading = false,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex w-full items-center justify-center rounded-[8px] py-[7px] text-[10px] font-semibold ${primary
          ? 'bg-fan-primary text-white'
          : 'border-[0.5px] border-fan-border bg-fan-surfaceSunken text-fan-textSecondary'
        } disabled:opacity-60`}
    >
      {loading ? (
        <span
          className={`h-3 w-3 animate-spin rounded-full border-2 border-t-transparent ${primary ? 'border-white' : 'border-fan-primary'
            }`}
        />
      ) : (
        <>
          {icon && <span className="mr-1">{icon}</span>}
          {label}
        </>
      )}
    </button>
  );
}

// ── Mock banner ────────────────────────────────────────────────
function MockBanner() {
  return (
    <div className="mb-2 flex items-center rounded-[8px] border-[0.5px] border-fan-borderActive bg-fan-primaryDim px-[10px] py-2">
      <span className="mr-1.5 text-[13px] leading-none">👁</span>
      <span className="flex-1 text-[9px] text-fan-textSecondary">
        Preview data — log in to see your own profile
      </span>
    </div>
  );
}

// ── Leaderboard member card ────────────────────────────────────
function MemberCard({
  member,
  rank,
  maxPoints,
  isYou,
}: {
  member: ChannelMember;
  rank: number;
  maxPoints: number;
  isYou: boolean;
}) {
  const winRate = member.totalVotes > 0 ? member.correctVotes / member.totalVotes : 0;
  const starCount = Math.max(0, Math.min(5, Math.round(winRate * 5)));
  const pointsFraction = maxPoints > 0 ? Math.min(1, member.seasonPoints / maxPoints) : 0;

  const rankColor =
    rank === 1
      ? '#FFC107'
      : rank === 2
        ? '#B0BEC5'
        : rank === 3
          ? '#CD7F32'
          : 'rgb(var(--fan-textTertiary))';

  return (
    <div className="mb-1.5 flex gap-2.5 rounded-[10px] border-[0.5px] border-fan-border/30 bg-fan-surface p-2">
      {/* Avatar block with rank number */}
      <div className="relative h-9 w-9 shrink-0 rounded-[8px] bg-fan-primaryDim">
        <span className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-fan-primary">
          {member.username ? member.username[0].toUpperCase() : '?'}
        </span>
        <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold text-fan-primary/60">
          {rank}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {/* Name row */}
        <div className="flex items-center">
          <p className="flex-1 truncate text-[12px] font-bold text-fan-textPrimary">
            {member.username}
          </p>
          {isYou && (
            <span className="ml-1.5 rounded-[4px] bg-fan-primaryMuted px-1 py-px text-[7px] font-semibold text-fan-primary">
              You
            </span>
          )}
        </div>

        <div className="h-1" />

        {/* Rating row */}
        <div className="flex items-center">
          <span className="w-[60px] text-[9px] text-fan-textTertiary">Rating</span>
          <span className="flex items-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={`text-[10px] leading-none ${i < starCount ? 'text-amber-400' : 'text-fan-border'
                  }`}
              >
                ★
              </span>
            ))}
            <span className="ml-1 text-[9px] text-fan-textTertiary">
              ({member.totalVotes})
            </span>
          </span>
        </div>

        <div className="h-0.5" />

        {/* Votes row */}
        <div className="flex items-center">
          <span className="w-[60px] text-[9px] text-fan-textTertiary">Votes</span>
          <span className="text-[10px] font-semibold text-fan-textPrimary">
            {member.correctVotes}/{member.totalVotes}
          </span>
          <span className="flex-1" />
          <span className="text-[9px] font-semibold text-fan-textTertiary">
            {Math.round(winRate * 100)}%
          </span>
        </div>

        <div className="h-0.5" />

        {/* Messages row */}
        <div className="flex items-center">
          <span className="w-[60px] text-[9px] text-fan-textTertiary">Messages</span>
          <span className="text-[10px] font-semibold text-fan-textPrimary">
            {member.msgCount}
          </span>
        </div>

        <div className="h-0.5" />

        {/* Points row */}
        <div className="flex items-center">
          <span className="w-[60px] text-[9px] text-fan-textTertiary">Points</span>
          <span className="text-[10px] font-semibold text-fan-textPrimary">
            {member.seasonPoints}
          </span>
        </div>

        <div className="h-1.5" />

        {/* Rank badge + progress bar */}
        <div className="flex items-center">
          <span
            className="rounded-[10px] px-1.5 py-0.5 text-[8px] font-bold"
            style={{ backgroundColor: `${rankColor}26`, color: rankColor }}
          >
            {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
          </span>
          <div className="ml-2 h-[3px] flex-1 overflow-hidden rounded-[2px] bg-fan-border/30">
            <div
              className="h-full rounded-[2px]"
              style={{ width: `${pointsFraction * 100}%`, backgroundColor: rankColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Channel tab bar (animated indicator) ───────────────────────
function ChannelTabBar({
  channels,
  activeTab,
  onTabChange,
}: {
  channels: Channel[];
  activeTab: number;
  onTabChange: (i: number) => void;
}) {
  const shown = channels.slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <div className="mx-1 my-1 flex gap-0.5 rounded-[8px] border-[0.5px] border-fan-border bg-fan-surfaceSunken p-0.5">
      {shown.map((c, i) => {
        const isActive = i === activeTab;
        return (
          <button
            key={c.name + i}
            onClick={() => onTabChange(i)}
            className="relative flex-1 rounded-[6px] px-1 py-[3px] text-[8px] font-normal text-fan-textTertiary"
          >
            {isActive && (
              <motion.span
                layoutId="channel-tab-indicator"
                className="absolute inset-0 rounded-[6px] bg-fan-surface shadow-sm"
                transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              />
            )}
            <span
              className={`relative z-10 ${isActive ? 'text-[9px] font-semibold text-fan-textPrimary' : ''
                }`}
            >
              {c.name.length > 8 ? `${c.name.slice(0, 8)}...` : c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Channel fragment (header + members) ────────────────────────
function ChannelFragment({
  channel,
  currentUserId,
}: {
  channel: Channel;
  currentUserId: string;
}) {
  const sorted = useMemo(
    () => [...channel.members].sort((a, b) => b.seasonPoints - a.seasonPoints),
    [channel.members],
  );
  const maxPoints = sorted[0]?.seasonPoints ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col px-1 py-0.5">
      {/* Channel header */}
      <div className="flex items-center rounded-[8px] border-[0.5px] border-fan-borderActive bg-fan-primaryDim px-[10px] py-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-fan-primary">
          <span className="text-[10px] font-bold text-white">
            {channel.name ? channel.name[0].toUpperCase() : '?'}
          </span>
        </div>
        <div className="ml-2 min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-fan-textPrimary">
            {channel.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1 text-[9px] text-fan-textTertiary">
            <span>👥</span>
            <span>{channel.memberCount}</span>
            <span className="ml-2">🏆</span>
            <span>S{channel.season}</span>
            {channel.isAdmin && (
              <span className="ml-1.5 rounded-[8px] bg-fan-primaryMuted px-1 py-px text-[6px] font-semibold text-fan-primary">
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="h-1.5" />

      {/* Members list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="py-4 text-center text-[9px] text-fan-textTertiary/40">
            No members yet
          </p>
        ) : (
          sorted.map((m, i) => (
            <MemberCard
              key={m.userId}
              member={m}
              rank={i + 1}
              maxPoints={maxPoints}
              isYou={m.userId === currentUserId && currentUserId !== 'mock_user'}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Channel tab view (TabBarView equivalent, swipeable) ────────
function ChannelTabView({
  channels,
  activeTab,
  onTabChange,
  currentUserId,
  swipeEnabled = true,
}: {
  channels: Channel[];
  activeTab: number;
  onTabChange: (i: number) => void;
  currentUserId: string;
  swipeEnabled?: boolean;
}) {
  const shown = channels.slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <motion.div
        className="flex h-full"
        style={{ width: `${shown.length * 100}%` }}
        animate={{ x: `-${(activeTab * 100) / shown.length}%` }}
        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
        drag={swipeEnabled ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          const threshold = 60;
          if (info.offset.x < -threshold && activeTab < shown.length - 1) {
            onTabChange(activeTab + 1);
          } else if (info.offset.x > threshold && activeTab > 0) {
            onTabChange(activeTab - 1);
          }
        }}
      >
        {shown.map((c) => (
          <div
            key={c.name}
            className="h-full"
            style={{ width: `${100 / shown.length}%` }}
          >
            <ChannelFragment channel={c} currentUserId={currentUserId} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ── Balance card ───────────────────────────────────────────────
function BalanceCard({ balance, loading }: { balance: number; loading: boolean }) {
  return (
    <div className="flex items-center rounded-[10px] border-[0.5px] border-fan-borderActive bg-fan-surface p-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-fan-primaryDim">
        <span className="text-[14px] leading-none">💰</span>
      </div>
      <div className="ml-2.5 flex-1">
        <p className="text-[10px] text-fan-textTertiary">Balance</p>
        <p className="text-[14px] font-semibold text-fan-textPrimary">
          {loading ? 'Loading...' : `KES ${balance.toFixed(2)}`}
        </p>
      </div>
    </div>
  );
}

// ── Main sidebar ───────────────────────────────────────────────
export function WebSidebar() {
  const auth = useAuth() as ReturnType<typeof useAuth> & {
    logout?: () => void | Promise<void>;
    phone?: string;
  };
  const { username, userId, authToken } = auth;
  const phone = auth.phone ?? '';

  const isMock = !userId;

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{
    userId: string;
    username: string;
    phone: string;
    nickname: string;
    clubFan: string;
    countryFan: string;
    numberOfBets: number;
    balance: number;
  } | null>(null);
  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsAreMock, setChannelsAreMock] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editClub, setEditClub] = useState('');
  const [editCountry, setEditCountry] = useState('');

  // Load — mirrors _loadAllData / _loadMockData
  useEffect(() => {
    if (!userId) {
      // Signed out — use mock data
      setUserData({
        userId: 'mock_user',
        username: MOCK_PROFILE.username,
        phone: MOCK_PROFILE.phone,
        nickname: MOCK_PROFILE.nickname,
        clubFan: MOCK_PROFILE.clubFan,
        countryFan: MOCK_PROFILE.countryFan,
        numberOfBets: 24,
        balance: 0,
      });
      setChannels(MOCK_CHANNELS);
      setChannelsAreMock(true);
      setBalance(0);
      setBalanceLoading(false);
      setLoading(false);
      setChannelsLoading(false);
      setActiveTab(0);
      return;
    }

    // Signed in — fetch real data, fall back to mock channels if the
    // API returns nothing (or the fetch fails).
    setLoading(true);
    setChannelsLoading(true);
    setBalanceLoading(true);

    Promise.all([
      fetchUserProfile(userId, authToken),
      fetchUserChannels(userId, authToken),
      fetchBalance(userId, authToken),
    ]).then(([profile, chans, bal]) => {
      const usingMock = chans.length === 0;
      const finalChannels = usingMock ? MOCK_CHANNELS : chans;

      if (profile) {
        setUserData(profile);
        setEditNickname(profile.nickname);
        setEditClub(profile.clubFan);
        setEditCountry(profile.countryFan);
      } else {
        setUserData({
          userId,
          username: username ?? '',
          phone,
          nickname: '',
          clubFan: '',
          countryFan: '',
          numberOfBets: 0,
          balance: 0,
        });
      }

      setChannels(finalChannels);
      setChannelsAreMock(usingMock);
      setBalance(bal ?? 0);
      setLoading(false);
      setChannelsLoading(false);
      setBalanceLoading(false);
      setActiveTab(0);
    });
  }, [userId, authToken, username, phone]);

  const displayName = userData?.nickname || username || 'Guest';
  const displayUsername = userData?.username || username || 'guest_fan';
  const nickname = userData?.nickname ?? '';
  const clubFan = userData?.clubFan ?? '';
  const countryFan = userData?.countryFan ?? '';
  const phoneDisplay = userData?.phone ?? phone ?? '';

  async function handleSave() {
    if (!userId) return;
    setIsSaving(true);
    const ok = await saveProfileFields(
      userId,
      username ?? '',
      phone ?? '',
      {
        nickname: editNickname.trim(),
        clubFan: editClub.trim(),
        countryFan: editCountry.trim(),
      },
      balance,
      userData?.numberOfBets ?? 0,
      userData == null,
      authToken,
    );
    setIsSaving(false);
    if (ok && userData) {
      setUserData({
        ...userData,
        nickname: editNickname.trim(),
        clubFan: editClub.trim(),
        countryFan: editCountry.trim(),
      });
      setIsEditing(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      if (typeof auth.logout === 'function') await auth.logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  // Loading shell (mirrors Flutter loading Container)
  if (loading || channelsLoading) {
    return (
      <div className="hidden w-[280px] shrink-0 items-center justify-center bg-fan-surfaceElevated md:flex">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col bg-fan-surfaceElevated md:flex">
      {/* Header */}
      <div className="flex items-center px-4 pb-3 pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fan-primaryDim">
          <span className="text-[14px] font-bold text-fan-primary">
            {(displayName || '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="ml-2.5 min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-fan-textPrimary">
            {displayName}
          </p>
          <p className="truncate text-[10px] text-fan-textTertiary">
            @{displayUsername}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Top scrollable section */}
        <div className="min-h-0 flex-[0_1_auto] overflow-y-auto px-3 pb-0 pt-2">
          {!isMock && userId && (
            <div className="mb-2">
              <BalanceCard balance={balance} loading={balanceLoading} />
            </div>
          )}

          {isEditing ? (
            <>
              <div className="mb-3.5 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fan-primaryDim">
                  <span className="text-[20px] leading-none">👤</span>
                </div>
              </div>

              <EditField
                label="TEAM NICKNAME"
                value={editNickname}
                onChange={setEditNickname}
                placeholder="e.g., Red Devils, The Gunners"
                icon="🛡"
              />
              <div className="h-2.5" />
              <EditField
                label="FAVORITE CLUB"
                value={editClub}
                onChange={setEditClub}
                placeholder="Which club do you support?"
                icon="⚽"
              />
              <div className="h-2.5" />
              <EditField
                label="COUNTRY"
                value={editCountry}
                onChange={setEditCountry}
                placeholder="Which country you support?"
                icon="🏳"
              />
              <div className="h-4" />

              <div className="flex gap-2">
                <ActionButton
                  label="Cancel"
                  icon={<span>✕</span>}
                  primary={false}
                  onClick={() => setIsEditing(false)}
                />
                <ActionButton
                  label="Save"
                  icon={<span>💾</span>}
                  onClick={handleSave}
                  loading={isSaving}
                />
              </div>
            </>
          ) : (
            <>
              {isMock && <MockBanner />}

              <InfoRow icon="👤" label="Username" value={`@${displayUsername}`} />
              <div className="h-1.5" />
              <InfoRow
                icon="🛡"
                label="Team Nickname"
                value={nickname || 'Not set'}
              />
              <div className="h-1.5" />
              <InfoRow icon="⚽" label="Team/Club" value={clubFan || 'Not set'} />
              <div className="h-1.5" />
              <InfoRow
                icon="🏳"
                label="Country You Support"
                value={countryFan || 'Not set'}
              />
              <div className="h-1.5" />
              <InfoRow
                icon="📞"
                label="Phone"
                value={phoneDisplay || 'Not set'}
              />
              <div className="h-2.5" />

              {userId && !isMock ? (
                <div className="flex gap-2">
                  <ActionButton
                    label="Edit"
                    icon={<span>✎</span>}
                    onClick={() => setIsEditing(true)}
                  />
                  <ActionButton
                    label="Logout"
                    icon={<span>↪</span>}
                    primary={false}
                    onClick={handleLogout}
                    loading={isLoggingOut}
                  />
                </div>
              ) : (
                <ActionButton
                  label="Log In"
                  icon={<span>↪</span>}
                  onClick={() => (window.location.href = '/login')}
                />
              )}
            </>
          )}

          <div className="h-2" />
        </div>

        {/* Channels section — always renders now, since channels is never empty */}
        {userData && channels.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col px-3">
            <div className="h-1.5" />

            {/* Channels header */}
            <div className="flex items-center py-0.5">
              <span className="text-[14px] leading-none">👥</span>
              <span className="ml-1.5 text-[12px] font-semibold text-fan-textPrimary">
                {isMock || channelsAreMock ? 'Channels (preview)' : 'Channels'}
              </span>
              <span className="flex-1" />
              <span className="rounded-[10px] bg-fan-primary/15 px-1.5 py-px text-[10px] font-semibold text-fan-primary">
                {channels.length}
              </span>
            </div>
            <div className="h-0.5" />

            <ChannelTabBar
              channels={channels}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            <div className="h-0.5" />

            {/* Swipeable content — TabBarView equivalent */}
            <ChannelTabView
              channels={channels}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              currentUserId={userId ?? 'mock_user'}
              swipeEnabled={false}
            />

            <div className="h-1" />
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Inline edit field ──────────────────────────────────────────
function EditField({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold tracking-[1.2px] text-fan-textTertiary">
        {label}
      </span>
      <div className="mt-0.5 flex items-center rounded-[8px] border-[0.5px] border-fan-border bg-fan-surfaceSunken px-2.5 py-2">
        <span className="mr-2 text-[12px] leading-none">{icon}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[12px] text-fan-textPrimary outline-none placeholder:text-[10px] placeholder:text-fan-textTertiary"
        />
      </div>
    </div>
  );
}