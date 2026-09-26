// components/PostCard.tsx
//
// OVERHAUL.
//   - Header is two lines (name / date + tags) with Follow on the right.
//     Before, name, date, NEW, type tag and follow were all one wrapping
//     row, so it reflowed differently on every post.
//   - Caption, media and actions share ONE indent (AVATAR_INDENT). Before,
//     the caption and footer were indented by a raw 40 but the media was
//     full-bleed, so the column zig-zagged.
//   - The card no longer pads itself AND sits inside a padded screen
//     (that doubled the side margins). FeedItem owns the gutter.
//   - Actions use the same ActionButton as the match cards.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
import { AVATAR_INDENT, HIT_SLOP, PRESSED_OPACITY } from '@/theme/layout';
import { FeedItem } from './ui/FeedItem';
import { ActionButton } from './ui/ActionButton';
import { SmartMedia } from './SmartMedia';
import { Avatar } from './ui/Avatar';
import { Chip } from './ui/Chip';

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

    const indent = { paddingLeft: AVATAR_INDENT };

    return (
        <FeedItem colors={colors}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.md }}>
                <Avatar
                    colors={colors}
                    size="lg"
                    label={(post.userName ?? '?').charAt(0).toUpperCase()}
                />
                <View style={{ flex: 1, gap: 2 }}>
                    <Text style={fanText('title', colors, colors.textPrimary)} numberOfLines={1}>
                        {post.userName ?? 'User'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm }}>
                        <Text style={fanText('caption', colors, colors.textTertiary)}>
                            {formattedDate(post)}
                        </Text>
                        {isNew && <Chip label="New" colors={colors} variant="tag" tone="primary" />}
                        {typeTag && <Chip label={typeTag} colors={colors} variant="tag" />}
                    </View>
                </View>
                {!isOwnPost && !following && (
                    <Pressable
                        onPress={() => setFollowing(true)}
                        hitSlop={HIT_SLOP}
                        style={({ pressed }) => pressed && { opacity: PRESSED_OPACITY }}
                    >
                        <Text style={fanText('button', colors, colors.primary)}>Follow</Text>
                    </Pressable>
                )}
            </View>

            {/* Content column, aligned under the name */}
            {caption && (
                <Text style={[fanText('body', colors, colors.textPrimary), indent]}>{caption}</Text>
            )}

            {(hasVideo || img) && (
                <View style={indent}>
                    <SmartMedia
                        imageUrl={img}
                        videoUrl={(post as any).videoUrl ?? null}
                        videoThumbnailUrl={(post as any).videoThumbnailUrl ?? null}
                    />
                </View>
            )}

            <View
                style={[
                    indent,
                    { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.lg },
                ]}
            >
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
                <ActionButton icon={Repeat2} label="Repost" colors={colors} onPress={() => onRepost?.(post)} />
                <ActionButton icon={Share2} label="Share" colors={colors} onPress={() => onShare?.(post)} />
            </View>
        </FeedItem>
    );
}