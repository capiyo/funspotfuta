// Ported from funspot/lib/modals/homepage/admin_dashboard.dart — the
// endpoints not already covered by comrade-service.ts / payment-service.ts:
// payment-feature visibility flag, channel detail (stats + member list),
// and member removal. AppCache (RAM/local caching layer) is not ported —
// same reasoning as the other local-cache files noted in the README.

import type { ChannelMember } from './channels-service';

const API = 'https://clash-api-m5mr.onrender.com/api';

function headers(authToken?: string): HeadersInit {
  return { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };
}

// GET /api/visibility/votes_button_show
export async function checkPaymentVisibility(authToken?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/visibility/votes_button_show`, { headers: headers(authToken) });
    if (!res.ok) return true;
    const data = await res.json();
    return data.value ?? true;
  } catch (e) {
    console.error('checkPaymentVisibility failed:', e);
    return true;
  }
}

export interface ChannelDetail {
  channelId: string;
  memberCount: number;
  totalMessages: number;
  messagesThisWeek: number;
  members: ChannelMember[];
}

// GET /api/channels/:channelId — used for both admin stats and member list
export async function getChannelDetail(channelId: string, authToken?: string): Promise<ChannelDetail | null> {
  try {
    const res = await fetch(`${API}/channels/${channelId}`, { headers: headers(authToken) });
    if (!res.ok) return null;
    const data = await res.json();
    const channel = data.channel;
    if (!channel) return null;
    const members: ChannelMember[] = (channel.members ?? []).map((m: any) => ({
      userId: m.user_id ?? m.userId ?? '',
      username: m.username ?? 'Unknown',
      ...m,
    }));
    return {
      channelId,
      memberCount: channel.member_count ?? members.length,
      totalMessages: channel.activity?.total_messages ?? 0,
      messagesThisWeek: channel.activity?.messages_this_week ?? 0,
      members,
    };
  } catch (e) {
    console.error('getChannelDetail failed:', e);
    return null;
  }
}

// POST /api/channels/members/remove
export async function removeMember(
  channelId: string,
  userId: string,
  removedBy: string,
  authToken?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API}/channels/members/remove`, {
      method: 'POST',
      headers: headers(authToken),
      body: JSON.stringify({ channel_id: channelId, user_id: userId, removed_by: removedBy }),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.status === 200, message: data.message };
  } catch (e: any) {
    console.error('removeMember failed:', e);
    return { success: false, message: e?.message ?? String(e) };
  }
}
