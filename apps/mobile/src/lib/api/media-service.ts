// RN adaptation of funspot/lib/services/api_services.dart's
// uploadChatImage(). Web's FormData takes a File/Blob; React Native's
// FormData.append takes a { uri, name, type } object instead (the RN
// FormData polyfill's documented convention, matching what
// expo-image-picker / react-native-image-picker return). Endpoint and
// response parsing are otherwise identical to the web port.

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

export interface RNImageAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

export async function uploadChatImage(params: {
  image: RNImageAsset;
  userId: string;
  authToken?: string;
  caption?: string;
}): Promise<string | null> {
  if (params.image.fileSize != null) {
    const sizeInMB = params.image.fileSize / (1024 * 1024);
    if (sizeInMB > 10) throw new Error('Image too large. Max size: 10MB');
  }

  const name = params.image.fileName ?? 'image.jpg';
  const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `chat_image_${Date.now()}.${ext}`;
  const mimeType = params.image.mimeType ?? (ext === 'png' ? 'image/png' : 'image/jpeg');

  const form = new FormData();
  // @ts-expect-error — React Native's FormData accepts this shape; the web
  // lib.dom.d.ts FormData typing doesn't know about it, hence the ignore.
  form.append('file', { uri: params.image.uri, name: fileName, type: mimeType });
  form.append('userId', params.userId);
  if (params.caption) form.append('caption', params.caption);

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
