// apps/mobile/src/modals/ProfileModal/types.ts
//
// Local-only types for the profile modal. ChannelMember and Channel
// come from packages/core/src/types/channel.ts — not redefined here.
// This file holds only what's specific to the profile flow: the
// flattened UserData the modal edits, and the "users collection"
// snapshot the backend keeps in sync with every vote and settlement.

export interface UserData {
    userId: string;
    username: string;
    phone: string;
    nickname: string;
    clubFan: string;
    countryFan: string;
    numberOfBets: number;
    balance: number;
}

export function userDataFromJson(json: Record<string, any>): UserData {
    return {
        userId:
            json.user_id?.toString() ?? json.userId?.toString() ?? '',
        username: json.username?.toString() ?? '',
        phone: json.phone?.toString() ?? '',
        nickname: json.nickname?.toString() ?? '',
        clubFan: json.club_fan?.toString() ?? '',
        countryFan: json.country_fan?.toString() ?? '',
        numberOfBets: Number(json.number_of_bets ?? 0),
        balance: Number(json.balance ?? 0),
    };
}

export function userDataToJson(u: UserData): Record<string, any> {
    return {
        user_id: u.userId,
        username: u.username,
        phone: u.phone,
        nickname: u.nickname,
        club_fan: u.clubFan,
        country_fan: u.countryFan,
        number_of_bets: u.numberOfBets,
        balance: u.balance,
    };
}

/**
 * Snapshot of the canonical `users` collection record, fetched from
 * GET /auth/user/id/{userId}. The backend keeps this in sync: on every
 * vote cast, `cast_vote_handler` increments `total_votes`; on every
 * fixture settlement, `finalize_fixture_result_handler` increments
 * `season_points` / `correct_votes` and mirrors those numbers back
 * onto each channel membership record for the user.
 *
 * Used by the "Complete Profile" flow so the first save persists real
 * account activity instead of defaulting to 0.
 */
export interface UsersCollectionSnapshot {
    phone: string;
    balance: number;
    totalVotes: number;
}

export const EMPTY_USERS_COLLECTION_SNAPSHOT: UsersCollectionSnapshot = {
    phone: '',
    balance: 0,
    totalVotes: 0,
};