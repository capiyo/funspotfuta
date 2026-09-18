// RN "Arena" tab — fixtures + channel chips + header menu.
//
// Adds the vote/pledge/sub-fixtures modal on top of the existing Arena
// layout. The modal is owned here (single instance) and opened by
// MatchCard's `onOpenVoteModal` prop, which fires when the user taps
// the votes pill or the voters row. Watch / chat still go through
// navigation as before — the modal is only for vote-related actions.

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronDown } from 'lucide-react-native';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getAllFixtures,
  getUserChannels,
  Channel,
  Fixture,
  FanColorPalette,
  FAN_SPACING,
  FAN_RADIUS,
  castVote,
  createBetWithVoteId,
  Voter,
  getOpenBets,
  getChannelBettors,
  getSubFixtures,
  submitSubFixtureVote,
} from '@funspot/core';
import { MatchCard } from '@/components/MatchCard';
import { ChannelCreationModal } from '@/components/ChannelCreationModal';
import { SwipeableVotePledgeModal } from '@/components/actionModal';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { RootStackParamList } from '@/navigation/RootNavigator';

// ── Service shims ──────────────────────────────────────────────
// The modal expects Promise-returning fetchers/executors so it stays
// decoupled from @funspot/core. These wrap the core exports so the
// modal's props line up with what ArenaScreen already has.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'https://clash-api-m5mr.onrender.com/api';

async function fetchVoters(fixtureId: string, authToken?: string | null) {
  const res = await fetch(
    `${API_BASE_URL}/actions/vote/fixture/${fixtureId}/voters`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.voters ?? []) as any[];
}

async function fetchPledges(
  channelId: string,
  fixtureId: string,
  authToken?: string | null,
) {
  const res = await fetch(
    `${API_BASE_URL}/actions/channel/${channelId}/${fixtureId}/pledges`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.pledges ?? []).map((p: any) => ({
    betId: p.bet_id ?? p._id ?? '',
    userId: p.user_id ?? p.userId ?? '',
    userName: p.user_name ?? p.userName ?? '',
    selection: p.selection ?? '',
    selectionDisplay:
      p.selection === 'home_team' || p.selection === 'home'
        ? 'Home'
        : p.selection === 'away_team' || p.selection === 'away'
          ? 'Away'
          : p.selection ?? '',
    amount: p.amount ?? 0,
    isOpen: p.status === 'open' || p.is_open === true,
  }));
}

async function fetchSubFixtures(fixtureId: string, authToken?: string | null) {
  const res = await fetch(`${API_BASE_URL}/sub_fixtures/markets/${fixtureId}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.markets ?? []) as any[];
}

async function fetchSubFixturePledges(
  marketId: string,
  fixtureId: string,
  authToken?: string | null,
) {
  const res = await fetch(
    `${API_BASE_URL}/sub_fixtures/bets/${marketId}?matchId=${fixtureId}`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.bets ?? []) as any[];
}

async function fetchBets(
  channelId: string,
  fixtureId: string,
  authToken?: string | null,
) {
  const res = await fetch(
    `${API_BASE_URL}/actions/channel/${channelId}/${fixtureId}/bettors`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.bettors ?? []) as any[];
}

async function fetchBalance(
  userId: string,
  authToken?: string | null,
  opts?: { forceRefresh?: boolean },
) {
  const res = await fetch(
    `${API_BASE_URL}/payment/balance/${userId}${opts?.forceRefresh ? `?_=${Date.now()}` : ''}`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return Number(data?.balance ?? data?.wallet_balance ?? 0);
}

async function topUp(amount: number, phone: string, purpose: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/payment/stk-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, phone, purpose }),
    });
    const data = await res.json();
    return {
      success: data?.success === true,
      newBalance: data?.new_balance,
      error: data?.message,
    };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Network error' };
  }
}

async function withdraw(amount: number, phone: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/payment/b2c`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, phone }),
    });
    const data = await res.json();
    return {
      success: data?.success === true,
      newBalance: data?.new_balance,
      error: data?.message,
    };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Network error' };
  }
}

async function getSavedPhone(kind: 'topup' | 'withdraw') {
  return null;
}
async function savePhone(kind: 'topup' | 'withdraw', phone: string) {
  return true;
}
async function getUserPhone() {
  return '';
}

async function placeSubFixturePledge(args: {
  fixtureId: string;
  marketId: string;
  starterId: string;
  starterName: string;
  selection: string;
  amount: number;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/sub_fixtures/sub-fixture/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: args.fixtureId,
        market_id: args.marketId,
        starter_id: args.starterId,
        starter_name: args.starterName,
        selection: args.selection,
        amount: args.amount,
      }),
    });
    const data = await res.json();
    return { success: data?.success === true, message: data?.message };
  } catch (e: any) {
    return { success: false, message: e?.message ?? 'Network error' };
  }
}

