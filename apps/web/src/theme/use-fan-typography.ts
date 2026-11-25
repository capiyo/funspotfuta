import type { CSSProperties } from 'react';
// Maps shared FAN_TYPOGRAPHY roles to browser CSS text styles.
import { FAN_TYPOGRAPHY, type FanColorPalette, type FanTextStyle } from '@funspot/core';

function resolveFontFamily(style: FanTextStyle): string {
  if (style.fontFamily === 'condensed') return '"Saira Condensed", "Arial Narrow", sans-serif';
  return '"DM Sans", system-ui, sans-serif';
}

export function fanText(
  role: keyof typeof FAN_TYPOGRAPHY,
  colors: FanColorPalette,
  colorOverride?: string,
): CSSProperties {
  const style = FAN_TYPOGRAPHY[role];
  const webFontSize: Partial<Record<keyof typeof FAN_TYPOGRAPHY, string>> = {
    body: 'clamp(0.875rem, 0.84rem + 0.12vw, 0.9375rem)',
    caption: 'clamp(0.75rem, 0.72rem + 0.12vw, 0.8125rem)',
    tag: 'clamp(0.75rem, 0.72rem + 0.12vw, 0.8125rem)',
    button: 'clamp(0.75rem, 0.72rem + 0.12vw, 0.8125rem)',
    competition: 'clamp(0.875rem, 0.84rem + 0.12vw, 1rem)',
    title: 'clamp(0.9375rem, 0.9rem + 0.15vw, 1rem)',
    microLabel: '0.75rem',
  };
  return {
    fontFamily: resolveFontFamily(style),
    fontSize: webFontSize[role] ?? style.fontSize,
    fontWeight: Number(style.fontWeight),
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    color: colorOverride ?? colors[style.colorKey],
  };
}
