import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useProfileAvatar } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

export function MiniAvatar({
    colors,
    label,
    userId,
    uri,
}: {
    colors: ReturnType<typeof useFanColors>;
    label: string;
    userId?: string;
    uri?: string | null;
}) {
    const [failed, setFailed] = useState(false);
    const profileAvatar = useProfileAvatar(userId);
    const imageUri = profileAvatar ?? uri ?? (userId ? `https://i.pravatar.cc/150?u=${encodeURIComponent(userId)}` : null);
    return (
        <View style={[styles.box, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
            {imageUri && !failed ? (
                <Image source={{ uri: imageUri }} style={styles.img} resizeMode="cover" onError={() => setFailed(true)} />
            ) : (
                <Text style={fanText('tag', colors, colors.primary)}>{(label || '?').charAt(0).toUpperCase()}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    box: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    img: { width: '100%', height: '100%' },
});
