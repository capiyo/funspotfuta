// Converts shared FanShadowLayer values to a CSS box-shadow.
import { fanShadow, type FanShadowLayer } from '@funspot/core';

function rgbaToCssColor(rgba: string): { color: string; alpha: number } {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return { color: '#000000', alpha: 0.3 };
  const [, r, g, b, a] = match;
  return { color: `rgb(${r} ${g} ${b})`, alpha: a ? parseFloat(a) : 1 };
}

export function fanShadowStyle(
  role: 'subtle' | 'card' | 'elevated' | 'glow' | 'button',
  isDark: boolean,
): React.CSSProperties {
  const layer: FanShadowLayer = fanShadow(role, isDark);
  const { color, alpha } = rgbaToCssColor(layer.colorRgba);
  return {
    boxShadow: `${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${color} / ${alpha}`,
  };
}
