// Full port of funspot/lib/services/comrade_service.dart. Covers channels
// (create/get/leaderboard/fixtures/members), fixture chat (init/send/get),
// channel voting, fixture comments, and the comrades (friends) graph.

import { API_BASE, authHeaders } from './config';
import { type Channel, channelFromJson } from '../types/channels';

function headers(authToken?: string | null): HeadersInit {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}
function jsonHeaders(authToken?: string | null): HeadersInit {
  return { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };
}

// ---------------------------------------------------------------------------
// COMRADES (friends graph)
// ---------------------------------------------------------------------------

export interface AddComradeParams {
  userId: string;
  comradeId: string;
  username: string;
  comradeUsername: string;
  comradeNickname: string;
  comradeClub: string;
  comradeCountry: string;
  authToken: string;
}

// POST /api/comrades/comrades/add
export async function addComrade(p: AddComradeParams): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${API_BASE}/comrades/comrades/add`, {
      method: 'POST',
      headers: jsonHeaders(p.authToken),
      body: JSON.stringify({
        user_id: p.userId,
        comrade_id: p.comradeId,
        username: p.username,
        comrade_username: p.comradeUsername,
        comrade_nickname: p.comradeNickname,
        comrade_club: p.comradeClub,
        comrade_country: p.comradeCountry,
      }),
    });
    if (res.ok) return await res.json();
    return { success: false, message: 'Failed to add comrade' };
  } catch (e: any) {
    return { success: false, message: e?.message ?? String(e) };
  }
}

// GET /api/comrades/comrades/:userId
export async function getUserComrades(userId: string, authToken?: string): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${API_BASE}/comrades/comrades/${userId}`, { headers: headers(authToken) });
    if (res.status === 404) return [];
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('getUserComrades failed:', e);
    return [];
  }
}

export interface ComradeStats {
  count: number;
  max_comrades: number;
  remaining: number;
}

// GET /api/comrades/comrades/:userId/stats
export async function getComradeStats(userId: string, authToken?: string): Promise<ComradeStats> {
  try {
    const res = await fetch(`${API_BASE}/comrades/comrades/${userId}/stats`, { headers: headers(authToken) });
    if (!res.ok) return { count: 0, max_comrades: 50, remaining: 50 };
    const data = await res.json();
    const count = data.count ?? 0;
    const max = data.max_comrades ?? 50;
    return { count, max_comrades: max, remaining: max - count };
  } catch (e) {
    console.error('getComradeStats failed:', e);
    return { count: 0, max_comrades: 50, remaining: 50 };
  }
}

