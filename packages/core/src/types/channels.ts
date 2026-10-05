// Compatibility re-export for the canonical channel domain types/helpers.
// The implementation lives in api/channels-service.ts so Channel,
// ChannelMember and memberVoteAccuracy have one source of truth.
export {
  channelMemberFromJson,
  channelMemberToJson,
  memberIsAdmin,
  memberIsModerator,
  memberIsMember,
  memberIsOwner,
  memberVoteAccuracy,
  memberAccuracyLabel,
  channelFromJson,
  channelToJson,
  channelIsMember,
  channelIsPending,
  channelIsActiveMember,
  channelIsInactive,
  isUserAdmin,
  adminMembers,
  regularMembers,
  getMember,
  emptyChannel,
} from '../api/channels-service';
export type { Channel, ChannelMember, PendingJoinRequest } from '../api/channels-service';
