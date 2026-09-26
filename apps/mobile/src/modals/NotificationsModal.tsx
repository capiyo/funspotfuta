// RN port of funspot-next/app/(app)/notifications/page.tsx —
// as a MODAL, not a route.

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import {
  fetchUnreadSummary,
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferences,
  UnreadSummary,
} from '@funspot/core';
import { colors } from '@/theme';

const LABELS: Record<keyof NotificationPreferences, string> = {
  vote_alerts: 'Vote alerts',
  like_alerts: 'Like alerts',
  comment_alerts: 'Comment alerts',
};

export default function NotificationsScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { userId, authToken } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState<UnreadSummary | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;
    (async () => {
      setLoading(true);
      const [s, p] = await Promise.all([
        fetchUnreadSummary(userId, authToken ?? undefined),
        getNotificationPreferences(userId),
      ]);
      setSummary(s);
      setPrefs(p);
      setLoading(false);
    })();
  }, [visible, userId, authToken]);

  async function toggle(key: keyof NotificationPreferences) {
    if (!prefs || !userId) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    const ok = await updateNotificationPreferences(
      userId,
      next,
      authToken ?? undefined,
    );
    setSaving(false);
    if (!ok) toast.showError('Failed to save preference');
  }

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

          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={14} color={colors.textMuted} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator
              color={colors.green}
              style={{ marginTop: 40 }}
            />
          ) : (
            <ScrollView
              style={styles.screen}
              contentContainerStyle={styles.content}
            >
              {summary && (
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{summary.notifications}</Text>
                    <Text style={styles.statLabel}>Unread notifications</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{summary.comments}</Text>
                    <Text style={styles.statLabel}>Unread comments</Text>
                  </View>
                </View>
              )}

              {prefs && (
                <View style={styles.prefList}>
                  {(Object.keys(LABELS) as (keyof NotificationPreferences)[]).map(
                    (key, i) => (
                      <View
                        key={key}
                        style={[styles.prefRow, i > 0 && styles.prefRowBorder]}
                      >
                        <Text style={styles.prefLabel}>{LABELS[key]}</Text>
                        <Pressable
                          disabled={saving}
                          onPress={() => toggle(key)}
                          style={[styles.toggle, prefs[key] && styles.toggleOn]}
                        >
                          <View
                            style={[
                              styles.toggleKnob,
                              prefs[key] && styles.toggleKnobOn,
                            ]}
                          />
                        </Pressable>
                      </View>
                    ),
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTitle: { color: 'white', fontSize: 15, fontWeight: '700' },
  closeBtn: {
    borderRadius: 999,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  screen: { backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: { color: 'white', fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10 },
  prefList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  prefRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  prefLabel: { color: 'white', fontSize: 13 },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 2,
  },
  toggleOn: { backgroundColor: colors.green },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'white' },
  toggleKnobOn: { transform: [{ translateX: 20 }] },
});