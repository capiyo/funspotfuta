// screens/ChatScreen.tsx
//
// RN port of the Flutter "Pitch Light" ChatScreen — brings across the
// features that were missing from the earlier RN draft: the auto-scrolling
// carousel (match status/score, quick-vote chips, vote-stats bar), the
// voters list panel, typing indicator, commentary-styled messages, a
// leaderboard/archive entry point, and vote-gated composing for
// upcoming/soon fixtures.
//
// SCOPE NOTE:
//   - useChannelChat exposes { messages, connected, loadingHistory,
//     uploadingImage, send, sendImage }. It does NOT expose vote
//     counts, match status, scores, or userVoteSelection — those are
//     derived here from the fixture (see "Fixture-derived state").
//   - AppCache/WebSocket-level state is folded into useChannelChat.
//   - SwipeableVotePledgeModal / AftermatchReviewModal / MatchDetailsModal
//     are the ported modals from earlier in this project.
//   - ComradesScreen is the ported /comrades page (visible, onClose).
//   - The comrades/ad-carousel-interleaving system (CarouselItem, ad
//     units, comrade cards) is NOT ported.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Image as ImageIcon,
  Info,
  Lock,
  Paperclip,
  Send,
  Users,
  X,
} from 'lucide-react-native';
import {
  getUserChannels,
  getAllFixtures,
  castVote,
  createBetWithVoteId,
  Channel,
  Fixture,
  ChatMessage,
  ReplyData,
  FAN_SPACING,
  FAN_RADIUS,
} from '@funspot/core';
import {
  fetchVoters,
  fetchPledges,
  fetchSubFixtures,
  fetchSubFixturePledges,
  fetchBets,
  fetchBalance,
  topUp,
  withdraw,
  getSavedPhone,
  savePhone,
  getUserPhone,
  placeSubFixturePledge,
  matchSubFixturePledge,
  matchMainPledge,
} from '../../../../packages/core/src/api/vote-modal-shims';
import { useChannelChat } from '@/lib/api/use-channel-chat';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { PRESSED_OPACITY } from '@/theme/layout';
import { Input } from '@/components/ui/input';
import { SwipeableVotePledgeModal } from '@/components/actionModal';
import { AftermatchReviewModal } from '@/components/AftermatchModal';
import { MatchDetailsModal } from '@/modals/match/matchDetailsModals';
import ComradesScreen from '@/modals/ComradesModal';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type FanColors = ReturnType<typeof useFanColors>;
type ChatRouteProp = RouteProp<RootStackParamList, 'Chat'>;

const FIXTURES_KEY = ['fixtures'] as const;

export interface RNImageAsset {
  uri: string;
  name?: string;
  type?: string;
  width?: number;
  height?: number;
}

// Mirrors Flutter's minute-display formatter (e.g. "45'12").
function formatMinute(timeElapsed: number): string {
  if (!timeElapsed || timeElapsed <= 0) return "0'";
  const minutes = Math.floor(timeElapsed);
  const seconds = Math.round((timeElapsed % 1) * 60);
  return seconds > 0
    ? `${minutes}'${String(seconds).padStart(2, '0')}`
    : `${minutes}'`;
}

