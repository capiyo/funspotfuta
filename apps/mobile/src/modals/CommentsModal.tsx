// apps/mobile/src/modals/PostCommentsModal.tsx
//
// RN port of funspot's PostComments widget.
//
// Deviations from the Flutter source, all deliberate:
//   1. No AppCache. The Flutter version caches comments to a RAM+disk store
//      with a 30-second freshness window and falls back to cache on network
//      failure. This port reproduces that with a module-level Map<postId,
//      {comments, lastLoad}> — same semantics, no new dependency.
//   2. No NotificationService.sendNotification. The Flutter version fires
//      two pushes (reply → parent author, comment → post owner). The send
//      function isn't exported by @funspot/core yet, so the calls are
//      wrapped in a `trySendPushNotification` helper that no-ops if the
//      function isn't importable. When a `sendNotification` lands in
//      @funspot/core, replace the stub body and the two call sites work
//      unchanged.
//   3. No Comment model round-trip. The Flutter version maps the parsed map
//      → Comment.fromJson → toJson → back to a map, which is a no-op. This
//      port keeps the parsed map directly.
//   4. Keyboard handling uses KeyboardAvoidingView instead of
//      AnimatedPadding with MediaQuery.viewInsets.bottom — RN-idiomatic
//      equivalent, same visual result.
//   5. API base URL hardcoded to match the Flutter source. If @funspot/core
//      exports API_BASE, swap the constant below.


import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationService } from '@/lib/api/notification-service';
import {
    View,
    Text,
    TextInput,
    Pressable,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import {
    X,
    MessageCircle,
    Reply,
    Send,
    AlertCircle,
} from 'lucide-react-native';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { useToast } from '@/lib/toast/toast-context';

type FanColors = ReturnType<typeof useFanColors>;

const API_BASE = 'https://clash-api-m5mr.onrender.com/api';
const CACHE_FRESH_MS = 30_000;

// ═══════════════════════════════════════════════════════════════
//  COMMENT SHAPE  (matches _parseCommentFromJson)
// ═══════════════════════════════════════════════════════════════

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
        user_name:
            json?.userName?.toString() ??
            json?.user_name?.toString() ??
            'Anonymous',
        comment: json?.comment?.toString() ?? '',
        likes_count: Number(json?.likesCount ?? json?.likes_count ?? 0),
        liked_by: Array.isArray(json?.likedBy ?? json?.liked_by)
            ? (json.likedBy ?? json.liked_by)
            : [],
        parent_comment_id:
            json?.parentCommentId?.toString() ??
            json?.parent_comment_id?.toString() ??
            null,
        reply_count: Number(json?.replyCount ?? json?.reply_count ?? 0),
        replies: Array.isArray(json?.replies)
            ? json.replies.map((r: any) => parseCommentFromJson(r))
            : [],
        created_at:
            json?.createdAt?.toString() ??
            json?.created_at?.toString() ??
            new Date().toISOString(),
        updated_at: json?.updatedAt?.toString() ?? json?.updated_at?.toString() ?? '',
        last_modified:
            json?.lastModified?.toString() ??
            json?.last_modified?.toString() ??
            '',
        timestamp: Number(json?.timestamp ?? 0),
    };
}

function isReply(c: CommentData): boolean {
    return !!c.parent_comment_id && c.parent_comment_id.length > 0;
}

// ═══════════════════════════════════════════════════════════════
//  MODULE-LEVEL CACHE  (mirrors AppCache.getCachedComments et al)
// ═══════════════════════════════════════════════════════════════

interface CacheEntry {
    comments: CommentData[];
    lastLoad: number;
}

const commentCache = new Map<string, CacheEntry>();

function getCached(postId: string): CacheEntry | null {
    return commentCache.get(postId) ?? null;
}

function setCache(postId: string, comments: CommentData[]): void {
    commentCache.set(postId, { comments, lastLoad: Date.now() });
}

