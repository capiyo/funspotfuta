import { webSocketService } from './websocket-service';
import type { ChatMessage } from '@funspot/core';

export interface SendPayloadExtras {
    imageUrl?: string | null;
    videoUrl?: string | null;
    videoThumbnailUrl?: string | null;
    isImage?: boolean;
    isVideo?: boolean;
    replyTo?: ChatMessage['replyTo'];
}

export interface SendChannelMessageParams {
    text: string;
    tempId: string;
    userId: string;
    username: string;
    authToken?: string | null;
    channelId: string;
    fixtureId?: string | null;
    /** The sender's vote, in frontend form: home_team / away_team / draw, or ''. */
    selection?: string;
    extras?: SendPayloadExtras;
}

export function sendChannelMessage({
    text,
    tempId,
    userId,
    username,
    authToken,
    channelId,
    fixtureId = null,
    selection = '',
    extras = {},
}: SendChannelMessageParams): Promise<boolean> {
    return webSocketService.sendChatMessageReliable({
        message: text,
        selection,
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
}