// @funspot/core — platform-agnostic Funspot domain layer.
// Both apps/web and apps/mobile import from here for types and API calls
// that don't touch the DOM, localStorage, or RN-specific modules.

export * from './types/fixture';
export * from './types/models';
export * from './types/betting';
export * from './types/chat-message';
export * from './types/post';
export * from './types/leaderboard';
export * from './types/channels';
export * from './theme';

export * from './api/config';
export * from './api/auth-service';
export * from './api/database-service';
export * from './api/comrade-service';
export * from './api/channels-service';

export * from './api/bet-service';
export * from './api/sub-fixture-service';
export * from './api/sub-fixture-votes-service';
export type { Voter } from './types/fixture';
export * from './api/payment-service';
export * from './api/history-service';
export * from './api/notification-service';

export * from './api/admin-service';
export * from './api/posts-service';
export * from './api/websocket-service';
export * from './api/profile-service';

// Was './queryClient' — the file is under api/, so the path must match.
export { createAppQueryClient, PERSIST_OPTIONS } from './queryClient';

export { useFixtures, useHistoryGames } from './queries/useFixtures';

export type {
    AftermatchData,
    AftermatchVoter,
    AftermatchPledge,
    AftermatchBet,
    AftermatchSubFixture,
    AftermatchSubFixturePledge,
} from './types/afternatch';
export { fetchAftermatch } from './api/aftermatch_service';
export { useAftermatch } from './queries/useAftermatch';
export { chatMessageFromJson, chatMessageCommentary } from './types/chat-message';
export type { ChatMessage, ReplyData } from './types/chat-message';