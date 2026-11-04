// apps/web/lib/api/posts-create.ts
//
// The one piece of the original posts-service.ts that's platform-specific:
// createPost's upload uses RN's { uri, name, type } FormData convention
// (see the web File/Blob equivalent in the same file for the browser).
// Everything else related to posts (getPosts, likes, follow) lives in
// @funspot/core and is imported from there directly.

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

export interface CreatePostParams {
  userId: string;
  userName: string;
  caption?: string;
  /** Picked image: RN asset shape, not a web File/Blob. */
  image?: { uri: string; name: string; type: string };
  /** Picked video: RN asset shape. */
  video?: { uri: string; name: string; type: string };
  onProgress?: (percent: number) => void;
}

const IMAGE_MAX_MB = 10;
const VIDEO_MAX_MB = 50;
const ALLOWED_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const ALLOWED_VIDEO_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm'];

function extensionOf(name: string, fallback: string): string {
  return name.split('.').pop()?.toLowerCase() ?? fallback;
}

// POST /api/posts (multipart/form-data)
export async function createPost(
  p: CreatePostParams,
): Promise<Record<string, any>> {
  if ((!p.caption || p.caption.length === 0) && !p.image && !p.video) {
    throw new Error('Please add a caption, image, or video');
  }

  const form = new FormData();
  form.append('userId', p.userId);
  form.append('userName', p.userName);
  if (p.caption) form.append('caption', p.caption);

  if (p.image) {
    const ext = extensionOf(p.image.name, 'jpg');
    if (!ALLOWED_IMAGE_EXT.includes(ext)) {
      throw new Error(
        'Invalid image format. Allowed: jpg, jpeg, png, gif, webp',
      );
    }
    const type =
      p.image.type || (ext === 'png' ? 'image/png' : 'image/jpeg');
    // @ts-expect-error — RN FormData's { uri, name, type } shape isn't in
    // lib.dom.d.ts's FormData typing.
    form.append('image', {
      uri: p.image.uri,
      name: `post_${Date.now()}.${ext}`,
      type,
    });
  }

  if (p.video) {
    const ext = extensionOf(p.video.name, 'mp4');
    if (!ALLOWED_VIDEO_EXT.includes(ext)) {
      throw new Error(
        'Invalid video format. Allowed: mp4, mov, avi, mkv, webm',
      );
    }
    const type = p.video.type || `video/${ext}`;
    // @ts-expect-error — same as above.
    form.append('video', {
      uri: p.video.uri,
      name: `post_${Date.now()}.${ext}`,
      type,
    });
  }

  return new Promise<Record<string, any>>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE_URL}/posts`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && p.onProgress) {
        p.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    request.onerror = () => reject(new Error('Network error while uploading post'));
    request.onabort = () => reject(new Error('Post upload was cancelled'));
    request.onload = () => {
      let body: Record<string, any> = {};
      try {
        body = request.responseText ? JSON.parse(request.responseText) : {};
      } catch {
        if (request.status >= 200 && request.status < 300) {
          reject(new Error('Server returned an invalid response'));
          return;
        }
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(body?.message || `Error creating post: ${request.status}`));
        return;
      }
      if (p.onProgress) p.onProgress(100);
      resolve(body);
    };
    request.send(form);
  });
}