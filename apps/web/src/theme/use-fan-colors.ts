// Browser equivalent of the mobile OS-driven FanThemeController.
import { useEffect, useState } from 'react';
import { fanColors, type FanColorPalette } from '@funspot/core';

function readDarkPreference(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useFanColors(): FanColorPalette {
  return fanColors(useIsDark());
}

export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(readDarkPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setIsDark(event.matches);
    setIsDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isDark;
}
