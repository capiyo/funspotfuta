// use-channel-chat.tsx
//
// Chat state for a channel (+ optional fixture). Owns:
//   - message history (REST) merged with commentary (REST + WS)
//   - live chat via webSocketService ('chat.message')
//   - live match state, seeded from the fixture then driven by WS events
//   - live vote state + voters list
//   - typing indicator (incoming + outgoing `sendTyping`)
//   - optimistic send; tempId replaced when the server echoes it back
//   - optimistic image upload ('uploading...' placeholder → real URL → WS send)
//   - markRead
//   - leaveChannelFixtureRoom on unmount
//
// Delivery itself lives in ./send-channel-message so other screens
// (e.g. the Arena match card comment box) send with the exact same payload.

import { useCallback, useEffect, useRef, useState } from 'react';
import { webSocketService } from './websocket-service';
import {
    sendChannelMessage,
    type SendPayloadExtras,
} from './send-channel-messages';
import {
    ChatMessage,
    chatMessageFromJson,
    chatMessageCommentary,
} from '@funspot/core';

export type { SendPayloadExtras };

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';
const UPLOADING = 'uploading...';

// ── Params ──────────────────────────────────────────────────────────

interface MatchSeed {
    status?: string | null;
    homeScore?: number;
    awayScore?: number;
    timeElapsed?: number;
    isLive?: boolean;
}

interface Params {
    channelId: string | null;
    fixtureId?: string | null;
    userId?: string | null;
    username?: string | null;
    authToken?: string | null;
    /** Status of the fixture at open time; decides history vs live commentary. */
    fixtureStatus?: string | null;
    /** Initial match state taken from the fixture object. */
    seed?: MatchSeed | null;
}

// ── Public types ────────────────────────────────────────────────────

export interface Voter {
    userId: string;
    username: string;
    selection: string;
    isComrade: boolean;
    votedAt: Date;
}

const byTime = (a: ChatMessage, b: ChatMessage) =>
    a.timestamp.getTime() - b.timestamp.getTime() || a.seq - b.seq;

