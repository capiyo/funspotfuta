import { Image } from 'expo-image';
import { View, StyleSheet } from 'react-native';
import { useFanColors } from '@/theme/use-fan-colors';

export function SmartMedia({
    imageUrl,
    videoUrl,
    videoThumbnailUrl,
}: {
    imageUrl: string | null;
    videoUrl: string | null;
    videoThumbnailUrl: string | null;
}) {
    const colors = useFanColors();
    const styles = createStyles(colors);

    const src = imageUrl ?? videoThumbnailUrl;
    if (!src) return null;

    return (
        <View style={styles.wrap}>
            <Image
                source={{ uri: src }}
                style={styles.img}
                contentFit="cover"
                transition={150}
            />
        </View>
    );
}

function createStyles(colors: ReturnType<typeof useFanColors>) {
    return StyleSheet.create({
        wrap: {
            width: '100%',
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: colors.surfaceSunken,
        },
        img: { width: '100%', aspectRatio: 16 / 9 },
    });
}