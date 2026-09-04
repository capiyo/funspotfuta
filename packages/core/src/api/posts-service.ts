// Ported from the "POSTS" and "FOLLOWERS/FOLLOWING" sections of
// funspot/lib/services/api_services.dart. createPost is intentionally NOT
// here — it uploads an image via multipart/form-data, and the web File/Blob
// vs React Native {uri,name,type} shapes differ, so each app supplies its
// own createPost in apps/*/src/lib/api/posts-create.ts, reusing everything
// else from this file.
//
// Verified in sync with upstream @ fe28d33 (2026-09-02) — see /SYNC.md.
// toggleLikePost's endpoint/body/response contract (POST
// /api/posts/:id/like, {user_id, user_name}, reads success/post.likes_count)
// is unchanged from lib/pages/posts_page.dart's _toggleLike(), which is the
// only thing ever ported from that file.

import { Post, postFromJson } from '../types/post';

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

function authHeaders(authToken?: string): HeadersInit {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

export interface GetPostsResult {
  posts: Post[];
  stats: Record<string, any>;
  pagination: Record<string, any>;
  success: boolean;
}

// GET /api/posts?page=&limit=&userId=
export async function getPosts(opts?: { page?: number; limit?: number; userId?: string }): Promise<GetPostsResult> {
  const params = new URLSearchParams({
    page: String(opts?.page ?? 1),
    limit: String(opts?.limit ?? 20),
  });
  if (opts?.userId) params.set('userId', opts.userId);

  const res = await fetch(`${API_BASE_URL}/posts?${params.toString()}`);
  if (!res.ok) throw new Error(`Error fetching posts: ${res.status}`);
  const data = await res.json();
  return {
    posts: (data.posts ?? []).map(postFromJson),
    stats: data.stats ?? {},
    pagination: data.pagination ?? {},
    success: data.success ?? false,
  };
}

// GET /api/posts/:postId
export async function getPostById(postId: string): Promise<Record<string, any>> {
  const res = await fetch(`${API_BASE_URL}/posts/${postId}`);
  if (!res.ok) throw new Error(`Error fetching post: ${res.status}`);
  return res.json();
}

// GET /api/posts/user/:userId?page=&limit=
export async function getUserPosts(userId: string, opts?: { page?: number; limit?: number }): Promise<GetPostsResult> {
  const params = new URLSearchParams({ page: String(opts?.page ?? 1), limit: String(opts?.limit ?? 20) });
  const res = await fetch(`${API_BASE_URL}/posts/user/${userId}?${params.toString()}`);
  if (!res.ok) throw new Error(`Error fetching user posts: ${res.status}`);
  const data = await res.json();
  return {
    posts: (data.posts ?? []).map(postFromJson),
    stats: data.stats ?? {},
    pagination: data.pagination ?? {},
    success: data.success ?? false,
  };
}


// DELETE /api/posts/:postId
export async function deletePost(postId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/posts/${postId}`, { method: 'DELETE' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// PUT /api/posts/:postId/caption
export async function updatePostCaption(postId: string, newCaption: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/posts/${postId}/caption`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: newCaption }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// GET /api/posts/stats
export async function getPostStats(): Promise<Record<string, any>> {
  const res = await fetch(`${API_BASE_URL}/posts/stats`);
  if (!res.ok) throw new Error(`Error fetching stats: ${res.status}`);
  return res.json();
}

// GET /api/posts/user/:userId/stats
export async function getUserPostStats(userId: string): Promise<Record<string, any>> {
  const res = await fetch(`${API_BASE_URL}/posts/user/${userId}/stats`);
  if (!res.ok) throw new Error(`Error fetching user stats: ${res.status}`);
  return res.json();
}

// POST /api/posts/:postId/like — optimistic toggle, matches _toggleLike's
// debounced call in posts_page.dart (debounce itself is a UI concern, left
// to the caller).
export async function toggleLikePost(
  postId: string,
  userId: string,
  userName: string
): Promise<{ success: boolean; likesCount?: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, user_name: userName }),
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    if (data.success === true) {
      return { success: true, likesCount: data.post?.likes_count };
    }
    return { success: false };
  } catch (e) {
    console.error('toggleLikePost failed:', e);
    return { success: false };
  }
}

// ---------------------------------------------------------------------------
// FOLLOWERS / FOLLOWING
// ---------------------------------------------------------------------------

function extractList(data: any): Record<string, any>[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (data.success === true && Array.isArray(data.followers ?? data.data)) return data.followers ?? data.data;
    if (Array.isArray(data.followers)) return data.followers;
    if (Array.isArray(data.following)) return data.following;
    if (Array.isArray(data.data)) return data.data;
  }
  return [];
}

// GET /api/users/:userId/followers?page=&limit=
export async function getUserFollowers(userId: string, opts?: { page?: number; limit?: number }): Promise<Record<string, any>[]> {
  try {
    const params = new URLSearchParams({ page: String(opts?.page ?? 1), limit: String(opts?.limit ?? 50) });
    const res = await fetch(`${API_BASE_URL}/users/${userId}/followers?${params.toString()}`);
    if (res.status === 404) return [];
    if (!res.ok) return [];
    return extractList(await res.json());
  } catch (e) {
    console.error('getUserFollowers failed:', e);
    return [];
  }
}

// GET /api/users/:userId/following?page=&limit=
export async function getUserFollowing(userId: string, opts?: { page?: number; limit?: number }): Promise<Record<string, any>[]> {
  try {
    const params = new URLSearchParams({ page: String(opts?.page ?? 1), limit: String(opts?.limit ?? 50) });
    const res = await fetch(`${API_BASE_URL}/users/${userId}/following?${params.toString()}`);
    if (res.status === 404) return [];
    if (!res.ok) return [];
    return extractList(await res.json());
  } catch (e) {
    console.error('getUserFollowing failed:', e);
    return [];
  }
}

// POST /api/users/follow
export async function followUser(followerId: string, followingId: string, authToken?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/users/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(authToken) },
      body: JSON.stringify({ follower_id: followerId, following_id: followingId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error('followUser failed:', e);
    return false;
  }
}

// DELETE /api/users/follow
export async function unfollowUser(followerId: string, followingId: string, authToken?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/users/follow`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders(authToken) },
      body: JSON.stringify({ follower_id: followerId, following_id: followingId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error('unfollowUser failed:', e);
    return false;
  }
}

// GET /api/users/:followerId/is-following/:followingId
export async function isFollowing(followerId: string, followingId: string, authToken?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/users/${followerId}/is-following/${followingId}`, {
      headers: authHeaders(authToken),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.is_following === true;
  } catch (e) {
    console.error('isFollowing failed:', e);
    return false;
  }
}

// GET /api/users/:userId/followers/count
export async function getFollowerCount(userId: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/followers/count`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}