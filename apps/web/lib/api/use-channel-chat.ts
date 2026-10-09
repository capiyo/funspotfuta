import type { ReplyData } from '@funspot/core';
'use client';

// Wraps lib/api/websocket-service.ts for a single channel(+fixture) room,
// mirroring how ChatScreen in the Flutter app used WebSocketService: connect
// once, join the room, listen for 'chat.message', and merge history fetched
// over REST (comrade_service.getMessages) with live WS inserts. sendImage
// adds the media path: uploadChatImage() (api_services.dart) then
// sendChannelMessage() with is_image/image_url set.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  webSocketService,
  ChatMessage,
  chatMessageFromJson,
  getMessages,
  sendMessage as sendMessageRest,
  sendChannelMessage,
} from '@funspot/core';
import { uploadChatImage } from './media-service';

export function useChannelChat(params: {
  channelId: string | null;
  fixtureId?: string | null;
  userId: string | null;
  username: string | null;
  authToken: string | null;
}) {
  const { channelId, fixtureId, userId, username, authToken } = params;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const seenIds = useRef(new Set<string>());

  const appendMessage = useCallback((msg: ChatMessage) => {
    if (seenIds.current.has(msg.id)) return;
    seenIds.current.add(msg.id);
    setMessages((prev) =>
      [...prev, msg].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      ),
    );
  }, []);

  useEffect(() => {
    if (!channelId || !userId || !username || !authToken) return;
    let cancelled = false;

    (async () => {
      setLoadingHistory(true);
      setHistoryError(false);
      try {
        const history = await getMessages(channelId, authToken, {
          fixtureId: fixtureId ?? undefined,
        });
        if (cancelled) return;
        const parsed = history.map(chatMessageFromJson);
        parsed.forEach((m) => seenIds.current.add(m.id));
        setMessages(
          parsed.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
        );
      } catch (error) {
        console.error('Could not load chat history', error);
        if (!cancelled) setHistoryError(true);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();

    webSocketService.connect({
      userId,
      username,
      authToken,
      channelId,
      fixtureId,
    });
    const unsubStatus = webSocketService.onConnectionStatus(setConnected);

    const onChatMessage = (payload: Record<string, any>) =>
      appendMessage(chatMessageFromJson(payload));
    webSocketService.on('chat.message', onChatMessage);

    const roomId = fixtureId
      ? `${channelId}_${fixtureId}`
      : `${channelId}_overall`;
    webSocketService.joinRoom(roomId);

    return () => {
      cancelled = true;
      webSocketService.off('chat.message', onChatMessage);
      webSocketService.leaveRoom(roomId);
      // Match the mobile chat lifecycle: mark the channel/fixture read when
      // leaving the conversation. This uses the existing backend endpoint.
      void fetch(
        `https://clash-api-m5mr.onrender.com/api/channels/${channelId}/fixtures/${fixtureId ?? 'overall'}/read/${userId}`,
        { method: 'PUT', headers: { Authorization: `Bearer ${authToken}` } },
      ).catch(() => { /* read receipts must not block closing the chat */ });
      unsubStatus();
    };
  }, [channelId, fixtureId, userId, username, authToken, appendMessage]);

  const send = useCallback(
    async (
      text: string,
      selection: string = '',
      extras: {
        replyTo?: ReplyData | null;
        imageUrl?: string | null;
        videoUrl?: string | null;
        videoThumbnailUrl?: string | null;
        isImage?: boolean;
        isVideo?: boolean;
      } = {},
    ) => {
      if (!channelId || !userId || !username || !authToken) return;
      if (!text.trim()) return;

      const messageId = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      // Optimistic local echo, mirroring the pending-message UX in ChatScreen.
      appendMessage({
        id: messageId,
        tempId: messageId,
        isPending: true,
        userId,
        username,
        text,
        caption: null,
        selection: selection || null,
        timestamp: new Date(),
        status: 'pending',
        isSeen: false,
        replyTo: extras.replyTo ?? null,
        imageUrl: extras.imageUrl ?? null,
        imagePublicId: null,
        imageCaption: null,
        videoUrl: extras.videoUrl ?? null,
        videoPublicId: null,
        videoThumbnailUrl: extras.videoThumbnailUrl ?? null,
        videoCaption: null,
        videoDuration: null,
        videoSize: null,
        isImage: extras.isImage ?? false,
        isVideo: extras.isVideo ?? false,
        isCommentary: false,
        commentaryType: null,
        seq: 0,
        postId: null,
        senderId: userId,
        receiverId: null,
        senderName: username,
        receiverName: null,
        message: text,
        createdAt: new Date(),
      });

      if (connected) {
        webSocketService.sendChatMessage({
          message: text,
          selection,
          username,
          messageId,
          channelId,
          fixtureId: fixtureId ?? undefined,
          tempId: messageId,
        });
      } else {
        // Fallback to REST when the socket isn't up yet.
        const sent = await sendMessageRest({
          channelId,
          fixtureId,
          senderId: userId,
          senderName: username,
          text,
          authToken,
        });
        if (!sent) {
          setMessages((prev) => prev.map((message) =>
            message.id === messageId ? { ...message, status: 'failed', isPending: false } : message,
          ));
          throw new Error('Message was not accepted by the server.');
        }
      }
    },
    [channelId, fixtureId, userId, username, authToken, connected, appendMessage],
  );

  const sendImage = useCallback(
    async (file: File, caption?: string) => {
      if (!channelId || !userId || !username || !authToken) return;
      setUploadingImage(true);
      try {
        const imageUrl = await uploadChatImage({
          file,
          fileName: file.name,
          userId,
          authToken,
          caption,
        });
        if (!imageUrl) return;

        const tempId = `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        appendMessage({
          id: tempId,
          tempId,
          isPending: true,
          userId,
          username,
          text: caption ?? '',
          caption: caption ?? null,
          selection: null,
          timestamp: new Date(),
          status: 'pending',
          isSeen: false,
          replyTo: null,
          imageUrl,
          imagePublicId: null,
          imageCaption: caption ?? null,
          videoUrl: null,
          videoPublicId: null,
          videoThumbnailUrl: null,
          videoCaption: null,
          videoDuration: null,
          videoSize: null,
          isImage: true,
          isVideo: false,
          isCommentary: false,
          commentaryType: null,
          seq: 0,
          postId: null,
          senderId: userId,
          receiverId: null,
          senderName: username,
          receiverName: null,
          message: caption ?? '',
          createdAt: new Date(),
        });

        // Persist via the media/reply-capable path (image_url + is_image),
        // matching sendChannelMessage in api_services.dart.
        const sent = await sendChannelMessage({
          channelId,
          userId,
          username,
          text: caption ?? '',
          fixtureId: fixtureId ?? undefined,
          imageUrl,
          isImage: true,
          caption,
          authToken,
          tempId,
        });
        if (sent === false) {
          setMessages((prev) => prev.map((message) =>
            message.id === tempId ? { ...message, status: 'failed', isPending: false } : message,
          ));
          throw new Error('Image message was not accepted by the server.');
        }
      } finally {
        setUploadingImage(false);
      }
    },
    [channelId, fixtureId, userId, username, authToken, appendMessage],
  );

  return { messages, connected, loadingHistory, historyError, uploadingImage, send, sendImage };
}