async function matchSubFixturePledge(args: {
  betId: string;
  matchId: string;
  marketId: string;
  finisherId: string;
  finisherName: string;
  selection: string;
  amount: number;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/sub_fixtures/bet/fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bet_id: args.betId,
        match_id: args.matchId,
        market_id: args.marketId,
        finisher_id: args.finisherId,
        finisher_name: args.finisherName,
        selection: args.selection,
        amount: args.amount,
      }),
    });
    const data = await res.json();
    return { success: data?.success === true, message: data?.message };
  } catch (e: any) {
    return { success: false, message: e?.message ?? 'Network error' };
  }
}

async function matchMainPledge(args: {
  betId: string;
  finisherId: string;
  finisherName: string;
  finisherSelection: 'home' | 'away';
  amount: number;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/actions/bet/fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bet_id: args.betId,
        finisher_id: args.finisherId,
        finisher_name: args.finisherName,
        finisher_selection: args.finisherSelection,
        amount: args.amount,
      }),
    });
    const data = await res.json();
    return { success: data?.success === true, message: data?.message };
  } catch (e: any) {
    return { success: false, message: e?.message ?? 'Network error' };
  }
}

// ── Screen ─────────────────────────────────────────────────────
type Filter = 'all' | 'live' | 'upcoming' | 'completed';

