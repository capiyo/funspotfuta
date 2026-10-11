import type { FanColorPalette } from '@funspot/core';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

export function Chip({ label, colors, active = false, variant = 'filter', activeTextColor, tone = 'neutral', onPress }: {
  label: string;
  colors: FanColorPalette;
  active?: boolean;
  variant?: 'filter' | 'tag';
  activeTextColor?: string;
  tone?: 'neutral' | 'primary';
  onPress?: () => void;
}) {
  const style: React.CSSProperties = {
    borderRadius: FAN_RADIUS.pill,
    backgroundColor: active ? colors.primary : variant === 'tag' && tone === 'primary' ? colors.primaryDim : colors.surfaceSunken,
    padding: `${variant === 'tag' ? FAN_SPACING.xs : FAN_SPACING.sm}px ${variant === 'tag' ? FAN_SPACING.md : FAN_SPACING.base}px`,
    border: 0, cursor: onPress ? 'pointer' : 'default',
  };
  const textColor = active ? activeTextColor ?? colors.textInverse : tone === 'primary' ? colors.primary : colors.textSecondary;
  const text = <span style={fanText(variant === 'tag' ? 'tag' : 'caption', colors, textColor)}>{label}</span>;
  return onPress
    ? <button type="button" onClick={onPress} aria-pressed={active} style={style}>{text}</button>
    : <span className="fan-chip" style={{ ...style, display: 'inline-flex' }}>{text}</span>;
}
