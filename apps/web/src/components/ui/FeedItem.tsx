import type { ReactNode, CSSProperties } from 'react';
import type { FanColorPalette } from '@funspot/core';
import { FAN_SPACING } from '@funspot/core';
import { GUTTER } from '@/theme/layout';

export function FeedItem({ colors, onPress, style, children }: {
  colors: FanColorPalette;
  onPress?: () => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const root: CSSProperties = {
    backgroundColor: colors.background, paddingInline: GUTTER, paddingBlock: FAN_SPACING.lg,
    display: 'flex', flexDirection: 'column', gap: FAN_SPACING.md,
    borderBottom: `1px solid ${colors.border}`, ...style,
  };
  if (!onPress) return <div className="feed-item" style={root}>{children}</div>;
  return <button type="button" className="feed-item feed-item-pressable" onClick={onPress} style={{ ...root, textAlign: 'left', color: 'inherit', width: '100%', cursor: 'pointer' }}>{children}</button>;
}
