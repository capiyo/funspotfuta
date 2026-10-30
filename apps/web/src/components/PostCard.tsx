// components/PostCard.tsx
//
// Same design as the mobile card, row for row:
//
//   [avatar] name (white)                    [New] [tag]  date
//   caption
//   media
//   Like  Comment  Repost  Share                       Follow
//   ^ one line, flush with the card floor
//
// TAP MODEL:
//   - Like / Comment / Repost / Share -> their handlers
//   - Follow                          -> follow toggle
//   - Media                           -> SmartMedia (video controls etc.)
//   - EVERYTHING ELSE                 -> onOpenComments
//
// FeedItem owns the gutter, the card never pads itself.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react';
import {
  type Post,
  displayCaption,
  bestImageUrl,
  formattedDate,
  isLikedBy,
  postTypeDisplay,
  FAN_SPACING,
} from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { HIT_SLOP, PRESSED_OPACITY } from '@/theme/layout';
import { FeedItem } from './ui/FeedItem';
import { ActionButton } from './ui/ActionButton';
import { MiniAvatar } from './ui/miniAvatar';
import { SmartMedia } from './SmartMedia';
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
  requireLogin,
  onFollow,
}: {
  post: Post;
  index: number;
  currentUserId?: string | null;
  isNew?: boolean;
  onLike: (post: Post, index: number) => void;
  onOpenComments: (post: Post, index: number) => void;
  onRepost?: (post: Post) => void;
  onShare?: (post: Post) => void;
  requireLogin?: (after?: () => void) => boolean;
  onFollow?: (post: Post) => void;
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

  const styles: Record<string, CSSProperties> = {
    card: { position: 'relative' },
    openTarget: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      border: 0,
      padding: 0,
      background: 'transparent',
      cursor: 'pointer',
      zIndex: 0,
    },
    content: { position: 'relative', zIndex: 1, pointerEvents: 'none', padding: '14px 14px 0' },
    metaRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: FAN_SPACING.sm,
      marginBottom: 12,
    },
    author: {
      display: 'flex',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      flex: 1,
      minWidth: 0,
    },
    authorName: {
      ...fanText('competition', colors, colors.textPrimary),
      fontWeight: 'normal',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    metaRight: {
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
    },
    captionRow: { marginBottom: 0 },
    mediaRow: { marginTop: 10, position: 'relative', zIndex: 2 },
    bottomRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      marginTop: 12,
      padding: '0 14px 14px',
      position: 'relative',
      zIndex: 2,
    },
    actions: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.base,
      flexWrap: 'wrap',
    },
    rightCell: {
      flex: 1,
      minWidth: 0,
      minHeight: 32,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    follow: {
      minHeight: 32,
      justifyContent: 'center',
      border: 0,
      background: 'transparent',
      cursor: 'pointer',
      padding: Math.max(HIT_SLOP.top, HIT_SLOP.left),
      ...fanText('tag', colors, colors.primary),
    },
  };

  function handleFollow() {
    setFollowing(true);
  }

  return (
    <FeedItem colors={colors}>
      <div className="post-card" style={styles.card}>
        {/* Card content stays free of invisible overlays so action buttons receive taps. */}
        {/* Layer 2: content */}
        <div style={styles.content as CSSProperties}>
          {/* Meta: author on the left, tags / date on the right */}
          <div style={styles.metaRow}>
            <div style={styles.author}>
              <MiniAvatar colors={colors} label={userName} userId={post.userId} />
              <span style={styles.authorName}>{userName}</span>
            </div>
            <div style={styles.metaRight}>
              {isNew && (
                <Chip
                  label="New"
                  colors={colors}
                  variant="tag"
                  tone="primary"
                />
              )}
              {typeTag && (
                <Chip label={typeTag} colors={colors} variant="tag" />
              )}
              <span style={fanText('tag', colors, colors.textTertiary)}>
                {formattedDate(post)}
              </span>
            </div>
          </div>

          {/* Caption */}
          {!!caption && (
            <div
              style={{
                ...fanText('body', colors, colors.textPrimary),
                ...styles.captionRow,
              }}
            >
              {caption}
            </div>
          )}
        </div>

        {/* Media: must receive its own touches (video controls) */}
        {(hasVideo || img) && (
          <div style={styles.mediaRow}>
            <SmartMedia
              imageUrl={img}
              videoUrl={(post as any).videoUrl ?? null}
              videoThumbnailUrl={(post as any).videoThumbnailUrl ?? null}
              width={(post as any).imageWidth}
              height={(post as any).imageHeight}
              onPress={() => requireLogin ? requireLogin(() => onOpenComments(post, index)) : onOpenComments(post, index)}
            />
          </div>
        )}

        {/* One line: actions on the left, follow on the right */}
        <div style={styles.bottomRow}>
          <div style={styles.actions}>
            <ActionButton
              icon={Heart}
              label={liked ? 'Unlike' : 'Like'}
              count={post.likesCount ?? 0}
              active={liked}
              activeColor={colors.away}
              colors={colors}
              onPress={() => requireLogin ? requireLogin(() => onLike(post, index)) : onLike(post, index)}
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
              onPress={() => requireLogin ? requireLogin(() => onRepost?.(post)) : onRepost?.(post)}
            />
            <ActionButton
              icon={Share2}
              label="Share"
              colors={colors}
              onPress={() => requireLogin ? requireLogin(() => onShare?.(post)) : onShare?.(post)}
            />
          </div>

          <div style={styles.rightCell}>
            {!isOwnPost && !following && (
              <button
                type="button"
                onClick={() => requireLogin ? requireLogin(() => { handleFollow(); onFollow?.(post); }) : (handleFollow(), onFollow?.(post))}
                aria-label={`Follow ${userName}`}
                style={styles.follow}
                onMouseEnter={() => undefined}
                onContextMenu={(event) => event.preventDefault()}
              >
                Follow
              </button>
            )}
          </div>
        </div>
      </div>
    </FeedItem>
  );
}