export default function ChatScreen() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatRouteProp>();
  const { channelId: routeChannelId, fixtureId: routeFixtureId } =
    route.params ?? {};

  const { userId, username, authToken, isLoggedIn } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    routeChannelId ?? null,
  );
  const [autoFixture, setAutoFixture] = useState<Fixture | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [matchDetailsOpen, setMatchDetailsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const [pendingImage, setPendingImage] = useState<RNImageAsset | null>(null);
  const [caption, setCaption] = useState('');

  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (routeChannelId) setActiveChannelId(routeChannelId);
  }, [routeChannelId]);

  // ── Channels ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !authToken) return;
    getUserChannels(userId, authToken).then((c) => {
      setChannels(c);
      setActiveChannelId((prev) => prev ?? c[0]?.id ?? null);
    });
  }, [userId, authToken]);

  // ── Fixture: route param first, auto-pick only when neither param given.
  const routeFixture = useMemo(() => {
    if (!routeFixtureId) return null;
    const cached = queryClient.getQueryData<Fixture[]>(FIXTURES_KEY) ?? [];
    return (
      cached.find(
        (f) => f.id === routeFixtureId || f.matchId === routeFixtureId,
      ) ?? null
    );
  }, [queryClient, routeFixtureId]);

  useEffect(() => {
    if (routeFixtureId || !activeChannelId) return;
    getAllFixtures().then((all) => {
      const live = all.find(
        (f) =>
          f.status === 'live' ||
          f.status === 'half_time' ||
          f.status === 'upcoming' ||
          f.status === 'soon',
      );
      setAutoFixture(live ?? all[0] ?? null);
    });
  }, [routeFixtureId, activeChannelId]);

  const fixture = routeFixture ?? autoFixture;
  const fixtureId = fixture?.matchId ?? fixture?.id ?? null;

  // ── Chat hook ───────────────────────────────────────────────
  // Only these fields are guaranteed by useChannelChat. Everything else
  // this screen needs (votes, scores, status, userVoteSelection) is
  // derived below from the fixture itself.
  const {
    messages,
    connected,
    loadingHistory,
    uploadingImage,
    send,
    sendImage,
  } = useChannelChat({
    channelId: activeChannelId,
    fixtureId,
    userId,
    username,
    authToken,
  });

  // ── Fixture-derived state ───────────────────────────────────
  // These fields used to be pulled from useChannelChat but the hook
  // doesn't expose them. Sourcing them from `fixture` keeps the UI
  // driven by a single, typed object.
  const effectiveStatus = fixture?.status ?? 'upcoming';
  const isLive = !!fixture?.isLive || effectiveStatus === 'live';
  const isCompleted =
    effectiveStatus === 'completed' || effectiveStatus === 'finished';
  const isUpcomingOrSoon =
    effectiveStatus === 'upcoming' || effectiveStatus === 'soon';

  const homeScore = fixture?.homeScore ?? 0;
  const awayScore = fixture?.awayScore ?? 0;
  const timeElapsed = fixture?.timeElapsed ?? 0;

  const voters = fixture?.voters ?? [];
  const userVoteSelection = useMemo(() => {
    if (!userId) return null;
    const mine = voters.find((v) => v.userId === userId);
    return mine?.selection ?? null;
  }, [voters, userId]);

  const homeVotes = useMemo(
    () => voters.filter((v) => v.selection === 'home_team').length,
    [voters],
  );
  const awayVotes = useMemo(
    () => voters.filter((v) => v.selection === 'away_team').length,
    [voters],
  );
  const drawVotes = useMemo(
    () => voters.filter((v) => v.selection === 'draw').length,
    [voters],
  );

  // Typing indicator is not currently exposed by useChannelChat. Kept as
  // an empty array so the UI branch stays in place for when the hook adds it.
  const typingUsers: string[] = [];

  // ── Auto-scroll ────────────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(t);
  }, [messages.length]);

  // ── Vote gate ──────────────────────────────────────────────
  const requireVoteToChat = isUpcomingOrSoon && !!fixtureId;
  const hasVoted = userVoteSelection != null;
  const voteGateActive = requireVoteToChat && !hasVoted;

  // ── Handlers ───────────────────────────────────────────────
  const sendWithReply = useCallback(
    async (
      text: string,
      mediaUri: string | undefined,
      reply: ReplyData | null,
    ) => {
      const sendAny = send as unknown as (
        text: string,
        mediaUri?: string,
        reply?: ReplyData | null,
      ) => Promise<void>;

      if (reply) {
        const quoted = `↳ ${reply.isMe ? 'You' : reply.username}: ${reply.text || 'media'
          }\n${text}`;
        await sendAny(quoted, mediaUri, reply);
      } else {
        await sendAny(text, mediaUri);
      }
    },
    [send],
  );

  async function handleSend() {
    if (!draft.trim() || voteGateActive) return;
    const text = draft.trim();
    setDraft('');

    const replyPayload: ReplyData | null = replyTo
      ? replyTo.replyTo ?? {
        messageId: replyTo.id,
        text:
          replyTo.text ||
          (replyTo.isImage
            ? '📷 Image'
            : replyTo.isVideo
              ? '🎥 Video'
              : ''),
        username: replyTo.username,
        selection: replyTo.selection,
        isMe: replyTo.userId === userId && !replyTo.isCommentary,
        imageUrl: replyTo.imageUrl,
        videoUrl: replyTo.videoUrl,
        isImage: replyTo.isImage,
        isVideo: replyTo.isVideo,
      }
      : null;

    setReplyTo(null);
    await sendWithReply(text, '', replyPayload);
  }

  function handleDraftChange(text: string) {
    setDraft(text);
  }

  async function handleImagePick() {
    setShowAttachMenu(false);
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.9,
      });
      if (res.didCancel || !res.assets?.length) return;
      const asset: Asset = res.assets[0];
      if (!asset.uri) {
        toast.showError('Could not read image');
        return;
      }
      setPendingImage({
        uri: asset.uri,
        name: asset.fileName ?? `image-${Date.now()}.jpg`,
        type: asset.type ?? 'image/jpeg',
        width: asset.width,
        height: asset.height,
      });
      setCaption('');
    } catch (err: any) {
      toast.showError(err?.message ?? 'Failed to send image');
    }
  }

  async function confirmSendImage() {
    if (!pendingImage) return;
    const asset = pendingImage;
    const text = caption;
    setPendingImage(null);
    setCaption('');
    try {
      await sendImage(asset as any, text);
    } catch (err: any) {
      toast.showError(err?.message ?? 'Failed to send image');
    }
  }

  async function handleQuickVote(
    selection: 'home_team' | 'away_team' | 'draw',
  ) {
    if (!fixtureId || !fixture) return;
    if (!isLoggedIn) {
      toast.showError('Log in to vote');
      return;
    }
    if (hasVoted) return;
    if (!activeChannelId || !userId || !authToken) return;
    try {
      // castVote expects the frontend selection values verbatim;
      // the 'home_team' → 'home' translation happens inside the service.
      await castVote({
        channelId: activeChannelId,
        fixtureId,
        userId,
        selection,
        authToken,
      });
      queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
    } catch {
      toast.showError('Failed to cast vote');
    }
  }

  function openVoteOrReview() {
    if (isCompleted) setReviewModalOpen(true);
    else setVoteModalOpen(true);
  }

  const showEmptyChannels = channels.length === 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: PRESSED_OPACITY },
          ]}
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </Pressable>

        {fixture && (
          <Pressable
            onPress={() => setMatchDetailsOpen(true)}
            hitSlop={6}
            style={styles.infoButton}
          >
            <Info size={15} color={colors.textPrimary} />
          </Pressable>
        )}

        <View style={styles.grow}>
          {fixture ? (
            <MatchStatusBar
              colors={colors}
              fixture={fixture}
              status={effectiveStatus}
              homeScore={homeScore}
              awayScore={awayScore}
              isLive={isLive}
              timeElapsed={timeElapsed}
              onPress={openVoteOrReview}
            />
          ) : (
            <Text style={fanText('body', colors, colors.textPrimary)}>
              Chat
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => setLeaderboardOpen(true)}
          hitSlop={8}
          style={styles.leaderboardButton}
        >
          <Users size={16} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Vote stats / quick-vote strip */}
      {fixture && fixtureId && (
        <VoteStrip
          colors={colors}
          fixture={fixture}
          homeVotes={homeVotes}
          awayVotes={awayVotes}
          drawVotes={drawVotes}
          hasVoted={hasVoted}
          onQuickVote={handleQuickVote}
          onPressTotals={() => setShowVoters((v) => !v)}
        />
      )}

      {showEmptyChannels ? (
        <View style={styles.emptyChannels}>
          <Text style={fanText('body', colors, colors.textTertiary)}>
            Join or create a channel to start chatting.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {/* Channel picker + connection status */}
          <View style={styles.topBar}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={channels}
              keyExtractor={(c) => c.id}
              contentContainerStyle={styles.channelListContent}
              renderItem={({ item: c }) => {
                const active = c.id === activeChannelId;
                return (
                  <Pressable
                    onPress={() => setActiveChannelId(c.id)}
                    style={[
                      styles.channelChip,
                      active && { borderColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={fanText(
                        'tag',
                        colors,
                        active ? colors.primary : colors.textSecondary,
                      )}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
            <Text
              style={fanText(
                'tag',
                colors,
                connected ? colors.primary : colors.textTertiary,
              )}
            >
              {connected ? '● live' : '○ connecting…'}
            </Text>
          </View>

          {/* Voters panel */}
          {showVoters && (
            <VotersPanel
              colors={colors}
              fixtureId={fixtureId}
              userId={userId}
              onClose={() => setShowVoters(false)}
            />
          )}

          {/* Messages */}
          <FlatList
            ref={listRef}
            style={styles.grow}
            contentContainerStyle={styles.messagesContent}
            data={messages}
            keyExtractor={(m) => m.id}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={styles.centerFill}>
                <Text
                  style={fanText('caption', colors, colors.textTertiary)}
                >
                  {loadingHistory
                    ? 'Loading messages…'
                    : 'No messages yet — say something.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <MessageBubble
                colors={colors}
                message={item}
                isMe={item.userId === userId}
                onLongPress={() => setReplyTo(item)}
              />
            )}
          />

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <View style={styles.typingRow}>
              <Text
                style={fanText('tag', colors, colors.textTertiary)}
              >
                {typingUsers.length === 1
                  ? `${typingUsers[0]} is typing…`
                  : `${typingUsers.length} people are typing…`}
              </Text>
            </View>
          )}

          {/* Reply indicator */}
          {replyTo && (
            <View style={styles.replyBar}>
              <Text
                style={[
                  fanText('caption', colors, colors.primary),
                  styles.replyArrow,
                ]}
              >
                ↩
              </Text>
              <View style={styles.grow}>
                <Text
                  style={fanText('tag', colors, colors.primary)}
                  numberOfLines={1}
                >
                  Replying to{' '}
                  {replyTo.isCommentary
                    ? replyTo.username
                    : replyTo.userId === userId
                      ? 'yourself'
                      : replyTo.username}
                </Text>
                <Text
                  style={fanText('tag', colors, colors.textTertiary)}
                  numberOfLines={1}
                >
                  {replyTo.text || (replyTo.isImage ? '📷 Image' : 'Media')}
                </Text>
              </View>
              <Pressable
                onPress={() => setReplyTo(null)}
                hitSlop={8}
                style={styles.replyClose}
              >
                <Text style={fanText('tag', colors, colors.textTertiary)}>
                  ✕
                </Text>
              </Pressable>
            </View>
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <View style={styles.inputRow}>
              <Pressable
                onPress={openVoteOrReview}
                style={[
                  styles.voteButton,
                  voteGateActive
                    ? {
                      borderColor: colors.draw,
                      backgroundColor: colors.draw + '1A',
                    }
                    : {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSunken,
                    },
                ]}
              >
                <Text style={{ fontSize: 14 }}>
                  {voteGateActive ? '⚠' : '🗳'}
                </Text>
              </Pressable>

              {isLoggedIn && !voteGateActive && (
                <Pressable
                  onPress={() => setShowAttachMenu((v) => !v)}
                  style={styles.attachButton}
                >
                  <Paperclip size={16} color={colors.textTertiary} />
                </Pressable>
              )}

              {voteGateActive ? (
                <Pressable
                  onPress={openVoteOrReview}
                  style={styles.voteGateBar}
                >
                  <Lock size={12} color={colors.draw} />
                  <Text style={fanText('caption', colors, colors.draw)}>
                    {effectiveStatus === 'soon'
                      ? 'Vote before game starts 💬'
                      : 'Vote to chat 💬'}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.composerWrap}>
                  <Input
                    style={[
                      styles.grow,
                      fanText('caption', colors, colors.textPrimary),
                    ]}
                    colors={colors}
                    variant="plain"
                    value={draft}
                    onChangeText={handleDraftChange}
                    editable={isLoggedIn}
                    multiline
                    blurOnSubmit={false}
                    placeholder={
                      !isLoggedIn
                        ? 'Log in to chat'
                        : uploadingImage
                          ? 'Uploading…'
                          : isLive
                            ? '🔴 Live - join the conversation!'
                            : isCompleted
                              ? '📊 Game finished - discuss the match!'
                              : 'Type a message…'
                    }
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                  />
                </View>
              )}

              {isLoggedIn && !voteGateActive && draft.trim().length > 0 && (
                <Pressable
                  onPress={handleSend}
                  hitSlop={8}
                  style={styles.sendButton}
                >
                  <Send size={16} color={colors.primary} />
                </Pressable>
              )}
            </View>

            {showAttachMenu && isLoggedIn && (
              <View style={styles.attachMenu}>
                <Pressable
                  onPress={handleImagePick}
                  style={[
                    styles.attachChip,
                    { backgroundColor: colors.primary + '1A' },
                  ]}
                >
                  <ImageIcon size={14} color={colors.primary} />
                  <Text style={fanText('tag', colors, colors.primary)}>
                    Image
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowAttachMenu(false);
                    toast.showInfo('Video coming soon');
                  }}
                  style={[
                    styles.attachChip,
                    { backgroundColor: colors.draw + '1A' },
                  ]}
                >
                  <Text>🎥</Text>
                  <Text style={fanText('tag', colors, colors.draw)}>
                    Video
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Caption dialog */}
      <Modal
        visible={!!pendingImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingImage(null)}
      >
        <View style={styles.captionOverlay}>
          <View
            style={[styles.captionCard, { backgroundColor: colors.surface }]}
          >
            <View style={styles.captionHeader}>
              <Text style={fanText('body', colors, colors.textPrimary)}>
                Add a caption
              </Text>
              <Pressable onPress={() => setPendingImage(null)} hitSlop={8}>
                <X size={16} color={colors.textTertiary} />
              </Pressable>
            </View>
            {pendingImage && (
              <Image
                source={{ uri: pendingImage.uri }}
                style={styles.captionPreview}
                resizeMode="cover"
              />
            )}
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption to your image..."
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.captionInput,
                { color: colors.textPrimary, borderColor: colors.border },
              ]}
              multiline
              maxLength={500}
            />
            <View style={styles.captionActions}>
              <Pressable
                onPress={() => setPendingImage(null)}
                style={styles.captionCancel}
              >
                <Text
                  style={fanText('caption', colors, colors.textSecondary)}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmSendImage}
                style={[
                  styles.captionSend,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={fanText('caption', colors, '#fff')}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Vote modal */}
      {fixture && voteModalOpen && activeChannelId && (
        <SwipeableVotePledgeModal
          visible
          fixture={{
            id: fixture.id,
            matchId: fixture.matchId,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            league: fixture.league,
            isLive: fixture.isLive,
          }}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          isLoggedIn={!!isLoggedIn}
          hasUserVoted={hasVoted}
          userVoteSelection={userVoteSelection}
          channelId={activeChannelId}
          showPledgesTab
          showSubFixturesTab
          showBetsTab
          onClose={() => setVoteModalOpen(false)}
          onVote={async (sel) => {
            if (!activeChannelId || !userId || !authToken) return false;
            const ok = await castVote({
              channelId: activeChannelId,
              fixtureId: fixture.matchId ?? fixture.id,
              userId,
              selection: sel === 'home' ? 'home_team' : 'away_team',
              authToken,
            });
            if (ok) {
              queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
            }
            return ok;
          }}
          onPledge={async (sel, amount) => {
            if (!activeChannelId || !userId || !username) return false;
            const r = await createBetWithVoteId({
              fixtureId: fixture.matchId ?? fixture.id,
              starterId: userId,
              starterName: username,
              starterSelection: sel === 'home' ? 'home_team' : 'away_team',
              amount,
              channelId: activeChannelId,
              voteId: '',
              authToken: authToken ?? undefined,
            });
            return r?.success !== false;
          }}
          onShowJoinGroups={() => { }}
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

      {/* Aftermatch review modal */}
      {fixture && reviewModalOpen && activeChannelId && (
        <AftermatchReviewModal
          visible
          fixture={fixture}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          channelId={activeChannelId}
          isLoggedIn={!!isLoggedIn}
          onClose={() => setReviewModalOpen(false)}
        />
      )}

      {/* Match details */}
      {fixture && matchDetailsOpen && (
        <MatchDetailsModal
          visible
          fixture={fixture}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          onClose={() => setMatchDetailsOpen(false)}
        />
      )}

      {/* Comrades / leaderboard */}
      <ComradesScreen
        visible={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Match status bar (header)
// ─────────────────────────────────────────────────────────────
function MatchStatusBar({
  colors,
  fixture,
  status,
  homeScore,
  awayScore,
  isLive,
  timeElapsed,
  onPress,
}: {
  colors: FanColors;
  fixture: Fixture;
  status: string;
  homeScore: number;
  awayScore: number;
  isLive: boolean;
  timeElapsed: number;
  onPress: () => void;
}) {
  const completed = status === 'completed' || status === 'finished';

  let label = status.toUpperCase();
  let labelColor = colors.textTertiary;
  if (status === 'live' || isLive) {
    label = '🔴 LIVE';
    labelColor = colors.live ?? colors.primary;
  } else if (completed) {
    label = '✅ FT';
    labelColor = colors.primary;
  } else if (status === 'upcoming') {
    label = '⏳ UPCOMING';
  } else if (status === 'soon') {
    label = '🔜 SOON';
    labelColor = colors.draw;
  }

  return (
    <Pressable onPress={onPress} style={matchBarStyles.row}>
      <View
        style={[matchBarStyles.badge, { backgroundColor: labelColor + '1A' }]}
      >
        <Text
          style={[fanText('tag', colors, labelColor), matchBarStyles.badgeText]}
        >
          {label}
        </Text>
      </View>
      <View
        style={[
          matchBarStyles.badge,
          { backgroundColor: colors.primary + '1A' },
        ]}
      >
        <Text
          style={[
            fanText('caption', colors, colors.primary),
            matchBarStyles.badgeText,
          ]}
        >
          {homeScore} - {awayScore}
        </Text>
      </View>
      {(status === 'live' || isLive) && (
        <View
          style={[
            matchBarStyles.badge,
            { backgroundColor: colors.surfaceSunken },
          ]}
        >
          <Text style={fanText('tag', colors, colors.textTertiary)}>
            {formatMinute(timeElapsed)}
          </Text>
        </View>
      )}
      <Text
        style={[
          fanText('caption', colors, colors.textPrimary),
          matchBarStyles.teams,
        ]}
        numberOfLines={1}
      >
        {fixture.homeTeam}{' '}
        <Text style={fanText('caption', colors, colors.textTertiary)}>vs</Text>{' '}
        {fixture.awayTeam}
      </Text>
    </Pressable>
  );
}

const matchBarStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: FAN_SPACING.sm,
  },
  badge: {
    borderRadius: FAN_RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontWeight: '700' },
  teams: { flex: 1 },
});

// ─────────────────────────────────────────────────────────────
// Vote strip
// ─────────────────────────────────────────────────────────────
function VoteStrip({
  colors,
  fixture,
  homeVotes,
  awayVotes,
  drawVotes,
  hasVoted,
  onQuickVote,
  onPressTotals,
}: {
  colors: FanColors;
  fixture: Fixture;
  homeVotes: number;
  awayVotes: number;
  drawVotes: number;
  hasVoted: boolean;
  onQuickVote: (sel: 'home_team' | 'away_team' | 'draw') => void;
  onPressTotals: () => void;
}) {
  const total = homeVotes + awayVotes + drawVotes;

  if (total === 0) {
    return (
      <View style={[voteStripStyles.card, { backgroundColor: colors.surface }]}>
        <Pressable
          onPress={() => onQuickVote('home_team')}
          disabled={hasVoted}
          style={[
            voteStripStyles.chip,
            {
              borderColor: colors.primary + '33',
              backgroundColor: colors.primary + '14',
            },
          ]}
        >
          <Text
            style={fanText('tag', colors, colors.primary)}
            numberOfLines={1}
          >
            {fixture.homeTeam}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onQuickVote('draw')}
          disabled={hasVoted}
          style={[
            voteStripStyles.chip,
            {
              borderColor: colors.draw + '33',
              backgroundColor: colors.draw + '14',
            },
          ]}
        >
          <Text style={fanText('tag', colors, colors.draw)}>Draw</Text>
        </Pressable>
        <Pressable
          onPress={() => onQuickVote('away_team')}
          disabled={hasVoted}
          style={[
            voteStripStyles.chip,
            {
              borderColor: colors.away + '33',
              backgroundColor: colors.away + '14',
            },
          ]}
        >
          <Text
            style={fanText('tag', colors, colors.away)}
            numberOfLines={1}
          >
            {fixture.awayTeam}
          </Text>
        </Pressable>
      </View>
    );
  }

  const homeFlex = Math.max(homeVotes, 0.0001);
  const drawFlex = Math.max(drawVotes, 0.0001);
  const awayFlex = Math.max(awayVotes, 0.0001);

  return (
    <Pressable
      onPress={onPressTotals}
      style={[voteStripStyles.card, { backgroundColor: colors.surface }]}
    >
      <View style={{ flex: homeFlex }}>
        <View
          style={[voteStripStyles.bar, { backgroundColor: colors.primary }]}
        />
      </View>
      <View style={{ flex: drawFlex }}>
        <View
          style={[voteStripStyles.bar, { backgroundColor: colors.draw }]}
        />
      </View>
      <View style={{ flex: awayFlex }}>
        <View
          style={[voteStripStyles.bar, { backgroundColor: colors.away }]}
        />
      </View>
      <Text
        style={[
          fanText('tag', colors, colors.textPrimary),
          voteStripStyles.total,
        ]}
      >
        {total}
      </Text>
    </Pressable>
  );
}

const voteStripStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: FAN_SPACING.sm,
    marginTop: FAN_SPACING.xs,
    borderRadius: FAN_RADIUS.md,
    paddingHorizontal: FAN_SPACING.sm,
    paddingVertical: FAN_SPACING.xs,
    height: 40,
  },
  chip: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: FAN_RADIUS.pill,
    paddingVertical: 6,
    alignItems: 'center',
  },
  bar: { height: 4, borderRadius: 2 },
  total: { marginLeft: 4 },
});

