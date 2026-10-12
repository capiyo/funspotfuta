import type { ReactNode, CSSProperties } from 'react';
import type { FanColorPalette } from '@funspot/core';

export function FeedItem({ colors, onPress, style, children }: {
  colors: FanColorPalette;
  onPress?: () => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const root: CSSProperties = {
    backgroundColor: colors.surface === colors.background ? colors.inputSurface : colors.surface,
    color: colors.textPrimary,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    marginBottom: 10,
    minHeight: 0,
    boxSizing: 'border-box',
    ...style,
  };
  if (!onPress) return <div className="feed-item" style={root}>{children}</div>;
  return <button type="button" className="feed-item feed-item-pressable" onClick={onPress} style={{ ...root, textAlign: 'left', color: 'inherit', width: '100%', cursor: 'pointer' }}>{children}</button>;
}
