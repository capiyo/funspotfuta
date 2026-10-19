// components/PostCard.tsx
//
// Same design as MatchCard, row for row:
//
//   [avatar] name (white)                    [New] [tag]  date
//   caption
//   media
//   Like  Comment  Repost  Share                       Follow
//   ^ one line, flush with the card floor
//
// TAP MODEL:
//   - Like / Comment / Repost / Share → their handlers
//   - Follow                          → follow toggle
//   - Media                           → SmartMedia (video controls etc.)
//   - EVERYTHING ELSE                 → onOpenComments
//
// FeedItem owns the gutter, the card never pads itself.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react-native';
import {
    Post,
    displayCaption,
    bestImageUrl,
    formattedDate,
    isLikedBy,
    postTypeDisplay,
    FAN_SPACING,
} from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

// Typography tuned to the mobile-web reference for Chats and Feed.
function webParityText(role: Parameters<typeof fanText>[0], colors: Parameters<typeof fanText>[1], color?: string) {
  const base = fanText(role, colors, color);
  const size = role === 'tag' ? 12 : role === 'caption' ? 13 : role === 'body' ? 14 : role === 'competition' ? 14 : (base.fontSize ?? 12);
  return { ...base, fontSize: size, lineHeight: Math.round(size * 1.4) };
}
import { HIT_SLOP, PRESSED_OPACITY } from '@/theme/layout';
import { FeedItem } from './ui/FeedItem';
import { ActionButton } from './ui/ActionButton';
import { MiniAvatar } from '../components/ui/miniAvatar';
import { SmartMedia } from './SmartMedia';
import { Chip } from './ui/Chip';

// Pulls the footer down to the card floor (cancels FeedItem's bottom
// padding). Keep in sync with MatchCard's FOOTER_BLEED.
const FOOTER_BLEED = 12;

export function PostCard({
    post,
    index,
    currentUserId,
    isNew = false,
    onLike,
    onOpenComments,
    onRepost,
    onShare,
}: {
    post: Post;
    index: number;
    currentUserId?: string | null;
    isNew?: boolean;
    onLike: (post: Post, index: number) => void;
    onOpenComments: (post: Post, index: number) => void;
    onRepost?: (post: Post) => void;
    onShare?: (post: Post) => void;
}) {
    const colors = useFanColors();
    const [following, setFollowing] = useState(false);

    const liked = currentUserId ? isLikedBy(post, currentUserId) : false;
    const caption = displayCaption(post);
    const typeTag = postTypeDisplay(post);
    const isOwnPost = currentUserId != null && post.userId === currentUserId;

    const hasVideo = Boolean((post as any).videoUrl);
    const img = hasVideo ? null : bestImageUrl(post);
    const userName = post.userName ?? 'User';

    return (
        <FeedItem colors={colors}>
            {/* Layer 1: invisible full-card tap target → comments */}
            <Pressable
                onPress={() => onOpenComments(post, index)}
                style={StyleSheet.absoluteFill}
                android_ripple={{ color: colors.border, borderless: false }}
                accessibilityRole="button"
                accessibilityLabel={`Open comments on ${userName}'s post`}
            />

            {/* Layer 2: content */}
            <View pointerEvents="box-none">
                {/* Meta: author on the left, tags / date on the right */}
                <View style={styles.metaRow} pointerEvents="none">
                    <View style={[styles.author, styles.grow]}>
                        <MiniAvatar colors={colors} label={userName} />
                        <Text
                            style={[
                                webParityText('competition', colors, '#FFFFFF'),
                                styles.authorName,
                                styles.grow,
                            ]}
                            numberOfLines={1}
                        >
                            {userName}
                        </Text>
                    </View>
                    <View style={styles.metaRight}>
                        {isNew && (
                            <Chip label="New" colors={colors} variant="tag" tone="primary" />
                        )}
                        {typeTag && <Chip label={typeTag} colors={colors} variant="tag" />}
                        <Text style={webParityText('tag', colors, colors.textTertiary)}>
                            {formattedDate(post)}
                        </Text>
                    </View>
                </View>

                {/* Caption */}
                {!!caption && (
                    <View style={styles.captionRow} pointerEvents="none">
                        <Text style={webParityText('body', colors, colors.textPrimary)}>
                            {caption}
                        </Text>
                    </View>
                )}

                {/* Media: must receive its own touches (video controls) */}
                {(hasVideo || img) && (
                    <View style={styles.mediaRow}>
                        <SmartMedia
                            imageUrl={img}
                            videoUrl={(post as any).videoUrl ?? null}
                            videoThumbnailUrl={(post as any).videoThumbnailUrl ?? null}
                            width={(post as any).imageWidth}
                            height={(post as any).imageHeight}
                        />
                    </View>
                )}

                {/* One line: actions on the left, follow on the right */}
                <View style={styles.bottomRow}>
                    <View style={styles.actions}>
                        <ActionButton
                            icon={Heart}
                            label={liked ? 'Unlike' : 'Like'}
                            count={post.likesCount ?? 0}
                            active={liked}
                            activeColor={colors.away}
                            colors={colors}
                            onPress={() => onLike(post, index)}
                        />
                        <ActionButton
                            icon={MessageCircle}
                            label="Comments"
                            count={post.commentsCount ?? 0}
                            colors={colors}
                            onPress={() => onOpenComments(post, index)}
                        />
                        <ActionButton
                            icon={Repeat2}
                            label="Repost"
                            colors={colors}
                            onPress={() => onRepost?.(post)}
                        />
                        <ActionButton
                            icon={Share2}
                            label="Share"
                            colors={colors}
                            onPress={() => onShare?.(post)}
                        />
                    </View>

                    <View style={styles.rightCell}>
                        {!isOwnPost && !following && (
                            <Pressable
                                onPress={() => setFollowing(true)}
                                hitSlop={HIT_SLOP}
                                style={({ pressed }) => [
                                    styles.follow,
                                    pressed && { opacity: PRESSED_OPACITY },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Follow ${userName}`}
                            >
                                <Text style={webParityText('tag', colors, colors.primary)}>
                                    Follow
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>
        </FeedItem>
    );
}

const styles = StyleSheet.create({
    grow: { flex: 1 },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    author: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: FAN_SPACING.sm,
    },
    authorName: { fontWeight: 'normal' },
    metaRight: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: FAN_SPACING.sm,
    },
    captionRow: { marginBottom: 0 },
    mediaRow: { marginTop: 10 },
    // Negative bottom margin cancels FeedItem's bottom padding so the row
    // sits on the card floor.
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: FAN_SPACING.sm,
        marginTop: 10,
        marginBottom: -FOOTER_BLEED,
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: FAN_SPACING.base,
    },
    rightCell: {
        flex: 1,
        minWidth: 0,
        minHeight: 32,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    follow: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 },
});