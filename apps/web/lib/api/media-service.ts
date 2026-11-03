// Ported from funspot/lib/services/api_services.dart — uploadChatImage()
// (chat media upload; the video+thumbnail variants are mobile-only
// background-upload code paths and are not ported, see README).

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

export async function uploadChatImage(params: {
  file: File | Blob;
  fileName?: string;
  userId: string;
  authToken?: string;
  caption?: string;
}): Promise<string | null> {
  const sizeInMB = params.file.size / (1024 * 1024);
  if (sizeInMB > 10) throw new Error('Image too large. Max size: 10MB');

  const name = params.fileName ?? 'image.jpg';
  const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `chat_image_${Date.now()}.${ext}`;

  const form = new FormData();
  form.set('file', params.file, fileName);
  form.set('userId', params.userId);
  if (params.caption) form.set('caption', params.caption);

  try {
    const res = await fetch(`${API_BASE_URL}/channels/media/upload`, {
      method: 'POST',
      headers: params.authToken ? { Authorization: `Bearer ${params.authToken}` } : undefined,
      body: form,
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      return data.url ?? data.secure_url ?? null;
    }
    console.error('Image upload failed:', res.status);
    return null;
  } catch (e) {
    console.error('Image upload error:', e);
    return null;
  }
}
