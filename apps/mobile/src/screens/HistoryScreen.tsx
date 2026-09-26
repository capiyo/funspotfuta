// screens/HistoryScreen.tsx
//
// OVERHAUL.
//   - FlatList + onEndReached instead of ScrollView + map + "Load more"
//   - shared skeleton / empty states
//   - removed the block that invented fake fans (GoalMachine, FireStriker …)
//     to pad every card to three people. Cards now show who really voted,
//     pledged or commented, or say that nobody did.
//   - removed the dead onSubmitComment stub (see HistoryCard) — replaced
//     with a real (still-stubbed) handler now that HistoryCard's comment
//     box actually calls it instead of opening Chat
//   - removed the "Filter by league…" search input and its debounce/query
//     wiring per request; history now always loads unfiltered
//   - commentsOf() mocks two comments (with commentor names) per game
//     until real comments are wired up — same approach as ArenaScreen

import { useMemo, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchHistoryGames, HistoryGame, FAN_SPACING } from '@funspot/core';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '../modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { GUTTER, LIST_BOTTOM_INSET } from '@/theme/layout';
import { HistoryCard, HistoryCardData, VoterMini } from '@/components/HistoryCard';
import { AftermatchReviewModal } from '@/components/AftermatchModal';
import { EmptyState, PagingFooter, SkeletonRows } from '@/components/ui/ListsStates';
import { useHome } from './home/home-context';

const PAGE_SIZE = 20;

// ── Mock comments (until real comments are wired up) ───────────────────
// Same idea as ArenaScreen's commentsOf(): every game gets its own pair,
// picked deterministically from its id so a card doesn't reshuffle on
// re-fetch, but different games (almost always) show different lines.
const MOCK_COMMENTORS = [
  'Kevo', 'Aisha', 'Brian', 'Faith', 'Otieno', 'Wanjiru', 'Denis', 'Nadia', 'Mutiso', 'Cheryl',
];
const MOCK_COMMENTS = [
  'What a match that was',
  'Saw that result coming honestly',
  'Ref had a shocker today',
  'That comeback was unreal',
  'Told you they had this',
  'Rough one to watch as a fan',
  'Man of the match no debate',
  'Deserved the win in the end',
  'That second half was rough',
  'Book the final ticket already',
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h || 1;
}

function seededPick<T>(pool: T[], seed: string, n: number): T[] {
  let h = hashSeed(seed);
  const used = new Set<number>();
  const picks: T[] = [];
  while (picks.length < n && used.size < pool.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    let idx = h % pool.length;
    while (used.has(idx)) idx = (idx + 1) % pool.length;
    used.add(idx);
    picks.push(pool[idx]);
  }
  return picks;
}

function mockCommentsFor(gameId: string) {
  const names = seededPick(MOCK_COMMENTORS, gameId, 2);
  const lines = seededPick(MOCK_COMMENTS, gameId + '#lines', 2);
  return names.map((username, i) => ({ username, text: lines[i] }));
}

export default function HistoryScreen() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId, username, authToken, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const { activeChannelId } = useHome();

  const [reviewGame, setReviewGame] = useState<HistoryGame | null>(null);

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['history'],
      queryFn: ({ pageParam }) =>
        fetchHistoryGames({
          limit: PAGE_SIZE,
          skip: pageParam,
        }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
      placeholderData: keepPreviousData,
    });

  const games = useMemo(() => data?.pages.flat() ?? [], [data]);
  const cards = useMemo(() => games.map((g) => ({ g, card: toCardData(g) })), [games]);

  function openChat(g: HistoryGame) {
    if (!isLoggedIn) return requireLogin(() => openChat(g));
    const channelId = (g as any).channelId ?? activeChannelId ?? '';
    if (!channelId) return;
    navigation.navigate('Chat', { channelId, fixtureId: g.id });
  }

  function openResults(g: HistoryGame) {
    if (!isLoggedIn) return requireLogin(() => openResults(g));
    setReviewGame(g);
  }

  function handleLike(id: string) {
    if (!userId) return;
    // Stub — wire to your like endpoint when ready.
  }

  function handleSubmitComment(id: string, text: string) {
    if (!userId || !username) return;
    // Stub — HistoryCard clears the draft after calling this, so until a
    // comment endpoint is wired up for History, a typed comment is
    // accepted in the UI but not actually saved or sent anywhere yet.
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={cards}
        keyExtractor={({ g }) => g.id}
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_INSET }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isPending ? (
            <SkeletonRows colors={colors} />
          ) : (
            <EmptyState colors={colors} title="No history found" />
          )
        }
        ListFooterComponent={<PagingFooter colors={colors} loading={isFetchingNextPage} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        renderItem={({ item: { g, card } }) => (
          <HistoryCard
            data={card}
            onOpenResults={() => openResults(g)}
            onOpenChat={() => openChat(g)}
            onLike={() => handleLike(g.id)}
            onSubmitComment={handleSubmitComment}
          />
        )}
      />

      {reviewGame && activeChannelId && (
        <AftermatchReviewModal
          visible
          fixture={reviewGame as any}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          channelId={activeChannelId}
          isLoggedIn={!!isLoggedIn}
          onClose={() => setReviewGame(null)}
        />
      )}
    </View>
  );
}

