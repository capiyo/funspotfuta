import { API_BASE } from './config';

export interface AvatarUploadResult {
  avatarUrl: string;
}

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

/** Uploads the selected profile image and returns the canonical, persisted URL. */
export async function uploadProfileAvatar(userId: string, file: Blob, authToken?: string): Promise<AvatarUploadResult> {
  if (!userId.trim()) throw new Error('A signed-in user is required to change the profile image');
  if (file.size <= 0 || file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB');
  const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!supportedTypes.has(file.type.toLowerCase())) {
    throw new Error('Choose a JPEG, PNG, or WebP image');
  }

  const form = new FormData();
  form.append('image', file);
  const response = await fetch(`${API_BASE}/profile/profile/${encodeURIComponent(userId)}/avatar`, {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
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
