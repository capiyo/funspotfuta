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
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoAttempt, setVideoAttempt] = useState(0);
  const [videoRatio, setVideoRatio] = useState(width && height ? Math.max(4 / 5, Math.min(16 / 9, width / height)) : 4 / 5);
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
  }, [videoUrl, videoFailed]);

  if (videoUrl) {
    const ratio = videoRatio;
    const maxHeight = typeof window !== 'undefined' && window.innerWidth <= 650 ? '60vh' : '480px';
    return <div className="post-video-frame" style={{ position: 'relative', width: '100%', aspectRatio: String(ratio), maxHeight, overflow: 'hidden', background: 'transparent' }}>
      <video key={videoAttempt} ref={videoRef} src={videoUrl} poster={videoThumbnailUrl ?? undefined}
        playsInline muted loop preload="metadata" controls={showControls}
        onClick={() => setShowControls(true)}
        onLoadedMetadata={(event) => { const video = event.currentTarget; if (video.videoWidth && video.videoHeight) setVideoRatio(Math.max(4 / 5, Math.min(16 / 9, video.videoWidth / video.videoHeight))); }}
        onLoadedData={() => { setVideoLoaded(true); setVideoFailed(false); }}
        onError={() => { if (import.meta.env.DEV) console.error('[SmartMedia] failed video URL:', videoUrl); if (videoAttempt === 0) window.setTimeout(() => { setVideoAttempt(1); setVideoLoaded(false); }, 3000); else setVideoFailed(true); }}
        onPlay={(event) => {
          const video = event.currentTarget;
          if (currentlyPlayingVideo && currentlyPlayingVideo !== video) {
            currentlyPlayingVideo.pause();
          }
          currentlyPlayingVideo = video;
          setPaused(false);
        }}
        onPause={(event) => {
          if (currentlyPlayingVideo === event.currentTarget) currentlyPlayingVideo = null;
          setPaused(true);
        }}
        style={{ position: 'relative', zIndex: 1, display: 'block', width: '100%', height: '100%', objectFit: 'cover', background: 'transparent' }}
        aria-label="Post video" />
      {!videoLoaded && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, background: colors.background, pointerEvents: 'none' }} />}
      {videoFailed && <button type="button" onClick={() => { setVideoAttempt(0); setVideoFailed(false); setVideoLoaded(false); setPaused(true); }} style={{ position: 'absolute', inset: 0, zIndex: 4, background: colors.background, color: colors.textSecondary, cursor: 'pointer' }}>Tap to retry</button>}
      {paused && !videoFailed && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <button type="button" aria-label="Play video" onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          if (currentlyPlayingVideo && currentlyPlayingVideo !== video) currentlyPlayingVideo.pause();
          currentlyPlayingVideo = video;
          setShowControls(true);
          void video.play().then(() => setPaused(false)).catch(() => setPaused(true));
        }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, padding: 0, background: colors.surfaceSunken, cursor: 'pointer', pointerEvents: 'auto' }}>
          <Play size={22} color={colors.textPrimary} fill={colors.textPrimary} />
        </button>
      </div>}
    </div>;
  }
  if (!imageUrl) return null;
  return <PostImage uri={imageUrl} colors={colors} width={width} height={height} onPress={onPress} accessibilityLabel="Post image" />;
}
