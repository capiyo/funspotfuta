// Ported from funspot/lib/models/chat_message.dart. This is the "master"
// channel/private chat message model used by the WebSocket + channel chat
// endpoints — distinct from the simpler post-comment ChatMessage in
// lib/types/models.ts (that one maps to chats.dart, a different feature).
//
// Field-mapping notes preserved from the original comments: the Rust
// backend renames only messageId/isMe to camelCase on ReplyToData; every
// other field (image_url, video_url, is_image, is_video) stays snake_case.
// ChatMessage.fromJson() checks snake_case first, camelCase as a fallback
// for locally-cached data.

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
const MESSAGE_STATUS_BY_INDEX: MessageStatus[] = ['pending', 'sent', 'delivered', 'read', 'failed'];

export interface ReplyData {
  messageId: string;
  text: string;
  username: string;
  selection: string | null;
  isMe: boolean;
  imageUrl: string | null;
  videoUrl: string | null;
  isImage: boolean;
  isVideo: boolean;
}

export function replyDataFromJson(json: any): ReplyData {
  return {
    messageId: json.messageId ?? '',
    text: json.text ?? '',
    username: json.username ?? '',
    selection: json.selection ?? null,
    isMe: json.isMe ?? false,
    imageUrl: json.image_url ?? json.imageUrl ?? null,
    videoUrl: json.video_url ?? json.videoUrl ?? null,
    isImage: json.is_image ?? json.isImage ?? false,
    isVideo: json.is_video ?? json.isVideo ?? false,
  };
}

// Matches Rust's ReplyToData serde output exactly.
export function replyDataToJson(r: ReplyData) {
  return {
    messageId: r.messageId,
    text: r.text,
    username: r.username,
    selection: r.selection,
    isMe: r.isMe,
    image_url: r.imageUrl,
    video_url: r.videoUrl,
    is_image: r.isImage,
    is_video: r.isVideo,
  };
}

export interface ChatMessage {
  // Chat-screen fields
  id: string;
  tempId: string | null;
  isPending: boolean;
  userId: string;
  username: string;
  text: string;
  caption: string | null;
  selection: string | null;
  timestamp: Date;
  status: MessageStatus;
  isSeen: boolean;
  replyTo: ReplyData | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  imageCaption: string | null;
  videoUrl: string | null;
  videoPublicId: string | null;
  videoThumbnailUrl: string | null;
  videoCaption: string | null;
  videoDuration: number | null;
  videoSize: number | null;
  isImage: boolean;
  isVideo: boolean;
  isCommentary: boolean;
  commentaryType: string | null;
  seq: number;

  // Private-message fields
  postId: string | null;
  senderId: string | null;
  receiverId: string | null;
  senderName: string | null;
  receiverName: string | null;
  message: string | null;
  createdAt: Date | null;
}

function parseTimestamp(value: unknown): Date {
  if (value == null) return new Date();
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'object') {
    const dateObj: any = (value as any)['$date'];
    if (dateObj && typeof dateObj === 'object' && dateObj['$numberLong']) {
      return new Date(parseInt(dateObj['$numberLong'], 10));
    }
    if (typeof dateObj === 'string') {
      const d = new Date(dateObj);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    }
  }
  return new Date();
}

// Builds a synthetic "Live Commentary" message — matches
// ChatMessage.commentary() factory, including its collision-proof id.
export function chatMessageCommentary(params: {
  minute: number;
  text: string;
  type: string;
  createdAt: Date;
  seq?: number;
}): ChatMessage {
  const hash = Array.from(params.text).reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
  const uniqueId = `commentary_${params.createdAt.getTime()}_${params.minute}_${params.type}_${hash}`;
  return {
    id: uniqueId,
    tempId: null,
    isPending: false,
    userId: '__commentary__',
    username: `Live Commentary • ${params.minute}'`,
    text: params.text,
    caption: null,
    selection: null,
    timestamp: params.createdAt,
    status: 'sent',
    isSeen: true,
    replyTo: null,
    imageUrl: null,
    imagePublicId: null,
    imageCaption: null,
    videoUrl: null,
    videoPublicId: null,
    videoThumbnailUrl: null,
    videoCaption: null,
    videoDuration: null,
    videoSize: null,
    isImage: false,
    isVideo: false,
    isCommentary: true,
    commentaryType: params.type,
    seq: params.seq ?? 0,
    postId: null,
    senderId: null,
    receiverId: null,
    senderName: null,
    receiverName: null,
    message: params.text,
    createdAt: params.createdAt,
  };
}

