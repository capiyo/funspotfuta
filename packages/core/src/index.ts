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
export * from './types/possession';
export * from './api/possession-service';
export * from './api/auth-service';
export * from './api/database-service';
export { getAllChannels } from './api/channels-service';
export * from './api/comrade-service';
// Resolve the legacy weekly-leaderboard exports from comrade-service in favor
// of the canonical response shape consumed by both platform leaderboard UIs.
export { getChannelWeeklyLeaderboard, getChannelWeeklyLeaderboardData } from './api/weekly-leaderboard-service';
export type { WeeklyChannelLeader, WeeklyLeaderboardMe, WeeklyLeaderboardResponse } from './api/weekly-leaderboard-service';

export * from './api/bet-service';
export * from './api/pokes-service';
export { castFixtureVote, createPledge, matchMainPledge } from './api/vote-actions';
export type { ActionResult as VoteActionResult, CastFixtureVoteParams, CreatePledgeParams, MatchMainPledgeParams } from './api/vote-actions';
export {
  fetchVoters, fetchPledges, fetchSubFixtures, fetchSubFixturePledges,
  fetchBets, fetchBalance, topUp, withdraw, getSavedPhone, savePhone,
  getUserPhone, placeSubFixturePledge, matchSubFixturePledge, API_BASE_URL,
} from './api/vote-modal-shims';
export type { SubFixtureMarket, SubFixturePledge as VoteModalSubFixturePledge, Bettor, PayResult } from './api/vote-modal-shims';
export * from './api/sub-fixture-service';
export * from './api/sub-fixture-votes-service';
export type { Voter } from './types/fixture';
export * from './api/payment-service';
export * from './api/history-service';
export * from './api/notification-service';

export * from './api/admin-service';
export * from './api/posts-service';
export * from './api/websocket-service';
export * from './api/use-fixture-live-updates';
export { sendChannelMessage } from './api/send-channel-messages';
export { useChannelChat } from './api/use-channel-chat';
export type { SendPayloadExtras, Voter as ChannelChatVoter } from './api/use-channel-chat';
export type { SendPayloadExtras as SendChannelMessagePayloadExtras, SendChannelMessageParams } from './api/send-channel-messages';
export * from './api/profile-service';
export * from './api/avatar-service';

// Was './queryClient' — the file is under api/, so the path must match.
export { createAppQueryClient, PERSIST_OPTIONS } from './queryClient';
export {
  compactPersistedClient,
  serializePersistedClient,
  deserializePersistedClient,
} from './persistence/serialization';

export { useFixtures, useHistoryGames } from './queries/useFixtures';
export { queryKeys, mergeCachedList, capCachedMessages } from './queries/queryKeys';
export type { QueryKeyFactory } from './queries/queryKeys';
export { useCachedProfile, useCachedComrades, useProfileAvatar, profileQueryOptions, comradesQueryOptions } from './queries/useCachedAccountData';
export { useAllChannels } from './queries/useAllChannels';
export { useFeed, feedQueryOptions } from './queries/useFeed';
export { useInfiniteHistoryGames, historyQueryOptions } from './queries/useHistory';
export type { HistoryPage } from './queries/useHistory';
export type { FeedPage } from './queries/useFeed';

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