function pickKindOf(selection: string | undefined): 'home' | 'away' | 'draw' {
  return selection === 'home_team' || selection === 'home'
    ? 'home'
    : selection === 'away_team' || selection === 'away'
      ? 'away'
      : 'draw';
}

/** Real people only: voters, else pledgers, else commenters. */
function buildPeople(g: HistoryGame): VoterMini[] {
  const pickLabelOf = (kind: 'home' | 'away' | 'draw') =>
    kind === 'home' ? g.homeTeam : kind === 'away' ? g.awayTeam : 'Draw';

  const voters =
    ((g as any).voters as
      | Array<{ id: string; name: string; selection?: string }>
      | undefined) ?? [];
  const pledges =
    ((g as any).pledges as
      | Array<{ userId?: string; userName?: string; selection?: string }>
      | undefined) ?? [];
  const commentsList =
    ((g as any).comments as
      | Array<{ id?: string; userId?: string; username?: string; selection?: string }>
      | undefined) ?? [];

  const people: VoterMini[] = [];

  for (const v of voters.slice(0, 3)) {
    const kind = pickKindOf(v.selection);
    people.push({ id: v.id, name: v.name, role: 'voted', pick: pickLabelOf(kind), pickKind: kind });
  }

  if (people.length === 0) {
    for (const p of pledges.slice(0, 3)) {
      const kind = pickKindOf(p.selection);
      people.push({
        id: p.userId ?? `pledge-${people.length}`,
        name: p.userName ?? 'Fan',
        role: 'pledged',
        pick: pickLabelOf(kind),
        pickKind: kind,
      });
    }
  }

  if (people.length === 0) {
    for (const c of commentsList.slice(0, 3)) {
      const kind = pickKindOf(c.selection);
      people.push({
        id: c.id ?? c.userId ?? `comment-${people.length}`,
        name: c.username ?? 'Anonymous',
        role: 'commented',
        pick: pickLabelOf(kind),
        pickKind: kind,
      });
    }
  }

  return people;
}

function timeAgoLabel(g: HistoryGame): string {
  const raw = (g as any).dateIso ?? (g as any).date;
  if (!raw) return '—';
  const then = new Date(raw).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Real comments if the game has any; otherwise two mock ones unique to this
// game, each with a commentor name. Tolerates { username, comment } or
// { userName, text } shapes for real data.
function commentsOf(g: HistoryGame) {
  const raw = ((g as any).comments ?? []) as any[];
  const real = raw
    .map((c) => ({
      username: c.username ?? c.userName ?? 'Fan',
      text: c.text ?? c.comment ?? '',
    }))
    .filter((c) => c.text);
  if (real.length) return real;
  return mockCommentsFor(g.id);
}

function toCardData(g: HistoryGame): HistoryCardData {
  const people = buildPeople(g);
  const comments = commentsOf(g);
  return {
    id: g.id,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: g.homeScore ?? 0,
    awayScore: g.awayScore ?? 0,
    timeAgo: timeAgoLabel(g),
    league: (g as any).league ?? undefined,
    people,
    voteCount: (g as any).votes ?? ((g as any).voters?.length || people.length),
    comments,
    latestComment: (g as any).latestComment ?? null,
    commentCount: (g as any).commentCount ?? comments.length,
    likesCount: (g as any).likesCount ?? 0,
  };
}

function createStyles(colors: ReturnType<typeof useFanColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
  });
}