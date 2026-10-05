// The one piece of the original posts-service.ts that's platform-specific:
// createPost's image upload uses a web File/Blob here (see
// apps/mobile/src/lib/api/posts-create.ts for the RN {uri,name,type}
// equivalent). Everything else related to posts (getPosts, likes, follow)
// lives in @funspot/core and is imported from there directly.

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

export interface CreatePostParams {
  userId: string;
  userName: string;
  caption?: string;
  image?: File | Blob;
  imageName?: string;
}

// POST /api/posts (multipart/form-data)
export async function createPost(p: CreatePostParams): Promise<Record<string, any>> {
  if ((!p.caption || p.caption.length === 0) && !p.image) {
    throw new Error('Please add a caption or image');
  }
  if (p.image && p.image.size / (1024 * 1024) > 10) {
    throw new Error('Image too large. Max size: 10MB');
  }

  const form = new FormData();
  form.set('userId', p.userId);
  form.set('userName', p.userName);
  if (p.caption) form.set('caption', p.caption);
  if (p.image) {
    const name = p.imageName ?? 'image.jpg';
    const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowed.includes(ext)) {
      throw new Error('Invalid image format. Allowed: jpg, jpeg, png, gif, webp');
    }
    form.set('image', p.image, `post_${Date.now()}.${ext}`);
  }

  const res = await fetch(`${API_BASE_URL}/posts`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Error creating post: ${res.status}`);
  return res.json();
}
