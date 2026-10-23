import { memo, useState } from 'react';
import {
    LayoutChangeEvent,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { ImageOff } from 'lucide-react-native';
import { useFanColors } from '@/theme/use-fan-colors';
import { ICON } from '@/theme/layout';

type Size = { w: number; h: number };
const sizeCache = new Map<string, Size>();
const FRAME_RATIO = 4 / 3;
const RADIUS = 12;

export const PostImage = memo(function PostImage({
    uri,
    colors,
    width,
    height,
    overlay,
    onPress,
    accessibilityLabel = 'Post image',
}: {
    uri: string;
    colors: ReturnType<typeof useFanColors>;
    width?: number;
    height?: number;
    overlay?: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
}) {
    const [boxW, setBoxW] = useState(0);
    const [failedUri, setFailedUri] = useState<string | null>(null);
    const [loaded, setLoaded] = useState<Size | null>(null);
    const failed = failedUri === uri;
    const natural: Size | null =
        width && height && width > 0 && height > 0
            ? { w: width, h: height }
            : sizeCache.get(uri) ?? loaded;

    const onLayout = (e: LayoutChangeEvent) => {
        const next = Math.round(e.nativeEvent.layout.width);
        if (next !== boxW) setBoxW(next);
    };

    const frameBase = {
        backgroundColor: colors.surfaceSunken,
        borderColor: colors.border,
    };

    const content = (
        <View
            onLayout={onLayout}
            style={[styles.frame, frameBase, failed ? styles.failedFrame : null]}
        >
            {failed ? (
                <ImageOff size={ICON.md} color={colors.textTertiary} />
            ) : (
                <>
                    {natural && boxW && natural.w / natural.h < FRAME_RATIO && (
                        <Image
                            source={{ uri }}
                            style={[StyleSheet.absoluteFill, styles.blurBackdrop]}
                            contentFit="cover"
                            blurRadius={18}
                            cachePolicy="memory-disk"
                            priority="normal"
                            accessible={false}
                        />
                    )}
                    <Image
                        source={{ uri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        priority="normal"
                        transition={0}
                        onLoad={(e) => {
                            const { width: w, height: h } = e.source;
                            if (!w || !h) return;
                            const size = { w, h };
                            sizeCache.set(uri, size);
                            setLoaded(size);
                        }}
                        onError={() => setFailedUri(uri)}
                        accessibilityLabel={accessibilityLabel}
                    />
                    {overlay && (
                        <View style={styles.overlay} pointerEvents="none">
                            {overlay}
                        </View>
                    )}
                </>
            )}
        </View>
    );

    return onPress ? (
        <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={accessibilityLabel}>
            {content}
        </Pressable>
    ) : content;
});

const styles = StyleSheet.create({
    frame: {
        width: '100%',
        aspectRatio: FRAME_RATIO,
        borderRadius: RADIUS,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    failedFrame: { backgroundColor: '#20252b' },
    blurBackdrop: { opacity: 0.35 },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
