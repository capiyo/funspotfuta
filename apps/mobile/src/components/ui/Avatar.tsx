// components/ui/Avatar.tsx
//
// Single source for every circular avatar in the app — image or
// initials. Before this component existed, four places each invented
// their own size/border/badge-text treatment independently:
//   AppHeader.avatar          — 28px, image only
//   MatchCard.teamAvatar      — 24px, tinted border, single initial
//   MatchCard.voterAvatar     — 32px, primary border, initials or emoji
//   PostCard.avatar           — 32px, raw fontSize:11/fontWeight:700 badge text
//   HistoryCard.miniStyles    — no circle at all, raw fontSize:14/fontWeight:700 badge text
//
// This replaces all five. Sizes are a fixed, named scale (sm/md/lg) —
// do not pass an arbitrary pixel size; if a screen needs a size that
// isn't here, add it to SIZES below rather than overriding inline.

import { View, Text, Image, StyleSheet } from 'react-native';
import { FanColorPalette, useProfileAvatar } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { useAuth } from '@/lib/auth/auth-context';

const SIZES = {
    sm: 24, // MatchCard team avatars, small inline badges
    md: 28, // AppHeader avatar, chip-adjacent avatars
    lg: 32, // PostCard / MatchCard voter avatars — the "primary" social avatar size
    xl: 44, // leaderboard champion and expanded profile identity
} as const;

export type AvatarSize = keyof typeof SIZES;

export function Avatar({
    colors,
    size = 'md',
    uri,
    userId,
    label,
    borderColor,
    backgroundColor,
}: {
    colors: FanColorPalette;
    size?: AvatarSize;
    /** Image URI. Takes priority over `label` when present. */
    uri?: string | null;
    userId?: string;
    /** Fallback content when no `uri`: an initial letter or a single emoji. */
    label?: string;
    /** Optional ring color — used for team-tinted (home/away) avatars. */
    borderColor?: string;
    backgroundColor?: string;
}) {
    const dim = SIZES[size];
    const { authToken } = useAuth();
    const profileAvatar = useProfileAvatar(userId, authToken);
    const imageUri = profileAvatar ?? uri ?? `https://i.pravatar.cc/150?u=${encodeURIComponent(userId ?? label ?? 'guest')}`;
    const styles = createStyles(colors, dim, borderColor, backgroundColor);

    return (
        <View style={styles.circle}>
            {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.image} />
            ) : (
                <Text style={fanText('badge', colors, colors.primary)}>{label}</Text>
            )}
        </View>
    );
}

function createStyles(
    colors: FanColorPalette,
    dim: number,
    borderColor?: string,
    backgroundColor?: string,
) {
    return StyleSheet.create({
        circle: {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: backgroundColor ?? colors.primaryMuted,
            borderWidth: borderColor ? 1 : 0,
            borderColor: borderColor ?? 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        image: {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
        },
    });
}