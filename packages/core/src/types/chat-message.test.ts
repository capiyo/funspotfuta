import { describe, expect, it } from 'vitest';
import { chatMessageFromJson } from './chat-message';

describe('chatMessageFromJson media parity with Flutter', () => {
  it('reads Rust backend snake_case media fields', () => {
    const message = chatMessageFromJson({
      userId: 'fan-1',
      username: 'Fan',
      message: 'Match photo',
      image_url: 'https://cdn.example.test/chat/photo.jpg',
      image_public_id: 'photo-1',
      video_url: 'https://cdn.example.test/chat/clip.mp4',
      video_thumbnail_url: 'https://cdn.example.test/chat/clip-thumb.jpg',
      video_public_id: 'clip-1',
      is_image: true,
      is_video: true,
      sent_at: '2026-11-07T12:00:00.000Z',
    });

    expect(message.imageUrl).toBe('https://cdn.example.test/chat/photo.jpg');
    expect(message.imagePublicId).toBe('photo-1');
    expect(message.videoUrl).toBe('https://cdn.example.test/chat/clip.mp4');
    expect(message.videoThumbnailUrl).toBe('https://cdn.example.test/chat/clip-thumb.jpg');
    expect(message.videoPublicId).toBe('clip-1');
    expect(message.isImage).toBe(true);
    expect(message.isVideo).toBe(true);
  });

  it('keeps Flutter/WebSocket camelCase media fields compatible', () => {
    const message = chatMessageFromJson({
      userId: 'fan-2',
      username: 'Another Fan',
      message: 'Match clip',
      imageUrl: 'https://cdn.example.test/chat/photo-2.jpg',
      videoUrl: 'https://cdn.example.test/chat/clip-2.mp4',
      videoThumbnailUrl: 'https://cdn.example.test/chat/clip-2-thumb.jpg',
      isImage: true,
      isVideo: true,
      timestamp: '2026-11-07T12:01:00.000Z',
    });

    expect(message.imageUrl).toBe('https://cdn.example.test/chat/photo-2.jpg');
    expect(message.videoUrl).toBe('https://cdn.example.test/chat/clip-2.mp4');
    expect(message.videoThumbnailUrl).toBe('https://cdn.example.test/chat/clip-2-thumb.jpg');
    expect(message.isImage).toBe(true);
    expect(message.isVideo).toBe(true);
  });
});
