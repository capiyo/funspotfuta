// Ported from funspot/lib/pages/fan_Funzy_design.dart's FanColors —
// exact hex values, both light ("GreenPesa Light") and dark
// ("GreenPesa Night") palettes. This is the single source of truth for
// color in both apps/web (converted to CSS vars) and apps/mobile
// (consumed directly as JS objects in StyleSheets).
//
// PALETTE UPDATE: brand accents recolored from navy-slate to a green
// family based on #01FF01. The dark card/home background remains the
// original #0F1E27 — only bluish UI accents (borders, primary, text
// tints, glow shadows) were swapped to green. scoreAway and the
// voteAway gradient stay blue since they are semantic "away" colors,
// not brand-blue.
//
// Dark mode is intentionally FLAT in the original: background,
// backgroundTint, surface, surfaceElevated, and surfaceSunken all
// resolve to the same value (#0F1E27) — no tiered card depth. Light
// mode keeps its tiers. inputSurface/inputSurfaceDisabled exist only to
// lift form inputs one notch off that flat dark background so they
// don't disappear into the card behind them.

export interface FanColorPalette {
  background: string;
  backgroundTint: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  inputSurface: string;
  inputSurfaceDisabled: string;

  border: string;
  borderActive: string;
  borderFocus: string;

  primary: string;
  primaryDark: string;
  primaryMuted: string;
  primaryDim: string;
  primaryGlow: string; // rgba, 40 (dark) / 22 (light) alpha over primary

  secondary: string;
  secondaryDim: string;
  secondaryGlow: string;

  draw: string; // gold — draw vote / neutral / jackpot energy
  drawDim: string;
  drawGlow: string;

  away: string; // red — away vote / destructive / LIVE
  awayDim: string;
  awayGlow: string;
  live: string; // === away

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  scoreHome: string; // === primary
  scoreAway: string;
  scoreDash: string;
}

export const FAN_COLORS_DARK: FanColorPalette = {
  background: '#0F1E27',
  backgroundTint: '#0F1E27',
  surface: '#0F1E27',
  surfaceElevated: '#0F1E27',
  surfaceSunken: '#0F1E27',
  inputSurface: '#192730',
  inputSurfaceDisabled: '#111F28',

  border: '#1D421D',
  borderActive: '#2E5E2E',
  borderFocus: '#4FD14F',

  primary: '#4FD14F',
  primaryDark: '#2E962E',
  primaryMuted: '#163E16',
  primaryDim: '#103010',
  primaryGlow: 'rgba(79,209,79,0.25)',

  secondary: '#FF7A29',
  secondaryDim: '#3A2414',
  secondaryGlow: 'rgba(255,122,41,0.2)',

  draw: '#FFC53D',
  drawDim: '#352A0C',
  drawGlow: 'rgba(255,197,61,0.25)',

  away: '#FF5A45',
  awayDim: '#391712',
  awayGlow: 'rgba(255,90,69,0.25)',
  live: '#FF5A45',

  textPrimary: '#F2F8F2',
  textSecondary: '#A9C4A9',
  textTertiary: '#6E926E',
  textInverse: '#FFFFFF',

  scoreHome: '#4FD14F',
  scoreAway: '#5FA8FF',
  scoreDash: '#33495A',
};

export const FAN_COLORS_LIGHT: FanColorPalette = {
  background: '#FFFFFF',
  backgroundTint: '#F5F8FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#EDF2F5',
  inputSurface: '#FFFFFF',
  inputSurfaceDisabled: '#FAFAFA',

  border: '#DDEADE',
  borderActive: '#BFD9C0',
  borderFocus: '#1F551F',

  primary: '#1F551F',
  primaryDark: '#143E14',
  primaryMuted: '#E3EFE3',
  primaryDim: '#F0F7F0',
  primaryGlow: 'rgba(31,85,31,0.13)',

  secondary: '#FFD9BD',
  secondaryDim: '#FFF3EA',
  secondaryGlow: 'rgba(255,217,189,0.13)',

  draw: '#C79000',
  drawDim: '#FFF6E0',
  drawGlow: 'rgba(199,144,0,0.13)',

  away: '#D93025',
  awayDim: '#FDECEA',
  awayGlow: 'rgba(217,48,37,0.13)',
  live: '#D93025',

  textPrimary: '#162B16',
  textSecondary: '#557D55',
  textTertiary: '#96B096',
  textInverse: '#FFFFFF',

  scoreHome: '#1F551F',
  scoreAway: '#2B6CB0',
  scoreDash: '#B7C4CC',
};

// FanTheme.controller: OS-driven, no manual override — both apps should
// derive isDark from the platform's color scheme (prefers-color-scheme
// on web, Appearance.getColorScheme() on RN) rather than storing a user
// toggle, matching the original exactly.
export function fanColors(isDark: boolean): FanColorPalette {
  return isDark ? FAN_COLORS_DARK : FAN_COLORS_LIGHT;
}

// FanRadius — no color dependency, same on both platforms.
export const FAN_RADIUS = {
  sm: 4,
  md: 8,
  lg: 14,
  xl: 18,
  pill: 999,
};

