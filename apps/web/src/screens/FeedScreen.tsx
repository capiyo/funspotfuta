import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import { ImagePlus, Paperclip } from 'lucide-react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import { getPosts, toggleLikePost, type Post, isLikedBy, FAN_SPACING } from '@funspot/core';
import { createPost } from '@/lib/api/posts-create';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { ICON, LIST_BOTTOM_INSET } from '@/theme/layout';
import { PostCard } from '@/components/PostCard';
import { FeedItem } from '@/components/ui/FeedItem';
import { ActionButton } from '@/components/ui/ActionButton';
import { MiniAvatar } from '@/components/ui/miniAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorBanner, PagingFooter, SkeletonRows } from '@/components/ui/ListsStates';
import { useHomeList } from './home/home-context';

const PAGE_SIZE = 10;
const FEED_KEY = ['feed'] as const;
const FOOTER_BLEED = 12;
type FeedPage = { posts: Post[] };

export default function FeedScreen() {
  const colors = useFanColors();
  const queryClient = useQueryClient();
  const { userId, username, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const { scrollProps, topInset } = useHomeList();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data, isPending, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: FEED_KEY,
    queryFn: ({ pageParam }) => getPosts({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => lastPage.posts.length === PAGE_SIZE ? allPages.length + 1 : undefined,
    placeholderData: (previous) => previous,
    retry: 1,
    enabled: true,
  });
  const posts = useMemo(() => data?.pages.flatMap((page) => page.posts) ?? [], [data]);
  const loadError = isError && posts.length === 0 ? 'Could not load posts. Pull down to try again.' : null;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  function handlePickImage() {
    if (!isLoggedIn) return requireLogin(handlePickImage);
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.onchange = () => { const file = picker.files?.[0]; if (file) setImage(file); };
    picker.click();
  }
  async function handlePost() {
    if (!isLoggedIn) return requireLogin(handlePost);
    if (!userId || !username || (!caption.trim() && !image)) return;
    setPosting(true);
    try {
      await createPost({ userId, userName: username, caption: caption.trim() || undefined, image: image ?? undefined });
      setCaption('');
      setImage(null);
      await queryClient.invalidateQueries({ queryKey: FEED_KEY });
    } finally { setPosting(false); }
  }
  async function handleLike(post: Post) {
    if (!isLoggedIn) return requireLogin(() => handleLike(post));
    if (!userId || !username || !post.id) return;
    const wasLiked = isLikedBy(post, userId);
    queryClient.setQueryData<InfiniteData<FeedPage>>(FEED_KEY, (previous) => previous && ({
      ...previous,
      pages: previous.pages.map((page) => ({
        ...page,
        posts: page.posts.map((item) => item.id === post.id ? {
          ...item,
          likedBy: wasLiked ? (item.likedBy ?? []).filter((id) => id !== userId) : [...(item.likedBy ?? []), userId],
          likesCount: (item.likesCount ?? 0) + (wasLiked ? -1 : 1),
        } : item),
      })),
    }));
    try { await toggleLikePost(post.id, userId, username); }
    catch { await queryClient.invalidateQueries({ queryKey: FEED_KEY }); }
  }

  const canPost = !!caption.trim() || !!image;
  const composer = <FeedItem colors={colors}>
    <div style={{ display: 'flex', alignItems: 'center', gap: FAN_SPACING.sm, marginBottom: 12 }}>
      <MiniAvatar colors={colors} label={username ?? '?'} />
      <span style={fanText('competition', colors, '#FFFFFF')}>{username ?? 'Fan'}</span>
    </div>
    <Input colors={colors} variant="plain" value={caption} onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCaption(event.target.value)}
      placeholder={isLoggedIn ? `What's on your mind, ${username ?? 'fan'}?` : 'Log in to post'} multiline disabled={!isLoggedIn} />
    {image && <div style={{ display: 'flex', alignItems: 'center', gap: FAN_SPACING.xs, marginTop: FAN_SPACING.sm }}>
      <Paperclip size={ICON.sm} color={colors.textSecondary} /><span style={{ ...fanText('caption', colors, colors.textSecondary), flex: 1 }}>{image.name}</span>
      <button type="button" onClick={() => setImage(null)} aria-label="Remove attached image">×</button>
    </div>}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: -FOOTER_BLEED }}>
      <ActionButton icon={ImagePlus} label="Add image" colors={colors} onPress={handlePickImage} />
      <Button label="Post" colors={colors} variant="primary" disabled={!canPost} loading={posting} onPress={handlePost} />
    </div>
  </FeedItem>;

  const listHeader = <div>{composer}{loadError && <div style={{ padding: `${FAN_SPACING.md}px ${FAN_SPACING.lg}px` }}><ErrorBanner colors={colors} message={loadError} /></div>}</div>;
  const listStyle: CSSProperties = { minHeight: 0, overflowY: 'auto', paddingTop: topInset, paddingBottom: LIST_BOTTOM_INSET };
  return <div className="feed-screen" style={{ height: '100%', minHeight: 0, overflowY: 'auto', background: colors.background }} {...scrollProps}>
    {isPending ? <div style={listStyle}>{listHeader}<SkeletonRows colors={colors} /></div> : <>
      {listHeader}
      {posts.length === 0 ? isError
        ? <EmptyState colors={colors} title="You're offline" hint="Pull down to retry once you're back online." />
        : <EmptyState colors={colors} title="No posts yet" hint="Be the first to post." />
        : posts.map((post, index) => <PostCard key={post.id ?? index} post={post} index={index} currentUserId={userId} onLike={(item) => handleLike(item)} onOpenComments={() => {}} onRepost={() => {}} onShare={() => {}} />)}
      <div style={{ textAlign: 'center', padding: FAN_SPACING.lg }}>
        {isFetchingNextPage ? <PagingFooter colors={colors} loading /> : null}
        {hasNextPage && <button type="button" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>Load more</button>}
        <button type="button" onClick={() => void onRefresh()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh feed'}</button>
      </div>
    </>}
  </div>;
}
