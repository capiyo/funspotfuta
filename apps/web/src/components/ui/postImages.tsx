import { memo, useState } from 'react';
import type { CSSProperties, ReactNode, SyntheticEvent } from 'react';
import { ImageOff } from 'lucide-react';
import { useFanColors } from '@/theme/use-fan-colors';
import { ICON } from '@/theme/layout';

type Size = { w: number; h: number };
const sizeCache = new Map<string, Size>();
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 16 / 9;

function clampedRatio(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 4 / 5;
  return Math.max(MIN_RATIO, Math.min(MAX_RATIO, width / height));
}

export const PostImage = memo(function PostImage({ uri, colors, width, height, overlay, onPress, accessibilityLabel = 'Post image' }: {
  uri: string;
  colors: ReturnType<typeof useFanColors>;
  width?: number;
  height?: number;
  overlay?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const cached = sizeCache.get(uri);
  const [natural, setNatural] = useState<Size | null>(
    width && height ? { w: width, h: height } : cached ?? null,
  );
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const failed = failedUri === uri;
  const ratio = natural ? clampedRatio(natural.w, natural.h) : 4 / 5;
  const maxHeight = typeof window !== 'undefined' && window.innerWidth <= 650 ? '60vh' : '480px';
  const frame: CSSProperties = {
    position: 'relative', display: 'block', width: '100%',
    aspectRatio: String(ratio), maxHeight, overflow: 'hidden',
    background: 'transparent',
  };
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const size = { w: image.naturalWidth, h: image.naturalHeight };
    sizeCache.set(uri, size);
    setNatural(size);
    setLoaded(true);
  };
  if (failed) {
    const unavailable = <button type="button" onClick={() => { setAttempt(0); setFailedUri(null); setLoaded(false); }} className="post-image-frame" style={{ ...frame, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: colors.textSecondary, cursor: 'pointer' }}><ImageOff size={ICON.sm} aria-hidden="true" />Tap to retry</button>;
    return unavailable;
  }
  const content = <div className="post-image-frame" style={frame}>
    {!loaded && <div aria-hidden="true" className="post-media-skeleton" style={{ position: 'absolute', inset: 0, zIndex: 0, background: colors.background }} />}
    <img key={attempt} src={uri} alt={accessibilityLabel} loading="eager" decoding="async" onLoad={onLoad}
      onError={() => { if (import.meta.env.DEV) console.error('[PostImage] failed media URL:', uri); if (attempt === 0) window.setTimeout(() => { setAttempt(1); setLoaded(false); }, 3000); else setFailedUri(uri); }}
      style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
    {overlay && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>{overlay}</div>}
  </div>;
  return onPress ? <button type="button" onClick={onPress} aria-label={accessibilityLabel} className="post-image-button" style={{ display: 'block', width: '100%', padding: 0, background: 'transparent', cursor: 'pointer' }}>{content}</button> : content;
});
