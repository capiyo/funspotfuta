// modals/HistoryModal.tsx
//
// HistoryScreen, wrapped as a modal — same card list, same pagination,
// same AftermatchReviewModal handoff, but presented as a bottom sheet
// with the app's standard modal chrome (handle bar / header / close).
//
// Ported from screens/HistoryScreen.tsx:
//   - FlatList + onEndReached instead of ScrollView + map
//   - shared skeleton / empty states
//   - commentsOf() mocks two comments per game
//   - keepPreviousData + isError branch so offline shows cached history
//
// Changes for modal presentation:
//   - <Modal> shell with backdrop press-to-close
//   - handle bar + header row (title "History" + close X)
//   - no useHomeList() / useHome() — a modal doesn't gate on activeTab,
//     and there's no overlay header to clear, so topInset is 0 and
//     scrollProps is not needed
//   - contentContainerStyle uses the modal's own padding instead of
//     topInset, and still reserves LIST_BOTTOM_INSET so the last card
//     clears the floating tab bar when the modal is dismissed

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Modal,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchHistoryGames, HistoryGame, FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from './Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { ICON, LIST_BOTTOM_INSET, PRESSED_OPACITY } from '@/theme/layout';
import {
  HistoryCard,
  HistoryCardData,
  VoterMini,
} from '@/components/HistoryCard';
import { AftermatchReviewModal } from '@/modals/AftermatchModal';
import {
  EmptyState,
  PagingFooter,
  SkeletonRows,
} from '@/components/ui/ListsStates';

const PAGE_SIZE = 20;

const MOCK_COMMENTORS = [
  'Kevo', 'Aisha', 'Brian', 'Faith', 'Otieno',
  'Wanjiru', 'Denis', 'Nadia', 'Mutiso', 'Cheryl',
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
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
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

export default function HistoryModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId, username, authToken, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();

  const [reviewGame, setReviewGame] = useState<HistoryGame | null>(null);

  const {
    data,
    isPending,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
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
    retry: 1,
    // Modal owns its own lifecycle — no activeTab gate. The query fires
    // when the modal mounts and is cached from then on.
    enabled: visible,
  });

  const games = useMemo(() => data?.pages.flat() ?? [], [data]);
  const cards = useMemo(
    () => games.map((g) => ({ g, card: toCardData(g) })),
    [games],
  );

  function openChat(g: HistoryGame) {
    if (!isLoggedIn) return requireLogin(() => openChat(g));
    const channelId = (g as any).channelId ?? '';
    if (!channelId) return;
    onClose();
    navigation.navigate('Chat', { channelId, fixtureId: g.id });
  }

  function openResults(g: HistoryGame) {
    if (!isLoggedIn) return requireLogin(() => openResults(g));
    setReviewGame(g);
  }

  function handleLike(id: string) {
    if (!userId) return;
  }

  function handleSubmitComment(id: string, text: string) {
    if (!userId || !username) return;
  }

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
          <Pressable style={styles.sheet} onPress={() => { }}>
            {/* Handle */}
            <View style={styles.handleWrap}>
              <View
                style={[styles.handle, { backgroundColor: colors.border }]}
              />
            </View>

            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={fanText('title', colors, colors.textPrimary)}>
                  History
                </Text>
                <Text
                  style={[
                    fanText('tag', colors, colors.textTertiary),
                    { marginTop: 1 },
                  ]}
                >
                  {cards.length > 0
                    ? `${cards.length} game${cards.length === 1 ? '' : 's'}`
                    : 'Completed matches'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: PRESSED_OPACITY },
                ]}
              >
                <X size={14} color={colors.textTertiary} />
              </Pressable>
            </View>

            {/* List */}
            <FlatList
              data={cards}
              keyExtractor={({ g }) => g.id}
              contentContainerStyle={{
                paddingHorizontal: FAN_SPACING.md,
                paddingBottom: LIST_BOTTOM_INSET,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                isPending ? (
                  <SkeletonRows colors={colors} />
                ) : isError ? (
                  <EmptyState
                    colors={colors}
                    title="You're offline"
                    hint="Pull down to retry once you're back online."
                  />
                ) : (
                  <EmptyState colors={colors} title="No history found" />
                )
              }
              ListFooterComponent={
                <PagingFooter colors={colors} loading={isFetchingNextPage} />
              }
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* AftermatchReviewModal — remains a sibling so it can stack above
          the History sheet, same pattern as AdminModal's confirm dialog. */}
      {reviewGame && (
        <AftermatchReviewModal
          visible
          fixture={reviewGame as any}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          channelId={(reviewGame as any).channelId ?? ''}
          isLoggedIn={!!isLoggedIn}
          onClose={() => setReviewGame(null)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers (unchanged from the screen)
// ═══════════════════════════════════════════════════════════════

function pickKindOf(
  selection: string | undefined,
): 'home' | 'away' | 'draw' {
  return selection === 'home_team' || selection === 'home'
    ? 'home'
    : selection === 'away_team' || selection === 'away'
      ? 'away'
      : 'draw';
}

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
      | Array<{
        id?: string;
        userId?: string;
        username?: string;
        selection?: string;
      }>
      | undefined) ?? [];

  const people: VoterMini[] = [];

  for (const v of voters.slice(0, 3)) {
    const kind = pickKindOf(v.selection);
    people.push({
      id: v.id,
      name: v.name,
      role: 'voted',
      pick: pickLabelOf(kind),
      pickKind: kind,
    });
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
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

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
    voteCount:
      (g as any).votes ?? ((g as any).voters?.length || people.length),
    comments,
    latestComment: (g as any).latestComment ?? null,
    commentCount: (g as any).commentCount ?? comments.length,
    likesCount: (g as any).likesCount ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════

function createStyles(colors: ReturnType<typeof useFanColors>) {
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
    handle: { width: 32, height: 3, borderRadius: 2 },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: FAN_SPACING.lg,
      paddingBottom: FAN_SPACING.md,
      gap: FAN_SPACING.md,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.inputSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}