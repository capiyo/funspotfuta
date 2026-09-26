// theme/layout.ts
// One home for the layout numbers that were previously scattered as raw
// literals (40, 6, 32, 15, 140 ...). Every card and screen reads from here.

import { FAN_SPACING } from '@funspot/core';

/** Horizontal gutter owned by every feed item. Screens add NO horizontal padding. */
export const GUTTER = FAN_SPACING.base;

/** Avatar 'lg' is 32px; content under an avatar indents by avatar + gap. */
export const AVATAR_LG = 32;
export const AVATAR_INDENT = AVATAR_LG + FAN_SPACING.md;

/** Icon sizes: one for inline meta, one for actions. */
export const ICON = { sm: 14, md: 18 } as const;

/** Every tappable icon/text gets the same touch target padding. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/** Pressed feedback, same everywhere. */
export const PRESSED_OPACITY = 0.7;

/** Bottom padding so the last item clears the floating tab bar. Tune once, here. */
export const LIST_BOTTOM_INSET = FAN_SPACING.xxxl * 2;