import type { CSSProperties } from 'react';
import type { FanColorPalette } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

const SIZES = { sm: 24, md: 28, lg: 32 } as const;
export type AvatarSize = keyof typeof SIZES;

export function Avatar({ colors, size = 'md', uri, label, borderColor, backgroundColor }: {
  colors: FanColorPalette;
  size?: AvatarSize;
  uri?: string | null;
  label?: string;
  borderColor?: string;
  backgroundColor?: string;
}) {
  const dim = SIZES[size];
  const style: CSSProperties = {
    width: dim, height: dim, borderRadius: '50%', backgroundColor: backgroundColor ?? colors.primaryMuted,
    border: borderColor ? `1px solid ${borderColor}` : 'none', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: '0 0 auto',
  };
  return <span className="fan-avatar" style={style} aria-label={label ?? 'Avatar'}>
    {uri ? <img src={uri} alt={label ? `${label} avatar` : 'Avatar'} width={dim} height={dim} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} /> : <span style={fanText('badge', colors, colors.primary)}>{label}</span>}
  </span>;
}
