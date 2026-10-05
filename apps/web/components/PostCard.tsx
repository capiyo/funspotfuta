'use client';

// Feed post card — restyled to match the Arena/Logs cards: avatar header
// row, NEW + media-type pills, caption, media, and a footer icon row
// (like / comment / repost / share). Follow actions are not part of mobile
// feed behavior. Same fan-* typography tokens as every
// other card (text-fan-tag, text-fan-caption, text-fan-body) — no new
// fonts introduced.
// remove the local FooterPill definition, add this near the top:
import { FooterPill } from './FooterPill';


import {
    Post,
    displayCaption,
    bestImageUrl,
    formattedDate,
    isLikedBy,
    postTypeDisplay,
} from '@funspot/core';
import { Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react';
import { SmartMedia } from './SmartMedia';

// NOTE: assumes the ported `Post` type carries `videoUrl` /
// `videoThumbnailUrl` fields, same as the Dart model (post.videoUrl,
// post.videoThumbnailUrl in posts_page.dart). If @funspot/core's Post
// type doesn't declare these yet, add them there — they clearly exist
// server-side since the Dart client already reads them directly.

function initials(name?: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

function avatarFor(userId: string): string {
    const hash = Math.abs(
        userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    );
    return `https://i.pravatar.cc/150?img=${(hash % 15) + 1}`;
}

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
    const liked = currentUserId ? isLikedBy(post, currentUserId) : false;
    const caption = displayCaption(post);
    const isOwnPost = currentUserId != null && post.userId === currentUserId;
    const typeTag = postTypeDisplay(post);

    // Video takes priority over image, same as Dart's _buildMediaContent
    const hasVideo = Boolean(post.videoUrl);
    const img = hasVideo ? null : bestImageUrl(post);

    return (
        <div className="bg-fan-background px-fan-md py-fan-lg">
            {/* Header */}
            <div className="flex items-center gap-fan-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-fan-primaryMuted ring-1 ring-fan-primary/30">
                    {post.userId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={avatarFor(post.userId)}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    ) : (
                        <span className="text-fan-tag font-bold text-fan-primary">{initials(post.userName)}</span>
                    )}
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-fan-xs">
                    <span className="text-fan-tag font-bold text-fan-textPrimary">{post.userName ?? 'user'}</span>
                    <span className="text-fan-tag text-fan-textTertiary">{formattedDate(post)}</span>

                    {isNew && (
                        <span className="rounded-fan-pill bg-fan-primaryDim px-fan-sm py-[1px] text-fan-tag font-bold text-fan-primary">
                            NEW
                        </span>
                    )}

                    {typeTag && (
                        <span className="rounded-fan-pill bg-fan-surfaceSunken px-fan-sm py-[1px] text-fan-tag text-fan-textTertiary">
                            {typeTag}
                        </span>
                    )}

                </div>
            </div>

            {/* Caption */}
            {caption && (
                <p className="mt-fan-sm pl-[40px] text-fan-body leading-snug text-fan-textPrimary">{caption}</p>
            )}

            {/* Media — real aspect ratio, video renders, only over-tall media crops */}
            {(hasVideo || img) && (
                <div className="mt-fan-sm">
                    <SmartMedia imageUrl={img} videoUrl={post.videoUrl ?? null} videoThumbnailUrl={post.videoThumbnailUrl ?? null} />
                </div>
            )}

            {/* Footer icon row */}
            <div className="mt-fan-sm flex items-center gap-fan-md pl-[40px]">
                <FooterPill
                    icon={<Heart size={13} className={liked ? 'fill-current' : ''} />}
                    label={`${post.likesCount ?? 0}`}
                    active={liked}
                    activeColor="text-fan-away"
                    onClick={() => onLike(post, index)}
                />
                <FooterPill
                    icon={<MessageCircle size={13} />}
                    label={`${post.commentsCount ?? 0}`}
                    onClick={() => onOpenComments(post, index)}
                />
                <FooterPill icon={<Repeat2 size={14} />} label="" onClick={() => onRepost?.(post)} />
                <FooterPill icon={<Share2 size={13} />} label="" onClick={() => onShare?.(post)} />
            </div>
        </div>
    );
}

