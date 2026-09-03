// The Flutter app's backend is unchanged by this migration — same values as
// database_service.dart / comrade_service.dart / login_modal.dart.
export const API_BASE = 'https://clash-api-m5mr.onrender.com/api';
export const AUTH_BASE = `${API_BASE}/auth`;

export function authHeaders(token?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
