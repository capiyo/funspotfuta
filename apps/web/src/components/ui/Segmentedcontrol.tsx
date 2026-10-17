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
    display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', width: '100%',
    maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden',
    padding: FAN_SPACING.xs, borderRadius: FAN_RADIUS.md, backgroundColor: colors.surfaceSunken,
  }}>
    {options.map((option) => {
      const active = option.value === value;
      return <button key={option.value} type="button" role="tab" aria-selected={active}
        onClick={() => onChange(option.value)}
        style={{ width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden', border: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: `${FAN_SPACING.sm} 4px`, borderRadius: FAN_RADIUS.md, backgroundColor: active ? colors.surfaceElevated : 'transparent' }}>
        <span style={{ ...fanText('button', colors, active ? colors.textPrimary : colors.textSecondary), display: 'block', width: '100%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, textAlign: 'center' }}>{option.label}</span>
      </button>;
    })}
  </div>;
}