function toFrontendSelection(raw: string): string {
    if (raw === 'home') return 'home_team';
    if (raw === 'away') return 'away_team';
    return raw;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useChannelChat({
    channelId,
    fixtureId = null,
    userId,
    username,
    authToken,
    fixtureStatus = null,
    seed = null,
}: Params) {
    // ── Messages ────────────────────────────────────────────────
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connected, setConnected] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);

    // ── Live match state ────────────────────────────────────────
    const [matchStatus, setMatchStatus] = useState<string>(
        seed?.status ?? fixtureStatus ?? 'upcoming',
    );
    const [homeScore, setHomeScore] = useState(seed?.homeScore ?? 0);
    const [awayScore, setAwayScore] = useState(seed?.awayScore ?? 0);
    const [timeElapsed, setTimeElapsed] = useState(seed?.timeElapsed ?? 0);
    const [isLive, setIsLive] = useState(seed?.isLive ?? false);

    // ── Live vote state ─────────────────────────────────────────
    const [homeVotes, setHomeVotes] = useState(0);
    const [awayVotes, setAwayVotes] = useState(0);
    const [drawVotes, setDrawVotes] = useState(0);
    const [userVoteSelection, setUserVoteSelection] = useState<string | null>(
        null,
    );
    const [voters, setVoters] = useState<Voter[]>([]);

    // ── Internals ───────────────────────────────────────────────
    const seqRef = useRef(0);
    const nextSeq = () => ++seqRef.current;

    const seenIdsRef = useRef<Set<string>>(new Set());
    const voteCountsFetchedRef = useRef<string | null>(null);

    // Mirror of `messages` so socket handlers never read a stale closure.
    const messagesRef = useRef<ChatMessage[]>(messages);
    messagesRef.current = messages;

    const typingStopRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    // ── Insert helpers ──────────────────────────────────────────
    const insertSorted = useCallback((msg: ChatMessage) => {
        setMessages((prev) => {
            if (seenIdsRef.current.has(msg.id)) return prev;
            seenIdsRef.current.add(msg.id);

            let lo = 0;
            let hi = prev.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (byTime(prev[mid], msg) <= 0) lo = mid + 1;
                else hi = mid;
            }
            const next = [...prev];
            next.splice(lo, 0, msg);
            return next;
        });
    }, []);

    const replaceById = useCallback(
        (tempId: string, patch: Partial<ChatMessage>) => {
            setMessages((prev) =>
                prev.map((m) => (m.tempId === tempId ? { ...m, ...patch } : m)),
            );
        },
        [],
    );

    // ── Auth header helper ──────────────────────────────────────
    const authHeaders = useCallback(
        (extra?: Record<string, string>): Record<string, string> => ({
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...(extra ?? {}),
        }),
        [authToken],
    );

    // ── Seed match state when the fixture changes ───────────────
    useEffect(() => {
        if (!seed) return;
        setMatchStatus(seed.status ?? 'upcoming');
        setHomeScore(seed.homeScore ?? 0);
        setAwayScore(seed.awayScore ?? 0);
        setTimeElapsed(seed.timeElapsed ?? 0);
        setIsLive(seed.isLive ?? false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fixtureId]);

    // ── Message history (REST) — MERGES with anything already present ──
    useEffect(() => {
        if (!channelId) return;
        let cancelled = false;

        setMessages([]);
        seenIdsRef.current = new Set();
        seqRef.current = 0;
        setLoadingHistory(true);

        const url = fixtureId
            ? `${API_BASE_URL}/channels/${channelId}/messages?fixture_id=${fixtureId}&limit=100&_=${Date.now()}`
            : `${API_BASE_URL}/channels/${channelId}/messages?limit=100&_=${Date.now()}`;

        fetch(url, { headers: authHeaders({ 'Cache-Control': 'no-cache' }) })
            .then((r) => (r.ok ? r.json() : { messages: [] }))
            .then((data) => {
                if (cancelled) return;
                const raw: any[] = data?.messages ?? [];
                const parsed: ChatMessage[] = raw.map((item) => ({
                    ...chatMessageFromJson(item),
                    seq: nextSeq(),
                }));
                for (const m of parsed) seenIdsRef.current.add(m.id);

                setMessages((prev) => {
                    const byId = new Map<string, ChatMessage>();
                    for (const m of parsed) byId.set(m.id, m);
                    for (const m of prev) if (!byId.has(m.id)) byId.set(m.id, m);
                    return [...byId.values()].sort(byTime);
                });
            })
            .catch(() => {
                /* silent — empty list is fine */
            })
            .finally(() => {
                if (!cancelled) setLoadingHistory(false);
            });

        return () => {
            cancelled = true;
        };
    }, [channelId, fixtureId, authHeaders]);

    // ── Commentary bootstrap (REST) ─────────────────────────────
    useEffect(() => {
        if (!channelId || !fixtureId) return;
        let cancelled = false;

        const status = fixtureStatus ?? matchStatus;
        const isHistory = status === 'completed' || status === 'finished';

        const url = isHistory
            ? `${API_BASE_URL}/games/history/${fixtureId}`
            : `${API_BASE_URL}/games/${fixtureId}/commentary/latest?limit=100`;

        fetch(url, { headers: authHeaders() })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (cancelled || !data) return;

                const raw: any[] = isHistory
                    ? (data?.data?.commentary ?? [])
                    : (data?.commentary ?? []);
                if (!Array.isArray(raw) || raw.length === 0) return;

                for (const entry of raw) {
                    if (!entry || typeof entry !== 'object') continue;
                    insertSorted(
                        chatMessageCommentary({
                            minute: entry.minute ?? 0,
                            text: entry.text ?? '',
                            type: entry.type ?? 'update',
                            createdAt: parseCommentaryTimestamp(
                                entry.createdAt ?? entry.created_at,
                            ),
                            seq: nextSeq(),
                        }),
                    );
                }
            })
            .catch(() => {
                /* silent — commentary is best-effort */
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, fixtureId]);

    // ── Vote counts + voters ────────────────────────────────────
    const fetchVoteCounts = useCallback(async () => {
        if (!channelId || !fixtureId || !userId) return;
        try {
            const res = await fetch(
                `${API_BASE_URL}/channels/channel/${channelId}/fixtures/${fixtureId}/votes`,
                { headers: authHeaders() },
            );
            if (!res.ok) return;
            const data = await res.json();
            setHomeVotes(data?.home_votes ?? 0);
            setAwayVotes(data?.away_votes ?? 0);
            setDrawVotes(data?.draw_votes ?? 0);

            const rawUserVote = data?.user_vote?.toString();
            if (rawUserVote) {
                setUserVoteSelection(toFrontendSelection(rawUserVote));
            }
        } catch {
            /* silent */
        }
    }, [channelId, fixtureId, userId, authHeaders]);

    const fetchVoters = useCallback(async () => {
        if (!fixtureId || !userId) return;
        try {
            const res = await fetch(
                `${API_BASE_URL}/actions/vote/fixture/${fixtureId}/voters`,
                { headers: authHeaders() },
            );
            if (!res.ok) return;
            const data = await res.json();
            const list: any[] = Array.isArray(data?.voters) ? data.voters : [];
            const parsed: Voter[] = list
                .map(
                    (v): Voter => ({
                        userId: v.userId?.toString() ?? '',
                        username: v.userName?.toString() ?? 'Anonymous',
                        selection: v.selection?.toString() ?? '',
                        isComrade: v.isComrade === true,
                        votedAt: v.votedAt ? new Date(v.votedAt) : new Date(),
                    }),
                )
                .filter((v) => v.userId.length > 0 && v.selection.length > 0)
                .sort((a, b) => {
                    if (a.userId === userId) return -1;
                    if (b.userId === userId) return 1;
                    return a.username.localeCompare(b.username);
                });
            setVoters(parsed);
        } catch {
            /* silent */
        }
    }, [fixtureId, userId, authHeaders]);

    // Initial fetch (once per channel+fixture)
    useEffect(() => {
        if (!channelId || !fixtureId || !userId) return;
        const key = `${channelId}:${fixtureId}`;
        if (voteCountsFetchedRef.current === key) return;
        voteCountsFetchedRef.current = key;
        void fetchVoteCounts();
        void fetchVoters();
    }, [channelId, fixtureId, userId, fetchVoteCounts, fetchVoters]);

    // ── Socket connect + subscriptions ──────────────────────────
    useEffect(() => {
        if (!channelId || !userId || !username) return;

        webSocketService.connect({
            userId,
            username,
            authToken: authToken ?? undefined,
            channelId,
            fixtureId,
        });

        // Catch-up unconditionally — if another screen already connected/joined,
        // 'connected' / 'room.joined' won't fire again.
        if (fixtureId) {
            webSocketService.send('get.commentary', { fixtureId });
            webSocketService.send('get.latest.comment', { fixtureId, channelId });
            webSocketService.requestCurrentMinute({ fixtureId, channelId });
        }

        const unsubStatus = webSocketService.onConnectionStatus(setConnected);

        // chat.message
        const onChatMessage = (payload: Record<string, any>) => {
            const incomingTempId = payload.tempId as string | undefined;

            if (
                incomingTempId &&
                messagesRef.current.some((m) => m.tempId === incomingTempId)
            ) {
                const serverId =
                    payload.messageId ?? payload.id ?? incomingTempId;
                seenIdsRef.current.add(serverId);
                replaceById(incomingTempId, {
                    id: serverId,
                    tempId: null,
                    isPending: false,
                    status: 'sent',
                });
                return;
            }

            if (payload.userId && payload.userId === userId) return;

            insertSorted({ ...chatMessageFromJson(payload), seq: nextSeq() });
        };

        // commentary.new
        const onCommentaryNew = (payload: Record<string, any>) => {
            const data = payload.payload ?? payload;
            insertSorted(
                chatMessageCommentary({
                    minute: data.minute ?? 0,
                    text: data.text ?? '',
                    type: data.type ?? 'update',
                    createdAt: parseCommentaryTimestamp(data.createdAt),
                    seq: nextSeq(),
                }),
            );
        };

        // commentary.bulk
        const onCommentaryBulk = (payload: Record<string, any>) => {
            const entries = payload.payload ?? payload;
            if (!Array.isArray(entries)) return;
            for (const raw of entries) {
                if (!raw || typeof raw !== 'object') continue;
                insertSorted(
                    chatMessageCommentary({
                        minute: raw.minute ?? 0,
                        text: raw.text ?? '',
                        type: raw.type ?? 'update',
                        createdAt: parseCommentaryTimestamp(raw.createdAt),
                        seq: nextSeq(),
                    }),
                );
            }
        };

        // typing — service sends 'userId', not 'fromUserId'
        const onTyping = (payload: Record<string, any>) => {
            const fromUserId = (payload.userId ?? payload.fromUserId) as
                | string
                | undefined;
            if (!fromUserId || fromUserId === userId) return;
            const isTyping = payload.isTyping as boolean;
            const name = (payload.username as string) ?? 'Someone';
            setTypingUsers((prev) => {
                if (isTyping) return prev.includes(name) ? prev : [...prev, name];
                return prev.filter((u) => u !== name);
            });
        };

        // match.status
        const onMatchStatus = (payload: Record<string, any>) => {
            const id = payload.fixture_id?.toString();
            if (id && fixtureId && id !== fixtureId) return;
            const status = payload.status?.toString() ?? 'live';
            setMatchStatus(status);
            if (typeof payload.home_score === 'number')
                setHomeScore(payload.home_score);
            if (typeof payload.away_score === 'number')
                setAwayScore(payload.away_score);
            const t = payload.timeElapsed ?? payload.time_elapsed;
            if (typeof t === 'number') setTimeElapsed(t);
            setIsLive(status === 'live' || status === 'half_time');
        };

        // match.goal
        const onMatchGoal = (payload: Record<string, any>) => {
            const id = payload.fixture_id?.toString();
            if (id && fixtureId && id !== fixtureId) return;
            if (typeof payload.home_score === 'number')
                setHomeScore(payload.home_score);
            if (typeof payload.away_score === 'number')
                setAwayScore(payload.away_score);
            const t = payload.timeElapsed ?? payload.time_elapsed;
            if (typeof t === 'number') setTimeElapsed(t);
        };

        // match.ended
        const onMatchEnded = (payload: Record<string, any>) => {
            const id = payload.fixture_id?.toString();
            if (id && fixtureId && id !== fixtureId) return;
            setMatchStatus('completed');
            setIsLive(false);
        };

        // minute.update
        const onMinuteUpdate = (payload: Record<string, any>) => {
            const id = payload.fixture_id?.toString();
            if (id && fixtureId && id !== fixtureId) return;
            const minute = payload.minute;
            if (typeof minute === 'number') setTimeElapsed(minute);
            const status = payload.status?.toString();

            if (status === 'half_time') {
                setMatchStatus('half_time');
                setIsLive(true);
            } else if (status === 'full_time') {
                setMatchStatus('completed');
                setIsLive(false);
            } else if (status === 'live' || status === 'injury_time') {
                setMatchStatus('live');
                setIsLive(true);
            }

            if (status === 'half_time' || status === 'full_time') {
                insertSorted(
                    chatMessageCommentary({
                        minute: Math.floor(typeof minute === 'number' ? minute : 0),
                        text:
                            status === 'half_time' ? '🔄 Half Time' : '🏁 Full Time',
                        type: status,
                        createdAt: new Date(),
                        seq: nextSeq(),
                    }),
                );
            }
        };

        // vote.update
        const onVoteUpdate = (payload: Record<string, any>) => {
            const id = payload.fixture_id?.toString();
            if (id && fixtureId && id !== fixtureId) return;
            if (typeof payload.home_votes === 'number')
                setHomeVotes(payload.home_votes);
            if (typeof payload.away_votes === 'number')
                setAwayVotes(payload.away_votes);
            if (typeof payload.draw_votes === 'number')
                setDrawVotes(payload.draw_votes);
            const rawUserVote = payload.user_vote?.toString();
            if (rawUserVote) {
                setUserVoteSelection(toFrontendSelection(rawUserVote));
            }
            void fetchVoters();
        };

        // connected / room.joined — catch-up
        const onConnectedOrJoined = () => {
            if (fixtureId) {
                webSocketService.send('get.commentary', { fixtureId });
                webSocketService.send('get.latest.comment', { fixtureId, channelId });
                webSocketService.requestCurrentMinute({ fixtureId, channelId });
            }
            void fetchVoteCounts();
        };

        webSocketService.on('chat.message', onChatMessage);
        webSocketService.on('commentary.new', onCommentaryNew);
        webSocketService.on('commentary.bulk', onCommentaryBulk);
        webSocketService.on('typing', onTyping);
        webSocketService.on('match.status', onMatchStatus);
        webSocketService.on('match.goal', onMatchGoal);
        webSocketService.on('match.ended', onMatchEnded);
        webSocketService.on('minute.update', onMinuteUpdate);
        webSocketService.on('vote.update', onVoteUpdate);
        webSocketService.on('connected', onConnectedOrJoined);
        webSocketService.on('room.joined', onConnectedOrJoined);

        return () => {
            unsubStatus();
            webSocketService.off('chat.message', onChatMessage);
            webSocketService.off('commentary.new', onCommentaryNew);
            webSocketService.off('commentary.bulk', onCommentaryBulk);
            webSocketService.off('typing', onTyping);
            webSocketService.off('match.status', onMatchStatus);
            webSocketService.off('match.goal', onMatchGoal);
            webSocketService.off('match.ended', onMatchEnded);
            webSocketService.off('minute.update', onMinuteUpdate);
            webSocketService.off('vote.update', onVoteUpdate);
            webSocketService.off('connected', onConnectedOrJoined);
            webSocketService.off('room.joined', onConnectedOrJoined);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, fixtureId, userId, username, authToken]);

    // ── Leave room on unmount (additive) ────────────────────────
    useEffect(() => {
        if (!channelId) return;
        return () => {
            webSocketService.leaveChannelFixtureRoom(channelId, fixtureId);
        };
    }, [channelId, fixtureId]);

    // ── Clear typing timer on unmount ───────────────────────────
    useEffect(() => {
        return () => {
            if (typingStopRef.current) clearTimeout(typingStopRef.current);
        };
    }, []);

    // ── Deliver (WebSocket, reconnect-and-retry) ────────────────
    // The actual payload lives in ./send-channel-message so every screen
    // sends identically.
    const deliver = useCallback(
        async (
            tempId: string,
            text: string,
            extras: SendPayloadExtras = {},
        ): Promise<boolean> => {
            if (!channelId || !userId || !username) return false;
            return sendChannelMessage({
                text,
                tempId,
                userId,
                username,
                authToken,
                channelId,
                fixtureId,
                selection: userVoteSelection ?? '',
                extras,
            });
        },
        [channelId, fixtureId, userId, username, authToken, userVoteSelection],
    );

    // ── Send ────────────────────────────────────────────────────
    const send = useCallback(
        async (text: string, extras: SendPayloadExtras = {}) => {
            if (!channelId || !userId || !username) return;
            const trimmed = text.trim();
            if (!trimmed && !extras.imageUrl && !extras.videoUrl) return;

            const tempId = `temp_${Date.now()}_${userId}`;
            const optimistic: ChatMessage = {
                ...chatMessageFromJson({
                    messageId: tempId,
                    userId,
                    username,
                    text: trimmed,
                    message: trimmed,
                    sent_at: new Date().toISOString(),
                    isPending: true,
                    tempId,
                    reply_to: extras.replyTo,
                    imageUrl: extras.imageUrl ?? null,
                    videoUrl: extras.videoUrl ?? null,
                    videoThumbnailUrl: extras.videoThumbnailUrl ?? null,
                    isImage: extras.isImage ?? false,
                    isVideo: extras.isVideo ?? false,
                }),
                id: tempId,
                tempId,
                isPending: true,
                status: 'pending',
                seq: nextSeq(),
            };

            insertSorted(optimistic);

            const ok = await deliver(tempId, trimmed, extras);
            if (!ok) replaceById(tempId, { status: 'failed', isPending: false });
        },
        [channelId, userId, username, deliver, insertSorted, replaceById],
    );

    // ── Send image (optimistic placeholder → upload → deliver) ──
    // The promise is not tied to the screen, so leaving the chat mid-upload
    // does not cancel it. (It is NOT a persistent queue: killing the app
    // mid-upload loses the image.)
    const sendImage = useCallback(
        async (
            asset: { uri: string; name?: string; type?: string },
            caption?: string,
        ) => {
            if (!channelId || !userId || !username || !asset?.uri) return;

            const tempId = `temp_${Date.now()}_${userId}`;
            insertSorted({
                ...chatMessageFromJson({
                    messageId: tempId,
                    userId,
                    username,
                    text: caption ?? '',
                    message: caption ?? '',
                    sent_at: new Date().toISOString(),
                    imageUrl: UPLOADING,
                    isImage: true,
                }),
                id: tempId,
                tempId,
                isPending: true,
                status: 'pending',
                seq: nextSeq(),
            });

            setUploadingImage(true);
            try {
                const form = new FormData();
                form.append('file', {
                    uri: asset.uri,
                    name: asset.name ?? `image-${Date.now()}.jpg`,
                    type: asset.type ?? 'image/jpeg',
                } as any);
                if (fixtureId) form.append('fixture_id', fixtureId);
                if (caption) form.append('caption', caption);

                const res = await fetch(`${API_BASE_URL}/upload/chat/image`, {
                    method: 'POST',
                    headers: authToken
                        ? { Authorization: `Bearer ${authToken}` }
                        : undefined,
                    body: form,
                });
                if (!res.ok) throw new Error(`Upload failed (${res.status})`);
                const data = await res.json();
                const imageUrl: string | undefined = data?.url ?? data?.image_url;
                if (!imageUrl) throw new Error('No image URL in response');

                replaceById(tempId, { imageUrl });
                const ok = await deliver(tempId, caption ?? '', {
                    imageUrl,
                    isImage: true,
                });
                if (!ok) throw new Error('Not connected to chat server');
            } catch (e) {
                replaceById(tempId, { status: 'failed', isPending: false });
                throw e; // lets the screen show a toast
            } finally {
                setUploadingImage(false);
            }
        },
        [channelId, fixtureId, userId, username, authToken, deliver, insertSorted, replaceById],
    );

    // ── Outgoing typing indicator ───────────────────────────────
    const sendTyping = useCallback(() => {
        if (!username) return;
        webSocketService.send('typing', { isTyping: true, username });
        if (typingStopRef.current) clearTimeout(typingStopRef.current);
        typingStopRef.current = setTimeout(() => {
            webSocketService.send('typing', { isTyping: false, username });
        }, 2000);
    }, [username]);

    // ── markRead ────────────────────────────────────────────────
    const markRead = useCallback(async () => {
        if (!channelId || !userId) return;
        try {
            await fetch(
                `${API_BASE_URL}/channels/${channelId}/fixtures/${fixtureId ?? 'overall'}/read/${userId}`,
                { method: 'PUT', headers: authHeaders() },
            );
        } catch {
            /* silent */
        }
    }, [channelId, fixtureId, userId, authHeaders]);

    return {
        // messages
        messages,
        connected,
        loadingHistory,
        uploadingImage,
        typingUsers,
        send,
        sendImage,
        sendTyping,
        markRead,

        // live match state
        matchStatus,
        homeScore,
        awayScore,
        timeElapsed,
        isLive,

        // live vote state
        homeVotes,
        awayVotes,
        drawVotes,
        userVoteSelection,
        voters,

        // imperative refetch
        refetchVoteCounts: fetchVoteCounts,
        refetchVoters: fetchVoters,
    };
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseCommentaryTimestamp(raw: any): Date {
    if (raw == null) return new Date();
    if (typeof raw === 'string') {
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? new Date() : d;
    }
    if (typeof raw === 'number') return new Date(raw);
    if (raw?.$date) {
        const d = raw.$date;
        if (typeof d === 'object' && d.$numberLong) {
            return new Date(parseInt(d.$numberLong, 10));
        }
        if (typeof d === 'string') {
            const parsed = new Date(d);
            return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        }
    }
    return new Date();
}