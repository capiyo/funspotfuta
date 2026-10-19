// screens/MessagingScreen.tsx
//
// Single-channel message screen (RN port of the Flutter "Pitch Light" message Screen).
//
// Navigator: register this screen with `options={{ headerShown: false }}`.
// This screen draws its own header (one back button).
//
// Changes in this rewrite:
//   - Borderless input bar / header / chips; all controls 36px
//   - Android keyboard: behavior 'height' + bottom safe-area inset on input bar
//   - Image uploads: 'uploading...' placeholder bubble + failed state,
//     tap-to-fullscreen viewer
//   - Reply no longer double-quoted (only `replyTo` is sent)
//   - Copy text really copies (@react-native-clipboard/clipboard)
//   - /visibility/votes_button_show flag drives the modal tabs
//   - Outgoing typing indicator (needs `sendTyping` on useChannelmessage, optional)
//   - markRead only fires on real unmount
//   - HT / FT labels derived from status + timeElapsed
//   - Back invalidates the fixtures query (replaces Flutter's pop result)
//
// Vote changes:
//   - Home / Away only (no draw anywhere).
//   - The vote strip chips no longer cast a vote themselves: they open the
//     vote modal (or the aftermatch review once the match is finished), the
//     same as the ballot button and the match status bar.
//   - The modal votes / pledges / matches through api/vote-actions.ts
//     (Flutter's endpoints) and shows the server's own message on failure.
//   - The modal's payment / phone / sub-fixture props are bound to the user id
//     and token here (modalApi), because the shims need both.
//
// Still not ported: carousel, video upload/playback, comrade cards, archive
// modal on username tap, delete message.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import Clipboard from '@react-native-clipboard/clipboard';
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
  topUp as shimTopUp,
  withdraw as shimWithdraw,
  getSavedPhone as shimGetSavedPhone,
  savePhone as shimSavePhone,
  getUserPhone as shimGetUserPhone,
  placeSubFixturePledge as shimPlaceSubFixturePledge,
  matchSubFixturePledge as shimMatchSubFixturePledge,
} from '../../../../packages/core/src/api/vote-modal-shims';
import {
  castFixtureVote,
  createPledge,
  matchMainPledge as actionMatchMainPledge,
} from '../../../../packages/core/src/api/vote-actions';
import {
  useChannelChat,
  Voter,
} from '../../../../packages/core/src/api/use-channel-chat';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { PRESSED_OPACITY } from '@/theme/layout';
import { Input } from '@/components/ui/input';
import { SwipeableVotePledgeModal } from '@/modals/actionModal';
import { AftermatchReviewModal } from '@/modals/AftermatchModal';
import { MatchDetailsModal } from '@/modals/match/matchDetailsModals';
import ComradesScreen from '@/modals/ComradesModal';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type FanColors = ReturnType<typeof useFanColors>;
type ChatRouteProp = RouteProp<RootStackParamList, 'Chat'>;

const FIXTURES_KEY = ['fixtures'] as const;
const API_BASE: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ??
  'https://clash-api-m5mr.onrender.com/api';
const UPLOADING = 'uploading...';
const TYPING_THROTTLE_MS = 1500;
const CONTROL_SIZE = 36;

export interface RNImageAsset {
  uri: string;
  name?: string;
  type?: string;
  width?: number;
  height?: number;
}

function formatMinute(timeElapsed: number): string {
  if (!timeElapsed || timeElapsed <= 0) return "0'";
  const minutes = Math.floor(timeElapsed);
  const seconds = Math.round((timeElapsed % 1) * 60);
  return seconds > 0
    ? `${minutes}'${String(seconds).padStart(2, '0')}`
    : `${minutes}'`;
}

function isFailed(m: ChatMessage): boolean {
  return (m as unknown as { status?: string }).status === 'failed';
}

