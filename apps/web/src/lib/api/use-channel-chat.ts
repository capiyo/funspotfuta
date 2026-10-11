import { useCallback, useEffect, useRef, useState } from 'react';
import {
  webSocketService,
  chatMessageFromJson,
  chatMessageCommentary,
  getMessages,
  sendChannelMessage,
  type ChatMessage,
  type ReplyData,
} from '@funspot/core';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://clash-api-m5mr.onrender.com/api').replace(/\/$/, '');
const UPLOADING = 'uploading...';

export interface SendPayloadExtras {
  replyTo?: ReplyData | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  videoThumbnailUrl?: string | null;
  isImage?: boolean;
  isVideo?: boolean;
}
interface MatchSeed {
  status?: string | null;
  homeScore?: number;
  awayScore?: number;
  timeElapsed?: number;
  isLive?: boolean;
}
export interface Voter {
  userId: string;
  username: string;
  selection: string;
  isComrade: boolean;
  votedAt: Date;
}
interface Params {
  channelId: string | null;
  fixtureId?: string | null;
  userId?: string | null;
  username?: string | null;
  authToken?: string | null;
  fixtureStatus?: string | null;
  seed?: MatchSeed | null;
}
const byTime = (a: ChatMessage, b: ChatMessage) => a.timestamp.getTime() - b.timestamp.getTime() || a.seq - b.seq;
function frontendSelection(raw: string): string {
  if (raw === 'home') return 'home_team';
  if (raw === 'away') return 'away_team';
  return raw;
}
function parseTimestamp(raw: any): Date {
  if (raw == null) return new Date();
  const date = typeof raw === 'number' ? new Date(raw) : new Date(typeof raw === 'string' ? raw : raw?.$date?.$numberLong ?? raw?.$date ?? '');
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function useChannelChat({
  channelId, fixtureId = null, userId = null, username = null, authToken = null,
  fixtureStatus = null, seed = null,
}: Params) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [matchStatus, setMatchStatus] = useState(seed?.status ?? fixtureStatus ?? 'upcoming');
  const [homeScore, setHomeScore] = useState(seed?.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState(seed?.awayScore ?? 0);
  const [timeElapsed, setTimeElapsed] = useState(seed?.timeElapsed ?? 0);
  const [isLive, setIsLive] = useState(seed?.isLive ?? false);
  const [homeVotes, setHomeVotes] = useState(0);
  const [awayVotes, setAwayVotes] = useState(0);
  const [userVoteSelection, setUserVoteSelection] = useState<string | null>(null);
  const [voters, setVoters] = useState<Voter[]>([]);
  const seqRef = useRef(0);
  const seenIdsRef = useRef(new Set<string>());
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voteKeyRef = useRef<string | null>(null);
  const nextSeq = () => ++seqRef.current;

  const authHeaders = useCallback((extra?: Record<string, string>): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(extra ?? {}),
  }), [authToken]);

  const insertSorted = useCallback((message: ChatMessage) => {
    setMessages((previous) => {
      if (seenIdsRef.current.has(message.id)) return previous;
      seenIdsRef.current.add(message.id);
      return [...previous, message].sort(byTime);
    });
  }, []);

  const replaceById = useCallback((tempId: string, patch: Partial<ChatMessage>) => {
    setMessages((previous) => previous.map((message) => message.tempId === tempId ? { ...message, ...patch } : message));
  }, []);

  useEffect(() => {
    if (!seed) return;
    setMatchStatus(seed.status ?? fixtureStatus ?? 'upcoming');
    setHomeScore(seed.homeScore ?? 0);
    setAwayScore(seed.awayScore ?? 0);
    setTimeElapsed(seed.timeElapsed ?? 0);
    setIsLive(seed.isLive ?? false);
  }, [fixtureId, seed, fixtureStatus]);

  useEffect(() => {
    if (!channelId) { setLoadingHistory(false); return; }
    let cancelled = false;
    setMessages([]);
    seenIdsRef.current = new Set();
    seqRef.current = 0;
    setLoadingHistory(true);
    const url = fixtureId
      ? `${API_BASE_URL}/channels/${channelId}/messages?fixture_id=${encodeURIComponent(fixtureId)}&limit=100&_=${Date.now()}`
      : `${API_BASE_URL}/channels/${channelId}/messages?limit=100&_=${Date.now()}`;
    fetch(url, { headers: authHeaders({ 'Cache-Control': 'no-cache' }) })
      .then((response) => response.ok ? response.json() : { messages: [] })
      .then((data) => {
        if (cancelled) return;
        const parsed: ChatMessage[] = (Array.isArray(data?.messages) ? data.messages : []).map((item: any) => ({ ...chatMessageFromJson(item), seq: nextSeq() }));
        parsed.forEach((message) => seenIdsRef.current.add(message.id));
        setMessages((previous) => {
          const byId = new Map<string, ChatMessage>();
          parsed.forEach((message) => byId.set(message.id, message));
          previous.forEach((message) => { if (!byId.has(message.id)) byId.set(message.id, message); });
          return [...byId.values()].sort(byTime);
        });
      })
      .catch(() => { /* history failure leaves the empty state available */ })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [channelId, fixtureId, authHeaders]);

  useEffect(() => {
    if (!channelId || !fixtureId) return;
    let cancelled = false;
    const completed = ['completed', 'finished'].includes(fixtureStatus ?? matchStatus);
    const url = completed
      ? `${API_BASE_URL}/games/history/${fixtureId}`
      : `${API_BASE_URL}/games/${fixtureId}/commentary/latest?limit=100`;
    fetch(url, { headers: authHeaders() })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        const entries = completed ? data?.data?.commentary : data?.commentary;
        if (!Array.isArray(entries)) return;
        entries.forEach((entry: any) => {
          if (!entry || typeof entry !== 'object') return;
          insertSorted(chatMessageCommentary({
            minute: entry.minute ?? 0, text: entry.text ?? '', type: entry.type ?? 'update',
            createdAt: parseTimestamp(entry.createdAt ?? entry.created_at), seq: nextSeq(),
          }));
        });
      }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [channelId, fixtureId]);

  const refetchVoteCounts = useCallback(async () => {
    if (!channelId || !fixtureId || !userId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/channels/channel/${channelId}/fixtures/${fixtureId}/votes`, { headers: authHeaders() });
      if (!response.ok) return;
      const data = await response.json();
      setHomeVotes(data?.home_votes ?? 0);
      setAwayVotes(data?.away_votes ?? 0);
      const selection = data?.user_vote?.toString();
      if (selection) setUserVoteSelection(frontendSelection(selection));
    } catch { /* vote counts refresh opportunistically */ }
  }, [channelId, fixtureId, userId, authHeaders]);

  const refetchVoters = useCallback(async () => {
    if (!fixtureId || !userId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/actions/vote/fixture/${fixtureId}/voters`, { headers: authHeaders() });
      if (!response.ok) return;
      const data = await response.json();
      const list: Voter[] = (Array.isArray(data?.voters) ? data.voters : []).map((v: any) => ({
        userId: String(v.userId ?? ''), username: String(v.userName ?? 'Anonymous'),
        selection: String(v.selection ?? ''), isComrade: v.isComrade === true,
        votedAt: v.votedAt ? new Date(v.votedAt) : new Date(),
      })).filter((v: Voter) => v.userId && v.selection)
        .sort((a: Voter, b: Voter) => a.userId === userId ? -1 : b.userId === userId ? 1 : a.username.localeCompare(b.username));
      setVoters(list);
    } catch { /* voters are refreshed on vote events */ }
  }, [fixtureId, userId, authHeaders]);

  useEffect(() => {
    if (!channelId || !fixtureId || !userId) return;
    const key = `${channelId}:${fixtureId}`;
    if (voteKeyRef.current === key) return;
    voteKeyRef.current = key;
    void refetchVoteCounts();
    void refetchVoters();
  }, [channelId, fixtureId, userId, refetchVoteCounts, refetchVoters]);

  useEffect(() => {
    if (!channelId || !userId || !username) return;
    webSocketService.connect({ userId, username, authToken: authToken ?? undefined, channelId, fixtureId: fixtureId ?? undefined });
    if (fixtureId) {
      webSocketService.send('get.commentary', { fixtureId });
      webSocketService.send('get.latest.comment', { fixtureId, channelId });
      webSocketService.requestCurrentMinute({ fixtureId, channelId });
    }
    const offStatus = webSocketService.onConnectionStatus(setConnected);
    const onChat = (payload: Record<string, any>) => {
      const tempId = payload.tempId as string | undefined;
      if (tempId && messagesRef.current.some((message) => message.tempId === tempId)) {
        const id = String(payload.messageId ?? payload.id ?? tempId);
        seenIdsRef.current.add(id);
        replaceById(tempId, { id, tempId: null, isPending: false, status: 'sent' });
        return;
      }
      if (payload.userId && payload.userId === userId) return;
      insertSorted({ ...chatMessageFromJson(payload), seq: nextSeq() });
    };
    const onCommentary = (payload: Record<string, any>) => {
      const data = payload.payload ?? payload;
      insertSorted(chatMessageCommentary({ minute: data.minute ?? 0, text: data.text ?? '', type: data.type ?? 'update', createdAt: parseTimestamp(data.createdAt), seq: nextSeq() }));
    };
    const onBulk = (payload: Record<string, any>) => {
      const list = payload.payload ?? payload;
      if (!Array.isArray(list)) return;
      list.forEach((data: any) => insertSorted(chatMessageCommentary({ minute: data.minute ?? 0, text: data.text ?? '', type: data.type ?? 'update', createdAt: parseTimestamp(data.createdAt), seq: nextSeq() })));
    };
    const onTyping = (payload: Record<string, any>) => {
      const sender = String(payload.userId ?? payload.fromUserId ?? '');
      if (!sender || sender === userId) return;
      const name = String(payload.username ?? 'Someone');
      setTypingUsers((previous) => payload.isTyping ? previous.includes(name) ? previous : [...previous, name] : previous.filter((item) => item !== name));
    };
    const matchesFixture = (payload: Record<string, any>) => !payload.fixture_id || !fixtureId || String(payload.fixture_id) === fixtureId;
    const onStatus = (payload: Record<string, any>) => {
      if (!matchesFixture(payload)) return;
      const status = String(payload.status ?? 'live');
      setMatchStatus(status);
      if (typeof payload.home_score === 'number') setHomeScore(payload.home_score);
      if (typeof payload.away_score === 'number') setAwayScore(payload.away_score);
      const minute = payload.timeElapsed ?? payload.time_elapsed;
      if (typeof minute === 'number') setTimeElapsed(minute);
      setIsLive(status === 'live' || status === 'half_time');
    };
    const onGoal = (payload: Record<string, any>) => {
      if (!matchesFixture(payload)) return;
      if (typeof payload.home_score === 'number') setHomeScore(payload.home_score);
      if (typeof payload.away_score === 'number') setAwayScore(payload.away_score);
      const minute = payload.timeElapsed ?? payload.time_elapsed;
      if (typeof minute === 'number') setTimeElapsed(minute);
    };
    const onEnded = (payload: Record<string, any>) => {
      if (!matchesFixture(payload)) return;
      setMatchStatus('completed'); setIsLive(false);
    };
    const onMinute = (payload: Record<string, any>) => {
      if (!matchesFixture(payload)) return;
      const minute = payload.minute;
      if (typeof minute === 'number') setTimeElapsed(minute);
      const status = String(payload.status ?? '');
      if (status === 'half_time') { setMatchStatus('half_time'); setIsLive(true); }
      else if (status === 'full_time') { setMatchStatus('completed'); setIsLive(false); }
      else if (status === 'live' || status === 'injury_time') { setMatchStatus('live'); setIsLive(true); }
      if (status === 'half_time' || status === 'full_time') insertSorted(chatMessageCommentary({
        minute: Math.floor(typeof minute === 'number' ? minute : 0),
        text: status === 'half_time' ? '🔄 Half Time' : '🏁 Full Time', type: status,
        createdAt: new Date(), seq: nextSeq(),
      }));
    };
    const onVote = (payload: Record<string, any>) => {
      if (!matchesFixture(payload)) return;
      if (typeof payload.home_votes === 'number') setHomeVotes(payload.home_votes);
      if (typeof payload.away_votes === 'number') setAwayVotes(payload.away_votes);
      if (payload.user_vote != null) setUserVoteSelection(frontendSelection(String(payload.user_vote)));
      void refetchVoters();
    };
    const onConnected = () => {
      if (fixtureId) {
        webSocketService.send('get.commentary', { fixtureId });
        webSocketService.send('get.latest.comment', { fixtureId, channelId });
        webSocketService.requestCurrentMinute({ fixtureId, channelId });
      }
      void refetchVoteCounts();
    };
    webSocketService.on('chat.message', onChat);
    webSocketService.on('commentary.new', onCommentary);
    webSocketService.on('commentary.bulk', onBulk);
    webSocketService.on('typing', onTyping);
    webSocketService.on('match.status', onStatus);
    webSocketService.on('match.goal', onGoal);
    webSocketService.on('match.ended', onEnded);
    webSocketService.on('minute.update', onMinute);
    webSocketService.on('vote.update', onVote);
    webSocketService.on('connected', onConnected);
    webSocketService.on('room.joined', onConnected);
    return () => {
      offStatus();
      webSocketService.off('chat.message', onChat);
      webSocketService.off('commentary.new', onCommentary);
      webSocketService.off('commentary.bulk', onBulk);
      webSocketService.off('typing', onTyping);
      webSocketService.off('match.status', onStatus);
      webSocketService.off('match.goal', onGoal);
      webSocketService.off('match.ended', onEnded);
      webSocketService.off('minute.update', onMinute);
      webSocketService.off('vote.update', onVote);
      webSocketService.off('connected', onConnected);
      webSocketService.off('room.joined', onConnected);
    };
  }, [channelId, fixtureId, userId, username, authToken, insertSorted, replaceById, refetchVoteCounts, refetchVoters]);

  useEffect(() => {
    if (!channelId) return;
    return () => { webSocketService.leaveChannelFixtureRoom(channelId, fixtureId); };
  }, [channelId, fixtureId]);

  useEffect(() => () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); }, []);

  const deliver = useCallback(async (tempId: string, text: string, extras: SendPayloadExtras = {}): Promise<boolean> => {
    if (!channelId || !userId || !username) return false;
    return sendChannelMessage({ text, tempId, userId, username, authToken, channelId, fixtureId, selection: userVoteSelection ?? '', extras });
  }, [channelId, fixtureId, userId, username, authToken, userVoteSelection]);

  const send = useCallback(async (text: string, extras: SendPayloadExtras = {}) => {
    if (!channelId || !userId || !username) return;
    const trimmed = text.trim();
    if (!trimmed && !extras.imageUrl && !extras.videoUrl) return;
    const tempId = `temp_${Date.now()}_${userId}`;
    const optimistic = {
      ...chatMessageFromJson({
        messageId: tempId, userId, username, text: trimmed, message: trimmed,
        sent_at: new Date().toISOString(), isPending: true, tempId,
        reply_to: extras.replyTo, imageUrl: extras.imageUrl ?? null,
        videoUrl: extras.videoUrl ?? null, videoThumbnailUrl: extras.videoThumbnailUrl ?? null,
        isImage: extras.isImage ?? false, isVideo: extras.isVideo ?? false,
      }),
      id: tempId, tempId, isPending: true, status: 'pending', seq: nextSeq(),
    } as ChatMessage;
    insertSorted(optimistic);
    const ok = await deliver(tempId, trimmed, extras);
    if (!ok) replaceById(tempId, { status: 'failed', isPending: false });
  }, [channelId, userId, username, deliver, insertSorted, replaceById]);

  const sendImage = useCallback(async (asset: { uri: string; name?: string; type?: string }, caption = '') => {
    if (!channelId || !userId || !username || !asset.uri) return;
    const tempId = `temp_${Date.now()}_${userId}`;
    insertSorted({
      ...chatMessageFromJson({ messageId: tempId, userId, username, text: caption, message: caption, sent_at: new Date().toISOString(), imageUrl: UPLOADING, isImage: true }),
      id: tempId, tempId, isPending: true, status: 'pending', seq: nextSeq(),
    } as ChatMessage);
    setUploadingImage(true);
    try {
      const assetResponse = await fetch(asset.uri);
      const blob = await assetResponse.blob();
      const file = new File([blob], asset.name ?? 'image.jpg', { type: asset.type ?? blob.type });
      const form = new FormData();
      form.append('file', file, file.name);
      if (fixtureId) form.append('fixture_id', fixtureId);
      if (caption) form.append('caption', caption);
      const uploadResponse = await fetch(`${API_BASE_URL}/upload/chat/image`, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        body: form,
      });
      if (!uploadResponse.ok) throw new Error(`Upload failed (${uploadResponse.status})`);
      const uploadData = await uploadResponse.json();
      const imageUrl: string | undefined = uploadData?.url ?? uploadData?.image_url;
      if (!imageUrl) throw new Error('No image URL in response');
      replaceById(tempId, { imageUrl });
      const ok = await deliver(tempId, caption, { imageUrl, isImage: true });
      if (!ok) throw new Error('Not connected to chat server');
    } catch (error) {
      replaceById(tempId, { status: 'failed', isPending: false });
      throw error;
    } finally { setUploadingImage(false); }
  }, [channelId, fixtureId, userId, username, authToken, deliver, insertSorted, replaceById]);

  const sendTyping = useCallback(() => {
    if (!username) return;
    webSocketService.send('typing', { isTyping: true, username });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => webSocketService.send('typing', { isTyping: false, username }), 2000);
  }, [username]);

  const markRead = useCallback(async () => {
    if (!channelId || !userId) return;
    try {
      await fetch(`${API_BASE_URL}/channels/${channelId}/fixtures/${fixtureId ?? 'overall'}/read/${userId}`, { method: 'PUT', headers: authHeaders() });
    } catch { /* mark-read is best effort on exit */ }
  }, [channelId, fixtureId, userId, authHeaders]);

  return {
    messages, connected, loadingHistory, uploadingImage, typingUsers, send, sendImage,
    sendTyping, markRead, matchStatus, homeScore, awayScore, timeElapsed, isLive,
    homeVotes, awayVotes, userVoteSelection, voters, refetchVoteCounts, refetchVoters,
  };
}