// POST /api/comrades/comrades/remove
export async function removeComrade(userId: string, comradeId: string, authToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/comrades/comrades/remove`, {
      method: 'POST',
      headers: jsonHeaders(authToken),
      body: JSON.stringify({ user_id: userId, comrade_id: comradeId }),
    });
    return res.ok;
  } catch (e) {
    console.error('removeComrade failed:', e);
    return false;
  }
}

// Derived from getUserComrades, same as the Dart version
export async function areComrades(userId: string, otherUserId: string, authToken?: string): Promise<boolean> {
  const comrades = await getUserComrades(userId, authToken);
  return comrades.some((c) => c.comrade_id === otherUserId);
}

export async function getComradeDetails(
  userId: string,
  comradeId: string,
  authToken?: string
): Promise<Record<string, any> | null> {
  const comrades = await getUserComrades(userId, authToken);
  return comrades.find((c) => c.comrade_id === comradeId) ?? null;
}

// GET /api/comrades/search?q=...&exclude=...
export async function searchPotentialComrades(
  query: string,
  currentUserId: string,
  authToken?: string
): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(
      `${API_BASE}/comrades/search?q=${encodeURIComponent(query)}&exclude=${currentUserId}`,
      { headers: headers(authToken) }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('searchPotentialComrades failed:', e);
    return [];
  }
}

// GET /api/comrades/fixture/:fixtureId/user/:userId
export async function getComradesWhoVotedOnFixture(
  fixtureId: string,
  userId: string,
  authToken?: string
): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${API_BASE}/comrades/fixture/${fixtureId}/user/${userId}`, {
      headers: headers(authToken),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('getComradesWhoVotedOnFixture failed:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// CHANNELS
// ---------------------------------------------------------------------------
//
// `Channel` used to be a loose local interface here ({ id, name, [key: string]: any }).
// That was a stray duplicate of the canonical, fully-parsed Channel type in
// types/channel.ts (channelId, memberCount, members: ChannelMember[], isAdmin
// derived from members, etc.) — the shape every other screen (ComradeListModal,
// AppHeader/useHome) actually expects. Now importing that type directly instead
// of redeclaring it, so `Channel` means the same thing everywhere `@funspot/core`
// exports it.

// GET /api/channels/user/:userId/count
export async function getUserChannelCount(userId: string, authToken?: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/channels/user/${userId}/count`, { headers: headers(authToken) });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

// GET /api/channels/user/:userId
export async function getUserChannels(userId: string, authToken: string): Promise<Channel[]> {
  try {
    const res = await fetch(`${API_BASE}/channels/user/${userId}`, {
      headers: authHeaders(authToken),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: any[] = Array.isArray(data) ? data : data.channels ?? [];
    // Parse through channelFromJson rather than casting the raw (snake_case,
    // unparsed-dates, isAdmin-not-derived) response as Channel — the function's
    // return type now claims the canonical shape, so it needs to actually
    // produce it.
    return raw.filter((c) => c && typeof c === 'object').map((c) => channelFromJson(c));
  } catch (e) {
    console.error('getUserChannels failed:', e);
    return [];
  }
}

export interface CreateChannelParams {
  name: string;
  createdBy: string;
  createdByUsername: string;
  season: string;
  members: { id: string; username: string }[];
  authToken: string;
}

// POST /api/channels/
export async function createChannel(
  p: CreateChannelParams
): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/channels/`, {
      method: 'POST',
      headers: jsonHeaders(p.authToken),
      body: JSON.stringify({
        name: p.name,
        created_by: p.createdBy,
        created_by_username: p.createdByUsername,
        season: p.season,
        members: p.members,
      }),
    });
    if (res.ok) return { success: true, data: await res.json() };
    return { success: false, message: 'Failed to create channel' };
  } catch (e: any) {
    return { success: false, message: e?.message ?? String(e) };
  }
}

// GET /api/channels/:channelId
export async function getChannel(channelId: string, authToken: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/channels/${channelId}`, { headers: headers(authToken) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// GET /api/channels/:channelId/leaderboard
export async function getChannelLeaderboard(channelId: string, authToken: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/channels/${channelId}/leaderboard`, { headers: headers(authToken) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// GET /api/channels/:channelId/fixtures
export async function getChannelFixtures(channelId: string, authToken: string): Promise<any[] | null> {
  try {
    const res = await fetch(`${API_BASE}/channels/${channelId}/fixtures`, { headers: headers(authToken) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// POST /api/channels/members/add
export async function addMembersToChannel(
  channelId: string,
  members: { id: string; username: string }[],
  authToken: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/channels/members/add`, {
      method: 'POST',
      headers: jsonHeaders(authToken),
      body: JSON.stringify({ channel_id: channelId, members }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// POST /api/channels/members/leave
export async function leaveChannel(channelId: string, userId: string, authToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/channels/members/leave`, {
      method: 'POST',
      headers: jsonHeaders(authToken),
      body: JSON.stringify({ channel_id: channelId, user_id: userId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// FIXTURE CHAT (per-channel, per-match messaging)
// ---------------------------------------------------------------------------

// POST /api/channels/fixture/chat
export async function initializeFixtureChat(
  channelId: string,
  fixtureId: string,
  authToken: string
): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/channels/fixture/chat`, {
      method: 'POST',
      headers: jsonHeaders(authToken),
      body: JSON.stringify({ channel_id: channelId, fixture_id: fixtureId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.chat ?? null;
  } catch (e) {
    console.error('initializeFixtureChat failed:', e);
    return null;
  }
}

export interface SendMessageParams {
  channelId: string;
  fixtureId?: string | null;
  senderId: string;
  senderName: string;
  text: string;
  authToken: string;
}

// POST /api/channels/messages
export async function sendMessage(p: SendMessageParams): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/channels/messages`, {
      method: 'POST',
      headers: jsonHeaders(p.authToken),
      body: JSON.stringify({
        channel_id: p.channelId,
        fixture_id: p.fixtureId ?? null,
        sender_id: p.senderId,
        sender_name: p.senderName,
        text: p.text,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('sendMessage failed:', e);
    return false;
  }
}

// GET /api/channels/messages?channel_id=...&fixture_id=...&limit=...&offset=...
export async function getMessages(
  channelId: string,
  authToken: string,
  opts?: { fixtureId?: string; limit?: number; offset?: number }
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      channel_id: channelId,
      limit: String(opts?.limit ?? 50),
      offset: String(opts?.offset ?? 0),
    });
    if (opts?.fixtureId) params.set('fixture_id', opts.fixtureId);

    const res = await fetch(`${API_BASE}/channels/messages?${params.toString()}`, { headers: headers(authToken) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages ?? [];
  } catch (e) {
    console.error('getMessages failed:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// CHANNEL VOTING
// ---------------------------------------------------------------------------

export interface CastVoteParams {
  channelId: string;
  fixtureId: string;
  userId: string;
  selection: 'home_team' | 'draw' | 'away_team';
  authToken: string;
}

// POST /api/channels/votes
export async function castVote({ channelId, fixtureId, userId, selection, authToken }: CastVoteParams): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/channels/votes`, {
      method: 'POST',
      headers: jsonHeaders(authToken),
      body: JSON.stringify({
        channel_id: channelId,
        fixture_id: fixtureId,
        user_id: userId,
        selection,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('castVote failed:', e);
    return false;
  }
}

export interface SendChannelMessageParams {
  channelId: string;
  userId: string;
  username: string;
  text: string;
  selection?: string;
  fixtureId?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  isImage?: boolean;
  isVideo?: boolean;
  caption?: string;
  replyToMessageId?: string;
  replyToText?: string;
  replyToUsername?: string;
  replyToSelection?: string;
  authToken?: string;
  tempId?: string;
}

// POST /api/channels/:channelId/messages — the richer, media/reply-capable
// send path from api_services.dart's sendChannelMessage (distinct from the
// simpler POST /api/channels/messages body-only path above, from
// comrade_service.dart's sendMessage — the original app has both).
export async function sendChannelMessage(p: SendChannelMessageParams): Promise<boolean> {
  try {
    const body: Record<string, any> = {
      user_id: p.userId,
      username: p.username,
      text: p.text,
      is_image: p.isImage ?? false,
      is_video: p.isVideo ?? false,
    };
    if (p.selection) body.selection = p.selection;
    if (p.fixtureId) body.fixture_id = p.fixtureId;
    if (p.imageUrl) body.image_url = p.imageUrl;
    if (p.videoUrl) body.video_url = p.videoUrl;
    if (p.videoThumbnailUrl) body.video_thumbnail_url = p.videoThumbnailUrl;
    if (p.caption) body.caption = p.caption;
    if (p.tempId) body.temp_id = p.tempId;
    if (p.replyToMessageId) {
      body.reply_to_id = p.replyToMessageId;
      body.reply_to_text = p.replyToText ?? '';
      body.reply_to_username = p.replyToUsername ?? '';
      if (p.replyToSelection) body.reply_to_selection = p.replyToSelection;
    }

    const res = await fetch(`${API_BASE}/channels/${p.channelId}/messages`, {
      method: 'POST',
      headers: jsonHeaders(p.authToken),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error('sendChannelMessage failed:', e);
    return false;
  }
}

// GET /api/channels/:channelId/messages?fixture_id=&limit= — path-based
// counterpart to getMessages() above.
export async function getChannelMessages(
  channelId: string,
  opts?: { fixtureId?: string; limit?: number; authToken?: string }
): Promise<Record<string, any>[]> {
  try {
    const params = new URLSearchParams({ limit: String(opts?.limit ?? 100) });
    if (opts?.fixtureId) params.set('fixture_id', opts.fixtureId);
    const res = await fetch(`${API_BASE}/channels/${channelId}/messages?${params.toString()}`, {
      headers: headers(opts?.authToken),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages ?? data.data ?? [];
  } catch (e) {
    console.error('getChannelMessages failed:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// FIXTURE COMMENTS
// ---------------------------------------------------------------------------

export interface PostCommentParams {
  userId: string;
  username: string;
  fixtureId: string;
  comment: string;
  selection: string;
  authToken?: string;
}

// POST /api/votes/comment
export async function postComment(p: PostCommentParams): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const res = await fetch(`${API_BASE}/votes/comment`, {
      method: 'POST',
      headers: jsonHeaders(p.authToken),
      body: JSON.stringify({
        voterId: p.userId,
        username: p.username,
        fixtureId: p.fixtureId,
        comment: p.comment.trim(),
        selection: p.selection,
        timestamp: new Date().toISOString(),
      }),
    });

    if (res.ok) {
      return { success: true, message: 'Comment posted successfully', data: await res.json() };
    }
    if (res.status === 401) {
      return { success: false, message: 'Authentication failed. Please log in again.' };
    }
    return { success: false, message: `Failed to post comment. Server error: ${res.status}` };
  } catch (e: any) {
    return { success: false, message: `Network error: ${e?.message ?? e}` };
  }
}