export default function MessageScreen() {
  const colors = useFanColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, insets.bottom),
    [colors, insets.bottom],
  );
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatRouteProp>();
  const { channelId: routeChannelId, fixtureId: routeFixtureId } =
    route.params ?? {};

  const { userId, username, authToken, isLoggedIn } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    routeChannelId ?? null,
  );
  const [autoFixture, setAutoFixture] = useState<Fixture | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [optionsFor, setOptionsFor] = useState<ChatMessage | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [matchDetailsOpen, setMatchDetailsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const [pendingImage, setPendingImage] = useState<RNImageAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [showExtraTabs, setShowExtraTabs] = useState(true);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    if (routeChannelId) setActiveChannelId(routeChannelId);
  }, [routeChannelId]);

  // ── Default channel when route didn't supply one ───────────
  useEffect(() => {
    if (routeChannelId) return;
    if (!userId || !authToken) return;
    getUserChannels(userId, authToken).then((c: Channel[]) => {
      setActiveChannelId((prev) => prev ?? c[0]?.channelId ?? null);
    });
  }, [routeChannelId, userId, authToken]);

  // ── Remote flag: pledges / bets / sub-fixture tabs ─────────
  useEffect(() => {
    let alive = true;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    fetch(`${API_BASE}/visibility/votes_button_show`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.value === 'boolean') {
          setShowExtraTabs(d.value);
        }
      })
      .catch(() => { });
    return () => {
      alive = false;
    };
  }, [authToken]);

  // ── Fixture ────────────────────────────────────────────────
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

  // ── Chat hook ──────────────────────────────────────────────
  const chat = useChannelChat({
    channelId: activeChannelId,
    fixtureId,
    userId,
    username,
    authToken,
    fixtureStatus: fixture?.status ?? null,
    seed: fixture
      ? {
        status: fixture.status,
        homeScore: fixture.homeScore ?? 0,
        awayScore: fixture.awayScore ?? 0,
        timeElapsed: fixture.timeElapsed ?? 0,
        isLive: fixture.isLive,
      }
      : null,
  });
  const {
    messages,
    loadingHistory,
    uploadingImage,
    typingUsers,
    send,
    sendImage,
    markRead,
    matchStatus,
    homeScore,
    awayScore,
    timeElapsed,
    isLive,
    homeVotes,
    awayVotes,
    userVoteSelection,
    voters,
    refetchVoteCounts,
  } = chat;

  // ── Derived flags ──────────────────────────────────────────
  const isCompleted =
    matchStatus === 'completed' || matchStatus === 'finished';
  const isUpcomingOrSoon =
    matchStatus === 'upcoming' || matchStatus === 'soon';
  const requireVoteToChat = isUpcomingOrSoon && !!fixtureId;
  const hasVoted = userVoteSelection != null;
  const voteGateActive = requireVoteToChat && !hasVoted;

  // The modal's props carry no user or token, but every shim call needs them
  // (the old shims sent neither). Bind them here once.
  const modalApi = useMemo(() => {
    const uid = userId ?? '';
    const uname = username ?? '';
    return {
      topUp: (amount: number, phone: string, purpose: string) =>
        shimTopUp({ userId: uid, username: uname, authToken, amount, phone, purpose }),
      withdraw: (amount: number, phone: string) =>
        shimWithdraw({ userId: uid, username: uname, authToken, amount, phone }),
      getSavedPhone: (kind: 'topup' | 'withdraw') =>
        shimGetSavedPhone(uid, kind, authToken),
      savePhone: (kind: 'topup' | 'withdraw', phone: string) =>
        shimSavePhone(uid, kind, phone, authToken),
      getUserPhone: () => shimGetUserPhone(uid, authToken),
      placeSubFixturePledge: (a: Parameters<typeof shimPlaceSubFixturePledge>[0]) =>
        shimPlaceSubFixturePledge({ ...a, authToken }),
      matchSubFixturePledge: (a: Parameters<typeof shimMatchSubFixturePledge>[0]) =>
        shimMatchSubFixturePledge({ ...a, authToken }),
      matchMainPledge: (a: Parameters<typeof actionMatchMainPledge>[0]) =>
        actionMatchMainPledge({ ...a, authToken }),
    };
  }, [userId, username, authToken]);

  // ── Auto-scroll ────────────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(t);
  }, [messages.length]);

  // ── markRead: ref so it only fires on real unmount ─────────
  const markReadRef = useRef(markRead);
  useEffect(() => {
    markReadRef.current = markRead;
  }, [markRead]);
  useEffect(() => {
    return () => {
      void markReadRef.current?.();
    };
  }, []);

  // ── Handlers ───────────────────────────────────────────────
  const sendWithReply = useCallback(
    async (text: string, reply: ReplyData | null) => {
      // Only `replyTo` carries the quote; the text body stays clean.
      await send(text, reply ? { replyTo: reply } : {});
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
    await sendWithReply(text, replyPayload);
  }

  function handleDraftChange(text: string) {
    setDraft(text);
    if (!text || !isLoggedIn) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    chat.sendTyping();
  }

  async function handleImagePick() {
    setShowAttachMenu(false);
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.8,
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
      toast.showError(err?.message ?? 'Failed to pick image');
    }
  }

  async function confirmSendImage() {
    if (!pendingImage) return;
    const asset = pendingImage;
    const text = caption.trim();
    setPendingImage(null);
    setCaption('');
    try {
      await sendImage(asset as any, text);
    } catch (err: any) {
      toast.showError(err?.message ?? 'Failed to send image');
    }
  }

  // Vote modal while the match is open; aftermatch review once it is finished.
  function openVoteOrReview() {
    if (isCompleted) setReviewModalOpen(true);
    else setVoteModalOpen(true);
  }

  function handleBack() {
    queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
    navigation.goBack();
  }

  function handleCopy(text: string) {
    Clipboard.setString(text);
    toast.showSuccess('Copied');
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && { opacity: PRESSED_OPACITY },
          ]}
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </Pressable>

        {fixture && (
          <Pressable
            onPress={() => setMatchDetailsOpen(true)}
            hitSlop={6}
            style={styles.iconButton}
          >
            <Info size={15} color={colors.textPrimary} />
          </Pressable>
        )}

        <View style={styles.grow}>
          {fixture ? (
            <MatchStatusBar
              colors={colors}
              fixture={fixture}
              status={matchStatus}
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
          style={styles.iconButton}
        >
          <Users size={16} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Vote strip */}
      {fixture && fixtureId && (
        <VoteStrip
          colors={colors}
          fixture={fixture}
          homeVotes={homeVotes}
          awayVotes={awayVotes}
          onOpenModal={openVoteOrReview}
          onPressTotals={() => setShowVoters((v) => !v)}
        />
      )}

      {!activeChannelId ? (
        <View style={styles.emptyChannels}>
          <Text style={fanText('body', colors, colors.textTertiary)}>
            Join or create a channel to start chatting.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {showVoters && (
            <VotersPanel
              colors={colors}
              voters={voters}
              userId={userId}
              onClose={() => setShowVoters(false)}
            />
          )}

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
                <Text style={fanText('caption', colors, colors.textTertiary)}>
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
                onLongPress={() => setOptionsFor(item)}
                onImagePress={setViewerUri}
              />
            )}
          />

          {typingUsers.length > 0 && (
            <View style={styles.typingRow}>
              <Text style={fanText('tag', colors, colors.textTertiary)}>
                {typingUsers.length === 1
                  ? `${typingUsers[0]} is typing…`
                  : `${typingUsers.length} people are typing…`}
              </Text>
            </View>
          )}

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
                  {replyTo.text ||
                    (replyTo.isImage
                      ? '📷 Image'
                      : replyTo.isVideo
                        ? '🎥 Video'
                        : 'Media')}
                </Text>
              </View>
              <Pressable
                onPress={() => setReplyTo(null)}
                hitSlop={8}
                style={styles.replyClose}
              >
                <X size={12} color={colors.textTertiary} />
              </Pressable>
            </View>
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <View style={styles.inputRow}>
              <Pressable
                onPress={openVoteOrReview}
                style={[
                  styles.circleButton,
                  {
                    backgroundColor: voteGateActive
                      ? colors.draw + '1A'
                      : colors.surfaceSunken,
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
                  style={[
                    styles.circleButton,
                    { backgroundColor: colors.surfaceSunken },
                  ]}
                >
                  <Paperclip size={16} color={colors.textTertiary} />
                </Pressable>
              )}

              {voteGateActive ? (
                <Pressable onPress={openVoteOrReview} style={styles.voteGateBar}>
                  <Lock size={12} color={colors.draw} />
                  <Text style={fanText('caption', colors, colors.draw)}>
                    {matchStatus === 'soon'
                      ? 'Vote before game starts 💬'
                      : 'Vote to chat 💬'}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.composerWrap}>
                  <Input
                    style={[
                      fanText('caption', colors, colors.textPrimary),
                      { paddingVertical: 8, textAlignVertical: 'center' },
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
                  style={[
                    styles.circleButton,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Send size={16} color="#fff" />
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
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
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
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surfaceSunken,
                },
              ]}
              multiline
              maxLength={500}
            />
            <View style={styles.captionActions}>
              <Pressable
                onPress={() => setPendingImage(null)}
                style={styles.captionCancel}
              >
                <Text style={fanText('caption', colors, colors.textSecondary)}>
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

      {/* Full-screen image viewer */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <Pressable
          style={styles.viewerOverlay}
          onPress={() => setViewerUri(null)}
        >
          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>

      {/* Message options (long-press) */}
      <Modal
        visible={!!optionsFor}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsFor(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setOptionsFor(null)}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Pressable
              onPress={() => {
                if (optionsFor) setReplyTo(optionsFor);
                setOptionsFor(null);
              }}
              style={styles.optionsItem}
            >
              <Text style={fanText('body', colors, colors.textPrimary)}>
                Reply
              </Text>
            </Pressable>
            {!!optionsFor?.text && (
              <Pressable
                onPress={() => {
                  handleCopy(optionsFor.text);
                  setOptionsFor(null);
                }}
                style={styles.optionsItem}
              >
                <Text style={fanText('body', colors, colors.textPrimary)}>
                  Copy text
                </Text>
              </Pressable>
            )}
            {optionsFor?.userId === userId && !optionsFor?.isCommentary && (
              <Pressable
                onPress={() => {
                  toast.showInfo('Delete coming soon');
                  setOptionsFor(null);
                }}
                style={styles.optionsItem}
              >
                <Text style={fanText('body', colors, colors.away)}>Delete</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
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
          showPledgesTab={showExtraTabs}
          showSubFixturesTab={showExtraTabs}
          showBetsTab={showExtraTabs}
          onClose={() => setVoteModalOpen(false)}
          // Voting: POST /actions/vote/cast (Flutter's endpoint). The modal
          // shows the server's own message on failure.
          onVote={async (sel) => {
            if (!userId || !authToken || !username) {
              return { success: false, message: 'Please sign in to vote' };
            }
            const r = await castFixtureVote({
              fixtureId: fixture.matchId ?? fixture.id,
              userId,
              username,
              selection: sel,
              authToken,
            });
            if (r.success) {
              queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
              await refetchVoteCounts();
            }
            return { success: r.success, message: r.message };
          }}
          // Pledging: votes first if needed, creates the bet, rolls the vote
          // back if the bet fails (Flutter's _processPledge).
          onPledge={async (sel, amount) => {
            if (!userId || !username || !authToken) {
              return { success: false, message: 'Please sign in to continue' };
            }
            const r = await createPledge({
              fixtureId: fixture.matchId ?? fixture.id,
              userId,
              username,
              selection: sel,
              amount,
              channelId: activeChannelId,
              alreadyVoted: hasVoted,
              authToken,
            });
            if (r.success && r.votedNow) {
              queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
              await refetchVoteCounts();
            }
            return {
              success: r.success,
              message: r.message,
              newBalance: r.newBalance,
            };
          }}
          onShowJoinGroups={() => { }}
          fetchVoters={fetchVoters}
          fetchPledges={fetchPledges}
          fetchSubFixtures={fetchSubFixtures}
          fetchSubFixturePledges={fetchSubFixturePledges}
          fetchBets={fetchBets}
          fetchBalance={fetchBalance}
          topUp={modalApi.topUp}
          withdraw={modalApi.withdraw}
          getSavedPhone={modalApi.getSavedPhone}
          savePhone={modalApi.savePhone}
          getUserPhone={modalApi.getUserPhone}
          placeSubFixturePledge={modalApi.placeSubFixturePledge}
          matchSubFixturePledge={modalApi.matchSubFixturePledge}
          matchMainPledge={modalApi.matchMainPledge}
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
          showPledgesTab={showExtraTabs}
          showBetsTab={showExtraTabs}
          showSubFixturesTab={showExtraTabs}
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
// Match status bar
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
  const minutes = Math.floor(timeElapsed || 0);
  const liveNow = status === 'live' || isLive;

  let label = status.toUpperCase();
  let labelColor = colors.textTertiary;
  if (status === 'half_time' || (liveNow && minutes === 45)) {
    label = '⚡ HT';
    labelColor = colors.draw;
  } else if (liveNow && minutes >= 90 && completed) {
    label = '✅ FT';
    labelColor = colors.primary;
  } else if (liveNow) {
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
      {liveNow && (
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
// Vote strip (Home / Away). Chips open the vote or aftermatch modal.
// ─────────────────────────────────────────────────────────────
function VoteStrip({
  colors,
  fixture,
  homeVotes,
  awayVotes,
  onOpenModal,
  onPressTotals,
}: {
  colors: FanColors;
  fixture: Fixture;
  homeVotes: number;
  awayVotes: number;
  onOpenModal: () => void;
  onPressTotals: () => void;
}) {
  const total = homeVotes + awayVotes;

  if (total === 0) {
    const chip = (color: string) => [
      voteStripStyles.chip,
      { backgroundColor: color + '14' },
    ];
    return (
      <View style={[voteStripStyles.card, { backgroundColor: colors.surface }]}>
        <Pressable onPress={onOpenModal} style={chip(colors.primary)}>
          <Text
            style={fanText('tag', colors, colors.primary)}
            numberOfLines={1}
          >
            {fixture.homeTeam}
          </Text>
        </Pressable>
        <Pressable onPress={onOpenModal} style={chip(colors.away)}>
          <Text style={fanText('tag', colors, colors.away)} numberOfLines={1}>
            {fixture.awayTeam}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPressTotals}
      style={[voteStripStyles.card, { backgroundColor: colors.surface }]}
    >
      <View style={{ flex: Math.max(homeVotes, 0.0001) }}>
        <View
          style={[voteStripStyles.bar, { backgroundColor: colors.primary }]}
        />
      </View>
      <View style={{ flex: Math.max(awayVotes, 0.0001) }}>
        <View style={[voteStripStyles.bar, { backgroundColor: colors.away }]} />
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
  voters,
  userId,
  onClose,
}: {
  colors: FanColors;
  voters: Voter[];
  userId: string | null;
  onClose: () => void;
}) {
  const displayVote = (sel: string) => {
    if (sel === 'home_team' || sel === 'home') return 'Home';
    if (sel === 'away_team' || sel === 'away') return 'Away';
    return sel;
  };

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
              {displayVote(v.selection)}
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
  onImagePress,
}: {
  colors: FanColors;
  message: ChatMessage;
  isMe: boolean;
  onLongPress: () => void;
  onImagePress: (uri: string) => void;
}) {
  const isCommentary = message.isCommentary;
  const effectiveIsMe = isCommentary ? false : isMe;
  const uploading =
    message.imageUrl === UPLOADING || message.videoUrl === UPLOADING;
  const failed = isFailed(message);
  const hasImage = !!message.imageUrl && !uploading;
  const hasVideo = !!message.videoUrl && !uploading && !message.imageUrl;

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

      <View style={[bubbleStyles.row, effectiveIsMe && bubbleStyles.rowMe]}>
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
              ? { backgroundColor: colors.draw + '14' }
              : effectiveIsMe
                ? { backgroundColor: colors.primary + '1A' }
                : { backgroundColor: colors.surface },
            message.isPending && !failed && { opacity: 0.6 },
            failed && { backgroundColor: colors.away + '1A' },
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
                numberOfLines={2}
              >
                {message.replyTo.text}
              </Text>
            </View>
          )}

          {uploading && (
            <View
              style={[
                bubbleStyles.mediaPlaceholder,
                { backgroundColor: colors.surfaceSunken },
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}

          {hasImage && (
            <Pressable onPress={() => onImagePress(message.imageUrl as string)}>
              <Image
                source={{ uri: message.imageUrl as string }}
                style={bubbleStyles.image}
                resizeMode="cover"
              />
            </Pressable>
          )}

          {hasVideo && (
            <View
              style={[
                bubbleStyles.mediaPlaceholder,
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
              fanText('tag', colors, failed ? colors.away : colors.textTertiary),
              bubbleStyles.timestamp,
            ]}
          >
            {failed ? 'Failed to send' : timeAgo(message.timestamp)}
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
  mediaPlaceholder: {
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

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
function createStyles(colors: FanColors, bottomInset: number) {
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
    },
    iconButton: { padding: 4 },
    emptyChannels: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: FAN_SPACING.xl,
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
      paddingHorizontal: FAN_SPACING.sm,
      paddingTop: FAN_SPACING.sm,
      paddingBottom: Math.max(bottomInset, FAN_SPACING.md),
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: FAN_SPACING.xs,
    },
    circleButton: {
      width: CONTROL_SIZE,
      height: CONTROL_SIZE,
      borderRadius: CONTROL_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voteGateBar: {
      flex: 1,
      minHeight: CONTROL_SIZE,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: FAN_SPACING.xs,
      borderRadius: CONTROL_SIZE / 2,
      backgroundColor: colors.draw + '1A',
    },
    composerWrap: {
      flex: 1,
      minHeight: CONTROL_SIZE,
      maxHeight: 100,
      backgroundColor: colors.surfaceSunken,
      borderRadius: CONTROL_SIZE / 2,
      paddingHorizontal: FAN_SPACING.md,
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
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: FAN_SPACING.lg,
    },
    card: {
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
    optionsItem: { paddingVertical: 14 },
    viewerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerImage: { width: '100%', height: '80%' },
  });
}