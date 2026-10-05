import { memo, useState } from 'react';
import {
    LayoutChangeEvent,
    Pressable,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { ImageOff } from 'lucide-react-native';
import { useFanColors } from '@/theme/use-fan-colors';
import { ICON } from '@/theme/layout';

type Size = { w: number; h: number };

// Module-level cache: recycled list rows know their size immediately.
const sizeCache = new Map<string, Size>();

const PLACEHOLDER_RATIO = 4 / 3; // box shape until the real size is known
const MIN_RATIO = 0.5; // tallest allowed box is 1:2 (w:h)
const MAX_HEIGHT_FRACTION = 0.7; // never taller than 70% of the screen
const MAX_UPSCALE = 2; // don't blow tiny images up past 2x
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
    /** Optional intrinsic size from the API. Avoids any layout jump. */
    width?: number;
    height?: number;
    /** Rendered centered on top of the image (e.g. a play badge). */
    overlay?: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
}) {
    const { height: windowH } = useWindowDimensions();
    const [boxW, setBoxW] = useState(0);
    const [failedUri, setFailedUri] = useState<string | null>(null);
    const [loaded, setLoaded] = useState<Size | null>(null);

    const failed = failedUri === uri;
    const natural: Size | null =
        width && height
            ? { w: width, h: height }
            : sizeCache.get(uri) ?? (loaded && loaded.w ? loaded : null);

    const onLayout = (e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w !== boxW) setBoxW(w);
    };

    const frameBase = {
        backgroundColor: colors.surfaceSunken,
        borderColor: colors.border,
    };

    if (failed) {
        return (
            <View
                onLayout={onLayout}
                style={[styles.frame, frameBase, { aspectRatio: PLACEHOLDER_RATIO }]}
            >
                <ImageOff size={ICON.md} color={colors.textTertiary} />
            </View>
        );
    }

    // Size the box from the image's own ratio. Only extremely tall images are
    // capped, and they are shown whole, never cropped.
    let imgW = boxW;
    let imgH = boxW / PLACEHOLDER_RATIO;
    let sideBars = false;

    if (natural && boxW) {
        const ratio = natural.w / natural.h;
        const targetH = Math.min(
            boxW / Math.max(ratio, MIN_RATIO),
            windowH * MAX_HEIGHT_FRACTION,
        );
        const scale = Math.min(boxW / natural.w, targetH / natural.h, MAX_UPSCALE);
        imgW = Math.round(natural.w * scale);
        imgH = Math.round(natural.h * scale);
        sideBars = imgW < boxW - 1;
    }

    const content = (
        <View
            onLayout={onLayout}
            style={[
                styles.frame,
                frameBase,
                boxW ? { height: imgH } : { aspectRatio: PLACEHOLDER_RATIO },
            ]}
        >
            {sideBars && (
                <Image
                    source={{ uri }}
                    style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
                    contentFit="cover"
                    blurRadius={24}
                    accessible={false}
                />
            )}
            <Image
                source={{ uri }}
                // Until the size is known, fill the placeholder box so loading starts.
                style={natural && boxW ? { width: imgW, height: imgH } : StyleSheet.absoluteFill}
                contentFit="contain"
                transition={150}
                onLoad={(e) => {
                    const { width: w, height: h } = e.source;
                    if (!w || !h) return;
                    const s = { w, h };
                    sizeCache.set(uri, s);
                    setLoaded(s);
                }}
                onError={() => setFailedUri(uri)}
                accessibilityLabel={accessibilityLabel}
            />
            {overlay && (
                <View style={styles.overlay} pointerEvents="none">
                    {overlay}
                </View>
            )}
        </View>
    );

    return onPress ? (
        <Pressable
            onPress={onPress}
            accessibilityRole="imagebutton"
            accessibilityLabel={accessibilityLabel}
        >
            {content}
        </Pressable>
    ) : (
        content
    );
});

const styles = StyleSheet.create({
    frame: {
        width: '100%',
        borderRadius: RADIUS,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
});