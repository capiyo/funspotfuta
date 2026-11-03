// Legacy theme export kept for older mobile screens.
// Keep every consumer on the shared @funspot/core stadium palette so
// screens using this compatibility path match useFanColors() screens.
import { FAN_COLORS_DARK } from '@funspot/core';

export const colors = {
  bg: FAN_COLORS_DARK.background,
  surface: FAN_COLORS_DARK.surface,
  green: FAN_COLORS_DARK.primary,
  greenDark: FAN_COLORS_DARK.primaryDark,
  blue: FAN_COLORS_DARK.scoreAway,
  purple: FAN_COLORS_DARK.secondary,
  amber: FAN_COLORS_DARK.draw,
  border: FAN_COLORS_DARK.border,
  textPrimary: FAN_COLORS_DARK.textPrimary,
  textSecondary: FAN_COLORS_DARK.textSecondary,
  textMuted: FAN_COLORS_DARK.textTertiary,
};