export default function ArenaScreen() {
  const colors = useFanColors();
  const styles = createStyles(colors);
  const { userId, authToken, username, isLoggedIn, logout } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [f, c] = await Promise.all([
      getAllFixtures(),
      userId && authToken
        ? getUserChannels(userId, authToken)
        : Promise.resolve([]),
    ]);
    setFixtures(f);
    setChannels(c);
    setActiveChannelId((prev) => prev ?? c[0]?.id);
    setLoading(false);
  }, [userId, authToken]);

  useEffect(() => {
    load();
  }, [load]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const filtered = fixtures.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'live') return f.isLive || f.status === 'live';
    if (filter === 'upcoming')
      return f.status === 'upcoming' || f.status === 'soon';
    if (filter === 'completed') return f.status === 'completed';
    return true;
  });

  return (
    <View style={styles.screen}>
      <AppHeader
        channel={activeChannel}
        onAddChannel={() => setMenuOpen(true)}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
      >
        {channels.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setActiveChannelId(c.id)}
            onLongPress={() => setMenuOpen(true)}
            style={[
              styles.chip,
              activeChannelId === c.id && {
                backgroundColor: colors.primaryDim,
              },
            ]}
          >
            <Text
              style={fanText(
                'tag',
                colors,
                activeChannelId === c.id
                  ? colors.primary
                  : colors.textSecondary,
              )}
            >
              {c.name}
            </Text>
          </Pressable>
        ))}
        <Pressable style={styles.chip} onPress={() => setShowCreateChannel(true)}>
          <Text style={fanText('tag', colors)}>+ NEW</Text>
        </Pressable>
        {activeChannel && (
          <Pressable
            style={styles.chip}
            onPress={() =>
              navigation.navigate('Chat', { channelId: activeChannelId })
            }
          >
            <Text style={fanText('tag', colors)}>💬 CHAT</Text>
          </Pressable>
        )}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filterRow}>
          {(['all', 'live', 'upcoming', 'completed'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                filter === f && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  fanText(
                    'caption',
                    colors,
                    filter === f ? colors.textInverse : colors.textTertiary,
                  ),
                  { textTransform: 'capitalize' },
                ]}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: FAN_SPACING.xxxl }}
          />
        ) : filtered.length === 0 ? (
          <Text
            style={[
              fanText('body', colors),
              { textAlign: 'center', marginTop: FAN_SPACING.xxxl },
            ]}
          >
            No fixtures right now — check back soon.
          </Text>
        ) : (
          filtered.map((fixture) => (
            <MatchCard
              key={fixture.id || fixture.matchId}
              fixture={fixture}
              channelId={activeChannelId}
              onOpenVoteModal={setModalFixture}
            />
          ))
        )}
      </ScrollView>

      {showCreateChannel && (
        <ChannelCreationModal
          onClose={() => {
            setShowCreateChannel(false);
            load();
          }}
        />
      )}

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <MenuItem
              label="Profile"
              onPress={() => navigation.navigate('Profile')}
              colors={colors}
              closeMenu={() => setMenuOpen(false)}
            />
            <MenuItem
              label="Comrades"
              onPress={() => navigation.navigate('Comrades')}
              colors={colors}
              closeMenu={() => setMenuOpen(false)}
            />
            <MenuItem
              label="Leaderboard"
              onPress={() => navigation.navigate('Leaderboard')}
              colors={colors}
              closeMenu={() => setMenuOpen(false)}
            />
            {activeChannelId && (
              <MenuItem
                label="Admin Dashboard"
                onPress={() =>
                  navigation.navigate('Admin', { channelId: activeChannelId })
                }
                colors={colors}
                closeMenu={() => setMenuOpen(false)}
              />
            )}
            <View
              style={{
                height: 1,
                backgroundColor: colors.border,
                marginVertical: FAN_SPACING.sm,
              }}
            />
            <MenuItem
              label="Logout"
              destructive
              onPress={() => logout()}
              colors={colors}
              closeMenu={() => setMenuOpen(false)}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Vote / pledge / sub-fixtures modal — single instance, opened by
          MatchCard's onOpenVoteModal prop. */}
      {modalFixture && (
        <SwipeableVotePledgeModal
          visible
          fixture={{
            id: modalFixture.id,
            matchId: modalFixture.matchId,
            homeTeam: modalFixture.homeTeam,
            awayTeam: modalFixture.awayTeam,
            league: modalFixture.league,
            isLive: modalFixture.isLive,
          }}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          isLoggedIn={!!isLoggedIn}
          hasUserVoted={
            (modalFixture.voters ?? []).some((v) => v.userId === userId)
          }
          userVoteSelection={
            (modalFixture.voters ?? []).find((v) => v.userId === userId)
              ?.selection
          }
          channelId={activeChannelId ?? ''}
          showPledgesTab
          showSubFixturesTab
          showBetsTab
          onClose={() => setModalFixture(null)}
          onVote={async (sel) => {
            if (!activeChannelId || !userId || !authToken) return false;
            const ok = await castVote({
              channelId: activeChannelId,
              fixtureId: modalFixture.matchId || modalFixture.id,
              userId,
              selection: sel === 'home' ? 'home_team' : 'away_team',
              authToken,
            });
            if (ok) {
              // Optimistically reflect the vote in the fixtures list so
              // the card shows "✓ Vote recorded" without a refetch.
              setFixtures((prev) =>
                prev.map((fx) => {
                  if (
                    fx.id !== modalFixture.id &&
                    fx.matchId !== modalFixture.matchId
                  ) {
                    return fx;
                  }
                  const newVoter: Voter = {
                    userId: userId!,
                    userName: username ?? '',
                    selection: sel === 'home' ? 'home_team' : 'away_team',
                    votedAt: new Date(),
                    isComrade: false,
                    isCorrect: false,
                    pointsAwarded: 0,
                  };
                  return {
                    ...fx,
                    voters: [...(fx.voters ?? []), newVoter],
                  };
                }),
              );
            }
            return ok;
          }}
          onPledge={async (sel, amount) => {
            if (!activeChannelId || !userId || !username) return false;
            const r = await createBetWithVoteId({
              fixtureId: modalFixture.matchId || modalFixture.id,
              starterId: userId,
              starterName: username,
              starterSelection:
                sel === 'home' ? 'home_team' : 'away_team',
              amount,
              channelId: activeChannelId,
              voteId: '',
              authToken: authToken ?? undefined,
            });
            return r?.success !== false;
          }}
          onShowJoinGroups={() => navigation.navigate('Profile')}
          fetchVoters={fetchVoters}
          fetchPledges={fetchPledges}
          fetchSubFixtures={fetchSubFixtures}
          fetchSubFixturePledges={fetchSubFixturePledges}
          fetchBets={fetchBets}
          fetchBalance={fetchBalance}
          topUp={topUp}
          withdraw={withdraw}
          getSavedPhone={getSavedPhone}
          savePhone={savePhone}
          getUserPhone={getUserPhone}
          placeSubFixturePledge={placeSubFixturePledge}
          matchSubFixturePledge={matchSubFixturePledge}
          matchMainPledge={matchMainPledge}
        />
      )}
    </View>
  );

  function MenuItem({
    label,
    onPress,
    destructive,
    colors,
    closeMenu,
  }: {
    label: string;
    onPress: () => void;
    destructive?: boolean;
    colors: FanColorPalette;
    closeMenu: () => void;
  }) {
    return (
      <Pressable
        onPress={() => {
          closeMenu();
          onPress();
        }}
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
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    chipRow: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: FAN_SPACING.base,
      paddingBottom: FAN_SPACING.md,
    },
    chip: {
      borderRadius: FAN_RADIUS.pill,
      paddingHorizontal: FAN_SPACING.base,
      paddingVertical: FAN_SPACING.sm,
      backgroundColor: colors.surfaceSunken,
      marginRight: FAN_SPACING.sm,
    },
    content: {
      padding: FAN_SPACING.base,
      paddingBottom: FAN_SPACING.xxxl,
    },
    filterRow: {
      flexDirection: 'row',
      gap: FAN_SPACING.md,
      marginBottom: FAN_SPACING.base,
    },
    filterChip: {
      borderRadius: FAN_RADIUS.pill,
      paddingHorizontal: FAN_SPACING.base,
      paddingVertical: FAN_SPACING.md,
      backgroundColor: colors.surfaceSunken,
    },
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'flex-end',
      paddingTop: 60,
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
  });
}