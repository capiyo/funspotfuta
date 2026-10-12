import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, MessageCircle, Reply, Send, X } from 'lucide-react';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { NotificationService } from '@/lib/api/notification-service';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { useToast } from '@/lib/toast/toast-context';

type FanColors = ReturnType<typeof useFanColors>;
const API_BASE = 'https://clash-api-m5mr.onrender.com/api';
const CACHE_FRESH_MS = 30_000;

interface CommentData {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  comment: string;
  likes_count: number;
  liked_by: string[];
  parent_comment_id: string | null;
  reply_count: number;
  replies: CommentData[];
  created_at: string;
  updated_at: string;
  last_modified: string;
  timestamp: number;
}

function parseCommentFromJson(json: any): CommentData {
  return {
    id: json?.id?.toString() ?? '',
    post_id: json?.postId?.toString() ?? json?.post_id?.toString() ?? '',
    user_id: json?.userId?.toString() ?? json?.user_id?.toString() ?? '',
    user_name: json?.userName?.toString() ?? json?.user_name?.toString() ?? 'Anonymous',
    comment: json?.comment?.toString() ?? '',
    likes_count: Number(json?.likesCount ?? json?.likes_count ?? 0),
    liked_by: Array.isArray(json?.likedBy ?? json?.liked_by) ? (json.likedBy ?? json.liked_by) : [],
    parent_comment_id: json?.parentCommentId?.toString() ?? json?.parent_comment_id?.toString() ?? null,
    reply_count: Number(json?.replyCount ?? json?.reply_count ?? 0),
    replies: Array.isArray(json?.replies) ? json.replies.map((r: any) => parseCommentFromJson(r)) : [],
    created_at: json?.createdAt?.toString() ?? json?.created_at?.toString() ?? new Date().toISOString(),
    updated_at: json?.updatedAt?.toString() ?? json?.updated_at?.toString() ?? '',
    last_modified: json?.lastModified?.toString() ?? json?.last_modified?.toString() ?? '',
    timestamp: Number(json?.timestamp ?? 0),
  };
}
function isReply(comment: CommentData): boolean {
  return !!comment.parent_comment_id && comment.parent_comment_id.length > 0;
}
interface CacheEntry { comments: CommentData[]; lastLoad: number }
const commentCache = new Map<string, CacheEntry>();
function getCached(postId: string): CacheEntry | null { return commentCache.get(postId) ?? null; }
function setCache(postId: string, comments: CommentData[]): void { commentCache.set(postId, { comments, lastLoad: Date.now() }); }
function patchCache(postId: string, updater: (previous: CommentData[]) => CommentData[]): void {
  const existing = commentCache.get(postId);
  commentCache.set(postId, { comments: updater(existing?.comments ?? []), lastLoad: Date.now() });
}
async function trySendPushNotification(args: {
  userId: string; notificationType: string; title: string; body: string; data: Record<string, any>;
}): Promise<void> {
  try { await NotificationService.sendNotification(args); } catch { /* Notifications must not block comments. */ }
}
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Just now';
  try {
    const date = new Date(iso);
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo`;
    return `${date.getMonth() + 1}/${date.getFullYear()}`;
  } catch { return iso; }
}
function initialsOf(name: string): string { return name.length > 0 ? name[0].toUpperCase() : 'U'; }
function hexWithAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface PostCommentsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
  postUserId?: string;
  postUserName?: string;
  postCaption?: string;
}

export default function PostCommentsModal({
  visible, onClose, postId, postUserId, postCaption,
}: PostCommentsModalProps) {
  const colors = useFanColors();
  const { userId, username, authToken } = useAuth();
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommentData | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [href]',
      ));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault(); items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault(); items[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(focusTimer); document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [visible, onClose]);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError('');
    const cached = getCached(postId);
    if (cached && cached.comments.length > 0) {
      setComments(cached.comments);
      if (Date.now() - cached.lastLoad < CACHE_FRESH_MS) { setLoading(false); return; }
    }
    try {
      const response = await fetch(`${API_BASE}/posts/${postId}/comments`, { headers });
      if (response.status === 200) {
        const body = await response.json();
        const raw = body?.comments;
        const list: CommentData[] = Array.isArray(raw) ? raw.map((comment: any) => parseCommentFromJson(comment)) : [];
        setCache(postId, list);
        setComments(list);
      } else if ((cached?.comments.length ?? 0) === 0) {
        setError('Failed to load comments');
      }
    } catch (e: any) {
      if ((cached?.comments.length ?? 0) === 0) setError(e?.message ?? 'Failed to load comments');
    } finally { setLoading(false); }
  }, [postId, authToken]); // Headers intentionally follow the current auth token.

  useEffect(() => { if (visible) void loadComments(); }, [visible, loadComments]);

  async function sendPushNotification(newComment: CommentData, parentCommentId: string | null) {
    try {
      const commentText = newComment.comment ?? '';
      if (parentCommentId) {
        const parent = comments.find((comment) => comment.id === parentCommentId);
        const parentUserId = parent?.user_id;
        if (parentUserId && parentUserId !== userId && parentUserId !== postUserId) {
          await trySendPushNotification({
            userId: parentUserId,
            notificationType: 'comment_reply',
            title: `${username ?? 'Someone'} replied to your comment`,
            body: commentText.length > 100 ? `${commentText.slice(0, 100)}…` : commentText,
            data: {
              post_id: postId, comment_id: newComment.id, parent_comment_id: parentCommentId,
              comment_preview: commentText.length > 50 ? `${commentText.slice(0, 50)}…` : commentText,
              commenter_id: userId ?? '', commenter_name: username ?? '',
              parent_commenter_name: parent?.user_name ?? 'User', type: 'comment_reply',
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
      if (postUserId && postUserId !== userId) {
        await trySendPushNotification({
          userId: postUserId, notificationType: 'post_comment',
          title: `${username ?? 'Someone'} commented on your post`,
          body: commentText.length > 100 ? `${commentText.slice(0, 100)}…` : commentText,
          data: {
            post_id: postId, post_caption: postCaption ?? '', comment_id: newComment.id,
            comment_preview: commentText.length > 50 ? `${commentText.slice(0, 50)}…` : commentText,
            commenter_id: userId ?? '', commenter_name: username ?? '', post_owner_id: postUserId,
            is_reply: !!parentCommentId, type: 'post_comment', timestamp: new Date().toISOString(),
          },
        });
      }
    } catch { /* Notification failures do not affect the comment flow. */ }
  }

  async function handleSubmit() {
    const content = draft.trim();
    if (!content) {
      setError('Comment cannot be empty');
      window.setTimeout(() => setError(''), 2000);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const parentCommentId = replyingTo?.id ?? null;
      const body: Record<string, any> = { user_id: userId ?? '', user_name: username ?? '', comment: content };
      if (parentCommentId) body.parent_comment_id = parentCommentId;
      const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      if (response.status !== 200 && response.status !== 201) {
        let message = 'Failed to create comment';
        try { const errorBody = await response.json(); message = errorBody?.message ?? errorBody?.error ?? message; } catch { /* Non-JSON response. */ }
        throw new Error(message);
      }
      const data = await response.json();
      const raw = data?.success === true && data?.data ? data.data : data?.comment ?? data;
      const newComment = parseCommentFromJson(raw);
      await sendPushNotification(newComment, parentCommentId);
      setComments((previous) => {
        let next: CommentData[];
        if (parentCommentId) {
          const index = previous.findIndex((comment) => comment.id === parentCommentId);
          if (index !== -1) {
            next = previous.slice();
            const parent = next[index];
            next[index] = { ...parent, replies: [newComment, ...(parent.replies ?? [])], reply_count: (parent.reply_count ?? 0) + 1 };
          } else next = [newComment, ...previous];
        } else next = [newComment, ...previous];
        setCache(postId, next);
        return next;
      });
      setDraft('');
      setReplyingTo(null);
      toast.showSuccess(parentCommentId ? 'Reply posted!' : 'Comment posted!');
      window.setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 100);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create comment');
      window.setTimeout(() => setError(''), 3000);
    } finally { setSubmitting(false); }
  }

  if (!visible) return null;
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-black/50 sm:items-center"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Comments"
        className="flex w-full flex-col overflow-hidden border sm:max-w-2xl"
        style={{ maxHeight: '88vh', height: '88vh', borderTopLeftRadius: FAN_RADIUS.xl, borderTopRightRadius: FAN_RADIUS.xl, background: colors.surface, borderColor: colors.border, color: colors.textPrimary }}>
        <div className="flex justify-center py-3"><div className="h-1 w-9 rounded-full" style={{ background: colors.border }} /></div>
        <header className="flex items-center gap-3 border-b px-5 pb-3" style={{ borderColor: colors.border }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: colors.primaryDim }}>
            <MessageCircle size={18} color={colors.primary} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">Comments</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: colors.textTertiary }}>
              {comments.length} {comments.length === 1 ? 'response' : 'responses'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close comments" className="flex h-8 w-8 items-center justify-center rounded-full border"
            style={{ background: colors.surfaceSunken, borderColor: colors.border }}><X size={15} color={colors.textSecondary} /></button>
        </header>
        <div ref={listRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4" style={{ gap: FAN_SPACING.md }}>
          {loading && comments.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-3 py-12" role="status">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-r-transparent" style={{ color: colors.primary }} />
            <span className="text-xs" style={{ color: colors.textTertiary }}>Loading comments…</span>
          </div> : comments.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-2 py-12">
            <MessageCircle size={30} color={colors.textTertiary} />
            <strong className="text-xs">Be the first to comment!</strong>
          </div> : comments.map((comment) => <CommentBubble key={comment.id || `${comment.user_id}-${comment.timestamp}`}
            colors={colors} comment={comment} currentUserId={userId ?? ''}
            parentUsername={isReply(comment) ? comments.find((item) => item.id === comment.parent_comment_id)?.user_name ?? null : null}
            onReply={() => { setReplyingTo(comment); inputRef.current?.focus(); }} />)}
        </div>
        {error && <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: hexWithAlpha(colors.away, 0.1), color: colors.away }}>
          <AlertCircle size={14} /> <span>{error}</span>
        </div>}
        <footer className="border-t px-4 pb-4 pt-3" style={{ borderColor: colors.border, background: colors.surface }}>
          {replyingTo && <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: colors.primaryDim }}>
            <Reply size={14} color={colors.primary} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold" style={{ color: colors.primary }}>Replying to @{replyingTo.user_name}</div>
              <div className="truncate text-[10px] italic" style={{ color: colors.textTertiary }}>{replyingTo.comment.length > 40 ? `${replyingTo.comment.slice(0, 40)}…` : replyingTo.comment}</div>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="rounded-full p-1" style={{ color: colors.textTertiary, background: colors.surface }}><X size={12} /></button>
          </div>}
          <div className="flex items-end gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: colors.primary }}>{initialsOf(username ?? 'U')}</div>
            <div className="flex min-h-[42px] flex-1 items-end rounded-3xl pl-4" style={{ background: colors.surfaceSunken }}>
              <textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSubmit(); } }}
                placeholder={replyingTo ? `Reply to @${replyingTo.user_name}…` : 'Write a comment…'} rows={1}
                disabled={submitting} className="max-h-28 min-h-[42px] flex-1 resize-y bg-transparent py-3 text-[13px] outline-none"
                style={{ color: colors.textPrimary }} />
              {submitting ? <span className="px-3 py-3 text-xs" style={{ color: colors.primary }}>Sending…</span> :
                <button type="button" onClick={() => void handleSubmit()} disabled={!draft.trim()} aria-label="Send comment"
                  className="flex h-9 w-9 shrink-0 items-center justify-center disabled:opacity-40"><Send size={18} color={draft.trim() ? colors.primary : colors.border} /></button>}
            </div>
          </div>
        </footer>
      </section>
    </div>, document.body,
  );
}

function CommentBubble({ colors, comment, currentUserId, parentUsername, onReply }: {
  colors: FanColors; comment: CommentData; currentUserId: string; parentUsername: string | null; onReply: () => void;
}) {
  const isMe = comment.user_id === currentUserId;
  const reply = isReply(comment);
  return <article className={`mb-4 ${reply ? 'pl-10' : ''}`}>
    {reply && parentUsername && <div className="mb-2 ml-11 flex items-center gap-1 text-[9px] italic" style={{ color: colors.textTertiary }}>
      <Reply size={10} /> Reply to @{parentUsername}
    </div>}
    <div className={`flex items-end gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && <button type="button" onClick={onReply} onContextMenu={(event) => { event.preventDefault(); onReply(); }}
        aria-label={`Reply to ${comment.user_name}`} className="home-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
        style={{ background: colors.primaryDim, borderColor: colors.primaryMuted, color: colors.primary }}>{initialsOf(comment.user_name)}</button>}
      <div className={`flex max-w-[78%] shrink flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && <span className="mb-1 mx-1 max-w-full truncate text-[10px] font-semibold">{comment.user_name}</span>}
        <button type="button" onClick={onReply} onContextMenu={(event) => { event.preventDefault(); onReply(); }}
          className="border px-3.5 py-2.5 text-left text-[13px] leading-[18px]"
          style={{ background: isMe ? colors.primaryDim : colors.surfaceSunken, borderColor: isMe ? colors.primaryMuted : colors.border,
            borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', color: colors.textPrimary }}>
          {comment.comment}
        </button>
        <div className="mx-1 mt-1 flex items-center gap-3 text-[8px] font-bold tracking-wider" style={{ color: colors.textTertiary }}>
          <span>{formatDateTime(comment.created_at)}</span>
          <button type="button" onClick={onReply} className="text-[9px] font-semibold" style={{ color: colors.primary }}>Reply</button>
        </div>
      </div>
      {isMe && <button type="button" onClick={onReply} onContextMenu={(event) => { event.preventDefault(); onReply(); }}
        aria-label="Reply to your comment" className="home-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{ background: colors.primary, color: colors.textInverse }}>{initialsOf(comment.user_name)}</button>}
    </div>
  </article>;
}
