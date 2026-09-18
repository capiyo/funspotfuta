'use client';

// Chat hook for the web ChatPage. Owns:
//   - channel message history (REST, once per channel+fixture per session)
//   - live chat via webSocketService ('chat.message' event)
//   - commentary via webSocketService ('commentary.new' / 'commentary.bulk')
//   - typing indicator ('typing' event)
//   - optimistic send with tempId → replaced when server confirms
//   - image upload

import { useCallback, useEffect, useRef, useState } from 'react';
import { webSocketService } from './websocket-service';
import {
    ChatMessage,
    chatMessageFromJson,
    chatMessageCommentary,
} from '@funspot/core';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'https://clash-api-m5mr.onrender.com/api';

interface Params {
    channelId: string | null;
    fixtureId?: string | null;
    userId?: string | null;
    username?: string | null;
    authToken?: string | null;
    comradesList?: string[];
}

interface SendPayloadExtras {
    imageUrl?: string | null;
    videoUrl?: string | null;
    videoThumbnailUrl?: string | null;
    isImage?: boolean;
    isVideo?: boolean;
    replyTo?: ChatMessage['replyTo'];
}

export function useChannelChat({
    channelId,
    fixtureId = null,
    userId,
    username,
    authToken,
    comradesList = [],
}: Params) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connected, setConnected] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);

    // Track seq so messages land deterministically even with equal timestamps
    const seqRef = useRef(0);
    const nextSeq = () => ++seqRef.current;

    // Dedup set — cheap way to avoid double-inserting a message we already
    // have (server replay after reconnect, our own optimistic confirm, etc.)
    const seenIdsRef = useRef<Set<string>>(new Set());

    // ---------------------------------------------------------------------
    // Insert helpers
    // ---------------------------------------------------------------------
    const insertSorted = useCallback((msg: ChatMessage) => {
        setMessages((prev) => {
            if (seenIdsRef.current.has(msg.id)) return prev;
            seenIdsRef.current.add(msg.id);
            // binary-search insert by (timestamp, seq)
            let lo = 0;
            let hi = prev.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                const a = prev[mid];
                const cmp =
                    a.timestamp.getTime() - msg.timestamp.getTime() ||
                    a.seq - msg.seq;
                if (cmp <= 0) lo = mid + 1;
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

    const removeById = useCallback((id: string) => {
        setMessages((prev) => prev.filter((m) => m.id !== id && m.tempId !== id));
        seenIdsRef.current.delete(id);
    }, []);

    // ---------------------------------------------------------------------
    // History (REST, once)
    // ---------------------------------------------------------------------
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

        fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
        })
            .then((r) => (r.ok ? r.json() : { messages: [] }))
            .then((data) => {
                if (cancelled) return;
                const raw: any[] = data?.messages ?? [];
                const parsed: ChatMessage[] = raw
                    .map((item) => {
                        const m = chatMessageFromJson(item);
                        return { ...m, seq: nextSeq() };
                    })
                    .sort(
                        (a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.seq - b.seq,
                    );
                for (const m of parsed) {
                    seenIdsRef.current.add(m.id);
                }
                setMessages(parsed);
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
    }, [channelId, fixtureId, authToken]);

    // ---------------------------------------------------------------------
    // Socket connect + subscriptions
    // ---------------------------------------------------------------------
    useEffect(() => {
        if (!channelId || !userId || !username) return;

        webSocketService.connect({
            userId,
            username,
            authToken: authToken ?? undefined,
            channelId,
            fixtureId,
        });

        const unsubStatus = webSocketService.onConnectionStatus(setConnected);

        // Chat messages
        const onChatMessage = (payload: Record<string, any>) => {
            const incomingTempId = payload.tempId as string | undefined;

            // Own message confirmed by server?
            if (incomingTempId) {
                const exists = messages.some((m) => m.tempId === incomingTempId);
                if (exists) {
                    replaceById(incomingTempId, {
                        id: payload.messageId ?? payload.id ?? incomingTempId,
                        tempId: null,
                        isPending: false,
                        status: 'sent',
                    });
                    return;
                }
            }

            // Skip our own echoes
            if (payload.userId && payload.userId === userId) return;

            const msg = chatMessageFromJson(payload);
            const enriched: ChatMessage = { ...msg, seq: nextSeq() };
            insertSorted(enriched);
        };

        const onCommentaryNew = (payload: Record<string, any>) => {
            const data = payload.payload ?? payload;
            const createdAt = parseCommentaryTimestamp(data.createdAt);
            const entry = chatMessageCommentary({
                minute: data.minute ?? 0,
                text: data.text ?? '',
                type: data.type ?? 'update',
                createdAt,
                seq: nextSeq(),
            });
            insertSorted(entry);
        };

        const onCommentaryBulk = (payload: Record<string, any>) => {
            const entries = payload.payload ?? payload;
            if (!Array.isArray(entries)) return;
            for (const raw of entries) {
                if (!raw || typeof raw !== 'object') continue;
                const createdAt = parseCommentaryTimestamp(raw.createdAt);
                const entry = chatMessageCommentary({
                    minute: raw.minute ?? 0,
                    text: raw.text ?? '',
                    type: raw.type ?? 'update',
                    createdAt,
                    seq: nextSeq(),
                });
                insertSorted(entry);
            }
        };

        const onTyping = (payload: Record<string, any>) => {
            const fromUserId = payload.fromUserId as string | undefined;
            if (!fromUserId || fromUserId === userId) return;
            if (comradesList.length && !comradesList.includes(fromUserId)) return;
            const isTyping = payload.isTyping as boolean;
            const name = (payload.username as string) ?? 'Someone';
            setTypingUsers((prev) => {
                if (isTyping) return prev.includes(name) ? prev : [...prev, name];
                return prev.filter((u) => u !== name);
            });
        };

        webSocketService.on('chat.message', onChatMessage);
        webSocketService.on('commentary.new', onCommentaryNew);
        webSocketService.on('commentary.bulk', onCommentaryBulk);
        webSocketService.on('typing', onTyping);

        return () => {
            unsubStatus();
            webSocketService.off('chat.message', onChatMessage);
            webSocketService.off('commentary.new', onCommentaryNew);
            webSocketService.off('commentary.bulk', onCommentaryBulk);
            webSocketService.off('typing', onTyping);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, fixtureId, userId, username, authToken]);

    // ---------------------------------------------------------------------
    // Send
    // ---------------------------------------------------------------------
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

            const ok = await webSocketService.sendChatMessageReliable({
                message: trimmed,
                selection: '',
                username,
                messageId: tempId,
                channelId,
                fixtureId,
                replyTo: extras.replyTo
                    ? {
                        messageId: extras.replyTo.messageId,
                        text: extras.replyTo.text,
                        username: extras.replyTo.username,
                        selection: extras.replyTo.selection,
                        isMe: extras.replyTo.isMe,
                        image_url: extras.replyTo.imageUrl,
                        video_url: extras.replyTo.videoUrl,
                        is_image: extras.replyTo.isImage,
                        is_video: extras.replyTo.isVideo,
                    }
                    : null,
                imageUrl: extras.imageUrl ?? null,
                videoUrl: extras.videoUrl ?? null,
                videoThumbnailUrl: extras.videoThumbnailUrl ?? null,
                isImage: extras.isImage ?? false,
                isVideo: extras.isVideo ?? false,
                tempId,
                onReconnectAttempt: () =>
                    webSocketService.connect({
                        userId,
                        username,
                        authToken: authToken ?? undefined,
                        channelId,
                        fixtureId,
                    }),
            });

            if (!ok) {
                replaceById(tempId, { status: 'failed', isPending: false });
            }
        },
        [channelId, fixtureId, userId, username, authToken, insertSorted, replaceById],
    );

    // ---------------------------------------------------------------------
    // Send image
    // ---------------------------------------------------------------------
    const sendImage = useCallback(
        async (file: File) => {
            if (!channelId || !userId || !username) return;
            setUploadingImage(true);
            try {
                const form = new FormData();
                form.append('file', file);
                if (fixtureId) form.append('fixture_id', fixtureId);

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
                await send('', { imageUrl, isImage: true });
            } finally {
                setUploadingImage(false);
            }
        },
        [channelId, fixtureId, userId, username, authToken, send],
    );

    // ---------------------------------------------------------------------
    // Mark chat read
    // ---------------------------------------------------------------------
    const markRead = useCallback(async () => {
        if (!channelId || !userId) return;
        try {
            await fetch(
                `${API_BASE_URL}/channels/${channelId}/fixtures/${fixtureId ?? 'overall'}/read/${userId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    },
                },
            );
        } catch {
            /* silent */
        }
    }, [channelId, fixtureId, userId, authToken]);

    return {
        messages,
        connected,
        loadingHistory,
        uploadingImage,
        typingUsers,
        send,
        sendImage,
        markRead,
    };
}

function parseCommentaryTimestamp(raw: any): Date {
    if (raw == null) return new Date();
    if (typeof raw === 'string') {
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? new Date() : d;
    }
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