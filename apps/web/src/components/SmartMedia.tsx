import { Play } from 'lucide-react';
import { useFanColors } from '@/theme/use-fan-colors';
import { PostImage } from './ui/postImages';

export function SmartMedia({ imageUrl, videoUrl, videoThumbnailUrl, width, height, onPress }: {
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  width?: number;
  height?: number;
  onPress?: () => void;
}) {
  const colors = useFanColors();
  const src = imageUrl ?? videoThumbnailUrl;
  if (!src) return null;
  const isVideo = !!videoUrl && !imageUrl;
  return <PostImage uri={src} colors={colors} width={width} height={height} onPress={onPress}
    accessibilityLabel={isVideo ? 'Video' : 'Post image'}
    overlay={isVideo ? <span style={{ width: 52, height: 52, borderRadius: 26, background: 'rgba(0,0,0,0.55)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 }}><Play size={22} color="#FFFFFF" fill="#FFFFFF" /></span> : undefined} />;
}
