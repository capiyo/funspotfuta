// modals/NotificationGate.tsx
//
// RN port of main.dart's _showNotificationGateDialog — blocks login until
// notification permission is granted. Not dismissible (no backdrop close),
// matching the Dart PopScope(canPop: false) + barrierDismissible: false.

import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { Bell } from 'lucide-react-native';
import { colors } from '@/theme';

export default function NotificationGate({
    visible,
    onRetry,
}: {
    visible: boolean;
    onRetry: () => Promise<void>;
}) {
    const [requesting, setRequesting] = useState(false);

    async function handlePress() {
        setRequesting(true);
        await onRetry();
        setRequesting(false);
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { }}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <Bell size={28} color={colors.green} />
                    </View>
                    <Text style={styles.title}>Notifications Required</Text>
                    <Text style={styles.body}>
                        Funspot needs notification permission before you can log in, so you never miss
                        votes, comments, or comrade activity.
                    </Text>
                    <Pressable
                        onPress={handlePress}
                        disabled={requesting}
                        style={[styles.button, requesting && styles.buttonDisabled]}
                    >
                        {requesting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Allow Notifications</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 20,
        alignItems: 'center',
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(76, 217, 100, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 8 },
    body: {
        color: colors.textMuted,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 18,
    },
    button: {
        width: '100%',
        backgroundColor: colors.green,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});