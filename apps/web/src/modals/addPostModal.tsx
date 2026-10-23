import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { createPortal } from 'react-dom';
import {
    Camera,
    Image as ImageIcon,
    Play,
    RotateCcw,
    Send,
    Video as VideoIcon,
    X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { createPost } from '@/lib/api/posts-create';

const IMAGE_MAX_MB = 10;
const VIDEO_MAX_MB = 50;

type MediaKind = 'image' | 'video';

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
    const toast = useToast();
    const { userId, username } = useAuth();

    const dialogRef = useRef<HTMLElement>(null);
    const imageInput = useRef<HTMLInputElement>(null);
    const videoInput = useRef<HTMLInputElement>(null);
    const [image, setImage] = useState<File | null>(null);
    const [video, setVideo] = useState<File | null>(null);
    const [caption, setCaption] = useState('');
    const [posting, setPosting] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    // Reset the form every time the modal opens, as the native modal does.
    useEffect(() => {
        if (!visible) return;

        setImage(null);
        setVideo(null);
        setCaption('');
        setPosting(false);

        if (imageInput.current) imageInput.current.value = '';
        if (videoInput.current) videoInput.current.value = '';
    }, [visible]);

    // Browser object URLs are created only for the selected file and always
    // revoked when that file changes or the component unmounts.
    useEffect(() => {
        if (!image) {
            setImageUrl(null);
            return;
        }

        const url = URL.createObjectURL(image);
        setImageUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [image]);

    useEffect(() => {
        if (!video) {
            setVideoUrl(null);
            return;
        }

        const url = URL.createObjectURL(video);
        setVideoUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [video]);

    // Keep keyboard interaction inside the dialog and return focus on close.
    useEffect(() => {
        if (!visible) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const focusInitialControl = () => {
            dialogRef.current
                ?.querySelector<HTMLTextAreaElement>('textarea')
                ?.focus();
        };

        const frame = window.requestAnimationFrame(focusInitialControl);

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) return;

            const focusable = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), video[controls]',
                ),
            ).filter((element) => element.getAttribute('type') !== 'hidden');

            if (focusable.length === 0) {
                event.preventDefault();
                dialogRef.current.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (
                !event.shiftKey &&
                document.activeElement === last
            ) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused?.focus();
        };
    }, [visible, onClose]);

    const hasCaption = caption.trim().length > 0;
    const hasImage = image !== null;
    const hasVideo = video !== null;
    const hasMedia = hasImage || hasVideo;
    const canPost = !posting && (hasCaption || hasMedia);

    // The native picker reports fileSize when available. The browser's File
    // object always exposes size, so validation is performed before setting
    // the selected media and before createPost sends it to the existing API.
    function acceptFile(file: File, kind: MediaKind) {
        const maximum = kind === 'image' ? IMAGE_MAX_MB : VIDEO_MAX_MB;
        const sizeMB = file.size / (1024 * 1024);

        if (sizeMB > maximum) {
            toast.showError(
                kind === 'image'
                    ? 'Image too large (max ' + IMAGE_MAX_MB + 'MB)'
                    : 'Video too large (max ' + VIDEO_MAX_MB + 'MB)',
            );
            return;
        }

        if (kind === 'image') {
            if (!file.type.startsWith('image/')) {
                toast.showError('Could not read image');
                return;
            }

            setImage(file);
            setVideo(null);
            if (videoInput.current) videoInput.current.value = '';
            return;
        }

        if (!file.type.startsWith('video/')) {
            toast.showError('Could not read video');
            return;
        }

        setVideo(file);
        setImage(null);
        if (imageInput.current) imageInput.current.value = '';
    }

    function pickImage() {
        imageInput.current?.click();
    }

    function pickVideo() {
        videoInput.current?.click();
    }

    function clearMedia() {
        setImage(null);
        setVideo(null);

        if (imageInput.current) imageInput.current.value = '';
        if (videoInput.current) videoInput.current.value = '';
    }

    function clearAll() {
        clearMedia();
        setCaption('');
    }

    // Submit directly through posts-create. Do not use media-service here:
    // createPost owns the multipart field names and server-side validation.
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
                image: image ?? undefined,
                video: video ?? undefined,
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
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to create post';
            toast.showError(message || 'Failed to create post');
        } finally {
            setPosting(false);
        }
    }

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
        if (video) {
            return (video.size / (1024 * 1024)).toFixed(1) + ' MB';
        }

        if (image) {
            return Math.round(image.size / 1024) + ' KB';
        }

        return '';
    }

    const PostIcon = hasVideo
        ? VideoIcon
        : hasImage
            ? ImageIcon
            : Send;

    const HeaderIcon = hasVideo
        ? VideoIcon
        : hasImage
            ? ImageIcon
            : Camera;

    if (!visible) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[970] flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Create Post"
                tabIndex={-1}
                className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl outline-none sm:rounded-3xl"
                style={{
                    background: colors.surface,
                    borderColor: colors.border,
                }}
            >
                <div className="flex justify-center pb-2 pt-3">
                    <div
                        className="h-1 w-10 rounded-full"
                        style={{ background: colors.border }}
                    />
                </div>

                <PostHeader
                    colors={colors}
                    username={username}
                    hasVideo={hasVideo}
                    HeaderIcon={HeaderIcon}
                    onClose={onClose}
                />

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-6">
                    <CaptionEditor
                        caption={caption}
                        hasCaption={hasCaption}
                        posting={posting}
                        colors={colors}
                        onChange={setCaption}
                    />

                    <MediaActions
                        colors={colors}
                        hasImage={hasImage}
                        hasVideo={hasVideo}
                        hasMedia={hasMedia}
                        posting={posting}
                        imageInput={imageInput}
                        videoInput={videoInput}
                        onPickImage={pickImage}
                        onPickVideo={pickVideo}
                        onClearMedia={clearMedia}
                        onAcceptFile={acceptFile}
                    />

                    {hasVideo && video && videoUrl && (
                        <VideoPreview
                            colors={colors}
                            video={video}
                            videoUrl={videoUrl}
                            fileSizeLabel={fileSizeLabel()}
                            onRemove={clearMedia}
                        />
                    )}

                    {hasImage && image && imageUrl && (
                        <ImagePreview
                            colors={colors}
                            image={image}
                            imageUrl={imageUrl}
                            fileSizeLabel={fileSizeLabel()}
                            onRemove={clearMedia}
                        />
                    )}

                    {(hasCaption || hasMedia) && (
                        <PostTypeBadge
                            colors={colors}
                            hasVideo={hasVideo}
                            hasImage={hasImage}
                            label={postTypeLabel()}
                        />
                    )}

                    <PostActions
                        colors={colors}
                        posting={posting}
                        canPost={canPost}
                        hasCaption={hasCaption}
                        hasMedia={hasMedia}
                        PostIcon={PostIcon}
                        postButtonLabel={postButtonLabel()}
                        onClear={clearAll}
                        onSubmit={() => void handleSubmit()}
                    />
                </div>
            </section>
        </div>,
        document.body,
    );
}

