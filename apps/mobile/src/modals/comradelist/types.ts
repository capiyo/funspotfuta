// apps/mobile/src/modals/ComradeListModal/types.ts
//
// Local model for the ComradeList modal. Port of the Dart ComradeProfile
// class — flattened view of a user profile with just the fields this modal
// renders. Note: despite the name, this is *not* a comrade relation — the
// list is every profile in the system, filtered only by excluding self.

export interface ComradeProfile {
    id: string;
    username: string;
    nickname: string;
    clubFan: string;
    countryFan: string;
    phone: string;
    balance: number;
    numberOfBets: number;
}

export function comradeProfileFromJson(json: Record<string, any>): ComradeProfile {
    return {
        id: json?.user_id?.toString() ?? json?.id?.toString() ?? '',
        username: json?.username?.toString() ?? '',
        nickname:
            json?.nickname?.toString() ??
            json?.username?.toString() ??
            'Fan',
        clubFan: json?.club_fan?.toString() ?? '⚽ Football Fan',
        countryFan: json?.country_fan?.toString() ?? '🌍 World',
        phone: json?.phone?.toString() ?? '',
        balance: Number(json?.balance ?? 0),
        numberOfBets: Number(json?.number_of_bets ?? 0),
    };
}

export function comradeInitials(c: ComradeProfile): string {
    return c.nickname.length > 0
        ? c.nickname[0].toUpperCase()
        : '?';
}

export function displayBalance(c: ComradeProfile): string {
    return `KES ${c.balance.toFixed(2)}`;
}