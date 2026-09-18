// Converts a FanShadowLayer (packages/core/src/theme.ts) into RN's
// shadow style props. RN has no single "box-shadow" — iOS uses
// shadowColor/shadowOffset/shadowOpacity/shadowRadius, Android uses
// elevation (a single number, no color/offset control). This applies
// both so the shadow renders on either platform; the rgba string is
// split back into a hex color + opacity since shadowColor/shadowOpacity
// are separate RN props.

import { Platform, ViewStyle } from 'react-native';
import { fanShadow, FanShadowLayer } from '@funspot/core';

function rgbaToHexAlpha(rgba: string): { hex: string; alpha: number } {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return { hex: '#000000', alpha: 0.3 };
  const [, r, g, b, a] = match;
  const toHex = (n: string) => parseInt(n, 10).toString(16).padStart(2, '0');
  return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha: a ? parseFloat(a) : 1 };
}

export function fanShadowStyle(role: 'subtle' | 'card' | 'elevated' | 'glow' | 'button', isDark: boolean): ViewStyle {
  const layer: FanShadowLayer = fanShadow(role, isDark);
  const { hex, alpha } = rgbaToHexAlpha(layer.colorRgba);

  // Android elevation has no direct equivalent to blur/offset — scale
  // roughly from the web blur value so bigger roles (elevated) sit
  // visibly higher than smaller ones (subtle).
  const elevationByRole: Record<typeof role, number> = {
    subtle: 2,
    card: 4,
    elevated: 8,
    glow: 6,
    button: 4,
  };

  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: hex,
      shadowOffset: { width: layer.offsetX, height: layer.offsetY },
      shadowOpacity: alpha,
      shadowRadius: layer.blur / 2,
    },
    android: { elevation: elevationByRole[role] },
    default: {},
  })!;
}