function patchCache(postId: string, updater: (prev: CommentData[]) => CommentData[]) {
    const existing = commentCache.get(postId);
    const next = updater(existing?.comments ?? []);
    commentCache.set(postId, { comments: next, lastLoad: Date.now() });
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION STUB
// ═══════════════════════════════════════════════════════════════

/**
 * The Flutter source calls NotificationService.sendNotification twice —
 * once for a reply (parent comment author) and once for a comment on
 * someone else's post (post owner). That function isn't exported by
 * @funspot/core yet. This stub keeps the call shape so the two call sites
 * below compile unchanged; replace the body when sendNotification lands.
 */
/**
 * Mirrors the Flutter _sendPushNotification. Both call sites below
 * (reply → parent author, comment → post owner) already build the
 * correct payload; this just forwards to NotificationService, which
 * POSTs to /api/notifications/send with the same body shape the Dart
 * version uses.
 *
 * Matches the Dart contract: never throws. Failures are logged and
 * swallowed, so a notification outage never blocks the comment posting.
 */
async function trySendPushNotification(args: {
    userId: string;
    notificationType: string;
    title: string;
    body: string;
    data: Record<string, any>;
}): Promise<void> {
    try {
        await NotificationService.sendNotification(args);
    } catch {
        // swallow, matching Flutter's try/catch around sendNotification
    }
}

// ═══════════════════════════════════════════════════════════════
//  PROPS
// ═══════════════════════════════════════════════════════════════

export interface PostCommentsModalProps {
    visible: boolean;
    onClose: () => void;
    postId: string;
    postUserId?: string;
    postUserName?: string;
    postCaption?: string;
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return 'Just now';
    try {
        const date = new Date(iso);
        const now = Date.now();
        const diffMs = now - date.getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d`;
        if (days < 30) return `${days} days ago`;
        if (days < 365) return `${Math.floor(days / 30)}mo`;
        return `${date.getMonth() + 1}/${date.getFullYear()}`;
    } catch {
        return iso;
    }
}

function initialsOf(name: string): string {
    return name.length > 0 ? name[0].toUpperCase() : 'U';
}

function hexWithAlpha(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    if (c.length !== 6) return hex;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PostCommentsModal({
    visible,
    onClose,
    postId,
    postUserId,
    postUserName,
    postCaption,
}: PostCommentsModalProps) {
    const colors = useFanColors();
    const styles = createStyles(colors);
    const { userId, username, authToken } = useAuth();
    const toast = useToast();

    const [comments, setComments] = useState<CommentData[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<CommentData | null>(null);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState('');

    const listRef = useRef<FlatList<CommentData>>(null);
    const inputRef = useRef<TextInput>(null);

    const headers = {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };

    // ── Load comments ─────────────────────────────────────────────
    const loadComments = useCallback(async () => {
        if (!postId) return;

        setLoading(true);
        setError('');

        // Cache-first: show cached immediately if present
        const cached = getCached(postId);
        if (cached && cached.comments.length > 0) {
            setComments(cached.comments);
            // Fresh enough — skip the network call entirely, matching Flutter
            if (Date.now() - cached.lastLoad < CACHE_FRESH_MS) {
                setLoading(false);
                return;
            }
        }

        try {
            const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
                headers,
            });

            if (res.status === 200) {
                const body = await res.json();
                const raw = body?.comments;
                const list: CommentData[] = Array.isArray(raw)
                    ? raw.map((c: any) => parseCommentFromJson(c))
                    : [];
                setCache(postId, list);
                setComments(list);
            } else {
                // Match Flutter: keep cached on failure, only surface error if empty
                if (comments.length === 0) {
                    setError('Failed to load comments');
                }
            }
        } catch (e: any) {
            if (comments.length === 0) {
                setError(e?.message ?? 'Failed to load comments');
            }
        } finally {
            setLoading(false);
        }
    }, [postId, authToken]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!visible) return;
        void loadComments();
    }, [visible, loadComments]);

    // ── Push notifications (mirrors _sendPushNotification) ────────
    async function sendPushNotification(
        newComment: CommentData,
        parentCommentId: string | null,
    ) {
        try {
            const commentText = newComment.comment ?? '';

            if (parentCommentId) {
                const parent = comments.find((c) => c.id === parentCommentId);
                const parentUserId = parent?.user_id;
                if (
                    parentUserId &&
                    parentUserId !== userId &&
                    parentUserId !== postUserId
                ) {
                    await trySendPushNotification({
                        userId: parentUserId,
                        notificationType: 'comment_reply',
                        title: `${username ?? 'Someone'} replied to your comment`,
                        body:
                            commentText.length > 100
                                ? `${commentText.slice(0, 100)}…`
                                : commentText,
                        data: {
                            post_id: postId,
                            comment_id: newComment.id,
                            parent_comment_id: parentCommentId,
                            comment_preview:
                                commentText.length > 50
                                    ? `${commentText.slice(0, 50)}…`
                                    : commentText,
                            commenter_id: userId ?? '',
                            commenter_name: username ?? '',
                            parent_commenter_name: parent?.user_name ?? 'User',
                            type: 'comment_reply',
                            timestamp: new Date().toISOString(),
                        },
                    });
                }
            }

            if (postUserId && postUserId !== userId) {
                await trySendPushNotification({
                    userId: postUserId,
                    notificationType: 'post_comment',
                    title: `${username ?? 'Someone'} commented on your post`,
                    body:
                        commentText.length > 100
                            ? `${commentText.slice(0, 100)}…`
                            : commentText,
                    data: {
                        post_id: postId,
                        post_caption: postCaption ?? '',
                        comment_id: newComment.id,
                        comment_preview:
                            commentText.length > 50
                                ? `${commentText.slice(0, 50)}…`
                                : commentText,
                        commenter_id: userId ?? '',
                        commenter_name: username ?? '',
                        post_owner_id: postUserId,
                        is_reply: !!parentCommentId,
                        type: 'post_comment',
                        timestamp: new Date().toISOString(),
                    },
                });
            }
        } catch {
            // swallow, matching Flutter
        }
    }

    // ── Create comment ────────────────────────────────────────────
    async function handleSubmit() {
        const content = draft.trim();
        if (!content) {
            setError('Comment cannot be empty');
            setTimeout(() => setError(''), 2000);
            return;
        }
        if (submitting) return;

        setSubmitting(true);
        setError('');

        try {
            const parentCommentId = replyingTo?.id ?? null;
            const body: Record<string, any> = {
                user_id: userId ?? '',
                user_name: username ?? '',
                comment: content,
            };
            if (parentCommentId) body.parent_comment_id = parentCommentId;

            const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (res.status !== 200 && res.status !== 201) {
                let msg = 'Failed to create comment';
                try {
                    const errBody = await res.json();
                    msg = errBody?.message ?? errBody?.error ?? msg;
                } catch {
                    /* not JSON */
                }
                throw new Error(msg);
            }

            const data = await res.json();
            const raw =
                data?.success === true && data?.data
                    ? data.data
                    : data?.comment ?? data;
            const newComment = parseCommentFromJson(raw);

            await sendPushNotification(newComment, parentCommentId);

            setComments((prev) => {
                let next: CommentData[];
                if (parentCommentId) {
                    const idx = prev.findIndex((c) => c.id === parentCommentId);
                    if (idx !== -1) {
                        next = prev.slice();
                        const parent = next[idx];
                        next[idx] = {
                            ...parent,
                            replies: [newComment, ...(parent.replies ?? [])],
                            reply_count: (parent.reply_count ?? 0) + 1,
                        };
                    } else {
                        next = [newComment, ...prev];
                    }
                } else {
                    next = [newComment, ...prev];
                }
                setCache(postId, next);
                return next;
            });

            setDraft('');
            setReplyingTo(null);
            toast.showSuccess(parentCommentId ? 'Reply posted!' : 'Comment posted!');
            setTimeout(() => {
                listRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to create comment');
            setTimeout(() => setError(''), 3000);
        } finally {
            setSubmitting(false);
        }
    }

    // ═══════════════════════════════════════════════════════════════

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.kavWrap}
                >
                    <View style={styles.sheet}>
                        <View style={styles.handleWrap}>
                            <View style={styles.handle} />
                        </View>

                        {/* Header */}
                        <View style={styles.headerRow}>
                            <View style={styles.headerIcon}>
                                <MessageCircle size={18} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1, marginLeft: FAN_SPACING.sm }}>
                                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                                    Comments
                                </Text>
                                <Text
                                    style={[styles.headerSub, { color: colors.textSecondary }]}
                                >
                                    {comments.length}{' '}
                                    {comments.length === 1 ? 'response' : 'responses'}
                                </Text>
                            </View>
                            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                                <X size={18} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        {/* Body */}
                        {loading && comments.length === 0 ? (
                            <View style={styles.center}>
                                <ActivityIndicator color={colors.primary} />
                                <Text
                                    style={[styles.centerText, { color: colors.textTertiary }]}
                                >
                                    Loading comments…
                                </Text>
                            </View>
                        ) : comments.length === 0 ? (
                            <View style={styles.center}>
                                <MessageCircle size={36} color={colors.border} />
                                <Text
                                    style={[styles.centerTitle, { color: colors.textSecondary }]}
                                >
                                    No comments yet
                                </Text>
                                <Text
                                    style={[styles.centerText, { color: colors.textTertiary }]}
                                >
                                    Be the first to comment!
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                ref={listRef}
                                data={comments}
                                keyExtractor={(c) => c.id || `${c.user_id}-${c.timestamp}`}
                                contentContainerStyle={styles.listContent}
                                renderItem={({ item }) => (
                                    <CommentBubble
                                        colors={colors}
                                        styles={styles}
                                        comment={item}
                                        currentUserId={userId ?? ''}
                                        parentUsername={
                                            isReply(item)
                                                ? comments.find(
                                                    (c) => c.id === item.parent_comment_id,
                                                )?.user_name ?? null
                                                : null
                                        }
                                        onReply={() => {
                                            setReplyingTo(item);
                                            inputRef.current?.focus();
                                        }}
                                    />
                                )}
                            />
                        )}

                        {/* Error line */}
                        {error.length > 0 && (
                            <View
                                style={[
                                    styles.errorLine,
                                    { backgroundColor: hexWithAlpha(colors.away, 0.1) },
                                ]}
                            >
                                <AlertCircle size={14} color={colors.away} />
                                <Text style={[styles.errorText, { color: colors.away }]}>
                                    {error}
                                </Text>
                            </View>
                        )}

                        {/* Input bar */}
                        <View
                            style={[
                                styles.inputBar,
                                { borderTopColor: colors.border },
                            ]}
                        >
                            {replyingTo && (
                                <View
                                    style={[
                                        styles.replyIndicator,
                                        { backgroundColor: colors.primaryDim },
                                    ]}
                                >
                                    <Reply size={14} color={colors.primary} />
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={[
                                                styles.replyIndicatorTitle,
                                                { color: colors.primary },
                                            ]}
                                        >
                                            Replying to @{replyingTo.user_name}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.replyIndicatorText,
                                                { color: colors.textTertiary },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {replyingTo.comment.length > 40
                                                ? `${replyingTo.comment.slice(0, 40)}…`
                                                : replyingTo.comment}
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={() => setReplyingTo(null)}
                                        hitSlop={6}
                                        style={[
                                            styles.replyClose,
                                            { backgroundColor: colors.surface },
                                        ]}
                                    >
                                        <X size={12} color={colors.textTertiary} />
                                    </Pressable>
                                </View>
                            )}

                            <View style={styles.inputRow}>
                                <View
                                    style={[
                                        styles.inputAvatar,
                                        { backgroundColor: colors.primary },
                                    ]}
                                >
                                    <Text style={styles.inputAvatarText}>
                                        {initialsOf(username ?? 'U')}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.inputWrap,
                                        { backgroundColor: colors.surfaceSunken },
                                    ]}
                                >
                                    <TextInput
                                        ref={inputRef}
                                        value={draft}
                                        onChangeText={setDraft}
                                        placeholder={
                                            replyingTo
                                                ? `Reply to @${replyingTo.user_name}…`
                                                : 'Write a comment…'
                                        }
                                        placeholderTextColor={colors.textTertiary}
                                        multiline
                                        editable={!submitting}
                                        style={[styles.input, { color: colors.textPrimary }]}
                                    />
                                    {submitting ? (
                                        <View style={styles.sendBtn}>
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        </View>
                                    ) : (
                                        <Pressable
                                            onPress={handleSubmit}
                                            disabled={!draft.trim()}
                                            style={styles.sendBtn}
                                            hitSlop={6}
                                        >
                                            <Send
                                                size={18}
                                                color={
                                                    draft.trim() ? colors.primary : colors.border
                                                }
                                            />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════
//  COMMENT BUBBLE
// ═══════════════════════════════════════════════════════════════

function CommentBubble({
    colors,
    styles,
    comment,
    currentUserId,
    parentUsername,
    onReply,
}: {
    colors: FanColors;
    styles: ReturnType<typeof createStyles>;
    comment: CommentData;
    currentUserId: string;
    parentUsername: string | null;
    onReply: () => void;
}) {
    const isMe = comment.user_id === currentUserId;
    const reply = isReply(comment);

    return (
        <View
            style={[
                styles.bubbleWrap,
                reply && { paddingLeft: 40 },
            ]}
        >
            {reply && parentUsername && (
                <View style={styles.replyLabelRow}>
                    <Reply size={10} color={colors.textTertiary} />
                    <Text
                        style={[styles.replyLabel, { color: colors.textTertiary }]}
                        numberOfLines={1}
                    >
                        Reply to @{parentUsername}
                    </Text>
                </View>
            )}

            <View
                style={[
                    styles.bubbleRow,
                    isMe && { justifyContent: 'flex-end' },
                ]}
            >
                {!isMe && (
                    <Pressable onLongPress={onReply} style={styles.avatarWrap}>
                        <View
                            style={[
                                styles.bubbleAvatar,
                                {
                                    backgroundColor: colors.primaryDim,
                                    borderColor: colors.primaryMuted,
                                },
                            ]}
                        >
                            <Text style={[styles.bubbleAvatarText, { color: colors.primary }]}>
                                {initialsOf(comment.user_name)}
                            </Text>
                        </View>
                    </Pressable>
                )}

                <Pressable
                    onLongPress={onReply}
                    style={[
                        styles.bubbleContent,
                        { alignItems: isMe ? 'flex-end' : 'flex-start' },
                    ]}
                >
                    {!isMe && (
                        <Text
                            style={[styles.bubbleName, { color: colors.textPrimary }]}
                            numberOfLines={1}
                        >
                            {comment.user_name}
                        </Text>
                    )}
                    <View
                        style={[
                            styles.bubble,
                            isMe
                                ? {
                                    backgroundColor: colors.primaryDim,
                                    borderColor: colors.primaryMuted,
                                }
                                : {
                                    backgroundColor: colors.surfaceSunken,
                                    borderColor: colors.border,
                                },
                            isMe
                                ? styles.bubbleMe
                                : styles.bubbleThem,
                        ]}
                    >
                        <Text style={[styles.bubbleText, { color: colors.textPrimary }]}>
                            {comment.comment}
                        </Text>
                    </View>
                    <View style={styles.bubbleMeta}>
                        <Text style={[styles.bubbleTime, { color: colors.textTertiary }]}>
                            {formatDateTime(comment.created_at)}
                        </Text>
                        <Pressable onPress={onReply} hitSlop={6}>
                            <Text style={[styles.bubbleReplyLink, { color: colors.primary }]}>
                                Reply
                            </Text>
                        </Pressable>
                    </View>
                </Pressable>

                {isMe && (
                    <Pressable onLongPress={onReply} style={styles.avatarWrap}>
                        <View
                            style={[
                                styles.bubbleAvatar,
                                {
                                    backgroundColor: colors.primary,
                                    borderColor: colors.primary,
                                },
                            ]}
                        >
                            <Text
                                style={[styles.bubbleAvatarText, { color: colors.textInverse }]}
                            >
                                {initialsOf(comment.user_name)}
                            </Text>
                        </View>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

function createStyles(colors: FanColors) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        kavWrap: {
            width: '100%',
            maxHeight: '88%',
        },
        sheet: {
            height: '88%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },

        handleWrap: {
            alignItems: 'center',
            paddingVertical: FAN_SPACING.md,
        },
        handle: {
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
        },

        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: FAN_SPACING.lg,
            paddingBottom: FAN_SPACING.md,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
        },
        headerIcon: {
            width: 36,
            height: 36,
            borderRadius: FAN_RADIUS.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primaryDim,
        },
        headerTitle: { fontSize: 15, fontWeight: '600' },
        headerSub: { fontSize: 11, marginTop: 1 },
        closeBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceSunken,
            borderWidth: 1,
            borderColor: colors.border,
        },

        center: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: FAN_SPACING.md,
            padding: FAN_SPACING.lg,
        },
        centerTitle: { fontSize: 12, fontWeight: '600' },
        centerText: { fontSize: 10, textAlign: 'center' },

        listContent: {
            paddingHorizontal: FAN_SPACING.lg,
            paddingVertical: FAN_SPACING.md,
        },

        // Bubble
        bubbleWrap: { marginBottom: FAN_SPACING.lg },
        replyLabelRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginLeft: 44,
            marginBottom: FAN_SPACING.sm,
        },
        replyLabel: { fontSize: 9, fontStyle: 'italic' },
        bubbleRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: FAN_SPACING.md,
        },
        avatarWrap: {},
        bubbleAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
        },
        bubbleAvatarText: { fontSize: 14, fontWeight: '600' },
        bubbleContent: { flexShrink: 1, maxWidth: '78%' },
        bubbleName: {
            fontSize: 10,
            fontWeight: '600',
            marginBottom: 3,
            marginHorizontal: 4,
        },
        bubble: {
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
        },
        bubbleMe: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 4,
        },
        bubbleThem: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 16,
        },
        bubbleText: { fontSize: 13, lineHeight: 18 },
        bubbleMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            marginTop: 3,
            marginHorizontal: 6,
        },
        bubbleTime: { fontSize: 8, fontWeight: '700', letterSpacing: 1.2 },
        bubbleReplyLink: { fontSize: 9, fontWeight: '600' },

        // Error line
        errorLine: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            marginHorizontal: FAN_SPACING.lg,
            marginBottom: FAN_SPACING.md,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: FAN_SPACING.md,
            borderRadius: FAN_RADIUS.md,
        },
        errorText: { fontSize: 11, flex: 1 },

        // Input bar
        inputBar: {
            paddingHorizontal: FAN_SPACING.base,
            paddingTop: FAN_SPACING.md,
            paddingBottom: FAN_SPACING.md,
            borderTopWidth: 0.5,
            backgroundColor: colors.surface,
        },
        replyIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            paddingHorizontal: FAN_SPACING.base,
            paddingVertical: FAN_SPACING.md,
            borderTopLeftRadius: FAN_RADIUS.md,
            borderTopRightRadius: FAN_RADIUS.md,
            marginBottom: -1,
        },
        replyIndicatorTitle: { fontSize: 10, fontWeight: '600' },
        replyIndicatorText: {
            fontSize: 9,
            fontStyle: 'italic',
            marginTop: 1,
        },
        replyClose: {
            width: 20,
            height: 20,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
        },

        inputRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: FAN_SPACING.md,
        },
        inputAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
        },
        inputAvatarText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
        inputWrap: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            borderRadius: FAN_RADIUS.pill,
            paddingLeft: FAN_SPACING.lg,
            minHeight: 42,
            maxHeight: 120,
        },
        input: {
            flex: 1,
            fontSize: 13,
            paddingVertical: FAN_SPACING.md,
        },
        sendBtn: {
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
        },
    });
}