// FanSpacing — exact scale from fan_Funzy_design.dart. No color
// dependency, same on both platforms.
export const FAN_SPACING = {
  xs: 2,
  sm: 4,
  md: 8,
  base: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// FanTypography — exact per-role type scale. fontFamily is one of
// FAN_FONTS.condensed (Saira Condensed — scores/headlines) or
// FAN_FONTS.sans (DM Sans — everything else). `color` names which
// FanColorPalette key this role uses by default (screens can still
// override per-instance, matching how the Dart getters are used).
export interface FanTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: '300' | '400' | '500' | '600' | '700' | '800';
  letterSpacing: number;
  lineHeight?: number; // multiplier, matches Flutter's `height` (omit = font default)
  colorKey: keyof FanColorPalette;
}

export const FAN_TYPOGRAPHY: Record<string, FanTextStyle> = {
  scoreHero: { fontFamily: 'condensed', fontSize: 48, fontWeight: '800', letterSpacing: -1, lineHeight: 1.0, colorKey: 'textPrimary' },
  scoreCompact: { fontFamily: 'condensed', fontSize: 32, fontWeight: '800', letterSpacing: -0.5, lineHeight: 1.0, colorKey: 'textPrimary' },
  scoreDash: { fontFamily: 'condensed', fontSize: 24, fontWeight: '600', letterSpacing: 0, lineHeight: 1.0, colorKey: 'scoreDash' },
  headline: { fontFamily: 'condensed', fontSize: 24, fontWeight: '700', letterSpacing: 0.2, colorKey: 'textPrimary' },
  title: { fontFamily: 'sans', fontSize: 15, fontWeight: '700', letterSpacing: 0.1, colorKey: 'textPrimary' },
  body: { fontFamily: 'sans', fontSize: 14, fontWeight: '400', letterSpacing: 0, lineHeight: 1.55, colorKey: 'textSecondary' },
  caption: { fontFamily: 'sans', fontSize: 10, fontWeight: '500', letterSpacing: 0.2, colorKey: 'textTertiary' },
  tag: { fontFamily: 'sans', fontSize: 8, fontWeight: '700', letterSpacing: 1.2, colorKey: 'textSecondary' },
  button: { fontFamily: 'sans', fontSize: 10, fontWeight: '700', letterSpacing: 0.4, colorKey: 'textInverse' },
  statValue: { fontFamily: 'condensed', fontSize: 16, fontWeight: '800', letterSpacing: 0, lineHeight: 1.0, colorKey: 'textPrimary' },
  statDelta: { fontFamily: 'sans', fontSize: 19, fontWeight: '300', letterSpacing: 0.3, lineHeight: 1.2, colorKey: 'textPrimary' },
  votePct: { fontFamily: 'condensed', fontSize: 16, fontWeight: '600', letterSpacing: 0, lineHeight: 1.0, colorKey: 'textPrimary' },
  competition: { fontFamily: 'sans', fontSize: 9, fontWeight: '600', letterSpacing: 1.4, colorKey: 'textTertiary' },
};

// FanShadows — exact blur/offset/opacity per role, per theme. Dark mode
// uses lower-opacity shadows (a black shadow barely reads against a
// near-black background) and the "glow" role switches from a black
// shadow to a colored glow around the primary color entirely.
export interface FanShadowLayer {
  colorRgba: string; // rgba() string, ready to use in either CSS box-shadow or as an RN shadowColor
  blur: number;
  offsetX: number;
  offsetY: number;
  spread?: number; // web-only (box-shadow spread-radius); RN has no spread equivalent
}