type FanColors = ReturnType<typeof useFanColors>;

function PostHeader({
    colors,
    username,
    hasVideo,
    HeaderIcon,
    onClose,
}: {
    colors: FanColors;
    username?: string | null;
    hasVideo: boolean;
    HeaderIcon: typeof Camera;
    onClose: () => void;
}) {
    return (
        <header className="flex items-center gap-3 px-4 pb-3 sm:px-6">
            <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{
                    background: colors.background,
                    color: colors.primary,
                }}
            >
                <HeaderIcon size={20} />
            </div>

            <div className="min-w-0 flex-1">
                <h2
                    className="text-base font-bold"
                    style={{ color: colors.textPrimary }}
                >
                    {hasVideo ? 'Create Video Post' : 'Create Post'}
                </h2>
                <p
                    className="mt-0.5 truncate text-[11px]"
                    style={{ color: colors.textSecondary }}
                >
                    {username ? '@' + username : 'Share your moment'}
                </p>
            </div>

            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border"
                style={{
                    background: colors.surfaceElevated,
                    borderColor: colors.border,
                }}
            >
                <X size={18} color={colors.textPrimary} />
            </button>
        </header>
    );
}

function CaptionEditor({
    caption,
    hasCaption,
    posting,
    colors,
    onChange,
}: {
    caption: string;
    hasCaption: boolean;
    posting: boolean;
    colors: FanColors;
    onChange: (value: string) => void;
}) {
    return (
        <div
            className="relative mb-4 mt-1 rounded-xl border"
            style={{
                background: colors.surfaceElevated,
                borderColor: hasCaption ? colors.primary : colors.border,
                borderWidth: hasCaption ? 1.5 : 1,
            }}
        >
            <textarea
                value={caption}
                onChange={(event) => onChange(event.target.value)}
                placeholder="What's on your mind? (Optional)"
                maxLength={500}
                disabled={posting}
                rows={4}
                aria-label="Caption"
                className="min-h-[100px] w-full resize-none rounded-xl bg-transparent p-3 pb-8 text-[15px] leading-[21px] outline-none disabled:opacity-60"
                style={{ color: colors.textPrimary }}
            />

            {hasCaption && (
                <span
                    className="absolute bottom-2 right-3 text-[10px] font-semibold"
                    style={{ color: colors.primary }}
                >
                    {caption.length}/500
                </span>
            )}
        </div>
    );
}

