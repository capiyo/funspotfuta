// Direct ports of the small model files under funspot/lib/models/:
// news_model.dart, pledge_model.dart, chats.dart, archive_model.dart, usermodels.dart

// --- news_model.dart -------------------------------------------------------
export interface NewsModel {
  title: string;
  excerpt: string;
  time: string;
  image: string;
}

// --- pledge_model.dart ------------------------------------------------------
export interface PledgeModel {
  supporter: string;
  amount: string;
  message: string;
  time: string;
}

// --- chats.dart --------------------------------------------------------------
// Named PostChatMessage (not ChatMessage) to avoid colliding with the
// richer chat_message.dart-derived ChatMessage in ./chat-message.ts, which
// is what the WebSocket chat feature actually uses.
export interface PostChatMessage {
  id: number;
  postId: number;
  username: string;
  message: string;
  time: string;
  isYou: boolean;
  userId: number;
  seen: boolean;
  profileImage: string | null;
}

// currentUserId was hardcoded to 1 in the original Dart source too — replaced
// at the call site with the real logged-in user id where available.
export function postChatMessageFromJson(json: any, currentUserId: number = 1): PostChatMessage {
  const messageUserId = json.sender_id ?? json.user_id ?? 0;
  return {
    id: json.id ?? 0,
    postId: json.post_id ?? 0,
    username: json.username ?? json.sender_username ?? 'Unknown',
    message: json.message ?? '',
    time: json.created_at ?? json.time ?? new Date().toISOString(),
    isYou: messageUserId === currentUserId,
    userId: messageUserId,
    seen: json.seen ?? false,
    profileImage: json.profile_image ?? null,
  };
}

export function postChatMessageToJson(m: PostChatMessage) {
  return {
    id: m.id,
    post_id: m.postId,
    message: m.message,
    sender_id: m.userId,
    created_at: m.time,
    seen: m.seen,
  };
}

// --- archive_model.dart -------------------------------------------------------
export interface ArchiveActivityRequest {
  userId: string;
  username: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  selection: 'home_team' | 'draw' | 'away_team' | null;
  isLiked: boolean | null;
  comment: string | null;
  activityType: 'vote' | 'like' | 'comment' | string;
  timestamp: string;
}

export function archiveActivityRequestToJson(r: ArchiveActivityRequest) {
  return {
    userId: r.userId,
    username: r.username,
    fixtureId: r.fixtureId,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    selection: r.selection,
    isLiked: r.isLiked,
    comment: r.comment,
    activityType: r.activityType,
    timestamp: r.timestamp,
  };
}

// --- usermodels.dart -------------------------------------------------------
export interface UserTransactionSettings {
  userId: string;
  defaultTopUpNumber: string | null;
  defaultWithdrawNumber: string | null;
  balance: number;
  updatedAt: Date;
}

export function userTransactionSettingsFromJson(json: any): UserTransactionSettings {
  return {
    userId: json.userId ?? '',
    defaultTopUpNumber: json.defaultTopUpNumber ?? null,
    defaultWithdrawNumber: json.defaultWithdrawNumber ?? null,
    balance: Number(json.balance ?? 0.0),
    updatedAt: new Date(json.updatedAt ?? new Date().toISOString()),
  };
}
