// components/AddPostModal.tsx
//
// RN port of funspot/lib/modals/FAB/add_post_modal.dart.
//
// Same visual design and same field-presence logic as the Flutter
// source (image vs video vs caption, "Post Video" / "Post Image" /
// "Post" labeling, the file-size badge, the type badge).
//
// Deviations from the Flutter source, all deliberate:
//   1. Picker returns { uri, name, type }, not bytes. RN's FormData
//      uploads from the URI natively; loading a video into JS memory
//      as base64 would crash mid-range Android.
//   2. No video thumbnail generation. There's no RN equivalent of
//      `video_thumbnail` without adding react-native-create-thumbnail;
//      the video preview falls back to the same black-tile-with-play-
//      icon the Flutter source uses when its thumbnail is null.
//   3. No follower notifications. In Flutter those fire from the
//      UploadQueueService after upload, not from the modal.

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import {
    View,
    Text,
    TextInput,
    Pressable,
    Image,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    Modal,
} from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import {
    X,
    Camera,
    Image as ImageIcon,
    Video as VideoIcon,
    Play,
    Send,
    RotateCcw,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { createPost } from '@/lib/api/posts-create';

type FanColors = ReturnType<typeof useFanColors>;

const IMAGE_MAX_MB = 10;
const VIDEO_MAX_MB = 50;

interface PickedMedia {
    uri: string;
    name: string;
    type: string;
    sizeMB: number;
}

// ── File-size check from the picker's asset metadata ────────────
// react-native-image-picker populates `fileSize` on both iOS and
// Android. When it's missing we skip the check rather than loading
// the file into memory to measure it — the server enforces its own
// cap regardless.
function toPickedMedia(asset: Asset): PickedMedia | null {
    if (!asset?.uri) return null;
    const sizeMB =
        typeof asset.fileSize === 'number'
            ? asset.fileSize / (1024 * 1024)
            : 0;
    const name =
        asset.fileName ??
        asset.uri.split('/').pop() ??
        `upload_${Date.now()}`;
    const type = asset.type ?? 'application/octet-stream';
    return { uri: asset.uri, name, type, sizeMB };
}

export default function AddPostModal({
    visible,
    onClose,
    onPostCreated,
}: {
    visible: boolean;
    onClose: () => void;
    onPostCreated: () => void;
}) {
    const colors = useFanColors();
    const styles = createStyles(colors);
    const { userId, username } = useAuth();
    const toast = useToast();

    const [image, setImage] = useState<PickedMedia | null>(null);
    const [video, setVideo] = useState<PickedMedia | null>(null);
    const [caption, setCaption] = useState('');
    const [posting, setPosting] = useState(false);

    // Reset on every open, matching the Flutter modal's fresh-state
    // behaviour each time it's presented.
    useEffect(() => {
        if (!visible) return;
        setImage(null);
        setVideo(null);
        setCaption('');
        setPosting(false);
    }, [visible]);

    const hasCaption = caption.trim().length > 0;
    const hasImage = image !== null;
    const hasVideo = video !== null;
    const hasMedia = hasImage || hasVideo;
    const canPost = !posting && (hasCaption || hasMedia);

    // ── Pickers ──────────────────────────────────────────────────
    async function pickImage() {
        try {
            const res = await launchImageLibrary({
                mediaType: 'photo',
                selectionLimit: 1,
            });
            if (res.didCancel || !res.assets?.length) return;
            const picked = toPickedMedia(res.assets[0]);
            if (!picked) {
                toast.showError('Could not read image');
                return;
            }
            if (picked.sizeMB > IMAGE_MAX_MB) {
                toast.showError(`Image too large (max ${IMAGE_MAX_MB}MB)`);
                return;
            }
            setImage(picked);
            setVideo(null);
        } catch (e: any) {
            toast.showError(e?.message ?? 'Error picking image');
        }
    }

    async function pickVideo() {
        try {
            const res = await launchImageLibrary({
                mediaType: 'video',
                selectionLimit: 1,
            });
            if (res.didCancel || !res.assets?.length) return;
            const picked = toPickedMedia(res.assets[0]);
            if (!picked) {
                toast.showError('Could not read video');
                return;
            }
            if (picked.sizeMB > VIDEO_MAX_MB) {
                toast.showError(`Video too large (max ${VIDEO_MAX_MB}MB)`);
                return;
            }
            setVideo(picked);
            setImage(null);
        } catch (e: any) {
            toast.showError(e?.message ?? 'Error picking video');
        }
    }

    function clearMedia() {
        setImage(null);
        setVideo(null);
    }

    function clearAll() {
        setImage(null);
        setVideo(null);
        setCaption('');
    }

    // ── Submit ───────────────────────────────────────────────────
    async function handleSubmit() {
        if (!userId) {
            toast.showError('Please login first');
            return;
        }
        if (!canPost) {
            toast.showError('Please add a caption, image, or video');
            return;
        }

        setPosting(true);
        try {
            await createPost({
                userId,
                userName: username ?? 'User',
                caption: caption.trim() || undefined,
                image: image
                    ? { uri: image.uri, name: image.name, type: image.type }
                    : undefined,
                video: video
                    ? { uri: video.uri, name: video.name, type: video.type }
                    : undefined,
            });
            toast.showSuccess(
                hasVideo
                    ? '🎥 Post created'
                    : hasImage
                        ? '📷 Post created'
                        : '📝 Post created',
            );
            onPostCreated();
            onClose();
        } catch (e: any) {
            toast.showError(e?.message ?? 'Failed to create post');
        } finally {
            setPosting(false);
        }
    }

    // ── Labels ───────────────────────────────────────────────────
    function postButtonLabel(): string {
        if (hasCaption && hasVideo) return 'Post Video';
        if (hasCaption && hasImage) return 'Post Image';
        if (hasVideo) return 'Post Video';
        if (hasImage) return 'Post Image';
        return 'Post';
    }

    function postTypeLabel(): string {
        if (hasCaption && hasVideo) return '📹 Video with caption';
        if (hasCaption && hasImage) return '🖼️ Image with caption';
        if (hasVideo) return '🎬 Video post';
        if (hasImage) return '📸 Image post';
        if (hasCaption) return '📝 Text post';
        return '';
    }

    function fileSizeLabel(): string {
        if (video) return `${video.sizeMB.toFixed(1)} MB`;
        if (image) return `${Math.round(image.sizeMB * 1024)} KB`;
        return '';
    }

    const PostIcon: LucideIcon = hasVideo
        ? VideoIcon
        : hasImage
            ? ImageIcon
            : Send;
    const headerIcon: LucideIcon = hasVideo
        ? VideoIcon
        : hasImage
            ? ImageIcon
            : Camera;

    // ─────────────────────────────────────────────────────────────

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.handleWrap}>
                        <View style={styles.handle} />
                    </View>

                    {/* Header */}
                    <View style={styles.headerRow}>
                        <View style={styles.headerIconInner}>
                            {(() => {
                                const Icon = headerIcon;
                                return <Icon size={20} color={colors.primary} />;
                            })()}
                        </View>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.headerTitle}>
                                {hasVideo ? 'Create Video Post' : 'Create Post'}
                            </Text>
                            <Text style={styles.headerSub} numberOfLines={1}>
                                {username ? `@${username}` : 'Share your moment'}
                            </Text>
                        </View>
                        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                            <X size={18} color={colors.textPrimary} />
                        </Pressable>
                    </View>

                    <ScrollView
                        style={styles.body}
                        contentContainerStyle={styles.bodyContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Caption */}
                        <View
                            style={[
                                styles.captionWrap,
                                hasCaption && { borderColor: colors.primary, borderWidth: 1.5 },
                            ]}
                        >
                            <TextInput
                                value={caption}
                                onChangeText={setCaption}
                                placeholder="What's on your mind? (Optional)"
                                placeholderTextColor={colors.textSecondary}
                                style={styles.captionInput}
                                multiline
                                numberOfLines={4}
                                maxLength={500}
                                editable={!posting}
                            />
                            {hasCaption && (
                                <View style={styles.captionSuffix}>
                                    <Text
                                        style={[styles.captionSuffixText, { color: colors.primary }]}
                                    >
                                        {caption.length}/500
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Media action row */}
                        <View style={styles.mediaRow}>
                            <MediaAction
                                colors={colors}
                                styles={styles}
                                Icon={ImageIcon}
                                label="Photo"
                                active={hasImage}
                                onPress={pickImage}
                                disabled={posting}
                            />
                            <MediaAction
                                colors={colors}
                                styles={styles}
                                Icon={VideoIcon}
                                label="Video"
                                active={hasVideo}
                                onPress={pickVideo}
                                disabled={posting}
                            />
                            {hasMedia && (
                                <MediaAction
                                    colors={colors}
                                    styles={styles}
                                    Icon={X}
                                    label="Clear"
                                    active={false}
                                    danger
                                    onPress={clearMedia}
                                    disabled={posting}
                                />
                            )}
                        </View>

                        {/* Media preview */}
                        {hasVideo && video && (
                            <View style={styles.previewCard}>
                                <View style={styles.previewMedia}>
                                    {/* Fallback tile — no thumbnail generation in this port */}
                                    <View style={styles.videoFallback}>
                                        <Play size={48} color="#FFFFFF" />
                                    </View>

                                    {/* VIDEO badge */}
                                    <View
                                        style={[styles.mediaBadge, { backgroundColor: '#EF4444' }]}
                                    >
                                        <VideoIcon size={12} color="#FFFFFF" />
                                        <Text style={styles.mediaBadgeText}>VIDEO</Text>
                                    </View>

                                    {/* Play overlay */}
                                    <View style={styles.playOverlay}>
                                        <Play size={56} color="#FFFFFF" />
                                    </View>

                                    {/* File size badge */}
                                    <View style={styles.fileSizeBadge}>
                                        <Text style={styles.fileSizeText}>{fileSizeLabel()}</Text>
                                    </View>

                                    {/* Remove */}
                                    <Pressable
                                        onPress={clearMedia}
                                        hitSlop={8}
                                        style={styles.removeBtn}
                                    >
                                        <X size={16} color="#FFFFFF" />
                                    </Pressable>
                                </View>
                            </View>
                        )}

                        {hasImage && image && (
                            <View style={styles.previewCard}>
                                <View style={styles.previewMedia}>
                                    <Image
                                        source={{ uri: image.uri }}
                                        style={styles.previewImage}
                                        resizeMode="cover"
                                    />

                                    {/* IMAGE badge */}
                                    <View
                                        style={[styles.mediaBadge, { backgroundColor: '#3B82F6' }]}
                                    >
                                        <ImageIcon size={12} color="#FFFFFF" />
                                        <Text style={styles.mediaBadgeText}>IMAGE</Text>
                                    </View>

                                    {/* File size badge */}
                                    <View style={styles.fileSizeBadge}>
                                        <Text style={styles.fileSizeText}>{fileSizeLabel()}</Text>
                                    </View>

                                    {/* Remove */}
                                    <Pressable
                                        onPress={clearMedia}
                                        hitSlop={8}
                                        style={styles.removeBtn}
                                    >
                                        <X size={16} color="#FFFFFF" />
                                    </Pressable>
                                </View>
                            </View>
                        )}

                        {/* Post-type badge */}
                        {(hasCaption || hasMedia) && (
                            <View style={styles.typeBadgeWrap}>
                                <View style={styles.typeBadge}>
                                    {(() => {
                                        const TypeIcon: LucideIcon = hasVideo
                                            ? VideoIcon
                                            : hasImage
                                                ? ImageIcon
                                                : Camera;
                                        return (
                                            <TypeIcon size={16} color={colors.primary} />
                                        );
                                    })()}
                                    <Text style={styles.typeBadgeText}>{postTypeLabel()}</Text>
                                </View>
                            </View>
                        )}

                        {/* Actions */}
                        <View style={styles.actionsRow}>
                            <Pressable
                                onPress={clearAll}
                                disabled={posting || (!hasCaption && !hasMedia)}
                                style={[
                                    styles.actionBtn,
                                    styles.clearBtn,
                                    (posting || (!hasCaption && !hasMedia)) && { opacity: 0.5 },
                                ]}
                            >
                                <RotateCcw size={16} color={colors.textSecondary} />
                                <Text
                                    style={[styles.clearBtnText, { color: colors.textSecondary }]}
                                >
                                    Clear
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={handleSubmit}
                                disabled={!canPost}
                                style={[
                                    styles.actionBtn,
                                    styles.postBtn,
                                    !canPost && {
                                        backgroundColor: colors.surface,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                    },
                                ]}
                            >
                                {posting ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={canPost ? '#000000' : colors.textSecondary}
                                    />
                                ) : (
                                    <>
                                        <PostIcon
                                            size={16}
                                            color={canPost ? '#000000' : colors.textSecondary}
                                        />
                                        <Text
                                            style={[
                                                styles.postBtnText,
                                                { color: canPost ? '#000000' : colors.textSecondary },
                                            ]}
                                        >
                                            {postButtonLabel()}
                                        </Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────
// Media action pill (Photo / Video / Clear)
// ─────────────────────────────────────────────────────────────
function MediaAction({
    colors,
    styles,
    Icon,
    label,
    active,
    danger,
    onPress,
    disabled,
}: {
    colors: FanColors;
    styles: ReturnType<typeof createStyles>;
    Icon: LucideIcon;
    label: string;
    active: boolean;
    danger?: boolean;
    onPress: () => void;
    disabled?: boolean;
}) {
    const accent = danger ? colors.away : colors.primary;
    const ringColor = active ? accent : colors.border;
    const bgColor = active ? `${accent}22` : colors.surface;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.mediaAction,
                pressed && !disabled && { opacity: 0.7 },
                disabled && { opacity: 0.5 },
            ]}
        >
            <View
                style={[
                    styles.mediaActionCircle,
                    { backgroundColor: bgColor, borderColor: ringColor },
                    active && { borderWidth: 2 },
                ]}
            >
                <Icon size={22} color={active ? accent : colors.textSecondary} />
            </View>
            <Text
                style={[
                    styles.mediaActionLabel,
                    { color: active ? accent : colors.textSecondary },
                    active && { fontWeight: '700' },
                ]}
            >
                {label}
            </Text>
        </Pressable>
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
        sheet: {
            maxHeight: '85%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        handleWrap: {
            alignItems: 'center',
            paddingTop: FAN_SPACING.sm,
            paddingBottom: FAN_SPACING.xs,
        },
        handle: {
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
        },

        // Header
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: FAN_SPACING.lg,
            paddingVertical: FAN_SPACING.sm,
        },
        headerIcon: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
        },
        headerIconInner: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
        },
        headerTextWrap: { flex: 1, marginLeft: FAN_SPACING.base },
        headerTitle: {
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: '700',
        },
        headerSub: {
            color: colors.textSecondary,
            fontSize: 11,
            marginTop: 2,
        },
        closeBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
        },

        // Body
        body: { flexGrow: 0 },
        bodyContent: {
            paddingHorizontal: FAN_SPACING.lg,
            paddingBottom: FAN_SPACING.xl,
        },

        // Caption
        captionWrap: {
            backgroundColor: colors.surfaceElevated,
            borderRadius: FAN_RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: FAN_SPACING.xs,
            marginBottom: FAN_SPACING.base,
        },
        captionInput: {
            color: colors.textPrimary,
            fontSize: 15,
            lineHeight: 21,
            padding: FAN_SPACING.base,
            minHeight: 100,
            textAlignVertical: 'top',
        },
        captionSuffix: {
            position: 'absolute',
            bottom: 8,
            right: 12,
        },
        captionSuffixText: {
            fontSize: 10,
            fontWeight: '600',
        },

        // Media action row
        mediaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-evenly',
            backgroundColor: colors.surfaceElevated,
            borderRadius: FAN_RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: FAN_SPACING.base,
            marginBottom: FAN_SPACING.base,
        },
        mediaAction: {
            alignItems: 'center',
            minWidth: 72,
        },
        mediaActionCircle: {
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
        },
        mediaActionLabel: {
            fontSize: 10,
            marginTop: 4,
        },

        // Preview
        previewCard: {
            borderRadius: FAN_RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.borderActive,
            overflow: 'hidden',
            marginBottom: FAN_SPACING.base,
        },
        previewMedia: {
            height: 180,
            position: 'relative',
            backgroundColor: '#000000',
        },
        previewImage: {
            width: '100%',
            height: '100%',
        },
        videoFallback: {
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
            alignItems: 'center',
            justifyContent: 'center',
        },
        playOverlay: {
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
        },
        mediaBadge: {
            position: 'absolute',
            top: 12,
            left: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
        },
        mediaBadgeText: {
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1,
        },
        fileSizeBadge: {
            position: 'absolute',
            bottom: 12,
            right: 12,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            backgroundColor: 'rgba(0,0,0,0.75)',
        },
        fileSizeText: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '500',
        },
        removeBtn: {
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
        },

        // Post-type badge
        typeBadgeWrap: {
            alignItems: 'center',
            marginBottom: FAN_SPACING.base,
        },
        typeBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.xs,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: colors.primaryMuted,
            borderWidth: 1,
            borderColor: colors.primary,
        },
        typeBadgeText: {
            color: colors.primary,
            fontSize: 13,
            fontWeight: '700',
        },

        // Actions
        actionsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.base,
            marginTop: FAN_SPACING.sm,
        },
        actionBtn: {
            height: 48,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: FAN_SPACING.xs,
        },
        clearBtn: {
            flex: 1,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
        },
        clearBtnText: {
            fontSize: 14,
            fontWeight: '600',
        },
        postBtn: {
            flex: 2,
            backgroundColor: colors.primary,
        },
        postBtnText: {
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
    });
}