function MediaActions({
    colors,
    hasImage,
    hasVideo,
    hasMedia,
    posting,
    imageInput,
    videoInput,
    onPickImage,
    onPickVideo,
    onClearMedia,
    onAcceptFile,
}: {
    colors: FanColors;
    hasImage: boolean;
    hasVideo: boolean;
    hasMedia: boolean;
    posting: boolean;
    imageInput: Ref<HTMLInputElement>;
    videoInput: Ref<HTMLInputElement>;
    onPickImage: () => void;
    onPickVideo: () => void;
    onClearMedia: () => void;
    onAcceptFile: (file: File, kind: MediaKind) => void;
}) {
    return (
        <div
            className="mb-4 flex items-center justify-evenly gap-2 rounded-xl border px-2 py-3"
            style={{
                background: colors.surfaceElevated,
                borderColor: colors.border,
            }}
        >
            <MediaAction
                colors={colors}
                Icon={ImageIcon}
                label="Photo"
                active={hasImage}
                disabled={posting}
                onPress={onPickImage}
            />

            <MediaAction
                colors={colors}
                Icon={VideoIcon}
                label="Video"
                active={hasVideo}
                disabled={posting}
                onPress={onPickVideo}
            />

            {hasMedia && (
                <MediaAction
                    colors={colors}
                    Icon={X}
                    label="Clear"
                    active={false}
                    danger
                    disabled={posting}
                    onPress={onClearMedia}
                />
            )}

            <input
                ref={imageInput}
                type="file"
                accept="image/*"
                aria-label="Choose photo"
                className="hidden"
                onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) onAcceptFile(file, 'image');
                    event.currentTarget.value = '';
                }}
            />

            <input
                ref={videoInput}
                type="file"
                accept="video/*"
                aria-label="Choose video"
                className="hidden"
                onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) onAcceptFile(file, 'video');
                    event.currentTarget.value = '';
                }}
            />
        </div>
    );
}

