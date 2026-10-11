import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react';
import {
  type Post, displayCaption, bestImageUrl, formattedDate, isLikedBy, postTypeDisplay, FAN_SPACING,
} from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { HIT_SLOP, PRESSED_OPACITY } from '@/theme/layout';
import { FeedItem } from './ui/FeedItem';
import { ActionButton } from './ui/ActionButton';
import { MiniAvatar } from './ui/miniAvatar';
import { SmartMedia } from './SmartMedia';
import { Chip } from './ui/Chip';

const FOOTER_BLEED = 12;

export function PostCard({ post, index, currentUserId, isNew = false, onLike, onOpenComments, onRepost, onShare }: {
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
  const meta: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: FAN_SPACING.sm, marginBottom: 16 };
  const actions: CSSProperties = { display: 'flex', alignItems: 'center', gap: FAN_SPACING.base, flexWrap: 'wrap' };
  const bottom: CSSProperties = { display: 'flex', alignItems: 'center', gap: FAN_SPACING.sm, marginTop: 18, marginBottom: -FOOTER_BLEED };
  return <FeedItem colors={colors}>
    <div className="post-card" style={{ position: 'relative' }}>
      <button type="button" onClick={() => onOpenComments(post, index)} aria-label={`Open comments on ${userName}'s post`} className="post-card-open" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
        <div style={meta}>
          <div style={{ display: 'flex', alignItems: 'center', gap: FAN_SPACING.sm, flex: 1, minWidth: 0 }}>
            <MiniAvatar colors={colors} label={userName} />
            <span style={{ ...fanText('competition', colors, '#FFFFFF'), fontWeight: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: FAN_SPACING.sm, flexShrink: 0 }}>
            {isNew && <Chip label="New" colors={colors} variant="tag" tone="primary" />}
            {typeTag && <Chip label={typeTag} colors={colors} variant="tag" />}
            <span style={fanText('tag', colors, colors.textTertiary)}>{formattedDate(post)}</span>
          </div>
        </div>
        {!!caption && <div style={{ ...fanText('body', colors, colors.textPrimary), marginBottom: 0 }}>{caption}</div>}
      </div>
      {(hasVideo || img) && <div style={{ marginTop: 12, position: 'relative', zIndex: 2 }}>
        <SmartMedia imageUrl={img} videoUrl={(post as any).videoUrl ?? null} videoThumbnailUrl={(post as any).videoThumbnailUrl ?? null} width={(post as any).imageWidth} height={(post as any).imageHeight} onPress={() => onOpenComments(post, index)} />
      </div>}
      <div style={{ ...bottom, position: 'relative', zIndex: 2 }}>
        <div style={actions}>
          <ActionButton icon={Heart} label={liked ? 'Unlike' : 'Like'} count={post.likesCount ?? 0} active={liked} activeColor={colors.away} colors={colors} onPress={() => onLike(post, index)} />
          <ActionButton icon={MessageCircle} label="Comments" count={post.commentsCount ?? 0} colors={colors} onPress={() => onOpenComments(post, index)} />
          <ActionButton icon={Repeat2} label="Repost" colors={colors} onPress={() => onRepost?.(post)} />
          <ActionButton icon={Share2} label="Share" colors={colors} onPress={() => onShare?.(post)} />
        </div>
        <div style={{ flex: 1, minWidth: 0, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {!isOwnPost && !following && <button type="button" onClick={() => setFollowing(true)} aria-label={`Follow ${userName}`} style={{ minHeight: 32, border: 0, background: 'transparent', cursor: 'pointer', padding: Math.max(HIT_SLOP.top, HIT_SLOP.left), color: colors.primary, ...fanText('tag', colors, colors.primary), opacity: PRESSED_OPACITY === 0 ? 1 : undefined }}>Follow</button>}
        </div>
      </div>
    </div>
  </FeedItem>;
}
