// @funspot/core/src/api/channels-service.ts
// Channel API operations. Channel and ChannelMember types/parsers live in
// types/channels.ts and are the single canonical definitions.

import {
  channelFromJson,
  channelMemberFromJson,
} from '../types/channels';
import type { Channel, ChannelMember } from '../types/channels';
export type { Channel, ChannelMember } from '../types/channels';

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function asInt(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function asDateTime(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

function authHeaders(authToken?: string): HeadersInit {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// ============================================================================
// API CALLS
// ============================================================================

// GET /api/channels/user/:userId — channels the user is a member of.
export async function getUserChannels(userId: string, authToken?: string): Promise<Channel[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/user/${userId}`, {
            headers: { 'Content-Type': 'application/json', ...authHeaders(authToken) },
        });
        if (!res.ok) return [];
        const data = await res.json();
        const list = data.channels ?? [];
        return list.map(channelFromJson);
    } catch (e) {
        console.error('getUserChannels failed:', e);
        return [];
    }
}

// GET /api/channels/all — matches _fetchAllChannelsForBrowsing in
// home_page.dart. authToken is optional (works logged-out too); filtering
// out already-joined channels is left to the caller.
export async function getAllChannels(authToken?: string): Promise<Channel[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/all`, {
            headers: { 'Content-Type': 'application/json', ...authHeaders(authToken) },
        });
        if (!res.ok) return [];
        const data = await res.json();
        const list = data.channels ?? [];
        return list.map(channelFromJson);
    } catch (e) {
        console.error('getAllChannels failed:', e);
        return [];
    }
}

// ============================================================================
// CHANNEL DETAIL (admin dashboard)
// ============================================================================
//
// GET /api/channels/:channelId — returns the channel document plus its
// activity block. The Flutter admin_dashboard_modal.dart reads:
//   channel['member_count']
//   channel['activity']['total_messages']
//   channel['activity']['messages_this_week']
//   channel['activity']['total_votes']
//   channel['members']
// This flattens those into a single object so callers don't have to
// walk into `activity.*` themselves.

export interface ChannelDetail {
    channelId: string;
    name: string;
    memberCount: number;
    totalMessages: number;
    messagesThisWeek: number;
    totalVotes: number;
    totalLikes: number;
    balance: number;
    members: ChannelMember[];
}

export async function getChannelDetail(
    channelId: string,
    authToken?: string,
): Promise<ChannelDetail | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
            headers: { 'Content-Type': 'application/json', ...authHeaders(authToken) },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const channel = data.channel;
        if (!channel) return null;

        const activity = channel.activity ?? {};
        const membersData: any[] = Array.isArray(channel.members) ? channel.members : [];
        const members: ChannelMember[] = membersData
            .filter((m) => m && typeof m === 'object')
            .map((m) => channelMemberFromJson(m));

        return {
            channelId: asString(channel.channel_id ?? channel.channelId ?? channelId),
            name: asString(channel.name, 'Unknown Channel'),
            memberCount: asInt(
                channel.member_count ?? channel.memberCount,
                members.length,
            ),
            totalMessages: asInt(activity.total_messages ?? activity.totalMessages),
            messagesThisWeek: asInt(
                activity.messages_this_week ?? activity.messagesThisWeek,
            ),
            totalVotes: asInt(activity.total_votes ?? activity.totalVotes),
            totalLikes: asInt(activity.total_likes ?? activity.totalLikes),
            balance: Number(channel.balance ?? 0) || 0,
            members,
        };
    } catch (e) {
        console.error('getChannelDetail failed:', e);
        return null;
    }
}

// ============================================================================
// REMOVE MEMBER (admin)
// ============================================================================
//
// POST /api/channels/members/remove — matches _removeMember in
// admin_dashboard_modal.dart. Admin-only endpoint; the backend deducts
// 30 points from the target as an anti-hopping measure.

export interface RemoveMemberResult {
    success: boolean;
    message?: string;
}

