// The one piece of the original posts-service.ts that's platform-specific:
// createPost's image upload uses RN's { uri, name, type } FormData
// convention here (see apps/web/lib/api/posts-create.ts for the web
// File/Blob equivalent). Everything else related to posts (getPosts,
// likes, follow) lives in @funspot/core and is imported from there
// directly.

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

export interface CreatePostParams {
  userId: string;
  userName: string;
  caption?: string;
  // RN adaptation: a picked-image asset (uri/name/type/size), not a web
  // File/Blob — see media-service.ts for the same convention.
  image?: { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number | null };
}

// POST /api/posts (multipart/form-data)
export async function createPost(p: CreatePostParams): Promise<Record<string, any>> {
  if ((!p.caption || p.caption.length === 0) && !p.image) {
    throw new Error('Please add a caption or image');
  }
  if (p.image?.fileSize != null && p.image.fileSize / (1024 * 1024) > 10) {
    throw new Error('Image too large. Max size: 10MB');
  }

  const form = new FormData();
  form.append('userId', p.userId);
  form.append('userName', p.userName);
  if (p.caption) form.append('caption', p.caption);
  if (p.image) {
    const name = p.image.fileName ?? 'image.jpg';
    const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowed.includes(ext)) {
      throw new Error('Invalid image format. Allowed: jpg, jpeg, png, gif, webp');
    }
    const mimeType = p.image.mimeType ?? (ext === 'png' ? 'image/png' : 'image/jpeg');
    // @ts-expect-error — RN FormData's { uri, name, type } shape isn't in
    // lib.dom.d.ts's FormData typing.
    form.append('image', { uri: p.image.uri, name: `post_${Date.now()}.${ext}`, type: mimeType });
  }

  const res = await fetch(`${API_BASE_URL}/posts`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Error creating post: ${res.status}`);
  return res.json();
}
