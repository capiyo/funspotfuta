'use client';
// Web counterpart of RN useFanColors(): returns the resolved palette (hex strings)
// for the OS color scheme. Use it where a real color value is required (SVG fills,
// computed alphas). For ordinary styling prefer the `fan-*` Tailwind classes.

import { useEffect, useState } from 'react';
import { fanColors, FanColorPalette } from '@funspot/core';

export function useFanColors(): FanColorPalette {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return fanColors(isDark);
}

/** #RRGGBB + alpha fraction -> rgba(). */
export function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
