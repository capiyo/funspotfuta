import type { ReactNode, CSSProperties } from 'react';
import { useFanColors } from '@/theme/use-fan-colors';

export function FooterPill({ icon, label, onPress, active = false, activeColor, disabled = false }: {
  icon: ReactNode;
  label?: string | number;
  onPress?: () => void;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
}) {
  const colors = useFanColors();
  const displayLabel = typeof label === 'number' ? formatCount(label) : label;
  const style: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: active ? colors.primaryDim : colors.surfaceSunken, padding: '4px 10px', opacity: disabled ? 0.5 : 1, border: 0, cursor: disabled ? 'not-allowed' : 'pointer' };
  const content = <><span style={{ fontSize: 12, color: colors.textSecondary }}>{icon}</span>{displayLabel != null && displayLabel !== '' && <span style={{ fontSize: 11, fontWeight: 600, color: active ? activeColor ?? colors.primary : colors.textSecondary }}>{displayLabel}</span>}</>;
  return <button type="button" onClick={onPress} disabled={disabled} className="footer-pill" style={style}>{content}</button>;
}
function formatCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) { const v = n / 1000; return `${v >= 100 ? Math.round(v) : v.toFixed(v < 10 ? 1 : 0).replace(/\.0$/, '')}K`; }
  const v = n / 1_000_000;
  return `${v.toFixed(v < 10 ? 1 : 0).replace(/\.0$/, '')}M`;
}