function MediaAction({
    colors,
    Icon,
    label,
    active,
    danger = false,
    disabled = false,
    onPress,
}: {
    colors: FanColors;
    Icon: typeof Camera;
    label: string;
    active: boolean;
    danger?: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    const accent = danger ? colors.away : colors.primary;
    const borderColor = active ? accent : colors.border;
    const background = active ? accent + '22' : colors.surface;

    return (
        <button
            type="button"
            onClick={onPress}
            disabled={disabled}
            className="flex min-w-[64px] flex-1 flex-col items-center gap-1.5 rounded-lg px-2 py-1 disabled:opacity-50"
            aria-pressed={active}
        >
            <span
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full border"
                style={{
                    background,
                    borderColor,
                    borderWidth: active ? 2 : 1,
                }}
            >
                <Icon
                    size={22}
                    color={active ? accent : colors.textSecondary}
                />
            </span>

            <span
                className="text-[10px]"
                style={{
                    color: active ? accent : colors.textSecondary,
                    fontWeight: active ? 700 : 500,
                }}
            >
                {label}
            </span>
        </button>
    );
}

function VideoPreview({
    colors,
    video,
    videoUrl,
    fileSizeLabel,
    onRemove,
}: {
    colors: FanColors;
    video: File;
    videoUrl: string;
    fileSizeLabel: string;
    onRemove: () => void;
}) {
    return (
        <div
            className="relative mb-4 overflow-hidden rounded-xl border"
            style={{ borderColor: colors.borderActive }}
        >
            <div className="relative h-[180px] bg-black">
                <video
                    src={videoUrl}
                    aria-label={'Preview of ' + video.name}
                    className="h-full w-full object-contain"
                    controls
                    muted
                    playsInline
                />

                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-white">
                    <VideoIcon size={12} />
                    VIDEO
                </span>

                <span className="absolute bottom-3 right-3 rounded-md bg-black/75 px-2 py-1 text-[10px] font-medium text-white">
                    {fileSizeLabel}
                </span>

                <button
                    type="button"
                    onClick={onRemove}
                    aria-label="Remove video"
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/70"
                >
                    <X size={16} color="#FFFFFF" />
                </button>
            </div>
        </div>
    );
}

function ImagePreview({
    colors,
    image,
    imageUrl,
    fileSizeLabel,
    onRemove,
}: {
    colors: FanColors;
    image: File;
    imageUrl: string;
    fileSizeLabel: string;
    onRemove: () => void;
}) {
    return (
        <div
            className="relative mb-4 overflow-hidden rounded-xl border"
            style={{ borderColor: colors.borderActive }}
        >
            <div className="relative h-[180px] bg-black">
                <img
                    src={imageUrl}
                    alt={image.name}
                    className="h-full w-full object-cover"
                />

                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-blue-500 px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-white">
                    <ImageIcon size={12} />
                    IMAGE
                </span>

                <span className="absolute bottom-3 right-3 rounded-md bg-black/75 px-2 py-1 text-[10px] font-medium text-white">
                    {fileSizeLabel}
                </span>

                <button
                    type="button"
                    onClick={onRemove}
                    aria-label="Remove image"
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/70"
                >
                    <X size={16} color="#FFFFFF" />
                </button>
            </div>
        </div>
    );
}

function PostTypeBadge({
    colors,
    hasVideo,
    hasImage,
    label,
}: {
    colors: FanColors;
    hasVideo: boolean;
    hasImage: boolean;
    label: string;
}) {
    const TypeIcon = hasVideo
        ? VideoIcon
        : hasImage
            ? ImageIcon
            : Camera;

    return (
        <div className="mb-4 flex justify-center">
            <div
                className="flex items-center gap-2 rounded-full border px-3.5 py-2"
                style={{
                    background: colors.primaryMuted,
                    borderColor: colors.primary,
                }}
            >
                <TypeIcon size={16} color={colors.primary} />
                <span
                    className="text-[13px] font-bold"
                    style={{ color: colors.primary }}
                >
                    {label}
                </span>
            </div>
        </div>
    );
}

function PostActions({
    colors,
    posting,
    canPost,
    hasCaption,
    hasMedia,
    PostIcon,
    postButtonLabel,
    onClear,
    onSubmit,
}: {
    colors: FanColors;
    posting: boolean;
    canPost: boolean;
    hasCaption: boolean;
    hasMedia: boolean;
    PostIcon: typeof Camera;
    postButtonLabel: string;
    onClear: () => void;
    onSubmit: () => void;
}) {
    return (
        <div className="mt-3 flex items-center gap-3">
            <button
                type="button"
                onClick={onClear}
                disabled={posting || (!hasCaption && !hasMedia)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-semibold disabled:opacity-50"
                style={{
                    background: colors.surfaceElevated,
                    borderColor: colors.border,
                    color: colors.textSecondary,
                }}
            >
                <RotateCcw size={16} />
                <span>Clear</span>
            </button>

            <button
                type="button"
                onClick={onSubmit}
                disabled={!canPost}
                className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-full text-sm font-bold tracking-wide disabled:opacity-60"
                style={{
                    background: canPost ? colors.primary : colors.surface,
                    color: canPost ? '#000000' : colors.textSecondary,
                    border: canPost ? 'none' : '1px solid ' + colors.border,
                }}
            >
                {posting ? (
                    <span
                        aria-label="Posting"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current"
                    />
                ) : (
                    <PostIcon
                        size={16}
                        color={canPost ? '#000000' : colors.textSecondary}
                    />
                )}

                <span>{postButtonLabel}</span>
            </button>
        </div>
    );
}
