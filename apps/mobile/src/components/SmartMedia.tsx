import { View, StyleSheet } from 'react-native';
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
    /** Open a viewer / player. */
    onPress?: () => void;
}) {
    const colors = useFanColors();

    const src = imageUrl ?? videoThumbnailUrl;
    if (!src) return null;

    const isVideo = !!videoUrl && !imageUrl;

    return (
        <PostImage
            uri={src}
            colors={colors}
            width={width}
            height={height}
            onPress={onPress}
            accessibilityLabel={isVideo ? 'Video' : 'Post image'}
            overlay={
                isVideo ? (
                    <View style={styles.playBadge}>
                        <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
                    </View>
                ) : undefined
            }
        />
    );
}

const styles = StyleSheet.create({
    playBadge: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 3, // optical centering for the triangle
    },
});