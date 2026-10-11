import type { LucideIcon } from 'lucide-react';
import type { FanColorPalette } from '@funspot/core';
import { FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { HIT_SLOP, ICON, PRESSED_OPACITY } from '@/theme/layout';

export function ActionButton({ icon: Icon, count, active = false, activeColor, colors, label, onPress }: {
  icon: LucideIcon;
  count?: number;
  active?: boolean;
  activeColor?: string;
  colors: FanColorPalette;
  label: string;
  onPress?: () => void;
}) {
  const color = active ? activeColor ?? colors.primary : colors.textSecondary;
  const content = <>
    <Icon size={ICON.sm} color={color} fill={active ? color : 'none'} aria-hidden="true" />
    {count !== undefined && <span style={fanText('caption', colors, color)}>{count}</span>}
  </>;
  const style: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: FAN_SPACING.xs };
  if (!onPress) return <span style={style} aria-label={`${label}${count !== undefined ? `: ${count}` : ''}`}>{content}</span>;
  return <button type="button" onClick={onPress} aria-label={label} className="action-button" style={{ ...style, padding: Math.max(HIT_SLOP.top, HIT_SLOP.left), opacity: 1 }} onMouseDown={(e) => { e.currentTarget.style.opacity = String(PRESSED_OPACITY); }} onMouseUp={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>{content}</button>;
}
