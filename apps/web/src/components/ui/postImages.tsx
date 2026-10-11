import { memo, useEffect, useState } from 'react';
import type { ReactNode, SyntheticEvent, CSSProperties } from 'react';
import { ImageOff } from 'lucide-react';
import { useFanColors } from '@/theme/use-fan-colors';
import { ICON } from '@/theme/layout';

type Size = { w: number; h: number };
const sizeCache = new Map<string, Size>();
const PLACEHOLDER_RATIO = 4 / 3;
const MIN_RATIO = 0.5;
const MAX_HEIGHT_FRACTION = 0.7;
const MAX_UPSCALE = 2;
const RADIUS = 12;

export const PostImage = memo(function PostImage({ uri, colors, width, height, overlay, onPress, accessibilityLabel = 'Post image' }: {
  uri: string;
  colors: ReturnType<typeof useFanColors>;
  width?: number;
  height?: number;
  overlay?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const [boxW, setBoxW] = useState(0);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Size | null>(null);
  const [windowH, setWindowH] = useState(typeof window === 'undefined' ? 800 : window.innerHeight);
  useEffect(() => {
    const resize = () => setWindowH(window.innerHeight);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const failed = failedUri === uri;
  const natural = width && height ? { w: width, h: height } : sizeCache.get(uri) ?? (loaded?.w ? loaded : null);
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const size = { w: image.naturalWidth, h: image.naturalHeight };
    sizeCache.set(uri, size);
    setLoaded(size);
  };
  const frame: CSSProperties = {
    position: 'relative', width: '100%', borderRadius: RADIUS, border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceSunken, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
    aspectRatio: boxW ? undefined : String(PLACEHOLDER_RATIO),
    height: boxW && natural ? undefined : undefined,
  };
  if (failed) return <div ref={(node) => { if (node && node.clientWidth !== boxW) setBoxW(node.clientWidth); }} style={{ ...frame, aspectRatio: String(PLACEHOLDER_RATIO) }}><ImageOff size={ICON.md} color={colors.textTertiary} aria-label="Image unavailable" /></div>;

  let imgW = boxW;
  let imgH = boxW / PLACEHOLDER_RATIO;
  let sideBars = false;
  if (natural && boxW) {
    const ratio = natural.w / natural.h;
    const targetH = Math.min(boxW / Math.max(ratio, MIN_RATIO), windowH * MAX_HEIGHT_FRACTION);
    const scale = Math.min(boxW / natural.w, targetH / natural.h, MAX_UPSCALE);
    imgW = Math.round(natural.w * scale);
    imgH = Math.round(natural.h * scale);
    sideBars = imgW < boxW - 1;
  }
  const content = <div ref={(node) => { if (node && node.clientWidth !== boxW) setBoxW(node.clientWidth); }}
    className="post-image-frame" style={{ ...frame, height: boxW ? imgH : undefined, aspectRatio: boxW ? undefined : String(PLACEHOLDER_RATIO) }}>
    {sideBars && <img src={uri} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(24px)', opacity: 0.35 }} />}
    <img src={uri} onLoad={onLoad} onError={() => setFailedUri(uri)} alt={accessibilityLabel}
      style={natural && boxW ? { position: 'relative', width: imgW, height: imgH, objectFit: 'contain' } : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
    {overlay && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>{overlay}</div>}
  </div>;
  return onPress ? <button type="button" onClick={onPress} aria-label={accessibilityLabel} className="post-image-button" style={{ width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>{content}</button> : content;
});
