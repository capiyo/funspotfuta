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
  return {
    fontFamily: resolveFontFamily(style),
    fontSize: style.fontSize,
    fontWeight: Number(style.fontWeight),
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight ? style.fontSize * style.lineHeight : undefined,
    color: colorOverride ?? colors[style.colorKey],
  };
}
