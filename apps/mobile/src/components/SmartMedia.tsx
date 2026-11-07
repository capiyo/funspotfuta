import { useState } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import { Play } from 'lucide-react-native';
import { useFanColors } from '@/theme/use-fan-colors';
import { PostImage } from '../components/ui/postImages';

export function SmartMedia({
    imageUrl,
    videoUrl,
    videoThumbnailUrl,
    width,
    height,
    onPress,
}: {
    imageUrl: string | null;
    videoUrl: string | null;
    videoThumbnailUrl: string | null;
    /** Intrinsic size of the image/thumbnail, if the API provides it. */
    width?: number;
    height?: number;
    /** Open a viewer / player for images. Videos have their own native controls. */
    onPress?: () => void;
}) {
    const colors = useFanColors();
    const [videoFailed, setVideoFailed] = useState(false);
    const [videoAttempt, setVideoAttempt] = useState(0);
    const [videoReady, setVideoReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [measuredVideoRatio, setMeasuredVideoRatio] = useState<number | null>(null);
    const suppliedRatio = width && height && width > 0 && height > 0 ? width / height : null;
    const videoRatio = suppliedRatio ?? measuredVideoRatio ?? 4 / 3;

    // Render an actual native player for video URLs. The previous implementation
    // only rendered the thumbnail with a play badge, so Android had no player
    // and tapping it could only open the comments callback.
    if (videoUrl) {
        return (
            <View style={[styles.videoFrame, { aspectRatio: videoRatio }]}>
                {!videoFailed ? (
                    <Video
                        key={videoAttempt}
                        source={{ uri: videoUrl }}
                        style={styles.video}
                        posterSource={videoThumbnailUrl ? { uri: videoThumbnailUrl } : undefined}
                        usePoster={!videoReady && Boolean(videoThumbnailUrl)}
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay={false}
                        isLooping={false}
                        isMuted={false}
                        useNativeControls
                        progressUpdateIntervalMillis={500}
                        onReadyForDisplay={({ naturalSize }) => {
                            setVideoReady(true);
                            if (naturalSize.width > 0 && naturalSize.height > 0) {
                                setMeasuredVideoRatio(naturalSize.width / naturalSize.height);
                            }
                        }}
                        onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                            if (status.isLoaded) setPlaying(status.isPlaying);
                            else if (status.error) setVideoFailed(true);
                        }}
                        onError={() => setVideoFailed(true)}
                    />
                ) : (
                    <View style={[styles.videoFallback, { backgroundColor: colors.surfaceSunken }]}>
                        {videoThumbnailUrl ? (
                            <PostImage
                                uri={videoThumbnailUrl}
                                colors={colors}
                                width={width}
                                height={height}
                                accessibilityLabel="Video thumbnail"
                            />
                        ) : null}
                        <Pressable
                            onPress={() => {
                                setVideoFailed(false);
                                setVideoReady(false);
                                setVideoAttempt((current) => current + 1);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Retry loading video"
                            style={[styles.retryVideo, { backgroundColor: colors.surface }]}
                        >
                            <Play size={16} color={colors.textPrimary} fill={colors.textPrimary} />
                            <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '700' }}>Retry video</Text>
                        </Pressable>
                    </View>
                )}
                {!videoReady && !videoFailed && !playing && (
                    <View pointerEvents="none" style={styles.playBadge}>
                        <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
                    </View>
                )}
            </View>
        );
    }

    const src = imageUrl ?? videoThumbnailUrl;
    if (!src) return null;

    return (
        <PostImage
            uri={src}
            colors={colors}
            width={width}
            height={height}
            onPress={onPress}
            accessibilityLabel="Post image"
        />
    );
}

const styles = StyleSheet.create({
    videoFrame: {
        width: '100%',
        overflow: 'hidden',
        borderRadius: 12,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    videoFallback: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryVideo: {
        position: 'absolute',
        bottom: 8,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    playBadge: {
        position: 'absolute',
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 3,
    },
});
