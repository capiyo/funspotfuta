import type { InputHTMLAttributes, TextareaHTMLAttributes, CSSProperties, ChangeEvent } from 'react';
import type { FanColorPalette } from '@funspot/core';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'color'> & {
  colors: FanColorPalette;
  variant?: 'pill' | 'plain' | 'inline';
  multiline?: boolean;
  rows?: number;
  onChange?: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  style?: CSSProperties;
};
export function Input({ colors, variant = 'pill', multiline = false, rows, style, onChange, ...rest }: InputProps) {
  const inputStyle: CSSProperties = {
    ...fanText('body', colors, colors.textPrimary), width: '100%', minWidth: 0, boxSizing: 'border-box',
    outlineColor: colors.primary,
    ...(variant === 'pill' ? { border: `1px solid ${colors.border}`, background: colors.surfaceSunken, borderRadius: FAN_RADIUS.pill, padding: `${FAN_SPACING.base}px ${FAN_SPACING.lg}px` }
      : variant === 'inline' ? { border: 0, borderBottom: `1px solid ${colors.border}`, background: 'transparent', paddingBlock: FAN_SPACING.sm }
      : { border: 0, background: 'transparent', minHeight: 44 }),
    ...style,
  };
  const common = { ...rest, style: inputStyle, onChange, 'aria-label': rest['aria-label'] ?? rest.placeholder };
  return multiline
    ? <textarea {...(common as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)} rows={rows} />
    : <input {...common} />;
}
