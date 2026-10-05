// apps/mobile/src/lib/api/notification-service.ts
//
// RN port of funspot/lib/services/notification_service.dart — same method
// names, same storage keys, same stream event shapes.
//
// Backed by mobileStorage (MMKV via @/lib/storage/mobile-storage) instead
// of SharedPreferences. mobileStorage.getItem is sync (or returns a
// Promise resolving to a string) — every call site awaits, which is a no-op
// for MMKV and correct if the async AsyncStorage fallback is ever swapped in.
//
// The three StreamControllers from the Dart source are replaced with simple
// listener-registry arrays + emit helpers. RN has no built-in broadcast
// stream equivalent, and this keeps the API identical to the Dart version:
//   notificationStream  → onNotification(cb): unsubscribe
//   badgeStream         → onBadge(cb): unsubscribe
//   joinRequestStream   → onJoinRequest(cb): unsubscribe
//
// _handleBadgeUpdate is called from pushToStream, not from FCM directly —
// same as the Flutter version. Nothing here registers an FCM handler; the
// caller (auth-context or a bootstrap file) receives the message from
// @react-native-firebase/messaging and passes it to pushToStream().

import { mobileStorage } from '../../../../../packages/storage/src/mobile';

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

// ─── Storage keys (exact match to the Dart source) ─────────────────
const K_UNREAD_NOTIFICATIONS = 'unread_notifications';
const K_UNREAD_COUNT = 'unread_notification_count';
const K_UNREAD_COMMENT_COUNT = 'unread_comment_count';
const K_PENDING_JOIN_REQUESTS = 'pending_join_requests';

// ─── Listener registries (replace the three StreamControllers) ─────
type Listener = (event: Record<string, any>) => void;

const _notificationListeners = new Set<Listener>();
const _badgeListeners = new Set<Listener>();
const _joinRequestListeners = new Set<Listener>();

function emitNotification(event: Record<string, any>) {
    for (const cb of Array.from(_notificationListeners)) {
        try { cb(event); } catch (e) { console.warn('notification listener error', e); }
    }
}
function emitBadge(event: Record<string, any>) {
    for (const cb of Array.from(_badgeListeners)) {
        try { cb(event); } catch (e) { console.warn('badge listener error', e); }
    }
}
function emitJoinRequest(event: Record<string, any>) {
    for (const cb of Array.from(_joinRequestListeners)) {
        try { cb(event); } catch (e) { console.warn('join-request listener error', e); }
    }
}

