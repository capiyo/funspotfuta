// RN equivalent of FanThemeController — OS-driven (no manual toggle),
// derives light/dark from the device's system appearance and updates
// live if the user changes it while the app is running (matching
// didChangePlatformBrightness in fan_Funzy_design.dart). Colors come
// from the exact FanColors hex values shared via @funspot/core/theme.

import { useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import { fanColors, FanColorPalette } from '@funspot/core';

export function useFanColors(): FanColorPalette {
  return fanColors(useIsDark());
}

export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(Appearance.getColorScheme() === 'dark');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDark(colorScheme === 'dark');
    });
    return () => sub.remove();
  }, []);

  return isDark;
}