export async function removeMember(
    channelId: string,
    targetUserId: string,
    removedByUserId: string,
    authToken: string,
): Promise<RemoveMemberResult> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/members/remove`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                channel_id: channelId,
                user_id: targetUserId,
                removed_by: removedByUserId,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return {
                success: false,
                message: data?.message ?? `Failed to remove member (${res.status})`,
            };
        }
        return { success: true, message: data?.message };
    } catch (e: any) {
        console.error('removeMember failed:', e);
        return { success: false, message: e?.message ?? 'Network error' };
    }
}

// POST /api/channels/members/add — matches _joinChannelDirectly and
// _addComradeToChannels. Same endpoint serves both "I join a channel
// myself" and "an admin adds a comrade" — only the member identity differs.
export async function addChannelMember(
    channelId: string,
    member: { userId: string; username: string },
    authToken: string,
): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/members/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({
                channel_id: channelId,
                members: [{ user_id: member.userId, username: member.username }],
            }),
        });
        return res.ok;
    } catch (e) {
        console.error('addChannelMember failed:', e);
        return false;
    }
}

// Thin wrapper matching Dart's naming — joining yourself is just adding
// yourself as a member.
export async function joinChannel(
    channelId: string,
    user: { userId: string; username: string },
    authToken: string,
): Promise<boolean> {
    return addChannelMember(channelId, user, authToken);
}

// POST /api/channels/request-join — matches _requestJoinChannel. Queues a
// request an admin must approve, rather than joining immediately.
export async function requestJoinChannel(
    channelId: string,
    user: { userId: string; username: string; nickname?: string },
    authToken: string,
): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/request-join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({
                channel_id: channelId,
                user_id: user.userId,
                username: user.username,
                user_nickname: user.nickname ?? user.username,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { success: false, message: data.message ?? 'Failed to send request' };
        }
        return { success: true, message: data.message };
    } catch (e) {
        console.error('requestJoinChannel failed:', e);
        return { success: false, message: 'Network error' };
    }
}

// ============================================================================
// PENDING JOIN REQUESTS (admin side)
// ============================================================================

export interface PendingJoinRequest {
    userId: string;
    username: string;
    requestedAt: Date;
}

// GET /api/channels/:channelId/pending-requests
export async function getPendingJoinRequests(
    channelId: string,
    authToken: string,
): Promise<PendingJoinRequest[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/${channelId}/pending-requests`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return [];
        const data = await res.json();
        const requests = data.pending_requests ?? [];
        return requests.map((r: any) => ({
            userId: asString(r.user_id ?? r.userId),
            username: asString(r.username, 'Unknown'),
            requestedAt: asDateTime(r.requested_at) ?? new Date(),
        }));
    } catch (e) {
        console.error('getPendingJoinRequests failed:', e);
        return [];
    }
}

// POST /api/channels/approve-request
export async function approveJoinRequest(
    channelId: string,
    userId: string,
    username: string,
    authToken: string,
): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/approve-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ channel_id: channelId, user_id: userId, username }),
        });
        return res.ok;
    } catch (e) {
        console.error('approveJoinRequest failed:', e);
        return false;
    }
}

// POST /api/channels/reject-request
export async function rejectJoinRequest(
    channelId: string,
    userId: string,
    authToken: string,
): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/reject-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ channel_id: channelId, user_id: userId }),
        });
        return res.ok;
    } catch (e) {
        console.error('rejectJoinRequest failed:', e);
        return false;
    }
}

// ============================================================================
// COMRADES-IN-GROUPS
// ============================================================================

// GET /api/channels/comrades-in-groups/:userId — returns "{comradeId}_{channelId}"
// pairs, used to gate "already added" badges on comrade cards.
export async function getComradesInGroups(userId: string, authToken: string): Promise<Set<string>> {
    try {
        const res = await fetch(`${API_BASE_URL}/channels/comrades-in-groups/${userId}`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return new Set();
        const data = await res.json();
        const list = data.comrades ?? [];
        const pairs = new Set<string>();
        for (const item of list) {
            const comradeId = asString(item.comrade_id);
            const channelId = asString(item.channel_id);
            if (comradeId && channelId) pairs.add(`${comradeId}_${channelId}`);
        }
        return pairs;
    } catch (e) {
        console.error('getComradesInGroups failed:', e);
        return new Set();
    }
}
