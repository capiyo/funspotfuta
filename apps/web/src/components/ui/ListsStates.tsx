import { useFanColors } from '@/theme/use-fan-colors';
import type { FanColorPalette } from '@funspot/core';
import { FAN_RADIUS, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { AVATAR_LG, GUTTER } from '@/theme/layout';

export function SkeletonRows({ colors, count = 4 }: { colors: FanColorPalette; count?: number }) {
  return <div className="skeleton-rows">{Array.from({ length: count }, (_, i) => <div key={i} style={{ display: 'flex', gap: FAN_SPACING.md, padding: `${FAN_SPACING.lg}px ${GUTTER}px`, borderBottom: `1px solid ${colors.border}` }}>
    <div style={{ width: AVATAR_LG, height: AVATAR_LG, borderRadius: AVATAR_LG / 2, background: colors.surfaceSunken }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: FAN_SPACING.sm }}>
      {[ '40%', '90%', '70%' ].map((width) => <div key={width} style={{ width, height: 10, borderRadius: FAN_RADIUS.md, background: colors.surfaceSunken }} />)}
    </div>
  </div>)}</div>;
}
export function EmptyState({ colors, title, hint }: { colors: FanColorPalette; title: string; hint?: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: FAN_SPACING.sm, paddingInline: GUTTER, paddingTop: FAN_SPACING.xxxl }}>
    <div style={{ ...fanText('title', colors, colors.textPrimary), textAlign: 'center' }}>{title}</div>
    {hint && <div style={{ ...fanText('body', colors, colors.textSecondary), textAlign: 'center' }}>{hint}</div>}
  </div>;
}
export function ErrorBanner({ colors, message }: { colors: FanColorPalette; message: string }) {
  return <div role="alert" style={{ marginTop: FAN_SPACING.md, padding: FAN_SPACING.base, borderRadius: FAN_RADIUS.md, border: `1px solid ${colors.border}`, background: colors.surfaceSunken }}>
    <span style={fanText('caption', colors, colors.textPrimary)}>{message}</span>
  </div>;
}
export function PagingFooter({ colors, loading }: { colors: FanColorPalette; loading: boolean }) {
  if (!loading) return null;
  return <div style={{ paddingBlock: FAN_SPACING.lg, textAlign: 'center' }} role="status"><span className="button-spinner" style={{ borderColor: colors.primary }} /></div>;
}
