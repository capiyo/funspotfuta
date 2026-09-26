
// packages/core/src/api/notification-service.ts
//
// Ported from funspot/lib/services/notification_service.dart. Originally
// only the plain-REST parts were ported (unread summary, mark-read,
// preferences) — FCM token registration was intentionally left out,
// per the old header note. That gap is now closed: registerToken is
// added below, matching the Dart implementation's request/response
// shape exactly (user_id/fcm_token/platform body, {success: bool} reply,
// 200 or 201 both treated as success).
//
// Note ported verbatim from the original source: the unread-summary route
// is flagged there as possibly not existing on the backend yet ("Add that
// route on the Rust side if it doesn't exist yet") — this call is written
// to fail soft (returns null) exactly like the original, for that reason.

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

function jsonHeaders(authToken?: string): HeadersInit {
  return { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export interface UnreadSummary {
  notifications: number;
  comments: number;
}

// GET /api/notifications/unread-summary/:userId — may not exist on the
// backend yet (see file header note); fails soft to null, same as Dart.
export async function fetchUnreadSummary(userId: string, authToken?: string): Promise<UnreadSummary | null> {
  try {
    const res = await withTimeout(
      fetch(`${API_BASE_URL}/notifications/unread-summary/${userId}`, { headers: jsonHeaders(authToken) }),
      10000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { notifications: Number(data.notifications ?? 0), comments: Number(data.comments ?? 0) };
  } catch (e) {
    console.error('fetchUnreadSummary failed:', e);
    return null;
  }
}

// Sums real pending-join-request counts across every channel the user
// admins, reusing the per-channel endpoint — no dedicated summary route
// needed for this part, matching the original.
export async function fetchTruePendingJoinCount(adminChannelIds: string[], authToken?: string): Promise<number> {
  if (adminChannelIds.length === 0) return 0;
  let total = 0;
  for (const channelId of adminChannelIds) {
    try {
      const res = await withTimeout(
        fetch(`${API_BASE_URL}/channels/${channelId}/pending-requests`, { headers: jsonHeaders(authToken) }),
        10000
      );
      if (res.ok) {
        const data = await res.json();
        total += (data.pending_requests ?? []).length;
      }
    } catch {
      /* skip this channel, keep summing the rest — matches original best-effort loop */
    }
  }
  return total;
}

// ─── Token registration ─────────────────────────────────────────────────────
// POST /api/notifications/register-token
// Ported from NotificationService.registerToken in notification_service.dart.
// Body: { user_id, fcm_token, platform }. Success requires status 200/201
// AND body.success === true — matches the Dart check exactly.
export async function registerToken(p: {
  userId: string;
  fcmToken: string;
  platform: 'ios' | 'android' | 'web';
  authToken?: string;
}): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch(`${API_BASE_URL}/notifications/register-token`, {
        method: 'POST',
        headers: jsonHeaders(p.authToken),
        body: JSON.stringify({
          user_id: p.userId,
          fcm_token: p.fcmToken,
          platform: p.platform,
        }),
      }),
      10000
    );
    if (res.status !== 200 && res.status !== 201) return false;
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error('registerToken failed:', e);
    return false;
  }
}

// POST /api/notifications/send
export async function sendNotification(p: {
  userId: string;
  notificationType: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch(`${API_BASE_URL}/notifications/send`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          user_id: p.userId,
          notification_type: p.notificationType,
          title: p.title,
          body: p.body,
          data: p.data ?? {},
        }),
      }),
      5000
    );
    return res.status === 200;
  } catch (e) {
    console.error('sendNotification failed:', e);
    return false;
  }
}

// POST /api/notifications/mark-read
export async function markAsRead(userId: string, notificationIds?: string[]): Promise<void> {
  try {
    await withTimeout(
      fetch(`${API_BASE_URL}/notifications/mark-read`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ user_id: userId, ...(notificationIds ? { notification_ids: notificationIds } : {}) }),
      }),
      10000
    );
  } catch (e) {
    console.error('markAsRead failed:', e);
  }
}

export async function notifyComradeAdded(userId: string, comradeUsername: string): Promise<boolean> {
  return sendNotification({
    userId,
    notificationType: 'comrade_added',
    title: 'New Comrade! 🎉',
    body: `${comradeUsername} added you as a comrade`,
    data: { type: 'comrade_added', timestamp: new Date().toISOString() },
  });
}

export interface NotificationPreferences {
  vote_alerts: boolean;
  like_alerts: boolean;
  comment_alerts: boolean;
}
const DEFAULT_PREFS: NotificationPreferences = { vote_alerts: true, like_alerts: true, comment_alerts: true };

// GET /api/notifications/preferences/:userId
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const res = await withTimeout(fetch(`${API_BASE_URL}/notifications/preferences/${userId}`), 10000);
    if (res.ok) {
      const data = await res.json();
      return {
        vote_alerts: data.vote_alerts ?? true,
        like_alerts: data.like_alerts ?? true,
        comment_alerts: data.comment_alerts ?? true,
      };
    }
  } catch (e) {
    console.error('getNotificationPreferences failed:', e);
  }
  return DEFAULT_PREFS;
}

// POST /api/notifications/preferences
export async function updateNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
  authToken?: string
): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch(`${API_BASE_URL}/notifications/preferences`, {
        method: 'POST',
        headers: jsonHeaders(authToken),
        body: JSON.stringify({ user_id: userId, ...prefs }),
      }),
      10000
    );
    return res.status === 200;
  } catch (e) {
    console.error('updateNotificationPreferences failed:', e);
    return false;
  }
}