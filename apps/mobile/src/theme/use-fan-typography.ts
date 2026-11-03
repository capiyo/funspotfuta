// Maps FAN_TYPOGRAPHY (packages/core/src/theme.ts) roles to actual RN
// TextStyle objects. Unlike web (where a single CSS font-family name
// with a font-weight works), RN's custom fonts require loading a
// distinct family name per weight (see App.tsx's useFonts call) and
// referencing that exact name — the `fontWeight` style prop has no
// effect on a custom fontFamily, only on the system font.

import { TextStyle } from 'react-native';
import { FAN_TYPOGRAPHY, FanColorPalette, FanTextStyle } from '@funspot/core';

// Maps a role's (family, weight) to the loaded font name from App.tsx's
// useFonts() call. Falls back to the nearest loaded weight if an exact
// one isn't loaded for that family.
function resolveFontFamily(style: FanTextStyle): string {
  if (style.fontFamily === 'condensed') {
    switch (style.fontWeight) {
      case '800':
        return 'SairaCondensed_800ExtraBold';
      case '700':
        return 'SairaCondensed_700Bold';
      case '600':
        return 'SairaCondensed_600SemiBold';
      default:
        return 'SairaCondensed_400Regular';
    }
  }
  // sans (DM Sans) — the package only ships 400/500/700; map the design
  // system's 300/600/800 roles to the nearest available weight.
  switch (style.fontWeight) {
    case '700':
    case '800':
      return 'DMSans_700Bold';
    case '600':
    case '500':
      return 'DMSans_500Medium';
    default:
      return 'DMSans_400Regular';
  }
}

export function fanText(role: keyof typeof FAN_TYPOGRAPHY, colors: FanColorPalette, colorOverride?: string): TextStyle {
  const style = FAN_TYPOGRAPHY[role];
  return {
    fontFamily: resolveFontFamily(style),
    fontSize: style.fontSize,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight ? style.fontSize * style.lineHeight : undefined,
    color: colorOverride ?? colors[style.colorKey],
  };
}