export function fanShadow(role: 'subtle' | 'card' | 'elevated' | 'glow' | 'button', isDark: boolean): FanShadowLayer {
  const palette = fanColors(isDark);
  switch (role) {
    case 'subtle':
      return isDark
        ? { colorRgba: 'rgba(0,0,0,0.2)', blur: 10, offsetX: 0, offsetY: 3 }
        : { colorRgba: 'rgba(20,48,36,0.03)', blur: 8, offsetX: 0, offsetY: 2 };
    case 'card':
      return isDark
        ? { colorRgba: 'rgba(0,0,0,0.25)', blur: 18, offsetX: 0, offsetY: 6 }
        : { colorRgba: 'rgba(20,48,36,0.05)', blur: 16, offsetX: 0, offsetY: 4 };
    case 'elevated':
      return isDark
        ? { colorRgba: 'rgba(0,0,0,0.35)', blur: 28, offsetX: 0, offsetY: 10 }
        : { colorRgba: 'rgba(20,48,36,0.08)', blur: 24, offsetX: 0, offsetY: 8 };
    case 'glow':
      return isDark
        ? { colorRgba: hexToRgba(palette.primary, 0.33), blur: 22, offsetX: 0, offsetY: 0, spread: -4 }
        : { colorRgba: hexToRgba(palette.primary, 0.15), blur: 16, offsetX: 0, offsetY: 0, spread: -4 };
    case 'button':
      return isDark
        ? { colorRgba: hexToRgba(palette.primary, 0.33), blur: 12, offsetX: 0, offsetY: 4 }
        : { colorRgba: hexToRgba(palette.primary, 0.2), blur: 12, offsetX: 0, offsetY: 4 };
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Web helper: turns a FanShadowLayer into a CSS box-shadow value.
export function shadowToCss(s: FanShadowLayer): string {
  return `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread ?? 0}px ${s.colorRgba}`;
}

// FanDecorations — named, reusable border+radius+shadow combinations.
// Each returns the pieces (not a rendered style object) so both apps can
// apply them their own way (Tailwind arbitrary values on web, StyleSheet
// on RN).
export interface FanDecoration {
  radius: number;
  borderWidth: number;
  borderColorKey: keyof FanColorPalette;
  shadow: FanShadowLayer;
  backgroundColorKey: keyof FanColorPalette;
}

// 'flatListItem' — added after comparing against real screenshots of the
// live app (Arena/Feed/Logs columns): fixture/post/history cards in the
// actual product have NO border and NO shadow. Background is
// 'background', not 'surface' — since dark mode is flat (surface ===
// background already), this makes the "card" visually merge with the
// page; separation between list items comes from padding/margin and a
// hairline divider (applied by the caller, typically border-b at very
// low alpha), not a boxed container. The 'card'/'fixtureCard'/
// 'postCard'/'elevatedCard' roles below are kept for surfaces that
// genuinely are boxed off (modals, dropdown menus) — but the Arena/Feed/
// Logs list items should use 'flatListItem', not those.
export function fanDecoration(
  role: 'card' | 'fixtureCard' | 'elevatedCard' | 'postCard' | 'statChip' | 'flatListItem',
  isDark: boolean,
  opts?: { isActive?: boolean; isLive?: boolean }
): FanDecoration {
  const isActive = opts?.isActive ?? false;
  const isLive = opts?.isLive ?? false;
  switch (role) {
    case 'flatListItem':
      return {
        radius: 0,
        borderWidth: 0,
        borderColorKey: 'background',
        shadow: { colorRgba: 'rgba(0,0,0,0)', blur: 0, offsetX: 0, offsetY: 0 },
        backgroundColorKey: 'background',
      };
    case 'card':
      return {
        radius: FAN_RADIUS.lg,
        borderWidth: isActive ? 1.4 : 1,
        borderColorKey: isActive ? 'borderActive' : 'border',
        shadow: fanShadow('card', isDark),
        backgroundColorKey: 'surface',
      };
    case 'fixtureCard':
      return {
        radius: FAN_RADIUS.lg,
        borderWidth: isLive ? 1.4 : 1,
        borderColorKey: isLive ? 'live' : 'border', // live gets alpha applied by the caller
        shadow: fanShadow(isLive ? 'glow' : 'card', isDark),
        backgroundColorKey: 'surface',
      };
    case 'elevatedCard':
      return {
        radius: FAN_RADIUS.xl,
        borderWidth: 1,
        borderColorKey: isActive ? 'borderActive' : 'border',
        shadow: fanShadow('elevated', isDark),
        backgroundColorKey: 'surfaceElevated',
      };
    case 'postCard':
      return {
        radius: FAN_RADIUS.lg,
        borderWidth: 1,
        borderColorKey: isActive ? 'borderActive' : 'border',
        shadow: fanShadow('subtle', isDark),
        backgroundColorKey: 'surface',
      };
    case 'statChip':
      return {
        radius: FAN_RADIUS.md,
        borderWidth: 1,
        borderColorKey: 'border',
        shadow: fanShadow('subtle', isDark),
        backgroundColorKey: 'surfaceSunken',
      };
  }
}

// FanGradients — exact stop colors per role.
export function fanGradient(role: 'voteHome' | 'voteDraw' | 'voteAway' | 'fire' | 'cta', isDark: boolean): [string, string] {
  const p = fanColors(isDark);
  switch (role) {
    case 'voteHome':
      return [p.primary, p.primaryDark];
    case 'voteDraw':
      return [p.draw, isDark ? '#C98A00' : '#A67700'];
    case 'voteAway':
      return [p.scoreAway, isDark ? '#2E6FE0' : '#1D4ED8'];
    case 'fire':
      return [p.draw, p.away];
    case 'cta':
      return isDark ? ['#01FF01', '#22D3EE'] : [p.primary, p.primaryDark];
  }
}

// FanTypography font families — Saira Condensed for scores/headlines,
// DM Sans for everything else. Both are real Google Fonts.
export const FAN_FONTS = {
  condensed: 'Saira Condensed',
  sans: 'DM Sans',
};

// Maps a MatchOutcome (see winnerOutcome/historyResultOutcome) to the
// correct theme color — same mapping as VoteOutcomeX.fill in
// fan_Funzy_design.dart (home -> primary, away -> scoreAway, draw ->
// draw/gold, unknown -> textTertiary/grey).
export function outcomeColor(outcome: 'home' | 'away' | 'draw' | 'unknown', palette: FanColorPalette): string {
  switch (outcome) {
    case 'home':
      return palette.primary;
    case 'away':
      return palette.scoreAway;
    case 'draw':
      return palette.draw;
    default:
      return palette.textTertiary;
  }
}