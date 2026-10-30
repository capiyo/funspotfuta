import type { CSSProperties } from 'react';
import { useProfileAvatar, type FanColorPalette } from '@funspot/core';
import { getFanAvatarUri } from '@/lib/avatar-uri';
import { useAuth } from '@/lib/auth/auth-context';
import { fanText } from '@/theme/use-fan-typography';

const SIZES = { sm: 24, md: 28, lg: 32, xl: 44 } as const;
export type AvatarSize = keyof typeof SIZES;

export function Avatar({ colors, size = 'md', uri, userId, label, borderColor, backgroundColor }: {
  colors: FanColorPalette;
  size?: AvatarSize;
  uri?: string | null;
  userId?: string;
  label?: string;
  borderColor?: string;
  backgroundColor?: string;
}) {
  const dim = SIZES[size];
  const { authToken } = useAuth();
  const profileAvatar = useProfileAvatar(userId, authToken);
  const imageUri = profileAvatar ?? uri ?? (userId ? getFanAvatarUri(userId) : null);
  const style: CSSProperties = {
    width: dim, height: dim, borderRadius: '50%', backgroundColor: backgroundColor ?? colors.primaryMuted,
    border: borderColor ? `1px solid ${borderColor}` : 'none', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: '0 0 auto',
  };
  return <span className="fan-avatar" style={style} aria-label={label ?? 'Avatar'}>
    {imageUri ? <img src={imageUri} alt={label ? `${label} avatar` : 'Avatar'} width={dim} height={dim} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} /> : <span style={fanText('badge', colors, colors.primary)}>{label}</span>}
  </span>;
}
