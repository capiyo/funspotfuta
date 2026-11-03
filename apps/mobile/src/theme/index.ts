// Backward-compatible static export for screens not yet converted to the
// fully OS-reactive useFanColors() hook (see ./use-fan-colors.ts, which
// MatchCard/ArenaScreen/LogsScreen already use). This restores the SAME
// field names the old (incorrect) theme.ts exported, but every value now
// comes from the real FAN_COLORS_DARK palette in @funspot/core instead
// of an invented green/blue/purple palette that never matched the
// Flutter app's actual FanColors at all.
//
// Known gap: files still importing `colors` from here render in dark
// mode only — they don't react to the OS light/dark switch the way
// useFanColors()-based screens do. Converting them follows the exact
// same pattern as ArenaScreen.tsx / MatchCard.tsx (see SYNC.md /
// README for the todo list). Filed as a known gap, not a silent one.
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
