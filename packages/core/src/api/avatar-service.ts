import { API_BASE } from './config';

export interface AvatarUploadResult {
  avatarUrl: string;
}

export interface NativeAvatarUploadFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

type AvatarUploadFile = Blob | NativeAvatarUploadFile;

function avatarUrlFromResponse(value: unknown): string {
  if (!value || typeof value !== 'object') throw new Error('Avatar upload returned an invalid response');
  const body = value as Record<string, unknown>;
  const nested = body.profile && typeof body.profile === 'object' ? body.profile as Record<string, unknown> : body;
  const url = nested.avatar_url ?? nested.avatarUrl ?? nested.image_url ?? nested.imageUrl;
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Avatar upload response did not include a valid image URL');
  }
  return url;
}

/** Uploads a browser Blob or native file URI and returns the canonical persisted URL. */
export async function uploadProfileAvatar(
  userId: string,
  userName: string,
  file: AvatarUploadFile,
): Promise<AvatarUploadResult> {
  if (!userId.trim() || !userName.trim()) {
    throw new Error('A signed-in user is required to change the profile image');
  }

  const isNativeFile = 'uri' in file;
  const fileSize = isNativeFile ? file.size : file.size;
  const fileType = file.type.toLowerCase();
  if (fileSize !== undefined && (fileSize <= 0 || fileSize > 8 * 1024 * 1024)) {
    throw new Error('Choose an image smaller than 8 MB');
  }

  const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!supportedTypes.has(fileType)) {
    throw new Error('Choose a JPEG, PNG, or WebP image');
  }

  const form = new FormData();
  form.append('userId', userId);
  form.append('userName', userName);

  // Match createPost's cross-platform multipart contract: React Native keeps
  // the native { uri, name, type } descriptor, while browsers send the Blob.
  // Deliberately do not attach Authorization/Bearer headers; post uploads use
  // this same userId/userName multipart identity flow.
  if (isNativeFile) {
    form.append('image', file as unknown as Blob);
  } else {
    form.append('image', file);
  }

  const response = await fetch(`${API_BASE}/profile/profile/${encodeURIComponent(userId)}/avatar`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = detail;
    try {
      const parsed = JSON.parse(detail) as { message?: unknown; error?: unknown };
      message = typeof parsed.message === 'string'
        ? parsed.message
        : typeof parsed.error === 'string'
          ? parsed.error
          : detail;
    } catch {
      // The server may return a plain-text proxy or gateway error.
    }
    throw new Error(message || `Avatar upload failed (HTTP ${response.status})`);
  }
  return { avatarUrl: avatarUrlFromResponse(await response.json()) };
}
