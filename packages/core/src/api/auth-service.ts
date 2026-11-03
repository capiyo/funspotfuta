// Ported from the backend calls inside funspot/lib/modals/login_modal.dart.
// The Flutter app also supports Firebase Phone-Auth OTP as a fallback path
// for brand-new numbers (see lib/services/firebase_auth_service.dart) — that
// requires the project's live Firebase reCAPTCHA/SMS setup and is flagged as
// a follow-up in the README rather than faked here. The PIN login/registration
// path below is backend-only and fully wired against the real API.

import { AUTH_BASE, authHeaders } from './config';

export interface BackendUser {
  id: string;
  username: string;
  phone?: string;
  has_pin?: boolean;
  [key: string]: any;
}

export interface AuthResult {
  ok: boolean;
  token?: string;
  user?: BackendUser;
  message?: string;
  status?: number;
}

// GET /api/auth/check-user/:e164  -> { exists, user, has_pin }
export async function checkUser(e164Phone: string): Promise<(BackendUser & { has_pin?: boolean }) | null> {
  try {
    const res = await fetch(`${AUTH_BASE}/check-user/${encodeURIComponent(e164Phone)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.exists === true) {
      return { ...(data.user ?? {}), has_pin: data.has_pin };
    }
    return null;
  } catch (e) {
    console.error('checkUser failed:', e);
    return null;
  }
}

// GET /api/auth/user/username/:username -> taken if success && user present
export async function isUsernameTaken(username: string): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH_BASE}/user/username/${encodeURIComponent(username)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.success === true && data?.user != null;
  } catch (e) {
    console.error('isUsernameTaken failed:', e);
    return false;
  }
}

// POST /api/auth/pin-login { phone, pin } -> { token, user }
export async function pinLogin(phone: string, pin: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${AUTH_BASE}/pin-login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone, pin }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.token && body?.user?.id) {
      return { ok: true, token: body.token, user: body.user, status: res.status };
    }
    return { ok: false, message: body?.message ?? 'Incorrect PIN', status: res.status };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'pin-login request failed' };
  }
}

// POST /api/auth/set-pin/:userId { pin } -> { token, user }
// Used when a user already exists (verified by phone) but has no PIN yet.
export async function setPin(userId: string, pin: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${AUTH_BASE}/set-pin/${userId}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ pin }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.token) {
      return { ok: true, token: body.token, user: body.user, status: res.status };
    }
    return { ok: false, message: body?.message ?? 'Failed to set PIN', status: res.status };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'set-pin request failed' };
  }
}

// POST /api/auth/register { username, phone, pin } -> { token, user }
export async function registerUser(username: string, phone: string, pin?: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${AUTH_BASE}/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ username, phone, ...(pin ? { pin } : {}) }),
    });
    const body = await res.json().catch(() => null);
    if ((res.status === 200 || res.status === 201) && body?.token && body?.user?.id) {
      return { ok: true, token: body.token, user: body.user, status: res.status };
    }
    return { ok: false, message: body?.message ?? 'Registration failed', status: res.status };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'register request failed' };
  }
}