// ─── storage helpers (async wrappers around mobileStorage) ─────────
async function readString(key: string): Promise<string | null> {
    try {
        const v = await mobileStorage.getItem(key);
        return v ?? null;
    } catch {
        return null;
    }
}
async function writeString(key: string, value: string): Promise<void> {
    try {
        await mobileStorage.setItem(key, value);
    } catch (e) {
        console.warn('mobileStorage.setItem failed', key, e);
    }
}
async function removeKey(key: string): Promise<void> {
    try {
        await mobileStorage.removeItem(key);
    } catch (e) {
        console.warn('mobileStorage.removeItem failed', key, e);
    }
}
async function readInt(key: string, fallback = 0): Promise<number> {
    const raw = await readString(key);
    if (raw == null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? fallback : n;
}
async function writeInt(key: string, value: number): Promise<void> {
    await writeString(key, String(value));
}

// ═══════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export const NotificationService = {
    // ─── Stream subscription helpers ────────────────────────────────
    onNotification(cb: Listener): () => void {
        _notificationListeners.add(cb);
        return () => _notificationListeners.delete(cb);
    },
    onBadge(cb: Listener): () => void {
        _badgeListeners.add(cb);
        return () => _badgeListeners.delete(cb);
    },
    onJoinRequest(cb: Listener): () => void {
        _joinRequestListeners.add(cb);
        return () => _joinRequestListeners.delete(cb);
    },

    // ─── pushToStream (called by the FCM handler) ───────────────────
    async pushToStream(payload: Record<string, any>): Promise<void> {
        console.log('[NotificationService] 📨 Pushing to stream:', payload);
        emitNotification(payload);
        await this._handleBadgeUpdate(payload);
    },

    // ─── _handleBadgeUpdate ─────────────────────────────────────────
    async _handleBadgeUpdate(payload: Record<string, any>): Promise<void> {
        try {
            const rawData =
                (payload['data'] as Record<string, any> | undefined) ?? payload;

            let data: Record<string, any> = rawData;
            const nested = rawData['data'];
            if (typeof nested === 'string' && nested.length > 0) {
                try {
                    const decoded = JSON.parse(nested);
                    if (decoded && typeof decoded === 'object') {
                        data = { ...rawData, ...decoded };
                    }
                } catch (e) {
                    console.warn('[NotificationService] ⚠️ nested data decode failed', e);
                }
            }

            const notificationType =
                (data['notificationType'] as string | undefined) ??
                (data['type'] as string | undefined);
            const fixtureId = data['fixture_id'] as string | undefined;

            if (!notificationType) {
                console.warn('[NotificationService] ⚠️ Missing notificationType');
                return;
            }

            // ── join_request ────────────────────────────────────────────
            if (notificationType === 'join_request') {
                const channelId = data['channel_id'] as string | undefined;
                const channelName = data['channel_name'] as string | undefined;
                const userId = data['user_id'] as string | undefined;
                const username = data['username'] as string | undefined;
                const requestId = data['request_id'] as string | undefined;

                console.log(
                    `[NotificationService] 📥 Join request from ${username} for channel ${channelName}`,
                );

                await this._savePendingJoinRequest({
                    channelId: channelId ?? '',
                    channelName: channelName ?? 'Unknown Channel',
                    userId: userId ?? '',
                    username: username ?? 'Unknown User',
                    requestId: requestId ?? '',
                    timestamp: Date.now(),
                });

                emitJoinRequest({
                    type: 'join_request',
                    channel_id: channelId,
                    channel_name: channelName,
                    user_id: userId,
                    username,
                    request_id: requestId,
                    timestamp: Date.now(),
                });

                const newCount = await this._incrementUnreadCount();
                emitBadge({
                    type: 'notification_badge_update',
                    join_request: true,
                    total_unread_notifications: newCount,
                });
                return;
            }

            // ── join_approved ───────────────────────────────────────────
            if (notificationType === 'join_approved') {
                const channelId = data['channel_id'] as string | undefined;
                const channelName = data['channel_name'] as string | undefined;
                const action = data['action'] as string | undefined;

                console.log(`[NotificationService] ✅ Join approved for channel ${channelName}`);

                if (channelId) await this._removePendingJoinRequest(channelId);

                emitBadge({
                    type: 'join_approved',
                    channel_id: channelId,
                    channel_name: channelName,
                    action,
                    timestamp: Date.now(),
                });
                emitNotification({
                    type: 'join_approved',
                    title: '✅ Request Approved!',
                    body: `You have been added to "${channelName}" 🎉`,
                    data,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // ── join_rejected ───────────────────────────────────────────
            if (notificationType === 'join_rejected') {
                const channelId = data['channel_id'] as string | undefined;
                const channelName = data['channel_name'] as string | undefined;

                console.log(`[NotificationService] ❌ Join rejected for channel ${channelName}`);

                if (channelId) await this._removePendingJoinRequest(channelId);

                emitBadge({
                    type: 'join_rejected',
                    channel_id: channelId,
                    channel_name: channelName,
                    timestamp: Date.now(),
                });
                emitNotification({
                    type: 'join_rejected',
                    title: '❌ Request Declined',
                    body: `Your request to join "${channelName}" was declined`,
                    data,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // ── Rust dot-separated vote/pledge/bet types ────────────────
            if (
                notificationType === 'vote.cast' ||
                notificationType === 'pledge.create' ||
                notificationType === 'bet.matched' ||
                notificationType === 'bet.settled'
            ) {
                if (!fixtureId) {
                    console.warn(`[NotificationService] ⚠️ Missing fixture_id for ${notificationType}`);
                    return;
                }
                await this._saveUnreadNotification(fixtureId, notificationType, data);
                const newCommentCount = await this._incrementUnreadCommentCount();
                emitBadge({
                    type: 'comment_badge_update',
                    fixture_id: fixtureId,
                    has_unread: true,
                    total_unread_comments: newCommentCount,
                    notification_type: notificationType,
                    timestamp: Date.now(),
                });
                return;
            }

            // ── vote_supporter / vote_rival / fixture_comment ───────────
            const isVote =
                notificationType === 'vote_supporter' ||
                notificationType === 'vote_rival';
            const isComment =
                notificationType === 'fixture_comment' ||
                notificationType === 'fixture_comment_push';

            if (isVote || isComment) {
                if (!fixtureId) {
                    console.warn('[NotificationService] ⚠️ Missing fixture_id for vote/comment notification');
                    return;
                }
                await this._saveUnreadNotification(fixtureId, notificationType, data);
                const newCommentCount = await this._incrementUnreadCommentCount();
                emitBadge({
                    type: 'comment_badge_update',
                    fixture_id: fixtureId,
                    has_unread: true,
                    total_unread_comments: newCommentCount,
                    notification_type: notificationType,
                    timestamp: Date.now(),
                });
            }

            // ── comrade_added ───────────────────────────────────────────
            if (notificationType === 'comrade_added') {
                const newCount = await this._incrementUnreadCount();
                emitBadge({
                    type: 'notification_badge_update',
                    comrade_added: true,
                    total_unread_notifications: newCount,
                });
            }

            // ── like / post_comment ─────────────────────────────────────
            if (notificationType === 'like' || notificationType === 'post_comment') {
                const newCount = await this._incrementUnreadCount();
                emitBadge({
                    type: 'notification_badge_update',
                    notification_type: notificationType,
                    total_unread_notifications: newCount,
                });
            }
        } catch (e) {
            console.warn('[NotificationService] ❌ Badge update error:', e);
        }
    },

    // ─── reconcileFromServer ────────────────────────────────────────
    async reconcileFromServer(opts: {
        userId: string;
        authToken?: string;
        adminChannelIds?: string[];
    }): Promise<void> {
        const { userId, authToken, adminChannelIds = [] } = opts;
        try {
            console.log(`[NotificationService] 🔄 Reconciling with server for ${userId}`);

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

            const [unreadSummary, truePendingCount] = await Promise.all([
                this._fetchUnreadSummary(userId, headers),
                this._fetchTruePendingJoinCount(adminChannelIds, headers),
            ]);

            if (unreadSummary) {
                await writeInt(K_UNREAD_COUNT, unreadSummary.notifications ?? 0);
                await writeInt(K_UNREAD_COMMENT_COUNT, unreadSummary.comments ?? 0);
                emitBadge({
                    type: 'notification_badge_update',
                    total_unread_notifications: unreadSummary.notifications ?? 0,
                });
                emitBadge({
                    type: 'comment_badge_update',
                    total_unread_comments: unreadSummary.comments ?? 0,
                });
                console.log(
                    `[NotificationService] ✅ Reconciled: notifications=${unreadSummary.notifications}, comments=${unreadSummary.comments}`,
                );
            } else {
                console.log('[NotificationService] ⏭️ Skipped notification reconcile');
            }

            if (truePendingCount != null) {
                emitBadge({
                    type: 'pending_join_count_sync',
                    total_pending_joins: truePendingCount,
                });
                console.log(`[NotificationService] ✅ Reconciled pending joins: ${truePendingCount}`);
            }
        } catch (e) {
            console.warn('[NotificationService] ❌ reconcileFromServer error:', e);
        }
    },

    async _fetchUnreadSummary(
        userId: string,
        headers: Record<string, string>,
    ): Promise<{ notifications: number; comments: number } | null> {
        try {
            const res = await fetch(
                `${API_BASE_URL}/notifications/unread-summary/${userId}`,
                { headers },
            );
            if (res.status === 200) {
                const data = await res.json();
                return {
                    notifications: Number(data?.notifications ?? 0),
                    comments: Number(data?.comments ?? 0),
                };
            }
            console.warn(`[NotificationService] ⚠️ unread-summary failed: ${res.status}`);
            return null;
        } catch (e) {
            console.warn('[NotificationService] ❌ _fetchUnreadSummary error:', e);
            return null;
        }
    },

    async _fetchTruePendingJoinCount(
        adminChannelIds: string[],
        headers: Record<string, string>,
    ): Promise<number | null> {
        if (adminChannelIds.length === 0) return 0;
        try {
            let total = 0;
            for (const channelId of adminChannelIds) {
                const res = await fetch(
                    `${API_BASE_URL}/channels/${channelId}/pending-requests`,
                    { headers },
                );
                if (res.status === 200) {
                    const data = await res.json();
                    const requests = Array.isArray(data?.pending_requests)
                        ? data.pending_requests
                        : [];
                    total += requests.length;
                }
            }
            return total;
        } catch (e) {
            console.warn('[NotificationService] ❌ _fetchTruePendingJoinCount error:', e);
            return null;
        }
    },

    // ─── Pending join requests ──────────────────────────────────────
    async _savePendingJoinRequest(args: {
        channelId: string;
        channelName: string;
        userId: string;
        username: string;
        requestId: string;
        timestamp: number;
    }): Promise<void> {
        try {
            const raw = await readString(K_PENDING_JOIN_REQUESTS);
            const pendingRequests: any[] = raw ? JSON.parse(raw) : [];

            const exists = pendingRequests.some(
                (r) => r.channel_id === args.channelId && r.user_id === args.userId,
            );
            if (exists) return;

            pendingRequests.push({
                channel_id: args.channelId,
                channel_name: args.channelName,
                user_id: args.userId,
                username: args.username,
                request_id: args.requestId,
                timestamp: args.timestamp,
                status: 'pending',
            });
            await writeString(K_PENDING_JOIN_REQUESTS, JSON.stringify(pendingRequests));
            console.log(
                `[NotificationService] 💾 Saved pending join request for ${args.username} -> ${args.channelName}`,
            );
        } catch (e) {
            console.warn('[NotificationService] ❌ Save pending request error:', e);
        }
    },

    async getPendingJoinRequests(): Promise<Record<string, any>[]> {
        try {
            const raw = await readString(K_PENDING_JOIN_REQUESTS);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('[NotificationService] ❌ Get pending requests error:', e);
            return [];
        }
    },

    async getPendingRequestsForChannel(channelId: string): Promise<Record<string, any>[]> {
        const all = await this.getPendingJoinRequests();
        return all.filter((r) => r.channel_id === channelId);
    },

    async _removePendingJoinRequest(channelId: string): Promise<void> {
        try {
            const raw = await readString(K_PENDING_JOIN_REQUESTS);
            if (!raw) return;
            const pending: any[] = JSON.parse(raw);
            const next = pending.filter((r) => r.channel_id !== channelId);
            await writeString(K_PENDING_JOIN_REQUESTS, JSON.stringify(next));
            console.log(`[NotificationService] 🗑️ Removed pending request for channel ${channelId}`);
        } catch (e) {
            console.warn('[NotificationService] ❌ Remove pending request error:', e);
        }
    },

    async removePendingRequestById(requestId: string): Promise<void> {
        try {
            const raw = await readString(K_PENDING_JOIN_REQUESTS);
            if (!raw) return;
            const pending: any[] = JSON.parse(raw);
            const next = pending.filter((r) => r.request_id !== requestId);
            await writeString(K_PENDING_JOIN_REQUESTS, JSON.stringify(next));
            console.log(`[NotificationService] 🗑️ Removed pending request ${requestId}`);
        } catch (e) {
            console.warn('[NotificationService] ❌ Remove pending request error:', e);
        }
    },

    async hasPendingRequest(args: {
        channelId: string;
        userId: string;
    }): Promise<boolean> {
        const requests = await this.getPendingJoinRequests();
        return requests.some(
            (r) => r.channel_id === args.channelId && r.user_id === args.userId,
        );
    },

    async clearAllPendingRequests(): Promise<void> {
        try {
            await removeKey(K_PENDING_JOIN_REQUESTS);
            console.log('[NotificationService] 🗑️ Cleared all pending requests');
        } catch (e) {
            console.warn('[NotificationService] ❌ Clear pending requests error:', e);
        }
    },

    // ─── Unread notification storage ────────────────────────────────
    async _saveUnreadNotification(
        fixtureId: string,
        notificationType: string,
        data: Record<string, any>,
    ): Promise<void> {
        try {
            const raw = await readString(K_UNREAD_NOTIFICATIONS);
            const unreadMap: Record<string, any> = raw ? JSON.parse(raw) : {};

            if (!unreadMap[fixtureId]) {
                unreadMap[fixtureId] = {
                    has_unread: true,
                    types: [],
                    last_notification_time: Date.now(),
                    notification_data: [],
                };
            }

            const fixtureData = unreadMap[fixtureId];
            const types: string[] = Array.isArray(fixtureData.types)
                ? fixtureData.types
                : [];
            if (!types.includes(notificationType)) types.push(notificationType);
            fixtureData.types = types;

            fixtureData.last_notification_time = Date.now();

            let notifications: any[] = Array.isArray(fixtureData.notification_data)
                ? fixtureData.notification_data
                : [];
            notifications.unshift({
                type: notificationType,
                title: data?.title ?? '',
                body: data?.body ?? '',
                timestamp: Date.now(),
                data,
            });
            if (notifications.length > 10) notifications = notifications.slice(0, 10);
            fixtureData.notification_data = notifications;

            await writeString(K_UNREAD_NOTIFICATIONS, JSON.stringify(unreadMap));
        } catch (e) {
            console.warn('[NotificationService] ❌ Save unread error:', e);
        }
    },

    async hasUnreadForFixture(fixtureId: string): Promise<boolean> {
        try {
            const raw = await readString(K_UNREAD_NOTIFICATIONS);
            if (!raw) return false;
            const map = JSON.parse(raw);
            return map?.[fixtureId]?.has_unread === true;
        } catch {
            return false;
        }
    },

    async getUnreadCountForFixture(fixtureId: string): Promise<number> {
        try {
            const raw = await readString(K_UNREAD_NOTIFICATIONS);
            if (!raw) return 0;
            const map = JSON.parse(raw);
            const data = map?.[fixtureId];
            const list = Array.isArray(data?.notification_data)
                ? data.notification_data
                : [];
            return list.length;
        } catch {
            return 0;
        }
    },

    async getAllUnreadData(): Promise<Record<string, Record<string, any>>> {
        try {
            const raw = await readString(K_UNREAD_NOTIFICATIONS);
            if (!raw) return {};
            const map = JSON.parse(raw);
            const result: Record<string, Record<string, any>> = {};
            for (const [fixtureId, data] of Object.entries<any>(map)) {
                if (data?.has_unread === true) {
                    const list = Array.isArray(data.notification_data)
                        ? data.notification_data
                        : [];
                    result[fixtureId] = {
                        count: list.length,
                        has_unread: true,
                        types: data.types ?? [],
                        last_notification_time: data.last_notification_time,
                        latest_notification: list.length > 0 ? list[0] : null,
                    };
                }
            }
            console.log(`[NotificationService] 📊 Loaded unread data for ${Object.keys(result).length} fixtures`);
            return result;
        } catch (e) {
            console.warn('[NotificationService] ❌ getAllUnreadData error:', e);
            return {};
        }
    },

    async getAllUnreadFixtures(): Promise<string[]> {
        try {
            const raw = await readString(K_UNREAD_NOTIFICATIONS);
            if (!raw) return [];
            const map = JSON.parse(raw);
            const result: string[] = [];
            for (const [fixtureId, data] of Object.entries<any>(map)) {
                if (data?.has_unread === true) result.push(fixtureId);
            }
            return result;
        } catch {
            return [];
        }
    },

    async getAllUnreadFixturesWithDetails(): Promise<Record<string, any>> {
        try {
            const raw = await readString(K_UNREAD_NOTIFICATIONS);
            if (!raw) return {};
            const map = JSON.parse(raw);
            const result: Record<string, any> = {};
            for (const [fixtureId, data] of Object.entries<any>(map)) {
                if (data?.has_unread === true) {
                    const list = Array.isArray(data.notification_data)
                        ? data.notification_data
                        : [];
                    result[fixtureId] = {
                        has_unread: true,
                        types: data.types ?? [],
                        last_notification_time: data.last_notification_time,
                        latest_notification: list.length > 0 ? list[0] : null,
                        notification_count: list.length,
                    };
                }
            }
            return result;
        } catch {
            return {};
        }
    },

    async markFixtureAsRead(fixtureId: string): Promise<void> {
        try {
            const raw = await readString(K_UNREAD_NOTIFICATIONS);
            if (!raw) return;
            const map = JSON.parse(raw);
            if (!map[fixtureId]) return;

            const count = Array.isArray(map[fixtureId].notification_data)
                ? map[fixtureId].notification_data.length
                : 0;

            map[fixtureId].has_unread = false;
            map[fixtureId].types = [];
            await writeString(K_UNREAD_NOTIFICATIONS, JSON.stringify(map));

            for (let i = 0; i < count; i++) {
                await this._decrementUnreadCommentCount();
            }

            emitBadge({
                type: 'comment_badge_cleared',
                fixture_id: fixtureId,
                total_unread_comments: await this._getUnreadCommentCount(),
            });
            console.log(`[NotificationService] ✅ Marked fixture ${fixtureId} as read (cleared ${count})`);
        } catch (e) {
            console.warn('[NotificationService] ❌ Mark read error:', e);
        }
    },

    async markAllCommentsAsRead(): Promise<void> {
        try {
            await removeKey(K_UNREAD_NOTIFICATIONS);
            await writeInt(K_UNREAD_COMMENT_COUNT, 0);
            emitBadge({ type: 'comment_badge_cleared_all', total_unread_comments: 0 });
            console.log('[NotificationService] ✅ Marked all comment notifications as read');
        } catch (e) {
            console.warn('[NotificationService] ❌ Mark all comments read error:', e);
        }
    },

    async markAllNotificationsAsRead(): Promise<void> {
        try {
            await writeInt(K_UNREAD_COUNT, 0);
            emitBadge({ type: 'notification_badge_cleared_all', total_unread_notifications: 0 });
            console.log('[NotificationService] ✅ Marked all notifications as read');
        } catch (e) {
            console.warn('[NotificationService] ❌ Mark all notifications read error:', e);
        }
    },

    async _getUnreadCommentCount(): Promise<number> {
        return readInt(K_UNREAD_COMMENT_COUNT, 0);
    },
    async getTotalUnreadCommentCount(): Promise<number> {
        return this._getUnreadCommentCount();
    },
    async _getUnreadCount(): Promise<number> {
        return readInt(K_UNREAD_COUNT, 0);
    },
    async getTotalUnreadNotificationCount(): Promise<number> {
        return this._getUnreadCount();
    },

    async _incrementUnreadCommentCount(): Promise<number> {
        const current = await readInt(K_UNREAD_COMMENT_COUNT, 0);
        const next = current + 1;
        await writeInt(K_UNREAD_COMMENT_COUNT, next);
        return next;
    },
    async _decrementUnreadCommentCount(): Promise<number> {
        const current = await readInt(K_UNREAD_COMMENT_COUNT, 0);
        const next = current > 0 ? current - 1 : 0;
        await writeInt(K_UNREAD_COMMENT_COUNT, next);
        return next;
    },
    async _incrementUnreadCount(): Promise<number> {
        const current = await readInt(K_UNREAD_COUNT, 0);
        const next = current + 1;
        await writeInt(K_UNREAD_COUNT, next);
        return next;
    },
    async _decrementUnreadCount(): Promise<number> {
        const current = await readInt(K_UNREAD_COUNT, 0);
        const next = current > 0 ? current - 1 : 0;
        await writeInt(K_UNREAD_COUNT, next);
        return next;
    },

    async markFixtureAsUnread(
        fixtureId: string,
        notificationType: string,
        data: Record<string, any>,
    ): Promise<void> {
        await this._saveUnreadNotification(fixtureId, notificationType, data);
        await this._incrementUnreadCommentCount();
    },

    async clearUnreadForFixture(fixtureId: string): Promise<void> {
        try {
            const raw = await readString(K_UNREAD_NOTIFICATIONS);
            if (!raw) return;
            const map = JSON.parse(raw);
            if (!map[fixtureId]) return;
            const count = Array.isArray(map[fixtureId].notification_data)
                ? map[fixtureId].notification_data.length
                : 0;
            delete map[fixtureId];
            await writeString(K_UNREAD_NOTIFICATIONS, JSON.stringify(map));
            for (let i = 0; i < count; i++) await this._decrementUnreadCommentCount();
            console.log(`[NotificationService] ✅ Cleared all unread for fixture ${fixtureId}`);
        } catch (e) {
            console.warn('[NotificationService] ❌ Clear unread error:', e);
        }
    },

    // ─── Token registration ─────────────────────────────────────────
    async registerToken(args: {
        userId: string;
        fcmToken: string;
        platform: string;
        authToken?: string;
    }): Promise<boolean> {
        const { userId, fcmToken, platform, authToken } = args;
        try {
            console.log(`[NotificationService] 📤 Registering token for user ${userId}`);
            const res = await fetch(`${API_BASE_URL}/notifications/register-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify({
                    user_id: userId,
                    fcm_token: fcmToken,
                    platform,
                }),
            });
            if (res.status === 200 || res.status === 201) {
                const data = await res.json();
                return data?.success === true;
            }
            return false;
        } catch (e) {
            console.warn('[NotificationService] ❌ registerToken error:', e);
            return false;
        }
    },

    // ─── sendNotification ───────────────────────────────────────────
    async sendNotification(args: {
        userId: string;
        notificationType: string;
        title: string;
        body: string;
        data: Record<string, any>;
    }): Promise<boolean> {
        const { userId, notificationType, title, body, data } = args;
        try {
            console.log(`[NotificationService] 📤 Sending "${notificationType}" to ${userId}`);
            const res = await fetch(`${API_BASE_URL}/notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    notification_type: notificationType,
                    title,
                    body,
                    data,
                }),
            });
            return res.status === 200;
        } catch (e) {
            console.warn('[NotificationService] ❌ sendNotification error:', e);
            return false;
        }
    },

    // ─── markAsRead (server sync) ───────────────────────────────────
    async markAsRead(args: {
        userId: string;
        notificationIds?: string[];
    }): Promise<void> {
        try {
            const body: Record<string, any> = { user_id: args.userId };
            if (args.notificationIds) body.notification_ids = args.notificationIds;
            await fetch(`${API_BASE_URL}/notifications/mark-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } catch (e) {
            console.warn('[NotificationService] ❌ markAsRead error:', e);
        }
    },

    // ─── comrade notifications ──────────────────────────────────────
    handleComradeNotification(data: Record<string, any>): void {
        const type = data?.type ?? '';
        if (type !== 'comrade_added') return;

        const username = data?.username ?? 'Someone';
        emitNotification({
            type: 'comrade_added',
            title: 'New Comrade! 🎉',
            body: `${username} added you as a comrade`,
            data,
            timestamp: new Date().toISOString(),
        });
        void this._incrementUnreadCount().then((newCount) => {
            emitBadge({
                type: 'notification_badge_update',
                comrade_added: true,
                total_unread_notifications: newCount,
            });
        });
    },

    async notifyComradeAdded(args: {
        userId: string;
        comradeUsername: string;
        authToken: string;
    }): Promise<boolean> {
        return this.sendNotification({
            userId: args.userId,
            notificationType: 'comrade_added',
            title: 'New Comrade! 🎉',
            body: `${args.comradeUsername} added you as a comrade`,
            data: {
                type: 'comrade_added',
                timestamp: new Date().toISOString(),
            },
        });
    },

    // ─── preferences ────────────────────────────────────────────────
    async getNotificationPreferences(
        userId: string,
    ): Promise<{ vote_alerts: boolean; like_alerts: boolean; comment_alerts: boolean }> {
        const defaults = {
            vote_alerts: true,
            like_alerts: true,
            comment_alerts: true,
        };
        try {
            const res = await fetch(
                `${API_BASE_URL}/notifications/preferences/${userId}`,
            );
            if (res.status === 200) {
                const data = await res.json();
                return {
                    vote_alerts: data?.vote_alerts ?? true,
                    like_alerts: data?.like_alerts ?? true,
                    comment_alerts: data?.comment_alerts ?? true,
                };
            }
        } catch (e) {
            console.warn('[NotificationService] ❌ getPreferences error:', e);
        }
        return defaults;
    },

    async updateNotificationPreferences(args: {
        userId: string;
        voteAlerts: boolean;
        likeAlerts: boolean;
        commentAlerts: boolean;
        authToken?: string;
    }): Promise<boolean> {
        const { userId, voteAlerts, likeAlerts, commentAlerts, authToken } = args;
        try {
            const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify({
                    user_id: userId,
                    vote_alerts: voteAlerts,
                    like_alerts: likeAlerts,
                    comment_alerts: commentAlerts,
                }),
            });
            return res.status === 200;
        } catch (e) {
            console.warn('[NotificationService] ❌ updatePreferences error:', e);
            return false;
        }
    },

    // ─── initial badge counts ───────────────────────────────────────
    async loadInitialBadgeCounts(): Promise<{ unread_comments: number; unread_notifications: number }> {
        const unread_comments = await readInt(K_UNREAD_COMMENT_COUNT, 0);
        const unread_notifications = await readInt(K_UNREAD_COUNT, 0);
        return { unread_comments, unread_notifications };
    },

    async getTotalUnreadCount(): Promise<number> {
        return this._getUnreadCount();
    },

    // ─── permission status ──────────────────────────────────────────
    // Dart returns 'granted' | 'denied' | 'default' on web, 'unsupported'
    // elsewhere. On RN the equivalent is a native module call
    // (@react-native-firebase/messaging's requestPermission / hasPermission).
    // Not ported here — the caller handles permission prompts directly.
    getPermissionStatus(): 'unsupported' {
        return 'unsupported';
    },

    // ─── cleanup ────────────────────────────────────────────────────
    dispose(): void {
        _notificationListeners.clear();
        _badgeListeners.clear();
        _joinRequestListeners.clear();
    },
};

export default NotificationService;