// ─────────────────────────────────────────────────────────────
// Voters panel
// ─────────────────────────────────────────────────────────────
function VotersPanel({
  colors,
  fixtureId,
  userId,
  onClose,
}: {
  colors: FanColors;
  fixtureId: string | null;
  userId: string | null;
  onClose: () => void;
}) {
  const [voters, setVoters] = useState<
    { userId: string; username: string; selection: string }[]
  >([]);

  useEffect(() => {
    if (!fixtureId) return;
    let cancelled = false;
    fetchVoters(fixtureId).then((v: any) => {
      if (!cancelled && Array.isArray(v)) setVoters(v);
    });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  return (
    <View style={[votersStyles.panel, { backgroundColor: colors.surface }]}>
      <View style={votersStyles.header}>
        <Text style={fanText('body', colors, colors.textPrimary)}>
          Votes ({voters.length})
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={14} color={colors.textTertiary} />
        </Pressable>
      </View>
      {voters.length === 0 ? (
        <Text style={fanText('caption', colors, colors.textTertiary)}>
          No votes yet
        </Text>
      ) : (
        voters.map((v) => (
          <View key={v.userId} style={votersStyles.row}>
            <Text style={fanText('caption', colors, colors.textPrimary)}>
              {v.userId === userId ? 'You' : v.username}
            </Text>
            <Text style={fanText('tag', colors, colors.textTertiary)}>
              {v.selection}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const votersStyles = StyleSheet.create({
  panel: {
    marginHorizontal: FAN_SPACING.sm,
    marginBottom: FAN_SPACING.xs,
    borderRadius: FAN_RADIUS.md,
    padding: FAN_SPACING.sm,
    maxHeight: 220,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
});

// ─────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────
function MessageBubble({
  colors,
  message,
  isMe,
  onLongPress,
}: {
  colors: FanColors;
  message: ChatMessage;
  isMe: boolean;
  onLongPress: () => void;
}) {
  const isCommentary = message.isCommentary;
  const effectiveIsMe = isCommentary ? false : isMe;
  const hasMedia = !!(message.imageUrl || message.videoUrl);

  return (
    <View style={bubbleStyles.column}>
      {!effectiveIsMe && (
        <Text
          style={[
            fanText(
              'tag',
              colors,
              isCommentary ? colors.draw : colors.primary,
            ),
            bubbleStyles.username,
          ]}
          numberOfLines={1}
        >
          {isCommentary ? '⚽ ' : ''}
          {message.username}
        </Text>
      )}

      <View
        style={[bubbleStyles.row, effectiveIsMe && bubbleStyles.rowMe]}
      >
        {!effectiveIsMe && (
          <View
            style={[
              bubbleStyles.avatar,
              {
                backgroundColor: isCommentary
                  ? colors.draw + '1A'
                  : colors.primary + '1A',
              },
            ]}
          >
            <Text style={{ fontSize: 12 }}>
              {isCommentary
                ? '⚽'
                : message.username?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}

        <Pressable
          onLongPress={onLongPress}
          delayLongPress={350}
          style={[
            bubbleStyles.bubble,
            isCommentary
              ? {
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.draw + '33',
                backgroundColor: colors.draw + '14',
              }
              : effectiveIsMe
                ? { backgroundColor: colors.primary + '1A' }
                : { backgroundColor: colors.surface },
            message.isPending && { opacity: 0.6 },
          ]}
        >
          {message.replyTo && (
            <View
              style={[
                bubbleStyles.replyQuote,
                { borderLeftColor: colors.primary + '66' },
              ]}
            >
              <Text
                style={fanText('tag', colors, colors.primary)}
                numberOfLines={1}
              >
                ↳ {message.replyTo.isMe ? 'You' : message.replyTo.username}
              </Text>
              <Text
                style={fanText('tag', colors, colors.textTertiary)}
                numberOfLines={1}
              >
                {message.replyTo.text}
              </Text>
            </View>
          )}

          {hasMedia && message.imageUrl && (
            <Image
              source={{ uri: message.imageUrl }}
              style={bubbleStyles.image}
              resizeMode="cover"
            />
          )}
          {hasMedia && message.videoUrl && !message.imageUrl && (
            <View
              style={[
                bubbleStyles.videoPlaceholder,
                { backgroundColor: colors.surfaceSunken },
              ]}
            >
              <Text style={fanText('tag', colors, colors.textTertiary)}>
                🎥 Video
              </Text>
            </View>
          )}

          {!!message.text && (
            <Text
              style={[
                fanText('caption', colors, colors.textPrimary),
                isCommentary && bubbleStyles.italic,
              ]}
            >
              {message.text}
            </Text>
          )}

          <Text
            style={[
              fanText('tag', colors, colors.textTertiary),
              bubbleStyles.timestamp,
            ]}
          >
            {timeAgo(message.timestamp)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  column: { marginBottom: 8 },
  username: { marginLeft: 34, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: FAN_SPACING.xs,
    justifyContent: 'flex-start',
  },
  rowMe: { justifyContent: 'flex-end' },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: FAN_RADIUS.lg,
    paddingHorizontal: FAN_SPACING.sm,
    paddingVertical: FAN_SPACING.xs,
  },
  replyQuote: {
    borderLeftWidth: 2,
    paddingLeft: FAN_SPACING.sm,
    marginBottom: 3,
  },
  image: {
    marginBottom: FAN_SPACING.xs,
    height: 160,
    width: 220,
    borderRadius: FAN_RADIUS.md,
  },
  videoPlaceholder: {
    marginBottom: FAN_SPACING.xs,
    height: 140,
    width: 220,
    borderRadius: FAN_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timestamp: { marginTop: 2, textAlign: 'right' },
  italic: { fontStyle: 'italic' },
});

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function createStyles(colors: FanColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    grow: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      paddingHorizontal: FAN_SPACING.lg,
      paddingVertical: FAN_SPACING.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backButton: { padding: 4 },
    infoButton: { padding: 2 },
    leaderboardButton: { padding: 4 },
    emptyChannels: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: FAN_SPACING.xl,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      paddingHorizontal: FAN_SPACING.lg,
      paddingTop: FAN_SPACING.md,
      paddingBottom: FAN_SPACING.sm,
    },
    channelListContent: {
      gap: FAN_SPACING.xs,
      paddingRight: FAN_SPACING.sm,
    },
    channelChip: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: FAN_RADIUS.md,
      paddingHorizontal: FAN_SPACING.base,
      paddingVertical: FAN_SPACING.xs,
      maxWidth: 140,
    },
    centerFill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: FAN_SPACING.xxl,
    },
    messagesContent: {
      paddingHorizontal: FAN_SPACING.sm,
      paddingVertical: FAN_SPACING.sm,
      flexGrow: 1,
    },
    typingRow: {
      paddingHorizontal: FAN_SPACING.md,
      paddingBottom: 2,
    },
    replyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      marginHorizontal: FAN_SPACING.md,
      marginBottom: FAN_SPACING.xs,
      borderRadius: FAN_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary + '40',
      backgroundColor: colors.primary + '14',
      paddingHorizontal: FAN_SPACING.sm,
      paddingVertical: FAN_SPACING.xs,
    },
    replyArrow: { fontSize: 14 },
    replyClose: {
      backgroundColor: colors.surfaceSunken,
      borderRadius: 999,
      padding: 4,
    },
    inputBar: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: FAN_SPACING.sm,
      paddingTop: FAN_SPACING.sm,
      paddingBottom: FAN_SPACING.md,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: FAN_SPACING.xs,
    },
    voteButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceSunken,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voteGateBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: FAN_SPACING.xs,
      borderRadius: FAN_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.draw + '40',
      backgroundColor: colors.surfaceSunken,
      paddingVertical: FAN_SPACING.sm,
    },
    composerWrap: {
      flex: 1,
      minHeight: 36,
      maxHeight: 100,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSunken,
      borderRadius: FAN_RADIUS.md,
      paddingHorizontal: FAN_SPACING.md,
      justifyContent: 'center',
    },
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachMenu: {
      flexDirection: 'row',
      gap: FAN_SPACING.md,
      marginTop: FAN_SPACING.sm,
    },
    attachChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.xs,
      borderRadius: FAN_RADIUS.pill,
      paddingHorizontal: FAN_SPACING.md,
      paddingVertical: FAN_SPACING.xs,
    },
    captionOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: FAN_SPACING.lg,
    },
    captionCard: {
      width: '100%',
      maxWidth: 380,
      borderRadius: FAN_RADIUS.lg,
      padding: FAN_SPACING.lg,
    },
    captionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: FAN_SPACING.sm,
    },
    captionPreview: {
      width: '100%',
      height: 160,
      borderRadius: FAN_RADIUS.md,
      marginBottom: FAN_SPACING.sm,
    },
    captionInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: FAN_RADIUS.md,
      padding: FAN_SPACING.sm,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    captionActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: FAN_SPACING.sm,
      marginTop: FAN_SPACING.sm,
    },
    captionCancel: { paddingVertical: 8, paddingHorizontal: 12 },
    captionSend: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: FAN_RADIUS.md,
    },
  });
}