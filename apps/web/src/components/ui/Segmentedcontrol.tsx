import type { FanColorPalette } from '@funspot/core';
import { FAN_RADIUS, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

export function SegmentedControl<T extends string>({ options, value, onChange, colors }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  colors: FanColorPalette;
}) {
  return <div className="segmented-control" role="tablist" style={{
    display: 'flex', padding: FAN_SPACING.xs, borderRadius: FAN_RADIUS.md, backgroundColor: colors.surfaceSunken,
  }}>
    {options.map((option) => {
      const active = option.value === value;
      return <button key={option.value} type="button" role="tab" aria-selected={active}
        onClick={() => onChange(option.value)}
        style={{ flex: 1, minWidth: 0, border: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', paddingBlock: FAN_SPACING.sm, borderRadius: FAN_RADIUS.md, backgroundColor: active ? colors.surfaceElevated : 'transparent' }}>
        <span style={fanText('button', colors, active ? colors.textPrimary : colors.textSecondary)}>{option.label}</span>
      </button>;
    })}
  </div>;
}
