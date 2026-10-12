import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useFanColors } from '@/theme/use-fan-colors';
import { PostImage } from './ui/postImages';

let currentlyPlayingVideo: HTMLVideoElement | null = null;

export function SmartMedia({ imageUrl, videoUrl, videoThumbnailUrl, width, height, onPress }: {
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  width?: number;
  height?: number;
  onPress?: () => void;
}) {
  const colors = useFanColors();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
      if (!visible) {
        video.pause();
        if (currentlyPlayingVideo === video) currentlyPlayingVideo = null;
        setPaused(true);
        return;
      }
      if (currentlyPlayingVideo && currentlyPlayingVideo !== video) currentlyPlayingVideo.pause();
      currentlyPlayingVideo = video;
      void video.play().then(() => setPaused(false)).catch(() => setPaused(true));
    }, { threshold: [0, 0.6, 1] });
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
      if (currentlyPlayingVideo === video) currentlyPlayingVideo = null;
    };
  }, [videoUrl]);

  if (videoUrl) {
    const ratio = width && height ? Math.max(4 / 5, Math.min(16 / 9, width / height)) : 4 / 3;
    const maxHeight = typeof window !== 'undefined' && window.innerWidth <= 650 ? '60vh' : '70vh';
    return <div className="post-video-frame" style={{ position: 'relative', width: '100%', aspectRatio: String(ratio), maxHeight, overflow: 'hidden', background: colors.background }}>
      <video ref={videoRef} src={videoUrl} poster={videoThumbnailUrl ?? undefined}
        playsInline muted loop preload="metadata" controls={showControls}
        onClick={() => setShowControls(true)}
        onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', background: colors.background }}
        aria-label="Post video" />
      {paused && <button type="button" aria-label="Play video" onClick={() => {
        const video = videoRef.current;
        if (!video) return;
        if (currentlyPlayingVideo && currentlyPlayingVideo !== video) currentlyPlayingVideo.pause();
        currentlyPlayingVideo = video;
        setShowControls(true);
        void video.play().then(() => setPaused(false)).catch(() => setPaused(true));
      }} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', cursor: 'pointer' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, background: 'rgba(0,0,0,.45)' }}>
          <Play size={22} color={colors.textPrimary} fill={colors.textPrimary} />
        </span>
      </button>}
    </div>;
  }
  if (!imageUrl) return null;
  return <PostImage uri={imageUrl} colors={colors} width={width} height={height} onPress={onPress} accessibilityLabel="Post image" />;
}
