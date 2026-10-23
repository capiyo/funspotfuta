// Local model for the ComradeList modal. Flattened view of a user profile.
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
    nickname: json?.nickname?.toString() ?? json?.username?.toString() ?? 'Fan',
    clubFan: json?.club_fan?.toString() ?? '⚽ Football Fan',
    countryFan: json?.country_fan?.toString() ?? '🌍 World',
    phone: json?.phone?.toString() ?? '',
    balance: Number(json?.balance ?? 0),
    numberOfBets: Number(json?.number_of_bets ?? 0),
  };
}
export function comradeInitials(c: ComradeProfile): string {
  return c.nickname.length > 0 ? c.nickname[0].toUpperCase() : '?';
}
export function displayBalance(c: ComradeProfile): string {
  return `KES ${c.balance.toFixed(2)}`;
}
