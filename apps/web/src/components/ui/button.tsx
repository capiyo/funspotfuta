import type { FanColorPalette } from '@funspot/core';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

export function Button({ label, colors, variant = 'primary', onPress, disabled = false, loading = false }: {
  label: string;
  colors: FanColorPalette;
  variant?: 'primary' | 'outline';
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  const primary = variant === 'primary';
  return <button type="button" onClick={onPress} disabled={isDisabled} aria-label={label} style={{
    borderRadius: FAN_RADIUS.pill, padding: `${FAN_SPACING.md}px ${FAN_SPACING.lg}px`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: FAN_SPACING.sm,
    border: primary ? 0 : `1px solid ${colors.border}`,
    backgroundColor: primary ? colors.primary : colors.surfaceSunken,
    opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer',
  }}>
    {loading ? <span className="button-spinner" role="status" aria-label="Loading" /> : <span style={fanText('button', colors, primary ? colors.textInverse : colors.textSecondary)}>{label}</span>}
  </button>;
}