export function chatMessageFromJson(json: any): ChatMessage {
  const rawReply = json.reply_to ?? json.replyTo;
  const replyTo = rawReply ? replyDataFromJson(rawReply) : null;

  const isChannelMessage =
    'userId' in json || 'username' in json || 'sender_name' in json || 'channel_id' in json;

  if (isChannelMessage) {
    const id = (json.id ?? json.message_id ?? json._id?.toString() ?? '').toString();
    const userId = json.userId ?? json.sender_id ?? json.user_id ?? '';
    const username = json.username ?? json.sender_name ?? json.user_name ?? 'Anonymous';
    const text = json.text ?? json.message ?? '';
    const timestamp = parseTimestamp(json.sent_at ?? json.timestamp ?? json.createdAt);
    const isCommentary =
      json.isCommentary === true ||
      json.is_commentary === true ||
      String(username).includes('Commentary') ||
      json.commentaryType != null ||
      json.commentary_type != null;
    const tempId = json.temp_id ?? json.tempId ?? null;
    const isPending = json.isPending ?? false;

    return {
      id,
      tempId,
      isPending,
      userId,
      username,
      text,
      caption: json.caption ?? null,
      selection: json.selection ?? json.user_vote ?? null,
      timestamp,
      status: typeof json.status === 'number' ? MESSAGE_STATUS_BY_INDEX[json.status] ?? 'sent' : 'sent',
      isSeen: json.isSeen ?? json.seen ?? false,
      isCommentary,
      commentaryType: json.commentaryType ?? json.commentary_type ?? null,
      replyTo,
      imageUrl: json.imageUrl ?? json.image_url ?? null,
      imagePublicId: json.imagePublicId ?? json.image_public_id ?? null,
      imageCaption: json.imageCaption ?? json.image_caption ?? null,
      videoUrl: json.videoUrl ?? json.video_url ?? null,
      videoPublicId: json.videoPublicId ?? json.video_public_id ?? null,
      videoThumbnailUrl: json.videoThumbnailUrl ?? json.video_thumbnail_url ?? null,
      videoCaption: json.videoCaption ?? json.video_caption ?? null,
      videoDuration: json.videoDuration ?? json.video_duration ?? null,
      videoSize: json.videoSize ?? json.video_size ?? null,
      isImage: json.isImage ?? json.is_image ?? false,
      isVideo: json.isVideo ?? json.is_video ?? false,
      seq: json.seq ?? 0,
      postId: json.postId ?? json.post_id ?? null,
      senderId: json.senderId ?? json.sender_id ?? null,
      receiverId: json.receiverId ?? json.receiver_id ?? null,
      senderName: json.senderName ?? json.sender_name ?? null,
      receiverName: json.receiverName ?? json.receiver_name ?? null,
      message: text,
      createdAt: timestamp,
    };
  }

  // Private message format
  const id = (json.id ?? json._id ?? '').toString();
  const postId = (json.postId ?? json.post_id ?? '').toString();
  const senderId = (json.senderId ?? json.sender_id ?? '').toString();
  const receiverId = (json.receiverId ?? json.receiver_id ?? '').toString();
  const senderName = (json.senderName ?? json.sender_name ?? 'Unknown').toString();
  const receiverName = (json.receiverName ?? json.receiver_name ?? 'Unknown').toString();
  const messageText = (json.message ?? '').toString();
  const seen = typeof json.seen === 'boolean' ? json.seen : json.seen?.toString() === 'true';
  const createdAt = parseTimestamp(json.createdAt ?? json.created_at);

  return {
    id,
    tempId: null,
    isPending: false,
    userId: senderId,
    username: senderName,
    text: messageText,
    caption: null,
    selection: null,
    timestamp: createdAt,
    status: seen ? 'read' : 'delivered',
    isSeen: seen,
    replyTo: null,
    imageUrl: null,
    imagePublicId: null,
    imageCaption: null,
    videoUrl: null,
    videoPublicId: null,
    videoThumbnailUrl: null,
    videoCaption: null,
    videoDuration: null,
    videoSize: null,
    isImage: false,
    isVideo: false,
    isCommentary: false,
    commentaryType: null,
    seq: 0,
    postId,
    senderId,
    receiverId,
    senderName,
    receiverName,
    message: messageText,
    createdAt,
  };
}
