// Backward-compatible static export for screens that use the legacy color
// names. Values come from the shared FAN_COLORS_DARK palette.
import { FAN_COLORS_DARK } from '@funspot/core';

export const colors = {
  bg: FAN_COLORS_DARK.background,
  surface: FAN_COLORS_DARK.surface,
  green: FAN_COLORS_DARK.primary,
  greenDark: FAN_COLORS_DARK.primaryDark,
  blue: FAN_COLORS_DARK.scoreAway,
  purple: FAN_COLORS_DARK.draw,
  amber: FAN_COLORS_DARK.draw,
  border: FAN_COLORS_DARK.border,
  textPrimary: FAN_COLORS_DARK.textPrimary,
  textSecondary: FAN_COLORS_DARK.textSecondary,
  textMuted: FAN_COLORS_DARK.textTertiary,
};
