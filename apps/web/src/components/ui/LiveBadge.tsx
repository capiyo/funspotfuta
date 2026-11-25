import type { FanColorPalette } from '@funspot/core';
import { FAN_RADIUS, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

export function LiveBadge({ colors }: { colors: FanColorPalette }) {
  return <span className="live-badge" style={{
    display: 'inline-flex', alignItems: 'center', gap: FAN_SPACING.xs,
    borderRadius: FAN_RADIUS.pill, padding: `1px ${FAN_SPACING.sm}px`, backgroundColor: colors.awayDim,
  }}>
    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live }} />
    <span style={fanText('tag', colors, colors.live)}>Live</span>
  </span>;
}
