// Browser implementation of the platform-specific createPost upload.
// Keeps the same endpoint, payload fields, limits, formats, and error text.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://clash-api-m5mr.onrender.com/api').replace(/\/$/, '');

export interface CreatePostParams {
  userId: string;
  userName: string;
  caption?: string;
  image?: File;
  video?: File;
}

const IMAGE_MAX_MB = 10;
const VIDEO_MAX_MB = 50;
const ALLOWED_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const ALLOWED_VIDEO_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm'];

function extensionOf(name: string, fallback: string): string {
  return name.split('.').pop()?.toLowerCase() || fallback;
}

function validateMedia(file: File, maxMb: number, allowed: string[], kind: 'image' | 'video') {
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(kind === 'image' ? 'Image too large. Max size: 10MB' : 'Video too large. Max size: 50MB');
  }
  const ext = extensionOf(file.name, kind === 'image' ? 'jpg' : 'mp4');
  if (!allowed.includes(ext)) {
    throw new Error(kind === 'image'
      ? 'Invalid image format. Allowed: jpg, jpeg, png, gif, webp'
      : 'Invalid video format. Allowed: mp4, mov, avi, mkv, webm');
  }
  return ext;
}

// POST /api/posts (multipart/form-data)
export async function createPost(p: CreatePostParams): Promise<Record<string, any>> {
  if ((!p.caption || p.caption.length === 0) && !p.image && !p.video) {
    throw new Error('Please add a caption, image, or video');
  }

  const form = new FormData();
  form.append('userId', p.userId);
  form.append('userName', p.userName);
  if (p.caption) form.append('caption', p.caption);

  if (p.image) {
    validateMedia(p.image, IMAGE_MAX_MB, ALLOWED_IMAGE_EXT, 'image');
    const ext = extensionOf(p.image.name, 'jpg');
    form.append('image', p.image, `post_${Date.now()}.${ext}`);
  }

  if (p.video) {
    validateMedia(p.video, VIDEO_MAX_MB, ALLOWED_VIDEO_EXT, 'video');
    const ext = extensionOf(p.video.name, 'mp4');
    form.append('video', p.video, `post_${Date.now()}.${ext}`);
  }

  const res = await fetch(`${API_BASE_URL}/posts`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let msg = `Error creating post: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) msg = body.message;
    } catch {
      // The response body wasn't JSON.
    }
    throw new Error(msg);
  }
  return res.json();
}
