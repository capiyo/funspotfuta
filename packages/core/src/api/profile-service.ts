// Ported from lib/WebView/Hompage/sidebar_profile.dart's WebUserData
// model and _loadUserData()/_saveProfile() methods. Not previously
// ported — added when reviewing upstream commits e9b4442..ccbf0e4.

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

export interface UserProfile {
  userId: string;
  username: string;
  phone: string;
  nickname: string;
  clubFan: string;
  countryFan: string;
  numberOfBets: number;
  balance: number;
}

function userProfileFromJson(json: any): UserProfile {
  return {
    userId: (json.user_id ?? json.userId ?? '').toString(),
    username: (json.username ?? '').toString(),
    phone: (json.phone ?? '').toString(),
    nickname: (json.nickname ?? '').toString(),
    clubFan: (json.club_fan ?? '').toString(),
    countryFan: (json.country_fan ?? '').toString(),
    numberOfBets: json.number_of_bets ?? 0,
    balance: Number(json.balance ?? 0),
  };
}

function headers(authToken?: string): HeadersInit {
  return { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };
}

// GET /api/profile/profile/:userId — response may be a bare object or a
// one-element array depending on the route, matching the Dart
// _loadUserData()'s handling of both shapes.
export async function getProfile(userId: string, authToken?: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/profile/profile/${userId}`, { headers: headers(authToken) });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) {
      if (data.length === 0) return null;
      return userProfileFromJson(data[0]);
    }
    return userProfileFromJson(data);
  } catch (e) {
    console.error('getProfile failed:', e);
    return null;
  }
}

export interface SaveProfileParams {
  userId: string;
  nickname: string;
  clubFan: string;
  countryFan: string;
  authToken?: string;
}

// POST/PUT /api/profile/profile/:userId — the Dart _saveProfile() tries
// PUT first (existing profile), falling back to POST (create) — same
// fallback here.
export async function saveProfile(p: SaveProfileParams): Promise<boolean> {
  const body = JSON.stringify({ nickname: p.nickname, club_fan: p.clubFan, country_fan: p.countryFan });
  try {
    const putRes = await fetch(`${API_BASE_URL}/profile/profile/${p.userId}`, {
      method: 'PUT',
      headers: headers(p.authToken),
      body,
    });
    if (putRes.ok) return true;

    const postRes = await fetch(`${API_BASE_URL}/profile/profile/${p.userId}`, {
      method: 'POST',
      headers: headers(p.authToken),
      body,
    });
    return postRes.ok;
  } catch (e) {
    console.error('saveProfile failed:', e);
    return false;
  }
}
